const $ = selector => document.querySelector(selector);

function label(name) {
  return {
    database: "Persistence",
    openai: "OpenAI Live AI",
    stripe: "Stripe Billing",
    twilio: "Twilio Phone/SMS"
  }[name] || name;
}

async function loadStatus() {
  const res = await fetch("/api/readiness");
  const readiness = await res.json();
  const integrations = readiness.integrations || {};
  $("#statusSummary").textContent = readiness.liveIntegrationsReady
    ? "All live services are connected."
    : readiness.note || "Some services are not connected yet.";
  $("#statusGrid").innerHTML = Object.entries(integrations)
    .filter(([name]) => name !== "strictMode")
    .map(([name, item]) => `
      <article class="${item.connected ? "status-live" : "status-missing"}">
        <span>${item.connected ? "Connected" : "Not connected"}</span>
        <h2>${label(name)}</h2>
        <p>Mode: ${item.mode}</p>
        <p>Required: ${item.requiredEnv}</p>
      </article>
    `).join("") + `
      <article>
        <span>${integrations.strictMode ? "Strict" : "Hybrid"}</span>
        <h2>Production Behavior</h2>
        <p>${integrations.strictMode ? "Missing live services will block dependent workflows." : "Missing live services use safe fallback workflows."}</p>
      </article>
    `;
}

loadStatus().catch(error => {
  $("#statusSummary").textContent = error.message;
});
