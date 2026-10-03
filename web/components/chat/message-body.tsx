"use client";

import { useState } from "react";
import { useT } from "@/components/i18n-provider";

/** Texto de un mensaje; si llegó traducido, permite ver lo que escribió la persona. */
export function MessageBody({ body, original, className }: { body: string; original?: string; className?: string }) {
  const t = useT();
  const [showOriginal, setShowOriginal] = useState(false);
  return (
    <>
      <p className={className}>{showOriginal && original ? original : body}</p>
      {original && (
        <button
          type="button"
          onClick={() => setShowOriginal(!showOriginal)}
          className="mt-0.5 text-[11px] text-[#888] underline"
        >
          {showOriginal ? t("Ver traducción") : t("Traducido · ver original")}
        </button>
      )}
    </>
  );
}
