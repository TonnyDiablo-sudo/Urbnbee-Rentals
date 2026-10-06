"use client";

import { useState } from "react";
import { useT } from "@/components/i18n-provider";

/**
 * Texto de un mensaje. Si llegó traducido, permite ver lo que escribió la persona; si es mío y se mandó
 * traducido con el traductor del chat, muestro lo que escribí y puedo ver cómo le llegó.
 */
export function MessageBody({ body, original, mine, className }: { body: string; original?: string; mine?: boolean; className?: string }) {
  const t = useT();
  const [showOriginal, setShowOriginal] = useState(Boolean(mine));
  return (
    <>
      <p className={className}>{showOriginal && original ? original : body}</p>
      {original && (
        <button
          type="button"
          onClick={() => setShowOriginal(!showOriginal)}
          className={`mt-0.5 text-[11px] underline ${mine ? "text-black/60" : "text-[#888]"}`}
        >
          {mine
            ? showOriginal
              ? t("Se envió traducido · ver cómo llegó")
              : t("Ver lo que escribí")
            : showOriginal
              ? t("Ver traducción")
              : t("Traducido · ver original")}
        </button>
      )}
    </>
  );
}
