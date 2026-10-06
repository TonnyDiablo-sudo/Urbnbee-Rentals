"use client";

import { useEffect, useState } from "react";
import { ContractText } from "@/components/booking/contract-text";
import { useLang, useT } from "@/components/i18n-provider";
import { WebLink } from "../../_components/site-origin";

type Lookup = {
  id: string;
  status: string;
  token: string;
  listingTitle?: string;
  contract?: {
    generated: boolean;
    accepted: boolean;
    hostAcceptedAt?: string;
    hostAcceptedName?: string;
    guestAcceptedAt?: string;
    guestAcceptedName?: string;
    acceptedSha256?: string;
    templateTitle?: string;
    lines?: string[];
    linesTranslated?: string[];
  };
};

function when(iso: string, lang: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString(lang === "en" ? "en-US" : "es-MX", { dateStyle: "medium", timeStyle: "short" });
}

/** El contrato de una reserva tal cual, dentro de la app: firmas, texto y PDF. Nada más. */
export function ContractReader({ token }: { token: string }) {
  const t = useT();
  const lang = useLang();
  const [row, setRow] = useState<Lookup | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    fetch(`/api/bookings/lookup?token=${encodeURIComponent(token)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => alive && setRow(j?.booking ?? null))
      .catch(() => alive && setRow(null));
    return () => {
      alive = false;
    };
  }, [token]);

  if (row === undefined) return <p className="py-10 text-center text-sm text-[#999]">{t("Cargando…")}</p>;
  if (row === null) return <p className="py-10 text-center text-sm text-[#717171]">{t("No encontramos este contrato.")}</p>;

  const c = row.contract;
  const pdfHref = `/api/bookings/contract?token=${encodeURIComponent(token)}&format=pdf`;
  const guestPending = Boolean(c?.generated) && !c?.guestAcceptedAt;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 pb-10">
      <div>
        <p className="text-lg font-semibold leading-snug text-[#222]">{t(c?.templateTitle ?? "Contrato de reserva")}</p>
        <p className="mt-0.5 text-sm text-[#717171]">
          {row.listingTitle} · {t("Código {code}", { code: row.token })}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Signature role={t("Anfitrión")} name={c?.hostAcceptedName} at={c?.hostAcceptedAt} lang={lang} />
        <Signature role={t("Huésped")} name={c?.guestAcceptedName} at={c?.guestAcceptedAt} lang={lang} />
      </div>

      {c?.generated ? (
        <>
          <ContractText
            lines={c.lines ?? []}
            translated={c.linesTranslated}
            className="whitespace-pre-wrap rounded-2xl border border-[#ebebeb] bg-white p-4 text-[13px] leading-relaxed text-[#333]"
          />
          {c.acceptedSha256 && <p className="break-all font-mono text-[11px] text-[#999]">SHA-256: {c.acceptedSha256}</p>}
          <div className="grid gap-2 sm:grid-cols-2">
            <a href={pdfHref} download={`contrato-${row.token}.pdf`} className="rounded-xl bg-[#111] py-3 text-center text-[15px] font-semibold text-white">
              {t("Descargar PDF")}
            </a>
            {guestPending && row.status === "AWAITING_PAYMENT" && (
              <WebLink path={`/contrato/${row.token}?pay=1`} className="rounded-xl bg-[#dcb81e] py-3 text-center text-[15px] font-semibold text-black">
                {t("Firmar y pagar")}
              </WebLink>
            )}
          </div>
        </>
      ) : (
        <p className="rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm text-[#555]">
          {t("El contrato aún no está listo. Si acabas de reservar, recarga en un momento.")}
        </p>
      )}
    </div>
  );
}

function Signature({ role, name, at, lang }: { role: string; name?: string; at?: string; lang: string }) {
  const t = useT();
  return (
    <div className="rounded-2xl border border-[#ebebeb] bg-white p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#999]">{role}</p>
      {at ? (
        <>
          <p className="mt-0.5 text-sm font-semibold text-[#1e7a3a]">✓ {t("Firmado")}</p>
          {name && <p className="truncate text-sm text-[#222]">{name}</p>}
          <p className="text-xs text-[#888]">{when(at, lang)}</p>
        </>
      ) : (
        <p className="mt-0.5 text-sm font-semibold text-[#9a6b00]">{t("Pendiente de firma")}</p>
      )}
    </div>
  );
}
