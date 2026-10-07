"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLang, useT } from "@/components/i18n-provider";
import { CountryPicker, PhoneBox, VerifyEmailBox, type BillingCountry } from "@/components/account/purchase-prereqs";
import { AiAgentCard } from "@/components/store/ai-agent-card";

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
  owned?: {
    status: string;
    quantity?: number;
    until?: string;
    cancelAtPeriodEnd?: boolean;
    renews?: boolean;
    code?: string;
    /** En prueba gratis hasta esta fecha; ese día se cobra por primera vez. */
    trialEndsAt?: string;
  };
  /** Puede empezar la prueba gratis (una sola por herramienta). */
  trial?: { days: number; maxQuantity?: number };
  /** Aviso que va arriba del precio (por ejemplo: «el motor ya la incluye»). */
  notice?: string;
  demand?: { occupancy: number; multiplier: number; soldOut: boolean; slotsLeft: number };
};

/** Dónde se administra cada herramienta: a qué anuncios aplica y quién la usa. */
const MANAGE: Record<string, { app: string; web: string }> = {
  booking_engine: { app: "/host/motor", web: "/host/verificacion" },
  cleaning_tool: { app: "/host/limpieza", web: "/host/limpieza" },
  collaborator_seat: { app: "/host/colaboradores", web: "/host/colaboradores" },
  address_proof: { app: "/host/motor", web: "/host/verificacion" },
  featured_listing: { app: "/host/destacados", web: "/host/destacados" },
};

type Data = {
  region: "mx" | "us";
  billingCountry: BillingCountry | null;
  emailVerified: boolean;
  hasPhone: boolean;
  placeholderEmail: boolean;
  email: string;
  isHost: boolean;
  items: Item[];
  promo?: { banner: Ribbon; ribbons: Record<string, Ribbon>; discountPct?: number };
};

type Ribbon = { on: boolean; text: string };

type CartEntry = { family: string; code: string; quantity: number };
type CartResult = { ok: boolean; lines: { code: string; ok: boolean; error?: string; trial?: boolean }[]; error?: string; trial?: boolean };

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

const CART_KEY = "cb_store_cart";

function readCart(): CartEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(window.localStorage.getItem(CART_KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((x) => x && typeof x.family === "string" && typeof x.code === "string") : [];
  } catch {
    return [];
  }
}

function money(n: number, currency: "mxn" | "usd") {
  return `$${n.toLocaleString(currency === "usd" ? "en-US" : "es-MX", { maximumFractionDigits: 2 })} ${currency.toUpperCase()}`;
}

function CartIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M3 4h2l2.4 11.2a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.5-1.1L21 8H6.2" />
      <circle cx="9.5" cy="20" r="1.2" />
      <circle cx="17.5" cy="20" r="1.2" />
    </svg>
  );
}

