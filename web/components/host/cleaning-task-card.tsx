"use client";

import { useRef, useState } from "react";
import { useLang, useT } from "@/components/i18n-provider";
import { AttendanceButtons } from "@/components/host/attendance-buttons";

export type CleaningTaskItem = {
  id: string;
  listingId: string;
  listingTitle: string;
  date: string;
  dateLabel: string;
  nextCheckIn?: string;
  nextCheckInLabel?: string;
  guestName?: string;
  assignee: string | null;
  assigneeLabel: string;
  status: "pending" | "done" | "cancelled";
  note: string;
  manual: boolean;
  photos: { id: string; url: string }[];
  cleanerUserId: string | null;
};

function dayLabel(day: string, lang: "es" | "en"): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Intl.DateTimeFormat(lang === "en" ? "en-US" : "es-MX", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** El chat vive en la app: desde el sitio se abre en app.<dominio>. */
export function appChatHref(path: string): string {
  if (typeof window === "undefined") return path;
  const { host, protocol } = window.location;
  if (host.toLowerCase().startsWith("app.")) return path;
  return `${protocol}//app.${host.replace(/^www\./i, "")}${path}`;
}

export function CleaningTaskCard({
  task,
  busy,
  requirePhoto = false,
  cleaners,
  chatPath,
  chatLabel,
  onAssign,
  onDone,
  onCancel,
  onNote,
  onChanged,
  showAssignee = false,
  attendance = false,
}: {
  /** Mostrar «Marcar entrada / salida» con ubicación. */
  attendance?: boolean;
  task: CleaningTaskItem;
  busy: boolean;
  requirePhoto?: boolean;
  /** Sólo el anfitrión puede reasignar. */
  cleaners?: { id: string; name: string }[];
  chatPath?: string | null;
  chatLabel?: string;
  onAssign?: (assignee: string | null) => void;
  onDone: (done: boolean) => void;
  onCancel?: () => void;
  onNote?: (note: string) => void;
  /** Tras subir o borrar una foto. */
  onChanged?: () => Promise<void> | void;
  /** Muestra a quién le toca (en el calendario). */
  showAssignee?: boolean;
}) {
  const t = useT();
  const lang = useLang();
  const [note, setNote] = useState(task.note);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const done = task.status === "done";
  const needsPhoto = requirePhoto && task.photos.length === 0 && !done;

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setErr(null);
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append("photo", file);
      const res = await fetch(`/api/cleaning/${task.id}/photos`, { method: "POST", body: fd }).catch(() => null);
      if (!res?.ok) {
        const j = res ? await res.json().catch(() => ({})) : {};
        setErr(typeof j.error === "string" ? j.error : "No se pudo subir la foto.");
        break;
      }
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
    await onChanged?.();
  }

  async function removePhoto(photoId: string) {
    setErr(null);
    const res = await fetch(`/api/cleaning/${task.id}/photos/${photoId}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) setErr("No se pudo borrar la foto.");
    await onChanged?.();
  }

  return (
    <li className={`rounded-xl border p-4 ${done ? "border-[#eee] bg-[#fafafa]" : "border-[#e5e5e5] bg-white"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#222] first-letter:uppercase">{dayLabel(task.date, lang)}</p>
          <p className="line-clamp-2 text-[15px] text-[#222]">{task.listingTitle}</p>
          <p className="text-xs text-[#888]">
            {[
              task.manual ? t("Limpieza extra") : task.guestName ? t("Sale {name}", { name: task.guestName }) : null,
              task.nextCheckIn ? t("Siguiente llegada: {date}", { date: dayLabel(task.nextCheckIn, lang) }) : t("Sin llegada próxima"),
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {showAssignee && (
            <p className={`mt-1 text-sm font-medium ${task.assignee ? "text-[#222]" : "text-amber-700"}`}>
              {!task.assignee
                ? t("Nadie asignado todavía")
                : done
                  ? t("La hizo: {name}", { name: t(task.assigneeLabel) })
                  : t("Le toca: {name}", { name: t(task.assigneeLabel) })}
            </p>
          )}
          {task.note && !onNote && <p className="mt-1 text-sm text-[#555]">📝 {task.note}</p>}
        </div>
        <label className={`flex shrink-0 items-center gap-2 text-sm ${needsPhoto ? "text-[#aaa]" : "text-[#222]"}`}>
          <input
            type="checkbox"
            className="h-5 w-5 accent-[#16a34a]"
            checked={done}
            disabled={busy || needsPhoto}
            onChange={(e) => onDone(e.target.checked)}
          />
          {done ? t("Hecha") : t("Marcar hecha")}
        </label>
      </div>

      {attendance && <AttendanceButtons taskId={task.id} />}

      {needsPhoto && <p className="mt-2 text-xs text-amber-700">{t("El anfitrión pide al menos una foto para marcarla como hecha.")}</p>}

      {task.photos.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {task.photos.map((p) => (
            <div key={p.id} className="relative">
              <a href={p.url} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={t("Foto de la limpieza")} className="h-20 w-20 rounded-lg object-cover" />
              </a>
              {!done && (
                <button
                  type="button"
                  aria-label={t("Borrar foto")}
                  onClick={() => void removePhoto(p.id)}
                  className="absolute -right-1.5 -top-1.5 h-6 w-6 rounded-full bg-[#222] text-xs text-white"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {err && <p className="mt-2 text-xs text-red-700">{t(err)}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!done && onChanged && task.photos.length < 6 && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              className="hidden"
              onChange={(e) => void upload(e.target.files)}
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="rounded-lg border border-[#ddd] px-3 py-1.5 text-sm text-[#222] disabled:opacity-50"
            >
              {uploading ? t("Subiendo…") : t("📷 Subir foto")}
            </button>
          </>
        )}
        {chatPath && (
          <a
            href={appChatHref(chatPath)}
            className="rounded-lg border border-[#ddd] px-3 py-1.5 text-sm text-[#222]"
          >
            💬 {chatLabel ?? t("Abrir chat")}
          </a>
        )}
        {!done && cleaners && onAssign && (
          <select
            value={task.assignee ?? ""}
            disabled={busy}
            onChange={(e) => onAssign(e.target.value || null)}
            className={`rounded-lg border px-2 py-1.5 text-sm ${task.assignee ? "border-[#ddd] text-[#222]" : "border-amber-300 bg-amber-50 text-amber-800"}`}
          >
            <option value="">{t("Sin asignar")}</option>
            {cleaners.map((c) => (
              <option key={c.id} value={c.id}>
                {t(c.name)}
              </option>
            ))}
          </select>
        )}
        {!done && onCancel && (
          <button type="button" disabled={busy} onClick={onCancel} className="text-sm text-[#888] underline">
            {t("Cancelar")}
          </button>
        )}
      </div>

      {onNote && !done && (
        <div className="mt-3 flex gap-2">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("Nota para el anfitrión (opcional)")}
            className="min-w-0 flex-1 rounded-lg border border-[#ddd] px-3 py-1.5 text-sm text-[#222]"
          />
          {note !== task.note && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onNote(note)}
              className="rounded-lg bg-[#222] px-3 py-1.5 text-sm text-white"
            >
              {t("Guardar")}
            </button>
          )}
        </div>
      )}
    </li>
  );
}
