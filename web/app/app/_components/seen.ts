"use client";

/**
 * Qué hilos ya abrió esta persona en este dispositivo. El inbox no guarda leído/no
 * leído en el servidor, así que el aviso de "mensaje nuevo" se calcula aquí.
 */
const PREFIX = "cabibee:seen:";

export function markThreadSeen(threadKey: string, at: string = new Date().toISOString()) {
  try {
    localStorage.setItem(PREFIX + threadKey, at);
    window.dispatchEvent(new Event("cabibee:seen"));
  } catch {
    /* modo privado sin localStorage */
  }
}

export function threadIsUnread(threadKey: string, lastAt: string): boolean {
  try {
    const seen = localStorage.getItem(PREFIX + threadKey);
    return !seen || new Date(lastAt).getTime() > new Date(seen).getTime();
  } catch {
    return false;
  }
}
