export type HostContact = {
  name: string;
  bio: string;
  avatarUrl: string;
  whatsapp?: string;
  phone?: string;
  email?: string;
  instagram?: string;
  website?: string;
  airbnbUrl?: string;
};

export type Review = {
  id: string;
  author: string;
  avatarUrl: string;
  rating: number;
  date: string;
  comment: string;
};

export type ListingDetail = {
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
  /** Precios por noche por fecha (YYYY-MM-DD) para el huésped. */
  nightlyPriceOverrides?: Record<string, number>;
  priceWeekly?: number;
  priceMonthly?: number;
  cleaningFee?: number;
  category: string;
  spaceType: string;
  guests: number;
  bedrooms: number;
  bathrooms: number;
  size?: string;
  verified: boolean;
  propertyId: number;
  // Dates that are already booked (YYYY-MM-DD)
  blockedDates: string[];
  photos: string[];
  amenities: string[];
  rules: {
    smoking: boolean | null;
    pets: boolean | null;
    parties: boolean | null;
    children: boolean | null;
  };
  host: HostContact;
  reviews: Review[];
  extras?: {
    breakfast?: string;
    lateCheckIn?: string;
    optionalServices?: string;
    outdoorFacilities?: string;
    cancellation?: string;
  };
};

export const listingDetails: Record<string, ListingDetail> = {
  "habitacion-west-town-tercer-piso": {
    id: "1",
    slug: "habitacion-west-town-tercer-piso",
    title: "Habitación en el tercer piso de West Town",
    description: `Hermoso penthouse en el tercer piso, a poca distancia a pie o en coche de restaurantes, tiendas y transporte público. Habitación/baño privado con las mejores comodidades. HDTV, internet, centro de negocios (en la habitación), lavadora/secadora, nevera para vino, chimenea a gas, sonido envolvente, terraza privada en el techo.

A un viaje en autobús del metro. Wifi, cocina para comer, televisión por cable, familia anfitriona cálida y un pequeño perro adorable. Desayuno completo incluido en el precio. Hay algunas tiendas al final de la calle, y está a minutos de Mattapan Square.`,
    city: "Baltimore",
    zone: "Arlington",
    county: "Maryland",
    country: "Estados Unidos",
    lat: 39.2904,
    lng: -76.6122,
    pricePerNight: 2000,
    priceWeekly: 20,
    priceMonthly: 15,
    cleaningFee: 15,
    category: "Habitaciones",
    spaceType: "Habitación Compartida",
    guests: 2,
    bedrooms: 1,
    bathrooms: 1,
    size: "250 m²",
    verified: true,
    propertyId: 149,
    blockedDates: [],
    photos: [
      "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=1200&q=85",
      "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=1200&q=85",
      "https://images.unsplash.com/photo-1560185893-a55cbc8c57e8?w=1200&q=85",
      "https://images.unsplash.com/photo-1484154218962-a197022b5858?w=1200&q=85",
      "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=1200&q=85",
      "https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=1200&q=85",
    ],
    amenities: [
      "Aire Acondicionado", "Agua caliente", "Internet Inalámbrico", "Cocina", "Lavadora",
      "Secadora", "Televisión", "Chimenea Interior", "Terraza o balcón", "Estacionamiento Gratuito",
      "Detector de humo", "Botiquín", "Ropa de cama", "Calefacción", "Refrigerador",
      "Microondas", "Cafetera", "Plancha", "Secadora de pelo", "Shampoo",
      "Jabón corporal", "Elementos básicos", "Artículos Esenciales", "Mesa de comedor",
      "Sistema de sonido", "Caja fuerte", "Amigable Familias/Niños", "Desayuno incluido",
      "Cerradura en la puerta de la habitación", "Bares / Restaurantes", "Patio",
    ],
    rules: { smoking: false, pets: true, parties: false, children: true },
    host: {
      name: "John Smith",
      bio: "¡Hola! Soy John Smith, un amante de los viajes, la cultura y las experiencias únicas. Me apasiona conocer nuevos lugares, descubrir sabores locales y conectar con personas de diferentes partes del mundo. Como anfitrión, me esfuerzo por crear espacios cómodos y acogedores donde mis huéspedes se sientan como en casa.",
      avatarUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&q=80",
      whatsapp: "52554454326",
      phone: "+52 55 4454 3260",
      email: "johnsmith@email.com",
      instagram: "johnsmith_host",
      airbnbUrl: "https://www.airbnb.com/rooms/913726283762985005",
    },
    reviews: [
      {
        id: "r1",
        author: "María G.",
        avatarUrl: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&q=80",
        rating: 5,
        date: "Marzo 2025",
        comment: "Increíble lugar, John es un excelente anfitrión. La habitación es exactamente como en las fotos y el desayuno incluido es delicioso. Definitivamente volvería.",
      },
      {
        id: "r2",
        author: "Carlos M.",
        avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&q=80",
        rating: 5,
        date: "Enero 2025",
        comment: "Todo perfecto. La ubicación es conveniente, el espacio limpio y cómodo. La chimenea es un detalle encantador para las noches frías.",
      },
    ],
    extras: {
      breakfast: "Sí",
      lateCheckIn: "Antes 1 AM",
      optionalServices: "Cocina totalmente equipada.",
      outdoorFacilities: "restaurante, bares, parques.",
      cancellation: "sin cargo.",
    },
  },

  "habitacion-soleada-west-town": {
    id: "2",
    slug: "habitacion-soleada-west-town",
    title: "Habitación soleada en West Town",
    description: "Habitación luminosa en el corazón de West Town con vistas increíbles al skyline. Perfecta para viajeros que buscan comodidad y accesibilidad. A 5 minutos del transporte público y rodeada de cafeterías, restaurantes y tiendas de diseño.",
    city: "Chicago",
    zone: "West Town",
    county: "Cook County",
    country: "Estados Unidos",
    lat: 41.8865,
    lng: -87.6805,
    pricePerNight: 1500,
    cleaningFee: 10,
    category: "Habitaciones",
    spaceType: "Espacio Completo",
    guests: 2,
    bedrooms: 1,
    bathrooms: 1,
    verified: false,
    propertyId: 150,
    blockedDates: [],
    photos: [
      "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200&q=85",
      "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&q=85",
      "https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=1200&q=85",
      "https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?w=1200&q=85",
    ],
    amenities: [
      "Internet Inalámbrico", "Televisión", "Cocina", "Agua caliente", "Calefacción",
      "Ropa de cama", "Artículos Esenciales", "Detector de humo", "Botiquín", "Plancha",
      "Cerradura en la puerta de la habitación", "Amigable Familias/Niños",
    ],
    rules: { smoking: false, pets: false, parties: false, children: true },
    host: {
      name: "Olivia Williams",
      bio: "Anfitriona verificada con más de 3 años de experiencia. Me encanta recibir viajeros de todo el mundo y hacer que su estadía en Chicago sea inolvidable.",
      avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80",
      whatsapp: "52554454326",
      phone: "+52 55 4454 3260",
      email: "olivia@email.com",
      instagram: "olivia_host_chicago",
    },
    reviews: [],
    extras: { cancellation: "sin cargo." },
  },

  "casa-acogedora-sunnyside": {
    id: "3",
    slug: "casa-acogedora-sunnyside",
    title: "Casa Acogedora en Sunnyside",
    description: "Encantadora casa en el vecindario de Sunnyside, perfecta para familias y grupos pequeños. Jardín privado, cocina completamente equipada y parking gratuito. A 10 minutos del centro en transporte público.",
    city: "Chicago",
    zone: "Sunnyside",
    county: "Cook County",
    country: "Estados Unidos",
    lat: 41.9647,
    lng: -87.7120,
    pricePerNight: 2500,
    cleaningFee: 25,
    category: "Casas",
    spaceType: "Espacio Completo",
    guests: 4,
    bedrooms: 2,
    bathrooms: 1,
    verified: false,
    propertyId: 151,
    blockedDates: [],
    photos: [
      "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=1200&q=85",
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=85",
      "https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=1200&q=85",
      "https://images.unsplash.com/photo-1556020685-ae41abfc9365?w=1200&q=85",
      "https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=1200&q=85",
    ],
    amenities: [
      "Cocina", "Jardín / Patio", "Estacionamiento Gratuito", "Internet Inalámbrico",
      "Lavadora", "Secadora", "Televisión", "Agua caliente", "Calefacción", "Refrigerador",
      "Microondas", "Estufa", "Horno", "Mesa de comedor", "Muebles exteriores",
      "Detector de humo", "Detector de monóxido de carbono", "Botiquín", "Ropa de cama",
      "Amigable Familias/Niños", "Permiten Mascotas",
    ],
    rules: { smoking: false, pets: true, parties: false, children: true },
    host: {
      name: "David Torres",
      bio: "Propietario de Sunnyside con 5 años como anfitrión. Mi casa es tu casa — me aseguro de que tengas todo lo necesario para una estancia perfecta.",
      avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80",
      whatsapp: "15551234567",
      phone: "+1 555 123 4567",
      email: "david@sunnyside.com",
    },
    reviews: [
      {
        id: "r1",
        author: "Ana R.",
        avatarUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&q=80",
        rating: 5,
        date: "Febrero 2025",
        comment: "Casa hermosa y muy limpia. El jardín es precioso para tomar café por la mañana. David es muy atento.",
      },
    ],
  },
};
