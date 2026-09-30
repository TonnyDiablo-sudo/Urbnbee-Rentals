"use client";

import { useT } from "@/components/i18n-provider";
import { ScrollReveal } from "@/components/scroll-reveal";

const points = [
  {
    n: "1",
    title: "Sabes quién te recibe",
    body: "El anfitrión tiene nombre y un perfil que puedes leer antes de reservar.",
  },
  {
    n: "2",
    title: "Ves el lugar antes de ir",
    body: "El anuncio muestra fotos, el precio y las reglas. Nada queda escondido.",
  },
  {
    n: "3",
    title: "Tu reserva queda guardada",
    body: "Queda un registro en Cabibee: quién reservó, cuándo y en qué lugar.",
  },
];

export function WhoWeAre() {
  const t = useT();
  return (
    <section id="quienes-somos" className="bg-white py-14 sm:py-16">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <div className="text-center">
            <h2 className="text-3xl font-normal text-[#000000]">{t("Quiénes somos")}</h2>
            <div className="mx-auto mt-2 h-1" style={{ width: "120px", backgroundColor: "#dcb81e" }} />
            <p className="mt-6 text-xl leading-relaxed text-[#484848]">
              {t("Cabibee es un lugar seguro para hospedarte.")}
            </p>
            <p className="mt-3 text-base leading-relaxed text-[#3a3a3a]">
              {t("Juntamos viajeros con anfitriones. Antes de ir, sabes con quién tratas, cómo es el lugar y tu reserva no se pierde.")}
            </p>
          </div>
        </ScrollReveal>

        <ol className="mt-10 space-y-4">
          {points.map((point, i) => (
            <ScrollReveal key={point.n} delay={i * 80}>
              <li
                className="flex gap-4 rounded bg-white p-5"
                style={{ border: "1px solid #ebebeb" }}
              >
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                  style={{ backgroundColor: "#dcb81e" }}
                >
                  {point.n}
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-[#484848]">{t(point.title)}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-[#3a3a3a]">{t(point.body)}</p>
                </div>
              </li>
            </ScrollReveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
