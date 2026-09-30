#!/usr/bin/env node
/**
 * Anfitriones y anuncios de muestra (con reseñas y estancias pasadas) para que el catálogo se vea vivo.
 *   Todas las cuentas: <nombre>@urbnbee.test / Demo2026!
 *
 * Idempotente: sólo agrega lo que falta (por id); nunca pisa lo que un anfitrión ya editó.
 * Se ejecuta en cada arranque (scripts/start.mjs).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import bcrypt from "bcryptjs";

const cwd = process.cwd();
const rawDir = process.env.URBNBEE_DATA_DIR?.trim();
const dataDir = rawDir ? (isAbsolute(rawDir) ? rawDir : resolve(cwd, rawDir)) : join(cwd, "data");
mkdirSync(dataDir, { recursive: true });

const PASSWORD = "Demo2026!";
const SOFIA_ID = "usr_demo_sofia_host";
const SOFIA_SID = `gu_${SOFIA_ID}`;
const CREATED = "2026-03-01T15:00:00.000Z";

const P = (id) => `https://images.unsplash.com/photo-${id}?w=1200&q=85`;
const A = (id) => `https://images.unsplash.com/photo-${id}?w=400&h=400&fit=crop&q=85`;

/* ─────────────── Anfitriones ─────────────── */

const HOSTS = [
  {
    id: "usr_seed_pedro_dev",
    name: "Pedro Álvarez",
    legal: "Pedro Álvarez Cervantes",
    email: "pedro@urbnbee.test",
    phone: "+52 55 4410 2290",
    address: "Col. Roma Sur, Cuauhtémoc, CDMX",
    avatar: A("1507003211169-0a1dd7228f2d"),
    bio: "Diseñador industrial y chilango de toda la vida. Rento tres espacios en Roma, Condesa y Coyoacán; me encanta recomendar fondas y cantinas que no salen en las guías.",
    languages: ["Español", "Inglés"],
    interests: ["Café de especialidad", "Diseño", "Ciclismo urbano"],
    bookable: true,
    verified: true,
  },
  {
    id: "usr_show_lucia",
    name: "Lucía Herrera",
    legal: "Lucía Herrera Pech",
    email: "lucia@urbnbee.test",
    phone: "+52 984 118 3321",
    address: "Aldea Zamá, Tulum, Quintana Roo",
    avatar: A("1494790108377-be9c29b29330"),
    bio: "Nací en Mérida y vivo en Tulum desde hace diez años. Instructora de buceo en cenotes: si quieres, te armo la ruta.",
    languages: ["Español", "Inglés", "Maya básico"],
    interests: ["Buceo", "Cocina yucateca", "Yoga"],
    bookable: true,
    verified: true,
  },
  {
    id: "usr_show_andres",
    name: "Andrés Castillo",
    legal: "Andrés Castillo Meléndez",
    email: "andres@urbnbee.test",
    phone: "+52 646 201 7784",
    address: "Valle de Guadalupe, Ensenada, B.C.",
    avatar: A("1506794778202-cad84cf45f1d"),
    bio: "Enólogo. Mi familia cultiva uva en el Valle desde 1994. Te recibo con una copa de nuestro tinto y un mapa de las mejores catas.",
    languages: ["Español", "Inglés"],
    interests: ["Vino", "Surf", "Parrilla"],
    bookable: true,
    verified: true,
  },
  {
    id: "usr_show_mariana",
    name: "Mariana Ochoa",
    legal: "Mariana Ochoa Villaseñor",
    email: "mariana@urbnbee.test",
    phone: "+52 415 152 9043",
    address: "Centro, San Miguel de Allende, Gto.",
    avatar: A("1438761681033-6461ffad8d80"),
    bio: "Restauradora de casas antiguas en el Bajío. Cada espacio conserva sus muros de cantera y sus vigas originales.",
    languages: ["Español", "Inglés", "Francés"],
    interests: ["Arquitectura", "Arte", "Mercados"],
    bookable: true,
    verified: true,
  },
  {
    id: "usr_show_javier",
    name: "Javier Ruiz",
    legal: "Javier Ruiz Gallardo",
    email: "javier@urbnbee.test",
    phone: "+52 382 104 6612",
    address: "Mazamitla, Jalisco",
    avatar: A("1500648767791-00dcc994a43e"),
    bio: "Carpintero. Construí mis cabañas con madera de la sierra. Escríbeme por el chat y acordamos fechas.",
    languages: ["Español"],
    interests: ["Senderismo", "Carpintería", "Fogatas"],
    bookable: false,
    verified: false,
  },
  {
    id: "usr_show_valeria",
    name: "Valeria Montes",
    legal: "Valeria Montes Arriaga",
    email: "valeria@urbnbee.test",
    phone: "+52 322 190 5518",
    address: "Zona Romántica, Puerto Vallarta, Jal.",
    avatar: A("1534528741775-53994a69daeb"),
    bio: "Arquitecta de interiores. Diseño casas para ver el atardecer desde la alberca. Me gusta que mis huéspedes se sientan de vacaciones desde que abren la puerta.",
    languages: ["Español", "Inglés", "Italiano"],
    interests: ["Atardeceres", "Diseño de interiores", "Paddle board"],
    bookable: true,
    verified: true,
  },
  {
    id: "usr_show_rodrigo",
    name: "Rodrigo Pineda",
    legal: "Rodrigo Pineda Salas",
    email: "rodrigo@urbnbee.test",
    phone: "+52 33 3615 8870",
    address: "Providencia, Guadalajara, Jal.",
    avatar: A("1472099645785-5658abf4ff4e"),
    bio: "Ingeniero de software, viajo mucho por trabajo y sé lo que se agradece: buen wifi, escritorio y cama firme.",
    languages: ["Español", "Inglés"],
    interests: ["Tecnología", "Fútbol", "Tacos de madrugada"],
    bookable: false,
    verified: false,
  },
];

const HOST_WORK = {
  usr_seed_pedro_dev: "Diseñador industrial",
  usr_show_lucia: "Instructora de buceo",
  usr_show_andres: "Enólogo",
  usr_show_mariana: "Restauradora de casas antiguas",
  usr_show_javier: "Carpintero",
  usr_show_valeria: "Arquitecta de interiores",
  usr_show_rodrigo: "Ingeniero de software",
};

