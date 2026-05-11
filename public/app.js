let state = null;
let activeAgent = "coach";
let currentOutput = "";
let activeClientSlug = "";
let activeClient = null;
let activeWorkspace = null;
let activePanel = "leads";
let currentUser = null;

const $ = selector => document.querySelector(selector);

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.remove("hidden");
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => el.classList.add("hidden"), 2400);
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: "same-origin",
    headers: { "content-type": "application/json", ...(options.headers || {}) },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Request failed");
  return json;
}

function setAuthenticated(isAuthenticated) {
  $("#loginView").classList.toggle("hidden", isAuthenticated);
  document.body.classList.toggle("locked", !isAuthenticated);
}

function agentKeys() {
  return ["coach", "business", "strategy", "investor", "product", "operations", "research", "content", "partnerships", "technical"];
}

function renderAgents() {
  $("#agentNav").innerHTML = agentKeys().map(key => {
    const agent = state.agents[key];
    return `
      <button class="agent-btn ${key === activeAgent ? "active" : ""}" data-agent="${key}" type="button">
        <strong>${agent.name}</strong>
        <span>${agent.promise}</span>
      </button>
    `;
  }).join("");

  document.querySelectorAll("[data-agent]").forEach(button => {
    button.onclick = () => {
      activeAgent = button.dataset.agent;
      render();
    };
  });
}

function renderOutputs() {
  $("#outputCount").textContent = state.outputs.length;
  $("#recentOutputs").innerHTML = state.outputs.length
    ? state.outputs.map(item => `
      <article class="output-item">
        <strong>${item.file}</strong>
        <span>${new Date(item.updatedAt).toLocaleString()} - ${Math.round(item.size / 1024)} KB</span>
      </article>
    `).join("")
    : `<p>No saved outputs yet.</p>`;

  $("#clientList").innerHTML = state.clients?.length
    ? state.clients.map(item => `
      <article class="output-item client-item ${item.slug === activeClientSlug ? "selected" : ""}">
        <strong>${escapeHtml(item.businessName || item.slug)}</strong>
        <span>${new Date(item.updatedAt).toLocaleString()}</span>
        <div class="mini-actions">
          <button type="button" data-client="${item.slug}">Open workspace</button>
          <a href="${item.websiteUrl}" target="_blank" rel="noreferrer">Website</a>
        </div>
      </article>
    `).join("")
    : `<p>No business kits built yet.</p>`;

  document.querySelectorAll("[data-client]").forEach(button => {
    button.onclick = () => openClient(button.dataset.client);
  });
}

function workflowCards(client) {
  return client.workflow.map(item => `
    <article class="workflow-card ${item.complete ? "complete" : ""}">
      <span>${item.complete ? "Ready" : "Needs build"}</span>
      <strong>${escapeHtml(item.label)}</strong>
      <button type="button" data-open-panel="${item.key}">${item.key === "launch" ? "Review" : "Open panel"}</button>
    </article>
  `).join("");
}

function clientFileList(client) {
  return client.files.map(file => `
    <a class="file-row" href="${file.url}" target="_blank" rel="noreferrer">
      <strong>${escapeHtml(file.name)}</strong>
      <span>${Math.max(1, Math.round(file.size / 1024))} KB</span>
    </a>
  `).join("");
}

function rowInput(value, field, index, group, placeholder = "") {
  return `<input data-group="${group}" data-index="${index}" data-field="${field}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}">`;
}

