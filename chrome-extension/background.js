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

async function runImport({ page, notes }) {
  const { server, token } = await chrome.storage.local.get(["server", "token"]);
  if (!server || !token) {
    await setStatus({ state: "error", error: "Falta configurar la dirección y el token." });
    return;
  }
  await setStatus({ state: "working" });
  // El service worker se duerme a los 30 s sin actividad; el análisis con IA tarda más.
  const keepAlive = setInterval(() => chrome.runtime.getPlatformInfo(), 20000);
  try {
    const images = await downloadImages(page.images || []);
    const form = new FormData();
    form.set("url", page.url);
    form.set("title", page.title || "");
    form.set("text", page.text || "");
    if (page.links?.length) form.set("links", page.links.join("\n"));
    if (notes) form.set("notes", notes);
    images.forEach((blob, i) => form.append("images", blob, `img-${i}.${(blob.type.split("/")[1] || "jpg").split(";")[0]}`));

    const res = await fetch(`${server}/api/associate/capture`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      await setStatus({ state: "error", error: data.error || `Error ${res.status}` });
      return;
    }
    await setStatus({ state: "done", draftId: data.draftId, title: data.title, photos: data.photos });
  } catch (e) {
    await setStatus({ state: "error", error: `Sin conexión con Cabibee: ${e.message || e}` });
  } finally {
    clearInterval(keepAlive);
  }
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "import") runImport(msg);
});
