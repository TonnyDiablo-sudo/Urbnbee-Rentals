import "server-only";
import { analyticsDayKey, shiftDayKey } from "@/lib/analytics-day";
import { attendanceEnabled } from "@/lib/attendance-flag";
import type { BookingRecord } from "@/lib/booking-types";
import { listAllBookings, listBookingsForHost } from "@/lib/bookings-store";
import { randomBytes } from "crypto";
import {
  addCleaningTask,
  allCleaningTasks,
  findTaskForBooking,
  getCleaningSettings,
  setCleaningSettings,
  type CleaningSettings,
  getCleaningTask,
  getListingCleaner,
  getListingCleaners,
  listCleaningTasksForHost,
  setListingCleaners,
  updateCleaningTask,
  type CleaningAssignee,
  type CleaningTask,
} from "@/lib/cleaning-store";
import { publicNameOf } from "@/lib/display-name";
import { findUserById, getListingById, listListingsForHost, updateListing } from "@/lib/marketplace-store";
import { notifyUser } from "@/lib/push";
import { getHostEntitlement } from "@/lib/host-entitlements-store";
import { HOST_SKU_CLEANING } from "@/lib/host-entitlement-types";
import { compressPhoto, deletePrivateFile, getPrivateFile, putPrivateFile } from "@/lib/private-files";
import { hostHasCleaningTool, memberEffectiveRoles } from "@/lib/team-access";
import { getTeamMember, listMembershipsForUser, listTeamForHost, memberCoversListing } from "@/lib/team-store";

const LIVE: BookingRecord["status"][] = ["CONFIRMED", "COMPLETED"];
const DEAD: BookingRecord["status"][] = ["CANCELLED", "REJECTED", "EXPIRED"];

export const CLEANING_TOOL_OFF_ERROR = "Activa la herramienta de limpieza en la Tienda para usar esta sección.";

const listingOf = (b: BookingRecord) => b.hostAdjustedListingId ?? b.listingId;
const dayOf = (iso: string) => iso.slice(0, 10);

/** Sin hora acordada se toma la hora típica de salida. */
const DEFAULT_TIME = "11:00";
const HOUR_MS = 3_600_000;
/** Si la limpieza nace dentro del plazo para confirmar, se le dan estas horas antes de avisar al anfitrión. */
const LATE_GRACE_HOURS = 2;
export const CONFIRM_HOUR_OPTIONS = [0, 12, 24, 48, 72];
export const CANCEL_HOUR_OPTIONS = [0, 12, 24, 48, 72];

export function formatCleaningDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Intl.DateTimeFormat("es-MX", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d))
  );
}

/** Inicio de la limpieza en hora de México (UTC−6, sin horario de verano). */
function startMs(t: Pick<CleaningTask, "date" | "time">): number {
  return Date.parse(`${t.date}T${t.time ?? DEFAULT_TIME}:00-06:00`);
}

function listingTitle(listingId: string) {
  return getListingById(listingId)?.title || "tu anuncio";
}

const byMember = (a: CleaningAssignee | undefined): a is string => Boolean(a && a !== "host");

/** A quién avisar de una tarea: la persona asignada o, si no hay, el anfitrión. */
function recipientOf(task: CleaningTask): { userId: string; url: string } | null {
  if (byMember(task.assignee)) {
    const m = getTeamMember(task.assignee);
    if (m?.status === "active" && m.userId) return { userId: m.userId, url: "/equipo" };
  }
  return { userId: task.hostId, url: "/host/limpieza" };
}

type Vars = Record<string, string | number>;

function taskVars(t: CleaningTask, extra: Vars = {}): Vars {
  return { listing: listingTitle(t.listingId), date: formatCleaningDay(t.date) + (t.time ? ` · ${t.time}` : ""), ...extra };
}

function notify(task: CleaningTask, title: string, body: string, vars: Vars = taskVars(task), tag = `cleaning:${task.id}`) {
  const to = recipientOf(task);
  if (!to) return;
  notifyUser(to.userId, { kind: "cleaning", title, body, vars, url: to.url, tag });
}

function notifyHost(task: CleaningTask, title: string, body: string, vars: Vars, tag = `cleaning:${task.id}`) {
  notifyUser(task.hostId, { kind: "cleaning", title, body, vars, url: "/host/limpieza", tag });
}

const MAX_PHOTOS = 6;
/** Las fotos se borran solas: sólo sirven para revisar la limpieza, no como archivo. */
const PHOTO_RETENTION_DAYS = 60;

