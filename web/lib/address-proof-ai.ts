import "server-only";
import type { AddressProofAi } from "@/lib/address-proof-store";
import { callListingImportOpenAiJson } from "@/lib/listing-import-openai";

/** Modelo barato con visión: el volumen es un comprobante por anuncio. */
export function addressProofModel(): string {
  return process.env.ADDRESS_PROOF_OPENAI_MODEL?.trim() || "gpt-6-luna";
}

const SYSTEM = `Eres un verificador de comprobantes de domicilio para una plataforma de alojamientos.
Recibes un documento (foto o PDF), la dirección que el anfitrión declaró para su alojamiento y el nombre (o nombres) del anfitrión del anuncio.
Decide si el documento demuestra que esa propiedad existe en esa dirección y que está a nombre de quien anuncia.

Documentos válidos: recibo de luz, agua, gas, teléfono fijo, internet o cable; predial; estado de cuenta bancario;
contrato de arrendamiento o recibo de renta; constancia de situación fiscal con domicilio. Otros documentos oficiales con domicilio cuentan como "review".

El documento debe estar a nombre del anfitrión del anuncio. Compara el titular con los nombres que te damos:
- "exact": es la misma persona (mismo nombre y apellido; falta de segundo nombre o segundo apellido, acentos, mayúsculas o el orden no importan).
- "partial": coincide sólo en parte (sólo el apellido, iniciales, un familiar, una empresa que podría ser del anfitrión).
- "none": es otra persona, no hay titular o no se puede leer.

Compara la dirección del documento con la declarada:
- "exact": misma calle y número (o lote/manzana) y misma ciudad/municipio; diferencias de formato, abreviaturas o acentos no importan.
- "partial": misma colonia/zona y ciudad pero falta o difiere el número, o la dirección declarada es demasiado vaga.
- "none": otra ciudad, otra calle o no se puede leer.

Antigüedad: "recent" = emitido en los últimos 6 meses (contratos de renta vigentes también cuentan).
Señales de alteración: tipografías mezcladas, recortes, textos sobrepuestos, montos o fechas incoherentes, capturas de plantillas.

Veredicto:
- "approve": documento válido, address_match "exact", name_match "exact", recent, sin señales de alteración, confidence >= 0.75.
- "reject": no es comprobante de domicilio, address_match "none", name_match "none", o señales claras de alteración.
- "review": todo lo demás (partial, viejo, ilegible en parte, dudas).

Responde SOLO JSON:
{"document_type": string, "is_proof_of_address": boolean, "holder_name": string|null, "address_on_document": string|null,
 "issue_date": "YYYY-MM-DD"|null, "address_match": "exact"|"partial"|"none", "name_match": "exact"|"partial"|"none",
 "recent": boolean, "tampering_signs": boolean,
 "confidence": number, "verdict": "approve"|"reject"|"review", "reasons": string[] (en español, cortas, para el anfitrión)}`;

type Raw = {
  document_type?: string;
  is_proof_of_address?: boolean;
  holder_name?: string | null;
  address_on_document?: string | null;
  issue_date?: string | null;
  address_match?: string;
  name_match?: string;
  recent?: boolean;
  tampering_signs?: boolean;
  confidence?: number;
  verdict?: string;
  reasons?: string[];
};

export async function reviewAddressProof(opts: {
  declaredAddress: string;
  /** Nombre de la cuenta y, si es otro, el nombre legal del contrato del anuncio. */
  hostNames: string[];
  buffer: Buffer;
  mime: string;
}): Promise<{ ok: true; ai: AddressProofAi } | { ok: false; error: string }> {
  const model = addressProofModel();
  const base64 = opts.buffer.toString("base64");
  const isPdf = opts.mime === "application/pdf";
  const res = await callListingImportOpenAiJson<Raw>({
    model,
    system: SYSTEM,
    userText: `Dirección declarada del alojamiento: ${opts.declaredAddress}\nNombre del anfitrión del anuncio: ${
      opts.hostNames.join(" / ") || "(sin nombre)"
    }\nFecha de hoy: ${new Date().toISOString().slice(0, 10)}`,
    images: isPdf ? undefined : [{ mime: opts.mime, base64 }],
    files: isPdf ? [{ filename: "comprobante.pdf", mime: opts.mime, base64 }] : undefined,
    imageDetail: "high",
    reasoningEffort: "low",
    timeoutMs: 120_000,
  });
  if (!res.ok) return { ok: false, error: res.error };
  const d = res.data;
  const match = d.address_match === "exact" || d.address_match === "partial" ? d.address_match : "none";
  const nameMatch = d.name_match === "exact" || d.name_match === "partial" ? d.name_match : "none";
  const confidence = Math.max(0, Math.min(1, Number(d.confidence) || 0));
  const tampering = Boolean(d.tampering_signs);
  let verdict: AddressProofAi["verdict"] = d.verdict === "approve" || d.verdict === "reject" ? d.verdict : "review";
  // El modelo no aprueba solo: las reglas duras se vuelven a aplicar aquí.
  if (
    verdict === "approve" &&
    (match !== "exact" || nameMatch !== "exact" || !d.recent || tampering || confidence < 0.75 || !d.is_proof_of_address)
  ) {
    verdict = "review";
  }
  return {
    ok: true,
    ai: {
      model: res.model,
      verdict,
      documentType: String(d.document_type ?? "desconocido"),
      isProofOfAddress: Boolean(d.is_proof_of_address),
      holderName: d.holder_name ?? undefined,
      addressOnDocument: d.address_on_document ?? undefined,
      issueDate: d.issue_date ?? undefined,
      addressMatch: match,
      nameMatch,
      recent: Boolean(d.recent),
      tamperingSigns: tampering,
      confidence,
      reasons: Array.isArray(d.reasons) ? d.reasons.map(String).slice(0, 6) : [],
    },
  };
}
