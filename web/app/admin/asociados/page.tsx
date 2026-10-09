import Link from "next/link";
import { DayBars } from "@/components/associates/day-bars";
import { getAllAssociateStats, lastMxDays, mxDay } from "@/lib/associate-stats";
import { getT } from "@/lib/i18n/server";
import { listAllUsers, listListingsForHost } from "@/lib/marketplace-store";
import { autopilotSettings, MAX_SITE_LIMIT } from "@/lib/associate-autopilot";
import { AssociateRow, CreateAssociateForm } from "./associates-client";
import { formatPhone, MAX_PER_PHONE_DAILY, PHONE_COUNTRIES, phoneUsesToday } from "@/lib/autopilot-phones";
import { getAutopilotPhonesDoc } from "@/lib/autopilot-phones-store";
import { AutopilotLimitsForm } from "./autopilot-limits";
import { AutopilotPhonesForm } from "./autopilot-phones";

export const dynamic = "force-dynamic";

export default async function AdminAssociatesPage() {
  const t = await getT();
  const rows = getAllAssociateStats(14);
  const users = listAllUsers();
  const nameById = new Map(users.map((u) => [u.id, u.fullName || u.email]));
  const provisioned = users.filter((u) => u.provisionedBy);
  const organicHosts = users.filter((u) => u.role === "host" && !u.provisionedBy).length;

  const team = rows.reduce(
    (acc, { associate: a, stats: s }) => ({
      today: acc.today + s.today,
      goal: acc.goal + (a.associate ? s.goal : 0),
      yesterday: acc.yesterday + s.yesterday,
      last7: acc.last7 + s.last7,
      last30: acc.last30 + s.last30,
      total: acc.total + s.total,
      claimed: acc.claimed + s.claimed,
      pending: acc.pending + s.pendingDrafts,
    }),
    { today: 0, goal: 0, yesterday: 0, last7: 0, last30: 0, total: 0, claimed: 0, pending: 0 }
  );
  const teamDays = lastMxDays(14).map((day) => ({
    day,
    accounts: rows.reduce((n, r) => n + (r.stats.days.find((d) => d.day === day)?.accounts ?? 0), 0),
    listings: rows.reduce((n, r) => n + (r.stats.days.find((d) => d.day === day)?.listings ?? 0), 0),
  }));
  const recent = provisioned.slice(0, 25);
  const phonesDoc = getAutopilotPhonesDoc();
  const phoneUses = phoneUsesToday();

  return (
    <div className="space-y-8 p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">{t("Asociados")}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {t("Cuentas de anfitrión que crean los asociados con IA. Los días se cuentan en hora de la Ciudad de México.")}
        </p>
        <Link href="/asociados/avisar" className="mt-2 inline-block text-sm font-medium text-amber-700 underline">
          {t("Ver «Por avisar» de todos los asociados →")}
        </Link>
      </div>

      <section className="grid gap-4 lg:grid-cols-[1fr_1.3fr]">
        <div className="grid grid-cols-2 gap-3">
          <Stat label={t("Hoy (equipo)")} value={team.goal ? `${team.today} / ${team.goal}` : team.today} />
          <Stat label={t("Ayer")} value={team.yesterday} />
          <Stat label={t("Últimos 7 días")} value={team.last7} />
          <Stat label={t("Últimos 30 días")} value={team.last30} />
          <Stat label={t("Total creadas por asociados")} value={team.total} />
          <Stat
            label={t("Reclamadas por el dueño")}
            value={team.total ? `${team.claimed} (${Math.round((team.claimed / team.total) * 100)}%)` : team.claimed}
          />
          <Stat label={t("Anfitriones orgánicos")} value={organicHosts} />
          <Stat label={t("Borradores sin publicar")} value={team.pending} />
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <DayBars days={teamDays} goal={team.goal} title={t("Cuentas creadas por día (equipo)")} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">{t("Por asociado")}</h2>
        {rows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-500">
            {t("Todavía no hay asociados. Da de alta el primero abajo.")}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs text-gray-500">
                  <th className="px-4 py-2 font-medium">{t("Asociado")}</th>
                  <th className="px-3 py-2 font-medium">{t("Meta diaria")}</th>
                  <th className="px-3 py-2 font-medium">{t("Hoy")}</th>
                  <th className="px-3 py-2 font-medium">{t("Ayer")}</th>
                  <th className="px-3 py-2 font-medium">{t("7 días")}</th>
                  <th className="px-3 py-2 font-medium">{t("30 días")}</th>
                  <th className="px-3 py-2 font-medium">{t("Total")}</th>
                  <th className="px-3 py-2 font-medium">{t("Anuncios")}</th>
                  <th className="px-3 py-2 font-medium">{t("Reclamadas")}</th>
                  <th className="px-3 py-2 font-medium">{t("Borradores")}</th>
                  <th className="px-3 py-2 font-medium">{t("Meta cumplida (30 d)")}</th>
                  <th className="px-3 py-2 font-medium">{t("Última alta")}</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map(({ associate: a, stats: s }) => (
                  <AssociateRow
                    key={a.id}
                    id={a.id}
                    name={a.fullName || a.email}
                    email={a.email}
                    active={Boolean(a.associate) || a.role === "admin"}
                    isAdmin={a.role === "admin"}
                    plus={Boolean(a.associatePlus) || a.role === "admin"}
                    stats={s}
                    lastCreated={s.lastCreatedAt ? mxDay(s.lastCreatedAt) : "—"}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <AutopilotLimitsForm limits={autopilotSettings().limits} max={MAX_SITE_LIMIT} />
      <AutopilotPhonesForm
        phones={phonesDoc.phones.map((p) => ({
          id: p.id,
          label: formatPhone(p),
          countryName: PHONE_COUNTRIES[p.country]?.name ?? `+${p.country}`,
          active: p.active,
          usedToday: phoneUses.get(p.id) ?? 0,
        }))}
        emails={phonesDoc.emails.map((e) => ({
          id: e.id,
          email: e.email,
          name: e.name,
          active: e.active,
          usedToday: phoneUses.get(e.id) ?? 0,
        }))}
        formName={phonesDoc.formName}
        formEmail={phonesDoc.formEmail}
        perPhoneDaily={phonesDoc.perPhoneDaily}
        maxPerPhone={MAX_PER_PHONE_DAILY}
      />

      <section className="grid gap-6 lg:grid-cols-2">
        <CreateAssociateForm />
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-900">{t("Últimas cuentas creadas por asociados")}</h2>
          {recent.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">{t("Ninguna todavía.")}</p>
          ) : (
            <ul className="mt-3 divide-y divide-gray-50 text-sm">
              {recent.map((u) => (
                <li key={u.id} className="flex items-center gap-3 py-2">
                  <span className="w-20 shrink-0 text-xs text-gray-400">{mxDay(u.createdAt)}</span>
                  <Link href={`/admin/users/${u.id}`} className="min-w-0 flex-1 truncate font-medium text-gray-900 underline">
                    {u.fullName}
                  </Link>
                  <span className="shrink-0 text-xs text-gray-500">
                    {t("por {name}", { name: nameById.get(u.provisionedBy!) ?? "?" })}
                  </span>
                  <span className="shrink-0 text-xs text-gray-400">{t("{count} anuncios", { count: listListingsForHost(u.id).length })}</span>
                  {u.claimedAt ? (
                    <span className="shrink-0 rounded bg-green-100 px-1.5 py-0.5 text-[10px] text-green-700">{t("Reclamada")}</span>
                  ) : (
                    <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">{t("Sin reclamar")}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
          <Link href="/admin/users?origen=asociado" className="mt-3 inline-block text-xs text-amber-700 underline">
            {t("Ver todas en Usuarios →")}
          </Link>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="mt-1 text-xs text-gray-500">{label}</p>
    </div>
  );
}
