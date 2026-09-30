import type { ListingDetail, Review } from "@/lib/listing-detail-data";

const AMENITIES = [
  "Internet Inalámbrico",
  "Cocina",
  "Agua caliente",
  "Ropa de cama",
  "Artículos Esenciales",
  "Detector de humo",
  "Botiquín",
  "Calefacción",
  "Refrigerador",
  "Televisión",
];

type HostInput = {
  name: string;
  bio: string;
  avatarUrl: string;
  email: string;
  phone: string;
  whatsapp: string;
};

type Input = {
  id: string;
  slug: string;
  title: string;
  description: string;
  city: string;
  zone: string;
  county: string;
  country: string;
  lat: number;
  lng: number;
  pricePerNight: number;
  cleaningFee: number;
  category: string;
  spaceType: string;
  guests: number;
  bedrooms: number;
  bathrooms: number;
  verified: boolean;
  propertyId: number;
  photos: string[];
  amenities?: string[];
  host: HostInput;
  reviews: Review[];
  pets?: boolean;
};

function demo(input: Input): ListingDetail {
  return {
    id: input.id,
    slug: input.slug,
    title: input.title,
    description: input.description,
    city: input.city,
    zone: input.zone,
    county: input.county,
    country: input.country,
    lat: input.lat,
    lng: input.lng,
    pricePerNight: input.pricePerNight,
    cleaningFee: input.cleaningFee,
    category: input.category,
    spaceType: input.spaceType,
    guests: input.guests,
    bedrooms: input.bedrooms,
    bathrooms: input.bathrooms,
    verified: input.verified,
    propertyId: input.propertyId,
    blockedDates: [],
    photos: input.photos,
    amenities: input.amenities ?? AMENITIES,
    rules: { smoking: false, pets: input.pets ?? false, parties: false, children: true },
    host: input.host,
    reviews: input.reviews,
    extras: { cancellation: "sin cargo." },
  };
}

