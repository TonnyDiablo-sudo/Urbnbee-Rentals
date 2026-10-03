const $ = (id) => document.getElementById(id);

function show(section) {
  $("settings").classList.toggle("hidden", section !== "settings");
  $("import").classList.toggle("hidden", section !== "import");
}

function renderStatus(s, server) {
  const box = $("status");
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

/** Corre dentro de la página: texto visible e imágenes grandes. */
function collectPage() {
  const seen = new Set();
  const images = [];
  const keyOf = (src) => {
    try {
      const u = new URL(src, location.href);
      return u.pathname.split("/").pop() || u.href;
    } catch {
      return src;
    }
  };
  const push = (src, area) => {
    if (!src || !/^https?:/i.test(src)) return;
    const key = keyOf(src);
    if (seen.has(key)) return;
    seen.add(key);
    images.push({ src, area });
  };
  for (const img of Array.from(document.images)) {
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (w >= 250 && h >= 180) push(img.currentSrc || img.src, w * h);
  }
  const og = document.querySelector('meta[property="og:image"]');
  if (og) push(og.getAttribute("content"), Number.MAX_SAFE_INTEGER);
  images.sort((a, b) => b.area - a.area);
  return {
    url: location.href,
    title: document.title,
    text: (document.body.innerText || "").slice(0, 50000),
    images: images.slice(0, 30).map((i) => i.src),
  };
}

async function init() {
  const { server, token, lastImport } = await chrome.storage.local.get(["server", "token", "lastImport"]);
  $("server").value = server || "";
  $("token").value = token || "";
  show(server && token ? "import" : "settings");
  renderStatus(lastImport, server);

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.lastImport) {
      chrome.storage.local.get("server").then(({ server: s }) => renderStatus(changes.lastImport.newValue, s));
      $("go").disabled = changes.lastImport.newValue?.state === "working";
    }
  });
  $("go").disabled = lastImport?.state === "working";
}

$("save").addEventListener("click", async () => {
  const server = $("server").value.trim().replace(/\/+$/, "");
  const token = $("token").value.trim();
  if (!/^https?:\/\//.test(server) || !token.startsWith("cbx_")) {
    renderStatus({ state: "error", error: "Revisa la dirección (https://…) y el token (cbx_…)." });
    return;
  }
  await chrome.storage.local.set({ server, token });
  show("import");
  renderStatus(null);
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

init();
