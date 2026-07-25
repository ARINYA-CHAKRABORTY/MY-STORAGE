const form = document.getElementById("login-form");
const errorEl = document.getElementById("login-error");
const submitBtn = document.getElementById("login-submit");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorEl.textContent = "";
  submitBtn.disabled = true;

  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;
  const remember = document.getElementById("remember").checked;

  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, remember })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Sign in failed");
    window.location.href = "/";
  } catch (err) {
    errorEl.textContent = err.message;
    submitBtn.disabled = false;
  }
});
