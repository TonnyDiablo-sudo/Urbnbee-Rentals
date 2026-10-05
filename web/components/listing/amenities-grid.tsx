"use client";
import { useState } from "react";
import { useT } from "@/components/i18n-provider";
import { groupAmenities } from "@/lib/amenity-options";

const ICONS: Record<string, string> = {
  "Aire Acondicionado": "❄️", "Agua caliente": "🚿", "Internet Inalámbrico": "📶",
  "Cocina": "🍳", "Lavadora": "🫧", "Secadora": "♨️", "Televisión": "📺",
  "Chimenea Interior": "🔥", "Terraza o balcón": "🌅", "Estacionamiento Gratuito": "🅿️",
  "Detector de humo": "🚨", "Botiquín": "🩹", "Ropa de cama": "🛏️", "Calefacción": "🌡️",
  "Refrigerador": "🧊", "Microondas": "📡", "Cafetera": "☕", "Plancha": "👔",
  "Secadora de pelo": "💨", "Shampoo": "🧴", "Jabón corporal": "🧼",
  "Elementos básicos": "✅", "Artículos Esenciales": "🗂️", "Mesa de comedor": "🪑",
  "Sistema de sonido": "🔊", "Caja fuerte": "🔒", "Amigable Familias/Niños": "👨‍👩‍👧",
  "Desayuno incluido": "🥐", "Jardín / Patio": "🌿", "Permiten Mascotas": "🐾",
  "Alberca": "🏊", "Piscina": "🏊", "Gimnasio": "💪", "Jacuzzi": "🛁", "Sauna": "🧖", "Internet": "🌐",
  "Patio": "🌿", "Asador": "🍖", "Bicicletas": "🚲", "Kayak": "🛶",
};

export function AmenitiesGrid({ amenities }: { amenities: string[] }) {
  const t = useT();
  const [showAll, setShowAll] = useState(false);
  const LIMIT = 12;
  const groups = groupAmenities(amenities);
  const limit = showAll ? Infinity : LIMIT;
  const visible = groups
    .map((g, i) => {
      const before = groups.slice(0, i).reduce((n, x) => n + x.items.length, 0);
      return { ...g, items: g.items.slice(0, Math.max(0, limit - before)) };
    })
    .filter((g) => g.items.length > 0);

  return (
    <div className="space-y-5">
      {visible.map((g) => (
        <div key={g.key}>
          {groups.length > 1 && <h3 className="mb-2 text-sm font-semibold text-[#484848]">{t(g.title)}</h3>}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {g.items.map((a) => (
              <div key={a} className="flex items-center gap-2 text-sm text-[#3a3a3a]">
                <span className="text-base">{ICONS[a] ?? "•"}</span>
                <span>{t(a)}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
      {amenities.length > LIMIT && (
        <button
          type="button"
          onClick={() => setShowAll(!showAll)}
          className="mt-6 border px-6 py-2 text-sm font-medium text-[#484848] transition hover:border-[#dcb81e] hover:text-[#dcb81e]"
          style={{ borderColor: "#ebebeb" }}
        >
          {showAll
            ? t("Mostrar menos")
            : t("Ver todas las {n} comodidades", { n: amenities.length })}
        </button>
      )}
    </div>
  );
}
