/** Textos (claves en español) de baños y tipo de entrada, iguales en web y app. */
export function bathroomsKey(n: number, type?: "private" | "shared"): string {
  if (type === "private") return n === 1 ? "{n} baño privado" : "{n} baños privados";
  if (type === "shared") return n === 1 ? "{n} baño compartido" : "{n} baños compartidos";
  return n === 1 ? "{n} baño" : "{n} baños";
}

export function selfCheckInKey(v: boolean | undefined): string | null {
  if (v === true) return "Entrada autónoma";
  if (v === false) return "Te recibe el anfitrión";
  return null;
}