/* Huéspedes de muestra que dejan reseñas. */
const GUESTS = [
  ["usr_show_g_ana", "Ana Lucía Torres", A("1544005313-94ddf0286df2")],
  ["usr_show_g_carlos", "Carlos Méndez", A("1519085360753-af0119f7cbe7")],
  ["usr_show_g_fernanda", "Fernanda Ríos", A("1517841905240-472988babdf9")],
  ["usr_show_g_miguel", "Miguel Ángel Soto", A("1539571696357-5a69c17a67c6")],
  ["usr_show_g_paula", "Paula Garza", A("1524504388940-b1c1722653e1")],
  ["usr_show_g_emilio", "Emilio Navarro", A("1552058544-f2b08422138a")],
  ["usr_show_g_renata", "Renata Villalobos", A("1531123897727-8f129e1688ce")],
  ["usr_show_g_tomas", "Tomás Ibarra", A("1535713875002-d1d0cf377fde")],
  ["usr_show_g_daniela", "Daniela Cruz", A("1580489944761-15a19d654956")],
  ["usr_show_g_luis", "Luis Fernando Mora", A("1508214751196-bcfd4ca60f91")],
  ["usr_show_g_sara", "Sara Kim", A("1487412720507-e7ab37603c6f")],
  ["usr_show_g_jorge", "Jorge Estrada", A("1546961329-78bef0414d7c")],
].map(([id, name, avatar]) => ({ id, name, avatar, email: `${id.replace("usr_show_g_", "")}.huesped@urbnbee.test` }));

/* ─────────────── Anuncios ─────────────── */

