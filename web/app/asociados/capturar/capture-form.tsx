"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";

const MAX_IMAGES = 10;
const MAX_MB = 8;

type Preview = { file: File; url: string };

export function CaptureForm({ hostId }: { hostId?: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = useState<Preview[]>([]);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const addFiles = useCallback((list: FileList | File[]) => {
    setPreviews((prev) => {
      const next = [...prev];
      for (const file of Array.from(list)) {
        if (next.length >= MAX_IMAGES) break;
        if (!/^image\/(jpeg|jpg|png|webp)$/i.test(file.type) || file.size > MAX_MB * 1024 * 1024) continue;
        next.push({ file, url: URL.createObjectURL(file) });
      }
      return next;
    });
  }, []);

  async function submit() {
    if (!previews.length) {
      setErr("Sube al menos una captura.");
      return;
    }
    setBusy(true);
    setErr(null);
    const fd = new FormData();
    for (const p of previews) fd.append("images", p.file);
    if (notes.trim()) fd.set("notes", notes.trim());
    if (hostId) fd.set("hostId", hostId);
    const res = await fetch("/api/associate/drafts", { method: "POST", body: fd }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (!res?.ok || !j.draft?.id) {
      setErr(typeof j.error === "string" ? j.error : "No se pudo analizar.");
      return;
    }
    router.push(`/asociados/borradores/${j.draft.id}`);
  }

  return (
    <div className="mt-6 space-y-5">
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
        }}
        onPaste={(e) => {
          const files = Array.from(e.clipboardData.files);
          if (files.length) addFiles(files);
        }}
        className="cursor-pointer rounded-xl border-2 border-dashed border-gray-300 bg-white p-8 text-center hover:border-amber-400"
      >
        <p className="text-sm font-medium text-gray-700">Arrastra, pega (Ctrl+V) o haz clic para elegir capturas</p>
        <p className="mt-1 text-xs text-gray-400">
          Hasta {MAX_IMAGES} imágenes · JPEG, PNG o WebP · máx. {MAX_MB} MB c/u
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {previews.length > 0 && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {previews.map((p, i) => (
            <li key={p.url} className="relative aspect-[3/4] overflow-hidden rounded-lg border border-gray-200 bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() =>
                  setPreviews((prev) => {
                    URL.revokeObjectURL(prev[i].url);
                    return prev.filter((_, j) => j !== i);
                  })
                }
                className="absolute right-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white"
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}

      <label className="block text-sm font-medium text-gray-700">
        Notas para la IA (opcional)
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Ej. el precio es por fin de semana; el dueño se llama Juan Pérez."
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </label>

      {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}

      <button
        type="button"
        disabled={busy}
        onClick={() => void submit()}
        className="rounded-lg bg-amber-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
      >
        {busy ? "Analizando con IA… (puede tardar un minuto)" : "Analizar"}
      </button>
    </div>
  );
}
