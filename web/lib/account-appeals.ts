import "server-only";
import { isAccountSuspended } from "@/lib/account-standing";
import { createAppeal, findAppeal, latestAppealFor, updateAppeal, type AccountAppeal } from "@/lib/account-appeals-store";
import { findUserById, updateUserAuth } from "@/lib/marketplace-store";
import type { UserRecord } from "@/lib/marketplace-types";
import { notifyUser } from "@/lib/push";
import { hasStaffPermission } from "@/lib/staff";

const MIN = 20;

export function submitAccountAppeal(
  user: UserRecord,
  message: string
): { ok: true; appeal: AccountAppeal } | { ok: false; error: string; status: number } {
  if (!isAccountSuspended(user)) return { ok: false, error: "Tu cuenta no está suspendida.", status: 400 };
  const text = message.trim().slice(0, 2000);
  if (text.length < MIN) return { ok: false, error: "Escribe un poco más (mínimo 20 caracteres).", status: 400 };
  const latest = latestAppealFor(user.id);
  if (latest?.status === "pending") return { ok: false, error: "Ya tienes una solicitud en revisión.", status: 409 };
  const appeal = createAppeal({ userId: user.id, userName: user.fullName, userEmail: user.email, message: text });
  return { ok: true, appeal };
}

export function myAppeal(userId: string): AccountAppeal | null {
  return latestAppealFor(userId) ?? null;
}

export function decideAccountAppeal(
  viewer: UserRecord,
  id: string,
  action: "restore" | "uphold",
  note: string
): { ok: true } | { ok: false; error: string; status: number } {
  if (!hasStaffPermission(viewer, "appeals")) return { ok: false, error: "No tienes acceso a esta sección.", status: 403 };
  const appeal = findAppeal(id);
  if (!appeal) return { ok: false, error: "No encontramos esa solicitud.", status: 404 };
  if (appeal.status !== "pending") return { ok: false, error: "Esa solicitud ya se resolvió.", status: 409 };
  const user = findUserById(appeal.userId);
  if (!user) return { ok: false, error: "La cuenta ya no existe.", status: 404 };

  if (action === "restore") {
    updateUserAuth(user.id, { suspendedAt: undefined, suspendReason: undefined });
    updateAppeal(appeal.id, { status: "restored", decidedBy: viewer.id, decisionNote: note });
    notifyUser(user.id, {
      kind: "support",
      title: "Tu cuenta ya está habilitada",
      body: "Ya puedes volver a usar Cabibee. Tus anuncios siguen ocultos hasta que los publiques.",
      url: "/perfil",
      tag: "account-restored",
    });
    return { ok: true };
  }

  updateAppeal(appeal.id, { status: "upheld", decidedBy: viewer.id, decisionNote: note });
  notifyUser(user.id, {
    kind: "support",
    title: "Tu cuenta sigue suspendida",
    body: "Revisamos tu solicitud y la cuenta sigue suspendida.",
    url: "/perfil",
    tag: "account-upheld",
  });
  return { ok: true };
}