const WIFI = "Internet Inalámbrico";
const L = [
  // Pedro (CDMX): los anuncios a los que Sofía ya les escribió y reservó como huésped.
  {
    id: "lst_pedro_departamento_roma", host: "usr_seed_pedro_dev", cat: "departamentos", space: "Espacio completo",
    title: "Departamento con balcón y elevador — Roma Norte", city: "Ciudad de México", zone: "Roma Norte", county: "Cuauhtémoc",
    lat: 19.4172, lng: -99.1596, guests: 3, bedrooms: 1, bathrooms: 1, size: "68 m²", price: 1850, cleaning: 250,
    photos: ["1493809842364-78817add7ffb", "1600607687939-ce8a6c25118c", "1484154218962-a197022b5858", "1505693416388-ac5ce068fe85"],
    amenities: [WIFI, "Cocina", "Lavadora", "Terraza o balcón", "Televisión", "Cafetera", "Elementos básicos"],
    rules: { smoking: false, pets: false, parties: false, children: true },
    desc: "Departamento en tercer piso con elevador, en una calle arbolada a dos cuadras de la Plaza Río de Janeiro. Sala con balcón, cocina equipada y recámara con cama queen.\n\nIdeal para una pareja o para trabajar remoto: escritorio, internet de 200 Mbps y cafetería abajo.",
    details: ["el balcón para desayunar", "lo silencioso de la recámara", "la ubicación para caminar a todo"],
    pricing: { weekendPrice: 2050, weeklyDiscountPct: 10 },
  },
  {
    id: "lst_pedro_habitacion_condesa", host: "usr_seed_pedro_dev", cat: "habitaciones", space: "Habitación privada",
    title: "Habitación con escritorio y baño propio — Condesa", city: "Ciudad de México", zone: "Condesa", county: "Cuauhtémoc",
    lat: 19.4128, lng: -99.1735, guests: 2, bedrooms: 1, bathrooms: 1, size: "18 m²", price: 920, cleaning: 120,
    photos: ["1578683010236-d716f9a3f461", "1524758631624-e2822e304c36", "1584622650111-993a426fbf0a"],
    amenities: [WIFI, "Agua caliente", "Cocina", "Ropa de cama", "Cafetera", "Shampoo"],
    rules: { smoking: false, pets: false, parties: false, children: false },
    desc: "Recámara privada con baño propio en mi departamento, frente al Parque España. Escritorio grande y silla de oficina; comparto cocina y sala.\n\nLlegada flexible con caja de llaves.",
    details: ["el escritorio para trabajar", "el parque enfrente", "lo atento que es Pedro"],
  },
  {
    id: "lst_pedro_casa_coyoacan", host: "usr_seed_pedro_dev", cat: "casas", space: "Espacio completo",
    title: "Casa con patio y limonero — Barrio de Santa Catarina, Coyoacán", city: "Ciudad de México", zone: "Coyoacán", county: "Coyoacán",
    lat: 19.3467, lng: -99.1695, guests: 4, bedrooms: 2, bathrooms: 2, size: "110 m²", price: 2450, cleaning: 350,
    photos: ["1600047509807-ba8f99d2cdde", "1583847268964-b28dc8f51f92", "1556912172-45b7abe8b7e1", "1595526114035-0d45ed16cfbf"],
    amenities: [WIFI, "Cocina", "Jardín / Patio", "Lavadora", "Amigable Familias/Niños", "Estacionamiento Gratuito"],
    rules: { smoking: false, pets: true, parties: false, children: true },
    desc: "Casa de dos pisos con patio y limonero a seis cuadras de la Plaza de Coyoacán. Dos recámaras, dos baños y cocina completa.\n\nEl patio tiene luz cálida para cenar afuera.",
    details: ["el patio con el limonero", "la cocina completa", "lo cerca que queda la plaza"],
  },

  // Lucía (Riviera Maya)
  {
    id: "lst_show_lucia_tulum_playa", host: "usr_show_lucia", cat: "casas", space: "Espacio completo",
    title: "Casa de playa con palapa — Tulum", city: "Tulum", zone: "Zona hotelera", county: "Tulum", state: "Quintana Roo",
    lat: 20.1782, lng: -87.4546, guests: 4, bedrooms: 2, bathrooms: 2, size: "95 m²", price: 3900, cleaning: 450,
    photos: ["1499793983690-e29da59ef1c2", "1507525428034-b723cf961d3e", "1506953823976-52e1fdc0149a", "1540518614846-7eded433c457"],
    amenities: [WIFI, "Aire Acondicionado", "Cocina", "Terraza o balcón", "Ropa de cama", "Detector de humo"],
    rules: { smoking: false, pets: false, parties: false, children: true },
    desc: "Casa con palapa a 30 pasos del mar, en la parte tranquila de la zona hotelera. Dos recámaras con aire acondicionado y terraza con hamacas frente a la playa.\n\nTe presto snorkel y bicis para ir a las ruinas.",
    details: ["despertar con el mar enfrente", "las hamacas de la terraza", "las bicis para ir a las ruinas"],
    pricing: { weekendPrice: 4400, weeklyDiscountPct: 12, minNights: 2 },
    guide: { checkInTime: "15:00", checkOutTime: "11:00", wifiName: "Palapa-Lucia", wifiPassword: "marazul2026", checkInMethod: "Caja de llaves junto a la reja; te mando el código el día anterior." },
  },
  {
    id: "lst_show_lucia_pdc_rooftop", host: "usr_show_lucia", cat: "departamentos", space: "Espacio completo",
    title: "Departamento con alberca en la azotea — Playa del Carmen", city: "Playa del Carmen", zone: "Centro", county: "Solidaridad", state: "Quintana Roo",
    lat: 20.6296, lng: -87.0739, guests: 2, bedrooms: 1, bathrooms: 1, size: "58 m²", price: 1750, cleaning: 250,
    photos: ["1576013551627-0cc20b96c2a7", "1575429198097-0414ec08e8cd", "1560448204-e02f11c3d0e2", "1522771739844-6a9f6d5f14af"],
    amenities: [WIFI, "Aire Acondicionado", "Piscina", "Cocina", "Lavadora", "Televisión"],
    rules: { smoking: false, pets: false, parties: false, children: true },
    desc: "Departamento nuevo a tres cuadras de la Quinta Avenida, con alberca y camastros en la azotea. Recámara con cama king y sofá cama en la sala.",
    details: ["la alberca de la azotea al atardecer", "lo cerca de la Quinta", "la cama king"],
    pricing: { weeklyDiscountPct: 10, monthlyDiscountPct: 25 },
  },
  {
    id: "lst_show_lucia_tulum_selva", host: "usr_show_lucia", cat: "casas", space: "Espacio completo",
    title: "Villa en la selva cerca de cenotes — Tulum", city: "Tulum", zone: "Aldea Zamá", county: "Tulum", state: "Quintana Roo",
    lat: 20.2003, lng: -87.4697, guests: 6, bedrooms: 3, bathrooms: 3, size: "180 m²", price: 5200, cleaning: 600,
    photos: ["1520250497591-112f2f40a3f4", "1596178065887-1198b6148b2b", "1611892440504-42a792e24d32", "1600566752355-35792bedcfea"],
    amenities: [WIFI, "Aire Acondicionado", "Piscina", "Cocina", "Jardín / Patio", "Estacionamiento Gratuito", "Amigable Familias/Niños"],
    rules: { smoking: false, pets: false, parties: false, children: true },
    desc: "Villa rodeada de selva con alberca privada, a 10 minutos en bici del pueblo y a 15 de tres cenotes. Tres recámaras con baño propio.\n\nIdeal para familias o grupos de amigos.",
    details: ["la alberca rodeada de selva", "los cenotes cercanos", "lo amplias que son las recámaras"],
    pricing: { weekendPrice: 5900, minNights: 3 },
  },

  // Andrés (Baja California)
  {
    id: "lst_show_andres_vinedo_casa", host: "usr_show_andres", cat: "vinos", space: "Espacio completo",
    title: "Casa entre viñedos con cata incluida — Valle de Guadalupe", city: "Ensenada", zone: "Valle de Guadalupe", county: "Ensenada", state: "Baja California",
    lat: 32.0934, lng: -116.5717, guests: 4, bedrooms: 2, bathrooms: 2, size: "120 m²", price: 4200, cleaning: 450,
    photos: ["1504279577054-acfeccf8fc52", "1560493676-04071c5f467b", "1510812431401-41d2bd2722f3", "1595526114035-0d45ed16cfbf"],
    amenities: [WIFI, "Aire Acondicionado", "Cocina", "Terraza o balcón", "Estacionamiento Gratuito", "Chimenea Interior"],
    rules: { smoking: false, pets: false, parties: false, children: true },
    desc: "Casa de piedra en medio de nuestro viñedo familiar. Terraza con vista a las parras, chimenea para las noches frías y cata de tres vinos incluida por estancia.",
    details: ["la cata con Andrés", "la terraza viendo las parras", "la chimenea en la noche"],
    pricing: { weekendPrice: 4900, minNights: 2 },
    guide: { checkInTime: "16:00", checkOutTime: "12:00", directions: "Km 83 de la carretera Tecate–Ensenada; entrada por el arco de madera con el letrero Castillo." },
  },
  {
    id: "lst_show_andres_vinedo_cabana", host: "usr_show_andres", cat: "vinos", space: "Espacio completo",
    title: "Cabaña para dos con vista al viñedo — Valle de Guadalupe", city: "Ensenada", zone: "San Antonio de las Minas", county: "Ensenada", state: "Baja California",
    lat: 32.0525, lng: -116.6242, guests: 2, bedrooms: 1, bathrooms: 1, size: "40 m²", price: 2600, cleaning: 300,
    photos: ["1506377247377-2a5b3b417ebb", "1558001373-7b93ee48ffa0", "1540518614846-7eded433c457", "1560185007-cde436f6a4d0"],
    amenities: [WIFI, "Aire Acondicionado", "Cafetera", "Terraza o balcón", "Ropa de cama"],
    rules: { smoking: false, pets: false, parties: false, children: false },
    desc: "Cabaña de madera para parejas con terraza privada frente a las parras. A cinco minutos de restaurantes de campo y vinícolas.",
    details: ["el atardecer desde la terraza", "la tranquilidad", "las recomendaciones de vinícolas"],
  },
  {
    id: "lst_show_andres_ensenada_loft", host: "usr_show_andres", cat: "departamentos", space: "Espacio completo",
    title: "Loft con vista al mar — Ensenada", city: "Ensenada", zone: "Playa Hermosa", county: "Ensenada", state: "Baja California",
    lat: 31.8375, lng: -116.6156, guests: 2, bedrooms: 1, bathrooms: 1, size: "55 m²", price: 1600, cleaning: 220,
    photos: ["1510414842594-a61c69b5ae57", "1473116763249-2faaef81ccda", "1615874959474-d609969a20ed", "1584622650111-993a426fbf0a"],
    amenities: [WIFI, "Cocina", "Terraza o balcón", "Televisión", "Estacionamiento Gratuito"],
    rules: { smoking: false, pets: true, parties: false, children: true },
    desc: "Loft en el cuarto piso con ventanal al Pacífico. A pie del malecón y de los mejores tacos de pescado de la ciudad.",
    details: ["la vista al Pacífico", "los tacos de pescado que nos recomendó", "lo limpio del loft"],
  },
  {
    id: "lst_show_andres_tequis_alberca", host: "usr_show_andres", cat: "casas", space: "Espacio completo",
    title: "Casa con alberca y jardín — Tequisquiapan", city: "Tequisquiapan", zone: "Centro", county: "Tequisquiapan", state: "Querétaro",
    lat: 20.5213, lng: -99.8914, guests: 8, bedrooms: 4, bathrooms: 3, size: "240 m²", price: 4800, cleaning: 600,
    photos: ["1564501049412-61c2a3083791", "1582268611958-ebfd161ef9cf", "1616486338812-3dadae4b4ace", "1617806118233-18e1de247200"],
    amenities: [WIFI, "Piscina", "Jardín / Patio", "Cocina", "Estacionamiento Gratuito", "Amigable Familias/Niños", "Mesa de comedor"],
    rules: { smoking: false, pets: true, parties: false, children: true },
    desc: "Casa familiar con alberca templada y jardín grande, a cinco minutos del centro de Tequis. Asador y comedor para ocho.",
    details: ["la alberca templada", "el asador del jardín", "el espacio para toda la familia"],
    pricing: { weekendPrice: 5600, weeklyDiscountPct: 15 },
  },

  // Mariana (Bajío)
  {
    id: "lst_show_mariana_sma_casa", host: "usr_show_mariana", cat: "casas", space: "Espacio completo",
    title: "Casa colonial con terraza a la Parroquia — San Miguel de Allende", city: "San Miguel de Allende", zone: "Centro", county: "San Miguel de Allende", state: "Guanajuato",
    lat: 20.9144, lng: -100.7452, guests: 4, bedrooms: 2, bathrooms: 2, size: "140 m²", price: 3600, cleaning: 400,
    photos: ["1585464231875-d9ef1f5ad396", "1617806118233-18e1de247200", "1631049307264-da0ec9d70304", "1554995207-c18c203602cb"],
    amenities: [WIFI, "Cocina", "Terraza o balcón", "Chimenea Interior", "Agua caliente", "Mesa de comedor"],
    rules: { smoking: false, pets: false, parties: false, children: true },
    desc: "Casona del siglo XVIII restaurada, a cuatro cuadras del Jardín Principal. La terraza tiene vista directa a la Parroquia; perfecta para el atardecer.",
    details: ["la vista a la Parroquia desde la terraza", "los muros de cantera", "lo céntrico"],
    pricing: { weekendPrice: 4200, minNights: 2 },
    guide: { checkInTime: "15:00", checkOutTime: "11:00", checkInMethod: "Te recibe Doña Carmen, nuestra encargada, en la puerta de madera verde." },
  },
  {
    id: "lst_show_mariana_gto_depa", host: "usr_show_mariana", cat: "departamentos", space: "Espacio completo",
    title: "Departamento en callejón con balcón — Guanajuato", city: "Guanajuato", zone: "Centro", county: "Guanajuato", state: "Guanajuato",
    lat: 21.0178, lng: -101.2566, guests: 3, bedrooms: 1, bathrooms: 1, size: "60 m²", price: 1450, cleaning: 200,
    photos: ["1518105779142-d975f22f1b0a", "1598928506311-c55ded91a20c", "1590490360182-c33d57733427", "1556020685-ae41abfc9365"],
    amenities: [WIFI, "Cocina", "Terraza o balcón", "Agua caliente", "Cafetera"],
    rules: { smoking: false, pets: false, parties: false, children: true },
    desc: "Departamento en un callejón colorido junto al Teatro Juárez. Balcón con vista a las casas de colores y a la Bufa.",
    details: ["el balcón a las casas de colores", "lo caminable", "las callejoneadas cerca"],
  },
  {
    id: "lst_show_mariana_qro_hab", host: "usr_show_mariana", cat: "habitaciones", space: "Habitación privada",
    title: "Habitación en casona con patio — Centro de Querétaro", city: "Querétaro", zone: "Centro Histórico", county: "Querétaro", state: "Querétaro",
    lat: 20.5931, lng: -100.3921, guests: 2, bedrooms: 1, bathrooms: 1, size: "22 m²", price: 850, cleaning: 100,
    photos: ["1547995886-6dc09384c6e6", "1582719478250-c89cae4dc85b", "1565183997392-2f6f122e5912"],
    amenities: [WIFI, "Agua caliente", "Ropa de cama", "Jardín / Patio", "Desayuno incluido"],
    rules: { smoking: false, pets: false, parties: false, children: false },
    desc: "Recámara con baño privado en una casona con patio central, a una cuadra del Templo de San Francisco. Desayuno casero incluido.",
    details: ["el desayuno casero", "el patio central", "la ubicación en el centro"],
  },

  // Javier (sierra de Jalisco) — sólo chat, sin reservas en línea
  {
    id: "lst_show_javier_mazamitla", host: "usr_show_javier", cat: "cabanas", space: "Espacio completo",
    title: "Cabaña de madera en el bosque — Mazamitla", city: "Mazamitla", zone: "Fraccionamiento Monteverde", county: "Mazamitla", state: "Jalisco",
    lat: 19.9099, lng: -103.0198, guests: 6, bedrooms: 3, bathrooms: 2, size: "130 m²", price: 2300, cleaning: 300,
    photos: ["1587061949409-02df41d5e562", "1542718610-a1d656d1884c", "1586023492125-27b2c045efd7", "1540518614846-7eded433c457"],
    amenities: [WIFI, "Chimenea Interior", "Cocina", "Estacionamiento Gratuito", "Jardín / Patio", "Permiten Mascotas"],
    rules: { smoking: false, pets: true, parties: false, children: true },
    desc: "Cabaña de dos pisos entre pinos, con chimenea, asador y fogatero. A cinco minutos del pueblo y de la cascada El Salto.",
    details: ["la chimenea", "el fogatero en la noche", "el olor a pino"],
  },
  {
    id: "lst_show_javier_tapalpa_aframe", host: "usr_show_javier", cat: "cabanas", space: "Espacio completo",
    title: "Cabaña A con ventanal a la sierra — Tapalpa", city: "Tapalpa", zone: "Las Piedrotas", county: "Tapalpa", state: "Jalisco",
    lat: 19.9469, lng: -103.7588, guests: 2, bedrooms: 1, bathrooms: 1, size: "45 m²", price: 1900, cleaning: 250,
    photos: ["1758983065583-9cea714214f9", "1475087542963-13ab5e611954", "1595526114035-0d45ed16cfbf"],
    amenities: [WIFI, "Chimenea Interior", "Cafetera", "Terraza o balcón", "Ropa de cama"],
    rules: { smoking: false, pets: false, parties: false, children: false },
    desc: "Cabaña tipo A para dos, con un ventanal de piso a techo hacia el valle. Caminando a Las Piedrotas.",
    details: ["el ventanal a la sierra", "lo acogedor", "las caminatas a Las Piedrotas"],
  },
  {
    id: "lst_show_javier_lago", host: "usr_show_javier", cat: "cabanas", space: "Espacio completo",
    title: "Cabaña con muelle junto al lago — Chapala", city: "Chapala", zone: "San Juan Cosalá", county: "Jocotepec", state: "Jalisco",
    lat: 20.2869, lng: -103.3389, guests: 4, bedrooms: 2, bathrooms: 1, size: "80 m²", price: 2100, cleaning: 280,
    photos: ["1439066615861-d1af74d74000", "1470770841072-f978cf4d019e", "1560185893-a55cbc8c57e8"],
    amenities: [WIFI, "Cocina", "Jardín / Patio", "Estacionamiento Gratuito", "Terraza o balcón"],
    rules: { smoking: false, pets: true, parties: false, children: true },
    desc: "Cabaña con muelle propio sobre el lago y kayaks para salir al amanecer. A diez minutos de las aguas termales de Cosalá.",
    details: ["el muelle al amanecer", "los kayaks", "las aguas termales cerca"],
  },

  // Valeria (Pacífico)
  {
    id: "lst_show_valeria_pv_villa", host: "usr_show_valeria", cat: "casas", space: "Espacio completo",
    title: "Villa con alberca infinita frente a la bahía — Puerto Vallarta", city: "Puerto Vallarta", zone: "Conchas Chinas", county: "Puerto Vallarta", state: "Jalisco",
    lat: 20.5872, lng: -105.2442, guests: 6, bedrooms: 3, bathrooms: 3, size: "210 m²", price: 6800, cleaning: 700,
    photos: ["1571003123894-1f0594d2b5d9", "1613490493576-7fde63acd811", "1602002418082-a4443e081dd1", "1631049307264-da0ec9d70304"],
    amenities: [WIFI, "Aire Acondicionado", "Piscina", "Cocina", "Terraza o balcón", "Estacionamiento Gratuito", "Secadora de pelo"],
    rules: { smoking: false, pets: false, parties: false, children: true },
    desc: "Villa en la ladera de Conchas Chinas con alberca infinita hacia la Bahía de Banderas. Tres recámaras con vista al mar y cocina abierta.",
    details: ["la alberca infinita", "el atardecer sobre la bahía", "el diseño de la casa"],
    pricing: { weekendPrice: 7800, weeklyDiscountPct: 10, minNights: 3 },
  },
  {
    id: "lst_show_valeria_cabo_casa", host: "usr_show_valeria", cat: "casas", space: "Espacio completo",
    title: "Casa moderna con vista al Arco — Cabo San Lucas", city: "Los Cabos", zone: "Pedregal", county: "Los Cabos", state: "Baja California Sur",
    lat: 22.8766, lng: -109.9202, guests: 6, bedrooms: 3, bathrooms: 3, size: "230 m²", price: 7400, cleaning: 800,
    photos: ["1580587771525-78b9dba3b914", "1613977257363-707ba9348227", "1600210492486-724fe5c67fb0", "1600121848594-d8644e57abab"],
    amenities: [WIFI, "Aire Acondicionado", "Piscina", "Cocina", "Terraza o balcón", "Lavadora", "Secadora"],
    rules: { smoking: false, pets: false, parties: false, children: true },
    desc: "Casa contemporánea en El Pedregal con alberca y terraza con vista al Arco. A cinco minutos de la marina.",
    details: ["la vista al Arco", "la alberca", "lo moderna y cómoda"],
  },
  {
    id: "lst_show_valeria_mzt_playa", host: "usr_show_valeria", cat: "departamentos", space: "Espacio completo",
    title: "Departamento a pie de playa — Mazatlán", city: "Mazatlán", zone: "Zona Dorada", county: "Mazatlán", state: "Sinaloa",
    lat: 23.2494, lng: -106.4511, guests: 4, bedrooms: 2, bathrooms: 2, size: "90 m²", price: 2200, cleaning: 300,
    photos: ["1519046904884-53103b34b206", "1570737543098-0983d88f796d", "1600607687644-c7171b42498f", "1560185893-a55cbc8c57e8"],
    amenities: [WIFI, "Aire Acondicionado", "Piscina", "Cocina", "Terraza o balcón", "Amigable Familias/Niños"],
    rules: { smoking: false, pets: false, parties: false, children: true },
    desc: "Departamento en primera fila de playa en la Zona Dorada. Balcón al mar, alberca del edificio y bajas directo a la arena.",
    details: ["bajar directo a la playa", "el balcón al mar", "la alberca del edificio"],
    pricing: { monthlyDiscountPct: 30, weeklyDiscountPct: 10 },
  },

  // Rodrigo (ciudades) — sólo chat, sin reservas en línea
  {
    id: "lst_show_rodrigo_gdl_depa", host: "usr_show_rodrigo", cat: "departamentos", space: "Espacio completo",
    title: "Departamento moderno para trabajo remoto — Providencia, Guadalajara", city: "Guadalajara", zone: "Providencia", county: "Guadalajara", state: "Jalisco",
    lat: 20.6933, lng: -103.3897, guests: 2, bedrooms: 1, bathrooms: 1, size: "62 m²", price: 1350, cleaning: 180,
    photos: ["1600210492486-724fe5c67fb0", "1484154218962-a197022b5858", "1505693416388-ac5ce068fe85", "1600566752355-35792bedcfea"],
    amenities: [WIFI, "Aire Acondicionado", "Cocina", "Lavadora", "Televisión", "Estacionamiento Gratuito"],
    rules: { smoking: false, pets: false, parties: false, children: true },
    desc: "Departamento en torre con gimnasio, a tres cuadras de Av. Providencia. Escritorio con monitor de 27\" y fibra óptica de 500 Mbps.",
    details: ["el internet rapidísimo", "el escritorio con monitor", "la zona de restaurantes"],
    pricing: { weeklyDiscountPct: 12, monthlyDiscountPct: 30 },
  },
  {
    id: "lst_show_rodrigo_mty_hab", host: "usr_show_rodrigo", cat: "habitaciones", space: "Habitación privada",
    title: "Habitación privada con baño — San Pedro Garza García", city: "Monterrey", zone: "San Pedro", county: "San Pedro Garza García", state: "Nuevo León",
    lat: 25.6573, lng: -100.4021, guests: 1, bedrooms: 1, bathrooms: 1, size: "20 m²", price: 980, cleaning: 120,
    photos: ["1586023492125-27b2c045efd7", "1524758631624-e2822e304c36", "1584622650111-993a426fbf0a"],
    amenities: [WIFI, "Aire Acondicionado", "Agua caliente", "Ropa de cama", "Estacionamiento Gratuito"],
    rules: { smoking: false, pets: false, parties: false, children: false },
    desc: "Recámara con baño privado en casa tranquila, a 10 minutos de Valle Oriente. Ideal para viajes de trabajo.",
    details: ["lo tranquilo de la casa", "el baño privado", "la cercanía a las oficinas"],
  },
  {
    id: "lst_show_rodrigo_oaxaca_casa", host: "usr_show_rodrigo", cat: "casas", space: "Espacio completo",
    title: "Casa con jardín de cactáceas — Jalatlaco, Oaxaca", city: "Oaxaca", zone: "Jalatlaco", county: "Oaxaca de Juárez", state: "Oaxaca",
    lat: 17.0661, lng: -96.7174, guests: 4, bedrooms: 2, bathrooms: 2, size: "115 m²", price: 2100, cleaning: 280,
    photos: ["1564013799919-ab600027ffc6", "1618220179428-22790b461013", "1560185007-cde436f6a4d0", "1598928506311-c55ded91a20c"],
    amenities: [WIFI, "Cocina", "Jardín / Patio", "Agua caliente", "Mesa de comedor", "Cafetera"],
    rules: { smoking: false, pets: true, parties: false, children: true },
    desc: "Casa en el barrio de Jalatlaco, con jardín de cactáceas y murales en las calles. A diez minutos caminando de Santo Domingo.",
    details: ["el jardín", "el barrio de Jalatlaco", "lo cerca de Santo Domingo"],
  },
  {
    id: "lst_show_rodrigo_huatulco", host: "usr_show_rodrigo", cat: "casas", space: "Espacio completo",
    title: "Casa sobre el acantilado con vista a la bahía — Huatulco", city: "Huatulco", zone: "Bahía de Tangolunda", county: "Santa María Huatulco", state: "Oaxaca",
    lat: 15.7718, lng: -96.0927, guests: 6, bedrooms: 3, bathrooms: 2, size: "170 m²", price: 3900, cleaning: 450,
    photos: ["1519451241324-20b4ea2c4220", "1566073771259-6a8506099945", "1611892440504-42a792e24d32"],
    amenities: [WIFI, "Aire Acondicionado", "Piscina", "Cocina", "Terraza o balcón", "Estacionamiento Gratuito"],
    rules: { smoking: false, pets: false, parties: false, children: true },
    desc: "Casa sobre el acantilado con alberca y escalera privada a una caleta. Nueve bahías para recorrer en lancha.",
    details: ["la escalera a la caleta", "la vista a la bahía", "la alberca"],
  },
];

