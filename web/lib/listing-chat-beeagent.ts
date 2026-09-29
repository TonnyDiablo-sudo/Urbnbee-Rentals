import "server-only";
import { getBeeagentLinkForHost } from "@/lib/beeagent-host-link-store";
import { getPartnerApiSecret } from "@/lib/beeagent-partner";
import type { HostListingRecord } from "@/lib/marketplace-types";

const TIMEOUT_MS = 12_000;

export function beeagentPublicOrigin(): string {
  const raw =
    process.env.URBNBEEAI_API_URL?.trim() ||
    process.env.URBNBEEAI_ORIGIN?.trim() ||
    "https://www.urbnbeeai.com";
  return raw.replace(/\/+$/, "");
}

export function listingHasBeeagent(hostId: string): boolean {
  return Boolean(getBeeagentLinkForHost(hostId));
}

function pickReply(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  const o = data as Record<string, unknown>;
  for (const key of ["reply", "message", "text", "answer"]) {
    const v = o[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  const nested = o.data;
  if (nested && typeof nested === "object") {
    const inner = (nested as Record<string, unknown>).reply;
    if (typeof inner === "string" && inner.trim()) return inner.trim();
  }
  return undefined;
}

function sanitizeSessionId(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const t = raw.trim().slice(0, 80);
  if (!/^[\w.-]{8,80}$/.test(t)) return "";
  return t;
}

/**
 * Pregunta al agente del anfitrión en urbnbeeai.com.
 * Si no hay enlace, el endpoint no existe todavía, o BeeAgent no responde: null.
 */
export async function tryBeeagentListingChat(input: {
  listing: HostListingRecord;
  message: string;
  sessionId?: unknown;
}): Promise<{ reply: string } | null> {
  const link = getBeeagentLinkForHost(input.listing.hostId);
  if (!link) return null;

  const sessionId = sanitizeSessionId(input.sessionId) || `anon_${input.listing.id}`;
  const conversationKey = `web:listing:${input.listing.slug}:${sessionId}`;
  const origin = beeagentPublicOrigin();
  const url = `${origin}/api/public/marketplace-chat`;
  const secret = getPartnerApiSecret();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
      },
      body: JSON.stringify({
        listing_id: input.listing.id,
        listing_slug: input.listing.slug,
        host_id: input.listing.hostId,
        beeagent_customer_id: link.beeagentCustomerId,
        session_id: sessionId,
        conversation_key: conversationKey,
        message: input.message.trim().slice(0, 2000),
        listing: {
          title: input.listing.title,
          city: input.listing.city,
          zone: input.listing.zone,
          country: input.listing.country,
          pricePerNight: input.listing.pricePerNight,
          guests: input.listing.guests,
        },
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.info("[chat] beeagent no disponible", res.status);
      return null;
    }
    const data: unknown = await res.json().catch(() => null);
    const reply = pickReply(data);
    if (!reply) return null;
    return { reply };
  } catch (e) {
    console.info("[chat] beeagent error", e instanceof Error ? e.message : e);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
