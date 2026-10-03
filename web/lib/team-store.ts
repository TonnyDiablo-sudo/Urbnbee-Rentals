import "server-only";
import { randomBytes } from "crypto";
import { existsSync, readFileSync, statSync, writeFileSync } from "fs";
import { join } from "path";
import { scheduleMysql, upsertJsonBlob } from "@/lib/mysql-sync";
import { ensureDir, getDataDir } from "@/lib/runtime-paths";

export type TeamRole = "cleaning" | "bookings" | "contracts" | "messages";
export const TEAM_ROLES: TeamRole[] = ["cleaning", "bookings", "contracts", "messages"];

export const TEAM_ROLE_LABEL: Record<TeamRole, string> = {
  cleaning: "Limpieza",
  bookings: "Aceptar y verificar reservas",
  contracts: "Firmar contratos en nombre del anfitrión",
  messages: "Contestar mensajes",
};

export type TeamMemberStatus = "pending" | "active" | "declined" | "revoked";

export type TeamMember = {
  id: string;
  hostId: string;
  /** Correo al que se mandó la invitación (minúsculas). */
  email: string;
  /** Cuenta de Cabibee de la persona; se llena al aceptar. */
  userId?: string;
  roles: TeamRole[];
  /** Anuncios a los que tiene acceso. "all" incluye los que el anfitrión cree después. */
  listingIds: string[] | "all";
  status: TeamMemberStatus;
  invitedAt: string;
  respondedAt?: string;
  updatedAt: string;
};

const DATA_FILE = join(getDataDir(), "team-members.json");
let rows: TeamMember[] = [];
let cachedMtimeMs = 0;

function load() {
  try {
    if (!existsSync(DATA_FILE)) return;
    const m = statSync(DATA_FILE).mtimeMs;
    if (m === cachedMtimeMs) return;
    const data = JSON.parse(readFileSync(DATA_FILE, "utf8")) as { members?: TeamMember[] };
    rows = Array.isArray(data.members) ? data.members : [];
    cachedMtimeMs = m;
  } catch (e) {
    console.warn("[team] load failed:", e);
  }
}

function persist() {
  try {
    ensureDir(getDataDir());
    const snapshot = { version: 1 as const, members: rows };
    writeFileSync(DATA_FILE, JSON.stringify(snapshot, null, 2), "utf8");
    cachedMtimeMs = statSync(DATA_FILE).mtimeMs;
    scheduleMysql(() => upsertJsonBlob("team-members", snapshot));
  } catch (e) {
    console.warn("[team] persist failed:", e);
  }
}

load();

/** Una persona necesita asiento pagado si hace algo más que limpiar. */
export function memberNeedsSeat(roles: TeamRole[]): boolean {
  return roles.some((r) => r !== "cleaning");
}

export function memberCoversListing(m: TeamMember, listingId: string): boolean {
  return m.listingIds === "all" || m.listingIds.includes(listingId);
}

export function listTeamForHost(hostId: string): TeamMember[] {
  load();
  return rows.filter((m) => m.hostId === hostId && m.status !== "revoked" && m.status !== "declined");
}

export function getTeamMember(id: string): TeamMember | undefined {
  load();
  return rows.find((m) => m.id === id);
}

/** Invitaciones y accesos de una persona (por cuenta o, si aún no acepta, por correo). */
export function listMembershipsForUser(userId: string, email: string): TeamMember[] {
  load();
  const e = email.trim().toLowerCase();
  return rows.filter(
    (m) =>
      (m.status === "active" && m.userId === userId) ||
      (m.status === "pending" && m.email === e)
  );
}

export function activeMembership(userId: string, hostId: string): TeamMember | undefined {
  load();
  return rows.find((m) => m.status === "active" && m.userId === userId && m.hostId === hostId);
}

export function addTeamMember(input: {
  hostId: string;
  email: string;
  roles: TeamRole[];
  listingIds: string[] | "all";
}): TeamMember {
  load();
  const now = new Date().toISOString();
  const member: TeamMember = {
    id: `tm_${randomBytes(9).toString("hex")}`,
    hostId: input.hostId,
    email: input.email.trim().toLowerCase(),
    roles: input.roles,
    listingIds: input.listingIds,
    status: "pending",
    invitedAt: now,
    updatedAt: now,
  };
  rows.push(member);
  persist();
  return member;
}

export function updateTeamMember(id: string, patch: Partial<Omit<TeamMember, "id" | "hostId">>): TeamMember | undefined {
  load();
  const i = rows.findIndex((m) => m.id === id);
  if (i === -1) return undefined;
  rows[i] = { ...rows[i], ...patch, updatedAt: new Date().toISOString() };
  persist();
  return rows[i];
}
