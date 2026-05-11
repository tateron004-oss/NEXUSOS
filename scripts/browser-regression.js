const http = require("http");

const base = process.env.NEXUSOS_URL || "http://127.0.0.1:4288";

function get(path) {
  const url = new URL(path, base);
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`${path} returned ${res.statusCode}`));
          return;
        }
        resolve(data);
      });
    }).on("error", reject);
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const html = await get("/");
  assert(html.includes("NexusOS"), "home page missing NexusOS brand");
  assert(html.includes("loginForm"), "login form missing");
  assert(html.includes("Client Workspace Dashboard"), "client dashboard shell missing");

  const intake = await get("/intake.html");
  assert(intake.includes("NexusOS Service Intake"), "intake page missing");
  assert(intake.includes("intakeForm"), "intake form missing");

  const pricing = await get("/pricing.html");
  assert(pricing.includes("NexusOS Subscriptions"), "pricing page missing");
  assert(pricing.includes("checkoutForm"), "checkout form missing");

  const subscriber = await get("/subscriber.html");
  assert(subscriber.includes("Subscriber Portal"), "subscriber portal page missing");

  const css = await get("/styles.css");
  assert(css.includes(".login-view"), "login styles missing");
  assert(css.includes(".workflow-editor"), "workflow editor styles missing");

  const js = await get("/app.js");
  assert(js.includes("AI Assistant Studio") || js.includes("assistantStudio"), "assistant studio UI missing");
  assert(js.includes("/api/auth/login"), "login API wiring missing");
  assert(js.includes("/api/client/landing-page"), "landing page API wiring missing");

  const intakeJs = await get("/intake.js");
  assert(intakeJs.includes("/api/public/intake"), "intake API wiring missing");

  const pricingJs = await get("/pricing.js");
  assert(pricingJs.includes("/api/public/checkout"), "checkout API wiring missing");

  const subscriberJs = await get("/subscriber.js");
  assert(subscriberJs.includes("/api/subscriber/portal"), "subscriber portal API wiring missing");
  assert(subscriberJs.includes("/api/subscriber/login"), "subscriber login API wiring missing");

  console.log("NexusOS browser regression passed");
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
