import type { UserRecord } from "@/lib/marketplace-types";

export const STAFF_PERMISSIONS = [
  { id: "appeals", label: "Ver y resolver solicitudes para habilitar cuentas suspendidas" },
  { id: "reports", label: "Ver reportes de cuentas" },
  { id: "moderate", label: "Ocultar mensajes y retirar anuncios" },
  { id: "agent", label: "Ver el panel del revisor GPT-6" },
] as const;

export type StaffPermission = (typeof STAFF_PERMISSIONS)[number]["id"];

const IDS = new Set<string>(STAFF_PERMISSIONS.map((p) => p.id));

export function parseStaffPermissions(v: unknown): StaffPermission[] {
  if (!Array.isArray(v)) return [];
  const out: StaffPermission[] = [];
  for (const item of v) {
    if (typeof item === "string" && IDS.has(item) && !out.includes(item as StaffPermission)) out.push(item as StaffPermission);
  }
  return out;
}

export function staffPermissionsOf(user: Pick<UserRecord, "role" | "staffPermissions"> | null | undefined): StaffPermission[] {
  if (!user) return [];
  if (user.role === "admin") return STAFF_PERMISSIONS.map((p) => p.id);
  return parseStaffPermissions(user.staffPermissions);
}

export function hasStaffPermission(
  user: Pick<UserRecord, "role" | "staffPermissions"> | null | undefined,
  perm: StaffPermission
): boolean {
  return staffPermissionsOf(user).includes(perm);
}

export function isStaffAccount(user: Pick<UserRecord, "staffPermissions"> | null | undefined): boolean {
  return parseStaffPermissions(user?.staffPermissions).length > 0;
}
