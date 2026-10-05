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
  listCleaningTasksForHost,
  setListingCleaner,
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

export function formatCleaningDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Intl.DateTimeFormat("es-MX", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d))
  );
}

function listingTitle(listingId: string) {
  return getListingById(listingId)?.title || "tu anuncio";
}

/** A quién avisar de una tarea: la persona asignada o, si no hay, el anfitrión. */
function recipientOf(task: CleaningTask): { userId: string; url: string } | null {
  if (task.assignee && task.assignee !== "host") {
    const m = getTeamMember(task.assignee);
    if (m?.status === "active" && m.userId) return { userId: m.userId, url: "/equipo" };
  }
  return { userId: task.hostId, url: "/host/limpieza" };
}

function notify(task: CleaningTask, title: string, body: string) {
  const to = recipientOf(task);
  if (!to) return;
  notifyUser(to.userId, { kind: "cleaning", title, body, rawBody: true, url: to.url, tag: `cleaning:${task.id}` });
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

/** En modo automático: quien limpia ese anuncio por defecto, o la única persona que puede. */
function autoCleaner(hostId: string, listingId: string): CleaningAssignee | undefined {
  const preset = getListingCleaner(listingId);
  if (preset && validCleaner(hostId, listingId, preset)) return preset;
  const able = listTeamForHost(hostId).filter((m) => validCleaner(hostId, listingId, m.id));
  return able.length === 1 ? able[0].id : undefined;
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
        if (t) notify(t, "Limpieza cancelada", `Se canceló la reserva de ${listingTitle(listingId)} del ${formatCleaningDay(t.date)}.`);
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
        const t = updateCleaningTask(existing.id, { date, nextCheckIn, ...(moved ? { remindedAt: undefined } : {}) });
        if (t && moved) notify(t, "Cambió una limpieza", `${listingTitle(listingId)}: ahora es el ${formatCleaningDay(date)}.`);
      }
      continue;
    }
    if (date < since) continue;
    const task = addCleaningTask({
      hostId,
      listingId,
      bookingId: b.id,
      date,
      nextCheckIn,
      guestName: b.guestName,
      assignee: assignMode === "auto" ? autoCleaner(hostId, listingId) : undefined,
    });
    notify(
      task,
      task.assignee ? "Nueva limpieza" : "Nueva limpieza sin asignar",
      `${listingTitle(listingId)} · ${formatCleaningDay(date)}${nextCheckIn ? ` · siguiente llegada ${formatCleaningDay(nextCheckIn)}` : ""}.`
    );
  }
}

/** Avisa el día anterior (y el mismo día si no se avisó) a quien limpia. */
export function runCleaningReminders(hostId: string) {
  if (!hostHasCleaningTool(hostId)) return;
  const today = analyticsDayKey();
  const tomorrow = shiftDayKey(today, 1);
  for (const t of listCleaningTasksForHost(hostId)) {
    if (t.status !== "pending" || t.remindedAt || (t.date !== today && t.date !== tomorrow)) continue;
    const when = t.date === today ? "Hoy" : "Mañana";
    const who = t.assignee ? "" : " (sin asignar)";
    notify(t, `${when}: limpieza${who}`, `${listingTitle(t.listingId)} · ${formatCleaningDay(t.date)}${t.nextCheckIn ? ` · llega huésped ${formatCleaningDay(t.nextCheckIn)}` : ""}.`);
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
    for (const p of t.photos) await deletePrivateFile(p.key);
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
    photos: (t.photos ?? []).map((p) => ({ id: p.id, url: `/api/cleaning/${t.id}/photos/${p.id}` })),
    /** Cuenta de quien limpia, para abrir el chat con el anfitrión. */
    cleanerUserId: t.assignee && t.assignee !== "host" ? (getTeamMember(t.assignee)?.userId ?? null) : null,
  };
}

export type CleaningTaskView = ReturnType<typeof taskView>;