/** Anuncios pagados en la herramienta de limpieza. */
export function cleaningCapacity(hostId: string): number {
  if (!hostHasCleaningTool(hostId)) return 0;
  return Math.max(0, getHostEntitlement(hostId, HOST_SKU_CLEANING)?.quantity ?? 1);
}

/** Anuncios que hoy están en la herramienta: los primeros N que encendió (por fecha de alta). */
export function cleaningListingIds(hostId: string): Set<string> {
  const cap = cleaningCapacity(hostId);
  if (cap === 0) return new Set();
  return new Set(
    listListingsForHost(hostId)
      .filter((l) => l.cleaningOn)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .slice(0, cap)
      .map((l) => l.id)
  );
}

/** El miembro puede limpiar ese anuncio hoy (rol activo y acceso al anuncio). */
function validCleaner(hostId: string, listingId: string, assignee: CleaningAssignee | undefined): boolean {
  if (!assignee || assignee === "host") return true;
  const m = getTeamMember(assignee);
  return Boolean(
    m && m.hostId === hostId && m.status === "active" && memberCoversListing(m, listingId) && memberEffectiveRoles(m).includes("cleaning")
  );
}

/**
 * En automático: la primera de la lista de prioridad que puede y no la ha cancelado.
 * Sin lista, la única persona que puede limpiar ese anuncio.
 */
function autoCleaner(hostId: string, listingId: string, skip: Set<string> = new Set()): CleaningAssignee | undefined {
  const list = getListingCleaners(listingId);
  if (list.length) return list.find((a) => !skip.has(a) && validCleaner(hostId, listingId, a));
  const able = listTeamForHost(hostId).filter((m) => !skip.has(m.id) && validCleaner(hostId, listingId, m.id));
  return able.length === 1 ? able[0].id : undefined;
}

/** Al cambiar de persona se vuelve a pedir confirmación. */
function freshAssignment(a: CleaningAssignee | undefined): Partial<CleaningTask> {
  const now = new Date().toISOString();
  return {
    assignee: a,
    remindedAt: undefined,
    unconfirmedWarnedAt: undefined,
    confirmAskedAt: byMember(a) ? now : undefined,
    confirmedAt: a === "host" ? now : undefined,
  };
}

function askToConfirm(t: CleaningTask, title = "Confirma tu limpieza") {
  if (!byMember(t.assignee)) return;
  const { confirmHours } = getCleaningSettings(t.hostId);
  notify(
    t,
    title,
    confirmHours > 0
      ? "{listing} · {date}. Confirma que sí puedes, a más tardar {hours} h antes."
      : "{listing} · {date}. Confirma que sí puedes.",
    taskVars(t, { hours: confirmHours })
  );
}

function nextArrival(bookings: BookingRecord[], listingId: string, after: string, exceptId: string): string | undefined {
  return bookings
    .filter((b) => b.id !== exceptId && listingOf(b) === listingId && LIVE.includes(b.status) && dayOf(b.checkIn) >= after)
    .map((b) => dayOf(b.checkIn))
    .sort()[0];
}

/** Crea, mueve o cancela las limpiezas según las reservas del anfitrión. */
export function syncCleaningForHost(hostId: string) {
  if (!hostHasCleaningTool(hostId)) return;
  const on = cleaningListingIds(hostId);
  if (on.size === 0) return;
  const { assignMode } = getCleaningSettings(hostId);
  const bookings = listBookingsForHost(hostId);
  const since = shiftDayKey(analyticsDayKey(), -2);

  for (const b of bookings) {
    const listingId = listingOf(b);
    const existing = findTaskForBooking(b.id);
    if (DEAD.includes(b.status)) {
      if (existing?.status === "pending") {
        const t = updateCleaningTask(existing.id, { status: "cancelled" });
        if (t) notify(t, "Limpieza cancelada", "Se canceló la reserva de {listing} del {date}.");
      }
      continue;
    }
    if (!LIVE.includes(b.status) || !on.has(listingId)) continue;
    const date = dayOf(b.checkOut);
    const nextCheckIn = nextArrival(bookings, listingId, date, b.id);
    if (existing) {
      if (existing.status === "pending" && existing.dateLocked) {
        if (existing.nextCheckIn !== nextCheckIn) updateCleaningTask(existing.id, { nextCheckIn });
        continue;
      }
      if (existing.status === "pending" && (existing.date !== date || existing.nextCheckIn !== nextCheckIn)) {
        const moved = existing.date !== date;
        const t = updateCleaningTask(existing.id, {
          date,
          nextCheckIn,
          ...(moved ? { remindedAt: undefined, ...(byMember(existing.assignee) ? freshAssignment(existing.assignee) : {}) } : {}),
        });
        if (t && moved) notify(t, "Cambió una limpieza", "{listing}: ahora es el {date}. Vuelve a confirmar que sí puedes.");
      }
      continue;
    }
    if (date < since) continue;
    const assignee = assignMode === "auto" ? autoCleaner(hostId, listingId) : undefined;
    const task = addCleaningTask({
      hostId,
      listingId,
      bookingId: b.id,
      date,
      nextCheckIn,
      guestName: b.guestName,
      ...freshAssignment(assignee),
    });
    if (byMember(task.assignee)) askToConfirm(task, "Nueva limpieza: confirma que sí puedes");
    else if (!task.assignee) notify(task, "Nueva limpieza sin asignar", "{listing} · {date}. Elige quién va.");
  }
}

