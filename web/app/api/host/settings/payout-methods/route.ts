import { NextRequest, NextResponse } from "next/server";
import {
  getHostPayoutMethods,
  parseCashApp,
  parseClabe,
  parseOxxo,
  parseZelle,
  saveHostPayoutMethods,
} from "@/lib/host-payout-methods";
import { getSessionUser } from "@/lib/session";

function requireHost() {
  return getSessionUser();
}

export async function GET() {
  const user = await requireHost();
  if (!user || (user.role !== "host" && user.role !== "admin")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const saved = getHostPayoutMethods(user.id);
  return NextResponse.json({
    clabe: saved?.clabe ?? null,
    zelle: saved?.zelle ?? null,
    cashapp: saved?.cashapp ?? null,
    oxxo: saved?.oxxo ?? null,
    updatedAt: saved?.updatedAt ?? null,
  });
}

export async function PUT(req: NextRequest) {
  const user = await requireHost();
  if (!user || (user.role !== "host" && user.role !== "admin")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Parameters<typeof saveHostPayoutMethods>[1] = {};

  if ("clabe" in body) {
    if (body.clabe == null) patch.clabe = null;
    else {
      const parsed = parseClabe(body.clabe);
      if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
      patch.clabe = parsed;
    }
  }
  if ("zelle" in body) {
    if (body.zelle == null) patch.zelle = null;
    else {
      const parsed = parseZelle(body.zelle);
      if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
      patch.zelle = parsed;
    }
  }
  if ("cashapp" in body) {
    if (body.cashapp == null) patch.cashapp = null;
    else {
      const parsed = parseCashApp(body.cashapp);
      if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
      patch.cashapp = parsed;
    }
  }
  if ("oxxo" in body) {
    if (body.oxxo == null) patch.oxxo = null;
    else {
      const parsed = parseOxxo(body.oxxo);
      if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
      patch.oxxo = parsed;
    }
  }

  const saved = saveHostPayoutMethods(user.id, patch);
  return NextResponse.json({
    clabe: saved.clabe ?? null,
    zelle: saved.zelle ?? null,
    cashapp: saved.cashapp ?? null,
    oxxo: saved.oxxo ?? null,
    updatedAt: saved.updatedAt,
  });
}
