"use client";

import { useT } from "@/components/i18n-provider";
import { ScrollReveal } from "@/components/scroll-reveal";

const points = [
  {
    n: "1",
    title: "Trato directo, sin comisión",
    body: "No somos intermediarios y no le sumamos nada al precio. El anuncio se publica gratis y el contacto queda a la vista para que anfitrión y huésped se escriban y cierren entre ellos.",
  },
  {
    n: "2",
    title: "Identidad de los dos lados",
    body: "Anfitrión y huésped pueden comprobar su identidad. Antes de cerrar, sabes con quién estás tratando.",
  },
  {
    n: "3",
    title: "Historial crediticio, si se pide",
    body: "El anfitrión puede pedir una revisión de crédito de quien solicita. La paga quien acuerden. No es obligatoria para publicar ni para escribirse.",
  },
  {
    n: "4",
    title: "Herramientas, solo si las quieren",
    body: "Contrato, depósito y ayuda para el pago. Cabibee no cobra la estancia ni le pone un precio encima: el hospedaje se paga entre ustedes. Estas herramientas solo dejan el acuerdo por escrito y más seguro.",
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
            <p className="mt-6 text-xl leading-relaxed text-[#484848]">{t("Conectamos al anfitrión con el huésped. El trato es directo.")}</p>
            <p className="mt-3 text-base leading-relaxed text-[#3a3a3a]">
              {t(
                "Cabibee es la plataforma para quien renta directo y no quiere comisiones. Publicas gratis, la gente te escribe, y ustedes acuerdan. Si quieren más seguridad, ahí están las herramientas: cada quien usa las que necesite."
              )}
            </p>
          </div>
        </ScrollReveal>

        <ol className="mt-10 space-y-4">
          {points.map((point, i) => (
            <ScrollReveal key={point.n} delay={i * 80}>
              <li className="flex gap-4 rounded bg-white p-5" style={{ border: "1px solid #ebebeb" }}>
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
