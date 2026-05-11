const $ = selector => document.querySelector(selector);

function renderPortal(json) {
  $("#subscriberLogin").classList.add("hidden");
  $("#portalTitle").textContent = json.subscriber.businessName;
  $("#portalSub").textContent = `${json.plan.name} plan - ${json.subscriber.status}`;
  $("#portalContent").innerHTML = `
    <article>
      <span>Workspace</span>
      <h2>${json.client.businessName}</h2>
      <p>${json.workspace.leads.length} leads, ${json.workspace.socialPosts.length} social posts, ${json.workspace.tasks.length} tasks ready.</p>
    </article>
    <article>
      <span>Landing Page</span>
      <h2>Lead capture page</h2>
      <p>Review the generated page and share it with customers.</p>
      <a href="${json.landingUrl}" target="_blank" rel="noreferrer">Open landing page</a>
    </article>
    <article>
      <span>Website</span>
      <h2>Website prototype</h2>
      <p>Starter site generated from the business intake.</p>
      <a href="${json.websiteUrl}" target="_blank" rel="noreferrer">Open website</a>
    </article>
    <article>
      <span>AI Assistant</span>
      <h2>${json.workspace.assistantStudio.name}</h2>
      <p>${json.workspace.assistantStudio.purpose}</p>
    </article>
    <article>
      <span>Next Steps</span>
      <h2>Kickoff checklist</h2>
      <ul>${json.workspace.tasks.slice(0, 5).map(task => `<li>${task.title} - ${task.status}</li>`).join("")}</ul>
    </article>
  `;
}

async function loadPortal() {
  const token = new URLSearchParams(location.search).get("token");
  const path = token ? `/api/subscriber/portal?token=${encodeURIComponent(token)}` : "/api/subscriber/me";
  const res = await fetch(path);
  const json = await res.json();
  if (!res.ok || !json.subscriber) throw new Error(json.error || "Sign in to view your workspace");
  renderPortal(json);
}

$("#subscriberLoginForm").onsubmit = async event => {
  event.preventDefault();
  try {
    const res = await fetch("/api/subscriber/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: $("#subscriberEmail").value,
        password: $("#subscriberPassword").value
      })
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Login failed");
    renderPortal(json);
  } catch (error) {
    $("#portalTitle").textContent = "Portal unavailable";
    $("#portalSub").textContent = error.message;
  }
};

loadPortal().catch(error => {
  $("#portalTitle").textContent = "Subscriber portal";
  $("#portalSub").textContent = error.message;
});
