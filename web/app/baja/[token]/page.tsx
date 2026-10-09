import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { findOutreachByToken } from "@/lib/associate-outreach-store";
import { getT } from "@/lib/i18n/server";
import { findUserById, listListingsForHost } from "@/lib/marketplace-store";
import { OptOutButton } from "./opt-out-button";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Quitar mi anuncio de Cabibee"), robots: { index: false } };
}

export default async function OptOutPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const rec = findOutreachByToken(token);
  const host = rec ? findUserById(rec.hostId) : undefined;
  if (!rec || !host) notFound();
  const t = await getT();
  const listings = listListingsForHost(host.id);
  const done = Boolean(rec.optedOutAt);

  return (
    <>
      <SiteHeader />
      <div className="mx-auto max-w-md px-4 pb-16" style={{ paddingTop: 104 }}>
        <h1 className="text-2xl font-semibold text-[#484848]">{t("Quitar mi anuncio de Cabibee")}</h1>
        {host.claimedAt ? (
          <p className="mt-3 text-sm leading-relaxed text-[#717171]">
            {t("Ya entraste a tu cuenta, así que tú decides: desde tu panel puedes ocultar o borrar tus anuncios cuando quieras.")}
          </p>
        ) : (
          <>
            <p className="mt-3 text-sm leading-relaxed text-[#717171]">
              {t("Publicamos gratis estos anuncios para que más huéspedes te encuentren. Si no quieres aparecer, los quitamos y no te volvemos a escribir.")}
            </p>
            <ul className="mt-4 list-disc pl-5 text-sm text-[#484848]">
              {listings.map((l) => (
                <li key={l.id}>{l.title}</li>
              ))}
            </ul>
            <OptOutButton token={token} done={done} />
          </>
        )}
      </div>
      <SiteFooter />
    </>
  );
}
