import "server-only";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import {
  createUser,
  findUserByEmail,
  findUserById,
  listListingsForHost,
  setUserRole,
  upsertHostProfile,
} from "@/lib/marketplace-store";
import {
  getBeeagentLinkForCustomer,
  upsertBeeagentHostLink,
  consumeLinkCode,
} from "@/lib/beeagent-host-link-store";

function parseCustomerId(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.trim()) : NaN;
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) return null;
  return n;
}

function parseEmail(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const email = v.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

async function ensureHostUser(input: {
  email: string;
  fullName: string;
  phone?: string;
}): Promise<{ userId: string; created: boolean }> {
  const existing = findUserByEmail(input.email);
  if (existing) {
    if (existing.role === "host" || existing.role === "admin") {
      upsertHostProfile(existing.id, {
        phone: input.phone,
        email: input.email,
      });
      return { userId: existing.id, created: false };
    }
    if (existing.role === "guest") {
      const upgraded = setUserRole(existing.id, "host");
      if (!upgraded) throw new Error("UPGRADE_FAILED");
      upsertHostProfile(upgraded.id, {
        phone: input.phone ?? upgraded.phone,
        email: input.email,
      });
      return { userId: upgraded.id, created: false };
    }
    throw new Error("EMAIL_NOT_HOST_ELIGIBLE");
  }

  const passwordHash = await bcrypt.hash(randomBytes(32).toString("hex"), 11);
  const user = createUser({
    email: input.email,
    passwordHash,
    fullName: input.fullName.trim() || "Anfitrión Urbnbee",
    phone: input.phone,
    role: "host",
  });
  return { userId: user.id, created: true };
}

export type ProvisionResult =
  | {
      ok: true;
      host_id: string;
      display_name: string;
      created: boolean;
      linked: boolean;
      listings_count: number;
    }
  | { ok: false; error: string; status: number };

export async function provisionHostFromBeeagent(body: {
  beeagent_customer_id?: unknown;
  email?: unknown;
  full_name?: unknown;
  phone_e164?: unknown;
}): Promise<ProvisionResult> {
  const beeagentCustomerId = parseCustomerId(body.beeagent_customer_id);
  const email = parseEmail(body.email);
  if (!beeagentCustomerId || !email) {
    return { ok: false, error: "Requiere beeagent_customer_id (entero) y email válido.", status: 400 };
  }

  const other = getBeeagentLinkForCustomer(beeagentCustomerId);
  const fullName =
    typeof body.full_name === "string" && body.full_name.trim()
      ? body.full_name.trim()
      : "Anfitrión Urbnbee";
  const phone =
    typeof body.phone_e164 === "string" && body.phone_e164.trim()
      ? body.phone_e164.trim()
      : undefined;

  try {
    const { userId, created } = await ensureHostUser({ email, fullName, phone });
    if (other && other.hostId !== userId) {
      return {
        ok: false,
        error: "Este workspace BeeAgent ya está vinculado a otro anfitrión.",
        status: 409,
      };
    }
    upsertBeeagentHostLink({
      hostId: userId,
      beeagentCustomerId,
      email,
    });
    const user = findUserById(userId);
    const listings = listListingsForHost(userId);
    return {
      ok: true,
      host_id: userId,
      display_name: user?.fullName ?? fullName,
      created,
      linked: true,
      listings_count: listings.length,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "EMAIL_IN_USE" || msg === "EMAIL_NOT_HOST_ELIGIBLE") {
      return { ok: false, error: "El correo no puede usarse como anfitrión.", status: 409 };
    }
    if (msg === "BEEAGENT_CUSTOMER_LINKED_TO_OTHER_HOST") {
      return { ok: false, error: "Workspace BeeAgent ya vinculado a otro host.", status: 409 };
    }
    return { ok: false, error: "No se pudo provisionar el anfitrión.", status: 500 };
  }
}

export type LinkByCodeResult =
  | {
      ok: true;
      host_id: string;
      display_name: string;
      listings_count: number;
    }
  | { ok: false; error: string; status: number };

export async function linkHostByBeeagentCode(body: {
  beeagent_customer_id?: unknown;
  link_code?: unknown;
}): Promise<LinkByCodeResult> {
  const beeagentCustomerId = parseCustomerId(body.beeagent_customer_id);
  const code =
    typeof body.link_code === "string" ? body.link_code.trim() : "";
  if (!beeagentCustomerId || !code) {
    return {
      ok: false,
      error: "Requiere beeagent_customer_id y link_code.",
      status: 400,
    };
  }

  const pending = consumeLinkCode(code);
  if (!pending) {
    return {
      ok: false,
      error: "Código inválido o expirado. Genera uno nuevo en urbnbee.net → Integraciones.",
      status: 400,
    };
  }

  const user = findUserById(pending.hostId);
  if (!user || (user.role !== "host" && user.role !== "admin")) {
    return { ok: false, error: "Anfitrión no encontrado.", status: 404 };
  }

  const other = getBeeagentLinkForCustomer(beeagentCustomerId);
  if (other && other.hostId !== user.id) {
    return {
      ok: false,
      error: "Este workspace BeeAgent ya está vinculado a otro anfitrión.",
      status: 409,
    };
  }

  try {
    upsertBeeagentHostLink({
      hostId: user.id,
      beeagentCustomerId,
      email: user.email,
    });
    const listings = listListingsForHost(user.id);
    return {
      ok: true,
      host_id: user.id,
      display_name: user.fullName,
      listings_count: listings.length,
    };
  } catch {
    return { ok: false, error: "No se pudo completar la vinculación.", status: 500 };
  }
}
