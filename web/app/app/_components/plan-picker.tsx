"use client";

import { useLang, useT } from "@/components/i18n-provider";
import { numberLocale, type Lang, type TFn } from "@/lib/i18n";
import { translatePlanLabel } from "@/lib/plan-label";

export type CatalogPlan = {
  code: string;
  label: string;
  description: string;
  amount: number;
  currency: "mxn" | "usd";
  billing: { kind: "one_time" } | { kind: "subscription"; intervalCount: number };
};

function price(p: CatalogPlan, lang: Lang) {
  return `$${p.amount.toLocaleString(numberLocale(lang), { maximumFractionDigits: 0 })} ${p.currency === "usd" ? "USD" : "MXN"}`;
}

function caption(p: CatalogPlan, t: TFn, lang: Lang) {
  if (p.billing.kind === "one_time") return t("Pago único");
  const m = p.billing.intervalCount;
  return t("Cada {m} meses · ≈ ${amount}/mes", {
    m,
    amount: (p.amount / m).toLocaleString(numberLocale(lang), { maximumFractionDigits: 0 }),
  });
}

export function PlanPicker({
  plans,
  busy,
  onPick,
  demo,
}: {
  plans: CatalogPlan[];
  busy: boolean;
  onPick: (code: string) => void;
  demo?: boolean;
}) {
  const t = useT();
  const lang = useLang();
  return (
    <div className="space-y-3">
      {plans.map((p) => (
        <div key={p.code} className="rounded-2xl border border-[#e5e5e5] p-4">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[15px] font-semibold text-[#222]">{translatePlanLabel(p.label, t)}</p>
            <p className="shrink-0 text-lg font-bold text-[#222]">{price(p, lang)}</p>
          </div>
          <p className="text-xs text-[#888]">{caption(p, t, lang)}</p>
          {p.description && <p className="mt-2 text-sm leading-relaxed text-[#555]">{t(p.description)}</p>}
          <button
            type="button"
            disabled={busy}
            onClick={() => onPick(p.code)}
            className="mt-3 w-full rounded-xl bg-[#111] py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {demo ? t("Contratar (demo)") : t("Contratar")}
          </button>
        </div>
      ))}
    </div>
  );
}

export function RegionToggle({
  value,
  onChange,
}: {
  value: "mx" | "us";
  onChange: (r: "mx" | "us") => void;
}) {
  const t = useT();
  return (
    <div className="inline-flex rounded-full bg-[#f1f1f1] p-1">
      {(["mx", "us"] as const).map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => onChange(r)}
          className={`rounded-full px-4 py-1.5 text-sm font-medium ${value === r ? "bg-white text-[#222] shadow" : "text-[#717171]"}`}
        >
          {r === "mx" ? t("México") : t("USA")}
        </button>
      ))}
    </div>
  );
}

export async function startMembershipCheckout(body: Record<string, string>): Promise<{ error?: string; reload?: boolean }> {
  try {
    const res = await fetch("/api/verification/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return { error: typeof j.error === "string" ? j.error : "No se pudo iniciar el cobro." };
    if (j.simulated) return { reload: true };
    if (typeof j.checkoutUrl === "string") {
      window.location.assign(j.checkoutUrl);
      return {};
    }
    return { error: "Respuesta inválida del servidor." };
  } catch {
    return { error: "Sin conexión." };
  }
}

export async function startIdentity(url: string, returnPath: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ returnPath }),
    });
    const j = await res.json().catch(() => ({}));
    if (res.ok && typeof j.url === "string") {
      window.location.assign(j.url);
      return null;
    }
    return typeof j.error === "string" ? j.error : "No se pudo iniciar la verificación.";
  } catch {
    return "Sin conexión.";
  }
}
