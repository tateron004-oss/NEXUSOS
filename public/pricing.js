const $ = selector => document.querySelector(selector);

async function loadPlans() {
  const res = await fetch("/api/public/plans");
  const json = await res.json();
  $("#plans").innerHTML = json.plans.map(plan => `
    <article class="price-card ${plan.id === "growth" ? "featured" : ""}">
      <span>${plan.name}</span>
      <h2>$${plan.price}<small>/${plan.interval}</small></h2>
      <p>${plan.promise}</p>
      <ul>${plan.features.map(feature => `<li>${feature}</li>`).join("")}</ul>
      <button type="button" data-plan="${plan.id}">Choose ${plan.name}</button>
    </article>
  `).join("");
  document.querySelectorAll("[data-plan]").forEach(button => {
    button.onclick = () => {
      $("#selectedPlan").value = button.dataset.plan;
      document.querySelectorAll(".price-card").forEach(card => card.classList.remove("selected"));
      button.closest(".price-card").classList.add("selected");
    };
  });
}

$("#checkoutForm").onsubmit = async event => {
  event.preventDefault();
  $("#checkoutResult").textContent = "Creating subscription workspace...";
  try {
    const payload = {
      plan: $("#selectedPlan").value,
      name: $("#name").value,
      email: $("#email").value,
      phone: $("#phone").value,
      businessName: $("#businessName").value,
      industry: $("#industry").value,
      location: $("#location").value,
      needs: $("#needs").value
    };
    const res = await fetch("/api/public/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Checkout failed");
    $("#checkoutResult").textContent = [
      `Mode: ${json.mode}`,
      `Plan: ${json.plan.name}`,
      `Subscriber: ${json.subscriber.email}`,
      `Status: ${json.subscriber.status}`,
      json.subscriber.temporaryPassword ? `Temporary password: ${json.subscriber.temporaryPassword}` : "",
      "",
      `Portal: ${location.origin}${json.portalUrl}`,
      `Checkout: ${json.checkoutUrl.startsWith("/") ? location.origin + json.checkoutUrl : json.checkoutUrl}`,
      "",
      json.message
    ].filter(Boolean).join("\n");
    if (json.mode === "stripe-checkout" && json.checkoutUrl) {
      location.href = json.checkoutUrl;
    }
  } catch (error) {
    $("#checkoutResult").textContent = error.message;
  }
};

loadPlans().catch(error => {
  $("#plans").textContent = error.message;
});
