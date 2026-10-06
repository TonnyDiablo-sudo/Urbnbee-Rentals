"use client";

import { useState } from "react";
import { useT } from "@/components/i18n-provider";
import { joinStreet, splitStreet } from "@/lib/listing-address";

/** Calle, número exterior y código postal por separado; se guardan juntos en `addressLine`. */
export function StreetFields({
  value,
  onChange,
  onCommit,
  inputClassName,
}: {
  value: string;
  onChange: (line: string) => void;
  onCommit: (line: string) => void;
  inputClassName: string;
}) {
  const t = useT();
  const [addr, setAddr] = useState(() => splitStreet(value));
  const update = (next: typeof addr) => {
    setAddr(next);
    onChange(joinStreet(next));
  };
  const commit = () => onCommit(joinStreet(addr));
  const noNumber = addr.number === "S/N";

  return (
    <div
      className="space-y-3"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) commit();
      }}
    >
      <label className="block text-sm font-medium text-[#484848]">
        {t("Calle")}
        <input
          className={`mt-1 ${inputClassName}`}
          value={addr.street}
          placeholder={t("Ej.: Colima")}
          onChange={(e) => update({ ...addr, street: e.target.value })}
          autoComplete="address-line1"
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-medium text-[#484848]">
          {t("Número exterior")}
          <input
            className={`mt-1 ${inputClassName} disabled:bg-[#f2f2f2]`}
            value={noNumber ? "" : addr.number}
            disabled={noNumber}
            maxLength={20}
            placeholder={t("Ej.: 123")}
            onChange={(e) => update({ ...addr, number: e.target.value })}
          />
        </label>
        <label className="block text-sm font-medium text-[#484848]">
          {t("Código postal")}
          <input
            className={`mt-1 ${inputClassName}`}
            value={addr.postalCode}
            inputMode="numeric"
            placeholder="06700"
            onChange={(e) => update({ ...addr, postalCode: e.target.value.replace(/\D/g, "").slice(0, 5) })}
            autoComplete="postal-code"
          />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm text-[#484848]">
        <input type="checkbox" checked={noNumber} onChange={(e) => update({ ...addr, number: e.target.checked ? "S/N" : "" })} />
        {t("No tiene número exterior (S/N)")}
      </label>
    </div>
  );
}
