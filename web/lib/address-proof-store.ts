import "server-only";
import { randomBytes } from "crypto";
import { existsSync, mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from "fs";
import { join } from "path";
import type { HostListingRecord } from "@/lib/marketplace-types";
import { scheduleMysql, upsertJsonBlob } from "@/lib/mysql-sync";
import { ensureDir, getDataDir } from "@/lib/runtime-paths";

/** Los comprobantes son privados: viven en la carpeta de datos, nunca en /uploads. */
const DATA_FILE = join(getDataDir(), "address-proofs.json");
const FILES_DIR = join(getDataDir(), "address-proofs");

export type AddressProofStatus = "pending" | "approved" | "rejected" | "review";

export type AddressProofAi = {
  model: string;
  verdict: "approve" | "reject" | "review";
  documentType: string;
  isProofOfAddress: boolean;
  holderName?: string;
  addressOnDocument?: string;
  issueDate?: string;
  addressMatch: "exact" | "partial" | "none";
  recent: boolean;
  tamperingSigns: boolean;
  confidence: number;
  reasons: string[];
};

export type AddressProof = {
  id: string;
  listingId: string;
  hostId: string;
  fileName: string;
  mime: string;
  /** DirecciÃ³n del anuncio cuando se subiÃ³: si el anfitriÃ³n la cambia, la insignia se cae. */
  addressSnapshot: string;
  addressKey: string;
  status: AddressProofStatus;
  ai?: AddressProofAi;
  aiError?: string;
  /** Lo que ve el anfitriÃ³n cuando no se aprobÃ³. */
  hostMessage?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  /** Ubicación que compartió el teléfono al subirlo (sólo con ADDRESS_PROOF_GEOLOCATION_ENABLED). */
  deviceLocation?: { lat: number; lng: number; accuracyM: number; at: string };
  /** Metros entre el teléfono y el punto del anuncio. */
  deviceDistanceM?: number;
};

/** Distancia en metros entre dos puntos (haversine). */
export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

let rows: AddressProof[] = [];
let cachedMtimeMs = -1;

function load() {
  try {
    if (!existsSync(DATA_FILE)) return;
    const m = statSync(DATA_FILE).mtimeMs;
    if (m === cachedMtimeMs) return;
    rows = (JSON.parse(readFileSync(DATA_FILE, "utf8")) as { proofs?: AddressProof[] }).proofs ?? [];
    cachedMtimeMs = m;
  } catch (e) {
    console.warn("[address-proofs] load failed:", e);
  }
}

function persist() {
  try {
    ensureDir(getDataDir());
    const snapshot = { version: 1 as const, proofs: rows };
    writeFileSync(DATA_FILE, JSON.stringify(snapshot, null, 2), "utf8");
    cachedMtimeMs = statSync(DATA_FILE).mtimeMs;
    scheduleMysql(() => upsertJsonBlob("address-proofs", snapshot));
  } catch (e) {
    console.warn("[address-proofs] persist failed:", e);
  }
}

function norm(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function listingAddressText(l: Pick<HostListingRecord, "addressLine" | "zone" | "county" | "city" | "state" | "country">): string {
  return [l.addressLine, l.zone, l.county, l.city, l.state, l.country].map((x) => x?.trim()).filter(Boolean).join(", ");
}

function addressKeyOf(l: Parameters<typeof listingAddressText>[0]): string {
  return norm([l.addressLine, l.city, l.state, l.country].filter(Boolean).join(" "));
}

export function saveAddressProof(input: {
  listing: HostListingRecord;
  buffer: Buffer;
  mime: string;
  ext: string;
  deviceLocation?: AddressProof["deviceLocation"];
}): AddressProof {
  load();
  mkdirSync(FILES_DIR, { recursive: true });
  const id = `adp_${randomBytes(10).toString("hex")}`;
  const fileName = `${id}.${input.ext}`;
  writeFileSync(join(FILES_DIR, fileName), input.buffer);
  const proof: AddressProof = {
    id,
    listingId: input.listing.id,
    hostId: input.listing.hostId,
    fileName,
    mime: input.mime,
    addressSnapshot: listingAddressText(input.listing),
    addressKey: addressKeyOf(input.listing),
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  const loc = input.deviceLocation;
  if (loc) {
    proof.deviceLocation = loc;
    if (Number.isFinite(input.listing.lat) && Number.isFinite(input.listing.lng) && (input.listing.lat || input.listing.lng)) {
      proof.deviceDistanceM = Math.round(distanceMeters(loc, { lat: input.listing.lat, lng: input.listing.lng }));
    }
  }
  rows.push(proof);
  persist();
  return proof;
}

export function readAddressProofFile(p: AddressProof): Buffer | null {
  const path = join(FILES_DIR, p.fileName);
  return existsSync(path) ? readFileSync(path) : null;
}

export function updateAddressProof(id: string, patch: Partial<AddressProof>): AddressProof | undefined {
  load();
  const i = rows.findIndex((r) => r.id === id);
  if (i < 0) return undefined;
  rows[i] = { ...rows[i], ...patch };
  persist();
  return rows[i];
}

export function getAddressProof(id: string): AddressProof | undefined {
  load();
  return rows.find((r) => r.id === id);
}

export function listAddressProofs(): AddressProof[] {
  load();
  return [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function latestProofForListing(listingId: string): AddressProof | undefined {
  load();
  return rows.filter((r) => r.listingId === listingId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

/** Insignia "UbicaciÃ³n verificada": comprobante aprobado y la direcciÃ³n del anuncio no ha cambiado desde entonces. */
export function isListingLocationVerified(l: HostListingRecord): boolean {
  load();
  const key = addressKeyOf(l);
  return Boolean(key) && rows.some((r) => r.listingId === l.id && r.status === "approved" && r.addressKey === key);
}

/** Borra comprobantes y archivos de un anuncio (al borrar el anuncio o la cuenta). */
export function deleteProofsForListing(listingId: string): void {
  load();
  const gone = rows.filter((r) => r.listingId === listingId);
  if (!gone.length) return;
  for (const r of gone) {
    try {
      unlinkSync(join(FILES_DIR, r.fileName));
    } catch {
      /* ya no estaba */
    }
  }
  rows = rows.filter((r) => r.listingId !== listingId);
  persist();
}
