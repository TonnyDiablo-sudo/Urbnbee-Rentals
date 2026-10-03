import "server-only";
import { findUserById, getHostProfile, listAllListings, listAllUsers } from "@/lib/marketplace-store";
import type { DraftContact } from "@/lib/associate-drafts-store";

export type DuplicateHit = {
  reason: "phone" | "source" | "title";
  hostId: string;
  hostName: string;
  listingId?: string;
  listingTitle?: string;
  listingSlug?: string;
};

/** Últimos 10 dígitos: ignora lada internacional, espacios y guiones. */
export function normalizePhone(raw: string | undefined): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : null;
}

function words(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2)
  );
}

function similarity(a: string, b: string): number {
  const A = words(a);
  const B = words(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / Math.min(A.size, B.size);
}

/** Mismo teléfono, mismo enlace de origen o título casi igual en la misma ciudad. */
export function findDuplicates(input: {
  contact: DraftContact;
  title?: string;
  city?: string;
  sourceUrl?: string;
}): DuplicateHit[] {
  const hits: DuplicateHit[] = [];
  const phones = new Set(
    [normalizePhone(input.contact.phone), normalizePhone(input.contact.whatsapp)].filter(Boolean) as string[]
  );
  const seenHosts = new Set<string>();

  if (phones.size) {
    for (const u of listAllUsers()) {
      const p = getHostProfile(u.id);
      const userPhones = [u.phone, p?.phone, p?.whatsapp].map(normalizePhone).filter(Boolean) as string[];
      if (userPhones.some((x) => phones.has(x))) {
        seenHosts.add(u.id);
        hits.push({ reason: "phone", hostId: u.id, hostName: u.fullName });
      }
    }
  }

  const city = (input.city ?? "").trim().toLowerCase();
  for (const l of listAllListings()) {
    const host = findUserById(l.hostId);
    if (!host) continue;
    if (input.sourceUrl && l.source?.url && l.source.url === input.sourceUrl) {
      hits.push({
        reason: "source",
        hostId: l.hostId,
        hostName: host.fullName,
        listingId: l.id,
        listingTitle: l.title,
        listingSlug: l.slug,
      });
      continue;
    }
    if (input.title && city && l.city.trim().toLowerCase() === city && similarity(input.title, l.title) >= 0.75) {
      hits.push({
        reason: "title",
        hostId: l.hostId,
        hostName: host.fullName,
        listingId: l.id,
        listingTitle: l.title,
        listingSlug: l.slug,
      });
    }
  }
  return hits.slice(0, 8);
}
