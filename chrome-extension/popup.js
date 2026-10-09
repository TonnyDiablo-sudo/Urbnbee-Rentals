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

let currentTabId = null;
let currentServer = "";

/** El piloto de la pestaña abierta y la lista de todos los que hay (uno por página de búsqueda). */
function renderRuns(runs) {
  const mine = currentTabId !== null ? runs?.[String(currentTabId)] : null;
  const running = mine?.state === "running";
  $("ap-start").classList.toggle("hidden", running);
  $("ap-stop").classList.toggle("hidden", !running);

  const box = $("ap-status");
  if (!mine?.state) {
    box.className = "status hidden";
  } else {
    box.className = `status ${mine.state === "error" ? "err" : mine.state === "done" ? "ok" : ""}`;
    box.textContent = "";
    const counts = `Creados: ${mine.created || 0} · ya estaban: ${mine.skipped || 0} · fallaron: ${mine.failed || 0}`;
    box.append(`${mine.site ? `${mine.site}: ` : ""}${mine.message || ""}\n${counts}\n`);
    if (mine.created && currentServer) {
      const a = document.createElement("a");
      a.href = `${currentServer}/asociados`;
      a.target = "_blank";
      a.textContent = "Ver borradores por revisar →";
      box.append(a);
    }
  }

  const list = $("ap-runs");
  list.textContent = "";
  const others = Object.entries(runs || {}).filter(([key]) => key !== String(currentTabId));
  list.classList.toggle("hidden", others.length === 0);
  if (!others.length) return;
  const title = document.createElement("p");
  title.className = "runs-title";
  title.textContent = "Otras páginas";
  list.append(title);
  for (const [key, r] of others) {
    const row = document.createElement("div");
    row.className = "run";
    const label = document.createElement("span");
    const state = r.state === "running" ? "trabajando" : r.state === "done" ? "terminó" : r.state === "stopped" ? "en pausa" : "se detuvo";
    label.textContent = `${r.site || "Página"} · ${state} · ${r.created || 0} creados`;
    label.title = r.message || "";
    row.append(label);
    if (r.state === "running") {
      const btn = document.createElement("button");
      btn.className = "mini";
      btn.textContent = "Pausar";
      btn.addEventListener("click", () => chrome.runtime.sendMessage({ type: "autopilot-stop", tabId: Number(key) }));
      row.append(btn);
    }
    list.append(row);
  }
  if (others.some(([, r]) => r.state !== "running")) {
    const clear = document.createElement("button");
    clear.className = "link";
    clear.textContent = "Quitar los que ya terminaron";
    clear.addEventListener("click", () => chrome.runtime.sendMessage({ type: "autopilot-clear" }));
    list.append(clear);
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
async function loadAutopilot(server, token, tabUrl) {
  try {
    const q = tabUrl && /^https?:/.test(tabUrl) ? `?url=${encodeURIComponent(tabUrl)}` : "";
    const res = await fetch(`${server}/api/associate/autopilot${q}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return;
    const info = await res.json();
    if (!info.allowed) return;
    $("autopilot").classList.remove("hidden");
    $("ap-quota").textContent = info.site
      ? `En ${info.site} llevas ${info.usedToday} de ${info.dailyLimit} hoy. Espera mínimo ${info.minDelaySec} s entre anuncios.`
      : `Cada página tiene su propio tope diario. Espera mínimo ${info.minDelaySec} s entre anuncios.`;
  } catch {
    /* sin conexión: la sección se queda oculta */
  }
}

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTabId = tab?.id ?? null;
  const { server, token, lastImport, autopilotRuns } = await chrome.storage.local.get([
    "server",
    "token",
    "lastImport",
    "autopilotRuns",
  ]);
  currentServer = server || "";
  $("server").value = server || (await defaultServer());
  $("token").value = token || "";
  show(server && token ? "import" : "settings");
  renderStatus(lastImport, server);
  renderRuns(autopilotRuns);
  if (server && token) loadAutopilot(server, token, tab?.url);

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.lastImport) {
      renderStatus(changes.lastImport.newValue, currentServer);
      $("go").disabled = changes.lastImport.newValue?.state === "working";
    }
    if (changes.autopilotRuns) renderRuns(changes.autopilotRuns.newValue);
    if (changes.server) currentServer = changes.server.newValue || "";
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
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  loadAutopilot(server, token, tab?.url);
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
    $("ap-status").className = "status err";
    $("ap-status").textContent = "Abre primero una página de resultados de búsqueda.";
    return;
  }
  chrome.runtime.sendMessage({ type: "autopilot-start", tabId: tab.id });
});

$("ap-stop").addEventListener("click", () => {
  if (currentTabId !== null) chrome.runtime.sendMessage({ type: "autopilot-stop", tabId: currentTabId });
});

init();
