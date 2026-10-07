import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { translatePlanLabel } from "@/lib/plan-label";
import { numberLocale, type TFn } from "@/lib/i18n";
import { getLang, getT } from "@/lib/i18n/server";
import {
  membershipPublicPlans,
  type MembershipPublicPlan,
} from "@/lib/membership-plans-store";
import { ensurePublicCatalogFresh } from "@/lib/urbnbeeai-catalog-sync";
import { verificationRegionFromHeaders } from "@/lib/verification-region";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("Membresía de huésped"),
  };
}

function priceLabel(plan: MembershipPublicPlan, locale: string): string {
  const currency = plan.currency === "usd" ? "USD" : "MXN";
  return `$${plan.amount.toLocaleString(locale, { maximumFractionDigits: 0 })} ${currency}`;
}

function cadenceLabel(plan: MembershipPublicPlan, t: TFn, locale: string): string {
  if (plan.billing.kind === "one_time") return t("un solo pago, una reserva");
  const perMonth = plan.amount / plan.billing.intervalCount;
  return t("cada {n} meses · ≈ ${amount} por mes", {
    n: plan.billing.intervalCount,
    amount: perMonth.toLocaleString(locale, { maximumFractionDigits: 0 }),
  });
}

export default async function MembresiaPublicPage() {
  const region = verificationRegionFromHeaders(await headers());
  await ensurePublicCatalogFresh();
  const plans = membershipPublicPlans(region, "guest");
  const t = await getT();
  const locale = numberLocale(await getLang());

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 pb-16 pt-24 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-semibold text-[#222]">{t("Membresía de verificación de huésped")}</h1>
        <p className="mt-4 text-sm leading-relaxed text-[#484848]">
          {t("Cabibee conecta viajeros con anfitriones verificados. Para solicitar reservas dentro de la plataforma necesitas una membresía activa —o un pase por reserva— y completar la verificación de identidad: identificación oficial y selfie, comprobadas contra bases de datos oficiales.")}
        </p>

        {plans.length > 0 && (
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {plans.map((p) => (
              <div key={p.code} className="rounded-xl border border-[#ebebeb] bg-white p-5 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wider text-[#aaa]">{translatePlanLabel(p.label, t)}</p>
                <p className="mt-3 text-2xl font-semibold text-[#222]">{priceLabel(p, locale)}</p>
                <p className="mt-1 text-xs text-[#888]">{cadenceLabel(p, t, locale)}</p>
                {p.description && (
                  <p className="mt-3 text-sm leading-relaxed text-[#484848]">{t(p.description)}</p>
                )}
              </div>
            ))}
          </div>
        )}

        <ul className="mt-8 list-inside list-disc space-y-2 text-sm text-[#484848]">
          <li>{t("Un pase para quien viaja una vez, o membresía de 6 y 12 meses para quien viaja seguido.")}</li>
          <li>{t("Con identidad verificada el chat te deja mandar fotos y notas de voz.")}</li>
          <li>{t("Incluye el traductor automático del chat: lo que te escriben lo lees en tu idioma y lo que escribes puedes mandarlo en el idioma de la otra persona.")}</li>
          <li>{t("Gestión de pago y cancelación en el portal de facturación.")}</li>
          <li>{t("Tu identificación no se guarda en nuestros servidores: se comprueba contra bases de datos oficiales y sólo guardamos el resultado.")}</li>
        </ul>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/register?next=/guest/membresia"
            className="inline-flex items-center justify-center rounded-lg bg-black px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#222]"
          >
            {t("Crear cuenta")}
          </Link>
          <Link
            href="/login?next=/guest/membresia"
            className="inline-flex items-center justify-center rounded-lg border border-[#ddd] bg-white px-6 py-3 text-sm font-semibold text-[#222] transition hover:bg-[#fafafa]"
          >
            {t("Ya tengo cuenta — ir a membresía")}
          </Link>
        </div>

        <p className="mt-10 text-xs text-[#aaa]">
          {t("¿Anfitrión? Publica desde «Enviar propiedad». La membresía de esta página es para huéspedes que reservan en Cabibee.")}
        </p>
      </main>
    </>
  );
}