function workflowPanel() {
  if (!activeWorkspace) return "";
  const panel = activePanel;
  if (panel === "studio") {
    const studio = activeWorkspace.assistantStudio;
    return `
      <div class="editor-head">
        <h3>AI Assistant Studio</h3>
        <div class="mini-actions">
          <button type="button" data-test-assistant>Test assistant</button>
          <button class="primary" type="button" data-package-assistant>Package assistant</button>
        </div>
      </div>
      <div class="studio-grid">
        <section class="studio-section">
          <label>Assistant Name<input data-studio-field="name" value="${escapeHtml(studio.name)}"></label>
          <label>Purpose<textarea data-studio-field="purpose" rows="3">${escapeHtml(studio.purpose)}</textarea></label>
          <label>Personality<textarea data-studio-field="personality" rows="3">${escapeHtml(studio.personality)}</textarea></label>
          <label>Test Message<textarea data-studio-field="testMessage" rows="3">${escapeHtml(studio.testMessage)}</textarea></label>
        </section>
        <section class="studio-section">
          <div class="editor-head"><h3>Channels</h3><button type="button" data-add-studio="channels">Add channel</button></div>
          ${studio.channels.map((channel, index) => `
            <article class="studio-row">
              <label class="checkline"><input type="checkbox" data-studio-group="channels" data-index="${index}" data-field="enabled" ${channel.enabled ? "checked" : ""}> Enabled</label>
              <input data-studio-group="channels" data-index="${index}" data-field="name" value="${escapeHtml(channel.name)}" placeholder="Channel">
              <textarea data-studio-group="channels" data-index="${index}" data-field="job" rows="2" placeholder="Job">${escapeHtml(channel.job)}</textarea>
            </article>
          `).join("")}
        </section>
        <section class="studio-section">
          <div class="editor-head"><h3>Knowledge Base</h3><button type="button" data-add-studio="knowledge">Add knowledge</button></div>
          ${studio.knowledge.map((item, index) => `
            <textarea data-studio-list="knowledge" data-index="${index}" rows="2">${escapeHtml(item)}</textarea>
          `).join("")}
        </section>
        <section class="studio-section">
          <div class="editor-head"><h3>Workflows</h3><button type="button" data-add-studio="workflows">Add workflow</button></div>
          ${studio.workflows.map((flow, index) => `
            <article class="studio-row">
              <input data-studio-group="workflows" data-index="${index}" data-field="name" value="${escapeHtml(flow.name)}" placeholder="Workflow">
              <input data-studio-group="workflows" data-index="${index}" data-field="trigger" value="${escapeHtml(flow.trigger)}" placeholder="Trigger">
              <textarea data-studio-group="workflows" data-index="${index}" data-field="steps" rows="2" placeholder="Steps">${escapeHtml(flow.steps)}</textarea>
              <select data-studio-group="workflows" data-index="${index}" data-field="status">
                ${["draft", "ready", "live", "paused"].map(status => `<option value="${status}" ${flow.status === status ? "selected" : ""}>${status}</option>`).join("")}
              </select>
            </article>
          `).join("")}
        </section>
        <section class="studio-section">
          <div class="editor-head"><h3>Deployment Checklist</h3><button type="button" data-add-studio="deployment">Add item</button></div>
          ${studio.deployment.map((item, index) => `
            <article class="studio-row compact-row">
              <label class="checkline"><input type="checkbox" data-studio-group="deployment" data-index="${index}" data-field="done" ${item.done ? "checked" : ""}> Done</label>
              <input data-studio-group="deployment" data-index="${index}" data-field="item" value="${escapeHtml(item.item)}" placeholder="Deployment item">
            </article>
          `).join("")}
        </section>
        <section class="studio-section studio-output">
          <h3>Assistant Test Output</h3>
          <pre id="assistantTestOutput">Run a test to simulate how this assistant responds.</pre>
        </section>
      </div>
      <button class="primary" type="button" data-save-workspace>Save AI Assistant Studio</button>
    `;
  }
  if (panel === "social") {
    return `
      <div class="editor-head"><h3>Social Media Workspace</h3><button type="button" data-add="socialPosts">Add post</button></div>
      <div class="editable-list">
        ${activeWorkspace.socialPosts.map((post, index) => `
          <article class="edit-row">
            ${rowInput(post.platform, "platform", index, "socialPosts", "Platform")}
            <select data-group="socialPosts" data-index="${index}" data-field="status">
              ${["draft", "ready", "scheduled", "posted"].map(status => `<option value="${status}" ${post.status === status ? "selected" : ""}>${status}</option>`).join("")}
            </select>
            <textarea data-group="socialPosts" data-index="${index}" data-field="caption" rows="3" placeholder="Caption">${escapeHtml(post.caption)}</textarea>
          </article>
        `).join("")}
      </div>
      <button class="primary" type="button" data-save-workspace>Save social workspace</button>
    `;
  }
  if (panel === "assistant" || panel === "phone") {
    const scripts = activeWorkspace.assistantScripts;
    return `
      <div class="editor-head"><h3>${panel === "phone" ? "Phone Assistant Workspace" : "AI Assistant Workspace"}</h3><button type="button" data-run-workflow="${panel}">Create action plan</button></div>
      <label>Greeting<textarea data-script="greeting" rows="3">${escapeHtml(scripts.greeting)}</textarea></label>
      <label>Lead Capture<textarea data-script="leadCapture" rows="3">${escapeHtml(scripts.leadCapture)}</textarea></label>
      <label>Escalation Rule<textarea data-script="escalation" rows="3">${escapeHtml(scripts.escalation)}</textarea></label>
      <button class="primary" type="button" data-save-workspace>Save assistant scripts</button>
    `;
  }
  if (panel === "website") {
    const page = activeWorkspace.landingPage;
    return `
      <div class="editor-head"><h3>Small Business Landing Page Builder</h3><button type="button" data-create-landing>Create landing page</button></div>
      <label>Headline<textarea data-landing="headline" rows="2">${escapeHtml(page.headline)}</textarea></label>
      <label>Subheadline<textarea data-landing="subheadline" rows="2">${escapeHtml(page.subheadline)}</textarea></label>
      <label>Primary Offer<input data-landing="offer" value="${escapeHtml(page.offer)}"></label>
      <div class="fields two">
        <label>Phone<input data-landing="phone" value="${escapeHtml(page.phone)}"></label>
        <label>Email<input data-landing="email" value="${escapeHtml(page.email)}"></label>
      </div>
      <label>Proof Point<textarea data-landing="proof" rows="2">${escapeHtml(page.proof)}</textarea></label>
      <button class="primary" type="button" data-save-workspace>Save page copy</button>
    `;
  }
  if (panel === "launch" || panel === "outreach" || panel === "followup") {
    return `
      <div class="editor-head"><h3>${panel === "launch" ? "Launch" : panel === "outreach" ? "Outreach" : "Follow-Up"} Task Board</h3><button type="button" data-add="tasks">Add task</button></div>
      <div class="editable-list">
        ${activeWorkspace.tasks.map((task, index) => `
          <article class="edit-row task-row">
            ${rowInput(task.title, "title", index, "tasks", "Task")}
            <select data-group="tasks" data-index="${index}" data-field="status">
              ${["todo", "doing", "done", "blocked"].map(status => `<option value="${status}" ${task.status === status ? "selected" : ""}>${status}</option>`).join("")}
            </select>
          </article>
        `).join("")}
      </div>
      <button class="primary" type="button" data-save-workspace>Save task board</button>
    `;
  }
  return `
    <div class="editor-head"><h3>Lead Pipeline Workspace</h3><button type="button" data-add="leads">Add lead</button></div>
    <div class="editable-list">
      ${activeWorkspace.leads.map((lead, index) => `
        <article class="edit-row lead-row">
          ${rowInput(lead.name, "name", index, "leads", "Lead name")}
          ${rowInput(lead.contact, "contact", index, "leads", "Contact")}
          ${rowInput(lead.need, "need", index, "leads", "Need")}
          <select data-group="leads" data-index="${index}" data-field="stage">
            ${["new", "contacted", "interested", "quoted", "booked", "won", "lost"].map(stage => `<option value="${stage}" ${lead.stage === stage ? "selected" : ""}>${stage}</option>`).join("")}
          </select>
          ${rowInput(lead.nextAction, "nextAction", index, "leads", "Next action")}
        </article>
      `).join("")}
    </div>
    <button class="primary" type="button" data-save-workspace>Save lead pipeline</button>
  `;
}

