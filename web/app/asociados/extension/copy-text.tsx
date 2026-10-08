"use client";

import { useState } from "react";
import { useT } from "@/components/i18n-provider";

/** Chrome no deja abrir chrome:// desde un enlace: hay que copiarlo y pegarlo. */
export function CopyText({ value }: { value: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  return (
    <span className="my-1.5 flex max-w-sm gap-2">
      <code className="flex-1 rounded bg-gray-100 px-3 py-1.5 text-sm">{value}</code>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(value);
          setCopied(true);
        }}
        className="rounded-lg border border-gray-300 px-3 text-sm"
      >
        {copied ? "✓" : t("Copiar")}
      </button>
    </span>
  );
}
