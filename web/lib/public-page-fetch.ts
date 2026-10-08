import "server-only";
import { lookup } from "dns/promises";
import { isIP } from "net";

/**
 * Abre páginas públicas que pega un asociado. Cualquier URL que manda un usuario puede
 * apuntar a la red interna, así que cada salto (incluidas redirecciones) se valida:
 * sólo http(s), puertos estándar y direcciones IP públicas.
 */

const MAX_REDIRECTS = 4;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36 CabibeeImport/1.0";

function privateV4(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function privateIp(ip: string): boolean {
  if (isIP(ip) === 4) return privateV4(ip);
  const v6 = ip.toLowerCase();
  const mapped = v6.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return privateV4(mapped[1]);
  return v6 === "::" || v6 === "::1" || /^f[cd]/.test(v6) || /^fe[89ab]/.test(v6) || v6.startsWith("ff");
}

async function assertPublicUrl(raw: string): Promise<URL> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error("El link no es válido.");
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error("El link debe empezar con https://");
  if (u.username || u.password) throw new Error("El link no es válido.");
  if (u.port && u.port !== "80" && u.port !== "443") throw new Error("El link no es válido.");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (/^localhost$|\.local$|\.internal$/i.test(host)) throw new Error("El link no es válido.");
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  if (!addrs.length) throw new Error("No existe esa página.");
  if (addrs.some((a) => privateIp(a.address))) throw new Error("El link no es válido.");
  return u;
}

async function readLimited(res: Response, maxBytes: number): Promise<Buffer> {
  const len = Number(res.headers.get("content-length"));
  if (Number.isFinite(len) && len > maxBytes) throw new Error("La página es demasiado grande.");
  const reader = res.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error("La página es demasiado grande.");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

export type FetchedResource = { url: string; contentType: string; body: Buffer };

export async function fetchPublicResource(
  raw: string,
  opts: { maxBytes: number; timeoutMs?: number; accept?: string }
): Promise<FetchedResource> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 15_000);
  try {
    let current = raw;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const u = await assertPublicUrl(current);
      const res = await fetch(u, {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "User-Agent": UA,
          Accept: opts.accept ?? "text/html,application/xhtml+xml",
          "Accept-Language": "es-MX,es;q=0.9,en;q=0.6",
        },
      });
      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        current = new URL(res.headers.get("location")!, u).toString();
        continue;
      }
      if (res.status === 401 || res.status === 403 || res.status === 429) {
        throw new Error("Ese sitio no deja que Cabibee lo abra.");
      }
      if (res.status === 404 || res.status === 410) throw new Error("El anuncio ya no existe en ese sitio.");
      if (!res.ok) throw new Error(`La página respondió ${res.status}.`);
      return {
        url: u.toString(),
        contentType: (res.headers.get("content-type") ?? "").toLowerCase(),
        body: await readLimited(res, opts.maxBytes),
      };
    }
    throw new Error("La página redirige demasiadas veces.");
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") throw new Error("La página tardó demasiado en responder.");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