/* ─────────────── Reseñas ─────────────── */

const REVIEW_TEMPLATES = [
  (d, h) => `Todo tal cual las fotos. Lo que más disfrutamos fue ${d}. ${h} nos contestó rapidísimo cada pregunta.`,
  (d, h) => `Excelente estancia. ${cap(d)} vale muchísimo la pena. Muy limpio y la llegada fue facilísima. Gracias, ${h}.`,
  (d, h) => `Volveríamos sin pensarlo. ${cap(d)} hizo el viaje. ${h} dejó recomendaciones muy buenas.`,
  (d) => `Muy buen lugar. ${cap(d)} fue lo mejor; sólo el agua caliente tardaba un poco en salir, nada grave.`,
  (d, h) => `Tercera vez que me quedo con ${h} y siempre igual de bien. ${cap(d)}, la cama cómoda y todo impecable.`,
  (d) => `Lugar precioso y tranquilo. ${cap(d)} superó lo que esperábamos. Muy recomendable para descansar.`,
];
const RATINGS = [5, 5, 4, 5, 5, 4];
const REVIEW_WINDOWS = [
  ["2026-03-06", "2026-03-09"],
  ["2026-05-15", "2026-05-19"],
  ["2026-08-21", "2026-08-24"],
];

function cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function nightsBetween(a, b) {
  return Math.round((new Date(`${b}T12:00:00Z`) - new Date(`${a}T12:00:00Z`)) / 86400000);
}

