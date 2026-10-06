"use client";

import { useRef, useState } from "react";
import { VoiceNote } from "@/components/chat/attachment-view";
import { shrinkImage, useVoiceRecorder } from "@/components/chat/media-input";
import { useT } from "@/components/i18n-provider";
import { ARRIVAL_PLACEHOLDERS } from "@/lib/arrival-message-template";
import type { ChatAttachment } from "@/lib/host-inbox-types";
import {
  STAY_MESSAGE_MAX,
  STAY_MESSAGE_MAX_AUDIOS,
  STAY_MESSAGE_MAX_IMAGES,
  STAY_MID_EVERY_MAX,
  STAY_MID_MAX,
  STAY_TEMPLATES,
  newMidRule,
  type StayCheckoutRule,
  type StayMessageKind,
  type StayMessageRule,
  type StayMessagesSettings,
  type StayMidRule,
} from "@/lib/stay-messages-template";

const INTRO: Record<StayMessageKind, string> = {
  welcome: "Le llega al huésped el día de su llegada por el chat de la reserva (y el texto también por correo).",
  mid: "Para estancias largas: un mensaje que se repite mientras el huésped está hospedado, para saber si todo va bien o si necesita algo. No es el de bienvenida ni el de salida.",
  checkout: "Le llega al huésped antes de irse, con la hora de salida y lo que debe hacer al dejar el lugar.",
};

function everyLabel(n: number): string {
  if (n === 1) return "Todos los días";
  if (n === 7) return "Cada semana";
  if (n === 14) return "Cada 2 semanas";
  if (n === 21) return "Cada 3 semanas";
  if (n === 30) return "Cada mes";
  return "Cada {n} días";
}