const p = (id: string, w = 1200) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&q=85`;

export const extraListingDetails: Record<string, ListingDetail> = {
  "casa-chic-cole-valley": demo({
    id: "4",
    slug: "casa-chic-cole-valley",
    title: "Casa Chic en Cole Valley",
    description:
      "Habitación privada en una casa luminosa de Cole Valley. Cama queen, escritorio y baño compartido recién renovado. A unas cuadras de cafés, el parque y el tranvía. Mariana vive en la casa y deja el desayuno listo por la mañana.",
    city: "San Francisco",
    zone: "Cole Valley",
    county: "California",
    country: "Estados Unidos",
    lat: 37.765,
    lng: -122.45,
    pricePerNight: 2400,
    cleaningFee: 20,
    category: "Casas",
    spaceType: "Habitación Privada",
    guests: 4,
    bedrooms: 2,
    bathrooms: 1,
    verified: false,
    propertyId: 152,
    photos: [p("1600596542815-ffad4c1539a9"), p("1600585154340-be6161a56a0c"), p("1600607687939-ce8a6c25118c"), p("1570129477492-45c003edd2be")],
    host: {
      name: "Mariana López",
      bio: "Diseñadora y anfitriona en Cole Valley. Recibo viajeros desde 2021 y me gusta dejar la casa lista, con café y recomendaciones del barrio.",
      avatarUrl: p("1534528741775-53994a69daeb", 200),
      email: "mariana.lopez@cabibee.test",
      phone: "+1 415 555 0142",
      whatsapp: "14155550142",
    },
    reviews: [
      {
        id: "r-chic-1",
        author: "Laura P.",
        avatarUrl: p("1580489944761-15a19d654956", 100),
        rating: 5,
        date: "Agosto 2025",
        comment: "La casa es tal cual las fotos. Mariana respondió en minutos y el barrio es precioso para caminar.",
      },
    ],
  }),
  "apartamento-terraza-penn-station": demo({
    id: "5",
    slug: "apartamento-terraza-penn-station",
    title: "Apartamento con Bonita Terraza – Penn Station",
    description:
      "Departamento de dos recámaras con terraza para grupos de hasta ocho personas. A diez minutos a pie de Penn Station. Cocina equipada, dos baños y sala con sofá cama. Ideal para una escala en la ciudad o un fin de semana largo.",
    city: "Nueva York",
    zone: "Midtown",
    county: "Nueva York",
    country: "Estados Unidos",
    lat: 40.7506,
    lng: -73.9935,
    pricePerNight: 3000,
    cleaningFee: 40,
    category: "Departamentos",
    spaceType: "Habitación Privada",
    guests: 8,
    bedrooms: 2,
    bathrooms: 2,
    verified: false,
    propertyId: 153,
    photos: [p("1502672260266-1c1ef2d93688"), p("1484154218962-a197022b5858"), p("1560448204-e02f11c3d0e2"), p("1583847268964-b28dc8f51f92")],
    host: {
      name: "Carlos Herrera",
      bio: "Anfitrión en Midtown. El departamento es de la familia y lo rentamos cuando viajamos. Siempre dejo instrucciones claras y el wifi listo.",
      avatarUrl: p("1506794778202-cad84cf45f1d", 200),
      email: "carlos.herrera@cabibee.test",
      phone: "+1 212 555 0198",
      whatsapp: "12125550198",
    },
    reviews: [
      {
        id: "r-penn-1",
        author: "Diego S.",
        avatarUrl: p("1547425260-76bcadfb4f2c", 100),
        rating: 5,
        date: "Julio 2025",
        comment: "La terraza vale la estancia. Llegamos ocho y cupimos bien. Carlos dejó las llaves sin complicaciones.",
      },
    ],
  }),
  "dos-habitaciones-soleadas": demo({
    id: "6",
    slug: "dos-habitaciones-soleadas",
    title: "2 habitaciones soleadas",
    description:
      "Dos recámaras con luz de mañana, cocina abierta y una alberca compartida en el conjunto. Sofía vive en el mismo edificio y entrega las llaves en persona. Buena opción para una pareja o una familia pequeña.",
    city: "Ciudad de México",
    zone: "Condesa",
    county: "Cuauhtémoc",
    country: "México",
    lat: 19.412,
    lng: -99.174,
    pricePerNight: 2250,
    cleaningFee: 18,
    category: "Departamentos",
    spaceType: "Habitación Privada",
    guests: 4,
    bedrooms: 2,
    bathrooms: 1,
    verified: true,
    propertyId: 154,
    photos: [p("1493809842364-78817add7ffb"), p("1560185893-a55cbc8c57e8"), p("1522708323590-d24dbb6b0267"), p("1560448204-e02f11c3d0e2")],
    amenities: [...AMENITIES, "Alberca", "Terraza o balcón"],
    host: {
      name: "Sofía Ramírez",
      bio: "Anfitriona verificada en la Condesa. Llevo cuatro años recibiendo huéspedes y cuido que el departamento huela limpio y la alberca esté disponible.",
      avatarUrl: p("1580489944761-15a19d654956", 200),
      email: "sofia.ramirez@cabibee.test",
      phone: "+52 55 5555 0144",
      whatsapp: "525555550144",
    },
    reviews: [
      {
        id: "r-sol-1",
        author: "Andrea L.",
        avatarUrl: p("1524504388940-b1c1722653e1", 100),
        rating: 5,
        date: "Septiembre 2025",
        comment: "Muy soleado, tal como dice el anuncio. La alberca del edificio es un plus y Sofía es puntual.",
      },
    ],
  }),
  "cabana-summerlin": demo({
    id: "7",
    slug: "cabana-summerlin",
    title: "Cabaña Summerlin – Vacaciones Perfectas",
    description:
      "Cabaña completa entre pinos, con dos recámaras, sala con chimenea y asador. Elena deja leña, café y un mapa de senderos. El check-in es con caja de llaves y hay estacionamiento en la entrada.",
    city: "Las Vegas",
    zone: "Summerlin",
    county: "Clark",
    country: "Estados Unidos",
    lat: 36.17,
    lng: -115.33,
    pricePerNight: 2500,
    cleaningFee: 30,
    category: "Cabañas",
    spaceType: "Espacio Completo",
    guests: 6,
    bedrooms: 2,
    bathrooms: 2,
    verified: true,
    propertyId: 155,
    photos: [p("1449158743715-0a90ebb6d2d8"), p("1518780664697-55e3ad937233"), p("1763669632676-961830e89de2"), p("1758983065583-9cea714214f9")],
    amenities: [...AMENITIES, "Chimenea Interior", "Asador", "Estacionamiento Gratuito", "Jardín / Patio"],
    pets: true,
    host: {
      name: "Elena Vargas",
      bio: "Anfitriona verificada. La cabaña es de fin de semana de mi familia y la abrimos cuando no estamos. Respondo rápido y dejo el lugar listo para llegar y descansar.",
      avatarUrl: p("1524504388940-b1c1722653e1", 200),
      email: "elena.vargas@cabibee.test",
      phone: "+1 702 555 0177",
      whatsapp: "17025550177",
    },
    reviews: [
      {
        id: "r-sum-1",
        author: "Luis H.",
        avatarUrl: p("1500648767791-00dcc994a43e", 100),
        rating: 5,
        date: "Junio 2025",
        comment: "Cabaña tranquila, fotos reales y la chimenea funcionó perfecto. Elena explicó todo por mensaje.",
      },
    ],
  }),
  "hermosa-cabana-precio-sencillo": demo({
    id: "8",
    slug: "hermosa-cabana-precio-sencillo",
    title: "Hermosa Cabaña, Precio Sencillo",
    description:
      "Cabaña de una recámara para hasta cinco personas, con loft, cocina básica y porche. Diego vive a diez minutos y pasa al inicio de la estancia para enseñar la estufa y el boiler.",
    city: "Valle de Bravo",
    zone: "Avándaro",
    county: "Estado de México",
    country: "México",
    lat: 19.16,
    lng: -100.13,
    pricePerNight: 2000,
    cleaningFee: 15,
    category: "Cabañas",
    spaceType: "Espacio Completo",
    guests: 5,
    bedrooms: 1,
    bathrooms: 1,
    verified: false,
    propertyId: 156,
    photos: [p("1518780664697-55e3ad937233"), p("1449158743715-0a90ebb6d2d8"), p("1758983065583-9cea714214f9"), p("1763669632676-961830e89de2")],
    amenities: [...AMENITIES, "Jardín / Patio", "Asador"],
    host: {
      name: "Diego Morales",
      bio: "Anfitrión en Avándaro. Rento esta cabaña todo el año y me encargo yo mismo de la limpieza entre huéspedes.",
      avatarUrl: p("1547425260-76bcadfb4f2c", 200),
      email: "diego.morales@cabibee.test",
      phone: "+52 726 555 0110",
      whatsapp: "527265550110",
    },
    reviews: [
      {
        id: "r-her-1",
        author: "Paola N.",
        avatarUrl: p("1438761681033-6461ffad8d80", 100),
        rating: 5,
        date: "Mayo 2025",
        comment: "Precio justo y el porche es el mejor lugar del viaje. Diego llegó puntual con las llaves.",
      },
    ],
  }),
  "vinedo-valle-de-guadalupe": demo({
    id: "9",
    slug: "vinedo-valle-de-guadalupe",
    title: "Casa entre viñedos en Valle de Guadalupe",
    description:
      "Casa completa entre hileras de vid, a unos minutos de las bodegas del valle. Tres recámaras, terraza para la cena y estacionamiento. Lucía organiza la cata del vecino si la pides con un día de anticipación.",
    city: "Ensenada",
    zone: "Valle de Guadalupe",
    county: "Baja California",
    country: "México",
    lat: 32.09,
    lng: -116.6,
    pricePerNight: 4200,
    cleaningFee: 35,
    category: "Viñedos",
    spaceType: "Espacio Completo",
    guests: 6,
    bedrooms: 3,
    bathrooms: 2,
    verified: true,
    propertyId: 157,
    photos: [p("1506377247377-2a5b3b417ebb"), p("1474722883778-792e7990302f"), p("1510812431401-41d2bd2722f3"), p("1560493676-04071c5f467b")],
    amenities: [...AMENITIES, "Terraza o balcón", "Estacionamiento Gratuito", "Jardín / Patio"],
    host: {
      name: "Lucía Navarro",
      bio: "Anfitriona verificada en el Valle de Guadalupe. La casa está en el terreno de la familia y la abrimos para quienes vienen a las bodegas.",
      avatarUrl: p("1544005313-94ddf0286df2", 200),
      email: "lucia.navarro@cabibee.test",
      phone: "+52 646 555 0166",
      whatsapp: "526465550166",
    },
    reviews: [
      {
        id: "r-vin-1",
        author: "Hugo C.",
        avatarUrl: p("1472099645785-5658abf4ff4e", 100),
        rating: 5,
        date: "Abril 2025",
        comment: "Despertar viendo los viñedos no tiene comparación. Lucía nos recomendó tres bodegas y todas valieron la pena.",
      },
    ],
  }),
  "bodega-tequisquiapan": demo({
    id: "10",
    slug: "bodega-tequisquiapan",
    title: "Bodega con terraza en Tequisquiapan",
    description:
      "Estancia en una bodega pequeña de Tequisquiapan, con dos recámaras y terraza para la tarde. Andrés deja queso, pan y una botella de la casa. El pueblo se recorre a pie.",
    city: "Tequisquiapan",
    zone: "Centro",
    county: "Querétaro",
    country: "México",
    lat: 20.52,
    lng: -99.89,
    pricePerNight: 3100,
    cleaningFee: 22,
    category: "Viñedos",
    spaceType: "Espacio Completo",
    guests: 4,
    bedrooms: 2,
    bathrooms: 2,
    verified: false,
    propertyId: 158,
    photos: [p("1510812431401-41d2bd2722f3"), p("1506377247377-2a5b3b417ebb"), p("1474722883778-792e7990302f"), p("1560493676-04071c5f467b")],
    amenities: [...AMENITIES, "Terraza o balcón", "Mesa de comedor"],
    host: {
      name: "Andrés Molina",
      bio: "Vitivinicultor y anfitrión. Recibo pocos grupos a la vez para que la bodega siga siendo tranquila.",
      avatarUrl: p("1500648767791-00dcc994a43e", 200),
      email: "andres.molina@cabibee.test",
      phone: "+52 414 555 0121",
      whatsapp: "524145550121",
    },
    reviews: [
      {
        id: "r-teq-1",
        author: "Renata V.",
        avatarUrl: p("1494790108377-be9c29b29330", 100),
        rating: 4,
        date: "Marzo 2025",
        comment: "Terraza perfecta al atardecer. El pueblo está cerca y Andrés fue muy claro con el check-in.",
      },
    ],
  }),
  "casa-frente-al-mar-sayulita": demo({
    id: "11",
    slug: "casa-frente-al-mar-sayulita",
    title: "Casa frente al mar en Sayulita",
    description:
      "Casa de tres recámaras frente a la playa, con sala abierta, cocina grande y hamacas en el porche. Paula deja tablas de surf de cortesía y explica la marea del día. Cabe un grupo de ocho.",
    city: "Sayulita",
    zone: "Playa",
    county: "Nayarit",
    country: "México",
    lat: 20.869,
    lng: -105.441,
    pricePerNight: 3800,
    cleaningFee: 45,
    category: "Casas",
    spaceType: "Espacio Completo",
    guests: 8,
    bedrooms: 3,
    bathrooms: 2,
    verified: true,
    propertyId: 159,
    photos: [p("1499793983690-e29da59ef1c2"), p("1540541338287-41700207dee6"), p("1595526114035-0d45ed16cfbf"), p("1583847268964-b28dc8f51f92")],
    amenities: [...AMENITIES, "Terraza o balcón", "Jardín / Patio", "Kayak"],
    pets: true,
    host: {
      name: "Paula Reyes",
      bio: "Anfitriona verificada en Sayulita. Nací aquí y la casa es de mi familia. Ayudo con el check-in y con quién renta tablas en la playa.",
      avatarUrl: p("1438761681033-6461ffad8d80", 200),
      email: "paula.reyes@cabibee.test",
      phone: "+52 329 555 0188",
      whatsapp: "523295550188",
    },
    reviews: [
      {
        id: "r-say-1",
        author: "Iván M.",
        avatarUrl: p("1507003211169-0a1dd7228f2d", 100),
        rating: 5,
        date: "Febrero 2025",
        comment: "La casa sí está frente al mar. Paula nos recibió con las hamacas listas y el wifi funcionó toda la semana.",
      },
    ],
  }),
};
