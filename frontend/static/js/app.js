(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const state = { username: "", entries: [], editingId: null, deletingId: null, revealed: new Set() };
  const authView = $("auth-view"), vaultView = $("vault-view");
  const loginPage = $("login-page"), signupPage = $("signup-page");
  const loginTab = $("show-login"), signupTab = $("show-signup");

  function csrf() { return document.querySelector('meta[name="csrf-token"]').content; }
  function setCsrf(token) { if (token) document.querySelector('meta[name="csrf-token"]').content = token; }
  function message(id, text, success = false) {
    const el = $(id); if (!el) return;
    el.textContent = text || ""; el.classList.toggle("success", success);
  }
  function setAuthTab(tab) {
    const login = tab === "login";
    loginPage.classList.toggle("hidden", !login); signupPage.classList.toggle("hidden", login);
    loginTab.classList.toggle("active", login); signupTab.classList.toggle("active", !login);
    loginTab.setAttribute("aria-selected", String(login)); signupTab.setAttribute("aria-selected", String(!login));
  }
  function showAuth(tab = "login") {
    authView.classList.remove("hidden"); vaultView.classList.add("hidden"); $("lock-button").classList.add("hidden");
    setAuthTab(tab);
  }
  function showVault() {
    authView.classList.add("hidden"); vaultView.classList.remove("hidden"); $("lock-button").classList.remove("hidden");
    $("current-user").textContent = state.username;
  }
  async function api(url, options = {}) {
    const headers = { "Content-Type": "application/json", "X-CSRF-Token": csrf(), ...(options.headers || {}) };
    const response = await fetch(url, { credentials: "same-origin", ...options, headers });
    let data = {};
    try { data = await response.json(); } catch (_) { /* response may be empty */ }
    if (data.csrf) setCsrf(data.csrf);
    if (!response.ok) {
      if (response.status === 401 && url !== "/api/login" && url !== "/api/register") {
        showAuth("login");
      }
      throw new Error(data.error || `Request failed (${response.status}).`);
    }
    return data;
  }
  function evaluatePassword(password) {
    const rules = {
      length: password.length >= 12,
      upper: /[A-Z]/.test(password),
      lower: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[^A-Za-z0-9]/.test(password)
    };
    return { rules, score: Object.values(rules).filter(Boolean).length };
  }
  function strengthLabel(score) {
    return ["Very weak", "Very weak", "Weak", "Fair", "Good", "Strong"][score] || "Not checked";
  }
  function setStrength(password) {
    const { rules, score } = evaluatePassword(password);
    $("checker-strength").textContent = password ? strengthLabel(score) : "Not checked";
    $("checker-score").textContent = `${score}/5`;
    $("checker-fill").style.width = `${score * 20}%`;
    $("checker-fill").style.background = score <= 2 ? "#b83b43" : score <= 3 ? "#bd8b34" : "#3e9b6e";
    Object.entries(rules).forEach(([rule, passed]) => {
      const el = document.querySelector(`[data-check="${rule}"]`); if (el) el.classList.toggle("passed", passed);
    });
  }
  function entryStrength(password) {
    const score = evaluatePassword(password).score;
    return { score, label: strengthLabel(score), good: score >= 4 };
  }
  function makeButton(text, className, handler, title = "") {
    const button = document.createElement("button"); button.type = "button"; button.className = className; button.textContent = text;
    if (title) button.title = title; button.addEventListener("click", handler); return button;
  }
  function safeDomain(value) {
    if (!value) return "";
    try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) ? url.hostname : ""; }
    catch (_) { return ""; }
  }
  function renderEntries() {
    const list = $("entries-list"), empty = $("empty-state"); list.replaceChildren();
    const query = $("search-entries").value.trim().toLowerCase();
    const visible = state.entries.filter((entry) => [entry.site, entry.url, entry.login].join(" ").toLowerCase().includes(query));
    empty.classList.toggle("hidden", visible.length > 0);
    if (!visible.length && query) {
      const noMatch = document.createElement("p"); noMatch.className = "muted"; noMatch.textContent = "No accounts match your search."; list.append(noMatch);
    }
    visible.forEach((entry) => {
      const card = document.createElement("article"); card.className = "entry-card";
      const main = document.createElement("div"); main.className = "entry-main";
      const titleRow = document.createElement("div"); titleRow.className = "entry-title-row";
      const title = document.createElement("span"); title.className = "entry-title"; title.textContent = entry.site; titleRow.append(title);
      if (entry.usageCount > 0) { const usage = document.createElement("span"); usage.className = "usage-pill"; usage.textContent = `Used ${entry.usageCount}×`; titleRow.append(usage); }
      main.append(titleRow);
      const domain = safeDomain(entry.url); if (domain) { const url = document.createElement("div"); url.className = "entry-domain"; url.textContent = domain; main.append(url); }
      if (entry.login) { const login = document.createElement("div"); login.className = "entry-user"; login.textContent = entry.login; main.append(login); }
      const preview = document.createElement("div"); preview.className = "password-preview";
      const passwordText = document.createElement("span"); passwordText.textContent = state.revealed.has(entry.id) ? entry.password : "••••••••••••";
      const reveal = makeButton(state.revealed.has(entry.id) ? "Hide" : "Reveal", "mini-button", () => {
        if (state.revealed.has(entry.id)) state.revealed.delete(entry.id); else state.revealed.add(entry.id); renderEntries();
      });
      const copy = makeButton("Copy", "mini-button", async () => {
        try { await navigator.clipboard.writeText(entry.password); copy.textContent = "Copied"; setTimeout(() => { copy.textContent = "Copy"; }, 1200); }
        catch (_) { window.prompt("Copy this password:", entry.password); }
      });
      preview.append(passwordText, reveal, copy); main.append(preview);
      const strength = entryStrength(entry.password); const rating = document.createElement("span"); rating.className = `strength-pill${strength.good ? " good" : ""}`; rating.textContent = strength.label; main.append(rating);
      if (entry.notes) { const note = document.createElement("div"); note.className = "entry-domain"; note.textContent = `Note: ${entry.notes}`; main.append(note); }
      const actions = document.createElement("div"); actions.className = "entry-actions";
      actions.append(makeButton("Mark used", "mini-button", async () => {
        try { await api(`/api/entries/${encodeURIComponent(entry.id)}/used`, { method: "POST", body: "{}" }); await loadEntries(); }
        catch (err) { alert(err.message); }
      }));
      actions.append(makeButton("Edit", "mini-button", () => openEntryDialog(entry)));
      actions.append(makeButton("Delete", "mini-button delete", () => openDeleteDialog(entry.id)));
      card.append(main, actions); list.append(card);
    });
    renderStats(); renderFrequent();
  }
  function renderStats() {
    $("stat-total").textContent = String(state.entries.length);
    $("stat-weak").textContent = String(state.entries.filter((e) => entryStrength(e.password).score < 4).length);
    const most = [...state.entries].sort((a, b) => b.usageCount - a.usageCount)[0];
    $("stat-most-used").textContent = most && most.usageCount ? most.site : "—";
    $("stat-most-used-count").textContent = most && most.usageCount ? `${most.usageCount} marked uses` : "No usage recorded yet";
  }
  function renderFrequent() {
    const root = $("frequent-list"); root.replaceChildren();
    const frequent = [...state.entries].filter((e) => e.usageCount > 0).sort((a, b) => b.usageCount - a.usageCount).slice(0, 5);
    if (!frequent.length) { const p = document.createElement("p"); p.className = "muted"; p.textContent = "Mark an entry as used to track frequency."; root.append(p); return; }
    frequent.forEach((entry, i) => {
      const row = document.createElement("div"); row.className = "frequent-item";
      const rank = document.createElement("span"); rank.className = "rank"; rank.textContent = String(i + 1);
      const name = document.createElement("span"); name.className = "frequent-name"; name.textContent = entry.site;
      const count = document.createElement("span"); count.className = "frequent-count"; count.textContent = `${entry.usageCount}×`;
      row.append(rank, name, count); root.append(row);
    });
  }
  async function loadEntries() {
    const data = await api("/api/entries", { method: "GET", headers: {} });
    state.entries = data.entries || []; renderEntries();
  }
  async function openVault(username) {
    state.username = username; showVault();
    try { await loadEntries(); }
    catch (err) { message("login-message", err.message); showAuth("login"); }
  }
  function openEntryDialog(entry = null) {
    state.editingId = entry ? entry.id : null;
    $("entry-dialog-title").textContent = entry ? "Edit password" : "Add password";
    $("entry-site").value = entry?.site || ""; $("entry-url").value = entry?.url || "";
    $("entry-login").value = entry?.login || ""; $("entry-password").value = entry?.password || "";
    $("entry-notes").value = entry?.notes || ""; $("entry-strength").textContent = entry ? `Strength: ${entryStrength(entry.password).label}` : "Strength: not checked";
    message("entry-message", ""); $("entry-dialog").showModal();
  }
  function openDeleteDialog(id) { state.deletingId = id; $("confirm-dialog").showModal(); }
  async function submitAuth(kind, form) {
    const values = Object.fromEntries(new FormData(form).entries());
    const body = kind === "login"
      ? { username: values.username, masterPassword: values.masterPassword, remember: $("remember-device").checked }
      : { username: values.username, masterPassword: values.masterPassword, confirmPassword: values.confirmPassword };
    const target = kind === "login" ? "/api/login" : "/api/register";
    const msgId = kind === "login" ? "login-message" : "signup-message";
    message(msgId, "");
    try {
      const result = await api(target, { method: "POST", body: JSON.stringify(body) });
      setCsrf(result.csrf); form.reset(); await openVault(result.username);
    } catch (err) { message(msgId, err.message); }
  }

  loginTab.addEventListener("click", () => setAuthTab("login"));
  signupTab.addEventListener("click", () => setAuthTab("signup"));
  $("login-to-signup").addEventListener("click", () => setAuthTab("signup"));
  $("signup-to-login").addEventListener("click", () => setAuthTab("login"));
  $("login-form").addEventListener("submit", (event) => { event.preventDefault(); submitAuth("login", event.currentTarget); });
  $("signup-form").addEventListener("submit", (event) => { event.preventDefault(); submitAuth("signup", event.currentTarget); });
  $("lock-button").addEventListener("click", async () => {
    try { const result = await api("/api/logout", { method: "POST", body: "{}" }); setCsrf(result.csrf); }
    catch (_) { /* locking the UI remains useful even if the network is unavailable */ }
    state.username = ""; state.entries = []; state.revealed.clear(); showAuth("login");
  });
  $("new-entry-top").addEventListener("click", () => openEntryDialog());
  $("empty-add").addEventListener("click", () => openEntryDialog());
  $("search-entries").addEventListener("input", renderEntries);
  $("checker-password").addEventListener("input", (event) => setStrength(event.target.value));
  $("checker-toggle").addEventListener("click", () => {
    const input = $("checker-password"); input.type = input.type === "password" ? "text" : "password";
    $("checker-toggle").textContent = input.type === "password" ? "Show" : "Hide";
  });
  $("entry-password").addEventListener("input", (event) => { $("entry-strength").textContent = `Strength: ${entryStrength(event.target.value).label}`; });
  $("entry-toggle").addEventListener("click", () => {
    const input = $("entry-password"); input.type = input.type === "password" ? "text" : "password";
    $("entry-toggle").textContent = input.type === "password" ? "Show" : "Hide";
  });
  $("close-dialog").addEventListener("click", () => $("entry-dialog").close());
  $("cancel-entry").addEventListener("click", () => $("entry-dialog").close());
  $("entry-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = { site: $("entry-site").value, url: $("entry-url").value, login: $("entry-login").value, password: $("entry-password").value, notes: $("entry-notes").value };
    const id = state.editingId; const url = id ? `/api/entries/${encodeURIComponent(id)}` : "/api/entries";
    try {
      await api(url, { method: id ? "PUT" : "POST", body: JSON.stringify(payload) });
      $("entry-dialog").close(); await loadEntries();
    } catch (err) { message("entry-message", err.message); }
  });
  $("close-confirm").addEventListener("click", () => $("confirm-dialog").close());
  $("cancel-delete").addEventListener("click", () => $("confirm-dialog").close());
  $("confirm-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    try { await api(`/api/entries/${encodeURIComponent(state.deletingId)}`, { method: "DELETE" }); $("confirm-dialog").close(); await loadEntries(); }
    catch (err) { alert(err.message); }
  });

  (async () => {
    try {
      const result = await api("/api/session", { method: "GET", headers: {} });
      setCsrf(result.csrf);
      if (result.authenticated) await openVault(result.username); else showAuth("login");
    } catch (_) { showAuth("login"); }
  })();
})();
