"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useLang, useT } from "@/components/i18n-provider";

type Term = { code: string; months: number; amount: number; perMonth: number };

type Item = {
  family: string;
  label: string;
  description: string;
  details: string[];
  currency: "mxn" | "usd";
  audience: "guest" | "host";
  unit?: "listing" | "seat";
  terms: Term[];
  owned?: { status: string; quantity?: number; until?: string; cancelAtPeriodEnd?: boolean; renews?: boolean; code?: string };
};

/** Dónde se administra cada herramienta: a qué anuncios aplica y quién la usa. */
const MANAGE: Record<string, { app: string; web: string }> = {
  booking_engine: { app: "/host/motor", web: "/host/verificacion" },
  cleaning_tool: { app: "/host/limpieza", web: "/host/limpieza" },
  collaborator_seat: { app: "/host/colaboradores", web: "/host/colaboradores" },
  address_proof: { app: "/host/motor", web: "/host/verificacion" },
};

type Data = { region: "mx" | "us"; isHost: boolean; items: Item[] };

function money(n: number, currency: "mxn" | "usd") {
  return `$${n.toLocaleString(currency === "usd" ? "en-US" : "es-MX", { maximumFractionDigits: 2 })} ${currency.toUpperCase()}`;
}

export function StoreView({ surface }: { surface: "web" | "app" }) {
  const t = useT();
  const lang = useLang();
  const day = (iso: string) =>
    new Date(iso).toLocaleDateString(lang === "en" ? "en-US" : "es-MX", { day: "numeric", month: "long", year: "numeric" });
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [term, setTerm] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/store", { cache: "no-store" }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) setErr(typeof j.error === "string" ? j.error : "No se pudo cargar la tienda.");
    else setData(j as Data);
  }, []);

  useEffect(() => {
    const id = setTimeout(() => void load(), 0);
    return () => clearTimeout(id);
  }, [load]);

  const returnPath = "/tienda";

  const chosenTerm = (item: Item) =>
    item.terms.find((x) => x.code === (item.owned?.code ?? term[item.family])) ?? item.terms[0];

  async function buy(item: Item) {
    const plan = chosenTerm(item);
    setBusy(item.family);
    setMsg(null);
    const quantity = item.unit ? (qty[item.family] ?? 1) : 1;
    const res = await fetch("/api/verification/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: plan.code, quantity, region: data?.region, returnPath, cancelPath: returnPath }),
    }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : {};
    setBusy(null);
    if (!res?.ok) return setMsg({ ok: false, text: typeof j.error === "string" ? j.error : "No se pudo iniciar el cobro." });
    if (typeof j.checkoutUrl === "string") return window.location.assign(j.checkoutUrl);
    setMsg({ ok: true, text: "Listo, ya está activo." });
    void load();
  }

  async function changeQuantity(item: Item, quantity: number) {
    setBusy(item.family);
    setMsg(null);
    const res = await fetch("/api/store/quantity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: chosenTerm(item).code, quantity }),
    }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : {};
    setBusy(null);
    if (!res?.ok) return setMsg({ ok: false, text: typeof j.error === "string" ? j.error : "No se pudo cambiar." });
    setMsg({ ok: true, text: "Cantidad actualizada. La diferencia se prorratea en tu próxima factura." });
    void load();
  }

  async function setRenewal(item: Item, resume: boolean) {
    if (
      !resume &&
      !window.confirm(
        t("¿Cancelar la renovación? Lo que ya pagaste no se devuelve: sigues usando el plan hasta el fin del período y ese día termina.")
      )
    ) {
      return;
    }
    setBusy(item.family);
    setMsg(null);
    const res = await fetch("/api/store/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ family: item.family, resume }),
    }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : {};
    setBusy(null);
    if (!res?.ok) return setMsg({ ok: false, text: typeof j.error === "string" ? j.error : "No se pudo cambiar la renovación." });
    setMsg({
      ok: true,
      text: resume ? "Listo, tu plan se volverá a renovar solo." : "Listo, tu plan ya no se renovará. Sigue activo hasta el fin del período.",
    });
    void load();
  }

  if (err) return <p className="px-5 py-8 text-sm text-red-700">{t(err)}</p>;
  if (!data) return <p className="px-5 py-8 text-sm text-[#999]">{t("Cargando…")}</p>;

  const accountItems = data.items.filter((i) => i.family === "guest_membership");
  const guestItems = data.items.filter((i) => i.audience === "guest" && i.family !== "guest_membership");
  const hostItems = data.items.filter((i) => i.audience === "host");

  const card = (item: Item) => {
    const unitLabel = item.unit === "listing" ? t("por anuncio") : item.unit === "seat" ? t("por colaborador") : "";
    const plan = chosenTerm(item);
    const q = qty[item.family] ?? item.owned?.quantity ?? 1;
    const owned = item.owned;
    const monthly = item.terms.find((x) => x.months === 1);
    const charge =
      plan.months === 0
        ? t("pago único")
        : plan.months === 1
          ? item.unit && q > 1
            ? t("pagas {total} cada mes", { total: money(plan.amount * q, item.currency) })
            : t("se cobra cada mes")
          : t("pagas {total} cada {n} meses", { total: money(plan.amount * (item.unit ? q : 1), item.currency), n: plan.months });
    return (
      <div key={item.family} className="rounded-2xl border border-[#e5e5e5] bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[16px] font-semibold text-[#222]">{t(item.label)}</p>
            <p className="mt-1 text-sm text-[#717171]">{t(item.description)}</p>
          </div>
          {owned && (
            <span className="shrink-0 rounded-full bg-[#e7f5ec] px-2.5 py-1 text-xs font-semibold text-[#1e7a3a]">
              {owned.quantity && item.unit ? t("Tienes {n}", { n: owned.quantity }) : t("Activo")}
            </span>
          )}
        </div>

        {!owned && item.terms.length > 1 && (
          <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label={t("Plazo")}>
            {item.terms.map((x) => {
              const save = monthly && x.months > 1 ? Math.round((1 - x.perMonth / monthly.perMonth) * 100) : 0;
              const on = x.code === plan.code;
              return (
                <button
                  key={x.code}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setTerm((p) => ({ ...p, [item.family]: x.code }))}
                  className={`rounded-xl border px-3 py-1.5 text-sm ${on ? "border-[#222] bg-[#222] text-white" : "border-[#ddd] bg-white text-[#222]"}`}
                >
                  {x.months === 1 ? t("1 mes") : t("{n} meses", { n: x.months })}
                  {save > 0 && <span className={on ? "text-[#f4d65c]" : "text-[#1e7a3a]"}> −{save}%</span>}
                </button>
              );
            })}
          </div>
        )}

        {(!owned || owned.code || plan.months === 0) && (
          <>
            <p className="mt-3 text-[20px] font-bold text-[#222]">
              {money(plan.perMonth, item.currency)}{" "}
              <span className="text-sm font-normal text-[#717171]">
                {[unitLabel, plan.months ? t("al mes") : ""].filter(Boolean).join(" · ")}
              </span>
            </p>
            <p className="text-xs text-[#888]">{charge}</p>
          </>
        )}

        <button
          type="button"
          onClick={() => setOpen(open === item.family ? null : item.family)}
          className="mt-2 text-sm font-semibold text-[#222] underline"
        >
          {open === item.family ? t("Ocultar") : t("¿Qué incluye?")}
        </button>
        {open === item.family && (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#484848]">
            {item.details.map((d) => (
              <li key={d}>{t(d)}</li>
            ))}
          </ul>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {item.unit && (!owned || owned.quantity !== undefined) && (
            <div className="flex items-center rounded-xl border border-[#ccc]">
              <button
                type="button"
                aria-label={t("Menos")}
                disabled={q <= 1}
                onClick={() => setQty((p) => ({ ...p, [item.family]: Math.max(1, q - 1) }))}
                className="h-10 w-10 text-lg disabled:opacity-30"
              >
                −
              </button>
              <span className="min-w-8 text-center text-[15px] font-semibold">{q}</span>
              <button
                type="button"
                aria-label={t("Más")}
                onClick={() => setQty((p) => ({ ...p, [item.family]: Math.min(200, q + 1) }))}
                className="h-10 w-10 text-lg"
              >
                +
              </button>
            </div>
          )}
          {owned && item.unit && owned.quantity !== undefined ? (
            <button
              type="button"
              disabled={busy !== null || q === owned.quantity}
              onClick={() => void changeQuantity(item, q)}
              className="rounded-xl bg-[#222] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            >
              {busy === item.family ? t("Guardando…") : t("Cambiar a {n}", { n: q })}
            </button>
          ) : owned && plan.months > 0 ? null : (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void buy(item)}
              className="rounded-xl bg-[#dcb81e] px-5 py-2.5 text-sm font-semibold text-black disabled:opacity-40"
            >
              {busy === item.family
                ? t("Abriendo pago…")
                : item.unit && q > 1
                  ? t("Comprar {n}", { n: q })
                  : t("Comprar")}
            </button>
          )}
        </div>

        {owned && owned.status !== "cancelled" && item.family !== "guest_pass" && (
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[#f0f0f0] pt-3 text-sm">
            <span className={owned.cancelAtPeriodEnd ? "text-[#b45309]" : "text-[#717171]"}>
              {owned.until
                ? owned.cancelAtPeriodEnd
                  ? t("Se cancela el {d}", { d: day(owned.until) })
                  : owned.renews
                    ? t("Se renueva solo el {d}", { d: day(owned.until) })
                    : t("Activo hasta el {d}", { d: day(owned.until) })
                : t("Activo")}
            </span>
            {MANAGE[item.family] && (
              <Link href={MANAGE[item.family][surface]} className="font-semibold text-[#222] underline">
                {t("Administrar")}
              </Link>
            )}
            {owned.renews && (
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void setRenewal(item, owned.cancelAtPeriodEnd === true)}
                className="font-semibold text-[#222] underline disabled:opacity-40"
              >
                {owned.cancelAtPeriodEnd ? t("Seguir con el plan") : t("Cancelar renovación")}
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={surface === "app" ? "space-y-6 px-5 pb-12 pt-4" : "space-y-8"}>
      {msg && (
        <p className={`rounded-xl px-4 py-3 text-sm ${msg.ok ? "bg-[#e7f5ec] text-[#1e5a32]" : "bg-red-50 text-red-700"}`}>
          {t(msg.text)}
        </p>
      )}
      <p className="text-sm text-[#717171]">
        {t("Tu cuenta básica de Cabibee es gratis. Elige el plazo de cada herramienta: entre más largo, más barato por mes.")}
      </p>

      {accountItems.length > 0 && (
        <section>
          <h2 className="mb-1 text-lg font-semibold text-[#222]">{t("Tu cuenta")}</h2>
          <p className="mb-3 text-sm text-[#717171]">
            {t("Una sola verificación de identidad por persona: vale como huésped y como anfitrión.")}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">{accountItems.map(card)}</div>
        </section>
      )}

      {data.isHost && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-[#222]">{t("Para anfitriones")}</h2>
          {hostItems.length ? (
            <div className="grid gap-4 sm:grid-cols-2">{hostItems.map(card)}</div>
          ) : (
            <p className="text-sm text-[#999]">{t("Pronto habrá herramientas aquí.")}</p>
          )}
        </section>
      )}

      {guestItems.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-[#222]">{t("Para huéspedes")}</h2>
          <div className="grid gap-4 sm:grid-cols-2">{guestItems.map(card)}</div>
        </section>
      )}

      {!data.isHost && (
        <p className="text-sm text-[#717171]">
          {t("¿Rentas un espacio? Cambia tu cuenta a anfitrión para ver el motor de reservas, la herramienta de limpieza y los colaboradores.")}
        </p>
      )}
    </div>
  );
}
