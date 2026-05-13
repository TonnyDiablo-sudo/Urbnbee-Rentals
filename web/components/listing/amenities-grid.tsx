"use client";
import { useState } from "react";

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
  "Alberca": "🏊", "Gimnasio": "💪", "Jacuzzi": "🛁", "Internet": "🌐",
  "Patio": "🌿", "Asador": "🍖", "Bicicletas": "🚲", "Kayak": "🛶",
};

export function AmenitiesGrid({ amenities }: { amenities: string[] }) {
  const [showAll, setShowAll] = useState(false);
  const LIMIT = 12;
  const visible = showAll ? amenities : amenities.slice(0, LIMIT);

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {visible.map((a) => (
          <div key={a} className="flex items-center gap-2 text-sm text-[#3a3a3a]">
            <span className="text-base">{ICONS[a] ?? "•"}</span>
            <span>{a}</span>
          </div>
        ))}
      </div>
      {amenities.length > LIMIT && (
        <button
          type="button"
          onClick={() => setShowAll(!showAll)}
          className="mt-6 border px-6 py-2 text-sm font-medium text-[#484848] transition hover:border-[#dcb81e] hover:text-[#dcb81e]"
          style={{ borderColor: "#ebebeb" }}
        >
          {showAll
            ? "Mostrar menos"
            : `Ver todas las ${amenities.length} comodidades`}
        </button>
      )}
    </div>
  );
}
