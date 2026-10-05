import { NextResponse } from "next/server";
import sharp from "sharp";
import { reviewAddressProof } from "@/lib/address-proof-ai";
import {
  isListingLocationVerified,
  latestProofForListing,
  listAddressProofs,
  listingAddressText,
  saveAddressProof,
  updateAddressProof,
  type AddressProof,
} from "@/lib/address-proof-store";
import { getListingById, listListingsForHost } from "@/lib/marketplace-store";
import { addressCoveredListingIds } from "@/lib/address-proof-access";
import { ADDRESS_PROOF_GEOLOCATION_ENABLED } from "@/lib/feature-flags";
import { notifyUser } from "@/lib/push";
import { getSessionUser } from "@/lib/session";
import { isHostIdentityVerified } from "@/lib/verification-store";

const MAX_BYTES = 10 * 1024 * 1024;
const PER_DAY = 5;

function hostView(p: AddressProof | undefined) {
  if (!p) return null;
  return {
    status: p.status,
    createdAt: p.createdAt,
    message: p.hostMessage ?? null,
    reasons: p.status === "approved" ? [] : (p.ai?.reasons ?? []),
  };
}

/** lat/lng/accuracy opcionales del teléfono; se ignoran mientras la bandera esté apagada. */
function deviceLocationFrom(form: FormData | null | undefined): AddressProof["deviceLocation"] {
  if (!ADDRESS_PROOF_GEOLOCATION_ENABLED || !form) return undefined;
  const lat = Number(form.get("lat"));
  const lng = Number(form.get("lng"));
  const accuracy = Number(form.get("accuracy"));
  if (!form.get("lat") || !form.get("lng") || ![lat, lng, accuracy].every(Number.isFinite)) return undefined;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180 || accuracy < 0) return undefined;
  return { lat, lng, accuracyM: Math.round(accuracy), at: new Date().toISOString() };
}

export async function GET() {
  const user = await getSessionUser();
  if (!user || (user.role !== "host" && user.role !== "admin")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const covered = addressCoveredListingIds(user.id);
  const listings = listListingsForHost(user.id).map((l) => ({
    listingId: l.id,
    title: l.title,
    address: listingAddressText(l),
    hasAddress: Boolean(l.addressLine.trim() && l.city.trim()),
    locationVerified: isListingLocationVerified(l),
    covered: covered.has(l.id),
    latest: hostView(latestProofForListing(l.id)),
  }));
  return NextResponse.json({ listings, identityVerified: isHostIdentityVerified(user.id) });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user || (user.role !== "host" && user.role !== "admin")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const form = await req.formData().catch(() => null);
  const listingId = String(form?.get("listingId") ?? "");
  const file = form?.get("file");
  const listing = getListingById(listingId);
  if (!listing || listing.hostId !== user.id) {
    return NextResponse.json({ error: "Anuncio no encontrado." }, { status: 404 });
  }
  if (!listing.addressLine.trim() || !listing.city.trim()) {
    return NextResponse.json(
      { error: "Primero escribe la dirección completa del anuncio (calle y número, ciudad y estado)." },
      { status: 400 }
    );
  }
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Sube una foto o PDF del comprobante." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "El archivo pesa más de 10 MB." }, { status: 400 });
  }
  const dayAgo = Date.now() - 86_400_000;
  const recent = listAddressProofs().filter((p) => p.listingId === listing.id && Date.parse(p.createdAt) > dayAgo);
  if (recent.length >= PER_DAY) {
    return NextResponse.json({ error: "Ya subiste varios comprobantes hoy para este anuncio. Intenta mañana." }, { status: 429 });
  }

  const raw = Buffer.from(await file.arrayBuffer());
  let buffer: Buffer;
  let mime: string;
  let ext: string;
  if (file.type === "application/pdf" || raw.subarray(0, 5).toString() === "%PDF-") {
    buffer = raw;
    mime = "application/pdf";
    ext = "pdf";
  } else {
    try {
      buffer = await sharp(raw).rotate().resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
    } catch {
      return NextResponse.json({ error: "No pude leer la imagen. Sube JPG, PNG, WebP o PDF." }, { status: 400 });
    }
    mime = "image/jpeg";
    ext = "jpg";
  }

  const proof = saveAddressProof({ listing, buffer, mime, ext, deviceLocation: deviceLocationFrom(form) });
  const hostName = user.fullName || "";
  const review = await reviewAddressProof({ declaredAddress: proof.addressSnapshot, hostName, buffer, mime });

  let updated: AddressProof | undefined;
  if (!review.ok) {
    updated = updateAddressProof(proof.id, {
      status: "review",
      aiError: review.error,
      hostMessage: "No pudimos revisarlo automáticamente; lo revisará una persona del equipo.",
    });
  } else if (review.ai.verdict === "approve") {
    updated = updateAddressProof(proof.id, { status: "approved", ai: review.ai, reviewedBy: "ai", reviewedAt: new Date().toISOString() });
  } else if (review.ai.verdict === "reject") {
    updated = updateAddressProof(proof.id, {
      status: "rejected",
      ai: review.ai,
      reviewedBy: "ai",
      reviewedAt: new Date().toISOString(),
      hostMessage: "El comprobante no coincide con la dirección del anuncio o no es válido. Sube otro.",
    });
  } else {
    updated = updateAddressProof(proof.id, {
      status: "review",
      ai: review.ai,
      hostMessage: "Lo está revisando una persona del equipo (suele tardar menos de un día).",
    });
  }

  if (updated?.status === "approved") {
    notifyUser(user.id, {
      kind: "verification",
      title: "Ubicación verificada",
      body: "«{title}» ya muestra la insignia de ubicación verificada.",
      vars: { title: listing.title },
      url: "/host/verificacion",
      tag: `adp-${listing.id}`,
    });
  }

  return NextResponse.json({
    status: updated?.status ?? "review",
    locationVerified: isListingLocationVerified(listing),
    latest: hostView(updated),
  });
}
