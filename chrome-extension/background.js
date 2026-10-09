importScripts("collect.js", "autopilot.js");

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

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg?.type === "import") runImport(msg);
  if (msg?.type === "autopilot-start" && msg.tabId) runAutopilot(msg.tabId);
  // La barra de la pestaña del piloto pausa sólo ese piloto; el popup manda el id o pausa todos.
  if (msg?.type === "autopilot-stop") stopAutopilot(msg.tabId ?? sender.tab?.id);
  if (msg?.type === "autopilot-clear") clearFinishedRuns();
});

