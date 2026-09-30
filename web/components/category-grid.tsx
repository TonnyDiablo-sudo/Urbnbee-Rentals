import { useT } from "@/components/i18n-provider";
import { ScrollReveal } from "@/components/scroll-reveal";
import { countListingsForTipo } from "@/lib/mock-data";

const categories = [
  {
    label: "Habitaciones",
    count: 2,
    href: "/alojamientos?tipo=habitaciones",
    bg: "https://images.unsplash.com/photo-1734599505058-6653a0d8d3ff?w=800&q=80",
  },
  {
    label: "Casas",
    count: 6,
    href: "/alojamientos?tipo=casas",
    bg: "https://images.unsplash.com/photo-1542718610-a1d656d1884c?w=800&q=80",
  },
  {
    label: "Departamentos",
    count: 8,
    href: "/alojamientos?tipo=departamentos",
    bg: "https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=800&q=80",
  },
  {
    label: "Viñedos",
    count: 2,
    href: "/alojamientos?tipo=vinedos",
    bg: "https://images.unsplash.com/photo-1722027992154-61bd31954f65?w=800&q=80",
  },
  {
    label: "Cabañas",
    count: 2,
    href: "/alojamientos?tipo=cabanas",
    bg: "https://images.unsplash.com/photo-1449158743715-0a90ebb6d2d8?w=800&q=80",
  },
  {
    label: "Vistas increíbles",
    count: 6,
    href: "/alojamientos?tipo=vistas",
    bg: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80",
  },
  {
    label: "Tropical",
    count: 3,
    href: "/alojamientos?tipo=tropical",
    bg: "https://images.unsplash.com/photo-1540541338287-41700207dee6?w=800&q=80",
  },
  {
    label: "Frente al mar",
    count: 3,
    href: "/alojamientos?tipo=mar",
    bg: "https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?w=800&q=80",
  },
  {
    label: "Albercas",
    count: 2,
    href: "/alojamientos?tipo=albercas",
    bg: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80",
  },
];

export function CategoryGrid() {
  const t = useT();
  return (
    <section className="bg-white py-14 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Heading with gold underline */}
        <ScrollReveal>
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-normal text-[#000000]">{t("Encuentra tu estilo de viaje")}</h2>
            <div className="mx-auto mt-2 h-1" style={{ width: "200px", backgroundColor: "#dcb81e" }} />
          </div>
        </ScrollReveal>

        {/* 3-column grid of photo tiles */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((cat, i) => (
            <ScrollReveal key={cat.label} delay={i * 60}>
              <a
                href={cat.href}
                className="group relative block overflow-hidden"
                style={{ height: "220px" }}
              >
                {/* Background photo */}
                <div
                  className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-110"
                  style={{ backgroundImage: `url(${cat.bg})` }}
                />
                {/* Overlay */}
                <div className="absolute inset-0 bg-black/40 transition-opacity duration-300 group-hover:bg-black/55" />
                {/* Text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center">
                  <h4 className="text-xl font-semibold text-white drop-shadow-md">{t(cat.label)}</h4>
                  <div className="text-sm font-light text-white/80 drop-shadow-sm">
                    {countListingsForTipo(new URLSearchParams(cat.href.split("?")[1] ?? "").get("tipo") ?? "")}{" "}
                    {t("Listados")}
                  </div>
                </div>
              </a>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
