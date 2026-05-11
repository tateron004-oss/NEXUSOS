const $ = selector => document.querySelector(selector);

$("#intakeForm").onsubmit = async event => {
  event.preventDefault();
  $("#intakeResult").textContent = "Creating workspace, landing page, and AI assistant package...";
  try {
    const payload = {
      name: $("#name").value,
      email: $("#email").value,
      phone: $("#phone").value,
      businessName: $("#businessName").value,
      industry: $("#industry").value,
      location: $("#location").value,
      needs: $("#needs").value
    };
    const res = await fetch("/api/public/intake", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Request failed");
    $("#intakeResult").textContent = [
      "NexusOS starter workspace created.",
      "",
      `Client: ${json.client.businessName}`,
      `Workspace slug: ${json.client.slug}`,
      `Landing page: ${location.origin}${json.landingUrl}`,
      `Website prototype: ${location.origin}${json.websiteUrl}`,
      "",
      "Next step: the NexusOS admin reviews the generated workspace and schedules a kickoff."
    ].join("\n");
  } catch (error) {
    $("#intakeResult").textContent = error.message;
  }
};
