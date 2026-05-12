const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 4288);
const HOST = process.env.HOST || (process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1");
const ROOT = __dirname;
const LOCAL_WORKSPACE = path.resolve(ROOT, "..", "CoachOS");
const WORKSPACE = process.env.NEXUSOS_WORKSPACE_DIR || (fs.existsSync(LOCAL_WORKSPACE) ? LOCAL_WORKSPACE : path.join(ROOT, "workspace"));
const PUBLIC = path.join(ROOT, "public");
const DATA_DIR = process.env.NEXUSOS_DATA_DIR || path.join(ROOT, "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const SUBSCRIBERS_FILE = path.join(DATA_DIR, "subscribers.json");
const EMAIL_LOG_FILE = path.join(DATA_DIR, "email-log.json");
const OUTPUTS = path.join(WORKSPACE, "10_Outputs");
const BUSINESS_CLIENTS = path.join(WORKSPACE, "11_Business_Builder", "Clients");
const APP_NAME = "NexusOS";
const APP_VERSION = "0.10.0-saas-foundation";
const AUTH_REQUIRED = process.env.AUTH_REQUIRED !== "false";
const REQUIRE_LIVE_SERVICES = process.env.NEXUSOS_REQUIRE_LIVE_SERVICES === "true";
const DEFAULT_ADMIN_EMAIL = process.env.NEXUSOS_ADMIN_EMAIL || "admin@nexusos.local";
const DEFAULT_ADMIN_PASSWORD = process.env.NEXUSOS_ADMIN_PASSWORD || "nexusos-admin";
const sessions = new Map();
const subscriberSessions = new Map();

const subscriptionPlans = {
  starter: {
    id: "starter",
    name: "Starter",
    price: 49,
    interval: "month",
    promise: "Launch workspace, landing page, and starter AI assistant package.",
    features: ["Public intake", "Client workspace", "Landing page", "AI assistant package", "Starter social calendar"]
  },
  growth: {
    id: "growth",
    name: "Growth",
    price: 149,
    interval: "month",
    promise: "Adds CRM, social workflows, phone workflow, and agentic automation.",
    features: ["Everything in Starter", "Lead pipeline", "Social workflow", "Phone assistant workflow", "Agentic workflow runs"]
  },
  pro: {
    id: "pro",
    name: "Pro",
    price: 299,
    interval: "month",
    promise: "For businesses that want full AI service operations.",
    features: ["Everything in Growth", "Advanced assistant studio", "SMS-ready workflow", "Priority setup", "Monthly optimization review"]
  }
};

function integrationStatus() {
  const database = Boolean(process.env.DATABASE_URL || (process.env.NEXUSOS_DATA_DIR || process.env.NEXUSOS_WORKSPACE_DIR));
  const openai = Boolean(process.env.OPENAI_API_KEY);
  const stripe = Boolean(process.env.STRIPE_SECRET_KEY);
  const twilio = Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER);
  return {
    strictMode: REQUIRE_LIVE_SERVICES,
    database: {
      connected: database,
      mode: process.env.DATABASE_URL ? "postgres-ready" : "persistent-file-store",
      requiredEnv: "DATABASE_URL or persistent NEXUSOS_DATA_DIR/NEXUSOS_WORKSPACE_DIR"
    },
    openai: {
      connected: openai,
      mode: openai ? "live" : "not-connected",
      requiredEnv: "OPENAI_API_KEY"
    },
    stripe: {
      connected: stripe,
      mode: stripe ? "live-checkout" : "not-connected",
      requiredEnv: "STRIPE_SECRET_KEY"
    },
    twilio: {
      connected: twilio,
      mode: twilio ? "live-sms" : "not-connected",
      requiredEnv: "TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER"
    }
  };
}

function requireIntegration(name) {
  const status = integrationStatus()[name];
  if (REQUIRE_LIVE_SERVICES && status && !status.connected) {
    throw new Error(`${name} is not connected. Set ${status.requiredEnv} in Render.`);
  }
}

const agentFiles = {
  coach: path.join(WORKSPACE, "00_Command_Center", "COACHOS_COMMAND_CENTER.md"),
  strategy: path.join(WORKSPACE, "01_Strategy", "STRATEGY_AGENT.md"),
  investor: path.join(WORKSPACE, "02_Investor_Funding", "INVESTOR_AGENT.md"),
  product: path.join(WORKSPACE, "03_Product_AgriNexus", "PRODUCT_AGENT.md"),
  operations: path.join(WORKSPACE, "04_Operations", "OPERATIONS_AGENT.md"),
  research: path.join(WORKSPACE, "05_Research", "RESEARCH_AGENT.md"),
  content: path.join(WORKSPACE, "06_Content", "CONTENT_AGENT.md"),
  partnerships: path.join(WORKSPACE, "07_Partnerships", "PARTNERSHIP_AGENT.md"),
  technical: path.join(WORKSPACE, "08_Technical", "TECHNICAL_AGENT.md"),
  business: path.join(WORKSPACE, "11_Business_Builder", "BUSINESS_BUILDER_AGENT.md")
};

const agentProfiles = {
  coach: {
    name: "Nexus Prime",
    outputFolder: "00_Command_Center",
    promise: "clarity, focus, and the next best move",
    sections: ["Situation", "Priority Read", "Highest-Value Move", "Action Plan", "NexusOS Memory"]
  },
  strategy: {
    name: "Strategy Agent",
    outputFolder: "01_Strategy",
    promise: "business model, direction, and decision support",
    sections: ["Strategic Read", "Best Path", "Risks", "Assumptions To Test", "Next Three Moves"]
  },
  investor: {
    name: "Investor Agent",
    outputFolder: "02_Investor_Funding",
    promise: "funding story, investor Q&A, and pitch readiness",
    sections: ["Investor Story", "Proof Points", "Likely Questions", "Strong Answers", "Follow-Up Move"]
  },
  product: {
    name: "Product Agent",
    outputFolder: "03_Product_AgriNexus",
    promise: "feature planning, roadmap, and user workflows",
    sections: ["User Need", "Workflow", "Product Gap", "Build Recommendation", "Test Steps"]
  },
  operations: {
    name: "Operations Agent",
    outputFolder: "04_Operations",
    promise: "daily execution, weekly priorities, and follow-up control",
    sections: ["Priority Stack", "Today", "This Week", "People To Contact", "Open Loops"]
  },
  research: {
    name: "Research Agent",
    outputFolder: "05_Research",
    promise: "market, country, competitor, and funding research framing",
    sections: ["Research Question", "What Matters", "Signals To Verify", "Opportunity", "Recommended Search Plan"]
  },
  content: {
    name: "Content Agent",
    outputFolder: "06_Content",
    promise: "scripts, decks, one-pagers, and polished language",
    sections: ["Audience", "Core Message", "Draft Copy", "Stronger Version", "Call To Action"]
  },
  partnerships: {
    name: "Partnership Agent",
    outputFolder: "07_Partnerships",
    promise: "partner targeting, outreach, and pilot framing",
    sections: ["Partner Fit", "Why They Care", "Outreach Angle", "Ask", "Follow-Up Plan"]
  },
  technical: {
    name: "Technical Agent",
    outputFolder: "08_Technical",
    promise: "code, deployment, integration, and readiness support",
    sections: ["Current State", "Technical Risk", "Recommended Fix", "Validation", "Release Note"]
  },
  business: {
    name: "Business Builder Agent",
    outputFolder: "11_Business_Builder",
    promise: "business launch kits, websites, social media, and customer AI assistants",
    sections: ["Business Snapshot", "Ideal Customer", "Offer Menu", "Website Plan", "Social Media Plan", "AI Assistant Plan", "30-Day Launch Plan"]
  }
};

const agenticAgents = {
  orchestrator: {
    name: "Nexus Orchestrator",
    role: "understands the request, selects specialist agents, and coordinates the workflow",
    tools: ["plan", "delegate", "verify", "summarize"]
  },
  intake: {
    name: "Intake Agent",
    role: "turns a client request into structured business context",
    tools: ["client_intake", "needs_analysis"]
  },
  businessBuilder: {
    name: "Business Builder Agent",
    role: "creates the launch kit, offer structure, website prototype, and client workspace",
    tools: ["build_business_kit"]
  },
  landingPage: {
    name: "Landing Page Agent",
    role: "creates service pages and lead capture pages for small businesses",
    tools: ["create_landing_page"]
  },
  assistantStudio: {
    name: "Assistant Studio Agent",
    role: "builds, tests, and packages the client AI assistant",
    tools: ["package_assistant", "test_assistant"]
  },
  marketing: {
    name: "Marketing Agent",
    role: "creates social posts, outreach scripts, and campaign next steps",
    tools: ["social_calendar", "outreach_scripts"]
  },
  crm: {
    name: "CRM Agent",
    role: "tracks leads, stages, next actions, and follow-up tasks",
    tools: ["lead_pipeline", "task_board"]
  },
  phone: {
    name: "Phone Agent",
    role: "creates phone assistant scripts, missed-call replies, and SMS handoff workflows",
    tools: ["phone_workflow", "send_sms"]
  },
  qa: {
    name: "QA Agent",
    role: "checks that assets exist, links are available, and the client workspace is usable",
    tools: ["readiness_check", "artifact_check"]
  }
};

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function readText(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
}

function json(res, status, payload) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(payload));
}

function text(res, status, contentType, payload) {
  res.writeHead(status, { "content-type": contentType });
  res.end(payload);
}

function parseCookies(req) {
  const header = req.headers.cookie || "";
  return Object.fromEntries(header.split(";").map(item => {
    const index = item.indexOf("=");
    if (index === -1) return null;
    return [item.slice(0, index).trim(), decodeURIComponent(item.slice(index + 1).trim())];
  }).filter(Boolean));
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || "").split(":");
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(String(password), salt, 64);
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), candidate);
}

function ensureUsers() {
  ensureDir(DATA_DIR);
  if (fs.existsSync(USERS_FILE)) return readJson(USERS_FILE, []);
  const users = [{
    id: crypto.randomUUID(),
    email: DEFAULT_ADMIN_EMAIL.toLowerCase(),
    name: "NexusOS Admin",
    role: "owner",
    passwordHash: hashPassword(DEFAULT_ADMIN_PASSWORD),
    createdAt: new Date().toISOString()
  }];
  writeJson(USERS_FILE, users);
  return users;
}

