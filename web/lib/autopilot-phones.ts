import "server-only";
import { autopilotSiteOf } from "@/lib/associate-autopilot";
import { mxDay } from "@/lib/associate-stats";
import {
  getAutopilotPhonesDoc,
  recordAutopilotPhoneUse,
  type AutopilotEmail,
  type AutopilotPhone,
} from "@/lib/autopilot-phones-store";

export const PHONE_COUNTRIES: Record<string, { name: string; digits: number[] }> = {
  "52": { name: "México", digits: [10] },
  "57": { name: "Colombia", digits: [10] },
  "56": { name: "Chile", digits: [9] },
  "593": { name: "Ecuador", digits: [8, 9] },
};
export const MAX_PER_PHONE_DAILY = 50;

/** Una línea por número: «+52 55 8274 1936». Regresa los válidos y las líneas que no se entendieron. */
export function parsePhoneList(text: string): { phones: { country: string; national: string }[]; invalid: string[] } {
  const phones: { country: string; national: string }[] = [];
  const invalid: string[] = [];
  for (const raw of text.split(/\r?\n|,|;/)) {
    const line = raw.trim();
    if (!line) continue;
    const digits = line.replace(/\D/g, "");
    const code = line.startsWith("+") ? ["593", "52", "57", "56"].find((c) => digits.startsWith(c)) : digits.length === 10 ? "52" : undefined;
    const national = code && line.startsWith("+") ? digits.slice(code.length) : digits;
    if (!code || !PHONE_COUNTRIES[code].digits.includes(national.length)) {
      invalid.push(line);
      continue;
    }
    phones.push({ country: code, national });
  }
  return { phones, invalid };
}

export function formatPhone(p: { country: string; national: string }): string {
  return `+${p.country} ${p.national}`;
}

/** País de los formularios de cada página. Las páginas que el piloto conoce son de México. */
export function phoneCountryForUrl(url: string): string | null {
  const site = autopilotSiteOf(url);
  if (site === "Facebook / Marketplace" || site === "Airbnb") return null;
  try {
    const host = new URL(url).hostname;
    if (/\.co$|\.com\.co$/.test(host)) return "57";
    if (/\.cl$/.test(host)) return "56";
    if (/\.ec$|\.com\.ec$/.test(host)) return "593";
  } catch {
    return null;
  }
  return "52";
}

export function phoneUsesToday(): Map<string, number> {
  const today = mxDay(new Date());
  const out = new Map<string, number>();
  for (const u of getAutopilotPhonesDoc().uses) {
    if (mxDay(u.at) !== today) continue;
    for (const id of [u.phoneId, u.emailId]) if (id) out.set(id, (out.get(id) ?? 0) + 1);
  }
  return out;
}

/** «mateo.rivas4827@gmail.com» → «Mateo Rivas». */
export function nameFromEmail(email: string): string {
  return email
    .split("@")[0]
    .replace(/\d+/g, "")
    .split(/[._-]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/** Un correo por renglón; el nombre sale del correo. */
export function parseEmailList(text: string): { emails: { email: string; name: string }[]; invalid: string[] } {
  const emails: { email: string; name: string }[] = [];
  const invalid: string[] = [];
  for (const raw of text.split(/\r?\n|,|;/)) {
    const email = raw.trim().toLowerCase();
    if (!email) continue;
    const name = nameFromEmail(email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !name) invalid.push(raw.trim());
    else emails.push({ email, name });
  }
  return { emails, invalid };
}

export type PhoneLease =
  | { ok: true; phone: { country: string; national: string; e164: string }; name: string; email: string }
  | { ok: false; reason: string };

/**
 * Da la línea del país que menos se ha usado hoy, sin pasar del tope diario por línea,
 * y evita repetir la misma en la misma página dos veces seguidas.
 */
export function leaseAutopilotPhone(opts: { url: string; associateId: string }): PhoneLease {
  const doc = getAutopilotPhonesDoc();
  const country = phoneCountryForUrl(opts.url);
  if (!country) return { ok: false, reason: "Esta página no pide teléfono." };
  const used = phoneUsesToday();
  const site = autopilotSiteOf(opts.url);
  const last = [...doc.uses].reverse().find((u) => u.site === site);
  const leastUsed = <T extends { id: string; active: boolean }>(rows: T[], skip?: string): T | undefined => {
    const free = rows
      .filter((r) => r.active && (used.get(r.id) ?? 0) < doc.perPhoneDaily)
      .sort((a, b) => (used.get(a.id) ?? 0) - (used.get(b.id) ?? 0) || Math.random() - 0.5);
    return free.find((r) => r.id !== skip) ?? free[0];
  };

  // Correo: uno de la lista con su nombre; si no hay libres, el fijo del admin.
  const email: AutopilotEmail | undefined = leastUsed(doc.emails, last?.emailId);
  const identity = email
    ? { name: email.name, email: email.email }
    : doc.formName.trim() && doc.formEmail.trim()
      ? { name: doc.formName.trim(), email: doc.formEmail.trim() }
      : null;
  if (!identity) {
    return {
      ok: false,
      reason: doc.emails.length ? "No quedan correos libres hoy." : "Faltan correos para formularios en Admin → Asociados.",
    };
  }

  const pick: AutopilotPhone | undefined = leastUsed(doc.phones.filter((p) => p.country === country), last?.phoneId);
  if (!pick) return { ok: false, reason: `No quedan líneas de ${PHONE_COUNTRIES[country]?.name ?? country} libres hoy.` };
  recordAutopilotPhoneUse({
    phoneId: pick.id,
    ...(email ? { emailId: email.id } : {}),
    at: new Date().toISOString(),
    site,
    associateId: opts.associateId,
    url: opts.url.slice(0, 500),
  });
  return {
    ok: true,
    phone: { country: pick.country, national: pick.national, e164: `+${pick.country}${pick.national}` },
    ...identity,
  };
}
