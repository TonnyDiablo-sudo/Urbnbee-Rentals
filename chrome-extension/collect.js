/*
 * Funciones que se inyectan en la página con chrome.scripting.executeScript.
 * Cada una debe ser autocontenida: no puede usar nada de fuera de su propio cuerpo.
 */

/** Texto visible, imágenes grandes y enlaces de contacto del anuncio abierto. */
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
  // Fotos que el piloto automático vio al pasar la galería y ya no están en pantalla.
  for (const src of window.__cabibeeSeenImages || []) push(src, 1);
  const og = document.querySelector('meta[property="og:image"]');
  if (og) push(og.getAttribute("content"), Number.MAX_SAFE_INTEGER);
  images.sort((a, b) => b.area - a.area);

  // Enlaces de contacto: perfil de quien publica, WhatsApp, teléfono y correo.
  const links = [];
  const linkSeen = new Set();
  const CONTACT = /^(tel:|mailto:)|wa\.me\/|api\.whatsapp\.com|facebook\.com\/(profile\.php|people\/|marketplace\/profile\/|[A-Za-z0-9.]{5,}\/?$)|instagram\.com\//i;
  for (const a of Array.from(document.querySelectorAll("a[href]"))) {
    const href = a.href || "";
    if (!CONTACT.test(href)) continue;
    const label = (a.innerText || a.getAttribute("aria-label") || "").trim().replace(/\s+/g, " ").slice(0, 80);
    const line = label ? `${label} → ${href}` : href;
    if (linkSeen.has(href)) continue;
    linkSeen.add(href);
    links.push(line.slice(0, 400));
    if (links.length >= 60) break;
  }

  return {
    url: location.href,
    title: document.title,
    text: (document.body.innerText || "").slice(0, 50000),
    links,
    images: images.slice(0, 30).map((i) => i.src),
  };
}

/** En una página de resultados: baja poco a poco para que carguen más y junta los links de anuncios. */
async function collectListingLinks(scrolls) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const PATTERNS = [
    [/facebook\.com\/marketplace\/item\/(\d+)/, (m) => `https://www.facebook.com/marketplace/item/${m[1]}/`],
    [/inmuebles24\.com\/propiedades\/[^?#]+\.html/, null],
    [/vivanuncios\.com\.mx\/a-[^?#]+/, null],
    [/lamudi\.com\.mx\/detalle\/[^?#]+/, null],
    [/propiedades\.com\/inmuebles\/[^?#]+/, null],
    [/casasyterrenos\.com\/propiedad\/[^?#]+/, null],
    [/mercadolibre\.com\.mx\/MLM-?\d+[^?#]*/i, null],
    [/airbnb\.[a-z.]+\/rooms\/(\d+)/, null],
  ];
  const found = new Map();
  const grab = () => {
    for (const a of Array.from(document.querySelectorAll("a[href]"))) {
      const href = a.href || "";
      for (const [re, canon] of PATTERNS) {
        const m = href.match(re);
        if (!m) continue;
        const url = canon ? canon(m) : href.split("#")[0];
        const key = m[1] || m[0];
        if (!found.has(key)) found.set(key, url);
        break;
      }
    }
  };
  grab();
  for (let i = 0; i < scrolls; i++) {
    window.scrollBy({ top: Math.round(window.innerHeight * (0.7 + Math.random() * 0.5)), behavior: "smooth" });
    await sleep(1400 + Math.random() * 1200);
    grab();
  }
  return { urls: Array.from(found.values()), site: location.hostname };
}

/**
 * En el anuncio: baja por la página y pasa la galería con el botón «siguiente» para que carguen las fotos.
 * También avisa si la página es un inicio de sesión o un bloqueo, para que el piloto se detenga.
 */
async function prepareListing() {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const BLOCKED =
    /bloquead[oa] temporalmente|temporarily blocked|you'?re temporarily|confirma que eres (una persona|humano)|confirm (that )?you'?re (a )?human|not a robot|no soy un robot|captcha|checkpoint|inicia sesión para continuar|log in to continue/i;
  if (/\/(login|checkpoint|challenge)/i.test(location.pathname)) return { blocked: true, reason: location.pathname };
  const head = (document.body.innerText || "").slice(0, 3000);
  if (BLOCKED.test(head)) return { blocked: true, reason: head.match(BLOCKED)[0] };

  const seen = (window.__cabibeeSeenImages = window.__cabibeeSeenImages || []);
  const note = () => {
    let added = 0;
    for (const img of Array.from(document.images)) {
      if (img.naturalWidth < 250 || img.naturalHeight < 180) continue;
      const src = img.currentSrc || img.src;
      if (!/^https?:/i.test(src) || seen.includes(src)) continue;
      seen.push(src);
      added++;
    }
    return added;
  };

  for (let i = 0; i < 4; i++) {
    window.scrollBy({ top: Math.round(window.innerHeight * (0.5 + Math.random() * 0.4)), behavior: "smooth" });
    await sleep(900 + Math.random() * 900);
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
  await sleep(800);
  note();

  const NEXT = /siguiente|next/i;
  const nextButton = () =>
    Array.from(document.querySelectorAll('[aria-label], button, [role="button"]')).find((el) => {
      const label = el.getAttribute("aria-label") || "";
      if (!NEXT.test(label)) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.top < window.innerHeight && r.bottom > 0;
    });
  let idle = 0;
  for (let i = 0; i < 25 && idle < 3; i++) {
    const btn = nextButton();
    if (!btn) break;
    btn.click();
    await sleep(900 + Math.random() * 800);
    idle = note() ? 0 : idle + 1;
  }
  return { blocked: false, photos: seen.length };
}

/** Barra fija en la pestaña del piloto: deja ver qué está haciendo y pausarlo con un clic. */
function showAutopilotBar(text) {
  let bar = document.getElementById("__cabibee_autopilot");
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "__cabibee_autopilot";
    bar.style.cssText =
      "position:fixed;z-index:2147483647;right:16px;bottom:16px;display:flex;gap:10px;align-items:center;padding:10px 12px;border-radius:10px;background:#111;color:#fff;font:13px/1.3 system-ui,sans-serif;box-shadow:0 4px 18px rgba(0,0,0,.35);max-width:360px";
    const label = document.createElement("span");
    label.className = "__label";
    const btn = document.createElement("button");
    btn.textContent = "Pausar";
    btn.style.cssText = "border:0;border-radius:6px;padding:6px 10px;background:#dcb81e;color:#111;font-weight:600;cursor:pointer";
    btn.addEventListener("click", () => {
      btn.disabled = true;
      btn.textContent = "Pausando…";
      chrome.runtime.sendMessage({ type: "autopilot-stop" });
    });
    bar.append(label, btn);
    document.documentElement.append(bar);
  }
  bar.querySelector(".__label").textContent = `🐝 Piloto automático de Cabibee · ${text}`;
}