function bindWorkspaceEditor() {
  document.querySelectorAll("[data-open-panel]").forEach(button => {
    button.onclick = () => {
      activePanel = button.dataset.openPanel;
      renderClientWorkspace(activeClient, activeWorkspace);
    };
  });

  document.querySelectorAll("[data-group]").forEach(input => {
    input.oninput = () => {
      const group = input.dataset.group;
      const index = Number(input.dataset.index);
      activeWorkspace[group][index][input.dataset.field] = input.value;
    };
    input.onchange = input.oninput;
  });

  document.querySelectorAll("[data-script]").forEach(input => {
    input.oninput = () => {
      activeWorkspace.assistantScripts[input.dataset.script] = input.value;
    };
  });

  document.querySelectorAll("[data-landing]").forEach(input => {
    input.oninput = () => {
      activeWorkspace.landingPage[input.dataset.landing] = input.value;
    };
  });

  document.querySelectorAll("[data-studio-field]").forEach(input => {
    input.oninput = () => {
      activeWorkspace.assistantStudio[input.dataset.studioField] = input.value;
    };
  });

  document.querySelectorAll("[data-studio-group]").forEach(input => {
    const update = () => {
      const group = input.dataset.studioGroup;
      const index = Number(input.dataset.index);
      const field = input.dataset.field;
      activeWorkspace.assistantStudio[group][index][field] = input.type === "checkbox" ? input.checked : input.value;
    };
    input.oninput = update;
    input.onchange = update;
  });

  document.querySelectorAll("[data-studio-list]").forEach(input => {
    input.oninput = () => {
      activeWorkspace.assistantStudio[input.dataset.studioList][Number(input.dataset.index)] = input.value;
    };
  });

  document.querySelectorAll("[data-add]").forEach(button => {
    button.onclick = () => {
      const target = button.dataset.add;
      if (target === "leads") activeWorkspace.leads.push({ name: "", contact: "", need: "", stage: "new", nextAction: "" });
      if (target === "socialPosts") activeWorkspace.socialPosts.push({ platform: "Facebook", status: "draft", caption: "" });
      if (target === "tasks") activeWorkspace.tasks.push({ title: "", status: "todo" });
      renderClientWorkspace(activeClient, activeWorkspace);
    };
  });

  document.querySelectorAll("[data-add-studio]").forEach(button => {
    button.onclick = () => {
      const target = button.dataset.addStudio;
      if (target === "channels") activeWorkspace.assistantStudio.channels.push({ name: "New Channel", enabled: true, job: "Describe the channel job." });
      if (target === "knowledge") activeWorkspace.assistantStudio.knowledge.push("Add business knowledge, service information, FAQ, or escalation rule.");
      if (target === "workflows") activeWorkspace.assistantStudio.workflows.push({ name: "New Workflow", trigger: "Customer action", steps: "Step one, step two, owner handoff.", status: "draft" });
      if (target === "deployment") activeWorkspace.assistantStudio.deployment.push({ item: "New deployment step", done: false });
      renderClientWorkspace(activeClient, activeWorkspace);
    };
  });

  document.querySelectorAll("[data-save-workspace]").forEach(button => {
    button.onclick = saveWorkspace;
  });

  document.querySelectorAll("[data-run-workflow]").forEach(button => {
    button.onclick = () => runClientWorkflow(button.dataset.runWorkflow);
  });

  const landingButton = document.querySelector("[data-create-landing]");
  if (landingButton) landingButton.onclick = createLandingPage;
  const packageButton = document.querySelector("[data-package-assistant]");
  if (packageButton) packageButton.onclick = packageAssistant;
  const testButton = document.querySelector("[data-test-assistant]");
  if (testButton) testButton.onclick = testAssistant;
}

