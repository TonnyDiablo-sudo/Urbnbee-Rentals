"use client";

import { useEffect, useState } from "react";
import { WebLink } from "@/app/app/_components/site-origin";
import { useT } from "@/components/i18n-provider";

const URBNBEEAI_SITE = "https://www.urbnbeeai.com";
const DEFAULT_START = "https://www.urbnbeeai.com/integrations/cabibee/start";

type Status = { linked: boolean; startUrl?: string; agentStatus?: { active: boolean } | null };

const PERKS = [
  "Contesta los mensajes de tus anuncios al instante, de día y de noche, en el idioma del huésped.",
  "Resuelve las preguntas repetitivas: la clave del wifi, cómo llegar, a qué hora es el check-in, la tienda o farmacia más cercana, dónde estacionarse.",
  "Cobra por ti: manda el enlace de pago y da seguimiento hasta que el huésped paga.",
  "Coordina tus estancias y tus limpiezas: avisa a quien le toca y confirma cuando el espacio queda listo.",
  "Filtra entre quien de verdad quiere reservar y quien sólo pregunta, para que tú atiendas a los que sí.",
  "Te avisa de lo importante: una emergencia dentro de tu alojamiento o cualquier cosa que tenga que atender una persona.",
  "Usa tus anuncios, fechas, reservas y guía de llegada de Cabibee; tú puedes tomar la conversación cuando quieras.",
];

export function AiAgentCard() {
  const t = useT();
  const [s, setS] = useState<Status | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/host/integrations/beeagent", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => alive && setS(j ?? { linked: false }))
      .catch(() => alive && setS({ linked: false }));
    return () => {
      alive = false;
    };
  }, []);

  const linked = Boolean(s?.linked);

  return (
    <div id="p-ai_agent" className="scroll-mt-20 rounded-2xl border-2 border-[#dcb81e] bg-[#fffbea] p-5 shadow-sm sm:col-span-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[16px] font-semibold text-[#222]">{t("Agente de inteligencia artificial para tus anuncios")}</p>
          <p className="mt-1 text-sm text-[#717171]">{t("Conéctalo con urbnbeeai y deja que atienda a tus huéspedes por ti.")}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
            linked ? "bg-[#e7f5ec] text-[#1e7a3a]" : "bg-[#111] text-[#f4d65c]"
          }`}
        >
          {linked ? t("Conectado") : t("30 días gratis")}
        </span>
      </div>

      <ul className="mt-3 space-y-1.5 text-sm text-[#484848]">
        {PERKS.map((p) => (
          <li key={p} className="flex gap-2">
            <span className="text-[#b8960f]" aria-hidden>
              ✓
            </span>
            <span>{t(p)}</span>
          </li>
        ))}
      </ul>

      {!linked && (
        <p className="mt-3 text-sm font-semibold text-[#222]">
          {t("Pruébalo 30 días gratis. Después decides si sigues con un plan de urbnbeeai.")}
        </p>
      )}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        {linked ? (
          <WebLink
            path="/host/settings/integrations"
            className="inline-flex items-center justify-center rounded-xl bg-[#222] px-5 py-2.5 text-sm font-semibold text-white"
          >
            {t("Administrar mi agente")}
          </WebLink>
        ) : (
          <a
            href={s?.startUrl || DEFAULT_START}
            className="inline-flex items-center justify-center rounded-xl bg-[#dcb81e] px-5 py-2.5 text-sm font-semibold text-black"
          >
            {t("Probar 30 días gratis con urbnbeeai")}
          </a>
        )}
        <a
          href={URBNBEEAI_SITE}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center rounded-xl border border-[#222] px-5 py-2.5 text-sm font-semibold text-[#222]"
        >
          {t("¿Qué es urbnbeeai? Ver urbnbeeai.com")}
        </a>
      </div>
      <p className="mt-2 text-xs text-[#888]">
        {t("urbnbeeai es un servicio aparte de Cabibee; su prueba y sus planes se contratan con urbnbeeai.")}
      </p>
    </div>
  );
}
