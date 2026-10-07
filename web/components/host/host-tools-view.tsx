import Link from "next/link";
import { addressCoveredListingIds, addressProofSlots, listingShowsLocationBadge } from "@/lib/address-proof-access";
import { engineCapacity, engineListingIds, engineSlots } from "@/lib/booking-engine-slots";
import { featuredCapacity, featuredListingIds } from "@/lib/featured-slots";
import { cleaningCapacity, cleaningListingIds, cleaningSlots } from "@/lib/cleaning-service";
import { getListingCleaner } from "@/lib/cleaning-store";
import { publicNameOf } from "@/lib/display-name";
import { getHostEntitlement } from "@/lib/host-entitlements-store";
import {
  HOST_SKU_ADDRESS_PROOF,
  HOST_SKU_BOOKING_ENGINE,
  HOST_SKU_CLEANING,
  HOST_SKU_COLLABORATORS,
  HOST_SKU_FEATURED,
  hostEntitlementInTrial,
  type HostEntitlementRecord,
} from "@/lib/host-entitlement-types";
import type { Lang, TFn } from "@/lib/i18n";
import { findUserById, listListingsForHost } from "@/lib/marketplace-store";
import { collaboratorSeats, collaboratorSeatsUsed, hostHasCleaningTool, memberEffectiveRoles } from "@/lib/team-access";
import { getTeamMember, listTeamForHost, memberNeedsSeat, TEAM_ROLE_LABEL } from "@/lib/team-store";
import { TRIAL_MAX_COLLABORATORS } from "@/lib/tool-trial";
import { identityPlanActive, isHostIdentityVerified } from "@/lib/verification-store";

type Surface = "app" | "web";

const PATHS: Record<string, Record<Surface, string>> = {
  engine: { app: "/host/motor", web: "/host/verificacion" },
  cleaning: { app: "/host/limpieza", web: "/host/limpieza" },
  team: { app: "/host/colaboradores", web: "/host/colaboradores" },
  address: { app: "/host/motor", web: "/host/verificacion" },
  identity: { app: "/host/motor", web: "/host/verificacion" },
  featured: { app: "/host/destacados", web: "/host/destacados" },
};

