#!/usr/bin/env node
/**
 * Herramientas de muestra para las cuentas demo: limpieza por anuncio, colaboradores y su equipo.
 *   sofia@urbnbee.test / pedro@urbnbee.test   → anfitriones con limpieza y 2 asientos de colaborador
 *   lupita@urbnbee.test                        → limpia sus anuncios (ve sus limpiezas en «Equipos donde colaboro»)
 *   marco@urbnbee.test                         → acepta reservas, firma contratos y contesta mensajes
 * Contraseña de todas: Demo2026!
 *
 * Idempotente: sólo agrega lo que falta; nunca pisa lo que alguien ya cambió.
 * Se ejecuta en cada arranque (scripts/start.mjs). Las limpiezas salen solas de las reservas.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import bcrypt from "bcryptjs";

const cwd = process.cwd();
const rawDir = process.env.URBNBEE_DATA_DIR?.trim();
const dataDir = rawDir ? (isAbsolute(rawDir) ? rawDir : resolve(cwd, rawDir)) : join(cwd, "data");
mkdirSync(dataDir, { recursive: true });

const PASSWORD = "Demo2026!";
const NOW = new Date().toISOString();
const PERIOD_END = new Date(Date.now() + 365 * 86_400_000).toISOString();

const HOSTS = [
  {
    id: "usr_demo_sofia_host",
    cleanListings: ["lst_demo_sofia_roma", "lst_demo_sofia_condesa", "lst_demo_sofia_coyoacan"],
  },
  {
    id: "usr_seed_pedro_dev",
    cleanListings: ["lst_pedro_departamento_roma", "lst_pedro_habitacion_condesa", "lst_pedro_casa_coyoacan"],
  },
];

const HELPERS = [
  {
    id: "usr_demo_lupita_clean",
    email: "lupita@urbnbee.test",
    fullName: "Lupita Hernández",
    avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&h=400&fit=crop&q=85",
    member: (hostId, listings) => ({ id: `tm_demo_lupita_${hostId}`, roles: ["cleaning"], listingIds: listings }),
  },
  {
    id: "usr_demo_marco_collab",
    email: "marco@urbnbee.test",
    fullName: "Marco Díaz",
    avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=400&fit=crop&q=85",
    member: (hostId) => ({ id: `tm_demo_marco_${hostId}`, roles: ["bookings", "contracts", "messages"], listingIds: "all" }),
  },
];

function readJson(name, fallback) {
  const p = join(dataDir, name);
  if (!existsSync(p)) return fallback;
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

function writeJson(name, data) {
  writeFileSync(join(dataDir, name), JSON.stringify(data, null, 2), "utf8");
}

const store = readJson("marketplace-store.json", null);
if (!store?.users) {
  console.log("[seed-demo-tools] sin marketplace-store.json; nada que hacer");
  process.exit(0);
}
const hosts = HOSTS.filter((h) => store.users.some((u) => u.id === h.id));
if (!hosts.length) {
  console.log("[seed-demo-tools] no hay cuentas demo; nada que hacer");
  process.exit(0);
}

let changes = 0;

// Cuentas del equipo
let hash;
for (const h of HELPERS) {
  if (store.users.some((u) => u.id === h.id)) continue;
  if (store.emailToUserId?.[h.email]) continue;
  hash ??= bcrypt.hashSync(PASSWORD, 10);
  store.users.push({ id: h.id, email: h.email, passwordHash: hash, fullName: h.fullName, role: "guest", createdAt: NOW });
  store.emailToUserId = { ...(store.emailToUserId ?? {}), [h.email]: h.id };
  store.hostProfiles = store.hostProfiles ?? {};
  store.hostProfiles[h.id] ??= { userId: h.id, bio: "", avatarUrl: h.avatar };
  changes++;
}

// Anuncios dentro de la herramienta de limpieza
for (const host of hosts) {
  for (const id of host.cleanListings) {
    const l = store.listings?.find((x) => x.id === id && x.hostId === host.id);
    if (l && l.cleaningOn === undefined) {
      l.cleaningOn = true;
      changes++;
    }
  }
}
writeJson("marketplace-store.json", store);

// Lo pagado: limpieza por anuncio y asientos de colaborador
const ent = readJson("host-entitlements.json", { version: 1, entitlements: [] });
if (ent) {
  ent.entitlements = Array.isArray(ent.entitlements) ? ent.entitlements : [];
  for (const host of hosts) {
    const want = [
      { sku: "cabibee_cleaning_tool", quantity: host.cleanListings.length, planCode: "cleaning_tool_12" },
      { sku: "cabibee_collaborators", quantity: 2, planCode: "collaborator_seat_12" },
    ];
    for (const w of want) {
      if (ent.entitlements.some((e) => e.hostId === host.id && e.sku === w.sku)) continue;
      ent.entitlements.push({
        hostId: host.id,
        sku: w.sku,
        status: "active",
        source: "cabibee_direct",
        stripeSubscriptionId: "simulated",
        currentPeriodEnd: PERIOD_END,
        quantity: w.quantity,
        planCode: w.planCode,
        startedAt: NOW,
        updatedAt: NOW,
      });
      changes++;
    }
  }
  writeJson("host-entitlements.json", ent);
}

// El equipo de cada anfitrión, ya aceptado
const team = readJson("team-members.json", { version: 1, members: [] });
if (team) {
  team.members = Array.isArray(team.members) ? team.members : [];
  for (const host of hosts) {
    for (const h of HELPERS) {
      const m = h.member(host.id, host.cleanListings);
      if (team.members.some((x) => x.id === m.id)) continue;
      if (team.members.some((x) => x.hostId === host.id && x.email === h.email)) continue;
      team.members.push({
        ...m,
        hostId: host.id,
        email: h.email,
        userId: h.id,
        status: "active",
        invitedAt: NOW,
        respondedAt: NOW,
        updatedAt: NOW,
      });
      changes++;
    }
  }
  writeJson("team-members.json", team);
}

// Quién limpia cada anuncio, cómo trabaja el anfitrión y una limpieza extra de ejemplo
const cleaning = readJson("cleaning-tasks.json", { version: 1, tasks: [], defaults: {}, settings: {} });
if (cleaning) {
  cleaning.tasks = Array.isArray(cleaning.tasks) ? cleaning.tasks : [];
  cleaning.defaults = cleaning.defaults ?? {};
  cleaning.settings = cleaning.settings ?? {};
  const inThree = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
  for (const host of hosts) {
    for (const id of host.cleanListings) {
      if (!cleaning.defaults[id]) {
        cleaning.defaults[id] = `tm_demo_lupita_${host.id}`;
        changes++;
      }
    }
    if (!cleaning.settings[host.id]) {
      cleaning.settings[host.id] = { assignMode: "auto", requirePhoto: true };
      changes++;
    }
    const extraId = `cl_demo_extra_${host.id}`;
    if (!cleaning.tasks.some((t) => t.id === extraId)) {
      cleaning.tasks.push({
        id: extraId,
        hostId: host.id,
        listingId: host.cleanListings[2],
        date: inThree,
        assignee: `tm_demo_lupita_${host.id}`,
        status: "pending",
        note: "Limpieza profunda: ventanas, patio y cambiar cortinas.",
        createdAt: NOW,
        updatedAt: NOW,
      });
      changes++;
    }
  }
  writeJson("cleaning-tasks.json", cleaning);
}

console.log(changes ? `[seed-demo-tools] ${changes} cambios` : "[seed-demo-tools] ya estaba al día");
