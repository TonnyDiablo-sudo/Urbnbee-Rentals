import "server-only";
import { cookies, headers } from "next/headers";
import { isLang, LANG_COOKIE, langFromAcceptLanguage, makeT, type Lang, type TFn } from "./index";

export async function getLang(): Promise<Lang> {
  const fromCookie = (await cookies()).get(LANG_COOKIE)?.value;
  if (isLang(fromCookie)) return fromCookie;
  return langFromAcceptLanguage((await headers()).get("accept-language"));
}

export async function getT(): Promise<TFn> {
  return makeT(await getLang());
}
