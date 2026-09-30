"use client";

import { createContext, useContext, useMemo } from "react";
import { makeT, type Lang, type TFn } from "@/lib/i18n";

const LangContext = createContext<Lang>("es");

export function LangProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>;
}

export function useLang(): Lang {
  return useContext(LangContext);
}

export function useT(): TFn {
  const lang = useLang();
  return useMemo(() => makeT(lang), [lang]);
}
