const http = require("http");

const base = process.env.NEXUSOS_URL || "http://127.0.0.1:4288";
let cookie = "";

function request(path, options = {}) {
  const url = new URL(path, base);
  const body = options.body ? JSON.stringify(options.body) : null;
  return new Promise((resolve, reject) => {
    const req = http.request(url, {
      method: options.method || "GET",
      headers: {
        "content-type": "application/json",
        ...(cookie ? { cookie } : {}),
        ...(body ? { "content-length": Buffer.byteLength(body) } : {})
      }
    }, res => {
      const setCookie = res.headers["set-cookie"];
      if (setCookie?.length) cookie = setCookie.map(item => item.split(";")[0]).join("; ");
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        const parsed = data ? JSON.parse(data) : {};
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`${path} failed: ${res.statusCode} ${parsed.error || data}`));
          return;
        }
        resolve(parsed);
      });
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const health = await request("/api/healthz");
  assert(health.ok && health.app === "NexusOS", "health check failed");

  const readiness = await request("/api/readiness");
  assert(readiness.ok, "readiness check failed");

  const intake = await request("/api/public/intake", {
    method: "POST",
    body: {
      name: "Family Test Client",
      email: "family@example.com",
      phone: "555-555-0111",
      businessName: "Family Catering Studio",
      industry: "Catering",
      location: "Charlotte",
      needs: "I need a landing page, AI assistant, phone follow-up, social media posts, and lead tracking."
    }
  });
  assert(intake.ok && intake.client?.slug, "public intake automation failed");
  assert(intake.landingUrl.includes("/landing-page/index.html"), "public intake landing page failed");

  const plans = await request("/api/public/plans");
  assert(plans.plans.length === 3, "subscription plans missing");

  const checkout = await request("/api/public/checkout", {
    method: "POST",
    body: {
      plan: "growth",
      name: "Subscription Test Client",
      email: "subscriber@example.com",
      phone: "555-555-0222",
      businessName: "Subscriber Cleaning Co",
      industry: "Cleaning",
      location: "Dallas",
      needs: "I need a subscriber workspace, landing page, AI assistant, and lead follow-up."
    }
  });
  assert(checkout.subscriber?.portalToken, "subscription checkout did not create portal token");
  assert(["simulated", "stripe-checkout"].includes(checkout.mode), "subscription checkout mode invalid");
  assert(checkout.subscriber.temporaryPassword, "subscriber temporary password missing");

  const portal = await request(`/api/subscriber/portal?token=${checkout.subscriber.portalToken}`);
  assert(portal.subscriber.email === "subscriber@example.com", "subscriber portal failed");
  assert(portal.landingUrl.includes("/landing-page/index.html"), "subscriber landing link missing");

  const subscriberLogin = await request("/api/subscriber/login", {
    method: "POST",
    body: {
      email: checkout.subscriber.email,
      password: checkout.subscriber.temporaryPassword
    }
  });
  assert(subscriberLogin.subscriber.email === checkout.subscriber.email, "subscriber login failed");

  const webhook = await request("/api/stripe/webhook", {
    method: "POST",
    body: {
      type: "checkout.session.completed",
      data: {
        object: {
          client_reference_id: checkout.subscriber.id,
          customer: "cus_test",
          subscription: "sub_test",
          metadata: { subscriberId: checkout.subscriber.id }
        }
      }
    }
  });
  assert(webhook.received, "stripe webhook failed");

  const auth = await request("/api/auth/login", {
    method: "POST",
    body: {
      email: process.env.NEXUSOS_ADMIN_EMAIL || "admin@nexusos.local",
      password: process.env.NEXUSOS_ADMIN_PASSWORD || "nexusos-admin"
    }
  });
  assert(auth.user?.email, "login failed");

  const built = await request("/api/business/build", {
    method: "POST",
    body: {
      request: "Client: mobile detailing business in Atlanta. Needs social media, AI assistant, phone assistant, lead follow-up, and a landing page.",
      objective: "Build production smoke test client",
      audience: "small business owner",
      urgency: "high"
    }
  });
  assert(built.kit.info.slug, "business kit did not return a slug");

  const agentic = await request("/api/agentic/run", {
    method: "POST",
    body: {
      businessName: "Agentic Family Services",
      industry: "Local Service Business",
      location: "Houston",
      request: "Build everything: landing page, AI assistant, phone workflow, social media, CRM leads, and QA summary.",
      audience: "family business owner"
    }
  });
  assert(agentic.mode === "agentic", "agentic run did not return agentic mode");
  assert(["deterministic", "live-llm", "deterministic-fallback"].includes(agentic.planningMode), "agentic planning mode missing");
  assert(agentic.plan.length >= 5, "agentic plan did not include enough specialist steps");
  assert(agentic.qa.landingPage && agentic.qa.assistantPackage, "agentic QA failed");

  const detail = await request(`/api/client?slug=${built.kit.info.slug}`);
  assert(detail.workspace.assistantStudio, "assistant studio missing from workspace");

  detail.workspace.leads[0].stage = "interested";
  detail.workspace.socialPosts[0].status = "ready";
  detail.workspace.landingPage.headline = "NexusOS smoke test landing page";

  const saved = await request("/api/client/workspace", {
    method: "POST",
    body: { slug: built.kit.info.slug, workspace: detail.workspace }
  });
  assert(saved.workspace.leads[0].stage === "interested", "workspace save failed");

  const landing = await request("/api/client/landing-page", {
    method: "POST",
    body: { slug: built.kit.info.slug, workspace: saved.workspace }
  });
  assert(landing.landingUrl.includes("/landing-page/index.html"), "landing page creation failed");

  const assistantTest = await request("/api/client/assistant/test", {
    method: "POST",
    body: {
      slug: built.kit.info.slug,
      workspace: saved.workspace,
      message: "I need a quote today."
    }
  });
  assert(assistantTest.reply.includes("quote"), "assistant test reply failed");

  const assistantPackage = await request("/api/client/assistant/package", {
    method: "POST",
    body: { slug: built.kit.info.slug, workspace: saved.workspace }
  });
  assert(assistantPackage.files.length === 3, "assistant package export failed");

  const sms = await request("/api/phone/send-sms", {
    method: "POST",
    body: { to: "+15555550123", message: "NexusOS smoke test message" }
  });
  assert(["simulated", "live-sms"].includes(sms.mode), "SMS endpoint failed");

  console.log("NexusOS smoke test passed");
  console.log(`Client: ${built.kit.info.businessName}`);
  console.log(`Landing: ${base}${landing.landingUrl}`);
  console.log(`Assistant files: ${assistantPackage.files.length}`);
  console.log(`SMS mode: ${sms.mode}`);
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
