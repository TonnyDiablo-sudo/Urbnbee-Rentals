importScripts("collect.js");

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

async function setStatus(status) {
  await chrome.storage.local.set({ lastImport: status });
  const badge = status.state === "working" ? "…" : status.state === "done" ? "✓" : "!";
  await chrome.action.setBadgeText({ text: badge });
  await chrome.action.setBadgeBackgroundColor({
    color: status.state === "error" ? "#c62828" : status.state === "done" ? "#1e7a3a" : "#dcb81e",
  });
}

/** Las imágenes las baja la extensión: el servidor nunca abre URLs ajenas. */
async function downloadImages(urls) {
  const out = [];
  for (const url of urls) {
    try {
      const res = await fetch(url, { credentials: "omit" });
      if (!res.ok) continue;
      const blob = await res.blob();
      if (!blob.type.startsWith("image/") || blob.size > MAX_IMAGE_BYTES || blob.size < 5000) continue;
      out.push(blob);
    } catch {
      /* imagen caída: se ignora */
    }
  }
  return out;
}

/** Manda la página a Cabibee. Regresa { ok, status, data } y nunca lanza por errores HTTP. */
async function sendPage({ server, token }, page, { notes, autopilot } = {}) {
  const images = await downloadImages(page.images || []);
  const form = new FormData();
  form.set("url", page.url);
  form.set("title", page.title || "");
  form.set("text", page.text || "");
  if (page.links?.length) form.set("links", page.links.join("\n"));
  if (notes) form.set("notes", notes);
  if (autopilot) form.set("autopilot", "1");
  images.forEach((blob, i) => form.append("images", blob, `img-${i}.${(blob.type.split("/")[1] || "jpg").split(";")[0]}`));
  const res = await fetch(`${server}/api/associate/capture`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

// El service worker se duerme a los 30 s sin actividad; el análisis con IA y el piloto tardan más.
let keepAliveUsers = 0;
let keepAliveTimer = null;
function holdAwake() {
  keepAliveUsers++;
  if (!keepAliveTimer) keepAliveTimer = setInterval(() => chrome.runtime.getPlatformInfo(), 20000);
  return () => {
    keepAliveUsers--;
    if (keepAliveUsers <= 0 && keepAliveTimer) {
      clearInterval(keepAliveTimer);
      keepAliveTimer = null;
      keepAliveUsers = 0;
    }
  };
}

async function runImport({ page, notes }) {
  const settings = await chrome.storage.local.get(["server", "token"]);
  if (!settings.server || !settings.token) {
    await setStatus({ state: "error", error: "Falta configurar la dirección y el token." });
    return;
  }
  await setStatus({ state: "working" });
  const release = holdAwake();
  try {
    const { ok, status, data } = await sendPage(settings, page, { notes });
    if (!ok) {
      await setStatus({ state: "error", error: data.error || `Error ${status}` });
      return;
    }
    await setStatus({ state: "done", draftId: data.draftId, title: data.title, photos: data.photos });
  } catch (e) {
    await setStatus({ state: "error", error: `Sin conexión con Cabibee: ${e.message || e}` });
  } finally {
    release();
  }
}

/* ───────────── Piloto automático (Asociado Plus) ───────────── */

let autopilotRunning = false;
let stopRequested = false;

async function setAutopilot(patch) {
  const { autopilot = {} } = await chrome.storage.local.get("autopilot");
  const next = { ...autopilot, ...patch, updatedAt: Date.now() };
  await chrome.storage.local.set({ autopilot: next });
  if (next.state === "running") {
    await chrome.action.setBadgeText({ text: String(next.created || 0) });
    await chrome.action.setBadgeBackgroundColor({ color: "#6d28d9" });
  }
  return next;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Espera en pedacitos para que «Pausar» responda rápido. */
async function waitOrStop(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (stopRequested) return false;
    await sleep(Math.min(1000, end - Date.now()));
  }
  return !stopRequested;
}

function waitForTabLoad(tabId, timeoutMs = 45000) {
  return new Promise((resolve) => {
    const done = (ok) => {
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      chrome.tabs.onRemoved.removeListener(onRemoved);
      resolve(ok);
    };
    const onUpdated = (id, info) => {
      if (id === tabId && info.status === "complete") done(true);
    };
    const onRemoved = (id) => {
      if (id === tabId) done(false);
    };
    const timer = setTimeout(() => done(true), timeoutMs);
    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.onRemoved.addListener(onRemoved);
  });
}

async function inTab(tabId, func, args = []) {
  const [res] = await chrome.scripting.executeScript({ target: { tabId }, func, args });
  return res?.result;
}

async function api(settings, path, init = {}) {
  const res = await fetch(`${settings.server}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${settings.token}`, ...(init.body ? { "Content-Type": "application/json" } : {}) },
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function freshLinks(settings, searchTabId, scrolls, tried) {
  const found = await inTab(searchTabId, collectListingLinks, [scrolls]);
  const urls = (found?.urls || []).filter((u) => !tried.has(u));
  if (!urls.length) return { urls: [], known: 0 };
  const { ok, data } = await api(settings, "/api/associate/autopilot", { method: "POST", body: JSON.stringify({ urls }) });
  const fresh = ok ? data.fresh || [] : [];
  if (ok) urls.forEach((u) => tried.add(u));
  return { urls: fresh, known: ok ? urls.length - fresh.length : 0 };
}

async function runAutopilot(searchTabId) {
  if (autopilotRunning) return;
  autopilotRunning = true;
  stopRequested = false;
  const release = holdAwake();
  let workerTabId = null;
  const stats = { processed: 0, created: 0, skipped: 0, failed: 0 };
  const finish = async (state, message) => {
    await setAutopilot({ state, message, current: null, nextAt: null, ...stats });
    await chrome.action.setBadgeText({ text: stats.created ? String(stats.created) : "" });
    if (workerTabId && settings.server) chrome.tabs.update(workerTabId, { url: `${settings.server}/asociados` }).catch(() => {});
  };
  let settings = {};

  try {
    settings = await chrome.storage.local.get(["server", "token"]);
    if (!settings.server || !settings.token) return await finish("error", "Falta configurar la dirección y el token.");

    const status = await api(settings, "/api/associate/autopilot");
    if (!status.ok) return await finish("error", status.data.error || `Error ${status.status}`);
    if (!status.data.allowed) return await finish("error", "Tu cuenta no es Asociado Plus. Pídele al admin que te la active.");
    let remaining = status.data.remaining;
    const delayMs = status.data.minDelaySec * 1000;
    if (remaining <= 0) return await finish("done", `Ya llegaste al tope de hoy (${status.data.dailyLimit}). Sigue mañana.`);

    const searchTab = await chrome.tabs.get(searchTabId);
    await setAutopilot({ state: "running", startedAt: Date.now(), searchUrl: searchTab.url, message: "Buscando anuncios en la página…", ...stats });

    const tried = new Set();
    const first = await freshLinks(settings, searchTabId, 6, tried);
    let queue = first.urls;
    stats.skipped += first.known;
    if (!queue.length) {
      return await finish(
        "error",
        "No encontré anuncios nuevos en esta página. Abre una búsqueda (por ejemplo Marketplace → Propiedades en alquiler) y vuelve a intentar."
      );
    }

    const worker = await chrome.tabs.create({ url: "about:blank", active: true, index: searchTab.index + 1, windowId: searchTab.windowId });
    workerTabId = worker.id;
    let consecutiveFails = 0;
    let rounds = 0;

    while (!stopRequested && remaining > 0) {
      if (!queue.length) {
        if (++rounds > 4) break;
        await setAutopilot({ message: "Buscando más anuncios en los resultados…" });
        const more = await freshLinks(settings, searchTabId, 8, tried);
        queue = more.urls;
        stats.skipped += more.known;
        if (!queue.length) break;
      }
      const url = queue.shift();
      const progress = `${stats.created} creados · quedan ${Math.min(queue.length + 1, remaining)} hoy`;
      await setAutopilot({ current: url, message: `Abriendo anuncio… (${progress})`, queued: queue.length });

      await chrome.tabs.update(workerTabId, { url, active: true });
      if (!(await waitForTabLoad(workerTabId))) return await finish("stopped", "Cerraste la pestaña del piloto.");
      if (!(await waitOrStop(2500 + Math.random() * 2500))) break;
      await inTab(workerTabId, showAutopilotBar, [`revisando anuncio · ${progress}`]).catch(() => {});

      const prep = await inTab(workerTabId, prepareListing).catch(() => null);
      if (prep?.blocked) {
        return await finish("stopped", `Me detuve: el sitio pidió iniciar sesión o verificar (${prep.reason}). Resuélvelo a mano y vuelve a iniciar más tarde.`);
      }
      if (stopRequested) break;
      const page = await inTab(workerTabId, collectPage).catch(() => null);
      stats.processed++;
      if (!page || (page.text || "").trim().length < 40) {
        stats.failed++;
        await setAutopilot({ ...stats, message: "Un anuncio no cargó; sigo con el siguiente." });
      } else {
        await inTab(workerTabId, showAutopilotBar, [`mandando a Cabibee · ${progress}`]).catch(() => {});
        await setAutopilot({ message: `Mandando a Cabibee… (${progress})` });
        let result;
        try {
          result = await sendPage(settings, page, { autopilot: true });
        } catch (e) {
          result = { ok: false, status: 0, data: { error: `Sin conexión con Cabibee: ${e.message || e}` } };
        }
        if (result.ok) {
          stats.created++;
          remaining--;
          consecutiveFails = 0;
          await setAutopilot({ ...stats, lastDraftId: result.data.draftId, lastTitle: result.data.title });
        } else if (result.data.code === "duplicate") {
          stats.skipped++;
        } else if (result.data.code === "daily_limit") {
          return await finish("done", result.data.error);
        } else if (result.status === 401 || result.status === 403) {
          return await finish("error", result.data.error || "Sin permiso.");
        } else {
          stats.failed++;
          consecutiveFails++;
          await setAutopilot({ ...stats, message: result.data.error || `Error ${result.status}` });
          if (consecutiveFails >= 3) return await finish("error", `Me detuve tras 3 errores seguidos: ${result.data.error || result.status}`);
        }
      }

      if (stopRequested || remaining <= 0 || (!queue.length && rounds >= 4)) break;
      const wait = delayMs + Math.random() * delayMs * 0.6;
      await setAutopilot({ ...stats, current: null, nextAt: Date.now() + wait, message: `Esperando antes del siguiente (${stats.created} creados)…` });
      await inTab(workerTabId, showAutopilotBar, [`siguiente en ${Math.round(wait / 1000)} s · ${stats.created} creados`]).catch(() => {});
      if (!(await waitOrStop(wait))) break;
    }

    if (stopRequested) return await finish("stopped", `En pausa. Llevas ${stats.created} borradores; están en Inicio → Por revisar.`);
    if (remaining <= 0) return await finish("done", "Llegaste al tope de hoy. Revisa los borradores en Inicio → Por revisar.");
    return await finish("done", "Ya no hay anuncios nuevos en esta búsqueda. Prueba otra búsqueda o ciudad.");
  } catch (e) {
    await finish("error", `Algo falló: ${e.message || e}`);
  } finally {
    autopilotRunning = false;
    release();
  }
}

// Si Chrome reinició el service worker a media corrida, el piloto ya no sigue: que se vea así.
chrome.storage.local.get("autopilot").then(({ autopilot }) => {
  if (autopilot?.state === "running" && !autopilotRunning) {
    setAutopilot({ state: "stopped", message: "Se interrumpió (Chrome reinició la extensión). Dale Iniciar otra vez.", current: null, nextAt: null });
  }
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "import") runImport(msg);
  if (msg?.type === "autopilot-start" && msg.tabId) runAutopilot(msg.tabId);
  if (msg?.type === "autopilot-stop") {
    stopRequested = true;
    if (autopilotRunning) setAutopilot({ message: "Pausando…" });
  }
});
