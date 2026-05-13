export type ListingCategory =
  | "habitaciones"
  | "casas"
  | "departamentos"
  | "cabanas"
  | "vinos";

export type Listing = {
  id: string;
  slug: string;
  title: string;
  imageSrc: string;
  pricePerNight: number;
  currency: string;
  rating: number;
  categoryLabel: string;
  spaceType: string;
  guests: number;
  bedrooms: number;
  bathrooms: number;
  verified?: boolean;
  featured?: boolean;
};

export const categoryCounts: { key: ListingCategory; label: string; count: number }[] =
  [
    { key: "habitaciones", label: "Habitaciones", count: 2 },
    { key: "casas", label: "Casas", count: 6 },
    { key: "departamentos", label: "Departamentos", count: 8 },
    { key: "vinos", label: "Viñedos", count: 2 },
    { key: "cabanas", label: "Cabañas", count: 2 },
    { key: "habitaciones", label: "Vistas increíbles", count: 6 },
    { key: "cabanas", label: "Tropical", count: 3 },
    { key: "casas", label: "Frente al mar", count: 3 },
    { key: "departamentos", label: "Albercas", count: 2 },
  ];

export const demoListings: Record<ListingCategory, Listing[]> = {
  habitaciones: [
    {
      id: "1",
      slug: "habitacion-west-town-tercer-piso",
      title: "Habitación en el tercer piso de West Town",
      imageSrc:
        "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=800&q=80",
      pricePerNight: 2000,
      currency: "$",
      rating: 5,
      categoryLabel: "Habitaciones",
      spaceType: "Habitación Compartida",
      guests: 2,
      bedrooms: 1,
      bathrooms: 1,
      verified: true,
    },
    {
      id: "2",
      slug: "habitacion-soleada-west-town",
      title: "Habitación soleada en West Town",
      imageSrc:
        "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80",
      pricePerNight: 1500,
      currency: "$",
      rating: 4.5,
      categoryLabel: "Habitaciones, Vistas increíbles",
      spaceType: "Espacio Completo",
      guests: 2,
      bedrooms: 1,
      bathrooms: 1,
    },
  ],
  casas: [
    {
      id: "3",
      slug: "casa-acogedora-sunnyside",
      title: "Casa Acogedora en Sunnyside",
      imageSrc:
        "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&q=80",
      pricePerNight: 2500,
      currency: "$",
      rating: 4.5,
      categoryLabel: "Casas",
      spaceType: "Espacio Completo",
      guests: 2,
      bedrooms: 1,
      bathrooms: 1,
    },
    {
      id: "4",
      slug: "casa-chic-cole-valley",
      title: "Casa Chic en Cole Valley",
      imageSrc:
        "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80",
      pricePerNight: 2400,
      currency: "$",
      rating: 5,
      categoryLabel: "Casas",
      spaceType: "Habitación Privada",
      guests: 4,
      bedrooms: 2,
      bathrooms: 1,
    },
  ],
  departamentos: [
    {
      id: "5",
      slug: "apartamento-terraza-penn-station",
      title: "Apartamento con Bonita Terraza – Penn Station",
      imageSrc:
        "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80",
      pricePerNight: 3000,
      currency: "$",
      rating: 5,
      categoryLabel: "Departamentos",
      spaceType: "Habitación Privada",
      guests: 8,
      bedrooms: 2,
      bathrooms: 2,
    },
    {
      id: "6",
      slug: "dos-habitaciones-soleadas",
      title: "2 habitaciones soleadas",
      imageSrc:
        "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800&q=80",
      pricePerNight: 2250,
      currency: "$",
      rating: 4.5,
      categoryLabel: "Departamentos",
      spaceType: "Habitación Privada",
      guests: 4,
      bedrooms: 2,
      bathrooms: 1,
      verified: true,
      featured: true,
    },
  ],
  cabanas: [
    {
      id: "7",
      slug: "cabana-summerlin",
      title: "Cabaña Summerlin – Vacaciones Perfectas",
      imageSrc:
        "https://images.unsplash.com/photo-1449158743715-0a90ebb615d9?w=800&q=80",
      pricePerNight: 2500,
      currency: "$",
      rating: 4.5,
      categoryLabel: "Cabañas",
      spaceType: "Espacio Completo",
      guests: 6,
      bedrooms: 2,
      bathrooms: 2,
      verified: true,
    },
    {
      id: "8",
      slug: "hermosa-cabana-precio-sencillo",
      title: "Hermosa Cabaña, Precio Sencillo",
      imageSrc:
        "https://images.unsplash.com/photo-1518780664697-55e3ad937233?w=800&q=80",
      pricePerNight: 2000,
      currency: "$",
      rating: 5,
      categoryLabel: "Cabañas",
      spaceType: "Espacio Completo",
      guests: 5,
      bedrooms: 1,
      bathrooms: 1,
      featured: true,
    },
  ],
  vinos: [],
};