function visibleTasks(list: CleaningTask[], doneDays = 14) {
  const since = shiftDayKey(analyticsDayKey(), -doneDays);
  return list
    .filter((t) => t.status === "pending" || (t.date >= since && t.status === "done"))
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
    listings: listListingsForHost(hostId).map((l) => ({
      id: l.id,
      title: l.title || "Sin título",
      on: included.has(l.id),
      cleaner: getListingCleaner(l.id) ?? null,
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

export function setListingCleaning(hostId: string, listingId: string, patch: { on?: boolean; cleaner?: string | null }): Result {
  if (!hostHasCleaningTool(hostId)) return { ok: false, error: CLEANING_TOOL_OFF_ERROR, status: 402 };
  const listing = getListingById(listingId);
  if (!listing || listing.hostId !== hostId) return { ok: false, error: "Anuncio no encontrado.", status: 404 };
  if (patch.cleaner !== undefined) {
    const c = patch.cleaner || undefined;
    if (!validCleaner(hostId, listingId, c)) return { ok: false, error: "Esa persona no limpia este anuncio.", status: 400 };
    setListingCleaner(listingId, c);
    if (getCleaningSettings(hostId).assignMode === "auto") {
      for (const t of listCleaningTasksForHost(hostId)) {
        if (t.listingId === listingId && t.status === "pending" && !t.assignee && c) assignCleaningTask(hostId, t.id, c);
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

export function updateCleaningSettings(hostId: string, raw: Record<string, unknown>): Result {
  if (!hostHasCleaningTool(hostId)) return { ok: false, error: CLEANING_TOOL_OFF_ERROR, status: 402 };
  const patch: Partial<CleaningSettings> = {};
  if (raw.assignMode === "auto" || raw.assignMode === "manual") patch.assignMode = raw.assignMode;
  if (typeof raw.requirePhoto === "boolean") patch.requirePhoto = raw.requirePhoto;
  setCleaningSettings(hostId, patch);
  return { ok: true };
}

export function assignCleaningTask(hostId: string, taskId: string, assignee: string | null): Result {
  const t = getCleaningTask(taskId);
  if (!t || t.hostId !== hostId) return { ok: false, error: "No encontrado.", status: 404 };
  const a = assignee || undefined;
  if (!validCleaner(hostId, t.listingId, a)) return { ok: false, error: "Esa persona no limpia este anuncio.", status: 400 };
  const next = updateCleaningTask(taskId, { assignee: a, remindedAt: undefined });
  if (next && a && a !== "host") {
    notify(next, "Te asignaron una limpieza", `${listingTitle(next.listingId)} · ${formatCleaningDay(next.date)}.`);
  }
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
  const next = updateCleaningTask(taskId, patch);
  if (next) {
    notify(
      next,
      "Cambió una limpieza",
      `${listingTitle(next.listingId)}: ahora es el ${formatCleaningDay(next.date)}${next.time ? ` a las ${next.time}` : ""}.`
    );
  }
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
  const assignee = typeof input.assignee === "string" && input.assignee ? input.assignee : getListingCleaner(listingId);
  if (!validCleaner(hostId, listingId, assignee)) return { ok: false, error: "Esa persona no limpia este anuncio.", status: 400 };
  const task = addCleaningTask({
    hostId,
    listingId,
    date,
    note: typeof input.note === "string" ? input.note.trim().slice(0, 500) || undefined : undefined,
    assignee,
  });
  if (assignee && assignee !== "host") {
    notify(task, "Te asignaron una limpieza", `${listingTitle(listingId)} · ${formatCleaningDay(date)}.`);
  }
  return { ok: true };
}

function isAssignedCleaner(userId: string, t: CleaningTask): boolean {
  const member = t.assignee && t.assignee !== "host" ? getTeamMember(t.assignee) : undefined;
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
  await deletePrivateFile(p.key);
  updateCleaningTask(taskId, { photos: (t.photos ?? []).filter((x) => x.id !== photoId) });
  return { ok: true };
}

export async function readCleaningPhoto(userId: string, taskId: string, photoId: string): Promise<Buffer | null> {
  const p = canSeeCleaning(userId, taskId)?.photos?.find((x) => x.id === photoId);
  return p ? getPrivateFile(p.key) : null;
}

/** Marcar hecha/pendiente o cambiar la nota: el anfitrión o la persona asignada. */
export function updateCleaningByActor(
  userId: string,
  taskId: string,
  patch: { done?: boolean; note?: unknown; cancel?: boolean }
): Result {
  const t = getCleaningTask(taskId);
  if (!t) return { ok: false, error: "No encontrado.", status: 404 };
  const owner = t.hostId === userId;
  if (!owner && !isAssignedCleaner(userId, t)) return { ok: false, error: "No autorizado.", status: 403 };
  if (patch.cancel) {
    if (!owner) return { ok: false, error: "Sólo el anfitrión puede cancelar.", status: 403 };
    updateCleaningTask(taskId, { status: "cancelled" });
    return { ok: true };
  }
  const next: Partial<CleaningTask> = {};
  if (typeof patch.note === "string") next.note = patch.note.trim().slice(0, 500) || undefined;
  if (patch.done && getCleaningSettings(t.hostId).requirePhoto && !(t.photos?.length)) {
    return { ok: false, error: "Sube al menos una foto para marcarla como hecha.", status: 400 };
  }
  if (patch.done !== undefined) {
    next.status = patch.done ? "done" : "pending";
    next.doneAt = patch.done ? new Date().toISOString() : undefined;
    next.doneBy = patch.done ? userId : undefined;
  }
  updateCleaningTask(taskId, next);
  if (patch.done && !owner) {
    notifyUser(t.hostId, {
    rawBody: true,
      kind: "cleaning",
      title: "Limpieza terminada",
      body: `${memberName(t.assignee!)} terminó ${listingTitle(t.listingId)} (${formatCleaningDay(t.date)}).`,
      url: "/host/limpieza",
      tag: `cleaning:${t.id}`,
    });
  }
  return { ok: true };
}

/** Lo que ve quien limpia: sus tareas en cada equipo. */
export function cleanerTasksView(user: { id: string; email: string }) {
  const groups: { hostId: string; hostName: string; requirePhoto: boolean; attendanceEnabled: boolean; tasks: CleaningTaskView[] }[] = [];
  for (const m of listMembershipsForUser(user.id, user.email)) {
    if (m.status !== "active" || !memberEffectiveRoles(m).includes("cleaning")) continue;
    refreshCleaning(m.hostId);
    const mine = listCleaningTasksForHost(m.hostId).filter((t) => t.assignee === m.id);
    const host = findUserById(m.hostId);
    groups.push({
      hostId: m.hostId,
      hostName: (host && publicNameOf(host)) || "Anfitrión",
      requirePhoto: getCleaningSettings(m.hostId).requirePhoto,
      attendanceEnabled: attendanceEnabled(),
      tasks: visibleTasks(mine),
    });
  }
  return groups;
}
