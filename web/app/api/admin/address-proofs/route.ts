import { NextRequest, NextResponse } from "next/server";
import { getAddressProof, listAddressProofs, updateAddressProof } from "@/lib/address-proof-store";
import { findUserById, getListingById } from "@/lib/marketplace-store";
import { notifyUser } from "@/lib/push";
import { getSessionUser } from "@/lib/session";

async function requireAdmin() {
  const user = await getSessionUser();
  return user?.role === "admin" ? user : null;
}

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const proofs = listAddressProofs().map((p) => {
    const listing = getListingById(p.listingId);
    return {
      ...p,
      listingTitle: listing?.title ?? "(anuncio borrado)",
      listingSlug: listing?.slug,
      hostEmail: findUserById(p.hostId)?.email,
    };
  });
  return NextResponse.json({ proofs });
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { id?: string; action?: string; message?: string };
  const proof = body.id ? getAddressProof(body.id) : undefined;
  if (!proof) return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  if (body.action !== "approve" && body.action !== "reject") {
    return NextResponse.json({ error: "Acción inválida." }, { status: 400 });
  }
  const approved = body.action === "approve";
  const updated = updateAddressProof(proof.id, {
    status: approved ? "approved" : "rejected",
    reviewedBy: admin.id,
    reviewedAt: new Date().toISOString(),
    hostMessage: approved
      ? undefined
      : body.message?.trim() || "El comprobante no coincide con la dirección del anuncio o no es válido. Sube otro.",
  });
  const listing = getListingById(proof.listingId);
  notifyUser(proof.hostId, {
    kind: "verification",
    title: approved ? "Ubicación verificada" : "Comprobante de domicilio rechazado",
    body: approved
      ? "«{title}» ya muestra la insignia de ubicación verificada."
      : "Revisamos el comprobante de «{title}» y no lo pudimos aprobar. Sube otro desde Verificación.",
    vars: { title: listing?.title ?? "" },
    url: "/host/verificacion",
    tag: `adp-${proof.listingId}`,
  });
  return NextResponse.json({ proof: updated });
}
