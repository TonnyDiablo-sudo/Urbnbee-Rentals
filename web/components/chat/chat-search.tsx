"use client";

import { createContext, useContext } from "react";

/** Lo que se escribió en «Buscar en chats»; vacío = sin filtro. */
export const ChatSearchContext = createContext("");

export const useChatSearch = () => useContext(ChatSearchContext);

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();

/** Coincide si cualquiera de los textos contiene la búsqueda (sin acentos ni mayúsculas). */
export function chatMatches(query: string, ...texts: (string | undefined | null)[]): boolean {
  const q = fold(query.trim());
  if (!q) return true;
  return texts.some((x) => x && fold(x).includes(q));
}