/**
 * Recordatorios: a quien limpia el día anterior y, si al vencer el plazo
 * todavía no confirma, se le avisa al anfitrión (una sola vez).
 */
export function runCleaningReminders(hostId: string) {
  if (!hostHasCleaningTool(hostId)) return;
  const { confirmHours } = getCleaningSettings(hostId);
  const today = analyticsDayKey();
  const tomorrow = shiftDayKey(today, 1);
  const now = Date.now();
  for (const t of listCleaningTasksForHost(hostId)) {
    if (t.status !== "pending") continue;

    if (byMember(t.assignee) && !t.confirmedAt && !t.unconfirmedWarnedAt && startMs(t) > now - 12 * HOUR_MS) {
      const deadline = startMs(t) - confirmHours * HOUR_MS;
      const asked = t.confirmAskedAt ? Date.parse(t.confirmAskedAt) : Date.parse(t.createdAt);
      if (now >= Math.max(deadline, asked + LATE_GRACE_HOURS * HOUR_MS)) {
        notifyHost(t, "{name} no ha confirmado una limpieza", "{listing} · {date}. Escríbele o asígnala a alguien más.", taskVars(t, { name: assigneeLabel(t.assignee) }), `cleaning-unconfirmed:${t.id}`);
        askToConfirm(t, "Falta que confirmes tu limpieza");
        updateCleaningTask(t.id, { unconfirmedWarnedAt: new Date().toISOString() });
      }
    }

    if (t.remindedAt || (t.date !== today && t.date !== tomorrow)) continue;
    const vars = taskVars(t, { next: t.nextCheckIn ? formatCleaningDay(t.nextCheckIn) : "" });
    const title = t.date === today ? (t.assignee ? "Hoy: limpieza" : "Hoy: limpieza sin asignar") : t.assignee ? "Mañana: limpieza" : "Mañana: limpieza sin asignar";
    notify(t, title, t.nextCheckIn ? "{listing} · {date} · llega huésped {next}." : "{listing} · {date}.", vars);
    updateCleaningTask(t.id, { remindedAt: new Date().toISOString() });
  }
}

export function refreshCleaning(hostId: string) {
  syncCleaningForHost(hostId);
  runCleaningReminders(hostId);
}

let workerStarted = false;
export function startCleaningWorker() {
  if (workerStarted) return;
  workerStarted = true;
  const tick = () => {
    try {
      const hosts = new Set(listAllBookings().map((b) => b.hostId));
      for (const h of hosts) if (hostHasCleaningTool(h)) refreshCleaning(h);
      void purgeOldPhotos();
    } catch (e) {
      console.warn("[cleaning] worker:", e);
    }
  };
  setTimeout(tick, 20_000);
  setInterval(tick, 30 * 60 * 1000);
}

async function purgeOldPhotos() {
  const cutoff = shiftDayKey(analyticsDayKey(), -PHOTO_RETENTION_DAYS);
  for (const t of allCleaningTasks()) {
    if (!t.photos?.length || t.date >= cutoff) continue;
    for (const p of t.photos) if (p.key) await deletePrivateFile(p.key);
    updateCleaningTask(t.id, { photos: [] });
  }
}

