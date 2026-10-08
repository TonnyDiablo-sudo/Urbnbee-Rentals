export type Device = "android" | "ios" | "desktop";

export function deviceFromUa(ua: string): Device {
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && /mobile/i.test(ua))) return "ios";
  return "desktop";
}