function renderClientWorkspace(client, workspace = activeWorkspace) {
  if (!client || !workspace) return;
  activeClient = client;
  activeWorkspace = workspace;
  activeClientSlug = client.slug;
  $("#clientWorkspaceSub").textContent = `${client.businessName} - ${client.files.length} files ready`;
  $("#clientWebsiteLink").href = client.websiteUrl;
  $("#clientWebsiteLink").classList.remove("hidden");
  $("#clientWorkspace").className = "client-dashboard";
  $("#clientWorkspace").innerHTML = `
    <div class="client-hero">
      <div>
        <span class="eyebrow">Active client</span>
        <h3>${escapeHtml(client.businessName)}</h3>
        <p>Run social, lead, AI assistant, phone, website, and follow-up workflows from one command room.</p>
      </div>
      <div class="client-metrics">
        <div><strong>${client.files.length}</strong><span>files</span></div>
        <div><strong>${client.workflow.filter(item => item.complete).length}/${client.workflow.length}</strong><span>ready</span></div>
      </div>
    </div>
    <div class="workflow-grid">
      ${workflowCards(client)}
      <article class="workflow-card action-card">
        <span>Ecosystem</span>
        <strong>AI Assistant Studio</strong>
        <button type="button" data-open-panel="studio">Open studio</button>
      </article>
      <article class="workflow-card action-card">
        <span>Pipeline</span>
        <strong>Lead Follow-Up</strong>
        <button type="button" data-open-panel="leads">Open panel</button>
      </article>
      <article class="workflow-card action-card">
        <span>Retention</span>
        <strong>Customer Follow-Up</strong>
        <button type="button" data-open-panel="followup">Open panel</button>
      </article>
    </div>
    <section class="workflow-editor">
      ${workflowPanel()}
    </section>
    <div class="workspace-columns">
      <section>
        <h3>Client Files</h3>
        <div class="file-list">${clientFileList(client)}</div>
      </section>
      <section>
        <h3>Next Best Move</h3>
        <p>Pick a workflow above. NexusOS will create a dated action plan inside this client's folder and place it in the Generated Brief area.</p>
        <div class="path-note">${escapeHtml(client.path)}</div>
      </section>
    </div>
  `;

  bindWorkspaceEditor();
  renderOutputs();
}

