import "server-only";
import { createHash, randomBytes } from "crypto";
import type { NextRequest } from "next/server";
import { findUserByAssociateTokenHash, updateUserAuth } from "@/lib/marketplace-store";
import type { UserRecord } from "@/lib/marketplace-types";
import { getSessionUser } from "@/lib/session";

export function canUseAssociatePanel(user: UserRecord | null | undefined): user is UserRecord {
  return Boolean(user && (user.role === "admin" || user.associate));
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Token nuevo para la extensión de Chrome. El anterior deja de servir. */
export function issueAssociateToken(userId: string): string {
  const token = `cbx_${randomBytes(24).toString("hex")}`;
  updateUserAuth(userId, { associateTokenHash: hashToken(token) });
  return token;
}

/** Sesión del panel o `Authorization: Bearer cbx_…` de la extensión. */
export async function getAssociateFromRequest(req: NextRequest): Promise<UserRecord | null> {
  const auth = req.headers.get("authorization") ?? "";
  const m = auth.match(/^Bearer\s+(cbx_[a-f0-9]{48})$/i);
  if (m) {
    const user = findUserByAssociateTokenHash(hashToken(m[1]));
    return canUseAssociatePanel(user) ? user : null;
  }
  const user = await getSessionUser();
  return canUseAssociatePanel(user) ? user : null;
}
