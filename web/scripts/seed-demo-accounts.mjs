#!/usr/bin/env node
/**
 * Una sola cuenta demo (como Airbnb): anfitriona y huésped a la vez.
 *   sofia@urbnbee.test   /   Demo2026!
 *
 * Modo anfitrión: sus anuncios, reservas que le llegan y chats de huéspedes.
 * Modo huésped: viajes y chats en los anuncios de Pedro.
 * Diego existe solo como contraparte (le reserva a Sofía); no hace falta entrar con él.
 *
 * Idempotente: se puede volver a correr; pisa solo los registros demo_* .
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import bcrypt from "bcryptjs";

const cwd = process.cwd();
const rawDir = process.env.URBNBEE_DATA_DIR?.trim();
const dataDir = rawDir ? (isAbsolute(rawDir) ? rawDir : resolve(cwd, rawDir)) : join(cwd, "data");
mkdirSync(dataDir, { recursive: true });

const PASSWORD = "Demo2026!";
const HOST_ID = "usr_demo_sofia_host";
const GUEST_ID = "usr_demo_diego_guest";
const HOST_EMAIL = "sofia@urbnbee.test";
const GUEST_EMAIL = "diego@urbnbee.test";
const DIEGO_SID = `gu_${GUEST_ID}`;
const SOFIA_GUEST_SID = `gu_${HOST_ID}`;
const PEDRO_ID = "usr_seed_pedro_dev";
const LST_PEDRO_ROMA = "lst_pedro_departamento_roma";
const LST_PEDRO_CONDESA = "lst_pedro_habitacion_condesa";
const LST_PEDRO_COYO = "lst_pedro_casa_coyoacan";

const LST_ROMA = "lst_demo_sofia_roma";
const LST_CONDESA = "lst_demo_sofia_condesa";
const LST_COYO = "lst_demo_sofia_coyoacan";
const LST_VALLE = "lst_demo_sofia_valle";
const LST_DRAFT = "lst_demo_sofia_draft";

const contract = {
  templateId: "cabibee_reserva_v1",
  hostLegalName: "Sofía Ramírez López",
  hostAddress: "Col. Roma Norte, Cuauhtémoc, CDMX",
  propertyAddress: "",
  depositMxn: 0,
  extraClauses: "",
  hostAcknowledged: true,
};

function nowIso() {
  return new Date().toISOString();
}

function readJson(name, fallback) {
  const p = join(dataDir, name);
  if (!existsSync(p)) return fallback;
  return JSON.parse(readFileSync(p, "utf8"));
}

function writeJson(name, data) {
  const p = join(dataDir, name);
  writeFileSync(p, JSON.stringify(data, null, 2), "utf8");
  console.log("  wrote", p);
}

function listingBase(partial) {
  const { propertyAddress, ...rest } = partial;
  return {
    hostId: HOST_ID,
    country: "México",
    verified: true,
    published: true,
    bookingApprovalMode: "approval",
    contract: { ...contract, propertyAddress: propertyAddress || rest.addressLine || "" },
    createdAt: "2026-08-01T15:00:00.000Z",
    updatedAt: nowIso(),
    blockedDates: [],
    ...rest,
  };
}

const listings = [
  listingBase({
    id: LST_ROMA,
    slug: "loft-luminoso-roma-norte-sofia",
    title: "Loft luminoso con terraza — Roma Norte",
    description:
      "Loft de techos altos en un edificio de los 40 restaurado, a tres cuadras del Metro Insurgentes. Cocina abierta, escritorio con silla ergonómica y terraza para el café de la mañana.\n\nIdeal para una pareja o alguien que trabaja remoto. Incluyo wifi simétrico, café de especialidad y una guía impresa con mis restaurantes de la colonia.\n\nCheck-in flexible si me avisas el día anterior.",
    categoryKey: "departamentos",
    spaceType: "Espacio completo",
    city: "Ciudad de México",
    zone: "Roma Norte",
    county: "Cuauhtémoc",
    addressLine: "Calle Orizaba, Roma Norte — dirección exacta al confirmar",
    propertyAddress: "Roma Norte, Cuauhtémoc, CDMX",
    lat: 19.4194,
    lng: -99.1618,
    guests: 3,
    bedrooms: 1,
    bathrooms: 1,
    size: "72 m²",
    pricePerNight: 1680,
    cleaningFee: 280,
    photos: [
      "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200&q=85",
      "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200&q=85",
      "https://images.unsplash.com/photo-1556912172-45b7abe8b7e1?w=1200&q=85",
      "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=1200&q=85",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&q=85",
    ],
    amenities: [
      "Internet Inalámbrico",
      "Aire Acondicionado",
      "Cocina",
      "Refrigerador",
      "Lavadora",
      "Televisión",
      "Terraza o balcón",
      "Cafetera",
      "Ropa de cama",
      "Elementos básicos",
    ],
    rules: { smoking: false, pets: false, parties: false, children: true },
    blockedDates: ["2026-12-24", "2026-12-25", "2026-12-31"],
  }),
  listingBase({
    id: LST_CONDESA,
    slug: "habitacion-privada-condesa-sofia",
    title: "Habitación privada en casa porfiriana — Condesa",
    description:
      "Recámara en planta alta de casa colonial a dos cuadras del Parque México. Baño privado, escritorio frente a la ventana y cocina compartida solo conmigo.\n\nBarrio caminable: cafés, librerías y el Parque España a 8 minutos. Perfecta si viajas sola o en pareja y quieres barrio, no hotel.",
    categoryKey: "habitaciones",
    spaceType: "Habitación privada",
    city: "Ciudad de México",
    zone: "Condesa",
    county: "Cuauhtémoc",
    addressLine: "Cerca del Parque México — dirección al confirmar",
    propertyAddress: "Condesa, Cuauhtémoc, CDMX",
    lat: 19.4118,
    lng: -99.1692,
    guests: 2,
    bedrooms: 1,
    bathrooms: 1,
    size: "16 m²",
    pricePerNight: 890,
    cleaningFee: 120,
    photos: [
      "https://images.unsplash.com/photo-1616594039964-ae9021a400a0?w=1200&q=85",
      "https://images.unsplash.com/photo-1618220179428-22790b461013?w=1200&q=85",
      "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=1200&q=85",
      "https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=1200&q=85",
    ],
    amenities: [
      "Internet Inalámbrico",
      "Agua caliente",
      "Cocina",
      "Escritorio",
      "Ropa de cama",
      "Cafetera",
      "Shampoo",
    ],
    rules: { smoking: false, pets: false, parties: false, children: true },
  }),
  listingBase({
    id: LST_COYO,
    slug: "casa-patio-jardin-coyoacan-sofia",
    title: "Casa completa con patio y limonero — Coyoacán",
    description:
      "Casa de dos niveles para hasta cinco personas: dos recámaras, estudio, sala amplia y patio empedrado con mesa para desayunos.\n\nA diez minutos caminando del centro de Coyoacán y del Museo Frida Kahlo. Acepto una mascota pequeña si me avisas. Incluye lavadora, cocina completa y estacionamiento en calle tranquila.",
    categoryKey: "casas",
    spaceType: "Espacio completo",
    city: "Ciudad de México",
    zone: "Coyoacán",
    county: "Coyoacán",
    addressLine: "Colonia Del Carmen — dirección exacta al confirmar",
    propertyAddress: "Coyoacán, CDMX",
    lat: 19.3491,
    lng: -99.1624,
    guests: 5,
    bedrooms: 2,
    bathrooms: 2,
    size: "128 m²",
    pricePerNight: 2380,
    cleaningFee: 380,
    photos: [
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=85",
      "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=1200&q=85",
      "https://images.unsplash.com/photo-1600607687644-c7171b42498f?w=1200&q=85",
      "https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=1200&q=85",
      "https://images.unsplash.com/photo-1600566752355-35792bedcfea?w=1200&q=85",
    ],
    amenities: [
      "Internet Inalámbrico",
      "Cocina",
      "Lavadora",
      "Jardín / Patio",
      "Estacionamiento Gratuito",
      "Permiten Mascotas",
      "Amigable Familias/Niños",
      "Televisión",
      "Cafetera",
    ],
    rules: { smoking: false, pets: true, parties: false, children: true },
    bookingApprovalMode: "instant",
  }),
  listingBase({
    id: LST_VALLE,
    slug: "cabana-bosque-valle-de-bravo-sofia",
    title: "Cabaña de madera junto al bosque — Valle de Bravo",
    description:
      "Cabaña para cuatro personas a 12 minutos del centro de Valle. Chimenea, terraza con hamacas y sendero hacia el bosque.\n\nTrae suéter: por la noche refresca. Hay súper a 6 minutos en coche. Check-in a partir de las 15:00; si llegas más tarde te dejo la caja de llaves.",
    categoryKey: "cabanas",
    spaceType: "Espacio completo",
    city: "Valle de Bravo",
    zone: "Avándaro",
    county: "Valle de Bravo",
    addressLine: "Camino a Avándaro — pin al confirmar",
    propertyAddress: "Avándaro, Valle de Bravo, Edo. Méx.",
    lat: 19.1752,
    lng: -100.1346,
    guests: 4,
    bedrooms: 2,
    bathrooms: 1,
    size: "85 m²",
    pricePerNight: 2100,
    cleaningFee: 320,
    photos: [
      "https://images.unsplash.com/photo-1449158743715-0a90ebb6d2d8?w=1200&q=85",
      "https://images.unsplash.com/photo-1518780664697-55e3ad937233?w=1200&q=85",
      "https://images.unsplash.com/photo-1758983065583-9cea714214f9?w=1200&q=85",
      "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?w=1200&q=85",
    ],
    amenities: [
      "Internet Inalámbrico",
      "Chimenea Interior",
      "Cocina",
      "Terraza o balcón",
      "Estacionamiento Gratuito",
      "Ropa de cama",
      "Calefacción",
    ],
    rules: { smoking: false, pets: true, parties: false, children: true },
  }),
  listingBase({
    id: LST_DRAFT,
    slug: "estudio-polanco-borrador-sofia",
    title: "Estudio cerca de Lincoln — Polanco (borrador)",
    description: "Borrador: todavía le faltan fotos del baño y el texto final de la cocina.",
    categoryKey: "departamentos",
    spaceType: "Espacio completo",
    city: "Ciudad de México",
    zone: "Polanco",
    county: "Miguel Hidalgo",
    addressLine: "",
    lat: 19.4338,
    lng: -99.1946,
    guests: 2,
    bedrooms: 1,
    bathrooms: 1,
    size: "42 m²",
    pricePerNight: 1950,
    cleaningFee: 200,
    photos: ["https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=1200&q=85"],
    amenities: ["Internet Inalámbrico", "Cocina"],
    rules: { smoking: false, pets: false, parties: false, children: true },
    published: false,
    verified: false,
  }),
];

function booking({
  id,
  listingId,
  status,
  checkIn,
  checkOut,
  nights,
  stayMxn,
  cleaningMxn,
  token,
  createdAt,
  paid,
  hostId = HOST_ID,
  guestUserId = GUEST_ID,
  guestName = "Diego Morales",
  guestEmail = GUEST_EMAIL,
  guestPhone = "+52 55 1844 2201",
}) {
  const platformFeeMxn = Math.max(1, Math.round((stayMxn + cleaningMxn) * 0.01));
  const paidAt = paid ? createdAt : undefined;
  return {
    id,
    listingId,
    hostId,
    ...(guestUserId ? { guestUserId } : {}),
    guestEmail,
    guestName,
    guestPhone,
    checkIn,
    checkOut,
    nights,
    estimatedTotalMxn: stayMxn + cleaningMxn,
    platformFeeMxn,
    cleaningFeeMxn: cleaningMxn,
    status,
    paymentStatus: paid ? "paid" : "unpaid",
    contractStatus: paid ? "signed" : "pending",
    token,
    createdAt,
    updatedAt: createdAt,
    paidAt,
    chargedVia: "platform",
    stripeCheckoutSessionId: paid ? `simulated_demo_${id}` : undefined,
  };
}

const bookings = [
  booking({
    id: "bkg_demo_diego_current",
    listingId: LST_ROMA,
    status: "CONFIRMED",
    checkIn: "2026-09-27",
    checkOut: "2026-10-04",
    nights: 7,
    stayMxn: 1680 * 7,
    cleaningMxn: 280,
    token: "418273",
    createdAt: "2026-09-12T16:20:00.000Z",
    paid: true,
  }),
  booking({
    id: "bkg_demo_diego_upcoming",
    listingId: LST_COYO,
    status: "CONFIRMED",
    checkIn: "2026-10-18",
    checkOut: "2026-10-22",
    nights: 4,
    stayMxn: 2380 * 4,
    cleaningMxn: 380,
    token: "552901",
    createdAt: "2026-09-20T19:05:00.000Z",
    paid: true,
  }),
  booking({
    id: "bkg_demo_diego_pending_host",
    listingId: LST_CONDESA,
    status: "PENDING_HOST",
    checkIn: "2026-11-06",
    checkOut: "2026-11-09",
    nights: 3,
    stayMxn: 890 * 3,
    cleaningMxn: 120,
    token: "673440",
    createdAt: "2026-09-28T21:10:00.000Z",
    paid: true,
  }),
  booking({
    id: "bkg_demo_diego_awaiting_details",
    listingId: LST_VALLE,
    status: "AWAITING_DETAILS",
    checkIn: "2026-11-20",
    checkOut: "2026-11-23",
    nights: 3,
    stayMxn: 2100 * 3,
    cleaningMxn: 320,
    token: "781156",
    createdAt: "2026-09-29T14:40:00.000Z",
    paid: true,
  }),
  booking({
    id: "bkg_demo_diego_awaiting_pay",
    listingId: LST_VALLE,
    status: "AWAITING_PAYMENT",
    checkIn: "2026-12-10",
    checkOut: "2026-12-14",
    nights: 4,
    stayMxn: 2100 * 4,
    cleaningMxn: 320,
    token: "804229",
    createdAt: nowIso(),
    paid: false,
  }),
  booking({
    id: "bkg_demo_diego_completed",
    listingId: LST_ROMA,
    status: "COMPLETED",
    checkIn: "2026-08-12",
    checkOut: "2026-08-16",
    nights: 4,
    stayMxn: 1680 * 4,
    cleaningMxn: 280,
    token: "319088",
    createdAt: "2026-07-30T11:15:00.000Z",
    paid: true,
  }),
  booking({
    id: "bkg_demo_camila_pending",
    listingId: LST_COYO,
    status: "PENDING",
    checkIn: "2026-10-08",
    checkOut: "2026-10-12",
    nights: 4,
    stayMxn: 2380 * 4,
    cleaningMxn: 380,
    token: "226714",
    createdAt: "2026-09-29T18:22:00.000Z",
    paid: true,
    guestUserId: "",
    guestName: "Camila Reyes",
    guestEmail: "camila.reyes.demo@gmail.com",
    guestPhone: "+52 33 1550 8841",
  }),
  booking({
    id: "bkg_demo_sofia_guest_current",
    listingId: LST_PEDRO_CONDESA,
    hostId: PEDRO_ID,
    guestUserId: HOST_ID,
    guestName: "Sofía Ramírez",
    guestEmail: HOST_EMAIL,
    guestPhone: "+52 55 3901 7742",
    status: "CONFIRMED",
    checkIn: "2026-09-29",
    checkOut: "2026-10-02",
    nights: 3,
    stayMxn: 920 * 3,
    cleaningMxn: 120,
    token: "901334",
    createdAt: "2026-09-18T15:00:00.000Z",
    paid: true,
  }),
  booking({
    id: "bkg_demo_sofia_guest_upcoming",
    listingId: LST_PEDRO_COYO,
    hostId: PEDRO_ID,
    guestUserId: HOST_ID,
    guestName: "Sofía Ramírez",
    guestEmail: HOST_EMAIL,
    guestPhone: "+52 55 3901 7742",
    status: "CONFIRMED",
    checkIn: "2026-10-25",
    checkOut: "2026-10-28",
    nights: 3,
    stayMxn: 2450 * 3,
    cleaningMxn: 350,
    token: "912087",
    createdAt: "2026-09-22T11:30:00.000Z",
    paid: true,
  }),
  booking({
    id: "bkg_demo_sofia_guest_pending",
    listingId: LST_PEDRO_ROMA,
    hostId: PEDRO_ID,
    guestUserId: HOST_ID,
    guestName: "Sofía Ramírez",
    guestEmail: HOST_EMAIL,
    guestPhone: "+52 55 3901 7742",
    status: "PENDING_HOST",
    checkIn: "2026-11-14",
    checkOut: "2026-11-17",
    nights: 3,
    stayMxn: 1850 * 3,
    cleaningMxn: 250,
    token: "923611",
    createdAt: "2026-09-28T09:20:00.000Z",
    paid: true,
  }),
  booking({
    id: "bkg_demo_sofia_guest_pay",
    listingId: LST_PEDRO_ROMA,
    hostId: PEDRO_ID,
    guestUserId: HOST_ID,
    guestName: "Sofía Ramírez",
    guestEmail: HOST_EMAIL,
    guestPhone: "+52 55 3901 7742",
    status: "AWAITING_PAYMENT",
    checkIn: "2026-12-18",
    checkOut: "2026-12-21",
    nights: 3,
    stayMxn: 1850 * 3,
    cleaningMxn: 250,
    token: "934802",
    createdAt: nowIso(),
    paid: false,
  }),
  booking({
    id: "bkg_demo_sofia_guest_done",
    listingId: LST_PEDRO_ROMA,
    hostId: PEDRO_ID,
    guestUserId: HOST_ID,
    guestName: "Sofía Ramírez",
    guestEmail: HOST_EMAIL,
    guestPhone: "+52 55 3901 7742",
    status: "COMPLETED",
    checkIn: "2026-07-18",
    checkOut: "2026-07-21",
    nights: 3,
    stayMxn: 1850 * 3,
    cleaningMxn: 250,
    token: "890441",
    createdAt: "2026-07-02T16:45:00.000Z",
    paid: true,
  }),
];

function msg({
  id,
  listingId,
  sender,
  body,
  createdAt,
  hostId = HOST_ID,
  guestSessionId = DIEGO_SID,
  guestName = "Diego Morales",
  guestEmail,
}) {
  return {
    id,
    listingId,
    hostId,
    guestSessionId,
    sender,
    guestName: sender === "guest" ? guestName : "",
    guestEmail: sender === "guest" ? guestEmail ?? GUEST_EMAIL : undefined,
    body,
    createdAt,
  };
}

const messages = [
  msg({
    id: "msg_demo_roma_g1",
    listingId: LST_ROMA,
    sender: "guest",
    body: "Hola Sofía, ya reservé del 27 de septiembre al 4 de octubre. ¿Puedo llegar como a las 11? Vuelo de Guadalajara que aterriza a las 9:40.",
    createdAt: "2026-09-12T17:05:00.000Z",
  }),
  msg({
    id: "msg_demo_roma_h1",
    listingId: LST_ROMA,
    sender: "host",
    body: "¡Hola Diego! Sí, te dejo la caja de llaves desde las 11. Te mando el código el día anterior. ¿Vienes solo o con alguien?",
    createdAt: "2026-09-12T18:40:00.000Z",
  }),
  msg({
    id: "msg_demo_roma_g2",
    listingId: LST_ROMA,
    sender: "guest",
    body: "Voy solo. Ya estoy en el loft, todo impecable. Una duda: ¿el wifi del escritorio es el mismo que el de la sala? Se me corta un poco en videollamadas.",
    createdAt: "2026-09-27T19:12:00.000Z",
  }),
  msg({
    id: "msg_demo_roma_h2",
    listingId: LST_ROMA,
    sender: "host",
    body: "Es la misma red. Reinicia el módem (caja blanca detrás del sofá, 10 segundos). Si sigue inestable te paso el 5 GHz: Cabibee-Roma-5G / te lo mando por aquí.",
    createdAt: "2026-09-27T19:31:00.000Z",
  }),
  msg({
    id: "msg_demo_roma_g3",
    listingId: LST_ROMA,
    sender: "guest",
    body: "Listo, ya está estable. Gracias. Mañana trabajo desde aquí todo el día.",
    createdAt: "2026-09-28T08:14:00.000Z",
  }),
  msg({
    id: "msg_demo_coyo_g1",
    listingId: LST_COYO,
    sender: "guest",
    body: "Sofía, para la casa de Coyoacán en octubre: ¿el patio está cerrado? Voy con mi hermana y su niño de 6. También, ¿aceptas al perro chico (7 kg)?",
    createdAt: "2026-09-20T20:10:00.000Z",
  }),
  msg({
    id: "msg_demo_coyo_h1",
    listingId: LST_COYO,
    sender: "host",
    body: "El patio tiene barda de 1.80 y la puerta de servicio se traba. El perrito sí, con la condición de que no suba a sofás. Hay súper (La Comer) a 6 minutos caminando.",
    createdAt: "2026-09-20T21:02:00.000Z",
  }),
  msg({
    id: "msg_demo_coyo_g2",
    listingId: LST_COYO,
    sender: "guest",
    body: "Perfecto, entonces confirmamos. ¿Hay cuna o me conviene llevar una plegable?",
    createdAt: "2026-09-21T10:44:00.000Z",
  }),
  msg({
    id: "msg_demo_condesa_g1",
    listingId: LST_CONDESA,
    sender: "guest",
    body: "Hola, mandé solicitud para noviembre (6–9). Trabajo remoto: ¿el escritorio aguanta monitor + laptop? ¿Hay silla de verdad o es de comedor?",
    createdAt: "2026-09-28T21:18:00.000Z",
  }),
  msg({
    id: "msg_demo_condesa_h1",
    listingId: LST_CONDESA,
    sender: "host",
    body: "Hay escritorio de 120 cm y silla de oficina. El wifi mide ~180 Mbps en esa recámara. Te reviso la solicitud hoy en la noche.",
    createdAt: "2026-09-28T22:05:00.000Z",
  }),
  msg({
    id: "msg_demo_valle_g1",
    listingId: LST_VALLE,
    sender: "guest",
    body: "Para Valle en noviembre: ¿la chimenea tiene leña incluida o compro en el pueblo? Y el check-in, ¿puedo llegar después de las 9 pm?",
    createdAt: "2026-09-29T15:02:00.000Z",
  }),
  msg({
    id: "msg_demo_camila_g1",
    listingId: LST_COYO,
    sender: "guest",
    guestSessionId: "sess_demo_camila_coyo",
    guestName: "Camila Reyes",
    guestEmail: "camila.reyes.demo@gmail.com",
    body: "Hola Sofía, solicité el 8–12 de octubre para 3 adultos. ¿Hay cama extra o sofá cama en la sala? Viajamos por un congreso en CU.",
    createdAt: "2026-09-29T18:25:00.000Z",
  }),
  msg({
    id: "msg_demo_familia_g1",
    listingId: LST_VALLE,
    sender: "guest",
    guestSessionId: "sess_demo_familia_valle",
    guestName: "Familia Ortega",
    guestEmail: "ortega.viaje@outlook.com",
    body: "Buenas tardes, ¿la cabaña está libre el puente de diciembre (12–16)? Somos 2 adultos y 2 niños. ¿Hay calefacción además de la chimenea?",
    createdAt: "2026-09-30T11:40:00.000Z",
  }),
  msg({
    id: "msg_demo_sofia_pedro_condesa_g1",
    listingId: LST_PEDRO_CONDESA,
    hostId: PEDRO_ID,
    guestSessionId: SOFIA_GUEST_SID,
    guestName: "Sofía Ramírez",
    guestEmail: HOST_EMAIL,
    sender: "guest",
    body: "Hola Pedro, reservé tu habitación de Condesa del 29 al 2. Trabajo remoto: ¿puedo usar el escritorio todo el día? Llego hoy cerca de las 4.",
    createdAt: "2026-09-18T15:20:00.000Z",
  }),
  msg({
    id: "msg_demo_sofia_pedro_condesa_h1",
    listingId: LST_PEDRO_CONDESA,
    hostId: PEDRO_ID,
    guestSessionId: SOFIA_GUEST_SID,
    sender: "host",
    body: "¡Claro Sofía! El escritorio es tuyo. Te dejo café en la cocina y la clave del wifi en la mesa. Si llegas después de las 3, usa la caja de la reja: 4028.",
    createdAt: "2026-09-18T16:05:00.000Z",
  }),
  msg({
    id: "msg_demo_sofia_pedro_condesa_g2",
    listingId: LST_PEDRO_CONDESA,
    hostId: PEDRO_ID,
    guestSessionId: SOFIA_GUEST_SID,
    guestName: "Sofía Ramírez",
    guestEmail: HOST_EMAIL,
    sender: "guest",
    body: "Ya estoy instalada, todo bien. ¿Hay un súper cerca para comprar fruta? Mañana tengo junta a las 9.",
    createdAt: "2026-09-29T22:18:00.000Z",
  }),
  msg({
    id: "msg_demo_sofia_pedro_coyo_g1",
    listingId: LST_PEDRO_COYO,
    hostId: PEDRO_ID,
    guestSessionId: SOFIA_GUEST_SID,
    guestName: "Sofía Ramírez",
    guestEmail: HOST_EMAIL,
    sender: "guest",
    body: "Pedro, para la casa de Coyoacán a finales de octubre: ¿puedo llevar a mi mamá? Seríamos 2. ¿El patio se puede usar de noche?",
    createdAt: "2026-09-22T12:10:00.000Z",
  }),
  msg({
    id: "msg_demo_sofia_pedro_coyo_h1",
    listingId: LST_PEDRO_COYO,
    hostId: PEDRO_ID,
    guestSessionId: SOFIA_GUEST_SID,
    sender: "host",
    body: "Sí, dos personas está perfecto. El patio tiene luz cálida hasta las 11. Hay un limonero: córtalos si quieres. Te mando el pin una semana antes.",
    createdAt: "2026-09-22T13:40:00.000Z",
  }),
  msg({
    id: "msg_demo_sofia_pedro_roma_g1",
    listingId: LST_PEDRO_ROMA,
    hostId: PEDRO_ID,
    guestSessionId: SOFIA_GUEST_SID,
    guestName: "Sofía Ramírez",
    guestEmail: HOST_EMAIL,
    sender: "guest",
    body: "Mandé solicitud para noviembre en tu loft de Roma. ¿El edificio tiene elevador? Voy con una maleta grande.",
    createdAt: "2026-09-28T09:35:00.000Z",
  }),
];

const hostProfile = {
  userId: HOST_ID,
  bio: "Soy Sofía, arquitecta y anfitriona en Roma, Condesa y Coyoacán. Me gusta dejar el espacio como si fuera para una amiga: café bueno, toallas de verdad y recomendaciones que no salen en Google.",
  avatarUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop&q=85",
  email: HOST_EMAIL,
  phone: "+52 55 3901 7742",
  whatsapp: "525539017742",
  instagram: "sofia.en.cdmx",
  website: "https://urbnbee.net",
};

const guestProfile = {
  userId: GUEST_ID,
  bio: "Viajo por trabajo entre Guadalajara y CDMX. Busco lugares tranquilos para quedarme una semana.",
  avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop&q=85",
  email: GUEST_EMAIL,
  phone: "+52 55 1844 2201",
};

async function main() {
  console.log("[seed-demo] data dir:", dataDir);
  const passwordHash = await bcrypt.hash(PASSWORD, 11);
  const createdAt = "2026-08-01T14:00:00.000Z";

  const store = readJson("marketplace-store.json", {
    version: 1,
    users: [],
    emailToUserId: {},
    hostProfiles: {},
    listings: [],
  });
  store.users = Array.isArray(store.users) ? store.users : [];
  store.listings = Array.isArray(store.listings) ? store.listings : [];
  store.emailToUserId = store.emailToUserId && typeof store.emailToUserId === "object" ? store.emailToUserId : {};
  store.hostProfiles = store.hostProfiles && typeof store.hostProfiles === "object" ? store.hostProfiles : {};

  const hostUser = {
    id: HOST_ID,
    email: HOST_EMAIL,
    passwordHash,
    fullName: "Sofía Ramírez",
    phone: "+52 55 3901 7742",
    addressLine: "Col. Roma Norte, Cuauhtémoc, CDMX",
    role: "host",
    createdAt,
  };
  const guestUser = {
    id: GUEST_ID,
    email: GUEST_EMAIL,
    passwordHash,
    fullName: "Diego Morales",
    phone: "+52 55 1844 2201",
    addressLine: "Americana, Guadalajara, Jalisco",
    role: "guest",
    createdAt,
  };

  const replaceUser = (user) => {
    store.users = store.users.filter((u) => u.id !== user.id && u.email !== user.email);
    store.users.push(user);
    for (const [email, uid] of Object.entries(store.emailToUserId)) {
      if (uid === user.id || email === user.email) delete store.emailToUserId[email];
    }
    store.emailToUserId[user.email] = user.id;
  };
  replaceUser(hostUser);
  replaceUser(guestUser);
  store.hostProfiles[HOST_ID] = hostProfile;
  store.hostProfiles[GUEST_ID] = guestProfile;

  store.listings = store.listings.filter((l) => !String(l.id || "").startsWith("lst_demo_sofia_"));
  store.listings.push(...listings);
  writeJson("marketplace-store.json", store);

  const bookingFile = readJson("bookings.json", { version: 1, bookings: [] });
  bookingFile.version = 1;
  bookingFile.bookings = Array.isArray(bookingFile.bookings) ? bookingFile.bookings : [];
  bookingFile.bookings = bookingFile.bookings.filter((b) => !String(b.id || "").startsWith("bkg_demo_"));
  bookingFile.bookings.push(...bookings);
  writeJson("bookings.json", bookingFile);

  const inbox = readJson("host-inbox-messages.json", { version: 1, messages: [] });
  inbox.version = 1;
  inbox.messages = Array.isArray(inbox.messages) ? inbox.messages : [];
  inbox.messages = inbox.messages.filter((m) => !String(m.id || "").startsWith("msg_demo_"));
  inbox.messages.push(...messages);
  writeJson("host-inbox-messages.json", inbox);

  const entitlements = readJson("host-entitlements.json", { version: 1, entitlements: [] });
  entitlements.version = 1;
  entitlements.entitlements = Array.isArray(entitlements.entitlements) ? entitlements.entitlements : [];
  entitlements.entitlements = entitlements.entitlements.filter((e) => e.hostId !== HOST_ID);
  entitlements.entitlements.push(
    {
      hostId: HOST_ID,
      sku: "cabibee_booking_engine",
      status: "active",
      source: "cabibee_direct",
      currentPeriodEnd: "2027-03-01T00:00:00.000Z",
      updatedAt: nowIso(),
    },
    {
      hostId: HOST_ID,
      sku: "cabibee_host_verification",
      status: "active",
      source: "cabibee_direct",
      currentPeriodEnd: "2027-03-01T00:00:00.000Z",
      updatedAt: nowIso(),
    }
  );
  writeJson("host-entitlements.json", entitlements);

  const verif = readJson("guest-verification.json", { version: 1, verifications: [] });
  verif.version = 1;
  verif.verifications = Array.isArray(verif.verifications) ? verif.verifications : [];
  const upsertV = (rec) => {
    verif.verifications = verif.verifications.filter((v) => v.userId !== rec.userId);
    verif.verifications.push(rec);
  };
  upsertV({
    userId: HOST_ID,
    subscriptionStatus: "active",
    currentPeriodEnd: "2027-03-01T00:00:00.000Z",
    kycStatus: "verified",
    hostVerifiedAt: "2026-08-02T12:00:00.000Z",
    hostVerificationSource: "admin",
    hostSubscriptionStatus: "active",
    hostCurrentPeriodEnd: "2027-03-01T00:00:00.000Z",
    bookingPassesRemaining: 4,
    updatedAt: nowIso(),
  });
  upsertV({
    userId: GUEST_ID,
    subscriptionStatus: "active",
    currentPeriodEnd: "2027-03-01T00:00:00.000Z",
    kycStatus: "verified",
    bookingPassesRemaining: 3,
    updatedAt: nowIso(),
  });
  writeJson("guest-verification.json", verif);

  console.log("");
  console.log("Cuenta demo (anfitriona + huésped). Entra en /login o /cuenta/entrar");
  console.log(`  ${HOST_EMAIL}   ${PASSWORD}`);
  console.log("  App: modo anfitrión en /host · modo huésped en / (Explorar, Viajes, Mensajes)");
  console.log(`  ${listings.filter((l) => l.published).length} anuncios publicados + 1 borrador`);
  console.log(`  ${bookings.length} reservas  ·  ${messages.length} mensajes`);
}

main().catch((e) => {
  console.error("[seed-demo] falló:", e);
  process.exit(1);
});
