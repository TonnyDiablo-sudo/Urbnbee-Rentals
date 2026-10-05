import "server-only";
import { analyticsDayKey } from "@/lib/analytics-day";
import { attendanceEnabled } from "@/lib/attendance-flag";
import { addPunch, punchesForHost, punchesForTask, type AttendancePunch } from "@/lib/cleaning-attendance-store";
import { canSeeCleaning } from "@/lib/cleaning-service";
import { publicNameOf } from "@/lib/display-name";
import { findUserById, getListingById } from "@/lib/marketplace-store";
import { notifyUser } from "@/lib/push";
import { getTeamMember } from "@/lib/team-store";

export const ATTENDANCE_SOON_ERROR = "Próximamente: la entrada y salida con ubicación todavía no está disponible.";

/** Radio en metros para contar como «en el lugar»; se amplía con la precisión del GPS. */
const ON_SITE_M = 150;
const MAX_ACCURACY_M = 1000;

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string; status: number };

function distanceM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

function actorOf(userId: string, hostId: string, assignee: string | undefined): string {
  return userId === hostId ? "host" : (assignee ?? "host");
}

function nameOfActor(hostId: string, actor: string): string {
  const userId = actor === "host" ? hostId : getTeamMember(actor)?.userId;
  const u = userId ? findUserById(userId) : undefined;
  return (u && publicNameOf(u)) || (actor === "host" ? "Anfitrión" : getTeamMember(actor)?.email || "—");
}

/** Estado de la entrada/salida de quien pregunta en una limpieza. */
export function taskAttendance(userId: string, taskId: string) {
  const mine = punchesForTask(taskId).filter((p) => p.userId === userId);
  const lastIn = [...mine].reverse().find((p) => p.kind === "in");
  const lastOut = lastIn ? mine.find((p) => p.kind === "out" && p.at > lastIn.at) : undefined;
  return {
    inAt: lastIn?.at ?? null,
    inOnSite: lastIn?.onSite ?? null,
    outAt: lastOut?.at ?? null,
    outOnSite: lastOut?.onSite ?? null,
  };
}

export function punchCleaning(
  userId: string,
  taskId: string,
  raw: { kind?: unknown; lat?: unknown; lng?: unknown; accuracy?: unknown; platform?: unknown }
): Result<{ onSite: boolean; distanceM: number }> {
  if (!attendanceEnabled()) return { ok: false, error: ATTENDANCE_SOON_ERROR, status: 403 };
  const task = canSeeCleaning(userId, taskId);
  if (!task) return { ok: false, error: "No autorizado.", status: 403 };
  if (task.status === "cancelled") return { ok: false, error: "La limpieza está cancelada.", status: 409 };
  const kind = raw.kind === "in" || raw.kind === "out" ? raw.kind : null;
  if (!kind) return { ok: false, error: "Falta si es entrada o salida.", status: 400 };
  const lat = Number(raw.lat);
  const lng = Number(raw.lng);
  const accuracy = Number(raw.accuracy);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return { ok: false, error: "No llegó tu ubicación. Activa la ubicación e inténtalo otra vez.", status: 400 };
  }
  const acc = Number.isFinite(accuracy) && accuracy > 0 ? Math.round(accuracy) : MAX_ACCURACY_M;
  if (acc > MAX_ACCURACY_M) {
    return { ok: false, error: "Tu ubicación es muy imprecisa. Sal a un lugar abierto o activa el GPS e inténtalo otra vez.", status: 400 };
  }
  const state = taskAttendance(userId, taskId);
  if (kind === "in" && state.inAt && !state.outAt) return { ok: false, error: "Ya marcaste tu entrada.", status: 409 };
  if (kind === "out" && (!state.inAt || state.outAt)) return { ok: false, error: "Primero marca tu entrada.", status: 409 };

  const listing = getListingById(task.listingId);
  const hasPoint = Boolean(listing && Number.isFinite(listing.lat) && Number.isFinite(listing.lng) && (listing.lat || listing.lng));
  const dist = hasPoint ? distanceM(lat, lng, listing!.lat, listing!.lng) : -1;
  const onSite = dist >= 0 && dist <= ON_SITE_M + Math.min(acc, 300);
  const platform = raw.platform === "ios" || raw.platform === "android" ? raw.platform : "web";
  const actor = actorOf(userId, task.hostId, task.assignee);
  addPunch({
    hostId: task.hostId,
    taskId,
    listingId: task.listingId,
    actor,
    userId,
    kind,
    lat: Math.round(lat * 1e6) / 1e6,
    lng: Math.round(lng * 1e6) / 1e6,
    accuracyM: acc,
    distanceM: dist,
    onSite,
    platform,
  });
  if (userId !== task.hostId) {
    notifyUser(task.hostId, {
      kind: "cleaning",
      title: kind === "in" ? "{name} llegó a limpiar" : "{name} terminó y salió",
      body: onSite ? "{listing} · en el lugar" : "{listing} · fuera del lugar ({m} m)",
      vars: { name: nameOfActor(task.hostId, actor), listing: listing?.title || "tu anuncio", m: dist },
      url: "/host/limpieza#asistencia",
      tag: `attendance:${taskId}`,
    });
  }
  return { ok: true, onSite, distanceM: dist };
}

type Visit = {
  actor: string;
  name: string;
  day: string;
  listingTitle: string;
  inAt: string;
  outAt: string | null;
  minutes: number | null;
  inOnSite: boolean;
  outOnSite: boolean | null;
  inDistanceM: number;
  outDistanceM: number | null;
};

/** Historial del anfitrión: cada entrada con su salida, por persona y por día. */
export function attendanceHistory(hostId: string, opts: { actor?: string | null; from?: string | null; to?: string | null }) {
  if (!attendanceEnabled()) return null;
  const to = opts.to && /^\d{4}-\d{2}-\d{2}$/.test(opts.to) ? opts.to : analyticsDayKey();
  const from = opts.from && /^\d{4}-\d{2}-\d{2}$/.test(opts.from) ? opts.from : `${to.slice(0, 8)}01`;
  const all = punchesForHost(hostId)
    .filter((p) => !opts.actor || p.actor === opts.actor)
    .sort((a, b) => a.at.localeCompare(b.at));
  const visits: Visit[] = [];
  const open = new Map<string, AttendancePunch>();
  const push = (inP: AttendancePunch, outP?: AttendancePunch) => {
    const day = analyticsDayKey(new Date(inP.at));
    if (day < from || day > to) return;
    visits.push({
      actor: inP.actor,
      name: nameOfActor(hostId, inP.actor),
      day,
      listingTitle: getListingById(inP.listingId)?.title || "Anuncio",
      inAt: inP.at,
      outAt: outP?.at ?? null,
      minutes: outP ? Math.round((Date.parse(outP.at) - Date.parse(inP.at)) / 60000) : null,
      inOnSite: inP.onSite,
      outOnSite: outP?.onSite ?? null,
      inDistanceM: inP.distanceM,
      outDistanceM: outP?.distanceM ?? null,
    });
  };
  for (const p of all) {
    const key = `${p.taskId}:${p.userId}`;
    if (p.kind === "in") {
      const prev = open.get(key);
      if (prev) push(prev);
      open.set(key, p);
    } else {
      const inP = open.get(key);
      if (inP) push(inP, p);
      open.delete(key);
    }
  }
  for (const p of open.values()) push(p);
  visits.sort((a, b) => b.inAt.localeCompare(a.inAt));
  return { from, to, visits };
}