function memberName(memberId: string): string {
  const m = getTeamMember(memberId);
  if (!m) return "—";
  const u = m.userId ? findUserById(m.userId) : undefined;
  return (u && publicNameOf(u)) || m.email;
}

function assigneeLabel(a: CleaningAssignee | undefined): string {
  if (!a) return "Sin asignar";
  return a === "host" ? "Yo" : memberName(a);
}

function taskView(t: CleaningTask) {
  const s = getCleaningSettings(t.hostId);
  const start = startMs(t);
  return {
    id: t.id,
    listingId: t.listingId,
    listingTitle: listingTitle(t.listingId),
    date: t.date,
    dateLabel: formatCleaningDay(t.date) + (t.time ? ` · ${t.time}` : ""),
    time: t.time ?? null,
    nextCheckIn: t.nextCheckIn,
    nextCheckInLabel: t.nextCheckIn ? formatCleaningDay(t.nextCheckIn) : undefined,
    guestName: t.guestName,
    assignee: t.assignee ?? null,
    assigneeLabel: assigneeLabel(t.assignee),
    status: t.status,
    note: t.note ?? "",
    manual: !t.bookingId,
    doneAt: t.doneAt,
    photos: (t.photos ?? []).map((p) => ({ id: p.id, url: p.url ?? `/api/cleaning/${t.id}/photos/${p.id}` })),
    /** Cuenta de quien limpia, para abrir el chat con el anfitrión. */
    cleanerUserId: byMember(t.assignee) ? (getTeamMember(t.assignee)?.userId ?? null) : null,
    /** Hace falta que la persona asignada diga que sí puede. */
    needsConfirm: t.status === "pending" && byMember(t.assignee) && !t.confirmedAt,
    confirmedAt: t.confirmedAt ?? null,
    confirmBy: new Date(start - s.confirmHours * HOUR_MS).toISOString(),
    /** Hasta cuándo quien limpia puede cancelar por su cuenta. */
    cancelBy: new Date(start - s.cancelHours * HOUR_MS).toISOString(),
    canCancel: t.status === "pending" && Date.now() <= start - s.cancelHours * HOUR_MS,
    cancellations: (t.cancellations ?? []).map((c) => ({ name: assigneeLabel(c.assignee), at: c.at, reason: c.reason })),
    approval: t.approval ?? null,
    approvedAt: t.approvedAt ?? null,
    redoNote: t.redoNote ?? "",
  };
}

export type CleaningTaskView = ReturnType<typeof taskView>;

function visibleTasks(list: CleaningTask[], doneDays = 14) {
  const since = shiftDayKey(analyticsDayKey(), -doneDays);
  return list
    .filter((t) => t.status === "pending" || (t.status === "done" && (t.date >= since || t.approval === "pending")))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(taskView);
}

/** Panel del anfitrión. */
export function hostCleaningView(hostId: string) {
  const active = hostHasCleaningTool(hostId);
  if (active) refreshCleaning(hostId);
  const team = listTeamForHost(hostId).filter((m) => m.status === "active" && memberEffectiveRoles(m).includes("cleaning"));
  const included = cleaningListingIds(hostId);
  return {
    active,
    capacity: cleaningCapacity(hostId),
    used: included.size,
    settings: getCleaningSettings(hostId),
    confirmHourOptions: CONFIRM_HOUR_OPTIONS,
    cancelHourOptions: CANCEL_HOUR_OPTIONS,
    listings: listListingsForHost(hostId).map((l) => ({
      id: l.id,
      title: l.title || "Sin título",
      on: included.has(l.id),
      cleaner: getListingCleaner(l.id) ?? null,
      /** Quién limpia, en orden de prioridad. */
      cleaners: getListingCleaners(l.id),
    })),
    cleaners: [
      { id: "host", name: "Yo", listingIds: "all" as string[] | "all" },
      ...team.map((m) => ({ id: m.id, name: memberName(m.id), listingIds: m.listingIds })),
    ],
    pendingInvites: listTeamForHost(hostId).filter((m) => m.status === "pending" && m.roles.includes("cleaning")).length,
    /** Las terminadas de los últimos 4 meses, para que el calendario muestre el historial. */
    tasks: visibleTasks(listCleaningTasksForHost(hostId), 120),
    today: analyticsDayKey(),
    recentSince: shiftDayKey(analyticsDayKey(), -14),
    attendanceEnabled: attendanceEnabled(),
  };
}

type Result = { ok: true } | { ok: false; error: string; status: number };

