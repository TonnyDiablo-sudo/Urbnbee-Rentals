const $ = (id) => document.getElementById(id);

function show(section) {
  $("settings").classList.toggle("hidden", section !== "settings");
  $("import").classList.toggle("hidden", section !== "import");
}

function renderStatus(s, server, boxId = "status") {
  const box = $(boxId);
  if (!s) {
    box.className = "status hidden";
    return;
  }
  box.className = `status ${s.state === "done" ? "ok" : s.state === "error" ? "err" : ""}`;
  box.textContent = "";
  if (s.state === "working") {
    box.textContent = "Analizando con IA… puedes seguir navegando; el ícono mostrará ✓ al terminar.";
  } else if (s.state === "done") {
    box.append(`Listo: “${s.title}” (${s.photos} fotos).\n`);
    const a = document.createElement("a");
    a.href = `${server}/asociados/borradores/${s.draftId}`;
    a.target = "_blank";
    a.textContent = "Revisar y publicar →";
    box.append(a);
  } else {
    box.textContent = s.error || "Algo falló.";
  }
}

function renderAutopilot(ap, server) {
  const running = ap?.state === "running";
  $("ap-start").classList.toggle("hidden", running);
  $("ap-stop").classList.toggle("hidden", !running);
  const box = $("ap-status");
  if (!ap?.state) {
    box.className = "status hidden";
    return;
  }
  box.className = `status ${ap.state === "error" ? "err" : ap.state === "done" ? "ok" : ""}`;
  box.textContent = "";
  const counts = `Creados: ${ap.created || 0} · ya estaban: ${ap.skipped || 0} · fallaron: ${ap.failed || 0}`;
  box.append(`${ap.message || ""}\n${counts}\n`);
  if (ap.created && server) {
    const a = document.createElement("a");
    a.href = `${server}/asociados`;
    a.target = "_blank";
    a.textContent = "Ver borradores por revisar →";
    box.append(a);
  }
}

/** El ZIP que se descarga desde el panel trae la dirección de Cabibee en config.json. */
async function defaultServer() {
  try {
    const res = await fetch(chrome.runtime.getURL("config.json"));
    const { server } = await res.json();
    return typeof server === "string" ? server : "";
  } catch {
    return "";
  }
}

/** La sección del piloto sólo aparece si Cabibee dice que la cuenta es Asociado Plus. */
async function loadAutopilot(server, token) {
  try {
    const res = await fetch(`${server}/api/associate/autopilot`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return;
    const info = await res.json();
    if (!info.allowed) return;
    $("autopilot").classList.remove("hidden");
    $("ap-quota").textContent = `Hoy llevas ${info.usedToday} de ${info.dailyLimit}. Espera mínimo ${info.minDelaySec} s entre anuncios.`;
  } catch {
    /* sin conexión: la sección se queda oculta */
  }
}

async function init() {
  const { server, token, lastImport, autopilot } = await chrome.storage.local.get(["server", "token", "lastImport", "autopilot"]);
  $("server").value = server || (await defaultServer());
  $("token").value = token || "";
  show(server && token ? "import" : "settings");
  renderStatus(lastImport, server);
  renderAutopilot(autopilot, server);
  if (server && token) loadAutopilot(server, token);

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.lastImport) {
      chrome.storage.local.get("server").then(({ server: s }) => renderStatus(changes.lastImport.newValue, s));
      $("go").disabled = changes.lastImport.newValue?.state === "working";
    }
    if (changes.autopilot) {
      chrome.storage.local.get("server").then(({ server: s }) => renderAutopilot(changes.autopilot.newValue, s));
    }
  });
  $("go").disabled = lastImport?.state === "working";
}

$("save").addEventListener("click", async () => {
  const server = $("server").value.trim().replace(/\/+$/, "");
  const token = $("token").value.trim();
  if (!/^https?:\/\//.test(server) || !token.startsWith("cbx_")) {
    renderStatus({ state: "error", error: "Revisa la dirección (https://…) y el token (cbx_…)." }, server, "settings-status");
    return;
  }
  await chrome.storage.local.set({ server, token });
  renderStatus(null, server, "settings-status");
  show("import");
  renderStatus(null);
  loadAutopilot(server, token);
});

$("edit").addEventListener("click", () => show("settings"));

$("go").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !/^https?:/.test(tab.url || "")) {
    renderStatus({ state: "error", error: "Abre la página del anuncio primero." });
    return;
  }
  let page;
  try {
    const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: collectPage });
    page = res?.result;
  } catch (e) {
    renderStatus({ state: "error", error: `No se pudo leer la página: ${e.message || e}` });
    return;
  }
  if (!page) {
    renderStatus({ state: "error", error: "La página no devolvió datos." });
    return;
  }
  $("go").disabled = true;
  chrome.runtime.sendMessage({ type: "import", page, notes: $("notes").value.trim() });
});

$("ap-start").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !/^https?:/.test(tab.url || "")) {
    renderAutopilot({ state: "error", message: "Abre primero una página de resultados de búsqueda." });
    return;
  }
  renderAutopilot({ state: "running", message: "Arrancando…" });
  chrome.runtime.sendMessage({ type: "autopilot-start", tabId: tab.id });
});

$("ap-stop").addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "autopilot-stop" });
});

init();
