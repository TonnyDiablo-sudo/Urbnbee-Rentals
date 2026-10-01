/** Impuestos que el anfitrión cobra al huésped según su país. Se usa en servidor y cliente. */

export type StayTaxLine = { name: string; ratePct: number };

export type HostTaxSettings = {
  enabled: boolean;
  /** ISO-2 (MX, ES, CO…) u «OTHER». */
  country: string;
  /** «added»: se suma al precio. «included»: el precio publicado ya los trae. */
  mode: "added" | "included";
  lines: StayTaxLine[];
  /** RFC / NIF / NIT que aparece en el contrato. */
  taxId?: string;
};

export type TaxBreakdown = {
  lines: { name: string; ratePct: number; amountMxn: number }[];
  taxMxn: number;
  included: boolean;
  /** Lo que se suma encima del subtotal (0 si ya venían incluidos). */
  addedMxn: number;
};

export const TAX_COUNTRIES: { code: string; label: string; lines: StayTaxLine[]; mode: HostTaxSettings["mode"] }[] = [
  { code: "MX", label: "México", mode: "added", lines: [{ name: "IVA", ratePct: 16 }, { name: "ISH", ratePct: 3 }] },
  { code: "ES", label: "España", mode: "included", lines: [{ name: "IVA", ratePct: 10 }] },
  { code: "CO", label: "Colombia", mode: "added", lines: [{ name: "IVA", ratePct: 19 }] },
  { code: "AR", label: "Argentina", mode: "included", lines: [{ name: "IVA", ratePct: 21 }] },
  { code: "CL", label: "Chile", mode: "added", lines: [{ name: "IVA", ratePct: 19 }] },
  { code: "PE", label: "Perú", mode: "added", lines: [{ name: "IGV", ratePct: 18 }] },
  { code: "US", label: "Estados Unidos", mode: "added", lines: [{ name: "Occupancy tax", ratePct: 12 }] },
  { code: "CA", label: "Canadá", mode: "added", lines: [{ name: "GST", ratePct: 5 }] },
  { code: "OTHER", label: "Otro país", mode: "added", lines: [{ name: "Impuesto", ratePct: 10 }] },
];

export function taxPresetFor(country: string): HostTaxSettings {
  const p = TAX_COUNTRIES.find((c) => c.code === country) ?? TAX_COUNTRIES[0];
  return { enabled: true, country: p.code, mode: p.mode, lines: p.lines.map((l) => ({ ...l })) };
}

/** Limpia lo que llega del formulario; `undefined` si no hay nada que cobrar. */
export function sanitizeTaxSettings(raw: unknown): HostTaxSettings | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const country = typeof r.country === "string" && TAX_COUNTRIES.some((c) => c.code === r.country) ? r.country : "MX";
  const lines = (Array.isArray(r.lines) ? r.lines : [])
    .map((l) => {
      const o = (l ?? {}) as Record<string, unknown>;
      const name = typeof o.name === "string" ? o.name.replace(/[<>]/g, "").trim().slice(0, 40) : "";
      const rate = Math.round(Number(o.ratePct) * 100) / 100;
      return name && Number.isFinite(rate) && rate > 0 && rate <= 50 ? { name, ratePct: rate } : null;
    })
    .filter((l): l is StayTaxLine => l !== null)
    .slice(0, 4);
  const taxId = typeof r.taxId === "string" ? r.taxId.replace(/[<>]/g, "").trim().slice(0, 40) : "";
  return {
    enabled: r.enabled === true && lines.length > 0,
    country,
    mode: r.mode === "included" ? "included" : "added",
    lines,
    taxId: taxId || undefined,
  };
}

export function taxActive(s: HostTaxSettings | undefined): s is HostTaxSettings {
  return Boolean(s?.enabled && s.lines.length);
}

/** Desglose sobre estancia + limpieza. */
export function computeStayTax(settings: HostTaxSettings | undefined, subtotalMxn: number): TaxBreakdown {
  if (!taxActive(settings) || subtotalMxn <= 0) return { lines: [], taxMxn: 0, included: false, addedMxn: 0 };
  const included = settings.mode === "included";
  const totalRate = settings.lines.reduce((s, l) => s + l.ratePct, 0);
  const base = included ? subtotalMxn / (1 + totalRate / 100) : subtotalMxn;
  const lines = settings.lines.map((l) => ({ name: l.name, ratePct: l.ratePct, amountMxn: Math.round((base * l.ratePct) / 100) }));
  const taxMxn = lines.reduce((s, l) => s + l.amountMxn, 0);
  return { lines, taxMxn, included, addedMxn: included ? 0 : taxMxn };
}

export function taxLineLabel(l: { name: string; ratePct: number }): string {
  return `${l.name} (${l.ratePct}%)`;
}
