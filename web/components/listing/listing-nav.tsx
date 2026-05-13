"use client";
import { useEffect, useState } from "react";

const TABS = [
  { id: "descripcion", label: "Descripción" },
  { id: "precio", label: "Precio" },
  { id: "detalles", label: "Detalles" },
  { id: "comodidades", label: "Comodidades" },
  { id: "propietario", label: "Propietario" },
  { id: "mapa", label: "Mapa" },
];

export function ListingNav() {
  const [active, setActive] = useState("descripcion");
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 520);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTo = (id: string) => {
    setActive(id);
    const el = document.getElementById(`section-${id}`);
    if (el) {
      const offset = 130;
      window.scrollTo({ top: el.offsetTop - offset, behavior: "smooth" });
    }
  };

  return (
    <div
      className="z-40 border-b bg-white transition-shadow"
      style={{
        position: stuck ? "fixed" : "relative",
        top: stuck ? "72px" : undefined,
        left: stuck ? 0 : undefined,
        right: stuck ? 0 : undefined,
        boxShadow: stuck ? "0 2px 8px rgba(0,0,0,0.08)" : undefined,
        borderColor: "#ebebeb",
      }}
    >
      <div className="mx-auto flex max-w-7xl overflow-x-auto px-4 sm:px-6 lg:px-8">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => scrollTo(tab.id)}
            className="shrink-0 border-b-2 px-5 py-4 text-sm font-medium transition-colors"
            style={{
              borderColor: active === tab.id ? "#dcb81e" : "transparent",
              color: active === tab.id ? "#dcb81e" : "#484848",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