function Card({
  title,
  status,
  usage,
  children,
  manage,
  buy,
  t,
}: {
  title: string;
  status: { on: boolean; text: string };
  usage?: string;
  children?: React.ReactNode;
  manage?: string;
  buy: string;
  t: TFn;
}) {
  return (
    <section className="rounded-2xl border border-[#ebebeb] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-[16px] font-semibold text-[#222]">{title}</h2>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
            status.on ? "bg-[#e7f5ec] text-[#1e7a3a]" : "bg-[#f3f3f3] text-[#717171]"
          }`}
        >
          {status.text}
        </span>
      </div>
      {usage && <p className="mt-1 text-sm text-[#717171]">{usage}</p>}
      {children && <div className="mt-3">{children}</div>}
      <div className="mt-4 flex flex-wrap gap-2">
        {manage && (
          <Link href={manage} className="rounded-xl bg-[#222] px-4 py-2 text-sm font-semibold text-white">
            {t("Administrar")}
          </Link>
        )}
        <Link href={buy} className="rounded-xl border border-[#ccc] px-4 py-2 text-sm font-semibold text-[#222]">
          {status.on ? t("Agregar más en la Tienda") : t("Ver en la Tienda")}
        </Link>
      </div>
    </section>
  );
}

function Rows({ rows, empty }: { rows: { key: string; title: string; detail?: string }[]; empty: string }) {
  if (!rows.length) return <p className="text-sm text-[#999]">{empty}</p>;
  return (
    <ul className="divide-y divide-[#f0f0f0] rounded-xl bg-[#fafafa]">
      {rows.map((r) => (
        <li key={r.key} className="px-3 py-2">
          <p className="line-clamp-1 text-sm text-[#222]">{r.title}</p>
          {r.detail && <p className="text-xs text-[#888]">{r.detail}</p>}
        </li>
      ))}
    </ul>
  );
}

/** Resumen de cada herramienta pagada: cuántos lugares hay, qué anuncios y qué personas la usan. */
export function HostToolsView({ hostId, t, lang, surface }: { hostId: string; t: TFn; lang: Lang; surface: Surface }) {
  const listings = listListingsForHost(hostId);
  const titleOf = new Map(listings.map((l) => [l.id, l.title || t("Sin título")]));
  const byId = new Map(listings.map((l) => [l.id, l]));
  const day = (iso?: string) =>
    iso
      ? new Date(iso).toLocaleDateString(lang === "en" ? "en-US" : "es-MX", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "";
  const statusOf = (row: HostEntitlementRecord | undefined, active: boolean, preview = false) => {
    if (!active || !row) return { on: false, text: preview ? t("Vista previa") : t("Sin contratar") };
    if (hostEntitlementInTrial(row) && row.trialEndsAt && !row.cancelAtPeriodEnd) {
      return { on: true, text: t("Prueba gratis hasta el {d}", { d: day(row.trialEndsAt) }) };
    }
    if (row.cancelAtPeriodEnd && row.currentPeriodEnd) {
      return { on: true, text: t("Termina el {d}", { d: day(row.currentPeriodEnd) }) };
    }
    if (row.currentPeriodEnd) return { on: true, text: t("Se renueva el {d}", { d: day(row.currentPeriodEnd) }) };
    return { on: true, text: t("Activo") };
  };
  const memberName = (id: string) => {
    if (id === "host") return t("Yo");
    const m = getTeamMember(id);
    const u = m?.userId ? findUserById(m.userId) : undefined;
    return (u && publicNameOf(u)) || m?.email || "—";
  };
  const store = "/tienda";

  const engineRow = getHostEntitlement(hostId, HOST_SKU_BOOKING_ENGINE);
  const engineCap = engineCapacity(hostId);
  const engineOn = engineListingIds(hostId);

  const cleaningRow = getHostEntitlement(hostId, HOST_SKU_CLEANING);
  const cleaningActive = hostHasCleaningTool(hostId);
  const cleaningOn = cleaningListingIds(hostId);

  const seatRow = getHostEntitlement(hostId, HOST_SKU_COLLABORATORS);
  const seats = collaboratorSeats(hostId);
  const team = listTeamForHost(hostId);

  const addressRow = getHostEntitlement(hostId, HOST_SKU_ADDRESS_PROOF);
  const addressSlots = addressProofSlots(hostId);
  const covered = addressCoveredListingIds(hostId);

  const featuredRow = getHostEntitlement(hostId, HOST_SKU_FEATURED);
  const featuredCap = featuredCapacity(hostId);
  const featuredOn = featuredListingIds(hostId);

  const identityOn = identityPlanActive(hostId);
  const identityChecked = isHostIdentityVerified(hostId);

  return (
    <div className="space-y-4">
      <Card
        t={t}
        title={t("Motor de reservas")}
        status={statusOf(engineRow, engineCap !== 0)}
        usage={
          engineCap === "all"
            ? t("Tu suscripción cubre todos tus anuncios.")
            : engineCap > 0
              ? t("Usas {used} de {cap} lugares pagados.", { used: engineSlots(hostId).length, cap: engineCap })
              : undefined
        }
        manage={engineCap !== 0 ? PATHS.engine[surface] : undefined}
        buy={store}
      >
        {engineCap !== 0 && (
          <Rows
            rows={[...engineOn].map((id) => ({ key: id, title: titleOf.get(id) ?? id }))}
            empty={t("Todavía no eliges anuncios. Entra a Administrar y enciéndelos.")}
          />
        )}
      </Card>

      <Card
        t={t}
        title={t("Herramienta de limpieza")}
        status={statusOf(cleaningRow, cleaningActive, true)}
        usage={
          cleaningActive
            ? t("Usas {used} de {cap} anuncios pagados.", { used: cleaningSlots(hostId).length, cap: cleaningCapacity(hostId) })
            : t("Puedes configurarla y explorarla; trabaja cuando la actives o empieces su prueba gratis.")
        }
        manage={PATHS.cleaning[surface]}
        buy={store}
      >
        {cleaningActive && (
          <Rows
            rows={[...cleaningOn].map((id) => {
              const who = getListingCleaner(id);
              return {
                key: id,
                title: titleOf.get(id) ?? id,
                detail: who ? t("Limpia: {name}", { name: memberName(who) }) : t("Sin quien limpie asignado"),
              };
            })}
            empty={t("Todavía no agregas anuncios. Entra a Administrar y agrégalos.")}
          />
        )}
      </Card>

      <Card
        t={t}
        title={t("Colaboradores")}
        status={statusOf(seatRow, seats > 0, true)}
        usage={
          seats > 0
            ? t("Usas {used} de {paid} asientos de colaborador.", { used: collaboratorSeatsUsed(hostId), paid: seats })
            : t("Arma tu equipo (hasta {max}) y sus chats; tienen acceso cuando la actives o empieces su prueba gratis.", {
                max: TRIAL_MAX_COLLABORATORS,
              })
        }
        manage={PATHS.team[surface]}
        buy={store}
      >
        {(seats > 0 || team.length > 0) && (
          <Rows
            rows={team.map((m) => {
              const roles = memberEffectiveRoles(m);
              const scope =
                m.listingIds === "all"
                  ? t("Todos los anuncios")
                  : m.listingIds.map((id) => titleOf.get(id) ?? id).join(", ");
              return {
                key: m.id,
                title: `${memberName(m.id)}${m.status === "pending" ? ` · ${t("Invitación pendiente")}` : ""}`,
                detail: `${(roles.length ? roles : m.roles).map((r) => t(TEAM_ROLE_LABEL[r])).join(" · ")}${
                  memberNeedsSeat(m.roles) ? "" : ` (${t("sin asiento")})`
                } — ${scope}`,
              };
            })}
            empty={t("Todavía no invitas a nadie.")}
          />
        )}
      </Card>

      <Card
        t={t}
        title={t("Verificación de domicilio")}
        status={
          addressSlots > 0
            ? statusOf(addressRow, true)
            : covered.size > 0
              ? { on: true, text: t("Incluida en el motor") }
              : { on: false, text: t("Viene con el motor de reservas") }
        }
        usage={addressSlots > 0 ? t("{n} anuncios con verificación de domicilio pagada.", { n: addressSlots }) : undefined}
        manage={PATHS.address[surface]}
        buy={store}
      >
        <Rows
          rows={[...covered].map((id) => {
            const l = byId.get(id);
            const badge = l ? listingShowsLocationBadge(l) : false;
            return {
              key: id,
              title: titleOf.get(id) ?? id,
              detail: !badge
                ? t("Falta subir el comprobante")
                : engineOn.has(id)
                  ? t("Ubicación verificada · incluida en el motor")
                  : t("Ubicación verificada · pagada aparte"),
            };
          })}
          empty={t("Ningún anuncio está cubierto todavía.")}
        />
      </Card>

      <Card
        t={t}
        title={t("Anuncio destacado")}
        status={statusOf(featuredRow, featuredCap > 0)}
        usage={
          featuredCap > 0
            ? t("Usas {used} de {cap} lugares pagados.", { used: featuredOn.size, cap: featuredCap })
            : t("Tu anuncio aparece primero en las búsquedas, con la etiqueta «Destacado».")
        }
        manage={featuredCap > 0 ? PATHS.featured[surface] : undefined}
        buy={store}
      >
        {featuredCap > 0 && (
          <Rows
            rows={[...featuredOn].map((id) => ({ key: id, title: titleOf.get(id) ?? id }))}
            empty={t("Todavía no eliges anuncios. Entra a Administrar y enciéndelos.")}
          />
        )}
      </Card>

      <Card
        t={t}
        title={t("Verificación de identidad")}
        status={identityOn ? { on: true, text: t("Activa") } : { on: false, text: t("Sin contratar") }}
        usage={
          identityOn
            ? identityChecked
              ? t("Tus anuncios llevan el listón «Miembro verificado».")
              : t("Falta comprobar tu identidad para que aparezca el listón.")
            : t("Una por persona: vale como huésped y como anfitrión.")
        }
        manage={PATHS.identity[surface]}
        buy={store}
      />
    </div>
  );
}
