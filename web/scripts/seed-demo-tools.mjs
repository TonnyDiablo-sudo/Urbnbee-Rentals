#!/usr/bin/env node
/**
 * Herramientas de muestra para las cuentas demo: limpieza por anuncio, colaboradores y su equipo.
 *   sofia@urbnbee.test / pedro@urbnbee.test   → anfitriones con limpieza y 2 asientos de colaborador
 *   lupita@urbnbee.test                        → limpia sus anuncios (ve sus limpiezas en «Equipos donde colaboro»)
 *   marco@urbnbee.test                         → acepta reservas, firma contratos y contesta mensajes
 *   rosa@urbnbee.test                          → limpia Condesa y Coyoacán de Sofía y contesta mensajes
 * Sofía además trae reservas de varios huéspedes, chats del equipo, insumos (unos en alarma) y notificaciones.
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

// ── Sofía: más reservas, otro colaborador, chats del equipo, insumos y alarmas ──
// Ids propios (bkg_sofia_seed_*, sup_seed_*, ntf_seed_*): seed-demo-accounts no los borra.
const SOFIA = "usr_demo_sofia_host";
const S_ROMA = "lst_demo_sofia_roma";
const S_CONDESA = "lst_demo_sofia_condesa";
const S_COYO = "lst_demo_sofia_coyoacan";
const LUPITA_TM = `tm_demo_lupita_${SOFIA}`;
const MARCO_TM = `tm_demo_marco_${SOFIA}`;
const ROSA = {
  id: "usr_demo_rosa_collab",
  email: "rosa@urbnbee.test",
  fullName: "Rosa Gómez",
  avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop&q=85",
};
const ROSA_TM = `tm_demo_rosa_${SOFIA}`;
const IVAN_TM = `tm_demo_ivan_${SOFIA}`;
const ago = (days, h = 0) => new Date(Date.now() - days * 86_400_000 - h * 3_600_000).toISOString();

if (hosts.some((h) => h.id === SOFIA)) {
  const s = readJson("marketplace-store.json", null);
  const titleOf = (id) => s?.listings?.find((l) => l.id === id)?.title || "tu anuncio";

  // Rosa: limpia Condesa y Coyoacán y contesta mensajes
  if (s?.users && !s.users.some((u) => u.id === ROSA.id) && !s.emailToUserId?.[ROSA.email]) {
    hash ??= bcrypt.hashSync(PASSWORD, 10);
    s.users.push({ id: ROSA.id, email: ROSA.email, passwordHash: hash, fullName: ROSA.fullName, role: "guest", createdAt: NOW });
    s.emailToUserId = { ...(s.emailToUserId ?? {}), [ROSA.email]: ROSA.id };
    s.hostProfiles = s.hostProfiles ?? {};
    s.hostProfiles[ROSA.id] ??= { userId: ROSA.id, bio: "", avatarUrl: ROSA.avatar };
    writeJson("marketplace-store.json", s);
    changes++;
  }

  // Asientos para 4 colaboradores (Lupita, Marco, Rosa e Iván con invitación pendiente)
  const ent2 = readJson("host-entitlements.json", { version: 1, entitlements: [] });
  const seats = ent2?.entitlements?.find((e) => e.hostId === SOFIA && e.sku === "cabibee_collaborators");
  if (seats && seats.stripeSubscriptionId === "simulated" && (seats.quantity ?? 0) < 4) {
    seats.quantity = 4;
    seats.updatedAt = NOW;
    writeJson("host-entitlements.json", ent2);
    changes++;
  }

  const team2 = readJson("team-members.json", { version: 1, members: [] });
  if (team2) {
    team2.members = Array.isArray(team2.members) ? team2.members : [];
    const extra = [
      {
        id: ROSA_TM,
        email: ROSA.email,
        userId: ROSA.id,
        roles: ["cleaning", "messages"],
        listingIds: [S_CONDESA, S_COYO],
        status: "active",
        invitedAt: ago(20),
        respondedAt: ago(19),
        updatedAt: ago(19),
      },
      {
        id: IVAN_TM,
        email: "ivan.mantenimiento.demo@gmail.com",
        roles: ["cleaning"],
        listingIds: [S_ROMA],
        status: "pending",
        invitedAt: ago(1),
        updatedAt: ago(1),
      },
    ];
    for (const m of extra) {
      if (team2.members.some((x) => x.id === m.id || (x.hostId === SOFIA && x.email === m.email))) continue;
      team2.members.push({ ...m, hostId: SOFIA });
      changes++;
    }
    writeJson("team-members.json", team2);
  }

  // Reservas de varios huéspedes en sus tres anuncios, en todos los estados
  const bk = readJson("bookings.json", { version: 1, bookings: [] });
  if (bk) {
    bk.bookings = Array.isArray(bk.bookings) ? bk.bookings : [];
    const price = { [S_ROMA]: [1680, 280], [S_CONDESA]: [890, 120], [S_COYO]: [2380, 380] };
    const used = new Set(bk.bookings.map((b) => b.token));
    const rows = [
      ["ana_current", S_CONDESA, "CONFIRMED", "2026-10-03", "2026-10-08", "Ana Torres", "+52 55 2210 4471", "paid"],
      ["luis_upcoming", S_ROMA, "CONFIRMED", "2026-10-11", "2026-10-15", "Luis Pérez", "+52 81 1932 0045", "paid"],
      ["carla_upcoming", S_COYO, "CONFIRMED", "2026-10-24", "2026-10-27", "Carla Méndez", "+52 33 3871 2290", "paid"],
      ["jorge_pending", S_CONDESA, "PENDING_HOST", "2026-10-25", "2026-10-28", "Jorge Castillo", "+52 55 4410 9832", "paid"],
      ["mariana_pay", S_ROMA, "AWAITING_PAYMENT", "2026-10-30", "2026-11-02", "Mariana López", "+52 222 518 7730", "unpaid"],
      ["roberto_done", S_COYO, "COMPLETED", "2026-09-15", "2026-09-19", "Roberto Silva", "+52 55 6012 3348", "paid"],
      ["fernanda_done", S_ROMA, "COMPLETED", "2026-08-25", "2026-08-30", "Fernanda Ruiz", "+52 442 190 5521", "paid"],
      ["daniel_cancel", S_CONDESA, "CANCELLED", "2026-11-14", "2026-11-16", "Daniel Ortega", "+52 55 7781 0094", "refunded"],
      ["valeria_expired", S_COYO, "EXPIRED", "2026-11-20", "2026-11-23", "Valeria Núñez", "+52 998 441 2067", "unpaid"],
      ["tomas_rejected", S_ROMA, "REJECTED", "2026-11-27", "2026-11-29", "Tomás Vega", "+52 55 3307 6618", "unpaid"],
    ];
    rows.forEach(([key, listingId, status, checkIn, checkOut, guestName, guestPhone, pay], i) => {
      const id = `bkg_sofia_seed_${key}`;
      if (bk.bookings.some((b) => b.id === id)) return;
      let token = String(610000 + i * 7919).slice(0, 6);
      while (used.has(token)) token = String(100000 + Math.floor(Math.random() * 900000));
      used.add(token);
      const nights = Math.round((Date.parse(checkOut) - Date.parse(checkIn)) / 86_400_000);
      const [nightly, cleaningMxn] = price[listingId];
      const stay = nightly * nights;
      const paid = pay !== "unpaid";
      const createdAt = new Date(Math.min(Date.parse(checkIn) - 9 * 86_400_000, Date.now() - (i + 1) * 3_600_000)).toISOString();
      bk.bookings.push({
        id,
        listingId,
        hostId: SOFIA,
        guestEmail: `${guestName.toLowerCase().replace(" ", ".")}.demo@gmail.com`.normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
        guestName,
        guestPhone,
        checkIn,
        checkOut,
        nights,
        estimatedTotalMxn: stay + cleaningMxn,
        platformFeeMxn: Math.max(1, Math.round((stay + cleaningMxn) * 0.01)),
        cleaningFeeMxn: cleaningMxn,
        status,
        paymentStatus: pay,
        contractStatus: paid ? "signed" : "pending",
        token,
        createdAt,
        updatedAt: createdAt,
        ...(paid ? { paidAt: createdAt, stripeCheckoutSessionId: `simulated_seed_${id}` } : {}),
        chargedVia: "platform",
      });
      changes++;
    });
    writeJson("bookings.json", bk);
  }

  // Chats del equipo: Sofía, Lupita, Marco y Rosa
  const chats = readJson("team-chats.json", { version: 1, channels: [], messages: [] });
  if (chats) {
    chats.channels = Array.isArray(chats.channels) ? chats.channels : [];
    chats.messages = Array.isArray(chats.messages) ? chats.messages : [];
    const CH = [
      {
        id: "tch_seed_sofia_limpiezas",
        name: "Limpiezas",
        emoji: "🧹",
        msgs: [
          [SOFIA, "Lupita, el jueves entra Ana en Condesa a las 3 pm. ¿Alcanzas a dejarlo listo antes?", 2, 5],
          ["usr_demo_lupita_clean", "Sí, llego a las 11. Dejo foto de la recámara y el baño al terminar.", 2, 4],
          [ROSA.id, "Yo me encargo de Coyoacán el sábado. Faltan sábanas limpias, las llevo de la bodega.", 1, 9],
          [SOFIA, "Gracias, Rosa. Revisa también la llave del lavabo, Roberto dijo que goteaba.", 1, 8],
          ["usr_demo_lupita_clean", "Listo Condesa ✅ Ya subí las fotos en la limpieza.", 0, 3],
        ],
      },
      {
        id: "tch_seed_sofia_insumos",
        name: "Insumos",
        emoji: "📦",
        msgs: [
          ["usr_demo_lupita_clean", "Ya casi no hay papel de baño en la bodega, quedan 4 paquetes.", 1, 6],
          [SOFIA, "Lo pido hoy en el súper. ¿Algo más?", 1, 5],
          [ROSA.id, "Bolsas de basura y shampoo de cortesía para Roma. En Coyoacán queda poca crema.", 1, 4],
          [SOFIA, "Anotado. Bajen la cantidad en Insumos cuando usen algo para que nos avise solo.", 1, 3],
        ],
      },
      {
        id: "tch_seed_sofia_reservas",
        name: "Reservas y huéspedes",
        emoji: "🗓️",
        msgs: [
          ["usr_demo_marco_collab", "Entró la solicitud de Jorge Castillo para Condesa (25 al 28). Tiene identidad verificada.", 0, 7],
          [SOFIA, "Acéptala, Marco. Y recuérdale a Mariana que su pago de Roma vence pronto.", 0, 6],
          ["usr_demo_marco_collab", "Hecho, ya le escribí a Mariana por el chat del anuncio.", 0, 5],
          [SOFIA, "Perfecto. Luis llega el 11 a Roma, déjale las instrucciones de la caja de llaves.", 0, 2],
        ],
      },
    ];
    for (const c of CH) {
      const last = c.msgs[c.msgs.length - 1];
      if (!chats.channels.some((x) => x.id === c.id)) {
        chats.channels.push({
          id: c.id,
          hostId: SOFIA,
          name: c.name,
          emoji: c.emoji,
          createdBy: SOFIA,
          createdAt: ago(c.msgs[0][2] + 1),
          lastAt: ago(last[2], last[3]),
        });
        changes++;
      }
      c.msgs.forEach(([by, body, d, h], i) => {
        const id = `tcm_seed_${c.id.slice(9)}_${i}`;
        if (chats.messages.some((m) => m.id === id)) return;
        chats.messages.push({ id, channelId: c.id, hostId: SOFIA, by, body, at: ago(d, h) });
        changes++;
      });
    }
    writeJson("team-chats.json", chats);
  }

  // Insumos: unos ya en alarma y otros a una o dos piezas del mínimo
  const sup = readJson("supplies.json", { version: 1, items: [] });
  const lowItems = [];
  if (sup) {
    sup.items = Array.isArray(sup.items) ? sup.items : [];
    const ITEMS = [
      ["papel", null, "Papel higiénico (paquetes)", "🧻", 4, 6, ["host", LUPITA_TM], 1],
      ["jabon", null, "Jabón para manos", "🧴", 3, 2, ["host"]],
      ["esponjas", null, "Esponjas", "🧽", 10, 4, ["host"]],
      ["bolsas", null, "Bolsas de basura (rollos)", "🗑️", 1, 3, ["host", LUPITA_TM], 2],
      ["cafe", S_ROMA, "Café en cápsulas", "☕", 6, 5, ["host"]],
      ["toallas", S_ROMA, "Toallas de baño", "🛁", 8, 4, ["host"]],
      ["shampoo", S_ROMA, "Shampoo de cortesía", "🧼", 0, 2, ["host", LUPITA_TM], 1],
      ["agua", S_CONDESA, "Garrafón de agua", "💧", 2, 1, ["host", ROSA_TM]],
      ["multiusos", S_CONDESA, "Limpiador multiusos", "🧹", 1, 1, ["host", ROSA_TM], 0],
      ["sabanas", S_COYO, "Juegos de sábanas", "🛏️", 5, 4, ["host", ROSA_TM]],
      ["detalles", S_COYO, "Detalles de bienvenida", "🍬", 12, 3, ["host"]],
      ["crema", S_COYO, "Crema corporal", "🧴", 2, 2, ["host", ROSA_TM], 0],
    ];
    for (const [key, listingId, name, emoji, qty, min, alertTo, lowDays] of ITEMS) {
      const id = `sup_seed_sofia_${key}`;
      const low = qty <= min;
      const item = {
        id,
        hostId: SOFIA,
        listingId,
        name,
        emoji,
        qty,
        min,
        alertTo,
        ...(low ? { lowSince: ago(lowDays ?? 0, 3) } : {}),
        updatedAt: ago(lowDays ?? 2, 3),
        updatedBy: low ? "usr_demo_lupita_clean" : SOFIA,
      };
      if (low) lowItems.push(item);
      if (sup.items.some((x) => x.id === id)) continue;
      sup.items.push(item);
      changes++;
    }
    writeJson("supplies.json", sup);
  }

  // Alarmas en el centro de notificaciones
  const nf = readJson("notifications.json", { version: 1, notifications: [] });
  if (nf) {
    nf.notifications = Array.isArray(nf.notifications) ? nf.notifications : [];
    const userOfTm = { [LUPITA_TM]: "usr_demo_lupita_clean", [ROSA_TM]: ROSA.id, host: SOFIA };
    const add = (n) => {
      if (nf.notifications.some((x) => x.id === n.id)) return;
      nf.notifications.push(n);
      changes++;
    };
    for (const it of lowItems) {
      const where = it.listingId ? titleOf(it.listingId) : "la bodega";
      for (const to of it.alertTo) {
        const userId = userOfTm[to];
        if (!userId) continue;
        add({
          id: `ntf_seed_${it.id.slice(9)}_${to === "host" ? "host" : to.split("_")[2]}`,
          userId,
          kind: "cleaning",
          title: "Hay que comprar: {name}",
          body: "Quedan {qty} en {where} (mínimo {min}).",
          vars: { name: `${it.emoji} ${it.name}`, qty: it.qty, where, min: it.min },
          url: userId === SOFIA ? "/host/limpieza#insumos" : "/equipo",
          groupKey: `supply:${it.id}`,
          createdAt: it.lowSince,
        });
      }
    }
    add({
      id: "ntf_seed_sofia_confirmed_luis",
      userId: SOFIA,
      kind: "booking",
      title: "Reserva confirmada",
      body: "{name} firmó el contrato de {listing} ({checkIn} → {checkOut}).",
      vars: { name: "Luis Pérez", listing: titleOf(S_ROMA), checkIn: "2026-10-11", checkOut: "2026-10-15" },
      url: "/host/calendario",
      createdAt: ago(3, 2),
    });
    add({
      id: "ntf_seed_sofia_sign_jorge",
      userId: SOFIA,
      kind: "contract",
      title: "Firma el contrato para que tu huésped pueda pagar",
      body: "{guest} ya firmó el contrato de {listing}. El pago se habilita en cuanto tú firmes.",
      vars: { guest: "Jorge Castillo", listing: titleOf(S_CONDESA) },
      url: "/host/requests",
      createdAt: ago(0, 7),
    });
    add({
      id: "ntf_seed_sofia_review_roberto",
      userId: SOFIA,
      kind: "review",
      title: "Deja una reseña de {name}",
      body: "Terminó su estancia en {listing}. Califica al huésped para que otros anfitriones lo conozcan.",
      vars: { name: "Roberto Silva", listing: titleOf(S_COYO) },
      url: "/host/resenas?b=bkg_sofia_seed_roberto_done",
      createdAt: ago(15),
    });
    const received = (readJson("stay-reviews.json", { reviews: [] }).reviews ?? [])
      .filter((r) => r.hostId === SOFIA && r.kind === "guest_to_listing" && (r.status ?? "published") === "published")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 4);
    for (const r of received) {
      const guest = s?.users?.find((u) => u.id === r.authorUserId)?.fullName?.trim() || "Un huésped";
      add({
        id: `ntf_seed_got_${r.id}`,
        userId: SOFIA,
        kind: "review",
        title: "{name} te dejó una reseña · {stars}",
        body: "Calificó su estancia en {listing}. Toca para verla y reseñar tú también.",
        vars: { name: guest, stars: "★".repeat(Math.max(1, Math.min(5, Math.round(r.rating)))), listing: titleOf(r.listingId) },
        url: `/host/resenas?b=${r.bookingId}`,
        createdAt: r.createdAt,
      });
    }
    add({
      id: "ntf_seed_sofia_paid_jorge",
      userId: SOFIA,
      kind: "payment",
      title: "Pago recibido",
      body: "{name} pagó ${amount} MXN por {listing}.",
      vars: { name: "Jorge Castillo", amount: "4,350", listing: titleOf(S_CONDESA) },
      url: "/host/calendario",
      createdAt: ago(0, 5),
    });
    add({
      id: "ntf_seed_sofia_paid_roberto",
      userId: SOFIA,
      kind: "payment",
      title: "Pago recibido",
      body: "{name} pagó ${amount} MXN por {listing}.",
      vars: { name: "Roberto Silva", amount: "6,200", listing: titleOf(S_COYO) },
      url: "/host/calendario",
      createdAt: ago(18),
    });
    add({
      id: "ntf_seed_sofia_chat_insumos",
      userId: SOFIA,
      kind: "team",
      title: "📦 Insumos",
      body: "Rosa: Bolsas de basura y shampoo de cortesía para Roma. En Coyoacán queda poca crema.",
      rawBody: true,
      url: "/host/mensajes?tab=equipo&chat=tch_seed_sofia_insumos",
      groupKey: "team-chat:tch_seed_sofia_insumos",
      createdAt: ago(1, 4),
    });
    for (const n of nf.notifications) {
      const url = typeof n.url === "string" ? n.url : "";
      const moved = url.startsWith("/host/colaboradores?chat=")
        ? url.replace("/host/colaboradores?", "/host/mensajes?tab=equipo&")
        : url.startsWith("/equipo?chat=")
          ? url.replace("/equipo?", "/mensajes?tab=equipo&")
          : null;
      if (moved) {
        n.url = moved;
        changes++;
      }
    }
    writeJson("notifications.json", nf);
  }

  // Limpieza de Sofía: prioridad por anuncio, aprobación y limpiezas con fotos y comentarios
  const cl = readJson("cleaning-tasks.json", { version: 1, tasks: [], defaults: {}, settings: {} });
  if (cl) {
    cl.tasks = Array.isArray(cl.tasks) ? cl.tasks : [];
    cl.defaults = cl.defaults ?? {};
    cl.settings = cl.settings ?? {};
    const PRIORITY = { [S_ROMA]: [LUPITA_TM, ROSA_TM], [S_CONDESA]: [ROSA_TM, LUPITA_TM], [S_COYO]: [ROSA_TM, LUPITA_TM] };
    for (const [id, list] of Object.entries(PRIORITY)) {
      // Sólo se toca lo que dejó este mismo script (Lupita sola); lo que Sofía cambió se respeta.
      if (cl.defaults[id] === LUPITA_TM) {
        cl.defaults[id] = id === S_ROMA ? [LUPITA_TM] : list;
        changes++;
      }
    }
    const st = (cl.settings[SOFIA] ??= { assignMode: "auto", requirePhoto: true });
    for (const [k, v] of Object.entries({ requireApproval: true, confirmHours: 24, cancelHours: 24 })) {
      if (st[k] === undefined) {
        st[k] = v;
        changes++;
      }
    }
    const photosOf = (listingId, n, by, at) =>
      (s?.listings?.find((l) => l.id === listingId)?.photos ?? []).slice(0, n).map((url, i) => ({ id: `seedph${i}`, key: "", url, by, at }));
    const dayAgo = (d) => ago(d).slice(0, 10);
    const DONE = [
      ["review_condesa", S_CONDESA, ROSA_TM, ROSA.id, 1, "pending", "Cambié sábanas y toallas, y ya no gotea la llave del lavabo. Dejé el garrafón nuevo en la cocina.", 3],
      ["review_roma", S_ROMA, LUPITA_TM, "usr_demo_lupita_clean", 2, "pending", "Todo listo. Faltó shampoo de cortesía, ya lo bajé en insumos para que se compre.", 2],
      ["ok_coyoacan", S_COYO, ROSA_TM, ROSA.id, 6, "approved", "Limpieza profunda del patio y la cocina. El huésped dejó una botella de vino de regalo.", 3],
      ["ok_roma", S_ROMA, LUPITA_TM, "usr_demo_lupita_clean", 9, "approved", "Recámara y baño listos, cambié las cortinas del cuarto.", 2],
      ["ok_condesa", S_CONDESA, LUPITA_TM, "usr_demo_lupita_clean", 12, "approved", "Sin novedades. Repuse papel y jabón.", 1],
    ];
    for (const [key, listingId, tm, userId, d, approval, note, nPhotos] of DONE) {
      const id = `cl_seed_sofia_${key}`;
      if (cl.tasks.some((t) => t.id === id)) continue;
      const doneAt = ago(d, -4);
      cl.tasks.push({
        id,
        hostId: SOFIA,
        listingId,
        date: dayAgo(d),
        time: "11:00",
        assignee: tm,
        status: "done",
        note,
        doneAt,
        doneBy: userId,
        confirmAskedAt: ago(d + 3),
        confirmedAt: ago(d + 2),
        photos: photosOf(listingId, nPhotos, userId, doneAt),
        approval,
        ...(approval === "approved" ? { approvedAt: ago(d, -6) } : {}),
        createdAt: ago(d + 4),
        updatedAt: doneAt,
      });
      changes++;
    }
    // Rosa no puede ir: queda el motivo y pasa a Lupita, que todavía no confirma
    const inDays = (d) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);
    if (!cl.tasks.some((t) => t.id === "cl_seed_sofia_cancelled_rosa")) {
      cl.tasks.push({
        id: "cl_seed_sofia_cancelled_rosa",
        hostId: SOFIA,
        listingId: S_COYO,
        date: inDays(4),
        time: "12:00",
        assignee: LUPITA_TM,
        status: "pending",
        note: "Antes de que llegue Carla: revisar la llave del lavabo.",
        confirmAskedAt: ago(0, 5),
        cancellations: [{ assignee: ROSA_TM, at: ago(0, 5), reason: "Tengo cita en el IMSS ese día y no alcanzo a llegar." }],
        createdAt: ago(3),
        updatedAt: ago(0, 5),
      });
      changes++;
    }
    if (!cl.tasks.some((t) => t.id === "cl_seed_sofia_confirmed_roma")) {
      cl.tasks.push({
        id: "cl_seed_sofia_confirmed_roma",
        hostId: SOFIA,
        listingId: S_ROMA,
        date: inDays(6),
        time: "10:00",
        assignee: LUPITA_TM,
        status: "pending",
        note: "Limpieza de ventanas y terraza.",
        confirmAskedAt: ago(1),
        confirmedAt: ago(0, 20),
        createdAt: ago(1),
        updatedAt: ago(0, 20),
      });
      changes++;
    }
    writeJson("cleaning-tasks.json", cl);

    const nf2 = readJson("notifications.json", { version: 1, notifications: [] });
    if (nf2) {
      nf2.notifications = Array.isArray(nf2.notifications) ? nf2.notifications : [];
      const N = [
        {
          id: "ntf_seed_sofia_clean_cancel_rosa",
          userId: SOFIA,
          kind: "cleaning",
          title: "{name} canceló una limpieza",
          body: "{listing} · {date}. Motivo: «{reason}». Se la pasamos a {next}.",
          vars: { name: ROSA.fullName, listing: titleOf(S_COYO), date: inDays(4), reason: "Tengo cita en el IMSS ese día y no alcanzo a llegar.", next: "Lupita Hernández" },
          url: "/host/limpieza",
          groupKey: "cleaning-cancel:cl_seed_sofia_cancelled_rosa:1",
          createdAt: ago(0, 5),
        },
        {
          id: "ntf_seed_sofia_clean_review",
          userId: SOFIA,
          kind: "cleaning",
          title: "Revisa y aprueba una limpieza",
          body: "{name} terminó {listing} ({date}).",
          vars: { name: ROSA.fullName, listing: titleOf(S_CONDESA), date: dayAgo(1) },
          url: "/host/limpieza",
          groupKey: "cleaning:cl_seed_sofia_review_condesa",
          createdAt: ago(1, -4),
        },
        {
          id: "ntf_seed_lupita_clean_confirm",
          userId: "usr_demo_lupita_clean",
          kind: "cleaning",
          title: "Te pasaron una limpieza",
          body: "{listing} · {date}. Confirma que sí puedes, a más tardar {hours} h antes.",
          vars: { listing: titleOf(S_COYO), date: inDays(4), hours: 24 },
          url: "/equipo",
          groupKey: "cleaning:cl_seed_sofia_cancelled_rosa",
          createdAt: ago(0, 5),
        },
      ];
      for (const n of N) {
        if (nf2.notifications.some((x) => x.id === n.id)) continue;
        nf2.notifications.push(n);
        changes++;
      }
      writeJson("notifications.json", nf2);
    }
  }

  // Un grupo de chat sólo con Rosa (los demás chats son de todo el equipo)
  const chats2 = readJson("team-chats.json", { version: 1, channels: [], messages: [] });
  if (chats2 && !chats2.channels?.some((c) => c.id === "tch_seed_sofia_rosa")) {
    chats2.channels = Array.isArray(chats2.channels) ? chats2.channels : [];
    chats2.messages = Array.isArray(chats2.messages) ? chats2.messages : [];
    chats2.channels.push({
      id: "tch_seed_sofia_rosa",
      hostId: SOFIA,
      name: "Condesa y Coyoacán",
      emoji: "🏡",
      createdBy: SOFIA,
      createdAt: ago(5),
      lastAt: ago(0, 4),
      memberIds: [ROSA.id],
    });
    [
      [SOFIA, "Rosa, armé este grupo sólo para Condesa y Coyoacán.", 5, 0],
      [ROSA.id, "Perfecto. No pude con la de Coyoacán del viernes, ya dejé el motivo en la limpieza.", 0, 5],
      [SOFIA, "Sin problema, ya le llegó a Lupita. Gracias por avisar con tiempo.", 0, 4],
    ].forEach(([by, body, d, h], i) => {
      chats2.messages.push({ id: `tcm_seed_sofia_rosa_${i}`, channelId: "tch_seed_sofia_rosa", hostId: SOFIA, by, body, at: ago(d, h) });
    });
    writeJson("team-chats.json", chats2);
    changes++;
  }

  // Un chat de uno a uno con Lupita, en la misma lista que los grupos
  const chats3 = readJson("team-chats.json", { version: 1, channels: [], messages: [] });
  if (chats3 && !chats3.channels?.some((c) => c.id === "tch_seed_sofia_lupita_dm")) {
    chats3.channels = Array.isArray(chats3.channels) ? chats3.channels : [];
    chats3.messages = Array.isArray(chats3.messages) ? chats3.messages : [];
    const LUPITA_USER = "usr_demo_lupita_clean";
    chats3.channels.push({
      id: "tch_seed_sofia_lupita_dm",
      hostId: SOFIA,
      name: "Directo",
      emoji: "👤",
      createdBy: SOFIA,
      createdAt: ago(3),
      lastAt: ago(0, 2),
      pair: [SOFIA, LUPITA_USER].sort(),
    });
    [
      [SOFIA, "Lupita, ¿me puedes cubrir la de Coyoacán del viernes?", 0, 3],
      [LUPITA_USER, "Sí, ahí estoy a las 11. ¿Dejo las llaves en la caja como siempre?", 0, 2],
    ].forEach(([by, body, d, h], i) => {
      chats3.messages.push({ id: `tcm_seed_sofia_lupita_dm_${i}`, channelId: "tch_seed_sofia_lupita_dm", hostId: SOFIA, by, body, at: ago(d, h) });
    });
    writeJson("team-chats.json", chats3);
    changes++;
  }

  // Huéspedes con cuenta en las reservas en curso y próximas: así los mensajes llegan a su chat
  const GUESTS = [
    ["bkg_sofia_seed_ana_current", "usr_seed_guest_ana", "ana.torres@urbnbee.test", "Ana Torres"],
    ["bkg_sofia_seed_luis_upcoming", "usr_seed_guest_luis", "luis.perez@urbnbee.test", "Luis Pérez"],
    ["bkg_sofia_seed_carla_upcoming", "usr_seed_guest_carla", "carla.mendez@urbnbee.test", "Carla Méndez"],
  ];
  // Quién se queda: Carla va como acompañante de Ana con su cuenta (ve la estancia en sus Viajes)
  const PARTY = {
    bkg_sofia_seed_ana_current: [{ name: "Carla Méndez", userId: "usr_seed_guest_carla" }, { name: "Mateo Torres" }],
    bkg_sofia_seed_luis_upcoming: [{ name: "Andrea Ríos" }],
  };
  const s4 = readJson("marketplace-store.json", null);
  const bk4 = readJson("bookings.json", null);
  if (s4?.users && Array.isArray(bk4?.bookings)) {
    let touched = false;
    for (const [bookingId, userId, email, fullName] of GUESTS) {
      if (!s4.users.some((u) => u.id === userId) && !s4.emailToUserId?.[email]) {
        hash ??= bcrypt.hashSync(PASSWORD, 10);
        s4.users.push({ id: userId, email, passwordHash: hash, fullName, role: "guest", createdAt: ago(30) });
        s4.emailToUserId = { ...(s4.emailToUserId ?? {}), [email]: userId };
        touched = true;
        changes++;
      }
      const u = s4.users.find((x) => x.id === userId);
      if (u && !u.emailVerifiedAt) {
        u.emailVerifiedAt = ago(30);
        touched = true;
        changes++;
      }
      const b = bk4.bookings.find((x) => x.id === bookingId);
      if (b && !b.guestUserId) {
        b.guestUserId = userId;
        b.guestEmail = email;
        changes++;
      }
      if (b && b.guestCount === undefined) {
        b.party = PARTY[bookingId] ?? [];
        b.guestCount = b.party.length + 1;
        changes++;
      }
    }
    if (touched) writeJson("marketplace-store.json", s4);
    writeJson("bookings.json", bk4);

    // Identidad verificada: sin ella el chat del huésped es sólo texto (no puede mandar fotos ni audios)
    const verif = readJson("guest-verification.json", { version: 1, verifications: [] });
    if (verif) {
      verif.verifications = Array.isArray(verif.verifications) ? verif.verifications : [];
      let vTouched = false;
      for (const [, userId] of GUESTS) {
        if (!s4.users.some((u) => u.id === userId)) continue;
        if (verif.verifications.some((v) => v.userId === userId)) continue;
        verif.verifications.push({ userId, kycStatus: "verified", bookingPassesRemaining: 3, updatedAt: ago(30) });
        vTouched = true;
        changes++;
      }
      if (vTouched) writeJson("guest-verification.json", verif);
    }
  }

  // Guía de llegada y mensajes de la estancia de sus anuncios, para probar los envíos.
  // Las fotos y audios los pone el servidor al arrancar (lib/demo-stay-media.ts): van al almacenamiento privado.
  const CONTENT = {
    [S_ROMA]: {
      guide: {
        checkInTime: "15:00",
        checkOutTime: "11:00",
        checkInMethod: "Caja de llaves junto a la puerta del edificio (la gris, a la derecha del timbre).",
        accessCode: "4821",
        wifiName: "Roma_Cabibee",
        wifiPassword: "colibri2026",
        directions: "Estás a dos cuadras del metrobús Álvaro Obregón. El edificio tiene portón negro y una jacaranda enfrente.",
        houseManual: "No se fuma adentro. Silencio después de las 22:00. La basura va en el cuarto del fondo del pasillo.",
        checkoutInstructions: "Deja las llaves en la caja, apaga el aire acondicionado y cierra las ventanas.",
      },
      welcome: "¡Hola {huesped}, bienvenido a {anuncio}!\n\nTe dejo una foto de la sala y una nota de voz con cómo funciona el aire y el agua caliente.\n📶 Wifi: {wifi}\n🔒 Contraseña: {wifi_clave}\n\nCualquier cosa, escríbeme por aquí.\n{anfitrion}",
      mid: "Hola {huesped}, ¿cómo va todo en {anuncio}?\n\n¿Necesitas toallas o sábanas limpias, o algo de la casa? Dime y lo resolvemos hoy mismo.\n{anfitrion}",
      checkout: "Hola {huesped}, gracias por quedarte en {anuncio}.\n\nLa salida es el {fecha_salida} antes de las {salida}. Deja las llaves en la caja y cierra bien la puerta.\n\n¡Buen viaje!\n{anfitrion}",
    },
    [S_CONDESA]: {
      guide: {
        checkInTime: "14:00",
        checkOutTime: "12:00",
        checkInMethod: "Cerradura con código en la puerta del departamento (piso 3, puerta 302).",
        accessCode: "7319#",
        wifiName: "Condesa302",
        wifiPassword: "parqueMexico",
        directions: "Frente al Parque México. Si llegas en auto, hay estacionamiento público en Michoacán 78.",
        houseManual: "Las mascotas son bienvenidas pero no en la cama. Silencio después de las 22:00.",
        checkoutInstructions: "Cierra con el código, deja los platos lavados y la basura en el contenedor de la planta baja.",
      },
      welcome: "¡Hola {huesped}, bienvenida a {anuncio}!\n\nAquí tienes una foto de la entrada y una nota de voz con lo básico del departamento.\n📶 Wifi: {wifi}\n🔒 Contraseña: {wifi_clave}\n\nQue disfrutes la Condesa.\n{anfitrion}",
      mid: "Hola {huesped}, ¿todo bien en {anuncio}?\n\nSi te falta algo (café, papel, toallas) o tienes una duda, escríbeme y te ayudo.\n{anfitrion}",
      checkout: "Hola {huesped}, mañana es tu salida de {anuncio}.\n\nSal antes de las {salida}, cierra con el código y deja la basura abajo.\n\n¡Gracias por tu visita!\n{anfitrion}",
    },
    [S_COYO]: {
      guide: {
        checkInTime: "16:00",
        checkOutTime: "11:00",
        checkInMethod: "Toca el timbre de la casa azul; Lupita te entrega las llaves en persona.",
        accessCode: "Portón: 1590",
        wifiName: "CasaCoyoacan",
        wifiPassword: "fridakahlo",
        directions: "A tres cuadras de la Casa Azul. Entra por Allende y gira en Londres; es la casa con buganvilia.",
        houseManual: "El jardín es para los huéspedes. El boiler se prende con el botón rojo de la cocina.",
        checkoutInstructions: "Deja las llaves en la mesa del comedor y jala el portón al salir.",
      },
      welcome: "¡Hola {huesped}, bienvenido a {anuncio}!\n\nTe mando una foto del jardín y una nota de voz explicando el boiler.\n📶 Wifi: {wifi}\n🔒 Contraseña: {wifi_clave}\n\nDisfruta Coyoacán.\n{anfitrion}",
      mid: "Hola {huesped}, ¿cómo vas en {anuncio}?\n\n¿Todo bien con la casa? Si necesitas algo, aquí estoy.\n{anfitrion}",
      checkout: "Hola {huesped}, gracias por cuidar {anuncio}.\n\nLa salida es el {fecha_salida} antes de las {salida}. Deja las llaves en el comedor y jala el portón.\n{anfitrion}",
    },
  };
  const s5 = readJson("marketplace-store.json", null);
  if (s5?.listings) {
    let touched = false;
    for (const [listingId, c] of Object.entries(CONTENT)) {
      const l = s5.listings.find((x) => x.id === listingId && x.hostId === SOFIA);
      if (!l || l.demoStayMedia) continue;
      l.arrivalGuide = { ...c.guide, ...(l.arrivalGuide ?? {}) };
      l.arrivalMessage = { mode: "manual", daysBefore: 1, template: l.arrivalMessage?.template ?? "", attachments: [] };
      if (!l.arrivalMessage.template) delete l.arrivalMessage.template;
      l.stayMessages = {
        welcome: { id: "welcome", enabled: true, mode: "manual", text: c.welcome, attachments: [] },
        mid: [{ id: "mid1", enabled: true, mode: "manual", text: c.mid, attachments: [], everyDays: 2 }],
        checkout: { id: "checkout", enabled: true, mode: "manual", text: c.checkout, attachments: [], daysBefore: 1 },
      };
      l.demoStayMedia = "pending";
      touched = true;
      changes++;
    }
    if (touched) writeJson("marketplace-store.json", s5);
  }
}

console.log(changes ? `[seed-demo-tools] ${changes} cambios` : "[seed-demo-tools] ya estaba al día");
