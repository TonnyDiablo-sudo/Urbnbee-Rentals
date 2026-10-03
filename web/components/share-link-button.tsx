"use client";

import { useState } from "react";
import { useT } from "@/components/i18n-provider";

/** Abre el menú de compartir del teléfono (WhatsApp, Mensajes…); en computadora copia el enlace. */
export async function shareOrCopy(data: { url: string; title: string; text?: string }): Promise<"shared" | "copied" | "cancelled"> {
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share(data);
      return "shared";
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return "cancelled";
    }
  }
  try {
    await navigator.clipboard.writeText(data.url);
  } catch {
    window.prompt("", data.url);
  }
  return "copied";
}

export function ShareLinkButton({
  path,
  title,
  text,
  label,
  className = "",
}: {
  /** Ruta del sitio actual; se completa con el dominio en el navegador. */
  path?: string;
  title: string;
  text?: string;
  label: string;
  className?: string;
}) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        const url = path ? new URL(path, window.location.origin).toString() : window.location.href;
        if ((await shareOrCopy({ url, title, text })) === "copied") {
          setCopied(true);
          setTimeout(() => setCopied(false), 2500);
        }
      }}
    >
      {copied ? t("Enlace copiado") : label}
    </button>
  );
}
