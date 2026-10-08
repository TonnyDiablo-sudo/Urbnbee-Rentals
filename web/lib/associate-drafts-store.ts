import "server-only";
import { existsSync, readFileSync, statSync, writeFileSync } from "fs";
import { join } from "path";
import { randomBytes } from "crypto";
import type { DraftFillableField } from "@/lib/associate-draft-fields";
import type { ListingImportLlmPayload } from "@/lib/listing-import-types";
import type { ListingSourceKind } from "@/lib/marketplace-types";
import { scheduleMysql, upsertJsonBlob } from "@/lib/mysql-sync";
import { ensureDir, getDataDir } from "@/lib/runtime-paths";

const DATA_FILE = join(getDataDir(), "associate-drafts.json");

export type DraftContact = {
  hostName?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  /** Perfil de quien publica (Facebook u otro sitio) cuando el anuncio no trae teléfono ni correo. */
  profileUrl?: string;
};

export type DraftReviewIssue = {
  /** Campo del borrador, o `photos` / `address` / `contact` / `general`. */
  field: string;
  severity: "error" | "warning";
  message: string;
  /** Valor correcto según la fuente, para aplicarlo con un clic. */
  suggested?: string;
};

export type DraftReview = {
  at: string;
  model?: string;
  summary?: string;
  issues: DraftReviewIssue[];
  /** Lo que la IA rellenó en esta revisión. */
  filled: DraftFillableField[];
};

export type AssociateDraft = {
  id: string;
  associateId: string;
  status: "pending" | "published" | "discarded";
  source: { kind: ListingSourceKind; url?: string; site?: string };
  listing: ListingImportLlmPayload;
  contact: DraftContact;
  /** URLs públicas (`/uploads/associate-drafts/...`) en el orden sugerido; la primera es la portada. */
  photos: string[];
  /** Fotos que el asociado quitó; siguen en disco para poder regresarlas. */
  removedPhotos?: string[];
  warnings: string[];
  /** exact: `listing.addressLine` es calle y número. approximate: sólo se sabe la zona (`addressApprox`). */
  addressMode?: "exact" | "approximate";
  /** Referencia de ubicación cuando no hay dirección exacta: «a dos cuadras del malecón, Col. Centro». */
  addressApprox?: string;
  /** Texto y enlaces de la página original, para que la revisión con IA compare. Se borra al publicar o descartar. */
  sourceText?: string;
  sourceLinks?: string[];
  /** Capturas originales (archivos privados) cuando el borrador vino de capturas. */
  sourceShots?: string[];
  review?: DraftReview;
  /** Campos que llenó la IA y el asociado todavía no aprueba: no se publica hasta aprobarlos. */
  aiFilled?: DraftFillableField[];
  /** Cuenta a la que el asociado ya dijo que pertenece (agregar otro anuncio). */
  targetHostId?: string;
  resultHostId?: string;
  resultListingId?: string;
  /** Si el anuncio creó una cuenta nueva o se agregó a una que ya existía. */
  createdAccount?: boolean;
  publishedAt?: string;
  model?: string;
  createdAt: string;
  updatedAt: string;
};

const drafts = new Map<string, AssociateDraft>();
let cachedMtimeMs = 0;

function persist() {
  try {
    ensureDir(getDataDir());
    const snapshot = { version: 1 as const, drafts: [...drafts.values()] };
    writeFileSync(DATA_FILE, JSON.stringify(snapshot, null, 2), "utf8");
    if (existsSync(DATA_FILE)) cachedMtimeMs = statSync(DATA_FILE).mtimeMs;
    scheduleMysql(() => upsertJsonBlob("associate-drafts", snapshot));
  } catch (e) {
    console.warn("[associate-drafts] persist failed:", e);
  }
}

function reload() {
  try {
    if (!existsSync(DATA_FILE)) return;
    const data = JSON.parse(readFileSync(DATA_FILE, "utf8")) as { drafts?: AssociateDraft[] };
    drafts.clear();
    for (const d of data.drafts ?? []) if (d?.id) drafts.set(d.id, d);
    cachedMtimeMs = statSync(DATA_FILE).mtimeMs;
  } catch (e) {
    console.warn("[associate-drafts] load failed:", e);
  }
}

function syncIfStale() {
  try {
    if (!existsSync(DATA_FILE)) return;
    if (statSync(DATA_FILE).mtimeMs !== cachedMtimeMs) reload();
  } catch {
    /* ignore */
  }
}

reload();

export function newDraftId(): string {
  return `drf_${randomBytes(10).toString("hex")}`;
}

export function saveDraft(draft: AssociateDraft): AssociateDraft {
  syncIfStale();
  const next = { ...draft, updatedAt: new Date().toISOString() };
  drafts.set(next.id, next);
  persist();
  return next;
}

/** Sin la página original: pesa mucho y el navegador no la necesita. */
export function draftForClient(d: AssociateDraft): AssociateDraft {
  return { ...d, sourceText: undefined, sourceLinks: undefined, sourceShots: undefined };
}

export function getDraft(id: string): AssociateDraft | undefined {
  syncIfStale();
  return drafts.get(id);
}

export function listAllDrafts(): AssociateDraft[] {
  syncIfStale();
  return [...drafts.values()];
}

export function listDraftsForAssociate(associateId: string, status?: AssociateDraft["status"]): AssociateDraft[] {
  syncIfStale();
  return [...drafts.values()]
    .filter((d) => d.associateId === associateId && (!status || d.status === status))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
