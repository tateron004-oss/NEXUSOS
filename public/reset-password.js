const $ = selector => document.querySelector(selector);

const token = new URLSearchParams(location.search).get("token");
if (token) $("#resetToken").value = token;

$("#requestResetForm").onsubmit = async event => {
  event.preventDefault();
  const res = await fetch("/api/subscriber/password-reset/request", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: $("#resetEmail").value })
  });
  const json = await res.json();
  $("#resetMessage").textContent = json.message || json.error || "Request sent.";
};

$("#confirmResetForm").onsubmit = async event => {
  event.preventDefault();
  const res = await fetch("/api/subscriber/password-reset/confirm", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: $("#resetToken").value, password: $("#newPassword").value })
  });
  const json = await res.json();
  $("#resetMessage").textContent = json.ok ? "Password updated. You can now sign in to the subscriber portal." : (json.error || "Reset failed.");
};
