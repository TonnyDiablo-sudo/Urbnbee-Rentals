import { NextRequest, NextResponse } from "next/server";
import { getHostProfile, upsertHostProfile } from "@/lib/marketplace-store";
import { getSessionUser } from "@/lib/session";
import { sanitizeTaxSettings, TAX_COUNTRIES } from "@/lib/stay-tax";

async function hostOnly() {
  const user = await getSessionUser();
  return user && (user.role === "host" || user.role === "admin") ? user : null;
}

/** Impuestos que el anfitrión cobra en sus reservas y los preajustes por país. */
export async function GET() {
  const user = await hostOnly();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  return NextResponse.json({ tax: getHostProfile(user.id)?.tax ?? null, countries: TAX_COUNTRIES });
}

/** Aplica a reservas nuevas; las ya pagadas conservan el precio con el que se cobraron. */
export async function PUT(req: NextRequest) {
  const user = await hostOnly();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { tax?: unknown };
  const tax = sanitizeTaxSettings(body.tax);
  if (!tax) return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  if ((body.tax as { enabled?: unknown })?.enabled === true && !tax.enabled) {
    return NextResponse.json({ error: "Agrega al menos un impuesto con su porcentaje." }, { status: 400 });
  }
  const saved = upsertHostProfile(user.id, { tax });
  return NextResponse.json({ ok: true, tax: saved.tax });
}
