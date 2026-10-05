/**
 * Comodidades del editor de anfitrión, por grupo. En el anuncio se guarda el texto tal cual
 * (`listing.amenities`), así que no cambies las etiquetas existentes.
 */
export type AmenityGroup = { key: "place" | "extras" | "ideal"; title: string; items: string[] };

export const AMENITY_GROUPS: AmenityGroup[] = [
  {
    key: "place",
    title: "Amenidades del lugar",
    items: [
      "Internet Inalámbrico",
      "Aire Acondicionado",
      "Calefacción",
      "Agua caliente",
      "Cocina",
      "Piscina",
      "Gimnasio",
      "Jacuzzi",
      "Sauna",
      "Estacionamiento Gratuito",
      "Terraza o balcón",
      "Jardín / Patio",
      "Chimenea Interior",
      "Lavadora",
      "Secadora",
      "Mesa de comedor",
      "Detector de humo",
    ],
  },
  {
    key: "extras",
    title: "Complementos y servicios",
    items: [
      "Refrigerador",
      "Microondas",
      "Cafetera",
      "Televisión",
      "Secadora de pelo",
      "Shampoo",
      "Ropa de cama",
      "Elementos básicos",
      "Botiquín",
      "Desayuno incluido",
    ],
  },
  {
    key: "ideal",
    title: "Ideal para",
    items: ["Amigable Familias/Niños", "Permiten Mascotas"],
  },
];

export const AMENITY_OPTIONS: string[] = AMENITY_GROUPS.flatMap((g) => g.items);

const GROUP_OF = new Map(AMENITY_GROUPS.flatMap((g) => g.items.map((a) => [a, g.key] as const)));

/**
 * Agrupa las comodidades de un anuncio en el orden del catálogo. Las que escribió el
 * anfitrión (o vienen de una importación) y no están en el catálogo van a «Complementos».
 */
export function groupAmenities(amenities: string[]): { key: AmenityGroup["key"]; title: string; items: string[] }[] {
  const order = new Map(AMENITY_OPTIONS.map((a, i) => [a, i]));
  return AMENITY_GROUPS.map((g) => ({
    key: g.key,
    title: g.title,
    items: amenities
      .filter((a) => (GROUP_OF.get(a) ?? "extras") === g.key)
      .sort((a, b) => (order.get(a) ?? 999) - (order.get(b) ?? 999)),
  })).filter((g) => g.items.length > 0);
}