/** Un mensaje de la estancia a la vez: bienvenida, durante la estancia (se repite) o salida. */
export function StayMessagesEditor({
  listingId,
  value,
  onChange,
  part,
}: {
  listingId: string;
  value: StayMessagesSettings;
  onChange: (v: StayMessagesSettings) => void;
  part: StayMessageKind;
}) {
  const t = useT();
  const setMid = (i: number, r: StayMidRule) => onChange({ ...value, mid: value.mid.map((m, j) => (j === i ? r : m)) });

  return (
    <div className="space-y-5">
      <p className="text-sm leading-relaxed text-[#717171]">
        {t(INTRO[part])} {t("Automáticos: salen solos a partir de las 9:00. Manuales: los mandas tú desde la reservación.")}
      </p>

      {part === "welcome" && (
        <RuleCard
          kind="welcome"
          listingId={listingId}
          title={t("Mensaje de bienvenida")}
          when={t("El día de llegada.")}
          rule={value.welcome}
          onChange={(welcome) => onChange({ ...value, welcome })}
        />
      )}

      {part === "mid" && (
        <div className="space-y-3">
          {value.mid.length === 0 && (
            <p className="text-sm text-[#717171]">{t("Ninguno todavía. Sirven para preguntar cómo va todo o recordar algo en estancias largas.")}</p>
          )}
          {value.mid.map((m, i) => (
            <RuleCard
              key={m.id}
              kind="mid"
              listingId={listingId}
              title={value.mid.length > 1 ? t("Durante la estancia {n}", { n: i + 1 }) : t("Mensaje durante la estancia")}
              rule={m}
              onChange={(r) => setMid(i, { ...m, ...r })}
              onRemove={() => onChange({ ...value, mid: value.mid.filter((_, j) => j !== i) })}
              extra={
                <label className="block text-sm font-medium text-[#222]">
                  {t("¿Cada cuánto se repite?")}
                  <select
                    value={m.everyDays}
                    onChange={(e) => setMid(i, { ...m, everyDays: Number(e.target.value) })}
                    className="mt-1 w-full rounded-xl border border-[#ccc] px-3 py-2.5 text-base"
                  >
                    {Array.from({ length: STAY_MID_EVERY_MAX }, (_, k) => k + 1).map((n) => (
                      <option key={n} value={n}>
                        {t(everyLabel(n), { n })}
                      </option>
                    ))}
                  </select>
                  <span className="mt-1 block text-xs font-normal text-[#717171]">
                    {t("Se cuenta desde la llegada y se repite hasta la salida (el día de salida no se manda). Ej.: cada semana en 3 semanas sale los días 7 y 14.")}
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
              {t(value.mid.length ? "+ Agregar otro mensaje durante la estancia" : "+ Agregar mensaje durante la estancia")}
            </button>
          )}
        </div>
      )}

      {part === "checkout" && (
        <RuleCard
          kind="checkout"
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
      )}

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
  kind,
  listingId,
  title,
  when,
  rule,
  onChange,
  onRemove,
  extra,
}: {
  kind: StayMessageKind;
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
  const useTemplate = (text: string) => {
    if (rule.text.trim() && rule.text !== text && !window.confirm(t("¿Reemplazar el texto actual con esta plantilla?"))) return;
    set({ text });
  };
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
          <div>
            <p className="text-sm font-medium text-[#222]">{t("Plantillas")}</p>
            <p className="text-xs text-[#717171]">{t("Toca una para usarla y luego ajústala a tu gusto.")}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {STAY_TEMPLATES[kind].map((tpl) => (
                <button
                  key={tpl.name}
                  type="button"
                  onClick={() => useTemplate(tpl.text)}
                  className={`rounded-full border px-3 py-1.5 text-sm ${
                    rule.text === tpl.text ? "border-[#222] bg-[#222] text-white" : "border-[#ddd] text-[#222]"
                  }`}
                >
                  {t(tpl.name)}
                </button>
              ))}
            </div>
          </div>
          <label className="block text-sm font-medium text-[#222]">
            {t("Texto")}
            <textarea
              value={rule.text}
              maxLength={STAY_MESSAGE_MAX}
              rows={8}
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

/** Hasta 4 fotos y 4 audios por mensaje; se mandan en el chat después del texto. */
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
  const photoInput = useRef<HTMLInputElement>(null);
  const audioInput = useRef<HTMLInputElement>(null);
  const voice = useVoiceRecorder();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const images = files.filter((a) => a.kind === "image");
  const audios = files.filter((a) => a.kind === "audio");
  const imagesFull = images.length >= STAY_MESSAGE_MAX_IMAGES;
  const audiosFull = audios.length >= STAY_MESSAGE_MAX_AUDIOS;
  const url = (f: string) => `/api/host/listings/${encodeURIComponent(listingId)}/stay-messages/files/${f}`;

  const upload = async (blob: Blob, name: string, durationSec?: number): Promise<ChatAttachment | null> => {
    const fd = new FormData();
    fd.append("file", blob, name);
    if (durationSec) fd.append("durationSec", String(Math.round(durationSec)));
    const res = await fetch(`/api/host/listings/${encodeURIComponent(listingId)}/stay-messages/files`, { method: "POST", body: fd }).catch(
      () => null
    );
    const j = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok || !j.attachment) {
      setErr(typeof j.error === "string" ? j.error : "No se pudo subir el archivo.");
      return null;
    }
    return j.attachment as ChatAttachment;
  };

  /** Varias a la vez: se suben una por una (el servidor pide una pausa corta entre archivos). */
  const pickMany = async (list: FileList | null, kind: "image" | "audio") => {
    if (!list?.length) return;
    setBusy(true);
    setErr(null);
    const room = kind === "image" ? STAY_MESSAGE_MAX_IMAGES - images.length : STAY_MESSAGE_MAX_AUDIOS - audios.length;
    const picked = Array.from(list).slice(0, Math.max(0, room));
    const added: ChatAttachment[] = [];
    for (const [i, f] of picked.entries()) {
      if (i > 0) await new Promise((r) => setTimeout(r, 1600));
      const a = kind === "image" ? await upload(await shrinkImage(f), f.name) : await upload(f, f.name);
      if (!a) break;
      added.push(a);
      onChange([...files, ...added]);
    }
    if (list.length > picked.length) setErr(t("Sólo caben {n} por mensaje.", { n: kind === "image" ? STAY_MESSAGE_MAX_IMAGES : STAY_MESSAGE_MAX_AUDIOS }));
    setBusy(false);
  };

  const remove = (file: string) => onChange(files.filter((x) => x.file !== file));

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-[#222]">{t("Fotos y audios")}</p>
        <p className="text-xs text-[#717171]">
          {t("Hasta {a} fotos y {b} audios. Se mandan en el chat después del texto.", { a: STAY_MESSAGE_MAX_IMAGES, b: STAY_MESSAGE_MAX_AUDIOS })}
        </p>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[#888]">
          {t("Fotos")} · {images.length}/{STAY_MESSAGE_MAX_IMAGES}
        </p>
        <div className="grid grid-cols-4 gap-2">
          {images.map((a) => (
            <div key={a.file} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- archivo privado servido con sesión */}
              <img src={url(a.file)} alt="" className="aspect-square w-full rounded-xl object-cover" />
              <button
                type="button"
                onClick={() => remove(a.file)}
                aria-label={t("Quitar")}
                className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black text-sm text-white"
              >
                ×
              </button>
            </div>
          ))}
          {!imagesFull && (
            <button
              type="button"
              disabled={busy}
              onClick={() => photoInput.current?.click()}
              className="flex aspect-square w-full flex-col items-center justify-center rounded-xl border border-dashed border-[#bbb] text-xs font-semibold text-[#222] disabled:opacity-50"
            >
              <span className="text-xl">＋</span>
              {t("Foto")}
            </button>
          )}
        </div>
        <input
          ref={photoInput}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            void pickMany(e.target.files, "image");
            e.target.value = "";
          }}
        />
      </div>

      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[#888]">
          {t("Audios")} · {audios.length}/{STAY_MESSAGE_MAX_AUDIOS}
        </p>
        {audios.length > 0 && (
          <ul className="space-y-2">
            {audios.map((a) => (
              <li key={a.file} className="flex items-center gap-2 rounded-xl border border-[#ebebeb] px-2 py-1">
                <div className="min-w-0 flex-1">
                  <VoiceNote a={{ url: url(a.file), durationSec: a.durationSec }} wide />
                </div>
                <button type="button" onClick={() => remove(a.file)} className="shrink-0 px-1 text-sm font-semibold text-red-700">
                  {t("Quitar")}
                </button>
              </li>
            ))}
          </ul>
        )}
        {!audiosFull && (
          <div className="mt-2 flex flex-wrap gap-2">
            {voice.supported && (
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  if (!voice.recording) return void voice.start();
                  const out = await voice.stop();
                  if (!out) return;
                  setBusy(true);
                  setErr(null);
                  const a = await upload(out.blob, `voz.${out.blob.type.includes("mp4") ? "m4a" : "webm"}`, out.seconds);
                  if (a) onChange([...files, a]);
                  setBusy(false);
                }}
                className={`rounded-xl px-3 py-2 text-sm font-semibold disabled:opacity-50 ${
                  voice.recording ? "bg-red-600 text-white" : "border border-[#222] text-[#222]"
                }`}
              >
                {voice.recording ? t("Detener ({s} s)", { s: Math.floor(voice.seconds) }) : `🎤 ${t("Grabar audio")}`}
              </button>
            )}
            <button
              type="button"
              disabled={busy || voice.recording}
              onClick={() => audioInput.current?.click()}
              className="rounded-xl border border-[#222] px-3 py-2 text-sm font-semibold text-[#222] disabled:opacity-50"
            >
              {t("Subir audio")}
            </button>
            <input
              ref={audioInput}
              type="file"
              accept="audio/*"
              multiple
              className="hidden"
              onChange={(e) => {
                void pickMany(e.target.files, "audio");
                e.target.value = "";
              }}
            />
          </div>
        )}
      </div>
      {busy && <p className="text-sm text-[#717171]">{t("Subiendo…")}</p>}
      {(err || voice.error) && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{t(err ?? voice.error ?? "")}</p>}
    </div>
  );
}
