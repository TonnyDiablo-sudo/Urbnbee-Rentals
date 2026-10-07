import "server-only";
import { isPlaceholderEmail } from "@/lib/associate-provision";
import { CLEANING_TOOL_OFF_ERROR } from "@/lib/cleaning-service";
import { publicNameOf } from "@/lib/display-name";
import { emailLayout, emailT, escapeHtml, sendEmail } from "@/lib/email";
import { isLang } from "@/lib/i18n";
import { alarmOn } from "@/lib/notification-prefs-store";
import { findUserById, getListingById, listListingsForHost } from "@/lib/marketplace-store";
import { notifyUser } from "@/lib/push";
import { addSupply, deleteSupply, getSupply, listSupplies, updateSupply, type SupplyItem } from "@/lib/supplies-store";
import { hostHasCleaningTool, memberEffectiveRoles } from "@/lib/team-access";
import { activeMembership, getTeamMember, listTeamForHost, memberCoversListing, type TeamMember } from "@/lib/team-store";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string; status: number };

const MAX_ITEMS = 200;
const MAX_QTY = 99_999;

/**
 * Insumos: el anfitrión siempre (en vista previa los anota y configura; los avisos salen cuando
 * la herramienta está en marcha), o alguien de su equipo de limpieza con la herramienta activa.
 */
function actorFor(userId: string, hostId: string): { owner: boolean; member?: TeamMember } | null {
  if (userId === hostId) return { owner: true };
  if (!hostHasCleaningTool(hostId)) return null;
  const m = activeMembership(userId, hostId);
  return m && memberEffectiveRoles(m).includes("cleaning") ? { owner: false, member: m } : null;
}

function sees(actor: { owner: boolean; member?: TeamMember }, item: Pick<SupplyItem, "listingId">): boolean {
  return actor.owner || !item.listingId || memberCoversListing(actor.member!, item.listingId);
}

function nameOfMember(id: string): string {
  if (id === "host") return "Anfitrión";
  const m = getTeamMember(id);
  const u = m?.userId ? findUserById(m.userId) : undefined;
  return (u && publicNameOf(u)) || m?.email || "—";
}

function itemView(i: SupplyItem) {
  return {
    id: i.id,
    listingId: i.listingId,
    listingTitle: i.listingId ? getListingById(i.listingId)?.title || "Anuncio" : null,
    name: i.name,
    emoji: i.emoji,
    qty: i.qty,
    min: i.min,
    alertTo: i.alertTo,
    low: i.qty <= i.min,
    lowSince: i.lowSince ?? null,
    updatedAt: i.updatedAt,
    updatedByName: (() => {
      const u = findUserById(i.updatedBy);
      return (u && publicNameOf(u)) || "";
    })(),
  };
}

export type SupplyView = ReturnType<typeof itemView>;

export function suppliesView(userId: string, hostId: string) {
  const actor = actorFor(userId, hostId);
  if (!actor) return null;
  const listings = listListingsForHost(hostId)
    .filter((l) => actor.owner || memberCoversListing(actor.member!, l.id))
    .map((l) => ({ id: l.id, title: l.title || "Sin título" }));
  const recipients = actor.owner
    ? [
        { id: "host", name: "Yo" },
        ...listTeamForHost(hostId)
          .filter((m) => m.status === "active")
          .map((m) => ({ id: m.id, name: nameOfMember(m.id) })),
      ]
    : [];
  return {
    owner: actor.owner,
    /** false = vista previa: se anotan insumos, pero no se manda ningún aviso de compra. */
    live: hostHasCleaningTool(hostId),
    items: listSupplies(hostId)
      .filter((i) => sees(actor, i))
      .sort((a, b) => Number(b.qty <= b.min) - Number(a.qty <= a.min) || a.name.localeCompare(b.name))
      .map(itemView),
    listings,
    recipients,
  };
}

function cleanInt(raw: unknown, fallback: number): number {
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  return Number.isFinite(n) ? Math.max(0, Math.min(MAX_QTY, Math.round(n))) : fallback;
}

function cleanRecipients(hostId: string, raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const valid = new Set(["host", ...listTeamForHost(hostId).filter((m) => m.status === "active").map((m) => m.id)]);
  const out = [...new Set(raw.filter((x): x is string => typeof x === "string" && valid.has(x)))];
  return out.length ? out : ["host"];
}

const APP_ORIGIN = (process.env.APP_PUBLIC_ORIGIN?.trim() || "https://app.cabibee.com").replace(/\/$/, "");

function emailLowStock(userId: string, item: SupplyItem, where: string, url: string) {
  const u = findUserById(userId);
  if (!u?.email || isPlaceholderEmail(u.email) || !alarmOn(userId, "supplies")) return;
  const lang = isLang(u.lang) ? u.lang : "es";
  const t = emailT(lang);
  const vars = { name: `${item.emoji} ${item.name}`, qty: item.qty, where, min: item.min };
  const title = t("Hay que comprar: {name}", vars);
  const body = t("Quedan {qty} en {where} (mínimo {min}).", vars);
  void sendEmail({
    mailbox: "noreply",
    to: u.email,
    subject: title,
    text: `${body} ${APP_ORIGIN}${url}`,
    html: emailLayout({
      lang,
      title: escapeHtml(title),
      paragraphs: [
        t("Hola {name},", { name: escapeHtml(publicNameOf(u) || u.fullName || "") }),
        escapeHtml(body),
        t("Puedes apagar estas alarmas en tu centro de alarmas."),
      ],
      button: { href: `${APP_ORIGIN}${url}`, label: t("Ver insumos") },
    }),
  }).catch((e) => console.warn("[supplies] email failed:", e));
}

