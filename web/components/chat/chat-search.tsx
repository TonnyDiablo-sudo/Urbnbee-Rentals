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

/** Sin búsqueda, todo coincide; si no, cada palabra tiene que aparecer en alguno de los textos (sin acentos ni mayúsculas). */
export function chatMatches(query: string, ...texts: (string | undefined | null)[]): boolean {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const hay = fold(texts.filter(Boolean).join(" "));
  return words.every((w) => hay.includes(w));
}
