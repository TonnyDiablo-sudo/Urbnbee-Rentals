"use client";

import { useRef, useState } from "react";
import { shrinkImage, useVoiceRecorder } from "@/components/chat/media-input";
import { useT } from "@/components/i18n-provider";
import { ARRIVAL_PLACEHOLDERS } from "@/lib/arrival-message-template";
import type { ChatAttachment } from "@/lib/host-inbox-types";
import {
  STAY_MESSAGE_MAX,
  STAY_MESSAGE_MAX_FILES,
  STAY_MID_EVERY_MAX,
  STAY_MID_MAX,
  newMidRule,
  type StayCheckoutRule,
  type StayMessageRule,
  type StayMessagesSettings,
  type StayMidRule,
} from "@/lib/stay-messages-template";

/** Bienvenida, durante la estancia (varios, cada N días) y salida: activar, auto/manual, texto, fotos y audios. */
export function StayMessagesEditor({
  listingId,
  value,
  onChange,
}: {
  listingId: string;
  value: StayMessagesSettings;
  onChange: (v: StayMessagesSettings) => void;
}) {
  const t = useT();
  const setMid = (i: number, r: StayMidRule) => onChange({ ...value, mid: value.mid.map((m, j) => (j === i ? r : m)) });

  return (
    <div className="space-y-5">
      <p className="text-sm leading-relaxed text-[#717171]">
        {t("Mensajes que le llegan al huésped por el chat de su reserva (y el texto también por correo). Automáticos: salen solos a partir de las 9:00. Manuales: los mandas tú desde la reservación.")}
      </p>

      <RuleCard
        listingId={listingId}
        title={t("Mensaje de bienvenida")}
        when={t("El día de llegada.")}
        rule={value.welcome}
        onChange={(welcome) => onChange({ ...value, welcome })}
      />

      <div className="space-y-3">
        <p className="text-[15px] font-semibold text-[#222]">{t("Mensajes durante la estancia")}</p>
        {value.mid.length === 0 && (
          <p className="text-sm text-[#717171]">{t("Ninguno todavía. Sirven para preguntar cómo va todo o recordar algo en estancias largas.")}</p>
        )}
        {value.mid.map((m, i) => (
          <RuleCard
            key={m.id}
            listingId={listingId}
            title={t("Durante la estancia {n}", { n: i + 1 })}
            rule={m}
            onChange={(r) => setMid(i, { ...m, ...r })}
            onRemove={() => onChange({ ...value, mid: value.mid.filter((_, j) => j !== i) })}
            extra={
              <label className="block text-sm font-medium text-[#222]">
                {t("¿Cada cuántos días?")}
                <select
                  value={m.everyDays}
                  onChange={(e) => setMid(i, { ...m, everyDays: Number(e.target.value) })}
                  className="mt-1 w-full rounded-xl border border-[#ccc] px-3 py-2.5 text-base"
                >
                  {Array.from({ length: STAY_MID_EVERY_MAX }, (_, k) => k + 1).map((n) => (
                    <option key={n} value={n}>
                      {t(n === 1 ? "Todos los días" : "Cada {n} días", { n })}
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-xs font-normal text-[#717171]">
                  {t("Se cuenta desde la llegada y no sale el día de salida. Ej.: cada 3 días en 10 noches sale los días 3, 6 y 9.")}
                </span>
              </label>
            }
          />
        ))}
        {value.mid.length < STAY_MID_MAX && (
          <button
            type="button"
            onClick={() => onChange({ ...value, mid: [...value.mid, newMidRule()] })}
            className="w-full rounded-xl border border-dashed border-[#bbb] py-2.5 text-sm font-semibold text-[#222]"
          >
            {t("+ Agregar mensaje durante la estancia")}
          </button>
        )}
      </div>

      <RuleCard
        listingId={listingId}
        title={t("Mensaje de salida")}
        rule={value.checkout}
        onChange={(r) => onChange({ ...value, checkout: { ...value.checkout, ...r } })}
        extra={
          <label className="block text-sm font-medium text-[#222]">
            {t("¿Cuándo sale?")}
            <select
              value={value.checkout.daysBefore}
              onChange={(e) =>
                onChange({ ...value, checkout: { ...value.checkout, daysBefore: Number(e.target.value) === 1 ? 1 : 0 } as StayCheckoutRule })
              }
              className="mt-1 w-full rounded-xl border border-[#ccc] px-3 py-2.5 text-base"
            >
              <option value={0}>{t("El día de salida")}</option>
              <option value={1}>{t("Un día antes de la salida")}</option>
            </select>
          </label>
        }
      />

      <div className="rounded-2xl border border-[#ebebeb] p-4">
        <p className="text-sm font-semibold text-[#222]">{t("Datos que puedes usar")}</p>
        <p className="mt-0.5 text-xs text-[#717171]">{t("Escríbelos entre llaves. Si un dato está vacío, se quita la línea que lo usa.")}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {ARRIVAL_PLACEHOLDERS.map((p) => (
            <span key={p.key} className="rounded-full border border-[#ddd] px-3 py-1.5 text-xs text-[#444]">
              <code>{`{${p.key}}`}</code> · {t(p.label)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function RuleCard({
  listingId,
  title,
  when,
  rule,
  onChange,
  onRemove,
  extra,
}: {
  listingId: string;
  title: string;
  when?: string;
  rule: StayMessageRule;
  onChange: (r: StayMessageRule) => void;
  onRemove?: () => void;
  extra?: React.ReactNode;
}) {
  const t = useT();
  const set = (patch: Partial<StayMessageRule>) => onChange({ ...rule, ...patch });
  return (
    <div className={`space-y-4 rounded-2xl border p-4 ${rule.enabled ? "border-[#222]" : "border-[#ebebeb]"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-[#222]">{title}</p>
          {when && <p className="text-xs text-[#717171]">{when}</p>}
        </div>
        <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm font-medium text-[#222]">
          <span>{rule.enabled ? t("Activado") : t("Desactivado")}</span>
          <input type="checkbox" checked={rule.enabled} onChange={(e) => set({ enabled: e.target.checked })} className="h-5 w-5" />
        </label>
      </div>

      {rule.enabled && (
        <>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["auto", "Automático", "Sale solo."],
                ["manual", "Manual", "Tú lo mandas desde la reservación."],
              ] as const
            ).map(([mode, label, hint]) => (
              <button
                key={mode}
                type="button"
                onClick={() => set({ mode })}
                className={`rounded-2xl border p-3 text-left ${rule.mode === mode ? "border-[#222] ring-1 ring-[#222]" : "border-[#ddd]"}`}
              >
                <span className="block text-sm font-semibold text-[#222]">{t(label)}</span>
                <span className="mt-0.5 block text-xs text-[#717171]">{t(hint)}</span>
              </button>
            ))}
          </div>
          {extra}
          <label className="block text-sm font-medium text-[#222]">
            {t("Texto")}
            <textarea
              value={rule.text}
              maxLength={STAY_MESSAGE_MAX}
              rows={6}
              onChange={(e) => set({ text: e.target.value })}
              className="mt-1 w-full rounded-xl border border-[#ccc] px-3.5 py-3 text-base outline-none focus:border-[#222]"
            />
            <span className="mt-1 block text-right text-xs font-normal text-[#999]">
              {rule.text.length}/{STAY_MESSAGE_MAX}
            </span>
          </label>
          <Attachments listingId={listingId} files={rule.attachments} onChange={(attachments) => set({ attachments })} />
          {onRemove && (
            <button type="button" onClick={onRemove} className="text-sm font-semibold text-red-700 underline">
              {t("Quitar este mensaje")}
            </button>
          )}
        </>
      )}
    </div>
  );
}

export function Attachments({
  listingId,
  files,
  onChange,
}: {
  listingId: string;
  files: ChatAttachment[];
  onChange: (f: ChatAttachment[]) => void;
}) {
  const t = useT();
  const input = useRef<HTMLInputElement>(null);
  const voice = useVoiceRecorder();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const full = files.length >= STAY_MESSAGE_MAX_FILES;
  const url = (f: string) => `/api/host/listings/${encodeURIComponent(listingId)}/stay-messages/files/${f}`;

  const upload = async (blob: Blob, name: string, durationSec?: number) => {
    setBusy(true);
    setErr(null);
    const fd = new FormData();
    fd.append("file", blob, name);
    if (durationSec) fd.append("durationSec", String(Math.round(durationSec)));
    const res = await fetch(`/api/host/listings/${encodeURIComponent(listingId)}/stay-messages/files`, { method: "POST", body: fd }).catch(
      () => null
    );
    const j = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (!res?.ok || !j.attachment) {
      setErr(typeof j.error === "string" ? j.error : "No se pudo subir el archivo.");
      return;
    }
    onChange([...files, j.attachment as ChatAttachment]);
  };

  const pick = async (f: File | undefined) => {
    if (!f) return;
    if (f.type.startsWith("image/")) await upload(await shrinkImage(f), f.name);
    else await upload(f, f.name);
  };

  return (
    <div>
      <p className="text-sm font-medium text-[#222]">{t("Fotos y audios")}</p>
      <p className="text-xs text-[#717171]">
        {t("Hasta {n}. Se mandan en el chat después del texto.", { n: STAY_MESSAGE_MAX_FILES })}
      </p>
      {files.length > 0 && (
        <ul className="mt-2 space-y-2">
          {files.map((a) => (
            <li key={a.file} className="flex items-center gap-3 rounded-xl border border-[#ebebeb] p-2">
              {a.kind === "image" ? (
                <img src={url(a.file)} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
              ) : (
                <audio src={url(a.file)} controls preload="none" className="h-10 min-w-0 flex-1" />
              )}
              {a.kind === "image" && <span className="flex-1 text-sm text-[#555]">{t("Foto")}</span>}
              <button
                type="button"
                onClick={() => onChange(files.filter((x) => x.file !== a.file))}
                className="shrink-0 px-2 text-sm font-semibold text-red-700"
              >
                {t("Quitar")}
              </button>
            </li>
          ))}
        </ul>
      )}
      {!full && (
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            ref={input}
            type="file"
            accept="image/*,audio/*"
            className="hidden"
            onChange={(e) => {
              void pick(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            disabled={busy || voice.recording}
            onClick={() => input.current?.click()}
            className="rounded-xl border border-[#222] px-3 py-2 text-sm font-semibold text-[#222] disabled:opacity-50"
          >
            {busy ? t("Subiendo…") : t("Agregar foto o audio")}
          </button>
          {voice.supported && (
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                if (!voice.recording) return void voice.start();
                const out = await voice.stop();
                if (out) await upload(out.blob, `voz.${out.blob.type.includes("mp4") ? "m4a" : "webm"}`, out.seconds);
              }}
              className={`rounded-xl px-3 py-2 text-sm font-semibold disabled:opacity-50 ${
                voice.recording ? "bg-red-600 text-white" : "border border-[#222] text-[#222]"
              }`}
            >
              {voice.recording ? t("Detener ({s} s)", { s: Math.floor(voice.seconds) }) : t("Grabar audio")}
            </button>
          )}
        </div>
      )}
      {(err || voice.error) && <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{t(err ?? voice.error ?? "")}</p>}
    </div>
  );
}