async function openClient(slug) {
  try {
    const result = await api(`/api/client?slug=${encodeURIComponent(slug)}`);
    renderClientWorkspace(result.client, result.workspace);
    toast("Client workspace opened");
  } catch (error) {
    toast(error.message);
  }
}

async function saveWorkspace() {
  if (!activeClientSlug || !activeWorkspace) return toast("Open a client workspace first");
  try {
    const result = await api("/api/client/workspace", {
      method: "POST",
      body: { slug: activeClientSlug, workspace: activeWorkspace }
    });
    activeWorkspace = result.workspace;
    activeClient = result.client;
    renderClientWorkspace(activeClient, activeWorkspace);
    toast("Workspace saved");
  } catch (error) {
    toast(error.message);
  }
}

async function createLandingPage() {
  if (!activeClientSlug || !activeWorkspace) return toast("Open a client workspace first");
  try {
    const result = await api("/api/client/landing-page", {
      method: "POST",
      body: { slug: activeClientSlug, workspace: activeWorkspace }
    });
    state = result.state;
    activeWorkspace = result.workspace;
    activeClient = result.client;
    currentOutput = `# Landing Page Created\n\nOpen: ${location.origin}${result.landingUrl}\n\nClient: ${activeClient.businessName}`;
    $("#output").textContent = currentOutput;
    renderClientWorkspace(activeClient, activeWorkspace);
    $("#clientWebsiteLink").href = result.landingUrl;
    toast("Landing page created");
  } catch (error) {
    toast(error.message);
  }
}

async function testAssistant() {
  if (!activeClientSlug || !activeWorkspace) return toast("Open a client workspace first");
  try {
    const result = await api("/api/client/assistant/test", {
      method: "POST",
      body: {
        slug: activeClientSlug,
        workspace: activeWorkspace,
        message: activeWorkspace.assistantStudio.testMessage
      }
    });
    activeWorkspace = result.workspace;
    activeClient = result.client;
    const target = $("#assistantTestOutput");
    if (target) target.textContent = result.reply;
    currentOutput = `# Assistant Test Response\n\n${result.reply}`;
    $("#output").textContent = currentOutput;
    toast("Assistant tested");
  } catch (error) {
    toast(error.message);
  }
}

async function packageAssistant() {
  if (!activeClientSlug || !activeWorkspace) return toast("Open a client workspace first");
  try {
    const result = await api("/api/client/assistant/package", {
      method: "POST",
      body: { slug: activeClientSlug, workspace: activeWorkspace }
    });
    state = result.state;
    activeWorkspace = result.workspace;
    activeClient = result.client;
    currentOutput = `${result.prompt}\n\n## Test Response\n\n${result.reply}\n\n## Package Files\n\n${result.files.map(file => `- ${file}`).join("\n")}`;
    $("#output").textContent = currentOutput;
    renderClientWorkspace(activeClient, activeWorkspace);
    toast("Assistant packaged");
  } catch (error) {
    toast(error.message);
  }
}

