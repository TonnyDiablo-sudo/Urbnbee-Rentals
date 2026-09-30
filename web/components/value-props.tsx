import { useT } from "@/components/i18n-provider";
import { ScrollReveal } from "@/components/scroll-reveal";

const cards = [
  {
    title: "Autenticidad Verificada",
    body: "Garantizamos anuncios reales mediante verificación cruzada con múltiples plataformas.",
    icon: BadgeCheckIcon,
  },
  {
    title: "Alojamiento a tu Medida",
    body: "Encuentra opciones de hospedaje con precios competitivos y adaptados a tus necesidades.",
    icon: HomeIcon,
  },
  {
    title: "Confianza y Seguridad",
    body: "Todos los anfitriones están verificados para brindarte una experiencia segura.",
    icon: ShieldIcon,
  },
];

export function ValueProps() {
  const t = useT();
  return (
    <section className="bg-white py-14 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-6 sm:grid-cols-3">
          {cards.map((c, i) => {
            const Icon = c.icon;
            return (
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
                    <Icon />
                    <h3 className="text-center text-xl font-semibold text-[#484848]">{t(c.title)}</h3>
                  </div>

                  {/* BACK */}
                  <div
                    className="absolute inset-0 flex flex-col items-center justify-center rounded p-8 [backface-visibility:hidden] [transform:rotateY(180deg)]"
                    style={{ backgroundColor: "#ffffff", border: "1px solid #ebebeb" }}
                  >
                    <h3 className="mb-3 text-center text-lg font-semibold text-[#484848]">{t(c.title)}</h3>
                    <p className="text-center text-sm leading-relaxed text-[#3a3a3a]">{t(c.body)}</p>
                  </div>
                </div>
              </div>
            </ScrollReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function BadgeCheckIcon() {
  return (
    <svg className="h-14 w-14" style={{ color: "#dcb81e" }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg className="h-14 w-14" style={{ color: "#dcb81e" }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg className="h-14 w-14" style={{ color: "#dcb81e" }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
    </svg>
  );
}