export function setListingCleaning(
  hostId: string,
  listingId: string,
  patch: { on?: boolean; cleaner?: string | null; cleaners?: string[] }
): Result {
  if (!hostHasCleaningTool(hostId)) return { ok: false, error: CLEANING_TOOL_OFF_ERROR, status: 402 };
  const listing = getListingById(listingId);
  if (!listing || listing.hostId !== hostId) return { ok: false, error: "Anuncio no encontrado.", status: 404 };
  const list = patch.cleaners ?? (patch.cleaner !== undefined ? (patch.cleaner ? [patch.cleaner] : []) : undefined);
  if (list) {
    if (list.length > 10) return { ok: false, error: "Máximo 10 personas por anuncio.", status: 400 };
    if (!list.every((c) => validCleaner(hostId, listingId, c))) return { ok: false, error: "Esa persona no limpia este anuncio.", status: 400 };
    setListingCleaners(listingId, list);
    if (getCleaningSettings(hostId).assignMode === "auto" && list.length) {
      for (const t of listCleaningTasksForHost(hostId)) {
        if (t.listingId !== listingId || t.status !== "pending" || t.assignee) continue;
        const next = autoCleaner(hostId, listingId, new Set((t.cancellations ?? []).map((c) => c.assignee)));
        if (next) assignCleaningTask(hostId, t.id, next);
      }
    }
  }
  if (patch.on === true && !cleaningListingIds(hostId).has(listingId)) {
    const cap = cleaningCapacity(hostId);
    if (cleaningListingIds(hostId).size >= cap) {
      return {
        ok: false,
        error: `Ya usas tus ${cap} anuncios pagados de limpieza. Quita uno o agrega otro en la Tienda.`,
        status: 409,
      };
    }
  }
  if (patch.on !== undefined) updateListing(listingId, hostId, { cleaningOn: patch.on });
  return { ok: true };
}

const pickHours = (raw: unknown, options: number[]) => (typeof raw === "number" && options.includes(raw) ? raw : undefined);

export function updateCleaningSettings(hostId: string, raw: Record<string, unknown>): Result {
  if (!hostHasCleaningTool(hostId)) return { ok: false, error: CLEANING_TOOL_OFF_ERROR, status: 402 };
  const patch: Partial<CleaningSettings> = {};
  if (raw.assignMode === "auto" || raw.assignMode === "manual") patch.assignMode = raw.assignMode;
  if (typeof raw.requirePhoto === "boolean") patch.requirePhoto = raw.requirePhoto;
  if (typeof raw.requireApproval === "boolean") patch.requireApproval = raw.requireApproval;
  const confirmHours = pickHours(raw.confirmHours, CONFIRM_HOUR_OPTIONS);
  if (confirmHours !== undefined) patch.confirmHours = confirmHours;
  const cancelHours = pickHours(raw.cancelHours, CANCEL_HOUR_OPTIONS);
  if (cancelHours !== undefined) patch.cancelHours = cancelHours;
  setCleaningSettings(hostId, patch);
  return { ok: true };
}

export function assignCleaningTask(hostId: string, taskId: string, assignee: string | null): Result {
  const t = getCleaningTask(taskId);
  if (!t || t.hostId !== hostId) return { ok: false, error: "No encontrado.", status: 404 };
  const a = assignee || undefined;
  if (!validCleaner(hostId, t.listingId, a)) return { ok: false, error: "Esa persona no limpia este anuncio.", status: 400 };
  if (a === t.assignee) return { ok: true };
  const next = updateCleaningTask(taskId, freshAssignment(a));
  if (next) askToConfirm(next, "Te asignaron una limpieza");
  return { ok: true };
}

