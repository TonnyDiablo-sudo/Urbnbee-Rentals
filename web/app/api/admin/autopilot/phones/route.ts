import { NextResponse } from "next/server";
import { MAX_PER_PHONE_DAILY, parsePhoneList } from "@/lib/autopilot-phones";
import {
  addAutopilotPhones,
  removeAutopilotPhone,
  saveAutopilotPhoneSettings,
  updateAutopilotPhone,
} from "@/lib/autopilot-phones-store";
import { getSessionUser } from "@/lib/session";

export const runtime = "nodejs";

async function admin() {
  const viewer = await getSessionUser();
  return viewer?.role === "admin" ? viewer : null;
}

/** Agrega líneas de Cabibee (una por renglón). */
export async function POST(req: Request) {
  const viewer = await admin();
  if (!viewer) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { text?: unknown; confirm?: unknown };
  if (body.confirm !== true) {
    return NextResponse.json({ error: "Confirma que las líneas son de Cabibee y que reciben mensajes." }, { status: 400 });
  }
  const { phones, invalid } = parsePhoneList(typeof body.text === "string" ? body.text.slice(0, 20000) : "");
  if (!phones.length) return NextResponse.json({ error: "No encontré números válidos.", invalid }, { status: 400 });
  const added = addAutopilotPhones(phones, viewer.id);
  return NextResponse.json({ ok: true, added, repeated: phones.length - added, invalid });
}

/** `{ id, active }` prende o apaga una línea; `{ formName, formEmail, perPhoneDaily }` guarda los ajustes. */
export async function PATCH(req: Request) {
  if (!(await admin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (typeof body.id === "string") {
    const ok = updateAutopilotPhone(body.id, { active: body.active === true });
    return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "No existe." }, { status: 404 });
  }
  const formName = typeof body.formName === "string" ? body.formName.trim().slice(0, 80) : undefined;
  const formEmail = typeof body.formEmail === "string" ? body.formEmail.trim().toLowerCase().slice(0, 200) : undefined;
  if (formEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formEmail)) return NextResponse.json({ error: "Correo inválido." }, { status: 400 });
  let perPhoneDaily: number | undefined;
  if (body.perPhoneDaily !== undefined) {
    perPhoneDaily = Number(body.perPhoneDaily);
    if (!Number.isInteger(perPhoneDaily) || perPhoneDaily < 1 || perPhoneDaily > MAX_PER_PHONE_DAILY) {
      return NextResponse.json({ error: `Usos por línea al día: 1 a ${MAX_PER_PHONE_DAILY}.` }, { status: 400 });
    }
  }
  saveAutopilotPhoneSettings({ formName, formEmail, perPhoneDaily });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  if (!(await admin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const id = new URL(req.url).searchParams.get("id") ?? "";
  return removeAutopilotPhone(id) ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "No existe." }, { status: 404 });
}
