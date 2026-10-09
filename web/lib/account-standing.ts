/** La cuenta no puede reservar, escribir ni publicar hasta que la habiliten. El admin nunca queda suspendido. */
export function isAccountSuspended(user: { suspendedAt?: string; role?: string } | null | undefined): boolean {
  return Boolean(user?.suspendedAt) && user?.role !== "admin";
}

export const SUSPENDED_ERROR = "Tu cuenta está suspendida.";
