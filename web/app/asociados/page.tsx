import Link from "next/link";
import { DayBars } from "@/components/associates/day-bars";
import { listDraftsForAssociate } from "@/lib/associate-drafts-store";
import { getAssociateStats } from "@/lib/associate-stats";
import { getT } from "@/lib/i18n/server";
import { getSessionUser } from "@/lib/session";

export default async function AssociatesHome() {
  const user = (await getSessionUser())!;
  const t = await getT();
  const drafts = listDraftsForAssociate(user.id, "pending");
  const s = getAssociateStats(user, 14);
  const left = Math.max(0, s.goal - s.today);
  const pct = s.goal ? Math.min(100, Math.round((s.today / s.goal) * 100)) : 0;

  return (
    <div className="space-y-10">
      <section className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-6">
          {s.goal > 0 ? (
            <>
              <p className="text-sm font-medium text-amber-800">{t("Hoy tocan")}</p>
              <p className="mt-1 text-5xl font-bold text-gray-900">
                {s.today}
                <span className="text-2xl font-semibold text-gray-400"> / {s.goal}</span>
              </p>
              <p className="mt-1 text-sm text-gray-600">{t("cuentas nuevas creadas hoy")}</p>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-amber-100">
                <div className={`h-full rounded-full ${left === 0 ? "bg-green-500" : "bg-amber-500"}`} style={{ width: `${pct}%` }} />
              </div>
              <p className={`mt-2 text-sm font-medium ${left === 0 ? "text-green-700" : "text-gray-700"}`}>
                {left === 0 ? t("¡Meta del día cumplida! 🎉") : t("Te faltan {count} para la meta de hoy.", { count: left })}
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-amber-800">{t("Hoy")}</p>
              <p className="mt-1 text-5xl font-bold text-gray-900">{s.today}</p>
              <p className="mt-1 text-sm text-gray-600">{t("cuentas nuevas creadas hoy")}</p>
              <p className="mt-3 text-xs text-gray-500">{t("Todavía no tienes meta diaria asignada.")}</p>
            </>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/asociados/capturar" className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600">
              {t("+ Agregar anuncio")}
            </Link>
            <Link href="/asociados/celular" className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm">
              📱 {t("Desde el celular")}
            </Link>
            <Link href="/asociados/extension" className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm">
              💻 {t("Extensión")}
            </Link>
          </div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <DayBars days={s.days} goal={s.goal} title={t("Últimos 14 días")} />
          <p className="mt-3 text-xs text-gray-500">
            {s.goal > 0
              ? t("Verde: llegaste a la meta. Línea punteada: tu meta diaria.")
              : t("Cuentas nuevas por día.")}
          </p>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label={t("Ayer")} value={s.yesterday} />
        <Stat label={t("Últimos 7 días")} value={s.last7} />
        <Stat label={t("Este mes")} value={s.month} />
        <Stat label={t("Cuentas en total")} value={s.total} />
        <Stat label={t("Anuncios publicados")} value={s.totalListings} />
        <Stat label={t("Reclamadas por el dueño")} value={s.claimed} />
      </section>
      {s.goal > 0 && (
        <p className="-mt-6 text-xs text-gray-500">
          {t("Cumpliste la meta {count} de los últimos 30 días.", { count: s.goalDays30 })}
        </p>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {t("Por revisar")} {drafts.length > 0 && <span className="text-gray-400">({drafts.length})</span>}
          </h2>
        </div>
        {drafts.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-500">
            {t("Nada pendiente. Importa un anuncio con la extensión de Chrome o sube capturas.")}
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {drafts.map((d) => (
              <li key={d.id}>
                <Link href={`/asociados/borradores/${d.id}`} className="flex gap-3 rounded-xl border border-gray-200 bg-white p-3 hover:border-amber-400">
                  {d.photos[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={d.photos[0]} alt="" className="h-16 w-20 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <div className="h-16 w-20 shrink-0 rounded-lg bg-gray-100" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900">{d.listing.title}</p>
                    <p className="truncate text-xs text-gray-500">
                      {[d.listing.city, d.contact.hostName].filter(Boolean).join(" · ") || t("Sin ciudad")}
                    </p>
                    <p className="mt-1 text-xs text-gray-400">
                      {d.source.site ?? (d.source.kind === "screenshots" ? t("Capturas") : d.source.kind)} ·{" "}
                      {t("{count} fotos", { count: d.photos.length })}
                      {d.aiFilled?.length ? <span className="text-red-600"> · {t("{count} por aprobar", { count: d.aiFilled.length })}</span> : null}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="mt-1 text-xs text-gray-500">{label}</p>
    </div>
  );
}
