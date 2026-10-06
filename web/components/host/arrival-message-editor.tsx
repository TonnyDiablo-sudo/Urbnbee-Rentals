"use client";

import { Attachments } from "@/components/host/stay-messages-editor";
import { useT } from "@/components/i18n-provider";
import type { ArrivalGuide } from "@/lib/arrival-guide";
import {
  ARRIVAL_DAYS_BEFORE_MAX,
  ARRIVAL_MESSAGE_MAX,
  ARRIVAL_PLACEHOLDERS,
  DEFAULT_ARRIVAL_TEMPLATE,
  arrivalMessageVars,
  fillArrivalTemplate,
  type ArrivalMessageSettings,
} from "@/lib/arrival-message-template";
import { listingFullAddress } from "@/lib/listing-address";
import type { HostListingRecord } from "@/lib/marketplace-types";

function isoInDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Modo, días de anticipación y plantilla del mensaje de llegada, con ayuda y vista previa. */
export function ArrivalMessageEditor({
  listing,
  guide,
  value,
  onChange,
  hostName,
}: {
  listing: HostListingRecord;
  /** La guía que se está editando (puede no estar guardada todavía). */
  guide: ArrivalGuide;
  value: ArrivalMessageSettings;
  onChange: (v: ArrivalMessageSettings) => void;
  hostName?: string;
}) {
  const t = useT();
  const set = (patch: Partial<ArrivalMessageSettings>) => onChange({ ...value, ...patch });
  const preview = fillArrivalTemplate(
    value.template || DEFAULT_ARRIVAL_TEMPLATE,
    arrivalMessageVars({
      guestName: "Ana",
      listingTitle: listing.title,
      address: listingFullAddress(listing),
      checkIn: isoInDays(7),
      checkOut: isoInDays(10),
      guide,
      hostName: hostName?.trim() || t("Tu nombre"),
    })
  );
  const field = "mt-1 w-full rounded-xl border border-[#ccc] px-3.5 py-3 text-base outline-none focus:border-[#222]";

  return (
    <div className="space-y-5">
      <p className="text-sm leading-relaxed text-[#717171]">
        {t("Cuando una reserva del Motor de reservas queda confirmada, le mandamos al huésped este mensaje por el chat y por correo con la dirección exacta, la llegada y tus instrucciones.")}
      </p>

      <div className="grid grid-cols-2 gap-2">
        {(
          [
            ["auto", "Automático", "Sale solo antes de la llegada."],
            ["manual", "Manual", "Tú lo mandas desde la reservación."],
          ] as const
        ).map(([mode, label, hint]) => (
          <button
            key={mode}
            type="button"
            onClick={() => set({ mode })}
            className={`rounded-2xl border p-3 text-left ${value.mode === mode ? "border-[#222] ring-1 ring-[#222]" : "border-[#ddd]"}`}
          >
            <span className="block text-[15px] font-semibold text-[#222]">{t(label)}</span>
            <span className="mt-0.5 block text-xs text-[#717171]">{t(hint)}</span>
          </button>
        ))}
      </div>

      {value.mode === "auto" && (
        <label className="block text-sm font-medium text-[#222]">
          {t("¿Cuántos días antes de la llegada?")}
          <select
            value={value.daysBefore}
            onChange={(e) => set({ daysBefore: Number(e.target.value) })}
            className={field}
          >
            {Array.from({ length: ARRIVAL_DAYS_BEFORE_MAX + 1 }, (_, n) => (
              <option key={n} value={n}>
                {n === 0 ? t("El mismo día de llegada") : t(n === 1 ? "1 día antes" : "{n} días antes", { n })}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs font-normal text-[#717171]">
            {t("Si la reserva se confirma después, el mensaje sale en cuanto se confirma.")}
          </span>
        </label>
      )}

      <label className="block text-sm font-medium text-[#222]">
        {t("Plantilla del mensaje")}
        <textarea
          value={value.template}
          maxLength={ARRIVAL_MESSAGE_MAX}
          rows={12}
          onChange={(e) => set({ template: e.target.value })}
          className={`${field} font-mono text-sm`}
        />
        <span className="mt-1 flex justify-between text-xs font-normal text-[#999]">
          <button type="button" onClick={() => set({ template: DEFAULT_ARRIVAL_TEMPLATE })} className="underline">
            {t("Usar la plantilla de Cabibee")}
          </button>
          <span>
            {value.template.length}/{ARRIVAL_MESSAGE_MAX}
          </span>
        </span>
      </label>

      <div>
        <p className="mb-2 text-xs text-[#717171]">{t("Llegan al chat después del texto: la puerta, la caja de llaves o una nota de voz explicando la entrada.")}</p>
        <Attachments listingId={listing.id} files={value.attachments ?? []} onChange={(attachments) => set({ attachments })} />
      </div>

      <div className="rounded-2xl border border-[#ebebeb] p-4">
        <p className="text-sm font-semibold text-[#222]">{t("Datos que puedes usar")}</p>
        <p className="mt-0.5 text-xs text-[#717171]">{t("Si un dato está vacío, se quita la línea que lo usa.")}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {ARRIVAL_PLACEHOLDERS.map((p) => (
            <button
              key={p.key}
              type="button"
              title={t(p.label)}
              onClick={() => set({ template: `${value.template}${value.template.endsWith("\n") || !value.template ? "" : " "}{${p.key}}` })}
              className="rounded-full border border-[#ddd] px-3 py-1.5 text-xs text-[#444]"
            >
              <code>{`{${p.key}}`}</code> · {t(p.label)}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-[#222]">{t("Vista previa")}</p>
        <div className="whitespace-pre-wrap rounded-2xl bg-[#f7f7f7] px-4 py-3 text-[15px] leading-relaxed text-[#333]">
          {preview || t("La plantilla quedó vacía.")}
        </div>
        <p className="mt-1 text-xs text-[#999]">{t("Con un huésped de ejemplo y fechas de prueba.")}</p>
      </div>
    </div>
  );
}
