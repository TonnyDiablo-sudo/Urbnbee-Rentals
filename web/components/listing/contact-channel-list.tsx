"use client";

import type { CSSProperties, ReactNode } from "react";
import { useT } from "@/components/i18n-provider";
import { isFacebookUrl } from "@/lib/associate-link-utils";
import type { HostContact } from "@/lib/listing-detail-data";

type Channel = { key: string; href: string; label: string; sub?: string; icon: ReactNode; external: boolean; style: string; css?: CSSProperties };

function facebookLabel(url: string): "Ver su anuncio en Facebook" | "Escribirle por Messenger" | "Ver su perfil de Facebook" {
  if (/\/\/(?:www\.)?(?:m\.me|messenger\.com)\//i.test(url)) return "Escribirle por Messenger";
  if (/marketplace\/item|\/posts\/|permalink|story_fbid|\/groups\/|\/share\/|\/videos\/|\/photo/i.test(url)) return "Ver su anuncio en Facebook";
  return "Ver su perfil de Facebook";
}

const BRAND = "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-white transition hover:opacity-90";
const PLAIN =
  "flex items-center gap-3 rounded-lg border border-[#ebebeb] bg-white px-4 py-3 text-sm font-medium text-[#484848] transition hover:border-[#dcb81e]";

/** WhatsApp, teléfono, correo, Facebook, Instagram y sitio web, cada uno con su color e ícono. */
export function ContactChannelList({ host }: { host: HostContact }) {
  const t = useT();
  const wa = host.whatsapp?.replace(/\D/g, "");
  const fb = host.airbnbUrl && isFacebookUrl(host.airbnbUrl) ? host.airbnbUrl : undefined;
  const ig = host.instagram?.replace(/^@/, "");

  const channels: Channel[] = [
    wa && {
      key: "wa",
      href: `https://wa.me/${wa}`,
      label: t("Escribir por WhatsApp"),
      sub: `+${wa}`,
      icon: <WhatsAppIcon />,
      external: true,
      style: BRAND,
      css: { backgroundColor: "#25D366" },
    },
    host.phone && {
      key: "tel",
      href: `tel:${host.phone.replace(/[^\d+]/g, "")}`,
      label: t("Llamar"),
      sub: host.phone,
      icon: <PhoneIcon />,
      external: false,
      style: PLAIN,
    },
    host.email && {
      key: "mail",
      href: `mailto:${host.email}`,
      label: t("Mandar correo"),
      sub: host.email,
      icon: <EmailIcon />,
      external: false,
      style: PLAIN,
    },
    fb && {
      key: "fb",
      href: fb,
      label: t(facebookLabel(fb)),
      icon: <FacebookIcon />,
      external: true,
      style: BRAND,
      css: { backgroundColor: "#1877F2" },
    },
    ig && {
      key: "ig",
      href: `https://instagram.com/${ig}`,
      label: "Instagram",
      sub: `@${ig}`,
      icon: <InstagramIcon />,
      external: true,
      style: BRAND,
      css: { background: "linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)" },
    },
    host.website && {
      key: "web",
      href: host.website,
      label: t("Sitio web"),
      icon: <WebIcon />,
      external: true,
      style: PLAIN,
    },
  ].filter(Boolean) as Channel[];

  if (!channels.length) return null;
  return (
    <div className="space-y-3">
      {channels.map((c) => (
        <a
          key={c.key}
          href={c.href}
          target={c.external ? "_blank" : undefined}
          rel={c.external ? "noopener noreferrer" : undefined}
          className={c.style}
          style={c.css}
        >
          {c.icon}
          <span className="min-w-0 flex-1">
            <span className="block">{c.label}</span>
            {c.sub && <span className="block truncate text-xs font-normal opacity-80">{c.sub}</span>}
          </span>
          {c.external && <span aria-hidden className="text-xs opacity-70">↗</span>}
        </a>
      ))}
    </div>
  );
}

export function hasContactChannels(host: HostContact): boolean {
  return Boolean(
    host.whatsapp || host.phone || host.email || host.instagram || host.website || (host.airbnbUrl && isFacebookUrl(host.airbnbUrl))
  );
}

function WhatsAppIcon() {
  return (
    <svg className="h-5 w-5 shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg className="h-5 w-5 shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.413c0-3.026 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.971h-1.513c-1.491 0-1.956.931-1.956 1.886v2.264h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg className="h-5 w-5 shrink-0" style={{ color: "#dcb81e" }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
    </svg>
  );
}

function EmailIcon() {
  return (
    <svg className="h-5 w-5 shrink-0" style={{ color: "#dcb81e" }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function WebIcon() {
  return (
    <svg className="h-5 w-5 shrink-0" style={{ color: "#dcb81e" }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" d="M3 12h18M12 3c2.5 2.7 3.75 5.7 3.75 9S14.5 18.3 12 21M12 3C9.5 5.7 8.25 8.7 8.25 12S9.5 18.3 12 21" />
    </svg>
  );
}
