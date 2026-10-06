import "server-only";
import { translateTexts } from "@/lib/content-translate";
import { getListingDetail } from "@/lib/get-listing-detail";
import type { Lang } from "@/lib/i18n";
import type { ListingDetail } from "@/lib/listing-detail-data";

/** El anuncio en el idioma de quien lo ve: título, descripción, reglas, perfil del anfitrión y reseñas. */
export async function localizeListingDetail(d: ListingDetail, lang: Lang, waitMs = 4000): Promise<ListingDetail> {
  const extrasKeys = Object.keys(d.extras ?? {}) as (keyof NonNullable<ListingDetail["extras"]>)[];
  const texts = [
    d.title,
    d.description,
    d.houseRules ?? "",
    d.host.bio ?? "",
    d.host.work ?? "",
    ...extrasKeys.map((k) => d.extras?.[k] ?? ""),
    ...d.reviews.map((r) => r.comment),
  ];
  const out = await translateTexts(texts, lang, { waitMs });
  let i = 0;
  const next = () => out[i++];
  const title = next();
  const description = next();
  const houseRules = next();
  const bio = next();
  const work = next();
  const extras = d.extras ? { ...d.extras } : undefined;
  for (const k of extrasKeys) {
    const v = next();
    if (extras && v) extras[k] = v;
  }
  return {
    ...d,
    title,
    description,
    houseRules: houseRules || undefined,
    host: { ...d.host, bio, work: work || d.host.work },
    extras,
    reviews: d.reviews.map((r) => ({ ...r, comment: next() })),
  };
}

/**
 * El contrato se firma en español; para quien usa otro idioma se agrega una traducción de
 * referencia con un aviso al principio. Sin traducción lista, devuelve undefined.
 */
export async function translatedContractLines(lines: string[], lang: Lang, waitMs = 8000): Promise<string[] | undefined> {
  if (lang === "es" || !lines.length) return undefined;
  const out = await translateTexts(lines, lang, { waitMs });
  const changed = out.filter((x, i) => x !== lines[i]).length;
  if (changed < lines.filter((l) => /\p{L}{3}/u.test(l)).length / 3) return undefined;
  return [
    lang === "en"
      ? "[Automatic translation for reference only. The binding contract is the Spanish original.]"
      : "[Traducción automática de referencia. El contrato válido es el original en español.]",
    "",
    ...out,
  ];
}

/** Mensajes del chat que escribió la otra persona, en el idioma de quien lee; `original` guarda el texto tal cual. */
export async function translateIncoming<T extends { sender: "guest" | "host"; body: string; original?: string }>(
  msgs: T[],
  from: "guest" | "host",
  lang: Lang,
  waitMs = 2500
): Promise<(T & { original?: string })[]> {
  const idx = msgs.flatMap((m, i) => (m.sender === from && m.body.trim() ? [i] : [])).slice(-40);
  if (!idx.length) return msgs;
  const out = await translateTexts(
    idx.map((i) => msgs[i].body),
    lang,
    { waitMs }
  );
  const copy: (T & { original?: string })[] = [...msgs];
  idx.forEach((i, j) => {
    // Si quien mandó ya lo tradujo con el traductor del chat, `original` sigue siendo lo que escribió.
    if (out[j] !== msgs[i].body) copy[i] = { ...msgs[i], body: out[j], original: msgs[i].original ?? msgs[i].body };
  });
  return copy;
}

/**
 * Títulos de las tarjetas en el idioma de quien busca. De paso adelanta en segundo plano la
 * traducción de los primeros anuncios, para que al abrirlos ya esté lista.
 */
export async function localizeCards<T extends { title: string; slug: string }>(
  items: T[],
  lang: Lang,
  waitMs = 1500
): Promise<T[]> {
  if (!items.length) return items;
  const titles = await translateTexts(
    items.map((x) => x.title),
    lang,
    { waitMs }
  );
  const warm = items.slice(0, 12).flatMap((x) => {
    const d = getListingDetail(x.slug);
    return d ? [d.description, d.houseRules ?? ""] : [];
  });
  void translateTexts(warm, lang);
  return items.map((x, i) => (titles[i] === x.title ? x : { ...x, title: titles[i] }));
}