/** Listón diagonal en la esquina de la tarjeta. No cambia lo que se cobra. */
export function PromoRibbon({ text }: { text: string }) {
  return (
    <div
      className={`pointer-events-none absolute -right-11 top-4 w-40 rotate-45 bg-[#dcb81e] py-1 text-center font-bold uppercase leading-tight tracking-wide text-black shadow ${
        Array.from(text).length <= 6 ? "text-[13px]" : "text-[10px]"
      }`}
    >
      <span className="block truncate px-6">{text}</span>
    </div>
  );
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
  const [cart, setCartState] = useState<CartEntry[]>(readCart);
  const [cartOpen, setCartOpen] = useState(false);
  /** Diálogo de prueba gratis abierto para esta familia. */
  const [trialFor, setTrialFor] = useState<string | null>(null);
  /** Tarjeta en modo «cambiar plazo» para esta familia. */
  const [changing, setChanging] = useState<string | null>(null);
  const returnHandled = useRef(false);

  const setCart = useCallback((update: (prev: CartEntry[]) => CartEntry[]) => {
    setCartState((prev) => {
      const next = update(prev);
      try {
        window.localStorage.setItem(CART_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

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

  /** /tienda#p-collaborator_seat lleva directo al producto (las tarjetas cargan después). */
  useEffect(() => {
    if (!data || !window.location.hash.startsWith("#p-")) return;
    document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [data]);

  const returnPath = "/tienda";

  /** Al regresar de Stripe: activa lo pagado y lo saca del carrito. */
  useEffect(() => {
    const url = new URL(window.location.href);
    const sessionId = url.searchParams.get("session_id");
    const cartDone = url.searchParams.get("cart") === "done";
    const single = url.searchParams.get("subscription") === "success";
    if ((!cartDone && !single) || returnHandled.current) return;
    returnHandled.current = true;
    window.history.replaceState(null, "", url.pathname + url.hash);
    setTimeout(async () => {
      if (!cartDone || !sessionId) {
        setCart(() => []);
        setMsg({ ok: true, text: "Listo, tu compra quedó activa." });
        return;
      }
      setBusy("cart");
      const res = await fetch("/api/store/cart/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      }).catch(() => null);
      const j = (res ? await res.json().catch(() => ({})) : {}) as Partial<CartResult>;
      setBusy(null);
      const lines = Array.isArray(j.lines) ? j.lines : [];
      if (!res?.ok || lines.length === 0) {
        setMsg({ ok: false, text: typeof j.error === "string" ? j.error : "No pudimos confirmar el pago. Recarga en un momento." });
        return;
      }
      const paid = new Set(lines.filter((l) => l.ok).map((l) => l.code));
      setCart((prev) => prev.filter((c) => !paid.has(c.code)));
      const failed = lines.filter((l) => !l.ok);
      setMsg(
        failed.length === 0
          ? j.trial
            ? { ok: true, text: "Tu prueba gratis ya empezó: la herramienta está en marcha. Hoy no se cobró nada." }
            : { ok: true, text: "Listo, tu compra quedó activa." }
          : { ok: false, text: failed[0].error ?? "No se pudo cobrar este producto." }
      );
      void load();
    }, 0);
  }, [setCart, load]);

  /** El plazo que se muestra: el elegido en la tarjeta o, si ya lo tiene, el que paga. */
  const chosenTerm = (item: Item) =>
    item.terms.find((x) => x.code === (term[item.family] ?? item.owned?.code)) ?? item.terms[0];

  /** Lo del carrito que todavía se puede comprar (los precios y lo que ya tienes vienen del servidor). */
  const cartLines = (data?.items ?? []).flatMap((item) => {
    const entry = cart.find((c) => c.family === item.family);
    const plan = entry && item.terms.find((x) => x.code === entry.code);
    if (!entry || !plan || (item.owned && item.owned.status !== "cancelled")) return [];
    const quantity = item.unit ? Math.max(1, entry.quantity) : 1;
    return [{ item, plan, quantity, total: plan.amount * quantity }];
  });
  const cartTotal = cartLines.reduce((s, l) => s + l.total, 0);
  const cartCurrency = cartLines[0]?.item.currency ?? "mxn";

  function addToCart(item: Item) {
    const plan = chosenTerm(item);
    const quantity = item.unit ? (qty[item.family] ?? 1) : 1;
    setCart((prev) => [...prev.filter((c) => c.family !== item.family), { family: item.family, code: plan.code, quantity }]);
    setMsg(null);
  }

  function removeFromCart(family: string) {
    setCart((prev) => prev.filter((c) => c.family !== family));
  }

  async function checkout() {
    if (cartLines.length === 0 || !data?.billingCountry || !data.emailVerified || !data.hasPhone) return;
    setBusy("cart");
    setMsg(null);
    const one = cartLines.length === 1 ? cartLines[0] : null;
    const res = await fetch(one ? "/api/verification/checkout" : "/api/store/cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        one
          ? { plan: one.plan.code, quantity: one.quantity, region: data?.region, returnPath, cancelPath: returnPath }
          : { items: cartLines.map((l) => ({ plan: l.plan.code, quantity: l.quantity })), region: data?.region, returnPath }
      ),
    }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) {
      setBusy(null);
      if (j.code === "email_unverified" || j.code === "email_placeholder" || j.code === "country_required") {
        void load();
        return;
      }
      setCartOpen(false);
      return setMsg({ ok: false, text: typeof j.error === "string" ? j.error : "No se pudo iniciar el cobro." });
    }
    if (typeof j.checkoutUrl === "string") return window.location.assign(j.checkoutUrl);
    setBusy(null);
    setCartOpen(false);
    setCart(() => []);
    setMsg({ ok: true, text: "Listo, tu compra quedó activa." });
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

  async function startTrial(item: Item) {
    if (!data?.billingCountry || !data.emailVerified || !data.hasPhone) return;
    const plan = chosenTerm(item);
    const quantity = item.unit ? Math.min(item.trial?.maxQuantity ?? 200, qty[item.family] ?? 1) : 1;
    setBusy("trial");
    setMsg(null);
    const res = await fetch("/api/store/trial", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: plan.code, quantity, region: data.region, returnPath }),
    }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) {
      setBusy(null);
      if (j.code === "email_unverified" || j.code === "email_placeholder" || j.code === "country_required") {
        void load();
        return;
      }
      setTrialFor(null);
      return setMsg({ ok: false, text: typeof j.error === "string" ? j.error : "No se pudo iniciar la prueba gratis." });
    }
    if (typeof j.checkoutUrl === "string") return window.location.assign(j.checkoutUrl);
    setBusy(null);
    setTrialFor(null);
    setMsg({ ok: true, text: "Tu prueba gratis ya empezó: la herramienta está en marcha. Hoy no se cobró nada." });
    void load();
  }

  async function changePlan(item: Item) {
    const plan = chosenTerm(item);
    setBusy(item.family);
    setMsg(null);
    const res = await fetch("/api/store/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: plan.code }),
    }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : {};
    setBusy(null);
    if (!res?.ok) return setMsg({ ok: false, text: typeof j.error === "string" ? j.error : "No se pudo cambiar el plan." });
    setChanging(null);
    setTerm((p) => {
      const next = { ...p };
      delete next[item.family];
      return next;
    });
    setMsg({
      ok: true,
      text:
        typeof j.effectiveAt === "string"
          ? j.inTrial
            ? t("Listo. Al terminar tu prueba el {d} se cobra el plan de {n} meses.", { d: day(j.effectiveAt), n: plan.months })
            : t("Listo. Tu plan actual sigue hasta el {d}; ese día se renueva con el plan de {n} meses.", { d: day(j.effectiveAt), n: plan.months })
          : "Listo, tu plan cambió.",
    });
    void load();
  }

  async function setRenewal(item: Item, resume: boolean) {
    const inTrial = Boolean(item.owned?.trialEndsAt);
    if (
      !resume &&
      !window.confirm(
        inTrial
          ? t("¿Cancelar la prueba gratis? La herramienta se apaga hoy mismo y no se te cobra nada.")
          : t("¿Cancelar la renovación? Lo que ya pagaste no se devuelve: sigues usando el plan hasta el fin del período y ese día termina.")
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
      text: resume
        ? "Listo, tu plan se volverá a renovar solo."
        : j.immediate
          ? "Listo, tu prueba gratis terminó. No se te cobró nada."
          : "Listo, tu plan ya no se renovará. Sigue activo hasta el fin del período.",
    });
    void load();
  }

  if (err) return <p className="px-5 py-8 text-sm text-red-700">{t(err)}</p>;
  if (!data) return <p className="px-5 py-8 text-sm text-[#999]">{t("Cargando…")}</p>;

  const trialItem = trialFor ? (data.items.find((i) => i.family === trialFor && i.trial && !i.owned) ?? null) : null;
  const trialPlan: Term = trialItem ? chosenTerm(trialItem) : { code: "", months: 1, amount: 0, perMonth: 0 };
  const trialMax = trialItem?.trial?.maxQuantity ?? 200;
  const trialQty = trialItem?.unit ? Math.min(trialMax, qty[trialItem.family] ?? 1) : 1;
  const trialTotal = trialItem ? trialPlan.amount * trialQty : 0;
  const trialEnd = addDays(new Date(), trialItem?.trial?.days ?? 30);

  const accountItems = data.items.filter((i) => i.family === "guest_membership");
  const guestItems = data.items.filter((i) => i.audience === "guest" && i.family !== "guest_membership");
  const hostItems = data.items.filter((i) => i.audience === "host");
  const pct = data.promo?.discountPct ?? 0;
  /** Precio antes del descuento, redondeado a pesos (o centavos en USD) para que se vea fijo. */
  const originalOf = (n: number, currency: "mxn" | "usd") => {
    const raw = n / (1 - pct / 100);
    return currency === "usd" ? Math.round(raw * 100) / 100 : Math.round(raw);
  };

  const card = (item: Item) => {
    const unitLabel = item.unit === "listing" ? t("por anuncio") : item.unit === "seat" ? t("por colaborador") : "";
    const owned = item.owned;
    const inCart = owned ? undefined : cart.find((c) => c.family === item.family);
    const plan = owned || term[item.family] || !inCart ? chosenTerm(item) : (item.terms.find((x) => x.code === inCart.code) ?? chosenTerm(item));
    const q = qty[item.family] ?? item.owned?.quantity ?? inCart?.quantity ?? 1;
    /** El plazo que de verdad paga hoy (aunque esté eligiendo otro). */
    const ownedPlan = item.terms.find((x) => x.code === owned?.code) ?? plan;
    const monthly = item.terms.find((x) => x.months === 1);
    const demand = item.demand;
    const maxQty = demand ? (owned?.quantity ?? 0) + demand.slotsLeft : 200;
    const soldOut = Boolean(demand && !owned && demand.soldOut);
    const charge =
      plan.months === 0
        ? t("pago único")
        : plan.months === 1
          ? item.unit && q > 1
            ? t("pagas {total} cada mes", { total: money(plan.amount * q, item.currency) })
            : t("se cobra cada mes")
          : t("pagas {total} cada {n} meses", { total: money(plan.amount * (item.unit ? q : 1), item.currency), n: plan.months });
    const ribbon = data.promo?.ribbons[item.family];
    const onSale = Boolean(ribbon?.on && ribbon.text && pct > 0);
    return (
      <div
        key={item.family}
        id={`p-${item.family}`}
        className="relative scroll-mt-20 overflow-hidden rounded-2xl border border-[#e5e5e5] bg-white p-5 shadow-sm"
      >
        {ribbon?.on && ribbon.text && <PromoRibbon text={t(ribbon.text)} />}
        <div className={`flex items-start justify-between gap-3 ${ribbon?.on && ribbon.text ? "pr-16" : ""}`}>
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

        {item.notice && !owned && (
          <p className="mt-3 rounded-xl border border-[#f0d77a] bg-[#fdf6d8] px-3 py-2 text-sm text-[#5c4a0a]">{t(item.notice)}</p>
        )}

        {(!owned || changing === item.family) && item.terms.length > 1 && (
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
            {onSale && plan.perMonth > 0 && (
              <p className="mt-3 text-sm text-[#717171]">
                {t("Precio original")}{" "}
                <span className="line-through">{money(originalOf(plan.perMonth, item.currency), item.currency)}</span>
              </p>
            )}
            <p className={`${onSale && plan.perMonth > 0 ? "mt-0.5" : "mt-3"} text-[20px] font-bold text-[#222]`}>
              {onSale && plan.perMonth > 0 && (
                <span className="mr-1.5 rounded-md bg-[#dcb81e] px-1.5 py-0.5 align-middle text-[11px] font-bold uppercase text-black">
                  {t("Con descuento")}
                </span>
              )}
              {money(plan.perMonth, item.currency)}{" "}
              <span className="text-sm font-normal text-[#717171]">
                {[unitLabel, plan.months ? t("al mes") : ""].filter(Boolean).join(" · ")}
              </span>
            </p>
            <p className="text-xs text-[#888]">{charge}</p>
          </>
        )}
        {demand && (
          <p className={`mt-2 text-xs font-medium ${demand.soldOut ? "text-red-700" : "text-[#8a6d00]"}`}>
            {demand.soldOut
              ? t("Agotado por ahora. Vuelve en unos días.")
              : demand.multiplier > 1.005
                ? t("Mucha demanda: +{p}% sobre el precio normal · quedan {n} lugares", {
                    p: Math.round((demand.multiplier - 1) * 100),
                    n: demand.slotsLeft,
                  })
                : t("Quedan {n} lugares", { n: demand.slotsLeft })}
          </p>
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
            {item.trial && (
              <li>
                {item.trial.maxQuantity
                  ? t("Pruébala {n} días gratis (hasta {max} colaboradores). Pedimos tarjeta pero no se cobra nada hasta que termina la prueba; cancela cuando quieras.", {
                      n: item.trial.days,
                      max: item.trial.maxQuantity,
                    })
                  : t("Pruébala {n} días gratis. Pedimos tarjeta pero no se cobra nada hasta que termina la prueba; cancela cuando quieras.", {
                      n: item.trial.days,
                    })}
              </li>
            )}
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
                disabled={q >= maxQty}
                onClick={() => setQty((p) => ({ ...p, [item.family]: Math.min(maxQty, q + 1) }))}
                className="h-10 w-10 text-lg disabled:opacity-30"
              >
                +
              </button>
            </div>
          )}
          {owned && changing === item.family && owned.code && plan.code !== owned.code ? (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void changePlan(item)}
              className="rounded-xl bg-[#222] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            >
              {busy === item.family ? t("Guardando…") : t("Cambiar al plan de {n} meses", { n: plan.months })}
            </button>
          ) : owned && item.unit && owned.quantity !== undefined ? (
            <button
              type="button"
              disabled={busy !== null || q === owned.quantity}
              onClick={() => void changeQuantity(item, q)}
              className="rounded-xl bg-[#222] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            >
              {busy === item.family ? t("Guardando…") : t("Cambiar a {n}", { n: q })}
            </button>
          ) : owned && plan.months > 0 ? null : inCart && inCart.code === plan.code && (!item.unit || inCart.quantity === q) ? (
            <>
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-[#1e7a3a] bg-[#e7f5ec] px-4 py-2.5 text-sm font-semibold text-[#1e5a32]">
                <CartIcon className="h-4 w-4" />
                {t("En tu carrito")}
              </span>
              <button type="button" onClick={() => removeFromCart(item.family)} className="text-sm font-semibold text-[#222] underline">
                {t("Quitar")}
              </button>
            </>
          ) : soldOut ? (
            <span className="rounded-xl bg-[#f1f1f1] px-5 py-2.5 text-sm font-semibold text-[#717171]">{t("Agotado")}</span>
          ) : (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => addToCart(item)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#dcb81e] px-5 py-2.5 text-sm font-semibold text-black disabled:opacity-40"
            >
              <CartIcon className="h-4 w-4" />
              {inCart ? t("Actualizar carrito") : t("Agregar al carrito")}
            </button>
          )}
          {!owned && !soldOut && item.trial && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => {
                setMsg(null);
                setTrialFor(item.family);
              }}
              className="rounded-xl border border-[#222] px-5 py-2.5 text-sm font-semibold text-[#222] disabled:opacity-40"
            >
              {t("Probar {n} días gratis", { n: item.trial.days })}
            </button>
          )}
        </div>
        {!owned && !soldOut && item.trial && (
          <p className="mt-2 text-xs text-[#888]">
            {t("La prueba pide tarjeta, pero no se cobra nada hasta que termina. Cancela cuando quieras.")}
          </p>
        )}

        {owned && owned.status !== "cancelled" && item.family !== "guest_pass" && (
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[#f0f0f0] pt-3 text-sm">
            <span className={owned.cancelAtPeriodEnd ? "text-[#b45309]" : "text-[#717171]"}>
              {owned.trialEndsAt && !owned.cancelAtPeriodEnd
                ? ownedPlan.months === 1
                  ? t("Prueba gratis hasta el {d}. Ese día se cobran {total} y después cada mes.", {
                      d: day(owned.trialEndsAt),
                      total: money(ownedPlan.amount * (item.unit ? (owned.quantity ?? 1) : 1), item.currency),
                    })
                  : t("Prueba gratis hasta el {d}. Ese día se cobran {total} y después cada {n} meses.", {
                      d: day(owned.trialEndsAt),
                      total: money(ownedPlan.amount * (item.unit ? (owned.quantity ?? 1) : 1), item.currency),
                      n: ownedPlan.months,
                    })
                : owned.until
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
            {owned.renews && !owned.cancelAtPeriodEnd && owned.code && item.terms.length > 1 && (
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => {
                  setChanging(changing === item.family ? null : item.family);
                  setTerm((p) => {
                    const next = { ...p };
                    delete next[item.family];
                    return next;
                  });
                }}
                className="font-semibold text-[#222] underline disabled:opacity-40"
              >
                {changing === item.family ? t("Dejar el plazo actual") : t("Cambiar plazo")}
              </button>
            )}
            {owned.renews && (
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void setRenewal(item, owned.cancelAtPeriodEnd === true)}
                className="font-semibold text-[#222] underline disabled:opacity-40"
              >
                {owned.cancelAtPeriodEnd ? t("Seguir con el plan") : owned.trialEndsAt ? t("Cancelar prueba") : t("Cancelar renovación")}
              </button>
            )}
            {changing === item.family && (
              <p className="basis-full text-xs text-[#888]">
                {owned.trialEndsAt
                  ? t("Elige arriba el plazo nuevo: no se cobra nada hoy; al terminar la prueba se cobra ese plan.")
                  : t("Elige arriba el plazo nuevo: lo pagado sigue igual hasta el fin del periodo y en la renovación se cobra el plan nuevo.")}
              </p>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={surface === "app" ? "space-y-6 px-5 pb-12 pt-4" : "space-y-8"}>
      {busy === "cart" && !cartOpen && (
        <p className="rounded-xl bg-[#fff8e1] px-4 py-3 text-sm text-[#7a5b00]">{t("Confirmando tu pago…")}</p>
      )}
      {msg && (
        <p className={`rounded-xl px-4 py-3 text-sm ${msg.ok ? "bg-[#e7f5ec] text-[#1e5a32]" : "bg-red-50 text-red-700"}`}>
          {t(msg.text)}
        </p>
      )}
      {data.promo?.banner.on && data.promo.banner.text && (
        <div className="rounded-2xl bg-[#111] px-4 py-3 text-white">
          <p className="text-[15px] font-semibold">
            <span className="mr-1.5 rounded-md bg-[#dcb81e] px-1.5 py-0.5 text-xs font-bold text-black">{t("PROMOCIÓN")}</span>
            {t(data.promo.banner.text)}
          </p>
        </div>
      )}
      <p className="text-sm text-[#717171]">
        {t("Tu cuenta básica de Cabibee es gratis. Elige el plazo de cada herramienta: entre más largo, más barato por mes.")}
      </p>

      <CountryPicker
        value={data.billingCountry}
        onSaved={() => {
          setMsg(null);
          void load();
        }}
      />
      {!data.emailVerified && <VerifyEmailBox email={data.email} placeholder={data.placeholderEmail} />}

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
          <div className="grid gap-4 sm:grid-cols-2">
            <AiAgentCard />
            {hostItems.map(card)}
          </div>
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

      {cartLines.length > 0 && (
        <>
          <div aria-hidden className="h-16" />
          <div
            className={`fixed inset-x-0 z-30 mx-auto px-4 ${surface === "app" ? "max-w-xl" : "max-w-4xl"}`}
            style={{ bottom: surface === "app" ? "calc(76px + env(safe-area-inset-bottom))" : "16px" }}
          >
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="flex w-full items-center gap-3 rounded-2xl bg-[#222] px-4 py-3 text-left text-white shadow-lg"
            >
              <span className="relative">
                <CartIcon className="h-6 w-6" />
                <span className="absolute -right-2 -top-2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#dcb81e] px-1 text-[10px] font-bold text-black">
                  {cartLines.length}
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">
                  {cartLines.length === 1 ? t("1 producto en tu carrito") : t("{n} productos en tu carrito", { n: cartLines.length })}
                </span>
                <span className="block text-xs text-[#ccc]">{t("Hoy pagas {total}", { total: money(cartTotal, cartCurrency) })}</span>
              </span>
              <span className="rounded-xl bg-[#dcb81e] px-4 py-2 text-sm font-semibold text-black">{t("Ver carrito")}</span>
            </button>
          </div>
        </>
      )}

      {trialItem && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label={t("Prueba gratis de {n} días", { n: trialItem.trial?.days ?? 30 })}
        >
          <button type="button" aria-label={t("Cerrar")} className="absolute inset-0 cursor-default" onClick={() => setTrialFor(null)} />
          <div
            className="relative max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 shadow-xl sm:rounded-3xl"
            style={{ paddingBottom: "calc(20px + env(safe-area-inset-bottom))" }}
          >
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[#222]">{t("Prueba gratis de {n} días", { n: trialItem.trial?.days ?? 30 })}</h2>
              <button type="button" onClick={() => setTrialFor(null)} aria-label={t("Cerrar")} className="flex h-9 w-9 items-center justify-center rounded-full text-xl text-[#222] hover:bg-[#f2f2f2]">
                ×
              </button>
            </div>
            <p className="text-[15px] font-semibold text-[#222]">{t(trialItem.label)}</p>
            <p className="mt-1 text-sm text-[#717171]">
              {t("Hoy no pagas nada. Dejas tu tarjeta y la herramienta queda en marcha desde hoy, con todo funcionando.")}
            </p>

            {trialItem.unit && (
              <div className="mt-4">
                <p className="text-sm font-semibold text-[#222]">
                  {trialItem.unit === "seat"
                    ? t("¿Cuántos colaboradores? (hasta {max})", { max: trialMax })
                    : t("¿En cuántos anuncios?")}
                </p>
                <div className="mt-2 inline-flex items-center rounded-xl border border-[#ccc]">
                  <button
                    type="button"
                    aria-label={t("Menos")}
                    disabled={trialQty <= 1}
                    onClick={() => setQty((p) => ({ ...p, [trialItem.family]: Math.max(1, trialQty - 1) }))}
                    className="h-10 w-10 text-lg disabled:opacity-30"
                  >
                    −
                  </button>
                  <span className="min-w-8 text-center text-[15px] font-semibold">{trialQty}</span>
                  <button
                    type="button"
                    aria-label={t("Más")}
                    disabled={trialQty >= trialMax}
                    onClick={() => setQty((p) => ({ ...p, [trialItem.family]: Math.min(trialMax, trialQty + 1) }))}
                    className="h-10 w-10 text-lg disabled:opacity-30"
                  >
                    +
                  </button>
                </div>
              </div>
            )}

            {trialItem.terms.length > 1 && (
              <div className="mt-4">
                <p className="text-sm font-semibold text-[#222]">{t("¿Con qué plan quieres que se renueve al terminar la prueba?")}</p>
                <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label={t("Plazo")}>
                  {trialItem.terms.map((x) => {
                    const on = x.code === trialPlan.code;
                    return (
                      <button
                        key={x.code}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => setTerm((p) => ({ ...p, [trialItem.family]: x.code }))}
                        className={`rounded-xl border px-3 py-1.5 text-sm ${on ? "border-[#222] bg-[#222] text-white" : "border-[#ddd] bg-white text-[#222]"}`}
                      >
                        {x.months === 1 ? t("1 mes") : t("{n} meses", { n: x.months })}
                        <span className={`block text-xs ${on ? "text-[#ddd]" : "text-[#717171]"}`}>
                          {t("{price} al mes", { price: money(x.perMonth, trialItem.currency) })}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mt-4 rounded-2xl bg-[#fdf6d8] p-4 text-sm text-[#5c4a0a]">
              <p className="font-semibold">{t("Tu prueba termina el {d}.", { d: day(trialEnd.toISOString()) })}</p>
              <p className="mt-1">
                {trialPlan.months === 1
                  ? t("Ese día se cobran {total} y el plan se renueva solo cada mes.", { total: money(trialTotal, trialItem.currency) })
                  : t("Ese día se cobran {total} y el plan se renueva solo cada {n} meses.", { total: money(trialTotal, trialItem.currency), n: trialPlan.months })}
              </p>
              <p className="mt-2">
                {t("Puedes cancelar cuando quieras desde la Tienda. Si cancelas antes del {d}, no se cobra nada y la herramienta se apaga ese momento. Si cancelas después, sigues usándola hasta el fin de lo ya pagado (no hay reembolso) y ya no se renueva.", {
                  d: day(trialEnd.toISOString()),
                })}
              </p>
              <p className="mt-2">{t("Si cambias de plazo antes de la renovación, en la renovación se cobra el plazo nuevo.")}</p>
            </div>

            {!data.billingCountry && (
              <div className="mt-3">
                <CountryPicker value={null} compact onSaved={() => void load()} />
              </div>
            )}
            {!data.emailVerified && (
              <div className="mt-3">
                <VerifyEmailBox email={data.email} placeholder={data.placeholderEmail} />
              </div>
            )}
            {!data.hasPhone && (
              <div className="mt-3">
                <PhoneBox onSaved={() => void load()} />
              </div>
            )}
            <button
              type="button"
              disabled={busy !== null || !data.billingCountry || !data.emailVerified || !data.hasPhone}
              onClick={() => void startTrial(trialItem)}
              className="mt-4 w-full rounded-xl bg-[#dcb81e] px-5 py-3 text-[15px] font-semibold text-black disabled:opacity-50"
            >
              {busy === "trial" ? t("Abriendo…") : t("Dejar mi tarjeta y empezar la prueba gratis")}
            </button>
          </div>
        </div>
      )}

      {cartOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" role="dialog" aria-modal="true" aria-label={t("Tu carrito")}>
          <button type="button" aria-label={t("Cerrar")} className="absolute inset-0 cursor-default" onClick={() => setCartOpen(false)} />
          <div
            className="relative max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 shadow-xl sm:rounded-3xl"
            style={{ paddingBottom: "calc(20px + env(safe-area-inset-bottom))" }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[#222]">{t("Tu carrito")}</h2>
              <button type="button" onClick={() => setCartOpen(false)} aria-label={t("Cerrar")} className="flex h-9 w-9 items-center justify-center rounded-full text-xl text-[#222] hover:bg-[#f2f2f2]">
                ×
              </button>
            </div>
            {cartLines.length === 0 ? (
              <p className="py-6 text-center text-sm text-[#717171]">{t("Tu carrito está vacío.")}</p>
            ) : (
              <>
                <ul className="divide-y divide-[#f0f0f0]">
                  {cartLines.map(({ item, plan, quantity, total }) => (
                    <li key={item.family} className="flex items-start gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-semibold text-[#222]">{t(item.label)}</p>
                        <p className="text-xs text-[#717171]">
                          {[
                            plan.months === 0 ? t("pago único") : plan.months === 1 ? t("1 mes") : t("{n} meses", { n: plan.months }),
                            !item.unit
                              ? ""
                              : item.unit === "listing"
                                ? quantity === 1
                                  ? t("1 anuncio")
                                  : t("{n} anuncios", { n: quantity })
                                : quantity === 1
                                  ? t("1 colaborador")
                                  : t("{n} colaboradores", { n: quantity }),
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-[#222]">{money(total, item.currency)}</p>
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.family)}
                        aria-label={t("Quitar {name}", { name: t(item.label) })}
                        className="-mr-1 flex h-7 w-7 items-center justify-center rounded-full text-lg text-[#717171] hover:bg-[#f2f2f2]"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex items-center justify-between border-t border-[#e5e5e5] pt-3">
                  <span className="text-[15px] font-semibold text-[#222]">{t("Hoy pagas")}</span>
                  <span className="text-lg font-bold text-[#222]">{money(cartTotal, cartCurrency)}</span>
                </div>
                <p className="mt-2 text-xs text-[#888]">
                  {t("Cada producto se renueva solo al terminar su plazo, con su propio cobro. Puedes cancelar cualquiera desde la Tienda.")}
                </p>
                {!data.billingCountry && (
                  <div className="mt-3">
                    <CountryPicker value={null} compact onSaved={() => void load()} />
                  </div>
                )}
                {!data.emailVerified && (
                  <div className="mt-3">
                    <VerifyEmailBox email={data.email} placeholder={data.placeholderEmail} />
                  </div>
                )}
                {!data.hasPhone && (
                  <div className="mt-3">
                    <PhoneBox onSaved={() => void load()} />
                  </div>
                )}
                <button
                  type="button"
                  disabled={busy !== null || !data.billingCountry || !data.emailVerified || !data.hasPhone}
                  onClick={() => void checkout()}
                  className="mt-4 w-full rounded-xl bg-[#dcb81e] px-5 py-3 text-[15px] font-semibold text-black disabled:opacity-50"
                >
                  {busy === "cart" ? t("Abriendo pago…") : t("Pagar {total}", { total: money(cartTotal, cartCurrency) })}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