/** Cambiar el día o la hora de una limpieza pendiente; se le avisa a quien limpia. */
export function rescheduleCleaning(hostId: string, taskId: string, input: { date?: unknown; time?: unknown }): Result {
  const t = getCleaningTask(taskId);
  if (!t || t.hostId !== hostId) return { ok: false, error: "No encontrado.", status: 404 };
  if (t.status !== "pending") return { ok: false, error: "La limpieza ya está cerrada.", status: 409 };
  const patch: Partial<CleaningTask> = {};
  if (input.date !== undefined) {
    if (typeof input.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
      return { ok: false, error: "La fecha debe ser AAAA-MM-DD.", status: 400 };
    }
    if (input.date < analyticsDayKey()) return { ok: false, error: "La fecha ya pasó.", status: 400 };
    if (input.date !== t.date) Object.assign(patch, { date: input.date, dateLocked: true, remindedAt: undefined });
  }
  if (input.time !== undefined) {
    if (input.time !== null && (typeof input.time !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time))) {
      return { ok: false, error: "La hora debe ser HH:MM.", status: 400 };
    }
    if ((input.time || undefined) !== t.time) patch.time = (input.time as string | null) || undefined;
  }
  if (Object.keys(patch).length === 0) return { ok: true };
  if (byMember(t.assignee)) Object.assign(patch, freshAssignment(t.assignee));
  const next = updateCleaningTask(taskId, patch);
  if (next) notify(next, "Cambió una limpieza", "{listing}: ahora es el {date}. Vuelve a confirmar que sí puedes.");
  return { ok: true };
}

export function addManualCleaning(
  hostId: string,
  input: { listingId?: unknown; date?: unknown; note?: unknown; assignee?: unknown }
): Result {
  if (!hostHasCleaningTool(hostId)) return { ok: false, error: CLEANING_TOOL_OFF_ERROR, status: 402 };
  const listingId = typeof input.listingId === "string" ? input.listingId : "";
  const listing = getListingById(listingId);
  if (!listing || listing.hostId !== hostId) return { ok: false, error: "Elige un anuncio.", status: 400 };
  if (!cleaningListingIds(hostId).has(listingId)) {
    return { ok: false, error: "Ese anuncio no está en tu herramienta de limpieza.", status: 400 };
  }
  const date = typeof input.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.date) ? input.date : "";
  if (!date) return { ok: false, error: "Elige la fecha.", status: 400 };
  const assignee = typeof input.assignee === "string" && input.assignee ? input.assignee : autoCleaner(hostId, listingId);
  if (!validCleaner(hostId, listingId, assignee)) return { ok: false, error: "Esa persona no limpia este anuncio.", status: 400 };
  const task = addCleaningTask({
    hostId,
    listingId,
    date,
    note: typeof input.note === "string" ? input.note.trim().slice(0, 500) || undefined : undefined,
    ...freshAssignment(assignee),
  });
  askToConfirm(task, "Te asignaron una limpieza");
  return { ok: true };
}

function isAssignedCleaner(userId: string, t: CleaningTask): boolean {
  const member = byMember(t.assignee) ? getTeamMember(t.assignee) : undefined;
  return Boolean(member && member.userId === userId && validCleaner(t.hostId, t.listingId, t.assignee));
}

/** El anfitrión o quien tiene asignada la limpieza. */
export function canSeeCleaning(userId: string, taskId: string): CleaningTask | null {
  const t = getCleaningTask(taskId);
  if (!t) return null;
  return t.hostId === userId || isAssignedCleaner(userId, t) ? t : null;
}

export async function addCleaningPhoto(userId: string, taskId: string, file: Buffer): Promise<Result> {
  const t = canSeeCleaning(userId, taskId);
  if (!t) return { ok: false, error: "No autorizado.", status: 403 };
  if (t.status !== "pending") return { ok: false, error: "La limpieza ya está cerrada.", status: 409 };
  if ((t.photos?.length ?? 0) >= MAX_PHOTOS) return { ok: false, error: `Máximo ${MAX_PHOTOS} fotos por limpieza.`, status: 409 };
  let webp: Buffer;
  try {
    webp = await compressPhoto(file);
  } catch {
    return { ok: false, error: "No se pudo leer la foto. Usa JPG, PNG o HEIC de menos de 10 MB.", status: 400 };
  }
  const id = randomBytes(8).toString("hex");
  const key = `cleaning/${t.hostId}/${t.id}/${id}.webp`;
  await putPrivateFile(key, webp, "image/webp");
  const fresh = getCleaningTask(taskId)!;
  updateCleaningTask(taskId, { photos: [...(fresh.photos ?? []), { id, key, by: userId, at: new Date().toISOString() }] });
  return { ok: true };
}

export async function removeCleaningPhoto(userId: string, taskId: string, photoId: string): Promise<Result> {
  const t = canSeeCleaning(userId, taskId);
  const p = t?.photos?.find((x) => x.id === photoId);
  if (!t || !p) return { ok: false, error: "No encontrada.", status: 404 };
  if (t.status !== "pending") return { ok: false, error: "La limpieza ya está cerrada.", status: 409 };
  if (p.key) await deletePrivateFile(p.key);
  updateCleaningTask(taskId, { photos: (t.photos ?? []).filter((x) => x.id !== photoId) });
  return { ok: true };
}