async function runClientWorkflow(action) {
  if (!activeClientSlug) return toast("Open a client workspace first");
  try {
    const result = await api("/api/client/workflow", {
      method: "POST",
      body: { slug: activeClientSlug, action }
    });
    state = result.state;
    currentOutput = result.output;
    $("#output").textContent = currentOutput;
    const detail = await api(`/api/client?slug=${encodeURIComponent(result.client.slug)}`);
    renderClientWorkspace(detail.client, detail.workspace);
    toast("Workflow created");
  } catch (error) {
    toast(error.message);
  }
}

function render() {
  const agent = state.agents[activeAgent];
  $("#agentTitle").textContent = agent.name;
  $("#agentPromise").textContent = agent.promise;
  $("#activeAgentChip").textContent = agent.name;
  $("#memoryPreview").textContent = state.memory.memory
    .replace(/[#*-]/g, "")
    .split(/\s+/)
    .slice(0, 54)
    .join(" ") + "...";
  renderAgents();
  renderOutputs();
  $("#buildBusinessBtn").classList.toggle("hidden", activeAgent !== "business");
  if (!activeClientSlug && state.clients?.length) openClient(state.clients[0].slug);
}

async function load() {
  const auth = await api("/api/auth/me");
  currentUser = auth.user;
  if (auth.authRequired && !currentUser) {
    setAuthenticated(false);
    return;
  }
  setAuthenticated(true);
  state = await api("/api/state");
  render();
}

$("#loginForm").onsubmit = async event => {
  event.preventDefault();
  try {
    const result = await api("/api/auth/login", {
      method: "POST",
      body: {
        email: $("#loginEmail").value,
        password: $("#loginPassword").value
      }
    });
    currentUser = result.user;
    setAuthenticated(true);
    state = await api("/api/state");
    render();
    toast("Signed in");
  } catch (error) {
    toast(error.message);
  }
};

$("#logoutBtn").onclick = async () => {
  try {
    await api("/api/auth/logout", { method: "POST", body: {} });
    currentUser = null;
    state = null;
    setAuthenticated(false);
    toast("Signed out");
  } catch (error) {
    toast(error.message);
  }
};

$("#commandForm").onsubmit = async event => {
  event.preventDefault();
  try {
    const payload = {
      agent: activeAgent,
      request: $("#request").value,
      objective: $("#objective").value,
      audience: $("#audience").value,
      urgency: $("#urgency").value
    };
    const result = await api("/api/generate", { method: "POST", body: payload });
    currentOutput = result.output;
    $("#output").textContent = currentOutput;
    toast("Command brief generated");
  } catch (error) {
    toast(error.message);
  }
};

$("#clearBtn").onclick = () => {
  $("#request").value = "";
  $("#objective").value = "";
  $("#audience").value = "";
  $("#urgency").value = "normal";
  currentOutput = "";
  $("#output").textContent = "Choose an agent, enter a request, and generate a command brief.";
};

$("#buildBusinessBtn").onclick = async () => {
  if (activeAgent !== "business") return toast("Choose Business Builder Agent first");
  try {
    const payload = {
      agent: activeAgent,
      request: $("#request").value,
      objective: $("#objective").value,
      audience: $("#audience").value,
      urgency: $("#urgency").value
    };
    const result = await api("/api/business/build", { method: "POST", body: payload });
    state = result.state;
    currentOutput = result.kit.summary + `\n\n## Generated Files\n\n${result.kit.files.map(file => `- ${file}`).join("\n")}\n\n## Website Prototype\n\nOpen: ${location.origin}${result.kit.websiteUrl}\n`;
    $("#output").textContent = currentOutput;
    render();
    openClient(result.kit.info ? result.kit.info.slug : state.clients[0].slug);
    toast("Full business kit built");
  } catch (error) {
    toast(error.message);
  }
};

$("#copyBtn").onclick = async () => {
  if (!currentOutput) return toast("Generate a brief first");
  await navigator.clipboard.writeText(currentOutput);
  toast("Copied");
};

$("#saveBtn").onclick = async () => {
  if (!currentOutput) return toast("Generate a brief first");
  try {
    const result = await api("/api/save", {
      method: "POST",
      body: {
        agent: activeAgent,
        title: $("#objective").value || $("#request").value || "nexusos-output",
        output: currentOutput
      }
    });
    state.outputs = result.outputs;
    renderOutputs();
    toast("Saved to NexusOS");
  } catch (error) {
    toast(error.message);
  }
};

load().catch(error => toast(error.message));