function alertLow(item: SupplyItem) {
  // Vista previa: la herramienta no trabaja, así que no se avisa a nadie que hay que comprar.
  if (!hostHasCleaningTool(item.hostId)) return;
  const where = item.listingId ? getListingById(item.listingId)?.title || "tu anuncio" : "la bodega";
  for (const to of item.alertTo.length ? item.alertTo : ["host"]) {
    const userId = to === "host" ? item.hostId : getTeamMember(to)?.userId;
    if (!userId) continue;
    const url = userId === item.hostId ? "/host/limpieza#insumos" : "/equipo";
    notifyUser(userId, {
      kind: "cleaning",
      title: "Hay que comprar: {name}",
      body: "Quedan {qty} en {where} (mínimo {min}).",
      vars: { name: `${item.emoji} ${item.name}`, qty: item.qty, where, min: item.min },
      url,
      tag: `supply:${item.id}`,
    });
    emailLowStock(userId, item, where, url);
  }
}

/** Guarda la cantidad y avisa sólo cuando cruza el mínimo, no en cada cambio. */
function applyQty(item: SupplyItem, qty: number, by: string, wasLow = item.qty <= item.min) {
  const next = updateSupply(item.id, {
    qty,
    updatedBy: by,
    lowSince: qty <= item.min ? (item.lowSince ?? new Date().toISOString()) : undefined,
  });
  if (next && qty <= next.min && !wasLow) alertLow(next);
}

export function createSupply(userId: string, hostId: string, raw: Record<string, unknown>): Result {
  const actor = actorFor(userId, hostId);
  if (!actor) return { ok: false, error: CLEANING_TOOL_OFF_ERROR, status: 403 };
  const name = typeof raw.name === "string" ? raw.name.replace(/\s+/g, " ").trim().slice(0, 50) : "";
  if (!name) return { ok: false, error: "Ponle nombre al insumo.", status: 400 };
  if (listSupplies(hostId).length >= MAX_ITEMS) return { ok: false, error: `Máximo ${MAX_ITEMS} insumos.`, status: 409 };
  const listingId = typeof raw.listingId === "string" && raw.listingId ? raw.listingId : null;
  if (listingId) {
    const l = getListingById(listingId);
    if (!l || l.hostId !== hostId || !sees(actor, { listingId })) return { ok: false, error: "Anuncio no encontrado.", status: 400 };
  }
  const emoji = typeof raw.emoji === "string" && raw.emoji.trim() ? Array.from(raw.emoji.trim()).slice(0, 2).join("") : "📦";
  const qty = cleanInt(raw.qty, 0);
  const min = cleanInt(raw.min, 2);
  const item = addSupply({
    hostId,
    listingId,
    name,
    emoji,
    qty,
    min,
    alertTo: (actor.owner && cleanRecipients(hostId, raw.alertTo)) || ["host"],
    lowSince: qty <= min ? new Date().toISOString() : undefined,
    updatedBy: userId,
  });
  if (item.qty <= item.min) alertLow(item);
  return { ok: true };
}

/** El equipo cambia cantidades; nombre, mínimo y a quién avisar sólo el anfitrión. */
export function editSupply(userId: string, id: string, raw: Record<string, unknown>): Result {
  const item = getSupply(id);
  const actor = item ? actorFor(userId, item.hostId) : null;
  if (!item || !actor || !sees(actor, item)) return { ok: false, error: "No encontrado.", status: 404 };
  const wasLow = item.qty <= item.min;
  if (actor.owner) {
    const patch: Partial<SupplyItem> = {};
    if (typeof raw.name === "string" && raw.name.trim()) patch.name = raw.name.replace(/\s+/g, " ").trim().slice(0, 50);
    if (typeof raw.emoji === "string" && raw.emoji.trim()) patch.emoji = Array.from(raw.emoji.trim()).slice(0, 2).join("");
    if (raw.min !== undefined) patch.min = cleanInt(raw.min, item.min);
    const to = raw.alertTo !== undefined ? cleanRecipients(item.hostId, raw.alertTo) : null;
    if (to) patch.alertTo = to;
    if (Object.keys(patch).length) updateSupply(id, patch);
  }
  const fresh = getSupply(id)!;
  if (typeof raw.delta === "number") applyQty(fresh, cleanInt(fresh.qty + raw.delta, fresh.qty), userId, wasLow);
  else if (raw.qty !== undefined) applyQty(fresh, cleanInt(raw.qty, fresh.qty), userId, wasLow);
  else if (raw.min !== undefined && actor.owner) applyQty(fresh, fresh.qty, userId, wasLow);
  return { ok: true };
}

export function removeSupply(userId: string, id: string): Result {
  const item = getSupply(id);
  if (!item || item.hostId !== userId || !actorFor(userId, item.hostId)) return { ok: false, error: "No encontrado.", status: 404 };
  deleteSupply(id);
  return { ok: true };
}
