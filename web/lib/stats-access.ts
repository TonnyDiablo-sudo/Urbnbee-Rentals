import type { UserRecord } from "@/lib/marketplace-types";

/** Cuentas demo con las que revisamos cómo se ven las estadísticas sin verificar correo. */
const STATS_PREVIEW_IDS = new Set(["usr_demo_sofia_host"]);

/** Las estadísticas piden correo verificado (salvo admin y las cuentas de revisión). */
export function statsLocked(user: Pick<UserRecord, "id" | "role" | "emailVerifiedAt">): boolean {
  return user.role !== "admin" && !user.emailVerifiedAt && !STATS_PREVIEW_IDS.has(user.id);
}
