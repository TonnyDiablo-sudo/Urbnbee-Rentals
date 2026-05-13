import { ScrollReveal } from "@/components/scroll-reveal";

const cards = [
  {
    title: "Autenticidad Verificada",
    body: "Garantizamos anuncios reales mediante verificación cruzada con múltiples plataformas.",
    icon: "https://urbnbee.com/wp-content/uploads/2025/02/URBNBEE-AUTENTICIDAD-VERIFICADA-ICONO.png",
  },
  {
    title: "Alojamiento a tu Medida",
    body: "Encuentra opciones de hospedaje con precios competitivos y adaptados a tus necesidades.",
    icon: "https://urbnbee.com/wp-content/uploads/2025/02/URBNBEE-ALOJAMIENTO-A-TU-MEDIDA-ICONO.png",
  },
  {
    title: "Confianza y Seguridad",
    body: "Todos los anfitriones están verificados para brindarte una experiencia segura.",
    icon: "https://urbnbee.com/wp-content/uploads/2025/02/URBNBEE-CONFIANZA-Y-SEGURIDAD-ICONO.png",
  },
];

export function ValueProps() {
  return (
    <section className="bg-white py-14 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-6 sm:grid-cols-3">
          {cards.map((c, i) => (
            <ScrollReveal key={c.title} delay={i * 100}>
              {/* Flip card */}
              <div className="group" style={{ perspective: "1000px", height: "220px" }}>
                <div
                  className="relative h-full w-full transition-transform duration-500 [transform-style:preserve-3d] group-hover:[transform:rotateY(180deg)]"
                >
                  {/* FRONT */}
                  <div
                    className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded bg-white p-8 shadow-sm [backface-visibility:hidden]"
                    style={{ border: "1px solid #ebebeb" }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.icon} alt="" className="h-14 w-14 object-contain" aria-hidden />
                    <h3 className="text-center text-xl font-semibold text-[#484848]">{c.title}</h3>
                  </div>

                  {/* BACK */}
                  <div
                    className="absolute inset-0 flex flex-col items-center justify-center rounded p-8 [backface-visibility:hidden] [transform:rotateY(180deg)]"
                    style={{ backgroundColor: "#ffffff", border: "1px solid #ebebeb" }}
                  >
                    <h3 className="mb-3 text-center text-lg font-semibold text-[#484848]">{c.title}</h3>
                    <p className="text-center text-sm leading-relaxed text-[#3a3a3a]">{c.body}</p>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
