import Link from "next/link";
import { listingImportAiEnabled } from "@/lib/listing-import-limits";

export default function NewListingChoicePage() {
  const aiEnabled = listingImportAiEnabled();

  return (
    <div className="mx-auto max-w-3xl space-y-8 py-4">
      <div>
        <h1 className="text-2xl font-semibold text-[#484848]">Nuevo alojamiento</h1>
        <p className="mt-2 text-sm text-[#888]">Elige cómo quieres empezar.</p>
      </div>

      <div className={`grid gap-4 ${aiEnabled ? "sm:grid-cols-2" : "max-w-md"}`}>
        <Link
          href="/host/listings/new/manual"
          className="flex flex-col rounded-xl border-2 border-[#ebebeb] bg-white p-6 shadow-sm transition hover:border-black hover:shadow-md"
        >
          <span className="text-lg font-semibold text-[#222]">Manual</span>
          <p className="mt-2 flex-1 text-sm leading-relaxed text-[#666]">
            Creas un borrador vacío y completas fotos, descripción, ubicación y precio tú mismo.
          </p>
          <span className="mt-4 text-sm font-semibold text-[#dcb81e]">Continuar →</span>
        </Link>

        {aiEnabled ? (
          <Link
            href="/host/listings/import"
            className="flex flex-col rounded-xl border-2 border-[#dcb81e]/50 bg-amber-50/40 p-6 shadow-sm transition hover:border-[#dcb81e] hover:shadow-md"
          >
            <span className="text-lg font-semibold text-[#222]">Asistido con capturas</span>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-[#666]">
              Sube capturas de pantalla de tu anuncio en otra plataforma. La IA prellena el borrador;
              tú revisas antes de publicar.
            </p>
            <span className="mt-4 text-sm font-semibold text-amber-900">Usar capturas →</span>
          </Link>
        ) : (
          <div className="rounded-xl border border-dashed border-[#ddd] bg-[#fafafa] p-6 text-sm text-[#888]">
            Importación con IA deshabilitada. Configura <code className="text-xs">OPENAI_API_KEY</code> en
            el servidor.
          </div>
        )}
      </div>

      <Link href="/host/listings" className="inline-block text-sm text-[#888] hover:text-[#484848]">
        ← Volver a mis alojamientos
      </Link>
    </div>
  );
}
