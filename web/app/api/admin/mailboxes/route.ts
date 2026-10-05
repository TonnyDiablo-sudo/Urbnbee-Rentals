import { NextRequest, NextResponse } from "next/server";
import { emailLayout, sendEmail, verifySmtpAuth } from "@/lib/email";
import {
  disconnectMailbox,
  listMailboxesPublic,
  MAILBOX_META,
  mailboxEmail,
  saveMailbox,
  type MailboxId,
} from "@/lib/mailboxes-store";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const SMTP_HOST = "smtp.gmail.com";

async function requireAdmin() {
  const user = await getSessionUser();
  return user?.role === "admin" ? user : null;
}

function isId(v: unknown): v is MailboxId {
  return v === "noreply" || v === "support";
}

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json({ boxes: listMailboxesPublic(), meta: MAILBOX_META });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as {
    id?: string;
    password?: string;
    loginUser?: string;
    testToMe?: boolean;
  };
  if (!isId(body.id)) return NextResponse.json({ error: "Buzón inválido." }, { status: 400 });
  const password = String(body.password ?? "").replace(/\s+/g, "");
  if (password.length < 8) {
    return NextResponse.json({ error: "Pega la contraseña de aplicación de ese buzón (mínimo 8 caracteres)." }, { status: 400 });
  }
  const email = mailboxEmail(body.id);
  const loginUser = String(body.loginUser ?? "").trim().toLowerCase() || email;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginUser)) {
    return NextResponse.json({ error: "La cuenta de Google para iniciar sesión no es un correo válido." }, { status: 400 });
  }
  const attempts = [
    { port: 465, secure: true },
    { port: 587, secure: false },
  ];

  let lastError = "No se pudo conectar.";
  for (const tryPort of attempts) {
    const auth = { host: SMTP_HOST, port: tryPort.port, secure: tryPort.secure, user: loginUser, pass: password };
    const check = await verifySmtpAuth(auth);
    if (!check.ok) {
      lastError = check.error;
      if (/535|Username and Password not accepted|Invalid login/i.test(check.error)) break;
      continue;
    }
    let saved;
    try {
      saved = saveMailbox(body.id, auth);
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "No se pudo guardar." }, { status: 500 });
    }
    if (body.testToMe) {
      const sent = await sendEmail({
        mailbox: body.id,
        strict: true,
        to: admin.email,
        subject: `Cabibee: ${email} quedó conectado`,
        text: `Listo. Este buzón (${email}) ya puede usarlo Cabibee. Si no pediste esta prueba, escribe a ${mailboxEmail("support")}.`,
        html: emailLayout({
          title: "Buzón conectado",
          paragraphs: [
            `Listo. <b>${email}</b> ya puede usarlo Cabibee.`,
            `Si no pediste esta prueba, escribe a ${mailboxEmail("support")}.`,
          ],
        }),
      });
      if (!sent) {
        return NextResponse.json({
          ok: true,
          box: saved,
          warning: "Se conectó, pero no pudimos mandarte el correo de prueba. Revisa la bandeja o vuelve a probar.",
        });
      }
    }
    return NextResponse.json({ ok: true, box: saved });
  }
  const badLogin = /535|Username and Password not accepted|Invalid login/i.test(lastError);
  return NextResponse.json(
    {
      error: badLogin
        ? `Google no aceptó la clave para ${loginUser}. Revisa que sea una contraseña de aplicación de esa misma cuenta (necesita verificación en dos pasos). Si ${email} es un alias, pon la cuenta real en «Inicia sesión como».`
        : `No se pudo conectar con Google: ${lastError}`,
    },
    { status: 400 }
  );
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { id?: string };
  if (!isId(body.id)) return NextResponse.json({ error: "Buzón inválido." }, { status: 400 });
  if (!listMailboxesPublic().find((b) => b.id === body.id)?.connected) {
    return NextResponse.json({ error: `${mailboxEmail(body.id)} no está conectado.` }, { status: 400 });
  }
  const sent = await sendEmail({
    mailbox: body.id,
    strict: true,
    to: admin.email,
    subject: `Prueba de Cabibee (${mailboxEmail(body.id)})`,
    text: `Si leíste esto, ${mailboxEmail(body.id)} está funcionando.`,
    html: emailLayout({
      title: "Correo de prueba",
      paragraphs: [`Si leíste esto, <b>${mailboxEmail(body.id)}</b> está funcionando.`],
    }),
  });
  if (!sent) {
    const err = listMailboxesPublic().find((b) => b.id === body.id)?.lastError;
    return NextResponse.json({ error: `No salió la prueba${err ? `: ${err}` : "."}` }, { status: 400 });
  }
  return NextResponse.json({ ok: true, boxes: listMailboxesPublic() });
}

export async function DELETE(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const id = req.nextUrl.searchParams.get("id");
  if (!isId(id)) return NextResponse.json({ error: "Buzón inválido." }, { status: 400 });
  return NextResponse.json({ ok: true, box: disconnectMailbox(id) });
}
