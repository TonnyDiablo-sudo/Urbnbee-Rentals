import "server-only";

/**
 * Correo transaccional vía Resend (https://resend.com). Sin RESEND_API_KEY no se manda
 * nada: el enlace queda en el log del servidor para pruebas.
 */
export async function sendEmail(opts: { to: string; subject: string; html: string; text: string }): Promise<boolean> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    console.info(`[email] RESEND_API_KEY no configurada. Para ${opts.to}: ${opts.subject}\n${opts.text}`);
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM?.trim() || "Cabibee <no-reply@cabibee.com>",
        to: [opts.to],
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) console.warn("[email] Resend respondió", res.status, await res.text().catch(() => ""));
    return res.ok;
  } catch (e) {
    console.warn("[email] envío falló:", e);
    return false;
  }
}