export async function readCleaningPhoto(userId: string, taskId: string, photoId: string): Promise<Buffer | null> {
  const p = canSeeCleaning(userId, taskId)?.photos?.find((x) => x.id === photoId);
  return p?.key ? getPrivateFile(p.key) : null;
}

/** Quien limpia dice que sí puede. */
function confirmCleaning(t: CleaningTask): Result {
  if (t.status !== "pending") return { ok: false, error: "La limpieza ya está cerrada.", status: 409 };
  if (t.confirmedAt) return { ok: true };
  const next = updateCleaningTask(t.id, { confirmedAt: new Date().toISOString() });
  if (next) {
    notifyHost(next, "{name} confirmó una limpieza", "{listing} · {date}.", taskVars(next, { name: assigneeLabel(next.assignee) }));
  }
  return { ok: true };
}

/**
 * Quien limpia ya no puede ir: deja el motivo, se guarda en las notificaciones del anfitrión
 * y, en automático, pasa a la siguiente persona de la lista.
 */
function declineCleaning(t: CleaningTask, reasonRaw: unknown): Result {
  if (t.status !== "pending") return { ok: false, error: "La limpieza ya está cerrada.", status: 409 };
  const reason = typeof reasonRaw === "string" ? reasonRaw.replace(/\s+/g, " ").trim().slice(0, 300) : "";
  if (reason.length < 3) return { ok: false, error: "Cuéntale al anfitrión por qué no puedes.", status: 400 };
  const s = getCleaningSettings(t.hostId);
  if (Date.now() > startMs(t) - s.cancelHours * HOUR_MS) {
    return { ok: false, error: "Ya no puedes cancelar con tan poca anticipación. Escríbele al anfitrión.", status: 409 };
  }
  const who = assigneeLabel(t.assignee);
  const cancellations = [...(t.cancellations ?? []), { assignee: t.assignee!, at: new Date().toISOString(), reason }];
  const skip = new Set(cancellations.map((c) => c.assignee));
  const nextAssignee = s.assignMode === "auto" ? autoCleaner(t.hostId, t.listingId, skip) : undefined;
  const next = updateCleaningTask(t.id, { cancellations, ...freshAssignment(nextAssignee) });
  if (!next) return { ok: false, error: "No encontrado.", status: 404 };
  notifyHost(
    next,
    "{name} canceló una limpieza",
    nextAssignee
      ? "{listing} · {date}. Motivo: «{reason}». Se la pasamos a {next}."
      : "{listing} · {date}. Motivo: «{reason}». Quedó sin asignar: elige a alguien.",
    taskVars(next, { name: who, reason, next: assigneeLabel(nextAssignee) }),
    `cleaning-cancel:${t.id}:${cancellations.length}`
  );
  if (byMember(nextAssignee)) askToConfirm(next, "Te pasaron una limpieza");
  return { ok: true };
}

/** El anfitrión aprueba la limpieza o la regresa con lo que falta. */
function reviewCleaning(t: CleaningTask, approve: boolean, noteRaw: unknown): Result {
  if (t.status !== "done") return { ok: false, error: "La limpieza todavía no está terminada.", status: 409 };
  const cleaner = recipientOf(t);
  if (approve) {
    updateCleaningTask(t.id, { approval: "approved", approvedAt: new Date().toISOString(), redoNote: undefined });
    if (byMember(t.assignee) && cleaner) {
      notifyUser(cleaner.userId, { kind: "cleaning", title: "Aprobaron tu limpieza", body: "{listing} · {date}. ¡Gracias!", vars: taskVars(t), url: cleaner.url, tag: `cleaning:${t.id}` });
    }
    return { ok: true };
  }
  const note = typeof noteRaw === "string" ? noteRaw.replace(/\s+/g, " ").trim().slice(0, 300) : "";
  if (note.length < 3) return { ok: false, error: "Escribe qué falta corregir.", status: 400 };
  updateCleaningTask(t.id, { status: "pending", approval: undefined, approvedAt: undefined, doneAt: undefined, doneBy: undefined, redoNote: note });
  if (byMember(t.assignee) && cleaner) {
    notifyUser(cleaner.userId, { kind: "cleaning", title: "Hay que corregir una limpieza", body: "{listing} · {date}: {note}", vars: taskVars(t, { note }), url: cleaner.url, tag: `cleaning:${t.id}` });
  }
  return { ok: true };
}

