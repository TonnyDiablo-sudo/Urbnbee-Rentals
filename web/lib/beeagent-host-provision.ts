import "server-only";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import {
  consumeLinkCode,
  getBeeagentLinkForCustomer,
  getBeeagentLinkForHost,
  upsertBeeagentHostLink,
  upsertPendingProvision,
} from "@/lib/beeagent-host-link-store";
import {
  createUser,
  findUserByEmail,
  findUserById,
  listListingsForHost,
  upsertHostProfile,
} from "@/lib/marketplace-store";

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

export type ProvisionResult =
  | {
      ok: true;
      host_id: string;
      display_name: string;
      created: boolean;
      linked: boolean;
      listings_count: number;
      pending_confirm?: boolean;
    }
  | { ok: false; error: string; status: number; code?: string };

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

  const fullName =
    typeof body.full_name === "string" && body.full_name.trim()
      ? body.full_name.trim()
      : "Anfitrión Cabibee";
  const phone =
    typeof body.phone_e164 === "string" && body.phone_e164.trim()
      ? body.phone_e164.trim()
      : undefined;

  const existingCustomer = getBeeagentLinkForCustomer(beeagentCustomerId);
  const existingEmail = findUserByEmail(email);

  if (existingCustomer) {
    if (existingEmail && existingCustomer.hostId === existingEmail.id) {
      const user = findUserById(existingEmail.id);
      return {
        ok: true,
        host_id: existingEmail.id,
        display_name: user?.fullName ?? fullName,
        created: false,
        linked: true,
        listings_count: listListingsForHost(existingEmail.id).length,
      };
    }
    return {
      ok: false,
      error: "Este workspace BeeAgent ya está vinculado a otro anfitrión.",
      status: 409,
      code: "customer_already_linked",
    };
  }

  if (existingEmail) {
    const already = getBeeagentLinkForHost(existingEmail.id);
    if (already && already.beeagentCustomerId === beeagentCustomerId) {
      return {
        ok: true,
        host_id: existingEmail.id,
        display_name: existingEmail.fullName,
        created: false,
        linked: true,
        listings_count: listListingsForHost(existingEmail.id).length,
      };
    }
    return {
      ok: false,
      error: "Ese correo ya tiene cuenta en Cabibee. El anfitrión debe confirmar el vínculo en Integraciones.",
      status: 409,
      code: "host_exists_confirm_required",
    };
  }

  const passwordHash = await bcrypt.hash(randomBytes(32).toString("hex"), 11);
  let userId: string;
  try {
    const user = createUser({
      email,
      passwordHash,
      fullName,
      phone,
      role: "host",
    });
    userId = user.id;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "EMAIL_IN_USE") {
      return {
        ok: false,
        error: "Ese correo ya tiene cuenta en Cabibee. El anfitrión debe confirmar el vínculo en Integraciones.",
        status: 409,
        code: "host_exists_confirm_required",
      };
    }
    return { ok: false, error: "No se pudo provisionar el anfitrión.", status: 500 };
  }

  upsertHostProfile(userId, { phone, email });
  upsertPendingProvision({ hostId: userId, beeagentCustomerId, email });
  const user = findUserById(userId);
  return {
    ok: true,
    host_id: userId,
    display_name: user?.fullName ?? fullName,
    created: true,
    linked: false,
    pending_confirm: true,
    listings_count: 0,
  };
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
  const code = typeof body.link_code === "string" ? body.link_code.trim() : "";
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
      error: "Código inválido o expirado. Genera uno nuevo en Cabibee → Integraciones.",
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