/* ─────────────── Armado ─────────────── */

function readJson(name, fallback) {
  const p = join(dataDir, name);
  if (!existsSync(p)) return fallback;
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(name, data) {
  writeFileSync(join(dataDir, name), JSON.stringify(data, null, 2), "utf8");
}

function hostById(id) {
  return HOSTS.find((h) => h.id === id);
}

function listingRecord(l) {
  const h = hostById(l.host);
  return {
    id: l.id,
    hostId: l.host,
    slug: l.id.replace(/^lst_(show_)?/, "").replace(/_/g, "-"),
    title: l.title,
    description: l.desc,
    categoryKey: l.cat,
    spaceType: l.space,
    city: l.city,
    zone: l.zone,
    county: l.county,
    country: "México",
    addressLine: `${l.zone}, ${l.city} — dirección exacta al confirmar`,
    lat: l.lat,
    lng: l.lng,
    guests: l.guests,
    bedrooms: l.bedrooms,
    bathrooms: l.bathrooms,
    size: l.size,
    pricePerNight: l.price,
    cleaningFee: l.cleaning,
    ...(l.pricing ? { pricing: l.pricing } : {}),
    ...(l.guide ? { arrivalGuide: l.guide } : {}),
    photos: l.photos.map(P),
    amenities: l.amenities,
    rules: l.rules,
    blockedDates: [],
    verified: h.verified,
    published: true,
    bookingApprovalMode: l.id.endsWith("_rooftop") || l.id.endsWith("_mzt_playa") ? "instant" : "approval",
    contract: {
      templateId: l.pricing?.monthlyDiscountPct ? "cabibee_estancia_media_v1" : l.guests >= 6 ? "cabibee_con_deposito_v1" : "cabibee_reserva_v1",
      hostLegalName: h.legal,
      hostAddress: h.address,
      propertyAddress: `${l.zone}, ${l.city}${l.state ? `, ${l.state}` : ""}`,
      depositMxn: l.guests >= 6 ? 3000 : 0,
      extraClauses: "",
      hostAcknowledged: true,
    },
    createdAt: CREATED,
    updatedAt: CREATED,
  };
}

function booking({ id, listing, guest, checkIn, checkOut, token, status = "COMPLETED" }) {
  const nights = nightsBetween(checkIn, checkOut);
  const stay = listing.price * nights;
  const total = stay + listing.cleaning;
  const createdAt = new Date(new Date(`${checkIn}T12:00:00Z`).getTime() - 20 * 86400000).toISOString();
  return {
    id,
    listingId: listing.id,
    hostId: listing.host,
    guestUserId: guest.id,
    guestEmail: guest.email,
    guestName: guest.name,
    guestPhone: guest.phone ?? "",
    checkIn,
    checkOut,
    nights,
    estimatedTotalMxn: total,
    platformFeeMxn: Math.max(1, Math.round(total * 0.01)),
    cleaningFeeMxn: listing.cleaning,
    status,
    paymentStatus: "paid",
    contractStatus: "signed",
    token,
    createdAt,
    updatedAt: `${checkOut}T18:00:00.000Z`,
    paidAt: createdAt,
    chargedVia: "platform",
    stripeCheckoutSessionId: `simulated_show_${id}`,
  };
}

async function main() {
  const store = readJson("marketplace-store.json", { version: 1, users: [], emailToUserId: {}, hostProfiles: {}, listings: [] });
  store.users = Array.isArray(store.users) ? store.users : [];
  store.listings = Array.isArray(store.listings) ? store.listings : [];
  store.emailToUserId = store.emailToUserId && typeof store.emailToUserId === "object" ? store.emailToUserId : {};
  store.hostProfiles = store.hostProfiles && typeof store.hostProfiles === "object" ? store.hostProfiles : {};

  const hasUser = (id, email) => store.users.some((u) => u.id === id || u.email === email);
  let added = { users: 0, listings: 0, bookings: 0, reviews: 0, messages: 0 };
  let hash;
  const passwordHash = async () => (hash ??= await bcrypt.hash(PASSWORD, 11));

  for (const h of HOSTS) {
    if (!hasUser(h.id, h.email)) {
      store.users.push({ id: h.id, email: h.email, passwordHash: await passwordHash(), fullName: h.name, phone: h.phone, addressLine: h.address, role: "host", createdAt: CREATED });
      store.emailToUserId[h.email] = h.id;
      added.users++;
    }
    if (!store.hostProfiles[h.id]) {
      store.hostProfiles[h.id] = {
        userId: h.id,
        bio: h.bio,
        avatarUrl: h.avatar,
        email: h.email,
        phone: h.phone,
        whatsapp: h.phone.replace(/\D/g, ""),
        languages: h.languages,
        interests: h.interests,
        work: HOST_WORK[h.id],
        livesIn: h.address.split(",").slice(-2).join(",").trim(),
      };
    }
  }
  for (const g of GUESTS) {
    if (!hasUser(g.id, g.email)) {
      store.users.push({ id: g.id, email: g.email, passwordHash: await passwordHash(), fullName: g.name, role: "guest", createdAt: CREATED });
      store.emailToUserId[g.email] = g.id;
      added.users++;
    }
    if (!store.hostProfiles[g.id]) store.hostProfiles[g.id] = { userId: g.id, bio: "", avatarUrl: g.avatar };
  }

  const haveListing = new Set(store.listings.map((l) => l.id));
  for (const l of L) {
    if (haveListing.has(l.id)) continue;
    store.listings.push(listingRecord(l));
    added.listings++;
  }
  writeJson("marketplace-store.json", store);

  // Reservas terminadas (con reseña) de huéspedes de muestra, más las de Sofía por reseñar.
  const bookingFile = readJson("bookings.json", { version: 1, bookings: [] });
  bookingFile.bookings = Array.isArray(bookingFile.bookings) ? bookingFile.bookings : [];
  const reviewFile = readJson("stay-reviews.json", { version: 1, reviews: [] });
  reviewFile.reviews = Array.isArray(reviewFile.reviews) ? reviewFile.reviews : [];
  const haveBooking = new Set(bookingFile.bookings.map((b) => b.id));
  const haveReview = new Set(reviewFile.reviews.map((r) => r.id));

  const sofiaListings = [
    { id: "lst_demo_sofia_roma", host: SOFIA_ID, price: 1680, cleaning: 280, details: ["la terraza para el café", "la cocina abierta", "lo bien ubicado del loft"] },
    { id: "lst_demo_sofia_condesa", host: SOFIA_ID, price: 890, cleaning: 120, details: ["el escritorio frente a la ventana", "lo cerca del Parque México", "lo amable que es Sofía"] },
    { id: "lst_demo_sofia_coyoacan", host: SOFIA_ID, price: 2380, cleaning: 380, details: ["el patio empedrado", "lo espaciosa de la casa", "caminar al centro de Coyoacán"] },
    { id: "lst_demo_sofia_valle", host: SOFIA_ID, price: 2100, cleaning: 320, details: ["la chimenea", "las hamacas de la terraza", "el sendero al bosque"] },
  ].filter((l) => store.listings.some((x) => x.id === l.id));

  const reviewed = [...L, ...sofiaListings];
  let gi = 0;
  let tok = 700100;
  reviewed.forEach((l, li) => {
    const count = sofiaListings.includes(l) ? 2 : 3;
    for (let n = 0; n < count; n++) {
      const guest = GUESTS[gi++ % GUESTS.length];
      const [checkIn, checkOut] = REVIEW_WINDOWS[(li + n) % REVIEW_WINDOWS.length];
      const bid = `bkg_show_rev_${l.id}_${n}`;
      if (!haveBooking.has(bid)) {
        bookingFile.bookings.push(booking({ id: bid, listing: l, guest, checkIn, checkOut, token: String(tok) }));
        added.bookings++;
      }
      tok++;
      const rid = `rev_show_${l.id}_${n}`;
      if (!haveReview.has(rid)) {
        const host = hostById(l.host)?.name.split(" ")[0] ?? "Sofía";
        const t = (li + n) % REVIEW_TEMPLATES.length;
        reviewFile.reviews.push({
          id: rid,
          bookingId: bid,
          listingId: l.id,
          hostId: l.host,
          guestUserId: guest.id,
          kind: "guest_to_listing",
          authorUserId: guest.id,
          rating: RATINGS[(li * 2 + n) % RATINGS.length],
          comment: REVIEW_TEMPLATES[t](l.details[n % l.details.length], host),
          createdAt: `${checkOut}T20:00:00.000Z`,
        });
        added.reviews++;
      }
    }
  });

  const sofia = { id: SOFIA_ID, name: "Sofía Ramírez", email: "sofia@urbnbee.test", phone: "+52 55 3901 7742" };
  const byId = (id) => L.find((l) => l.id === id);
  const sofiaStays = [
    { id: "bkg_show_sofia_tulum", listing: byId("lst_show_lucia_tulum_playa"), checkIn: "2026-08-10", checkOut: "2026-08-14", token: "905512" },
    { id: "bkg_show_sofia_sma", listing: byId("lst_show_mariana_sma_casa"), checkIn: "2026-06-05", checkOut: "2026-06-08", token: "905877" },
    { id: "bkg_show_sofia_vinedo", listing: byId("lst_show_andres_vinedo_cabana"), checkIn: "2026-05-01", checkOut: "2026-05-04", token: "906134" },
  ];
  for (const s of sofiaStays) {
    if (haveBooking.has(s.id)) continue;
    bookingFile.bookings.push(booking({ ...s, guest: sofia }));
    added.bookings++;
  }
  writeJson("bookings.json", bookingFile);
  writeJson("stay-reviews.json", reviewFile);

  // Conversación de Sofía (huésped) con Lucía, de su viaje a Tulum.
  const inbox = readJson("host-inbox-messages.json", { version: 1, messages: [] });
  inbox.messages = Array.isArray(inbox.messages) ? inbox.messages : [];
  const haveMsg = new Set(inbox.messages.map((m) => m.id));
  const tulum = "lst_show_lucia_tulum_playa";
  const msgs = [
    { id: "msg_show_sofia_lucia_1", sender: "guest", body: "Hola Lucía, llegamos el 10 de agosto como a las 5. ¿Nos recomiendas un cenote tranquilo para el día siguiente?", createdAt: "2026-08-02T16:10:00.000Z" },
    { id: "msg_show_sofia_lucia_2", sender: "host", body: "¡Hola Sofía! Vayan temprano al Cenote Calavera, antes de las 10 casi no hay gente. Les dejo snorkels en la terraza.", createdAt: "2026-08-02T17:02:00.000Z" },
    { id: "msg_show_sofia_lucia_3", sender: "guest", body: "Mil gracias, la casa está increíble. Ya salimos, dejamos las llaves en la caja.", createdAt: "2026-08-14T10:48:00.000Z" },
  ];
  for (const m of msgs) {
    if (haveMsg.has(m.id)) continue;
    inbox.messages.push({
      id: m.id,
      listingId: tulum,
      hostId: "usr_show_lucia",
      guestSessionId: SOFIA_SID,
      sender: m.sender,
      guestName: m.sender === "guest" ? "Sofía Ramírez" : "",
      guestEmail: m.sender === "guest" ? "sofia@urbnbee.test" : undefined,
      body: m.body,
      createdAt: m.createdAt,
    });
    added.messages++;
  }
  writeJson("host-inbox-messages.json", inbox);

  // Reservas en línea: activas para quienes las contrataron; Javier y Rodrigo sólo reciben mensajes.
  const ent = readJson("host-entitlements.json", { version: 1, entitlements: [] });
  ent.entitlements = Array.isArray(ent.entitlements) ? ent.entitlements : [];
  const verif = readJson("guest-verification.json", { version: 1, verifications: [] });
  verif.verifications = Array.isArray(verif.verifications) ? verif.verifications : [];
  const now = new Date().toISOString();
  for (const h of HOSTS) {
    if (!ent.entitlements.some((e) => e.hostId === h.id)) {
      ent.entitlements.push({
        hostId: h.id,
        sku: "cabibee_booking_engine",
        status: h.bookable ? "active" : "canceled",
        source: "cabibee_direct",
        currentPeriodEnd: "2027-03-01T00:00:00.000Z",
        updatedAt: now,
      });
      if (h.verified) {
        ent.entitlements.push({
          hostId: h.id,
          sku: "cabibee_host_verification",
          status: "active",
          source: "cabibee_direct",
          currentPeriodEnd: "2027-03-01T00:00:00.000Z",
          updatedAt: now,
        });
      }
    }
    if (h.verified && !verif.verifications.some((v) => v.userId === h.id)) {
      verif.verifications.push({
        userId: h.id,
        subscriptionStatus: "active",
        currentPeriodEnd: "2027-03-01T00:00:00.000Z",
        kycStatus: "verified",
        hostVerifiedAt: "2026-03-02T12:00:00.000Z",
        hostVerificationSource: "admin",
        hostSubscriptionStatus: "active",
        hostCurrentPeriodEnd: "2027-03-01T00:00:00.000Z",
        updatedAt: now,
      });
    }
  }
  writeJson("host-entitlements.json", ent);
  writeJson("guest-verification.json", verif);

  const total = Object.values(added).reduce((a, b) => a + b, 0);
  if (total > 0) {
    console.log(
      `[seed-showcase] +${added.users} cuentas, +${added.listings} anuncios, +${added.bookings} reservas, +${added.reviews} reseñas, +${added.messages} mensajes`
    );
  }
}

main().catch((e) => {
  console.error("[seed-showcase] falló:", e);
  process.exit(0);
});
