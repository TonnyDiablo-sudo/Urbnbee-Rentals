"use client";

import { useLang, useT } from "@/components/i18n-provider";
import { TRIAL_DAYS, TRIAL_MAX_COLLABORATORS } from "@/lib/tool-trial";

const COPY = {
  cleaning: {
    anchor: "#p-cleaning_tool",
    title: "Vista previa: tu herramienta de limpieza todavía no está en marcha",
    body: "Configúrala a tu gusto: anuncios, quién limpia, insumos y ajustes. Por ahora no crea limpiezas de tus reservas, no manda avisos ni recordatorios y tu equipo no recibe nada. En cuanto la actives, todo lo que dejaste listo empieza a trabajar.",
  },
  collaborators: {
    anchor: "#p-collaborator_seat",
    title: "Vista previa: tu herramienta de colaboradores todavía no está en marcha",
    body: "Arma tu equipo (hasta {max} personas), dales roles y anuncios, y crea tus chats de equipo. Por ahora tu gente no tiene acceso a reservas ni mensajes y en los chats de equipo no se puede escribir. En cuanto la actives, todo queda andando como lo dejaste.",
  },
  teamChat: {
    anchor: "#p-collaborator_seat",
    title: "Vista previa: en los chats de equipo todavía no se puede escribir",
    body: "Crea los chats que quieras y agrega a tu gente. Para escribir y mandar fotos o audios, activa la herramienta de colaboradores o la de limpieza.",
  },
} as const;

/**
 * Aviso de «vista previa»: la herramienta se configura y se explora, pero no trabaja hasta
 * pagarla o empezar su prueba gratis. Si ya está en prueba, sólo dice hasta cuándo.
 */
export function ToolPreviewNotice({
  tool,
  storeHref = "/tienda",
  trialUsed = false,
  trialEndsAt,
  compact = false,
}: {
  tool: keyof typeof COPY;
  storeHref?: string;
  /** Ya usó su prueba gratis: sólo queda activarla. */
  trialUsed?: boolean;
  /** Si viene, la herramienta está en prueba gratis hasta esa fecha. */
  trialEndsAt?: string;
  compact?: boolean;
}) {
  const t = useT();
  const lang = useLang();
  const copy = COPY[tool];
  if (trialEndsAt) {
    const d = new Date(trialEndsAt).toLocaleDateString(lang === "en" ? "en-US" : "es-MX", { day: "numeric", month: "long", year: "numeric" });
    return (
      <p className="rounded-xl bg-[#e7f5ec] px-4 py-2.5 text-sm text-[#1e5a32]">
        {t("Prueba gratis hasta el {d}. Ese día empieza a cobrarse tu plan; puedes cancelar o cambiar de plazo en la Tienda.", { d })}{" "}
        <a href={`${storeHref}${copy.anchor}`} className="font-semibold underline">
          {t("Ver mi plan")}
        </a>
      </p>
    );
  }
  return (
    <section className={`rounded-2xl border border-[#f0d77a] bg-[#fdf6d8] ${compact ? "p-4" : "p-5"} text-[#5c4a0a]`}>
      <p className="font-semibold">{t(copy.title)}</p>
      <p className="mt-1 text-sm">{t(copy.body, { max: TRIAL_MAX_COLLABORATORS })}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {!trialUsed && (
          <a href={`${storeHref}${copy.anchor}`} className="rounded-xl bg-[#222] px-4 py-2 text-sm font-semibold text-white">
            {t("Probar {n} días gratis", { n: TRIAL_DAYS })}
          </a>
        )}
        <a href={`${storeHref}${copy.anchor}`} className="rounded-xl border border-[#222] px-4 py-2 text-sm font-semibold text-[#222]">
          {t("Activar en la Tienda")}
        </a>
      </div>
      {!trialUsed && (
        <p className="mt-2 text-xs">{t("La prueba pide tarjeta, pero no se cobra nada hasta que termina. Cancela cuando quieras.")}</p>
      )}
    </section>
  );
}
