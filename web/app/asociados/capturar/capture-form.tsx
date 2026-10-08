"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "@/components/i18n-provider";
import { SitesList } from "@/components/associates/sites-list";
import { firstUrlIn, siteFor } from "@/lib/associate-link-utils";

const MAX_IMAGES = 10;
const MAX_MB = 8;
const MIN_TEXT = 40;

type Preview = { file: File; url: string };

/** Lo que llegó desde el menú Compartir de Android. */
export type SharedPreset = { id: string; url?: string; text?: string; images: number; skipped: number };

export function CaptureForm({ hostId, preset }: { hostId?: string; preset?: SharedPreset }) {
  const t = useT();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const shotsRef = useRef<HTMLDivElement>(null);
  const [link, setLink] = useState(preset?.url ?? "");
  const [text, setText] = useState(preset?.text ?? "");
  const [previews, setPreviews] = useState<Preview[]>([]);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [needShots, setNeedShots] = useState(false);
  const [loadingShared, setLoadingShared] = useState(Boolean(preset?.images));

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
  }, [setPreviews]);

  useEffect(() => {
    if (!preset?.images) return;
    let cancelled = false;
    void Promise.all(
      Array.from({ length: preset.images }, (_, i) =>
        fetch(`/api/associate/shares/${preset.id}?img=${i}`)
          .then((r) => (r.ok ? r.blob() : null))
          .then((b) => (b ? new File([b], `compartida-${i + 1}.${b.type.split("/")[1] || "jpg"}`, { type: b.type }) : null))
          .catch(() => null)
      )
    ).then((files) => {
      if (cancelled) return;
      addFiles(files.filter((f): f is File => Boolean(f)));
      setLoadingShared(false);
    });
    return () => {
      cancelled = true;
    };
  }, [preset, addFiles]);

  async function pasteLink() {
    const clip = await navigator.clipboard?.readText().catch(() => "");
    if (!clip) {
      setErr(t("No se pudo leer el portapapeles. Mantén presionado el campo y elige Pegar."));
      return;
    }
    const url = firstUrlIn(clip);
    if (url) {
      setLink(url);
      const rest = clip.replace(url, "").trim();
      if (rest.length >= MIN_TEXT && !text) setText(rest);
    } else if (!text) {
      setText(clip.trim());
    }
    setErr(null);
  }

  const site = link.trim() ? siteFor(link) : null;
  const walled = site?.mode === "shots";
  const nothing = !link.trim() && text.trim().length < MIN_TEXT && !previews.length;
  const walledOnlyLink = walled && !previews.length && text.trim().length < MIN_TEXT;

  async function submit() {
    if (nothing) {
      setErr(t("Pega un link, el texto del anuncio o sube capturas."));
      return;
    }
    if (walledOnlyLink) {
      setNeedShots(true);
      setErr(t("{site} no deja que Cabibee abra el link. Agrega capturas del anuncio o pega su texto.", { site: site!.name }));
      shotsRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setBusy(true);
    setErr(null);
    const fd = new FormData();
    for (const p of previews) fd.append("images", p.file);
    if (link.trim()) fd.set("url", link.trim());
    if (text.trim()) fd.set("text", text.trim());
    if (notes.trim()) fd.set("notes", notes.trim());
    if (hostId) fd.set("hostId", hostId);
    const res = await fetch("/api/associate/drafts", { method: "POST", body: fd }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (!res?.ok || !j.draft?.id) {
      setErr(typeof j.error === "string" ? t(j.error, j.errorVars) : t("No se pudo analizar."));
      if (j.code === "needs_screenshots") {
        setNeedShots(true);
        shotsRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }
    if (preset) void fetch(`/api/associate/shares/${preset.id}`, { method: "DELETE" }).catch(() => {});
    router.push(`/asociados/borradores/${j.draft.id}`);
  }

  return (
    <div className="mt-6 space-y-5">
      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <label className="block text-sm font-medium text-gray-800" htmlFor="cap-link">
          🔗 {t("Link del anuncio")}
        </label>
        <div className="mt-2 flex gap-2">
          <input
            id="cap-link"
            type="url"
            inputMode="url"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://…"
            className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => void pasteLink()}
            className="shrink-0 rounded-lg border border-gray-300 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {t("Pegar")}
          </button>
        </div>
        {site && (
          <p className={`mt-2 text-xs ${walled ? "font-medium text-amber-700" : "text-green-700"}`}>
            {walled
              ? t("{site} no deja que Cabibee lea el anuncio con el puro link. Agrega capturas o pega el texto; el link queda como referencia.", { site: site.name })
              : t("{site}: con el puro link basta.", { site: site.name })}
          </p>
        )}
        <details className="mt-2">
          <summary className="cursor-pointer text-xs font-medium text-gray-600">{t("¿Qué sitios funcionan con el puro link?")}</summary>
          <div className="mt-2">
            <SitesList compact />
          </div>
        </details>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <label className="block text-sm font-medium text-gray-800" htmlFor="cap-text">
          📝 {t("Texto del anuncio (opcional)")}
        </label>
        <textarea
          id="cap-text"
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("Copia y pega aquí la descripción, precio y contacto tal como aparecen en la publicación.")}
          className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </section>

      <section
        ref={shotsRef}
        className={`rounded-xl border bg-white p-4 ${needShots && !previews.length ? "border-amber-400 ring-2 ring-amber-200" : "border-gray-200"}`}
      >
        <p className="text-sm font-medium text-gray-800">📸 {t("Capturas de pantalla")}</p>
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
          className="mt-2 cursor-pointer rounded-lg border-2 border-dashed border-gray-300 p-6 text-center hover:border-amber-400"
        >
          <p className="text-sm font-medium text-gray-700">
            <span className="hidden sm:inline">{t("Arrastra, pega (Ctrl+V) o haz clic para elegir capturas")}</span>
            <span className="sm:hidden">{t("Toca para elegir capturas de tu galería")}</span>
          </p>
          <p className="mt-1 text-xs text-gray-400">
            {t("Hasta {max} imágenes · JPEG, PNG o WebP · máx. {mb} MB c/u", { max: MAX_IMAGES, mb: MAX_MB })}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            {t("Toma captura del texto, del precio, del contacto y de cada foto abierta en pantalla completa.")}
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
        {loadingShared && <p className="mt-2 text-xs text-gray-500">{t("Cargando las imágenes compartidas…")}</p>}
        {previews.length > 0 && (
          <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
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
                  {t("Quitar")}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <label className="block text-sm font-medium text-gray-700">
        {t("Notas para la IA (opcional)")}
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t("Ej. el precio es por fin de semana; el dueño se llama Juan Pérez.")}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </label>

      {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}

      <button
        type="button"
        disabled={busy || loadingShared || nothing}
        onClick={() => void submit()}
        className="w-full rounded-lg bg-amber-500 px-6 py-3 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50 sm:w-auto sm:py-2.5"
      >
        {busy ? t("Analizando con IA… (puede tardar un minuto)") : t("Analizar")}
      </button>
    </div>
  );
}