/** Marcar hecha/pendiente, confirmar, cancelar, aprobar o dejar nota: el anfitrión o la persona asignada. */
export function updateCleaningByActor(
  userId: string,
  taskId: string,
  patch: {
    done?: boolean;
    note?: unknown;
    cancel?: boolean;
    confirm?: boolean;
    decline?: unknown;
    approve?: boolean;
    redo?: unknown;
  }
): Result {
  const t = getCleaningTask(taskId);
  if (!t) return { ok: false, error: "No encontrado.", status: 404 };
  const owner = t.hostId === userId;
  if (!owner && !isAssignedCleaner(userId, t)) return { ok: false, error: "No autorizado.", status: 403 };
  if (patch.cancel) {
    if (!owner) return { ok: false, error: "Sólo el anfitrión puede cancelar.", status: 403 };
    updateCleaningTask(taskId, { status: "cancelled" });
    if (byMember(t.assignee)) notify(t, "Limpieza cancelada", "El anfitrión canceló la limpieza de {listing} del {date}.");
    return { ok: true };
  }
  if (patch.approve !== undefined || patch.redo !== undefined) {
    if (!owner) return { ok: false, error: "Sólo el anfitrión aprueba las limpiezas.", status: 403 };
    return reviewCleaning(t, patch.approve === true, patch.redo);
  }
  if (patch.confirm) {
    if (owner && !isAssignedCleaner(userId, t)) return { ok: false, error: "La confirma quien limpia.", status: 403 };
    return confirmCleaning(t);
  }
  if (patch.decline !== undefined) {
    if (!isAssignedCleaner(userId, t)) return { ok: false, error: "La cancela quien limpia; tú puedes reasignarla.", status: 403 };
    return declineCleaning(t, patch.decline);
  }
  const next: Partial<CleaningTask> = {};
  if (typeof patch.note === "string") next.note = patch.note.trim().slice(0, 500) || undefined;
  const settings = getCleaningSettings(t.hostId);
  if (patch.done && settings.requirePhoto && !(t.photos?.length)) {
    return { ok: false, error: "Sube al menos una foto para marcarla como hecha.", status: 400 };
  }
  if (patch.done !== undefined) {
    const now = new Date().toISOString();
    next.status = patch.done ? "done" : "pending";
    next.doneAt = patch.done ? now : undefined;
    next.doneBy = patch.done ? userId : undefined;
    next.approval = patch.done && settings.requireApproval ? (owner ? "approved" : "pending") : undefined;
    next.approvedAt = patch.done && settings.requireApproval && owner ? now : undefined;
    if (patch.done) {
      next.redoNote = undefined;
      if (!t.confirmedAt) next.confirmedAt = now;
    }
  }
  updateCleaningTask(taskId, next);
  if (patch.done && !owner) {
    notifyHost(
      t,
      settings.requireApproval ? "Revisa y aprueba una limpieza" : "Limpieza terminada",
      "{name} terminó {listing} ({date}).",
      taskVars(t, { name: assigneeLabel(t.assignee) })
    );
  }
  return { ok: true };
}

/** Lo que ve quien limpia: sus tareas en cada equipo. */
export function cleanerTasksView(user: { id: string; email: string }) {
  const groups: {
    hostId: string;
    hostName: string;
    requirePhoto: boolean;
    requireApproval: boolean;
    confirmHours: number;
    cancelHours: number;
    attendanceEnabled: boolean;
    tasks: CleaningTaskView[];
  }[] = [];
  for (const m of listMembershipsForUser(user.id, user.email)) {
    if (m.status !== "active" || !memberEffectiveRoles(m).includes("cleaning")) continue;
    refreshCleaning(m.hostId);
    const mine = listCleaningTasksForHost(m.hostId).filter((t) => t.assignee === m.id);
    const host = findUserById(m.hostId);
    const s = getCleaningSettings(m.hostId);
    groups.push({
      hostId: m.hostId,
      hostName: (host && publicNameOf(host)) || "Anfitrión",
      requirePhoto: s.requirePhoto,
      requireApproval: s.requireApproval,
      confirmHours: s.confirmHours,
      cancelHours: s.cancelHours,
      attendanceEnabled: attendanceEnabled(),
      tasks: visibleTasks(mine),
    });
  }
  return groups;
}
