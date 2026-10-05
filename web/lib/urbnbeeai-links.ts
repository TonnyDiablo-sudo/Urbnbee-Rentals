/** urbnbeeai.com recuerda el idioma en el navegador; `?lang=` le dice en cuál abrir la primera vez. */
export function urbnbeeaiUrl(url: string, lang: "es" | "en"): string {
  try {
    const u = new URL(url);
    if (!/(^|\.)urbnbeeai\.com$/.test(u.hostname)) return url;
    u.searchParams.set("lang", lang);
    return u.toString();
  } catch {
    return url;
  }
}

export const URBNBEEAI_RENTALS_CASE = "https://www.urbnbeeai.com/casos#alojamientos";
