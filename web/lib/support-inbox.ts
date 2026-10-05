import "server-only";
import { isPlaceholderEmail } from "@/lib/associate-provision";
import { emailLayout, escapeHtml, sendEmail } from "@/lib/email";
import { findUserById, getListingById } from "@/lib/marketplace-store";
import { SUPPORT_EMAIL } from "@/lib/support-contact";
import { reportKindLabel, type UserReportRecord } from "@/lib/user-reports-types";

/** Copia al buzón de soporte de cada queja, sugerencia o denuncia. */
export async function emailSupportAboutReport(report: UserReportRecord): Promise<void> {
  const target = report.targetUserId ? findUserById(report.targetUserId) : undefined;
  const listing = report.listingId ? getListingById(report.listingId) : undefined;
  const replyTo = report.contact?.includes("@")
    ? report.contact
    : report.reporterEmail && !isPlaceholderEmail(report.reporterEmail)
      ? report.reporterEmail
      : undefined;
  const lines = [
    `Tipo: ${reportKindLabel(report.kind)}`,
    `Motivo: ${report.category}`,
    `De: ${report.reporterName} (${report.reporterEmail}) como ${report.reporterMode === "host" ? "anfitrión" : "huésped"}`,
    target ? `Sobre: ${target.fullName} <${target.email}>` : report.targetLabel ? `Sobre: ${report.targetLabel}` : "",
    listing ? `Anuncio: ${listing.title} (${listing.slug})` : "",
    report.contact ? `Contacto extra: ${report.contact}` : "",
    "",
    report.message,
    "",
    `Admin: /admin/users/${report.reporterId}?tab=reports`,
  ].filter(Boolean);

  await sendEmail({
    mailbox: "noreply",
    to: SUPPORT_EMAIL,
    replyTo,
    subject: `[Cabibee] ${reportKindLabel(report.kind)} · ${report.category}`,
    text: lines.join("\n"),
    html: emailLayout({
      title: escapeHtml(reportKindLabel(report.kind)),
      paragraphs: [
        `<b>${escapeHtml(report.category)}</b> · ${escapeHtml(report.reporterName)} (${escapeHtml(report.reporterEmail)}) como ${report.reporterMode === "host" ? "anfitrión" : "huésped"}`,
        target
          ? `Sobre ${escapeHtml(target.fullName)} &lt;${escapeHtml(target.email)}&gt;`
          : report.targetLabel
            ? `Sobre ${escapeHtml(report.targetLabel)}`
            : "",
        listing ? `Anuncio: ${escapeHtml(listing.title)}` : "",
        report.contact ? `Contacto extra: ${escapeHtml(report.contact)}` : "",
        escapeHtml(report.message).replace(/\n/g, "<br>"),
      ].filter(Boolean),
    }),
  });
}
