"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";

const MAX_IMAGES = 6;
const MAX_MB = 5;

type Preview = { file: File; url: string };

export default function ListingImportPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [consent, setConsent] = useState(false);
  const [notes, setNotes] = useState("");
  const [previews, setPreviews] = useState<Preview[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const addFiles = useCallback((list: FileList | File[]) => {
    const incoming = Array.from(list);
    setPreviews((prev) => {
      const next = [...prev];
      for (const file of incoming) {
        if (next.length >= MAX_IMAGES) break;
        if (!file.type.match(/^image\/(jpeg|jpg|png|webp)$/i)) continue;
        if (file.size > MAX_MB * 1024 * 1024) continue;
        next.push({ file, url: URL.createObjectURL(file) });
      }
      return next;
    });
  }, []);

  function removeAt(i: number) {
    setPreviews((prev) => {
      const copy = [...prev];
      URL.revokeObjectURL(copy[i].url);
      copy.splice(i, 1);
      return copy;
    });
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  }

  async function analyze() {
    if (!consent) {
      setErr("Acepta las condiciones para continuar.");
      return;
    }
    if (previews.length === 0) {
      setErr("Sube al menos una captura.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.set("consentAccepted", "true");
      if (notes.trim()) fd.set("notes", notes.trim());
      for (const p of previews) fd.append("images", p.file);

      const res = await fetch("/api/host/listings/import/analyze", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(typeof j.error === "string" ? j.error : `Error ${res.status}`);
        return;
      }
      const listingId = j.listingId as string | undefined;
      if (!listingId) {
        setErr("Respuesta inválida del servidor.");
        return;
      }
      try {
        sessionStorage.setItem(
          "urbnbee_listing_import_meta",
          JSON.stringify({
            warnings: j.warnings ?? [],
            fieldConfidence: j.fieldConfidence ?? {},
          })
        );
      } catch {
        /* ignore */
      }
      router.push(`/host/listings/${listingId}/edit?fromImport=1`);
      router.refresh();
    } catch {
      setErr("Error de red.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-4">
      <div>
        <h1 className="text-2xl font-semibold text-[#484848]">Importar con capturas</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#666]">
          Sube capturas de pantalla de <strong>tu</strong> anuncio (Airbnb, Marketplace, etc.). Urbnbee no
          accede a sitios externos ni a tus cuentas.
        </p>
      </div>

      <label className="flex cursor-pointer gap-3 rounded-lg border border-amber-200 bg-amber-50/60 p-4 text-sm text-[#484848]">
        <input
          type="checkbox"
          className="mt-1"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
        />
        <span>
          Soy el anfitrión o tengo permiso para usar esta información. Las capturas son de mi anuncio.
          Revisaré los datos generados; la IA puede equivocarse. Subiré mis propias fotos en el editor.
        </span>
      </label>

      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition ${
          dragOver ? "border-[#dcb81e] bg-amber-50" : "border-[#ddd] bg-white hover:border-[#bbb]"
        }`}
      >
        <p className="text-sm font-medium text-[#484848]">Arrastra capturas aquí o haz clic</p>
        <p className="mt-1 text-xs text-[#888]">
          Hasta {MAX_IMAGES} imágenes · JPEG, PNG, WebP · máx. {MAX_MB} MB c/u
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
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {previews.map((p, i) => (
            <li key={p.url} className="relative aspect-[4/3] overflow-hidden rounded-lg border border-[#eee]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeAt(i);
                }}
                className="absolute right-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white"
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}

      <div>
        <label className="text-sm font-medium text-[#484848]">Notas opcionales</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          maxLength={4000}
          placeholder="Ej. el precio en la captura es por semana, no por noche."
          className="mt-1 w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm"
        />
      </div>

      {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{err}</p>}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => void analyze()}
          className="rounded-full px-6 py-2.5 text-sm font-semibold text-black disabled:opacity-50"
          style={{ backgroundColor: "#dcb81e" }}
        >
          {busy ? "Analizando capturas…" : "Analizar y crear borrador"}
        </button>
        <Link
          href="/host/listings/new"
          className="rounded-full border border-[#ddd] px-5 py-2.5 text-sm font-medium text-[#484848] hover:bg-[#fafafa]"
        >
          Cancelar
        </Link>
      </div>
    </div>
  );
}