function publicUser(user) {
  if (!user) return null;
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

function currentUser(req) {
  if (!AUTH_REQUIRED) return { id: "local-dev", email: "local@nexusos.dev", name: "Local Dev", role: "owner" };
  const sid = parseCookies(req).nexusos_session;
  if (!sid) return null;
  const session = sessions.get(sid);
  if (!session || new Date(session.expiresAt) < new Date()) {
    if (sid) sessions.delete(sid);
    return null;
  }
  return session.user;
}

function setSession(res, user) {
  const sid = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 12).toISOString();
  sessions.set(sid, { user: publicUser(user), expiresAt });
  res.setHeader("set-cookie", `nexusos_session=${sid}; HttpOnly; SameSite=Lax; Path=/; Max-Age=43200`);
}

function clearSession(req, res) {
  const sid = parseCookies(req).nexusos_session;
  if (sid) sessions.delete(sid);
  res.setHeader("set-cookie", "nexusos_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
}

function login(body) {
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const user = ensureUsers().find(item => item.email === email);
  if (!user || !verifyPassword(password, user.passwordHash)) return null;
  return user;
}

function subscribers() {
  return readJson(SUBSCRIBERS_FILE, []);
}

function saveSubscribers(list) {
  writeJson(SUBSCRIBERS_FILE, list);
}

function publicSubscriber(subscriber) {
  return {
    id: subscriber.id,
    email: subscriber.email,
    name: subscriber.name,
    businessName: subscriber.businessName,
    plan: subscriber.plan,
    status: subscriber.status,
    clientSlug: subscriber.clientSlug,
    portalToken: subscriber.portalToken,
    temporaryPassword: subscriber.temporaryPassword || null,
    createdAt: subscriber.createdAt
  };
}

function currentSubscriber(req) {
  const sid = parseCookies(req).nexusos_subscriber;
  if (!sid) return null;
  const session = subscriberSessions.get(sid);
  if (!session || new Date(session.expiresAt) < new Date()) {
    if (sid) subscriberSessions.delete(sid);
    return null;
  }
  return session.subscriber;
}

function setSubscriberSession(res, subscriber) {
  const sid = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();
  subscriberSessions.set(sid, { subscriber: publicSubscriber(subscriber), expiresAt });
  res.setHeader("set-cookie", `nexusos_subscriber=${sid}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`);
}

function clearSubscriberSession(req, res) {
  const sid = parseCookies(req).nexusos_subscriber;
  if (sid) subscriberSessions.delete(sid);
  res.setHeader("set-cookie", "nexusos_subscriber=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
}

function subscriberByEmail(email) {
  return subscribers().find(item => item.email?.toLowerCase() === String(email || "").trim().toLowerCase());
}

function loginSubscriber(body) {
  const subscriber = subscriberByEmail(body.email);
  if (!subscriber || !subscriber.passwordHash) return null;
  if (!verifyPassword(body.password || "", subscriber.passwordHash)) return null;
  return subscriber;
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy();
        reject(new Error("Request body too large"));
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
  });
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy();
        reject(new Error("Request body too large"));
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function safeSlug(value) {
  return String(value || "nexusos-output")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "nexusos-output";
}

function titleCase(value) {
  return String(value || "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, char => char.toUpperCase())
    .trim();
}

function inferBusiness(body) {
  const request = String(body.request || "").trim();
  const objective = String(body.objective || "").trim();
  const audience = String(body.audience || "").trim();
  const combined = [request, objective, audience].filter(Boolean).join(" ");
  const nameMatch = combined.match(/(?:business named|called|for)\s+([A-Z][A-Za-z0-9&' ]{2,40})/);
  const lower = combined.toLowerCase();
  const industries = [
    ["detailing", "Mobile Detailing"],
    ["cleaning", "Cleaning Service"],
    ["catering", "Catering"],
    ["lawn", "Lawn Care"],
    ["barber", "Barber / Grooming"],
    ["beauty", "Beauty Services"],
    ["trucking", "Trucking / Logistics"],
    ["daycare", "Childcare"],
    ["fitness", "Fitness Coaching"],
    ["nonprofit", "Nonprofit"],
    ["farm", "Agriculture"],
    ["consult", "Consulting"]
  ];
  const industry = body.industry || (industries.find(([needle]) => lower.includes(needle))?.[1] || "Local Service Business");
  const locationMatch = combined.match(/\bin\s+([A-Z][A-Za-z '-]{2,40})(?:\.|,|$)/);
  const location = body.location || (locationMatch ? locationMatch[1].trim() : "the local community");
  const businessName = body.businessName || (nameMatch ? nameMatch[1].trim() : `${location === "the local community" ? "Local" : location} ${industry}`);
  const customer = body.customer || audience || "local customers who need reliable, professional help";
  const problem = body.problem || "customers need a trustworthy provider, clear information, easy booking, and consistent follow-up";
  return {
    businessName: titleCase(businessName),
    slug: safeSlug(businessName),
    industry,
    location,
    customer,
    problem,
    request: request || "Build a launch-ready business kit.",
    objective: objective || "Launch the business and start getting customers.",
    audience: audience || "new small business owner"
  };
}

function businessLaunchKit(info) {
  return `# ${info.businessName} Launch Kit

## Business Snapshot

${info.businessName} is a ${info.industry.toLowerCase()} serving ${info.location}. The business helps ${info.customer} solve this problem: ${info.problem}.

## Core Offer

- Starter service: entry-level offer that makes it easy for a new customer to say yes.
- Signature service: the main package the business should be known for.
- Premium service: higher-value option for customers who want full support.

## Ideal Customer

The ideal customer is someone in ${info.location} who wants convenience, trust, clear pricing, and a professional experience.

## Brand Promise

Reliable service, clear communication, and results customers can feel confident recommending.

## Website Plan

1. Home: explain the offer and make the call to action obvious.
2. Services: list packages and benefits.
3. About: build trust with the owner story.
4. FAQ: answer common questions.
5. Contact: make it easy to call, text, book, or request a quote.

## Social Media Plan

Post around four content pillars:

1. Education: tips and answers.
2. Proof: before/after, testimonials, results.
3. Trust: behind the scenes, owner story, process.
4. Offers: promotions, booking reminders, seasonal pushes.

## AI Customer Assistant Plan

The assistant should greet visitors, explain services, answer common questions, collect name/contact/service need/location, and route serious questions to the owner.

## Phone Assistant Plan

The phone assistant should answer or support calls with a clear greeting, collect the customer's name, service need, location, timing, and follow-up number, then summarize the call for the owner. Missed calls should receive a friendly text response within minutes.

## First 30 Days

Week 1: finalize offer, pricing, and website copy.
Week 2: launch website and social profiles.
Week 3: post daily content and begin outreach.
Week 4: collect testimonials, improve offers, and follow up with leads.

## First Move

Publish the website, create three launch posts, and personally contact the first 25 likely customers or referral partners.
`;
}

function websiteHtml(info) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${info.businessName}</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header class="hero">
    <nav><strong>${info.businessName}</strong><a href="#contact">Request a quote</a></nav>
    <div class="hero-inner">
      <p class="eyebrow">${info.industry} in ${info.location}</p>
      <h1>Reliable help for customers who want the job done right.</h1>
      <p>${info.businessName} helps ${info.customer} with professional service, clear communication, and easy next steps.</p>
      <a class="button" href="#contact">Get started</a>
    </div>
  </header>
  <main>
    <section>
      <p class="eyebrow">What we solve</p>
      <h2>${info.problem}</h2>
      <p>We make it easier to understand the service, choose the right option, and get a response without confusion.</p>
    </section>
    <section class="grid">
      <article><h3>Starter</h3><p>Simple entry service for first-time customers.</p></article>
      <article><h3>Signature</h3><p>The main package for the best balance of value and results.</p></article>
      <article><h3>Premium</h3><p>Full-service support for customers who want the complete experience.</p></article>
    </section>
    <section>
      <p class="eyebrow">Why customers choose us</p>
      <h2>Professional service, local trust, and clear follow-up.</h2>
      <p>Use this section for testimonials, before-and-after results, certifications, or a short owner story.</p>
    </section>
    <section id="contact" class="contact">
      <p class="eyebrow">Next step</p>
      <h2>Request a quote or ask a question.</h2>
      <form>
        <input placeholder="Name">
        <input placeholder="Phone or email">
        <textarea placeholder="What do you need help with?"></textarea>
        <button type="button">Send request</button>
      </form>
    </section>
  </main>
</body>
</html>`;
}

function websiteCss() {
  return `:root{--ink:#172d28;--muted:#667a73;--green:#1b8f68;--bg:#f6f7f1;--line:#dbe4df}*{box-sizing:border-box}body{margin:0;font-family:Segoe UI,Arial,sans-serif;color:var(--ink);background:var(--bg);line-height:1.5}nav{display:flex;justify-content:space-between;align-items:center;padding:22px 6vw}nav a,.button,button{background:var(--green);color:white;text-decoration:none;border:0;border-radius:8px;padding:12px 16px;font-weight:800}.hero{min-height:76vh;background:linear-gradient(135deg,#f6f7f1,#dfeee7)}.hero-inner{padding:70px 6vw;max-width:900px}.eyebrow{color:var(--green);font-weight:900;text-transform:uppercase;font-size:.82rem}h1{font-size:clamp(2.4rem,6vw,5.7rem);line-height:.95;margin:12px 0 22px}h2{font-size:clamp(1.8rem,4vw,3.2rem);line-height:1.05;margin:8px 0 16px}section{padding:64px 6vw;border-top:1px solid var(--line)}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}article{background:white;border:1px solid var(--line);border-radius:8px;padding:22px}.contact{background:white}form{display:grid;gap:12px;max-width:620px}input,textarea{padding:14px;border:1px solid var(--line);border-radius:8px;font:inherit}@media(max-width:800px){.grid{grid-template-columns:1fr}nav{align-items:flex-start;gap:12px;flex-direction:column}}`;
}

function socialCalendar(info) {
  const rows = ["Day,Platform,Post Type,Caption,Call To Action"];
  const ideas = [
    ["1", "Facebook", "Introduction", `Meet ${info.businessName}: ${info.industry.toLowerCase()} built for ${info.location}.`, "Message us for details"],
    ["2", "Instagram", "Education", `3 signs it is time to book a reliable ${info.industry.toLowerCase()} provider.`, "Save this post"],
    ["3", "TikTok/Reels", "Behind the scenes", "Show the process, tools, setup, or owner preparation.", "Follow for more"],
    ["4", "Facebook", "Offer", "Now accepting new customers this week.", "Request a quote"],
    ["5", "Instagram", "Trust", "Share a customer result, testimonial, or owner story.", "Send a DM"],
    ["6", "LinkedIn", "Business story", `Why ${info.businessName} was created for ${info.customer}.`, "Connect with us"],
    ["7", "All", "Weekly recap", "What we worked on this week and what openings are available.", "Book now"]
  ];
  ideas.forEach(row => rows.push(row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")));
  return rows.join("\n");
}

function assistantPrompt(info) {
  return `# ${info.businessName} Customer AI Assistant

## Role

You are the customer assistant for ${info.businessName}, a ${info.industry.toLowerCase()} serving ${info.location}.

## Tone

Friendly, clear, professional, and helpful.

## Main Jobs

1. Greet customers.
2. Explain services.
3. Answer common questions.
4. Collect lead information.
5. Help customers request a quote or appointment.
6. Escalate anything urgent or unusual to the owner.

## Lead Intake Questions

- What is your name?
- What service do you need?
- What city or area are you in?
- When do you need help?
- What is the best phone number or email for follow-up?

## Sample Greeting

Hi, thanks for contacting ${info.businessName}. I can help answer questions, explain services, and collect the details needed for a quote.

## Escalation Rules

Escalate to the owner when a customer asks about custom pricing, complaints, urgent timing, partnerships, refunds, or anything outside the standard offer.
`;
}

function phoneAssistantScript(info) {
  return `# ${info.businessName} Phone Assistant Workflow

## Purpose

Help ${info.businessName} answer calls, capture leads, route urgent issues, and follow up professionally.

## Phone Greeting

Thank you for calling ${info.businessName}. I can help answer basic questions, collect details for a quote, or help request an appointment.

## Call Intake Questions

1. May I have your name?
2. What service are you calling about?
3. What city or area are you located in?
4. When do you need the service?
5. What is the best phone number for follow-up?
6. Is there anything urgent the owner should know?

## Quote Request Flow

I can collect the information needed for a quote. Please share the service you need, a short description of the job, your location, preferred timing, and whether you want a call or text back.

## Appointment Request Flow

I can collect your preferred time and send it to the owner for confirmation. What day works best, what time window do you prefer, and what service do you need?

## Missed-Call Text

Hi, this is ${info.businessName}. Sorry we missed your call. How can we help you today? You can reply with the service you need, your location, and the best time to follow up.

## Follow-Up Text

Hi, this is ${info.businessName} following up on your request. We have your information and will confirm the next step shortly. Thank you for reaching out.

## Voicemail Script

Thank you for calling ${info.businessName}. We are sorry we missed your call. Please leave your name, phone number, the service you need, your location, and the best time to reach you. We will follow up as soon as possible.

## Urgent Escalation Rules

Escalate to the owner immediately when a customer is upset, asks for a refund, has urgent timing, asks for custom pricing, reports a safety issue, asks about partnerships, or requests something outside standard services.

## Owner Handoff Summary

Customer:
Phone:
Service requested:
Location:
Preferred timing:
Urgency:
Notes:
Recommended next step:
`;
}

function aiAssistantSystem(info) {
  return `# ${info.businessName} AI Assistant System

## Assistant Overview

The AI assistant system helps ${info.businessName} communicate, market, follow up, and stay organized.

Recommended assistant name: ${info.businessName} Assistant

Tone: friendly, clear, professional, helpful, and local.

## Social Media Assistant

### Jobs

- create weekly post ideas
- write captions
- suggest hashtags
- create short video ideas
- promote offers
- share customer education
- create testimonial and proof posts

### Content Pillars

1. Helpful tips for ${info.customer}.
2. Proof of quality and reliability.
3. Behind-the-scenes owner/process content.
4. Offers, openings, and booking reminders.

### Weekly Rhythm

- Monday: helpful tip
- Tuesday: service explanation
- Wednesday: proof or customer story
- Thursday: behind the scenes
- Friday: offer or booking reminder

## Lead Research Assistant

### Ideal Leads

People or organizations in ${info.location} who need ${info.industry.toLowerCase()} and value reliable service.

### Where To Research

- local Facebook groups
- Google Maps business categories
- community pages
- chambers of commerce
- neighborhood associations
- referral partners
- local events

### Outreach Criteria

Only contact people or organizations where the service is relevant. Avoid spam, private data scraping, and mass messaging without permission.

## Customer Communication Assistant

### Greeting

Thanks for contacting ${info.businessName}. I can help answer questions, explain services, and collect details for a quote.

### Quote Follow-Up

Hi, this is ${info.businessName}. I’m following up on your quote request. Do you still need help, and would you like us to confirm the next available time?

### Appointment Confirmation

Your request has been received. We will confirm the final appointment time and any details needed before service.

### Review Request

Thank you for choosing ${info.businessName}. If you were happy with the service, a quick review would really help the business grow.

## Website Chat Assistant

### Main Jobs

- explain services
- answer FAQs
- collect customer name and contact
- collect service need and location
- route urgent or custom requests to the owner

### Lead Intake Questions

1. What is your name?
2. What service do you need?
3. What city or area are you in?
4. When do you need service?
5. What is the best phone or email for follow-up?

## Phone Assistant

Use the dedicated Phone Assistant Workflow file for call scripts, missed-call text, voicemail, and owner handoff.

## Follow-Up Assistant

### Lead Stages

1. New lead
2. Contacted
3. Quote sent
4. Booked
5. Completed
6. Review requested
7. Recontact later

### Follow-Up Timing

- New lead: same day
- Quote sent: next day
- No response: 3 days later
- Completed job: same day thank-you
- Review request: 1 day after completion

## Escalation Rules

Escalate to the owner when the customer asks for refunds, custom pricing, urgent timing, complaints, safety concerns, partnerships, bulk service, or anything outside standard services.

## Weekly Operating Routine

Monday: plan posts and review leads.
Tuesday: send follow-ups and publish education content.
Wednesday: post proof/testimonial content.
Thursday: research referral partners.
Friday: publish offer and review open leads.
Weekend: respond to missed messages and prepare next week.
`;
}

function outreachScripts(info) {
  return `# ${info.businessName} Outreach Scripts

## Text Message

Hi, this is ${info.businessName}. We are now helping customers in ${info.location} with ${info.industry.toLowerCase()}. If you or someone you know needs reliable service, I would be glad to send details.

## Facebook Post

We are excited to introduce ${info.businessName}, a local ${info.industry.toLowerCase()} focused on reliable service, clear communication, and professional results. We are now accepting new customers in ${info.location}. Message us to request a quote.

## Referral Ask

If you know someone who needs ${info.industry.toLowerCase()}, please send them our way. We are building through trust, referrals, and strong service.

## Follow-Up

Hi, just following up to see if you still need help. I can answer questions, explain options, or help you choose the right service.
`;
}

function buildBusinessKit(body) {
  const info = inferBusiness(body);
  const clientDir = path.join(BUSINESS_CLIENTS, info.slug);
  const websiteDir = path.join(clientDir, "website");
  ensureDir(websiteDir);
  const files = [
    ["01_Launch_Kit.md", businessLaunchKit(info)],
    ["02_Social_Calendar.csv", socialCalendar(info)],
    ["03_AI_Assistant_System.md", aiAssistantSystem(info)],
    ["04_Customer_AI_Assistant.md", assistantPrompt(info)],
    ["05_Phone_Assistant_Workflow.md", phoneAssistantScript(info)],
    ["06_Outreach_Scripts.md", outreachScripts(info)],
    [path.join("website", "index.html"), websiteHtml(info)],
    [path.join("website", "styles.css"), websiteCss()]
  ];
  files.forEach(([file, content]) => {
    fs.writeFileSync(path.join(clientDir, file), content, "utf8");
  });
  return {
    info,
    clientDir,
    files: files.map(([file]) => path.join(clientDir, file)),
    websiteUrl: `/clients/${info.slug}/website/index.html`,
    summary: businessLaunchKit(info)
  };
}

function clientPath(slug) {
  const cleanSlug = safeSlug(slug);
  const dir = path.normalize(path.join(BUSINESS_CLIENTS, cleanSlug));
  if (!dir.startsWith(BUSINESS_CLIENTS)) throw new Error("Invalid client");
  return dir;
}

function clientFiles(slug) {
  const dir = clientPath(slug);
  if (!fs.existsSync(dir)) return [];
  const results = [];
  const walk = current => {
    fs.readdirSync(current, { withFileTypes: true }).forEach(entry => {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) return walk(fullPath);
      const rel = path.relative(dir, fullPath).replace(/\\/g, "/");
      const stat = fs.statSync(fullPath);
      results.push({
        name: rel,
        size: stat.size,
        updatedAt: stat.mtime.toISOString(),
        url: `/clients/${safeSlug(slug)}/${rel}`
      });
    });
  };
  walk(dir);
  return results.sort((a, b) => a.name.localeCompare(b.name));
}

function readClientFile(slug, name) {
  const dir = clientPath(slug);
  const filePath = path.normalize(path.join(dir, name));
  if (!filePath.startsWith(dir) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return "";
  return fs.readFileSync(filePath, "utf8");
}

function clientInfo(slug) {
  const files = clientFiles(slug);
  const launch = readClientFile(slug, "01_Launch_Kit.md");
  const nameMatch = launch.match(/^#\s+(.+?)\s+Launch Kit/m);
  const businessName = nameMatch ? nameMatch[1].trim() : titleCase(slug);
  const has = token => files.some(file => file.name.toLowerCase().includes(token));
  const workflow = [
    { key: "launch", label: "Launch Kit", complete: has("launch_kit") },
    { key: "social", label: "Social Media", complete: has("social_calendar") },
    { key: "assistant", label: "AI Assistant", complete: has("ai_assistant") },
    { key: "phone", label: "Phone Assistant", complete: has("phone_assistant") },
    { key: "outreach", label: "Outreach", complete: has("outreach") },
    { key: "website", label: "Website", complete: files.some(file => file.name === "website/index.html") }
  ];
  const stat = fs.statSync(clientPath(slug));
  return {
    slug: safeSlug(slug),
    businessName,
    path: clientPath(slug),
    updatedAt: stat.mtime.toISOString(),
    websiteUrl: `/clients/${safeSlug(slug)}/website/index.html`,
    files,
    workflow
  };
}

function clientWorkflowOutput(slug, action) {
  const detail = clientInfo(slug);
  const now = new Date().toLocaleString();
  const actionLabels = {
    social: "Social Media Sprint",
    leads: "Lead Pipeline Sprint",
    followup: "Follow-Up Sprint",
    assistant: "AI Assistant Activation",
    phone: "Phone Assistant Activation",
    website: "Website Improvement Sprint"
  };
  const label = actionLabels[action] || "Client Workflow Sprint";
  const sections = {
    social: [
      "Create five posts: education, proof, trust, offer, and customer story.",
      "Turn one post into a short video script.",
      "Export the next seven days into the social calendar."
    ],
    leads: [
      "Define the top three customer types.",
      "Create a first-contact message, follow-up message, and referral ask.",
      "Track each lead as new, contacted, interested, booked, won, or lost."
    ],
    followup: [
      "Send a same-day reply to every open lead.",
      "Create a 24-hour follow-up and a 72-hour follow-up.",
      "Escalate urgent, high-value, or unhappy customers to the owner."
    ],
    assistant: [
      "Confirm greeting, service explanation, lead capture, and owner handoff.",
      "Add five frequently asked questions.",
      "Test the assistant with a price question, booking question, and complaint."
    ],
    phone: [
      "Use the phone script to collect name, need, location, timing, and callback number.",
      "Send missed-call text within minutes.",
      "Summarize every call for the owner with next action."
    ],
    website: [
      "Review headline, services, proof, contact options, and call to action.",
      "Make the booking action visible above the fold.",
      "Confirm the website reflects the current offer."
    ]
  };
  const steps = sections[action] || [
    "Review the current client assets.",
    "Choose the highest-value next workflow.",
    "Create the next asset and save it to the client workspace."
  ];
  return `# ${detail.businessName} - ${label}

Created: ${now}

## Workflow Goal

Move ${detail.businessName} from generated assets into active execution.

## Action Steps

${steps.map((step, index) => `${index + 1}. ${step}`).join("\n")}

## Owner Dashboard

- Website: ${detail.websiteUrl}
- Client folder: ${detail.path}
- Current files: ${detail.files.length}

## Success State

This workflow is ready when the owner can open the client workspace, see the next action, use the generated script or asset, and follow up with a real customer or lead.
`;
}

function runClientWorkflow(body) {
  const slug = safeSlug(body.slug);
  const action = safeSlug(body.action || "workflow");
  const dir = clientPath(slug);
  if (!fs.existsSync(dir)) throw new Error("Client not found");
  const workflowDir = path.join(dir, "workflows");
  ensureDir(workflowDir);
  const stamp = new Date().toISOString().slice(0, 10);
  const file = path.join(workflowDir, `${stamp}-${action}.md`);
  const output = clientWorkflowOutput(slug, action);
  fs.writeFileSync(file, output, "utf8");
  return { output, file, client: clientInfo(slug) };
}

function workspacePath(slug) {
  return path.join(clientPath(slug), "workspace.json");
}

function defaultClientWorkspace(slug) {
  const detail = clientInfo(slug);
  return {
    slug: detail.slug,
    businessName: detail.businessName,
    updatedAt: new Date().toISOString(),
    leads: [
      { name: "New inquiry", contact: "phone/email", need: "Request a quote", stage: "new", nextAction: "Reply today" },
      { name: "Referral partner", contact: "local contact", need: "Partnership outreach", stage: "contacted", nextAction: "Send intro message" }
    ],
    socialPosts: [
      { platform: "Facebook", status: "draft", caption: `Meet ${detail.businessName}. We are helping local customers get reliable service with clear communication and easy next steps.` },
      { platform: "Instagram", status: "draft", caption: "Behind the scenes: a quick look at how we prepare to deliver a professional customer experience." },
      { platform: "Google Business", status: "ready", caption: "Now accepting new customers. Message us to ask a question or request a quote." }
    ],
    assistantScripts: {
      greeting: `Thanks for contacting ${detail.businessName}. I can answer questions, explain services, and collect details for a quote.`,
      leadCapture: "What service do you need, what city are you in, and what is the best phone or email for follow-up?",
      escalation: "I will send this to the owner so they can personally follow up."
    },
    tasks: [
      { title: "Review offer and pricing", status: "todo" },
      { title: "Publish first three social posts", status: "todo" },
      { title: "Test website chat greeting", status: "todo" },
      { title: "Call or text five warm leads", status: "todo" }
    ],
    landingPage: {
      headline: `${detail.businessName} helps local customers get reliable service without confusion.`,
      subheadline: "Clear communication, easy quotes, and professional follow-up from the first message.",
      offer: "Request a quote today",
      phone: "Add phone number",
      email: "Add email",
      proof: "Trusted local service with a simple process and responsive follow-up."
    },
    assistantStudio: {
      name: `${detail.businessName} AI Concierge`,
      purpose: "Help customers, capture leads, support phone and website inquiries, draft social posts, and keep the owner organized.",
      personality: "Friendly, clear, professional, patient, and locally trusted.",
      channels: [
        { name: "Website Chat", enabled: true, job: "Answer questions and collect lead details." },
        { name: "Phone", enabled: true, job: "Capture caller needs and route urgent issues." },
        { name: "SMS Follow-Up", enabled: true, job: "Send missed-call replies and quote follow-ups." },
        { name: "Social Media", enabled: true, job: "Draft captions, replies, and weekly content." },
        { name: "Email", enabled: false, job: "Draft longer customer replies and partner outreach." }
      ],
      knowledge: [
        "Business name, location, services, and primary offer.",
        "Lead intake questions: name, contact, service need, location, timing.",
        "Escalation rules for complaints, urgent needs, refunds, safety, and custom pricing.",
        "Brand promise: reliable service, clear communication, and easy next steps."
      ],
      workflows: [
        { name: "New Lead", trigger: "Customer asks for help", steps: "Greet, collect details, confirm need, send owner summary.", status: "ready" },
        { name: "Missed Call", trigger: "Call is missed", steps: "Send text, ask for need/location/timing, notify owner.", status: "ready" },
        { name: "Quote Follow-Up", trigger: "Quote sent but no reply", steps: "Follow up after 24 hours, then 72 hours.", status: "draft" },
        { name: "Review Request", trigger: "Service completed", steps: "Thank customer and ask for a review.", status: "draft" }
      ],
      testMessage: "Hi, I need a quote and want to know how soon someone can help me.",
      deployment: [
        { item: "Website chat script reviewed", done: false },
        { item: "Phone script approved", done: false },
        { item: "Lead handoff destination selected", done: false },
        { item: "Escalation rules approved", done: false },
        { item: "Owner tested three customer scenarios", done: false }
      ]
    }
  };
}

function normalizeWorkspace(slug, workspace) {
  const starter = defaultClientWorkspace(slug);
  return {
    ...starter,
    ...workspace,
    leads: workspace.leads || starter.leads,
    socialPosts: workspace.socialPosts || starter.socialPosts,
    assistantScripts: { ...starter.assistantScripts, ...(workspace.assistantScripts || {}) },
    tasks: workspace.tasks || starter.tasks,
    landingPage: { ...starter.landingPage, ...(workspace.landingPage || {}) },
    assistantStudio: {
      ...starter.assistantStudio,
      ...(workspace.assistantStudio || {}),
      channels: workspace.assistantStudio?.channels || starter.assistantStudio.channels,
      knowledge: workspace.assistantStudio?.knowledge || starter.assistantStudio.knowledge,
      workflows: workspace.assistantStudio?.workflows || starter.assistantStudio.workflows,
      deployment: workspace.assistantStudio?.deployment || starter.assistantStudio.deployment
    }
  };
}

function getClientWorkspace(slug) {
  const file = workspacePath(slug);
  if (!fs.existsSync(file)) {
    const starter = defaultClientWorkspace(slug);
    fs.writeFileSync(file, JSON.stringify(starter, null, 2), "utf8");
    return starter;
  }
  const workspace = JSON.parse(fs.readFileSync(file, "utf8"));
  const normalized = normalizeWorkspace(slug, workspace);
  if (JSON.stringify(workspace) !== JSON.stringify(normalized)) {
    fs.writeFileSync(file, JSON.stringify(normalized, null, 2), "utf8");
  }
  return normalized;
}

function saveClientWorkspace(body) {
  const slug = safeSlug(body.slug);
  const current = getClientWorkspace(slug);
  const incoming = body.workspace || {};
  const workspace = {
    ...current,
    ...incoming,
    assistantScripts: { ...current.assistantScripts, ...(incoming.assistantScripts || {}) },
    landingPage: { ...current.landingPage, ...(incoming.landingPage || {}) },
    assistantStudio: {
      ...current.assistantStudio,
      ...(incoming.assistantStudio || {}),
      channels: incoming.assistantStudio?.channels || current.assistantStudio.channels,
      knowledge: incoming.assistantStudio?.knowledge || current.assistantStudio.knowledge,
      workflows: incoming.assistantStudio?.workflows || current.assistantStudio.workflows,
      deployment: incoming.assistantStudio?.deployment || current.assistantStudio.deployment
    },
    slug,
    updatedAt: new Date().toISOString()
  };
  fs.writeFileSync(workspacePath(slug), JSON.stringify(workspace, null, 2), "utf8");
  return { workspace, client: clientInfo(slug) };
}

function landingPageHtml(workspace) {
  const businessName = htmlEscape(workspace.businessName);
  const landing = workspace.landingPage || {};
  const posts = workspace.socialPosts || [];
  const tasks = workspace.tasks || [];
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${businessName}</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header>
    <nav><strong>${businessName}</strong><a href="#contact">Request help</a></nav>
    <section class="hero">
      <p class="eyebrow">Local business</p>
      <h1>${htmlEscape(landing.headline)}</h1>
      <p>${htmlEscape(landing.subheadline)}</p>
      <a class="button" href="#contact">${htmlEscape(landing.offer || "Request a quote")}</a>
    </section>
  </header>
  <main>
    <section class="proof">
      <p class="eyebrow">Why choose us</p>
      <h2>${htmlEscape(landing.proof)}</h2>
    </section>
    <section class="grid">
      ${posts.slice(0, 3).map(post => `<article><span>${htmlEscape(post.platform)}</span><p>${htmlEscape(post.caption)}</p></article>`).join("")}
    </section>
    <section class="grid">
      ${tasks.slice(0, 3).map(task => `<article><span>${htmlEscape(task.status)}</span><h3>${htmlEscape(task.title)}</h3><p>Part of the customer experience workflow.</p></article>`).join("")}
    </section>
    <section id="contact" class="contact">
      <p class="eyebrow">Contact</p>
      <h2>${htmlEscape(landing.offer || "Request a quote today")}</h2>
      <p>Phone: ${htmlEscape(landing.phone)}</p>
      <p>Email: ${htmlEscape(landing.email)}</p>
      <form>
        <input placeholder="Name">
        <input placeholder="Phone or email">
        <textarea placeholder="What do you need help with?"></textarea>
        <button type="button">Send request</button>
      </form>
    </section>
  </main>
</body>
</html>`;
}

function landingPageCss() {
  return `:root{--ink:#14231f;--muted:#62736d;--line:#dce6e0;--green:#17845f;--bg:#f7f8f2}*{box-sizing:border-box}body{margin:0;font-family:Segoe UI,Arial,sans-serif;color:var(--ink);background:var(--bg);line-height:1.5}nav{display:flex;justify-content:space-between;align-items:center;padding:20px 6vw;background:white;border-bottom:1px solid var(--line)}nav a,.button,button{background:var(--green);color:white;text-decoration:none;border:0;border-radius:8px;padding:12px 16px;font-weight:800}.hero{padding:82px 6vw;max-width:1040px}.eyebrow,article span{color:var(--green);font-weight:900;text-transform:uppercase;font-size:.78rem}h1{font-size:clamp(2.4rem,6vw,5.5rem);line-height:.97;margin:10px 0 18px}h2{font-size:clamp(1.8rem,4vw,3.1rem);line-height:1.08;margin:8px 0 16px}.hero p{font-size:1.18rem;max-width:780px;color:var(--muted)}main section{padding:56px 6vw;border-top:1px solid var(--line)}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}article{background:white;border:1px solid var(--line);border-radius:8px;padding:20px}.contact{background:white}form{display:grid;gap:12px;max-width:620px}input,textarea{padding:14px;border:1px solid var(--line);border-radius:8px;font:inherit}@media(max-width:820px){nav{align-items:flex-start;flex-direction:column;gap:12px}.grid{grid-template-columns:1fr}}`;
}

function createLandingPage(body) {
  const slug = safeSlug(body.slug);
  const saved = saveClientWorkspace(body).workspace;
  const dir = path.join(clientPath(slug), "landing-page");
  ensureDir(dir);
  fs.writeFileSync(path.join(dir, "index.html"), landingPageHtml(saved), "utf8");
  fs.writeFileSync(path.join(dir, "styles.css"), landingPageCss(), "utf8");
  return {
    workspace: saved,
    client: clientInfo(slug),
    landingUrl: `/clients/${slug}/landing-page/index.html`
  };
}

function assistantStudioPrompt(workspace) {
  const studio = workspace.assistantStudio;
  return `# ${studio.name} System Package

## Purpose

${studio.purpose}

## Personality

${studio.personality}

## Active Channels

${studio.channels.map(channel => `- ${channel.enabled ? "[ON]" : "[OFF]"} ${channel.name}: ${channel.job}`).join("\n")}

## Knowledge Base

${studio.knowledge.map(item => `- ${item}`).join("\n")}

## Core Workflows

${studio.workflows.map(flow => `### ${flow.name}

Trigger: ${flow.trigger}

Steps: ${flow.steps}

Status: ${flow.status}`).join("\n\n")}

## Escalation Standard

Escalate refunds, complaints, urgent timing, safety issues, custom pricing, legal/medical questions, bulk orders, and anything outside approved service information to the owner.

## Lead Capture Standard

Always collect the customer's name, contact, service need, location, timing, and preferred follow-up method before handing off to the owner.
`;
}

function testAssistantReply(workspace, message) {
  const studio = workspace.assistantStudio;
  const incoming = String(message || studio.testMessage || "").trim();
  const lower = incoming.toLowerCase();
  const wantsQuote = /quote|price|cost|estimate/.test(lower);
  const urgent = /today|now|urgent|asap|soon|emergency/.test(lower);
  const serviceLine = wantsQuote
    ? "I can help collect the details needed for a quote."
    : "I can help answer questions and get the right details to the owner.";
  const urgencyLine = urgent
    ? "Because timing sounds important, I will flag this for quick owner follow-up."
    : "Once I have the basics, I can send this to the owner for follow-up.";
  return `Hi, thanks for contacting ${workspace.businessName}. ${serviceLine}

To help you, may I get your name, best phone or email, service need, location, and when you need help?

${urgencyLine}

Owner handoff summary will include: customer name, contact, service requested, location, timing, urgency, and recommended next action.`;
}

function packageAssistantStudio(body) {
  const slug = safeSlug(body.slug);
  const saved = saveClientWorkspace(body).workspace;
  const dir = path.join(clientPath(slug), "assistant-studio");
  ensureDir(dir);
  const prompt = assistantStudioPrompt(saved);
  const reply = testAssistantReply(saved, saved.assistantStudio.testMessage);
  fs.writeFileSync(path.join(dir, "assistant-system-package.md"), prompt, "utf8");
  fs.writeFileSync(path.join(dir, "assistant-test-response.md"), reply, "utf8");
  fs.writeFileSync(path.join(dir, "assistant-config.json"), JSON.stringify(saved.assistantStudio, null, 2), "utf8");
  return {
    workspace: saved,
    client: clientInfo(slug),
    files: [
      path.join(dir, "assistant-system-package.md"),
      path.join(dir, "assistant-test-response.md"),
      path.join(dir, "assistant-config.json")
    ],
    prompt,
    reply
  };
}

function intakeSummary(body, result) {
  return `# New NexusOS Service Intake

Client: ${result.kit.info.businessName}

Name: ${body.name || "Not provided"}
Email: ${body.email || "Not provided"}
Phone: ${body.phone || "Not provided"}

Business type: ${body.industry || result.kit.info.industry}
Location: ${body.location || result.kit.info.location}

## Requested Help

${body.needs || body.request || "Build a small-business AI services kit."}

## Automated Assets Created

- Client workspace
- Business launch kit
- Website prototype
- Landing page
- AI Assistant Studio package
- Phone assistant workflow
- Social media starter calendar
- Outreach scripts

## Links

- Workspace slug: ${result.kit.info.slug}
- Website: ${result.websiteUrl}
- Landing page: ${result.landingUrl}

## Next Admin Action

Open the client workspace in NexusOS, review the generated assets, customize the offer, and schedule a kickoff conversation.
`;
}

function automatePublicIntake(body) {
  const request = [
    body.businessName ? `business named ${body.businessName}` : "new small business",
    body.industry ? `in ${body.industry}` : "",
    body.location ? `in ${body.location}` : "",
    body.needs ? `Needs ${body.needs}` : "Needs website, AI assistant, social media, phone assistant, lead follow-up, and landing page."
  ].filter(Boolean).join(" ");
  const kit = buildBusinessKit({
    businessName: body.businessName,
    industry: body.industry,
    location: body.location,
    customer: body.audience || "local customers",
    problem: body.problem || "customers need clear information, fast follow-up, and an easy way to request help",
    request,
    objective: "Create an automated NexusOS client service package",
    audience: body.name || body.email || "new client"
  });
  const workspace = getClientWorkspace(kit.info.slug);
  workspace.leads.unshift({
    name: body.name || "New intake lead",
    contact: [body.email, body.phone].filter(Boolean).join(" / ") || "No contact provided",
    need: body.needs || "Needs business support",
    stage: "new",
    nextAction: "Review intake and schedule kickoff"
  });
  workspace.landingPage.headline = body.headline || `${kit.info.businessName} helps customers get reliable help fast.`;
  workspace.landingPage.subheadline = body.subheadline || "A simple way to request service, ask questions, and get professional follow-up.";
  workspace.landingPage.phone = body.phone || workspace.landingPage.phone;
  workspace.landingPage.email = body.email || workspace.landingPage.email;
  workspace.assistantStudio.name = `${kit.info.businessName} AI Assistant`;
  workspace.assistantStudio.testMessage = body.needs || workspace.assistantStudio.testMessage;
  const landing = createLandingPage({ slug: kit.info.slug, workspace });
  const assistant = packageAssistantStudio({ slug: kit.info.slug, workspace: landing.workspace });
  const workflow = runClientWorkflow({ slug: kit.info.slug, action: "intake-kickoff" });
  const result = {
    kit,
    websiteUrl: kit.websiteUrl,
    landingUrl: landing.landingUrl,
    assistantFiles: assistant.files,
    workflowFile: workflow.file
  };
  ensureDir(OUTPUTS);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const intakeFile = path.join(OUTPUTS, `${stamp}-nexusos-service-intake-${kit.info.slug}.md`);
  fs.writeFileSync(intakeFile, intakeSummary(body, result), "utf8");
  return {
    client: clientInfo(kit.info.slug),
    workspace: getClientWorkspace(kit.info.slug),
    intakeFile,
    ...result
  };
}

function createSubscriberWorkspace(body) {
  const plan = subscriptionPlans[body.plan] || subscriptionPlans.starter;
  const intake = automatePublicIntake({
    name: body.name,
    email: body.email,
    phone: body.phone,
    businessName: body.businessName,
    industry: body.industry,
    location: body.location,
    needs: body.needs || `${plan.name} subscription setup: ${plan.promise}`
  });
  const list = subscribers();
  const existingIndex = list.findIndex(item => item.email?.toLowerCase() === String(body.email || "").toLowerCase());
  const temporaryPassword = existingIndex >= 0 && list[existingIndex].temporaryPassword
    ? list[existingIndex].temporaryPassword
    : `nexus-${crypto.randomBytes(3).toString("hex")}`;
  const subscriber = {
    id: existingIndex >= 0 ? list[existingIndex].id : crypto.randomUUID(),
    portalToken: existingIndex >= 0 ? list[existingIndex].portalToken : crypto.randomBytes(24).toString("hex"),
    name: body.name || "Subscriber",
    email: String(body.email || "").trim().toLowerCase(),
    phone: body.phone || "",
    businessName: intake.client.businessName,
    plan: plan.id,
    status: process.env.STRIPE_SECRET_KEY ? "checkout-pending" : "demo-active",
    passwordHash: existingIndex >= 0 && list[existingIndex].passwordHash ? list[existingIndex].passwordHash : hashPassword(temporaryPassword),
    temporaryPassword,
    clientSlug: intake.client.slug,
    createdAt: existingIndex >= 0 ? list[existingIndex].createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  if (existingIndex >= 0) list[existingIndex] = subscriber;
  else list.push(subscriber);
  saveSubscribers(list);
  return { subscriber, intake, plan };
}

async function createCheckout(body, origin) {
  requireIntegration("stripe");
  const plan = subscriptionPlans[body.plan] || subscriptionPlans.starter;
  if (!body.email) throw new Error("Email is required for subscription setup");
  const created = createSubscriberWorkspace(body);
  const portalUrl = `/subscriber.html?token=${created.subscriber.portalToken}`;
  if (!process.env.STRIPE_SECRET_KEY) {
    return {
      mode: "simulated",
      plan,
      subscriber: publicSubscriber(created.subscriber),
      checkoutUrl: portalUrl,
      portalUrl,
      message: "Demo subscription created. Add STRIPE_SECRET_KEY to enable live checkout."
    };
  }
  const successUrl = `${origin}/subscriber.html?token=${created.subscriber.portalToken}&checkout=success`;
  const cancelUrl = `${origin}/pricing.html?checkout=cancelled`;
  const session = await httpsForm("https://api.stripe.com/v1/checkout/sessions", `${process.env.STRIPE_SECRET_KEY}:`, {
    mode: "subscription",
    success_url: successUrl,
    cancel_url: cancelUrl,
    customer_email: created.subscriber.email,
    client_reference_id: created.subscriber.id,
    "metadata[subscriberId]": created.subscriber.id,
    "metadata[clientSlug]": created.subscriber.clientSlug,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][recurring][interval]": plan.interval,
    "line_items[0][price_data][product_data][name]": `NexusOS ${plan.name}`,
    "line_items[0][price_data][unit_amount]": String(plan.price * 100)
  });
  const list = subscribers();
  const index = list.findIndex(item => item.id === created.subscriber.id);
  if (index >= 0) {
    list[index] = {
      ...list[index],
      stripeCheckoutSessionId: session.id,
      stripeCheckoutUrl: session.url,
      updatedAt: new Date().toISOString()
    };
    saveSubscribers(list);
  }
  return {
    mode: "stripe-checkout",
    plan,
    subscriber: publicSubscriber(index >= 0 ? list[index] : created.subscriber),
    checkoutUrl: session.url,
    portalUrl,
    sessionId: session.id,
    message: "Stripe Checkout session created."
  };
}

function subscriberByToken(token) {
  return subscribers().find(item => item.portalToken === token);
}

function subscriberPortalPayload(subscriber) {
  const client = clientInfo(subscriber.clientSlug);
  return {
    subscriber: publicSubscriber(subscriber),
    plan: subscriptionPlans[subscriber.plan],
    client,
    workspace: getClientWorkspace(subscriber.clientSlug),
    websiteUrl: client.websiteUrl,
    landingUrl: `/clients/${subscriber.clientSlug}/landing-page/index.html`
  };
}

function logEmail(message) {
  const list = readJson(EMAIL_LOG_FILE, []);
  list.unshift({ ...message, createdAt: new Date().toISOString() });
  writeJson(EMAIL_LOG_FILE, list.slice(0, 200));
}

async function sendEmail({ to, subject, text }) {
  const configured = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;
  if (!configured) {
    logEmail({ mode: "logged", to, subject, text });
    return { mode: "logged", status: "SMTP not configured; email saved to email log" };
  }
  // SMTP network delivery is intentionally adapter-ready here. Hosted production
  // should connect a provider SDK/API such as SendGrid, Resend, Mailgun, or SMTP relay.
  logEmail({ mode: "smtp-ready", to, subject, text });
  return { mode: "smtp-ready", status: "SMTP credentials configured; provider adapter pending" };
}

function createPasswordReset(email) {
  const list = subscribers();
  const index = list.findIndex(item => item.email?.toLowerCase() === String(email || "").trim().toLowerCase());
  if (index === -1) return null;
  const token = crypto.randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 30).toISOString();
  list[index] = { ...list[index], resetToken: token, resetExpiresAt: expiresAt, updatedAt: new Date().toISOString() };
  saveSubscribers(list);
  return { subscriber: list[index], token, expiresAt };
}

function resetSubscriberPassword(token, password) {
  const list = subscribers();
  const index = list.findIndex(item => item.resetToken === token);
  if (index === -1) return null;
  if (new Date(list[index].resetExpiresAt || 0) < new Date()) throw new Error("Reset token expired");
  list[index] = {
    ...list[index],
    passwordHash: hashPassword(password),
    temporaryPassword: null,
    resetToken: null,
    resetExpiresAt: null,
    updatedAt: new Date().toISOString()
  };
  saveSubscribers(list);
  return list[index];
}

function markSubscriberActiveById(id, metadata = {}) {
  const list = subscribers();
  const index = list.findIndex(item => item.id === id);
  if (index === -1) return null;
  list[index] = {
    ...list[index],
    status: "active",
    stripeCustomerId: metadata.customer || list[index].stripeCustomerId,
    stripeSubscriptionId: metadata.subscription || list[index].stripeSubscriptionId,
    updatedAt: new Date().toISOString()
  };
  saveSubscribers(list);
  return list[index];
}

function handleStripeWebhook(body) {
  const event = typeof body === "string" ? JSON.parse(body || "{}") : body;
  const object = event.data?.object || {};
  if (event.type === "checkout.session.completed") {
    const subscriberId = object.metadata?.subscriberId || object.client_reference_id;
    const subscriber = markSubscriberActiveById(subscriberId, {
      customer: object.customer,
      subscription: object.subscription
    });
    return { received: true, updated: Boolean(subscriber), event: event.type };
  }
  return { received: true, updated: false, event: event.type || "unknown" };
}

function verifyStripeSignature(rawBody, signatureHeader) {
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    if (REQUIRE_LIVE_SERVICES) throw new Error("STRIPE_WEBHOOK_SECRET is required for strict live-service mode");
    return { verified: false, reason: "webhook secret not configured" };
  }
  const parts = Object.fromEntries(String(signatureHeader || "")
    .split(",")
    .map(part => part.split("="))
    .filter(pair => pair.length === 2)
    .map(([key, value]) => [key, value]));
  if (!parts.t || !parts.v1) throw new Error("Missing Stripe signature timestamp or v1 signature");
  const payload = `${parts.t}.${rawBody}`;
  const expected = crypto
    .createHmac("sha256", process.env.STRIPE_WEBHOOK_SECRET)
    .update(payload)
    .digest("hex");
  const actual = Buffer.from(parts.v1, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  if (actual.length !== expectedBuffer.length || !crypto.timingSafeEqual(actual, expectedBuffer)) {
    throw new Error("Invalid Stripe webhook signature");
  }
  return { verified: true };
}

function agenticPlan(body) {
  const request = String(body.request || body.needs || "").toLowerCase();
  const wantsFullBuild = /all|full|complete|everything|business|launch|website|assistant|social|phone|lead/.test(request);
  const steps = [
    { agent: "intake", action: "Structure the client request and identify business context." },
    { agent: "businessBuilder", action: "Create the business launch kit and client workspace." }
  ];
  if (wantsFullBuild || /landing|website|page/.test(request)) {
    steps.push({ agent: "landingPage", action: "Create a small-business landing page." });
  }
  if (wantsFullBuild || /assistant|ai|chat|bot/.test(request)) {
    steps.push({ agent: "assistantStudio", action: "Build, test, and package the AI assistant." });
  }
  if (wantsFullBuild || /social|marketing|post|content/.test(request)) {
    steps.push({ agent: "marketing", action: "Prepare social and outreach assets." });
  }
  if (wantsFullBuild || /lead|crm|follow/.test(request)) {
    steps.push({ agent: "crm", action: "Create lead pipeline and follow-up tasks." });
  }
  if (wantsFullBuild || /phone|sms|text|call/.test(request)) {
    steps.push({ agent: "phone", action: "Prepare phone assistant and SMS workflow." });
  }
  steps.push({ agent: "qa", action: "Verify generated assets and summarize next steps." });
  return steps;
}

function safeAgenticPlan(value, fallback) {
  if (!Array.isArray(value)) return fallback;
  const cleaned = value
    .filter(step => step && agenticAgents[step.agent] && step.action)
    .map(step => ({ agent: step.agent, action: String(step.action).slice(0, 240) }));
  const hasBusinessBuilder = cleaned.some(step => step.agent === "businessBuilder");
  const hasQa = cleaned.some(step => step.agent === "qa");
  if (!hasBusinessBuilder) cleaned.unshift({ agent: "businessBuilder", action: "Create the launch kit and client workspace." });
  if (!hasQa) cleaned.push({ agent: "qa", action: "Verify generated assets and summarize next steps." });
  return cleaned.length ? cleaned : fallback;
}

async function llmAgenticPlan(body, fallback) {
  if (!process.env.OPENAI_API_KEY) {
    return { planningMode: "deterministic", model: null, plan: fallback, plannerNote: "OPENAI_API_KEY is not configured." };
  }
  try {
    const result = await httpsJson("https://api.openai.com/v1/chat/completions", {
      headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: {
        model: process.env.OPENAI_PLANNER_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are the NexusOS live LLM planner. Return strict JSON only. Choose a workflow plan using these agent keys: ${Object.keys(agenticAgents).join(", ")}. Each step must have "agent" and "action". Include businessBuilder and qa. Keep actions concrete.`
          },
          {
            role: "user",
            content: JSON.stringify({
              request: body.request || body.needs || "",
              businessName: body.businessName || "",
              industry: body.industry || "",
              location: body.location || "",
              audience: body.audience || body.name || "",
              availableAgents: agenticAgents
            })
          }
        ],
        temperature: 0.1,
        response_format: { type: "json_object" }
      }
    });
    const content = result.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);
    const plan = safeAgenticPlan(parsed.plan || parsed.steps || [], fallback);
    return {
      planningMode: "live-llm",
      model: result.model || process.env.OPENAI_PLANNER_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini",
      plan,
      plannerNote: parsed.note || "Live LLM planner produced the agent plan."
    };
  } catch (error) {
    return {
      planningMode: "deterministic-fallback",
      model: process.env.OPENAI_PLANNER_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini",
      plan: fallback,
      plannerNote: `Live planner fallback: ${error.message}`
    };
  }
}

async function runAgenticWorkflow(body) {
  const startedAt = new Date().toISOString();
  const fallbackPlan = agenticPlan(body);
  const planning = await llmAgenticPlan(body, fallbackPlan);
  const plan = planning.plan;
  const kit = buildBusinessKit({
    businessName: body.businessName,
    industry: body.industry,
    location: body.location,
    customer: body.audience || body.name || "local customers",
    problem: body.problem || "customers need clear information, fast follow-up, and reliable service",
    request: body.request || body.needs || "Build a full NexusOS client workspace.",
    objective: body.objective || "Create an agentic small-business service package.",
    audience: body.audience || body.name || "small business owner"
  });
  let workspace = getClientWorkspace(kit.info.slug);
  workspace.tasks.unshift(
    { title: "Review agentic build summary", status: "todo" },
    { title: "Schedule kickoff call", status: "todo" },
    { title: "Customize offer and pricing", status: "todo" }
  );
  workspace.assistantStudio.purpose = `Act as an agentic customer and operations assistant for ${kit.info.businessName}: capture leads, answer questions, support follow-up, and prepare owner handoffs.`;
  const landing = createLandingPage({ slug: kit.info.slug, workspace });
  const assistant = packageAssistantStudio({ slug: kit.info.slug, workspace: landing.workspace });
  const workflows = ["leads", "social", "phone", "followup"].map(action => runClientWorkflow({ slug: kit.info.slug, action }));
  const client = clientInfo(kit.info.slug);
  const qa = {
    clientWorkspace: Boolean(client.slug),
    websitePrototype: client.files.some(file => file.name === "website/index.html"),
    landingPage: client.files.some(file => file.name === "landing-page/index.html"),
    assistantPackage: client.files.some(file => file.name === "assistant-studio/assistant-system-package.md"),
    workflows: workflows.length
  };
  const summary = `# NexusOS Agentic Run

Started: ${startedAt}
Completed: ${new Date().toISOString()}

Planning mode: ${planning.planningMode}
Planner model: ${planning.model || "none"}
Planner note: ${planning.plannerNote}

## Client

${kit.info.businessName}

## Agent Plan

${plan.map((step, index) => `${index + 1}. ${agenticAgents[step.agent].name}: ${step.action}`).join("\n")}

## Artifacts

- Client workspace: ${client.slug}
- Website prototype: ${kit.websiteUrl}
- Landing page: ${landing.landingUrl}
- Assistant package files: ${assistant.files.length}
- Workflow files: ${workflows.length}

## QA

${Object.entries(qa).map(([key, value]) => `- ${key}: ${value}`).join("\n")}

## Next Best Move

Open the client workspace, review the landing page and assistant package, then schedule a kickoff conversation with the client.
`;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.join(OUTPUTS, `${stamp}-agentic-run-${kit.info.slug}.md`);
  ensureDir(OUTPUTS);
  fs.writeFileSync(file, summary, "utf8");
  return {
    mode: "agentic",
    planningMode: planning.planningMode,
    plannerModel: planning.model,
    plannerNote: planning.plannerNote,
    agents: agenticAgents,
    plan,
    client,
    websiteUrl: kit.websiteUrl,
    landingUrl: landing.landingUrl,
    assistantFiles: assistant.files,
    workflowFiles: workflows.map(workflow => workflow.file),
    qa,
    summary,
    file
  };
}

function httpsJson(url, options) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const body = options.body ? JSON.stringify(options.body) : "";
    const req = https.request(parsed, {
      method: options.method || "POST",
      headers: {
        "content-type": "application/json",
        "content-length": Buffer.byteLength(body),
        ...(options.headers || {})
      }
    }, res => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        const jsonBody = data ? JSON.parse(data) : {};
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(jsonBody.error?.message || `Provider request failed: ${res.statusCode}`));
          return;
        }
        resolve(jsonBody);
      });
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

function httpsForm(url, auth, fields) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const body = new URLSearchParams(fields).toString();
    const req = https.request(parsed, {
      method: "POST",
      headers: {
        "authorization": `Basic ${Buffer.from(auth).toString("base64")}`,
        "content-type": "application/x-www-form-urlencoded",
        "content-length": Buffer.byteLength(body)
      }
    }, res => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        const jsonBody = data ? JSON.parse(data) : {};
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(jsonBody.message || `SMS provider failed: ${res.statusCode}`));
          return;
        }
        resolve(jsonBody);
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function liveAssistantReply(workspace, message) {
  requireIntegration("openai");
  if (!process.env.OPENAI_API_KEY) {
    return { mode: "simulated", reply: testAssistantReply(workspace, message) };
  }
  const system = assistantStudioPrompt(workspace);
  const result = await httpsJson("https://api.openai.com/v1/chat/completions", {
    headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: {
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: String(message || workspace.assistantStudio.testMessage || "") }
      ],
      temperature: 0.3
    }
  });
  return { mode: "live-ai", reply: result.choices?.[0]?.message?.content || "No response returned." };
}

async function sendSms(body) {
  requireIntegration("twilio");
  const to = String(body.to || "").trim();
  const message = String(body.message || "").trim();
  if (!to || !message) throw new Error("Phone number and message are required");
  const configured = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER;
  if (!configured) {
    return { mode: "simulated", to, message, status: "not sent; Twilio credentials are not configured" };
  }
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const result = await httpsForm(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, `${sid}:${process.env.TWILIO_AUTH_TOKEN}`, {
    To: to,
    From: process.env.TWILIO_PHONE_NUMBER,
    Body: message
  });
  return { mode: "live-sms", to, message, status: result.status, providerId: result.sid };
}

function memorySummary() {
  const memory = readText(path.join(WORKSPACE, "09_Memory", "COACHOS_MEMORY.md"));
  const current = readText(path.join(WORKSPACE, "README.md"));
  return { memory, current };
}

function readiness() {
  ensureDir(OUTPUTS);
  ensureDir(BUSINESS_CLIENTS);
  const checks = [
    { name: "workspace", ok: fs.existsSync(WORKSPACE), detail: WORKSPACE },
    { name: "auth", ok: ensureUsers().length > 0, detail: AUTH_REQUIRED ? "required" : "disabled for local development" },
    { name: "dataDir", ok: fs.existsSync(DATA_DIR), detail: DATA_DIR },
    { name: "outputs", ok: fs.existsSync(OUTPUTS), detail: OUTPUTS },
    { name: "clients", ok: fs.existsSync(BUSINESS_CLIENTS), detail: BUSINESS_CLIENTS },
    { name: "public", ok: fs.existsSync(PUBLIC), detail: PUBLIC },
    { name: "database", ok: integrationStatus().database.connected, detail: integrationStatus().database.mode },
    { name: "aiProvider", ok: integrationStatus().openai.connected, detail: integrationStatus().openai.mode },
    { name: "phoneProvider", ok: integrationStatus().twilio.connected, detail: integrationStatus().twilio.mode },
    { name: "billingProvider", ok: integrationStatus().stripe.connected, detail: integrationStatus().stripe.mode }
  ];
  const coreNames = ["workspace", "auth", "dataDir", "outputs", "clients", "public"];
  const integrationNames = ["database", "aiProvider", "phoneProvider", "billingProvider"];
  const coreReady = checks.filter(check => coreNames.includes(check.name)).every(check => check.ok);
  const liveIntegrationsReady = checks.filter(check => integrationNames.includes(check.name)).every(check => check.ok);
  return {
    app: APP_NAME,
    version: APP_VERSION,
    ok: coreReady,
    productionReady: coreReady,
    coreReady,
    liveIntegrationsReady,
    integrationMode: liveIntegrationsReady ? "live" : "hybrid",
    integrations: integrationStatus(),
    mode: process.env.NODE_ENV || "development",
    note: liveIntegrationsReady
      ? "Core SaaS and live integrations are configured."
      : "Core SaaS is production-ready. Missing external credentials run in safe fallback mode until configured.",
    checks
  };
}

function createResponse({ agent = "coach", request = "", objective = "", audience = "", urgency = "normal" }) {
  const profile = agentProfiles[agent] || agentProfiles.coach;
  const { memory } = memorySummary();
  const cleanedRequest = String(request || "").trim();
  const cleanedObjective = String(objective || "").trim();
  const cleanedAudience = String(audience || "").trim();
  const now = new Date().toLocaleString();

  const contextLine = cleanedObjective
    ? `Objective: ${cleanedObjective}`
    : "Objective: clarify the request and produce the next useful business move.";
  const audienceLine = cleanedAudience
    ? `Audience: ${cleanedAudience}`
    : "Audience: coach, partners, investors, or internal execution depending on use.";

  const sectionText = profile.sections.map((section, index) => {
    const seed = [
      `Use ${profile.name} for ${profile.promise}.`,
      contextLine,
      audienceLine,
      `Urgency: ${urgency}.`,
      cleanedRequest ? `Request: ${cleanedRequest}` : "Request: no detailed request was entered yet."
    ];

    const recommendations = {
      0: "Frame the situation in one clear sentence before expanding the work.",
      1: "Identify the strongest path forward and the reason it matters now.",
      2: "Name the risks, missing details, or friction points that could slow execution.",
      3: "Turn the idea into concrete work that can be done, reviewed, or sent.",
      4: "Capture what NexusOS should remember and what should happen next."
    };

    return `## ${section}\n\n${seed[index % seed.length]}\n\n${recommendations[index] || "Convert the request into a specific action with an owner and success state."}`;
  }).join("\n\n");

  return `# ${profile.name} Response\n\nCreated: ${now}\n\n${contextLine}\n\n${audienceLine}\n\nUrgency: ${urgency}\n\n## Request\n\n${cleanedRequest || "No request entered."}\n\n${sectionText}\n\n## Suggested Prompt To Use With A Live AI Model\n\n${profile.name}, help me with this request: ${cleanedRequest || "[enter request]"}. Use my NexusOS memory, AgriNexus context, and business goals. Give me a practical answer with next steps.\n\n## Memory Context Used\n\n${memory.split("\n").slice(0, 18).join("\n")}`;
}

function state() {
  ensureDir(OUTPUTS);
  ensureDir(BUSINESS_CLIENTS);
  const outputs = fs.readdirSync(OUTPUTS)
    .filter(file => file.endsWith(".md"))
    .map(file => {
      const fullPath = path.join(OUTPUTS, file);
      const stat = fs.statSync(fullPath);
      return { file, path: fullPath, size: stat.size, updatedAt: stat.mtime.toISOString() };
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 20);

  return {
    agents: Object.fromEntries(Object.entries(agentProfiles).map(([key, profile]) => [key, profile])),
    memory: memorySummary(),
    outputs,
    clients: fs.readdirSync(BUSINESS_CLIENTS, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => clientInfo(entry.name))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  };
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname.startsWith("/clients/")) {
    const target = url.pathname.replace("/clients/", "");
    const filePath = path.normalize(path.join(BUSINESS_CLIENTS, target));
    if (!filePath.startsWith(BUSINESS_CLIENTS)) return text(res, 403, "text/plain", "Forbidden");
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return text(res, 404, "text/plain", "Not found");
    const ext = path.extname(filePath).toLowerCase();
    const types = { ".html": "text/html", ".css": "text/css", ".js": "application/javascript", ".csv": "text/csv", ".md": "text/markdown" };
    return text(res, 200, types[ext] || "application/octet-stream", fs.readFileSync(filePath));
  }
  const target = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
  const filePath = path.normalize(path.join(PUBLIC, target));
  if (!filePath.startsWith(PUBLIC)) return text(res, 403, "text/plain", "Forbidden");
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return text(res, 404, "text/plain", "Not found");
  const ext = path.extname(filePath).toLowerCase();
  const types = { ".html": "text/html", ".css": "text/css", ".js": "application/javascript", ".json": "application/json" };
  text(res, 200, types[ext] || "application/octet-stream", fs.readFileSync(filePath));
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname === "/api/healthz") return json(res, 200, { ok: true, app: APP_NAME, version: APP_VERSION });
    if (url.pathname === "/api/readiness") return json(res, 200, readiness());
    if (url.pathname === "/api/integrations") return json(res, 200, integrationStatus());
    if (url.pathname === "/api/auth/me") return json(res, 200, { user: publicUser(currentUser(req)), authRequired: AUTH_REQUIRED });

    if (url.pathname === "/api/auth/login" && req.method === "POST") {
      const user = login(await readBody(req));
      if (!user) return json(res, 401, { error: "Invalid email or password" });
      setSession(res, user);
      return json(res, 200, { user: publicUser(user) });
    }

    if (url.pathname === "/api/auth/logout" && req.method === "POST") {
      clearSession(req, res);
      return json(res, 200, { ok: true });
    }

    if (url.pathname === "/api/public/intake" && req.method === "POST") {
      const body = await readBody(req);
      if (!body.name && !body.email && !body.phone) return json(res, 400, { error: "Please include a name, email, or phone number" });
      if (!body.businessName && !body.industry) return json(res, 400, { error: "Please include a business name or business type" });
      const result = automatePublicIntake(body);
      return json(res, 200, {
        ok: true,
        client: result.client,
        websiteUrl: result.websiteUrl,
        landingUrl: result.landingUrl,
        assistantFiles: result.assistantFiles,
        message: "Your NexusOS service workspace has been created."
      });
    }

    if (url.pathname === "/api/public/plans") {
      return json(res, 200, { plans: Object.values(subscriptionPlans) });
    }

    if (url.pathname === "/api/public/checkout" && req.method === "POST") {
      const body = await readBody(req);
      const result = await createCheckout(body, `http://${req.headers.host}`);
      return json(res, 200, result);
    }

    if (url.pathname === "/api/subscriber/login" && req.method === "POST") {
      const subscriber = loginSubscriber(await readBody(req));
      if (!subscriber) return json(res, 401, { error: "Invalid subscriber email or password" });
      setSubscriberSession(res, subscriber);
      return json(res, 200, subscriberPortalPayload(subscriber));
    }

    if (url.pathname === "/api/subscriber/logout" && req.method === "POST") {
      clearSubscriberSession(req, res);
      return json(res, 200, { ok: true });
    }

    if (url.pathname === "/api/subscriber/me" && req.method === "GET") {
      const subscriber = currentSubscriber(req);
      if (!subscriber) return json(res, 200, { subscriber: null });
      const fresh = subscriberByEmail(subscriber.email);
      return json(res, 200, fresh ? subscriberPortalPayload(fresh) : { subscriber: null });
    }

    if (url.pathname === "/api/subscriber/password-reset/request" && req.method === "POST") {
      const body = await readBody(req);
      const reset = createPasswordReset(body.email);
      if (reset) {
        const resetUrl = `http://${req.headers.host}/reset-password.html?token=${reset.token}`;
        await sendEmail({
          to: reset.subscriber.email,
          subject: "Reset your NexusOS subscriber password",
          text: `Use this link to reset your NexusOS password: ${resetUrl}`
        });
      }
      return json(res, 200, { ok: true, message: "If the email exists, reset instructions were created." });
    }

    if (url.pathname === "/api/subscriber/password-reset/confirm" && req.method === "POST") {
      const body = await readBody(req);
      if (!body.token || !body.password || String(body.password).length < 8) return json(res, 400, { error: "Token and password of at least 8 characters are required" });
      const subscriber = resetSubscriberPassword(body.token, body.password);
      if (!subscriber) return json(res, 400, { error: "Invalid reset token" });
      return json(res, 200, { ok: true, subscriber: publicSubscriber(subscriber) });
    }

    if (url.pathname === "/api/subscriber/portal" && req.method === "GET") {
      const subscriber = subscriberByToken(url.searchParams.get("token")) || currentSubscriber(req);
      if (!subscriber) return json(res, 404, { error: "Subscriber portal not found" });
      return json(res, 200, subscriberPortalPayload(subscriber));
    }

    if (url.pathname === "/api/stripe/webhook" && req.method === "POST") {
      const rawBody = await readRawBody(req);
      const signature = verifyStripeSignature(rawBody, req.headers["stripe-signature"]);
      const result = handleStripeWebhook(rawBody);
      return json(res, 200, { ...result, signature });
    }

    if (url.pathname.startsWith("/api/") && !currentUser(req)) {
      return json(res, 401, { error: "Login required" });
    }

    if (url.pathname === "/api/state") return json(res, 200, state());

    if (url.pathname === "/api/admin/subscribers" && req.method === "GET") {
      return json(res, 200, { subscribers: subscribers().map(publicSubscriber) });
    }

    if (url.pathname === "/api/admin/subscriber/status" && req.method === "POST") {
      const body = await readBody(req);
      const list = subscribers();
      const index = list.findIndex(item => item.id === body.id);
      if (index === -1) return json(res, 404, { error: "Subscriber not found" });
      list[index] = { ...list[index], status: body.status || list[index].status, updatedAt: new Date().toISOString() };
      saveSubscribers(list);
      return json(res, 200, { subscriber: publicSubscriber(list[index]), subscribers: subscribers().map(publicSubscriber) });
    }

    if (url.pathname === "/api/admin/email-log" && req.method === "GET") {
      return json(res, 200, { emails: readJson(EMAIL_LOG_FILE, []) });
    }

    if (url.pathname === "/api/generate" && req.method === "POST") {
      const body = await readBody(req);
      return json(res, 200, { output: createResponse(body) });
    }

    if (url.pathname === "/api/business/build" && req.method === "POST") {
      const body = await readBody(req);
      const kit = buildBusinessKit(body);
      return json(res, 200, { kit, state: state() });
    }

    if (url.pathname === "/api/agentic/run" && req.method === "POST") {
      const body = await readBody(req);
      const result = await runAgenticWorkflow(body);
      return json(res, 200, { ...result, state: state() });
    }

    if (url.pathname === "/api/client" && req.method === "GET") {
      const slug = url.searchParams.get("slug");
      if (!slug) return json(res, 400, { error: "Missing client slug" });
      return json(res, 200, { client: clientInfo(slug), workspace: getClientWorkspace(slug) });
    }

    if (url.pathname === "/api/client/workspace" && req.method === "POST") {
      const body = await readBody(req);
      if (!body.slug) return json(res, 400, { error: "Missing client slug" });
      return json(res, 200, saveClientWorkspace(body));
    }

    if (url.pathname === "/api/client/workflow" && req.method === "POST") {
      const body = await readBody(req);
      const result = runClientWorkflow(body);
      return json(res, 200, { ...result, state: state() });
    }

    if (url.pathname === "/api/client/landing-page" && req.method === "POST") {
      const body = await readBody(req);
      if (!body.slug) return json(res, 400, { error: "Missing client slug" });
      const result = createLandingPage(body);
      return json(res, 200, { ...result, state: state() });
    }

    if (url.pathname === "/api/client/assistant/package" && req.method === "POST") {
      const body = await readBody(req);
      if (!body.slug) return json(res, 400, { error: "Missing client slug" });
      const result = packageAssistantStudio(body);
      return json(res, 200, { ...result, state: state() });
    }

    if (url.pathname === "/api/client/assistant/test" && req.method === "POST") {
      const body = await readBody(req);
      if (!body.slug) return json(res, 400, { error: "Missing client slug" });
      const saved = saveClientWorkspace(body).workspace;
      const response = await liveAssistantReply(saved, body.message || saved.assistantStudio.testMessage);
      return json(res, 200, {
        workspace: saved,
        client: clientInfo(body.slug),
        ...response
      });
    }

    if (url.pathname === "/api/phone/send-sms" && req.method === "POST") {
      const body = await readBody(req);
      return json(res, 200, await sendSms(body));
    }

    if (url.pathname === "/api/save" && req.method === "POST") {
      const body = await readBody(req);
      const agent = agentProfiles[body.agent] || agentProfiles.coach;
      const output = String(body.output || "").trim();
      if (!output) return json(res, 400, { error: "Nothing to save" });
      ensureDir(OUTPUTS);
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const file = `${stamp}-${safeSlug(agent.name)}-${safeSlug(body.title || "output")}.md`;
      const fullPath = path.join(OUTPUTS, file);
      fs.writeFileSync(fullPath, output, "utf8");
      return json(res, 200, { file, path: fullPath, outputs: state().outputs });
    }

    serveStatic(req, res);
  } catch (error) {
    json(res, 500, { error: error.message });
  }
});

ensureDir(OUTPUTS);
ensureDir(BUSINESS_CLIENTS);
server.listen(PORT, HOST, () => {
  console.log(`${APP_NAME} Command App running on ${HOST}:${PORT}`);
});
