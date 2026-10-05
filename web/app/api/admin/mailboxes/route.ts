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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ZOHO_REGIONS: Record<string, string> = { com: "com", eu: "eu", in: "in", au: "com.au", jp: "jp", ca: "ca" };
const BAD_LOGIN = /535|Username and Password not accepted|Invalid login|Authentication Failed|authentication failed/i;

type Provider = "zoho" | "gmail";

async function requireAdmin() {
  const user = await getSessionUser();
  return user?.role === "admin" ? user : null;
}

function isId(v: unknown): v is MailboxId {
  return v === "noreply" || v === "support";
}

/** Zoho: smtppro para cuentas de organización (dominio propio), smtp para cuentas personales. */
function smtpHosts(provider: Provider, region: string): string[] {
  if (provider === "gmail") return ["smtp.gmail.com"];
  const tld = ZOHO_REGIONS[region] ?? "com";
  return [`smtppro.zoho.${tld}`, `smtp.zoho.${tld}`];
}

async function sendTest(id: MailboxId, to: string) {
  const email = mailboxEmail(id);
  return sendEmail({
    mailbox: id,
    strict: true,
    to,
    subject: `Prueba de Cabibee (${email})`,
    text: `Si leíste esto, ${email} está funcionando. Si no esperabas este correo, escribe a ${mailboxEmail("support")}.`,
    html: emailLayout({
      title: "Correo de prueba",
      paragraphs: [
        `Si leíste esto, <b>${email}</b> está funcionando.`,
        `Si no esperabas este correo, escribe a ${mailboxEmail("support")}.`,
      ],
    }),
  });
}

function testTarget(raw: unknown, fallback: string): string | null {
  const to = String(raw ?? "").trim().toLowerCase() || fallback;
  return EMAIL_RE.test(to) ? to : null;
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
    provider?: string;
    region?: string;
    testTo?: string;
    sendTest?: boolean;
  };
  if (!isId(body.id)) return NextResponse.json({ error: "Buzón inválido." }, { status: 400 });
  const provider: Provider = body.provider === "gmail" ? "gmail" : "zoho";
  const providerName = provider === "zoho" ? "Zoho" : "Google";
  const password = String(body.password ?? "").replace(/\s+/g, "");
  if (password.length < 8) {
    return NextResponse.json({ error: "Pega la contraseña de aplicación de ese buzón (mínimo 8 caracteres)." }, { status: 400 });
  }
  const email = mailboxEmail(body.id);
  const loginUser = String(body.loginUser ?? "").trim().toLowerCase() || email;
  if (!EMAIL_RE.test(loginUser)) {
    return NextResponse.json({ error: "La cuenta para iniciar sesión no es un correo válido." }, { status: 400 });
  }
  const to = body.sendTest ? testTarget(body.testTo, admin.email) : null;
  if (body.sendTest && !to) {
    return NextResponse.json({ error: "El correo para la prueba no es válido." }, { status: 400 });
  }

  const attempts = smtpHosts(provider, String(body.region ?? "com")).flatMap((host) => [
    { host, port: 465, secure: true },
    { host, port: 587, secure: false },
  ]);

  let lastError = "No se pudo conectar.";
  let sawBadLogin = false;
  const rejectedHosts = new Set<string>();
  for (const a of attempts) {
    if (rejectedHosts.has(a.host)) continue;
    const auth = { ...a, user: loginUser, pass: password };
    const check = await verifySmtpAuth(auth);
    if (!check.ok) {
      lastError = check.error;
      if (BAD_LOGIN.test(check.error)) {
        sawBadLogin = true;
        rejectedHosts.add(a.host);
      }
      continue;
    }
    let saved;
    try {
      saved = saveMailbox(body.id, auth);
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "No se pudo guardar." }, { status: 500 });
    }
    if (to && !(await sendTest(body.id, to))) {
      return NextResponse.json({
        ok: true,
        box: saved,
        warning: `Se conectó con ${a.host}, pero no salió el correo de prueba a ${to}. Vuelve a probar en un momento.`,
      });
    }
    return NextResponse.json({ ok: true, box: saved, host: a.host, testedTo: to ?? undefined });
  }

  if (sawBadLogin) {
    return NextResponse.json(
      {
        error:
          provider === "zoho"
            ? `Zoho no aceptó la clave para ${loginUser}. Usa una contraseña de aplicación de esa misma cuenta (Zoho Mail → Mi cuenta → Seguridad → Contraseñas específicas de la aplicación) y revisa que SMTP esté activado en Configuración → Cuentas de correo. Si tu cuenta está en Europa o India, elige esa región.`
            : `Google no aceptó la clave para ${loginUser}. Revisa que sea una contraseña de aplicación de esa misma cuenta (necesita verificación en dos pasos). Si ${email} es un alias, pon la cuenta real en «Inicia sesión como».`,
      },
      { status: 400 }
    );
  }
  return NextResponse.json({ error: `No se pudo conectar con ${providerName}: ${lastError}` }, { status: 400 });
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { id?: string; to?: string };
  if (!isId(body.id)) return NextResponse.json({ error: "Buzón inválido." }, { status: 400 });
  if (!listMailboxesPublic().find((b) => b.id === body.id)?.connected) {
    return NextResponse.json({ error: `${mailboxEmail(body.id)} no está conectado.` }, { status: 400 });
  }
  const to = testTarget(body.to, admin.email);
  if (!to) return NextResponse.json({ error: "El correo para la prueba no es válido." }, { status: 400 });
  if (!(await sendTest(body.id, to))) {
    const err = listMailboxesPublic().find((b) => b.id === body.id)?.lastError;
    return NextResponse.json({ error: `No salió la prueba${err ? `: ${err}` : "."}` }, { status: 400 });
  }
  return NextResponse.json({ ok: true, to, boxes: listMailboxesPublic() });
}

export async function DELETE(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const id = req.nextUrl.searchParams.get("id");
  if (!isId(id)) return NextResponse.json({ error: "Buzón inválido." }, { status: 400 });
  return NextResponse.json({ ok: true, box: disconnectMailbox(id) });
}
