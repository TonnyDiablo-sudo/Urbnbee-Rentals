/*
 * Piloto automático (Asociado Plus). Puede haber uno por página de búsqueda a la vez (Facebook, Inmuebles24, …);
 * cada uno con su pestaña de trabajo y el tope diario de su página, que cuida el servidor.
 * Lo carga background.js con importScripts, después de collect.js.
 */

/** Corridas activas y terminadas, por id de la pestaña de búsqueda. Sólo este service worker las escribe. */
const runs = {};
const control = {};

async function publishRuns() {
  await chrome.storage.local.set({ autopilotRuns: runs });
  const active = Object.values(runs).filter((r) => r.state === "running");
  if (active.length) {
    await chrome.action.setBadgeText({ text: String(active.reduce((n, r) => n + (r.created || 0), 0)) });
    await chrome.action.setBadgeBackgroundColor({ color: "#6d28d9" });
  }
}

async function setRun(key, patch) {
  runs[key] = { ...(runs[key] || {}), ...patch, updatedAt: Date.now() };
  await publishRuns();
  return runs[key];
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Espera en pedacitos para que «Pausar» responda rápido. */
async function waitOrStop(key, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (control[key]?.stop) return false;
    await sleep(Math.min(1000, end - Date.now()));
  }
  return !control[key]?.stop;
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
  const key = String(searchTabId);
  if (runs[key]?.state === "running") return;
  control[key] = { stop: false };
  const release = holdAwake();
  let workerTabId = null;
  let settings = {};
  const stats = { processed: 0, created: 0, skipped: 0, failed: 0 };
  const finish = async (state, message) => {
    await setRun(key, { state, message, current: null, nextAt: null, ...stats });
    const stillRunning = Object.values(runs).some((r) => r.state === "running");
    if (!stillRunning) {
      const total = Object.values(runs).reduce((n, r) => n + (r.created || 0), 0);
      await chrome.action.setBadgeText({ text: total ? String(total) : "" });
    }
    if (workerTabId && settings.server) chrome.tabs.update(workerTabId, { url: `${settings.server}/asociados` }).catch(() => {});
  };

  try {
    await setRun(key, { state: "running", startedAt: Date.now(), message: "Arrancando…", site: null, ...stats });
    settings = await chrome.storage.local.get(["server", "token"]);
    if (!settings.server || !settings.token) return await finish("error", "Falta configurar la dirección y el token.");

    const searchTab = await chrome.tabs.get(searchTabId);
    const status = await api(settings, `/api/associate/autopilot?url=${encodeURIComponent(searchTab.url || "")}`);
    if (!status.ok) return await finish("error", status.data.error || `Error ${status.status}`);
    if (!status.data.allowed) return await finish("error", "Tu cuenta no es Asociado Plus. Pídele al admin que te la active.");
    const site = status.data.site;
    const busy = Object.entries(runs).find(([k, r]) => k !== key && r.state === "running" && r.site === site);
    if (busy) return await finish("error", `Ya hay un piloto trabajando en ${site}. Usa otra página o páusalo primero.`);
    let remaining = status.data.remaining;
    const delayMs = status.data.minDelaySec * 1000;
    await setRun(key, { site, searchUrl: searchTab.url, dailyLimit: status.data.dailyLimit });
    if (remaining <= 0) return await finish("done", `Ya llegaste al tope de hoy en ${site} (${status.data.dailyLimit}). Sigue mañana o usa otra página.`);

    await setRun(key, { message: "Buscando anuncios en la página…" });
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

    // Sólo la primera vez se pone al frente; después no le quita la pestaña al asociado ni a los otros pilotos.
    const worker = await chrome.tabs.create({ url: "about:blank", active: true, index: searchTab.index + 1, windowId: searchTab.windowId });
    workerTabId = worker.id;
    await setRun(key, { workerTabId });
    let consecutiveFails = 0;
    let rounds = 0;

    while (!control[key].stop && remaining > 0) {
      if (!queue.length) {
        if (++rounds > 4) break;
        await setRun(key, { message: "Buscando más anuncios en los resultados…" });
        const more = await freshLinks(settings, searchTabId, 8, tried);
        queue = more.urls;
        stats.skipped += more.known;
        if (!queue.length) break;
      }
      const url = queue.shift();
      const progress = `${stats.created} creados · quedan ${Math.min(queue.length + 1, remaining)} hoy`;
      await setRun(key, { current: url, message: `Abriendo anuncio… (${progress})`, queued: queue.length });

      await chrome.tabs.update(workerTabId, { url });
      if (!(await waitForTabLoad(workerTabId))) return await finish("stopped", "Cerraste la pestaña del piloto.");
      if (!(await waitOrStop(key, 2500 + Math.random() * 2500))) break;
      await inTab(workerTabId, showAutopilotBar, [`${site} · revisando anuncio · ${progress}`]).catch(() => {});

      const prep = await inTab(workerTabId, prepareListing).catch(() => null);
      if (prep?.blocked) {
        return await finish("stopped", `Me detuve: ${site} pidió iniciar sesión o verificar (${prep.reason}). Resuélvelo a mano y vuelve a iniciar más tarde.`);
      }
      if (control[key].stop) break;
      const page = await inTab(workerTabId, collectPage).catch(() => null);
      stats.processed++;
      if (!page || (page.text || "").trim().length < 40) {
        stats.failed++;
        await setRun(key, { ...stats, message: "Un anuncio no cargó; sigo con el siguiente." });
      } else {
        await inTab(workerTabId, showAutopilotBar, [`${site} · mandando a Cabibee · ${progress}`]).catch(() => {});
        await setRun(key, { message: `Mandando a Cabibee… (${progress})` });
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
          await setRun(key, { ...stats, lastDraftId: result.data.draftId, lastTitle: result.data.title });
        } else if (result.data.code === "duplicate") {
          stats.skipped++;
        } else if (result.data.code === "daily_limit") {
          return await finish("done", result.data.error);
        } else if (result.status === 401 || result.status === 403) {
          return await finish("error", result.data.error || "Sin permiso.");
        } else {
          stats.failed++;
          consecutiveFails++;
          await setRun(key, { ...stats, message: result.data.error || `Error ${result.status}` });
          if (consecutiveFails >= 3) return await finish("error", `Me detuve tras 3 errores seguidos: ${result.data.error || result.status}`);
        }
      }

      if (control[key].stop || remaining <= 0 || (!queue.length && rounds >= 4)) break;
      const wait = delayMs + Math.random() * delayMs * 0.6;
      await setRun(key, { ...stats, current: null, nextAt: Date.now() + wait, message: `Esperando antes del siguiente (${stats.created} creados)…` });
      await inTab(workerTabId, showAutopilotBar, [`${site} · siguiente en ${Math.round(wait / 1000)} s · ${stats.created} creados`]).catch(() => {});
      if (!(await waitOrStop(key, wait))) break;
    }

    if (control[key].stop) return await finish("stopped", `En pausa. Llevas ${stats.created} borradores; están en Inicio → Por revisar.`);
    if (remaining <= 0) return await finish("done", `Llegaste al tope de hoy en ${site}. Revisa los borradores en Inicio → Por revisar.`);
    return await finish("done", "Ya no hay anuncios nuevos en esta búsqueda. Prueba otra búsqueda o ciudad.");
  } catch (e) {
    await finish("error", `Algo falló: ${e.message || e}`);
  } finally {
    delete control[key];
    release();
  }
}

/** Pausa un piloto (por su pestaña de búsqueda o de trabajo) o todos si no se dice cuál. */
function stopAutopilot(tabId) {
  for (const [key, r] of Object.entries(runs)) {
    if (r.state !== "running" || !control[key]) continue;
    if (tabId && String(tabId) !== key && r.workerTabId !== tabId) continue;
    control[key].stop = true;
    setRun(key, { message: "Pausando…" });
  }
}

/** Borra de la lista las corridas que ya terminaron. */
async function clearFinishedRuns() {
  for (const [key, r] of Object.entries(runs)) if (r.state !== "running") delete runs[key];
  await publishRuns();
}

// Si Chrome reinició el service worker a media corrida, esos pilotos ya no siguen: que se vea así.
chrome.storage.local.get("autopilotRuns").then(({ autopilotRuns }) => {
  for (const [key, r] of Object.entries(autopilotRuns || {})) {
    if (runs[key]) continue;
    runs[key] =
      r.state === "running"
        ? { ...r, state: "stopped", message: "Se interrumpió (Chrome reinició la extensión). Dale Iniciar otra vez.", current: null, nextAt: null }
        : r;
  }
  publishRuns();
});
