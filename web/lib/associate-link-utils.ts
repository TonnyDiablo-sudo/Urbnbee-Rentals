/** Facebook e Instagram piden iniciar sesión: desde el servidor sólo se ve la pantalla de login. */
export function isLoginWalledUrl(raw: string): boolean {
  try {
    const host = new URL(raw).hostname.toLowerCase().replace(/^www\.|^m\.|^web\./, "");
    return /(^|\.)(facebook\.com|fb\.com|fb\.me|fb\.watch|instagram\.com|threads\.net)$/.test(host);
  } catch {
    return false;
  }
}

export function firstUrlIn(text: string): string | null {
  const m = text.match(/https?:\/\/[^\s<>"']+/i);
  return m ? m[0].replace(/[),.;!?]+$/, "") : null;
}
