"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLang, useT } from "@/components/i18n-provider";
import { PlaceMap } from "@/components/maps/place-map";
import { TONE_CLS, fmtMxn, guestStatusOf, hostStatusOf } from "@/app/app/_components/booking-status";
import { useSiteUrl } from "@/app/app/_components/site-origin";
import type { BookingDetails } from "@/lib/booking-details";
import { numberLocale } from "@/lib/i18n";

const METHOD: Record<string, string> = { stripe: "Tarjeta (Stripe)", clabe: "Transferencia (CLABE)", zelle: "Zelle", cashapp: "Cash App", oxxo: "Oxxo" };

function longDay(iso: string, lang: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(numberLocale(lang === "en" ? "en" : "es"), {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function stamp(iso: string | undefined, lang: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString(lang === "en" ? "en-US" : "es-MX", { dateStyle: "medium", timeStyle: "short" });
}

/**
 * Todo lo de una reserva en una pantalla: quién se queda, costo y recibo, contrato y, ya confirmada,
 * dirección, mapa y claves. Lo usan el huésped (y sus acompañantes) y el anfitrión, en la app y en la web.
 */
export function BookingDetailsView({ url, chatHref, actions }: { url: string; chatHref?: string; actions?: React.ReactNode }) {
  const t = useT();
  const lang = useLang();
  const siteUrl = useSiteUrl();
  const [d, setD] = useState<BookingDetails | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    fetch(url, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => !cancelled && setD(j?.booking ?? null))
      .catch(() => !cancelled && setD(null));
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (d === undefined) return <p className="py-10 text-center text-sm text-[#999]">{t("Cargando…")}</p>;
  if (d === null) return <p className="py-10 text-center text-sm text-[#717171]">{t("No encontramos esta reserva.")}</p>;

  const host = d.role === "host";
  const st = host ? hostStatusOf(d) : guestStatusOf(d);
  const c = d.cost;
  const box = "rounded-2xl border border-[#ebebeb] bg-white p-4 sm:p-5";
  const h2 = "text-[17px] font-semibold text-[#222]";
  const g = d.arrival;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 pb-10">
      <style>{`@media print{body *{visibility:hidden!important}[data-receipt],[data-receipt] *{visibility:visible!important}[data-receipt]{position:absolute;left:0;top:0;width:100%;border:0}}`}</style>

      <div className="flex items-start gap-3">
        {d.listing.photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={d.listing.photo} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover sm:h-20 sm:w-20" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold leading-snug text-[#222] sm:text-xl">{d.listing.title}</p>
          {d.listing.city && <p className="text-sm text-[#717171]">{d.listing.city}</p>}
          <p className="mt-0.5 text-xs text-[#999]">{t("Código {code}", { code: d.token })}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${TONE_CLS[st.tone]}`}>{t(st.label)}</span>
      </div>

      {d.role === "companion" && (
        <p className="rounded-2xl bg-[#fdf6d8] px-4 py-3 text-sm text-[#6b5308]">
          {t("{name} te agregó a esta estancia como acompañante.", { name: d.booker.name })}
        </p>
      )}

      {actions}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <section className={box}>
            <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-[#ebebeb]">
              <div className="border-r border-[#ebebeb] p-3">
                <p className="text-xs font-semibold uppercase text-[#717171]">{t("Llegada")}</p>
                <p className="mt-0.5 text-[15px] text-[#222]">{longDay(d.checkIn, lang)}</p>
                {d.checkInTime && <p className="text-sm text-[#717171]">{t("desde las {time}", { time: d.checkInTime })}</p>}
              </div>
              <div className="p-3">
                <p className="text-xs font-semibold uppercase text-[#717171]">{t("Salida")}</p>
                <p className="mt-0.5 text-[15px] text-[#222]">{longDay(d.checkOut, lang)}</p>
                {d.checkOutTime && <p className="text-sm text-[#717171]">{t("antes de las {time}", { time: d.checkOutTime })}</p>}
              </div>
            </div>
            <p className="mt-3 text-sm text-[#555]">
              {d.nights} {d.nights === 1 ? t("noche") : t("noches")}
              {d.guestCount ? ` · ${t(d.guestCount === 1 ? "{n} huésped" : "{n} huéspedes", { n: d.guestCount })}` : ""}
            </p>
          </section>

          <section className={box}>
            <h2 className={h2}>{t("Quién se queda")}</h2>
            <ul className="mt-2 divide-y divide-[#f0f0f0]">
              {d.people.map((p, i) => (
                <li key={i} className="flex items-center gap-3 py-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#111] text-sm font-bold text-[#dcb81e]">
                    {p.name.trim().charAt(0).toUpperCase() || "?"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium text-[#222]">{p.name}</p>
                    <p className="text-xs text-[#717171]">
                      {p.booker ? t("Reservó") : t("Acompañante")}
                      {p.hasAccount ? ` · ${t("con cuenta de Cabibee")}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            {!d.guestCount && <p className="mt-1 text-xs text-[#999]">{t("Esta reserva se hizo antes de pedir el número de huéspedes.")}</p>}
          </section>

          {host ? (
            <section className={box}>
              <h2 className={h2}>{t("Quién reserva")}</h2>
              <dl className="mt-2 space-y-1.5 text-[15px]">
                <Row label={t("Nombre")} value={d.booker.name} />
                {d.booker.email && <Row label={t("Correo")} value={d.booker.email} />}
                {d.booker.phone && <Row label={t("Teléfono")} value={d.booker.phone} />}
                <Row label={t("Identidad")} value={d.booker.identityVerified ? `✓ ${t("Verificada")}` : t("Sin verificar")} />
                {d.booker.memberSince && <Row label={t("En Cabibee desde")} value={longDay(d.booker.memberSince, lang)} />}
              </dl>
              {d.guestNotes && <p className="mt-3 whitespace-pre-line rounded-xl bg-[#f7f7f7] px-3 py-2 text-sm text-[#444]">{d.guestNotes}</p>}
            </section>
          ) : (
            <section className={box}>
              <h2 className={h2}>{t("Tu anfitrión")}</h2>
              <div className="mt-2 flex items-center gap-3">
                {d.host.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={d.host.avatarUrl} alt="" className="h-11 w-11 rounded-full object-cover" />
                ) : (
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#111] font-bold text-[#dcb81e]">
                    {d.host.name.charAt(0).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-[#222]">{d.host.name}</p>
                  {d.host.phone && (
                    <a href={`tel:${d.host.phone.replace(/\s+/g, "")}`} className="text-sm text-[#222] underline">
                      {d.host.phone}
                    </a>
                  )}
                </div>
              </div>
            </section>
          )}

          {d.contract && (
            <section className={box}>
              <h2 className={h2}>{t("Contrato")}</h2>
              <dl className="mt-2 space-y-1.5 text-[15px]">
                <Row label={t("Anfitrión")} value={d.contract.hostSignedAt ? `✓ ${stamp(d.contract.hostSignedAt, lang)}` : t("Sin firmar")} />
                <Row label={t("Huésped")} value={d.contract.guestSignedAt ? `✓ ${stamp(d.contract.guestSignedAt, lang)}` : t("Sin firmar")} />
              </dl>
              {d.role !== "companion" && (
                <a
                  href={siteUrl(d.contract.url)}
                  target="_blank"
                  rel="noopener"
                  className="mt-3 block rounded-xl border border-[#222] py-2.5 text-center text-sm font-semibold text-[#222]"
                >
                  {t("Ver contrato")}
                </a>
              )}
            </section>
          )}
        </div>

        <div className="space-y-4">
          <section id="recibo" data-receipt className={box}>
            <div className="flex items-center justify-between gap-3">
              <h2 className={h2}>{t("Recibo")}</h2>
              <button type="button" onClick={() => window.print()} className="rounded-full border border-[#ddd] px-3 py-1.5 text-xs font-semibold text-[#222] print:hidden">
                {t("Imprimir o guardar PDF")}
              </button>
            </div>
            <p className="mt-1 text-xs text-[#999]">
              Cabibee · {d.listing.title} · {t("Código {code}", { code: d.token })}
            </p>
            <dl className="mt-3 space-y-1.5 text-[15px]">
              <Row label={t("{n} noches", { n: d.nights })} value={fmtMxn(c.stayMxn)} />
              {c.cleaningMxn > 0 && <Row label={t("Limpieza")} value={fmtMxn(c.cleaningMxn)} />}
              {c.taxLines.length > 0
                ? c.taxLines.map((l) => (
                    <Row key={l.name} label={`${l.name} (${l.ratePct}%)${c.taxIncluded ? ` · ${t("incluido")}` : ""}`} value={fmtMxn(l.amountMxn)} />
                  ))
                : c.taxMxn > 0 && <Row label={c.taxIncluded ? t("Impuestos incluidos") : t("Impuestos")} value={fmtMxn(c.taxMxn)} />}
              {c.platformFeeMxn > 0 && <Row label={t("Cargo de servicio")} value={fmtMxn(c.platformFeeMxn)} />}
            </dl>
            <div className="mt-3 flex justify-between border-t border-[#ebebeb] pt-3 text-[16px] font-semibold text-[#222]">
              <span>{t("Total")}</span>
              <span>{fmtMxn(c.totalMxn + c.platformFeeMxn)}</span>
            </div>
            <dl className="mt-3 space-y-1.5 text-sm">
              <Row label={t("Pago")} value={c.paidAt ? `✓ ${t("Pagado")} · ${stamp(c.paidAt, lang)}` : t("Sin pagar")} />
              {c.method && <Row label={t("Método")} value={t(METHOD[c.method] ?? c.method)} />}
              {c.balanceDueMxn > 0 && <Row label={t("Diferencia por pagar")} value={fmtMxn(c.balanceDueMxn)} />}
              {c.refundedMxn > 0 && <Row label={t("Reembolsado")} value={`${fmtMxn(c.refundedMxn)}${c.refundedAt ? ` · ${stamp(c.refundedAt, lang)}` : ""}`} />}
              <Row label={t("Reservada el")} value={stamp(d.createdAt, lang)} />
            </dl>
            {d.deposit && d.deposit.amountMxn > 0 && (
              <p className="mt-3 rounded-xl bg-[#f7f7f7] px-3 py-2 text-xs text-[#555]">
                {t("Depósito pactado: ${amount} MXN. Se entrega entre ustedes; Cabibee no lo cobra ni lo guarda.", {
                  amount: d.deposit.amountMxn.toLocaleString("es-MX"),
                })}
              </p>
            )}
          </section>

          {g ? (
            <section className={box}>
              <h2 className={h2}>{t("Datos de llegada")}</h2>
              <div className="mt-2 space-y-3 text-[15px]">
                <Info label={t("Dirección")} value={g.address} />
                {d.listing.lat != null && d.listing.lng != null && (
                  <div className="relative z-0 h-56 overflow-hidden rounded-xl border border-[#ebebeb] [isolation:isolate]">
                    <PlaceMap lat={d.listing.lat} lng={d.listing.lng} zoom={15} exact />
                  </div>
                )}
                {d.listing.lat != null && d.listing.lng != null && (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${d.listing.lat},${d.listing.lng}`}
                    target="_blank"
                    rel="noopener"
                    className="inline-block text-sm font-semibold text-[#222] underline"
                  >
                    {t("Abrir en Google Maps")}
                  </a>
                )}
                <Info label={t("Cómo llegar")} value={g.directions} />
                <Info label={t("Cómo entrar")} value={g.checkInMethod} />
                <Info label={t("Código de acceso")} value={g.accessCode} mono />
                <Info label={t("Wifi")} value={g.wifiName} />
                <Info label={t("Contraseña del wifi")} value={g.wifiPassword} mono />
                <Info label={t("Manual de la casa")} value={g.houseManual} />
                <Info label={t("Instrucciones de salida")} value={g.checkoutInstructions} />
              </div>
            </section>
          ) : (
            !host && (
              <p className="rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm text-[#717171]">
                {t("La dirección exacta, el mapa y las claves aparecen aquí cuando tu reserva esté confirmada.")}
              </p>
            )
          )}

          {(chatHref || d.listing.slug) && (
            <div className="grid gap-2 sm:grid-cols-2">
              {chatHref && (
                <Link href={chatHref} className="rounded-xl bg-[#111] py-3 text-center text-sm font-semibold text-white">
                  {host ? t("Enviar mensaje al huésped") : t("Mensaje al anfitrión")}
                </Link>
              )}
              {d.listing.slug && !host && (
                <Link href={`/alojamiento/${d.listing.slug}`} className="rounded-xl border border-[#ddd] py-3 text-center text-sm font-medium text-[#222]">
                  {t("Ver alojamiento")}
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-[#717171]">{label}</dt>
      <dd className="min-w-0 break-words text-right font-medium text-[#222]">{value}</dd>
    </div>
  );
}

function Info({ label, value, mono }: { label: string; value?: string; mono?: boolean }) {
  if (!value?.trim()) return null;
  return (
    <div>
      <p className="text-sm font-semibold text-[#222]">{label}</p>
      <p className={`mt-0.5 whitespace-pre-line leading-relaxed text-[#333] ${mono ? "font-mono text-base tracking-wide" : ""}`}>{value}</p>
    </div>
  );
}
