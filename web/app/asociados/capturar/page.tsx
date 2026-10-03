import { findUserById } from "@/lib/marketplace-store";
import { CaptureForm } from "./capture-form";

export default async function CapturePage({ searchParams }: { searchParams: Promise<{ host?: string }> }) {
  const { host } = await searchParams;
  const target = host ? findUserById(host) : undefined;
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold text-gray-900">Subir capturas</h1>
      <p className="mt-2 text-sm leading-relaxed text-gray-600">
        Para anuncios de WhatsApp o del celular. Sube capturas del anuncio: texto, precio, contacto y cada foto. GPT lee los datos y Gemini
        recorta las fotos. Para que las fotos salgan bien, abre cada foto en pantalla completa antes de tomarle captura.
      </p>
      {target && (
        <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Este anuncio se agregará a la cuenta de <strong>{target.fullName}</strong>.
        </p>
      )}
      <CaptureForm hostId={target?.id} />
    </div>
  );
}
