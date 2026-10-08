import "server-only";
import { fetchPublicResource } from "@/lib/public-page-fetch";

const MAX_HTML = 4 * 1024 * 1024;
const MAX_IMAGE = 10 * 1024 * 1024;
const MAX_IMAGES = 20;

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decode(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (all, code: string) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : all;
    }
    return ENTITIES[code.toLowerCase()] ?? all;
  });
}

function attr(tag: string, name: string): string | undefined {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  const v = m?.[2] ?? m?.[3] ?? m?.[4];
  return v === undefined ? undefined : decode(v);
}

function meta(html: string, key: string): string | undefined {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    if ((attr(tag, "property") ?? attr(tag, "name"))?.toLowerCase() === key) return attr(tag, "content");
  }
  return undefined;
}

function visibleText(html: string): string {
  return decode(
    html
      .replace(/<(script|style|noscript|svg|template|iframe)\b[\s\S]*?<\/\1>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/section|\/article|\/header|\/footer)\b[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** JSON-LD suele traer el anuncio completo (precio, dirección, fotos) aunque el HTML sea un SPA. */
function jsonLd(html: string): { text: string; images: string[] } {
  const blocks: string[] = [];
  const images: string[] = [];
  const collect = (v: unknown) => {
    if (typeof v === "string") images.push(v);
    else if (Array.isArray(v)) v.forEach(collect);
    else if (v && typeof v === "object" && typeof (v as { url?: unknown }).url === "string") images.push((v as { url: string }).url);
  };
  const walk = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") {
      for (const [k, val] of Object.entries(v)) {
        if (k === "image" || k === "photo") collect(val);
        else walk(val);
      }
    }
  };
  for (const m of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(m[1].trim());
      walk(data);
      blocks.push(JSON.stringify(data).slice(0, 8000));
    } catch {
      /* JSON-LD roto: se ignora */
    }
  }
  return { text: blocks.join("\n"), images };
}

const CONTACT = /^(tel:|mailto:)|wa\.me\/|api\.whatsapp\.com|facebook\.com\/(profile\.php|people\/|marketplace\/profile\/)|instagram\.com\//i;

function contactLinks(html: string, base: string): string[] {
  const out = new Set<string>();
  for (const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = attr(m[1], "href");
    if (!href) continue;
    let abs: string;
    try {
      abs = new URL(href, base).toString();
    } catch {
      continue;
    }
    if (!CONTACT.test(abs)) continue;
    const label = visibleText(m[2]).replace(/\s+/g, " ").slice(0, 80);
    out.add((label ? `${label} → ${abs}` : abs).slice(0, 400));
    if (out.size >= 60) break;
  }
  return [...out];
}

function imageCandidates(html: string, base: string, extra: string[]): string[] {
  const raw: string[] = [];
  const og = meta(html, "og:image") ?? meta(html, "twitter:image");
  if (og) raw.push(og);
  raw.push(...extra);
  for (const tag of html.match(/<img\b[^>]*>/gi) ?? []) {
    const srcset = attr(tag, "srcset") ?? attr(tag, "data-srcset");
    const best = srcset
      ?.split(",")
      .map((s) => s.trim().split(/\s+/)[0])
      .filter(Boolean)
      .pop();
    const src = best ?? attr(tag, "data-src") ?? attr(tag, "data-lazy-src") ?? attr(tag, "src");
    if (!src || src.startsWith("data:")) continue;
    const w = Number(attr(tag, "width"));
    const h = Number(attr(tag, "height"));
    if ((w && w < 200) || (h && h < 150)) continue;
    if (/sprite|logo|icon|avatar|pixel|tracking|badge|flag/i.test(src)) continue;
    raw.push(src);
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const src of raw) {
    let abs: string;
    try {
      abs = new URL(src, base).toString();
    } catch {
      continue;
    }
    if (!/^https?:/i.test(abs) || /\.svg(\?|$)/i.test(abs)) continue;
    const key = new URL(abs).pathname;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(abs);
    if (out.length >= MAX_IMAGES * 2) break;
  }
  return out;
}

async function downloadImages(urls: string[]): Promise<Buffer[]> {
  const out: Buffer[] = [];
  for (let i = 0; i < urls.length && out.length < MAX_IMAGES; i += 6) {
    const batch = await Promise.all(
      urls.slice(i, i + 6).map((u) =>
        fetchPublicResource(u, { maxBytes: MAX_IMAGE, timeoutMs: 15_000, accept: "image/*" })
          .then((r) => (r.contentType.startsWith("image/") && r.body.length > 8_000 ? r.body : null))
          .catch(() => null)
      )
    );
    for (const b of batch) if (b && out.length < MAX_IMAGES) out.push(b);
  }
  return out;
}

export type FetchedListingPage = {
  url: string;
  title: string;
  text: string;
  links: string[];
  images: Buffer[];
};

/** Lo mismo que manda la extensión, pero leído por el servidor desde un link público. */
export async function fetchListingPage(raw: string): Promise<{ ok: true; page: FetchedListingPage } | { ok: false; error: string }> {
  try {
    const res = await fetchPublicResource(raw, { maxBytes: MAX_HTML, timeoutMs: 20_000 });
    if (!res.contentType.includes("html")) return { ok: false, error: "Ese link no es una página de anuncio." };
    const html = res.body.toString("utf8");
    const ld = jsonLd(html);
    const title = decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").trim();
    const metaText = [meta(html, "og:title"), meta(html, "og:description") ?? meta(html, "description")]
      .filter(Boolean)
      .join("\n");
    const text = [metaText, visibleText(html), ld.text ? `Datos estructurados:\n${ld.text}` : ""]
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 60_000);
    return {
      ok: true,
      page: {
        url: res.url,
        title: title.slice(0, 300),
        text,
        links: contactLinks(html, res.url),
        images: await downloadImages(imageCandidates(html, res.url, ld.images)),
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo abrir el link." };
  }
}
