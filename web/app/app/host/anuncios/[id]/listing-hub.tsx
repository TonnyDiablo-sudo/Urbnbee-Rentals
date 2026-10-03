"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/components/i18n-provider";
import { AMENITY_OPTIONS } from "@/lib/amenity-options";
import type { ArrivalGuide } from "@/lib/arrival-guide";
import { getContractTemplate } from "@/lib/booking-contract-templates";
import { COUNTRY_OPTIONS, isMexico, MX_STATE_LIST } from "@/lib/geo-places";
import { sizedImage } from "@/lib/image-url";
import { taxActive, type HostTaxSettings } from "@/lib/stay-tax";
import type { ListingCategory } from "@/lib/mock-data";
import { IconChevron, IconClose, IconExternal, IconPlus } from "../../../_components/icons";
import { WebLink } from "../../../_components/site-origin";
import { TopBar } from "../../../_components/top-bar";
import { PriceSettings } from "../../calendario/host-calendar";
import { HOST_URLS, dropListing, patchListing, putListing, type HostListing } from "../../_shared/host-data";
import { peekCached, useCached } from "../../../_components/cached-fetch";
import { CATEGORY_OPTIONS, SPACE_OPTIONS } from "../listing-options";

const inputCls = "mt-1 w-full rounded-xl border border-[#ccc] px-3.5 py-3 text-base outline-none focus:border-[#222]";

type PanelId =
  | "photos"
  | "title"
  | "type"
  | "capacity"
  | "description"
  | "amenities"
  | "location"
  | "rules"
  | "booking"
  | "taxes"
  | "times"
  | "checkin"
  | "directions"
  | "wifi"
  | "manual"
  | "checkout";

const money = (n: number) => `$${Math.round(n).toLocaleString("es-MX")}`;

const TAX_URL = "/api/host/tax";

/** Si este anuncio cobra los impuestos que el anfitrión configuró en «Impuestos (IVA)». */
function TaxPanel({ chargeTax, onChange, approval }: { chargeTax: boolean; onChange: (v: boolean) => void; approval: boolean }) {
  const t = useT();
  const { data } = useCached<{ tax: HostTaxSettings | null }>(TAX_URL);
  if (!data) return <p className="text-sm text-[#999]">{t("Cargando…")}</p>;
  const tax = data.tax ?? undefined;
  if (!taxActive(tax)) {
    return (
      <div className="space-y-4">
        <p className="text-[15px] leading-relaxed text-[#333]">
          {t("Todavía no configuras impuestos. Primero elige tu país y los impuestos que cobras (IVA, hospedaje…).")}
        </p>
        <Link href="/host/impuestos" className="block rounded-xl bg-[#dcb81e] py-3.5 text-center font-semibold text-black">
          {t("Configurar impuestos")}
        </Link>
      </div>
    );
  }
  const summary = tax.lines.map((l) => `${l.name} ${l.ratePct}%`).join(" + ");
  return (
    <div className="space-y-4">
      <p className="text-sm text-[#717171]">
        {t("Tus impuestos: {taxes} ({mode}).", {
          taxes: summary,
          mode: t(tax.mode === "included" ? "ya incluidos en el precio" : "se suman al precio"),
        })}
      </p>
      {(
        [
          [true, "Cobrar impuestos en este anuncio", "El huésped ve un solo total. El desglose y el porcentaje quedan en el contrato."],
          [false, "No cobrar impuestos", "Este anuncio no suma impuestos. El precio que ve el huésped es el total."],
        ] as const
      ).map(([v, label, hint]) => (
        <button
          key={String(v)}
          type="button"
          onClick={() => onChange(v)}
          className={`w-full rounded-2xl border p-4 text-left ${chargeTax === v ? "border-[#222] ring-1 ring-[#222]" : "border-[#ddd]"}`}
        >
          <span className="block text-[15px] font-semibold text-[#222]">{t(label)}</span>
          <span className="mt-0.5 block text-sm text-[#717171]">{t(hint)}</span>
        </button>
      ))}
      <p className="rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm leading-relaxed text-[#484848]">
        {approval
          ? t("Como tú apruebas cada solicitud, esto es lo que se propone al huésped. Al aceptar puedes cambiarlo para esa reserva; si el total cambia, se cobra o se devuelve la diferencia.")
          : t("Con reservación inmediata se aplica tal cual al pagar, así que decide aquí.")}
      </p>
      <Link href="/host/impuestos" className="block text-sm font-semibold text-[#222] underline">
        {t("Cambiar país o porcentajes")}
      </Link>
    </div>
  );
}

/** Un anuncio a la manera de Airbnb: «Tu espacio» y «Guía de llegada», cada sección se edita por separado. */
export function ListingHub({ listingId }: { listingId: string }) {
  const t = useT();
  const router = useRouter();
  const detail = useCached<{ listing?: HostListing }>(HOST_URLS.listing(listingId));
  const taxData = useCached<{ tax: HostTaxSettings | null }>(TAX_URL).data;
  const taxOn = taxActive(taxData?.tax ?? undefined);
  const taxSummary = taxOn ? taxData!.tax!.lines.map((l) => `${l.name} ${l.ratePct}%`).join(" + ") : "";
  const fromList = peekCached<{ listings?: HostListing[] }>(HOST_URLS.listings)?.listings?.find((l) => l.id === listingId);
  const listing = detail.data?.listing ?? fromList ?? null;
  const missing = detail.error && !listing;
  const [tab, setTab] = useState<"space" | "arrival">("space");
  const [panel, setPanel] = useState<PanelId | null>(null);
  const [pricesOpen, setPricesOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(id);
  }, [toast]);

  const saved = (l: HostListing, msg = "Cambios guardados.") => {
    putListing(l);
    setPanel(null);
    setToast(msg);
  };

  if (missing) {
    return (
      <>
        <TopBar title={t("Anuncio")} back="/host/anuncios" />
        <p className="px-5 py-6 text-sm text-[#717171]">{t("No encontramos este anuncio.")}</p>
      </>
    );
  }
  if (!listing) {
    return (
      <>
        <TopBar title={t("Anuncio")} back="/host/anuncios" />
        <p className="px-5 py-6 text-sm text-[#999]">{t("Cargando…")}</p>
      </>
    );
  }

  const ag = listing.arrivalGuide ?? {};
  const p = listing.pricing ?? {};
  const category = CATEGORY_OPTIONS.find((c) => c.key === listing.categoryKey);
  const rulesSummary = [
    listing.rules.pets ? t("Mascotas") : null,
    listing.rules.children ? t("Niños") : null,
    listing.rules.smoking ? t("Fumar") : null,
    listing.rules.parties ? t("Fiestas") : null,
  ].filter(Boolean);

  const togglePublish = async () => {
    if (!listing.published && (listing.photos.length === 0 || !listing.city.trim() || listing.pricePerNight <= 0)) {
      setErr("Para publicar necesitas al menos una foto, la ciudad y un precio.");
      return;
    }
    setBusy(true);
    setErr(null);
    const r = await patchListing(listing.id, { published: !listing.published });
    setBusy(false);
    if (r.listing) saved(r.listing, r.listing.published ? "¡Publicado! Ya aparece en Cabibee." : "Anuncio pausado.");
    else setErr(r.error ?? "No se pudo guardar.");
  };

  const remove = async () => {
    if (!window.confirm(t("¿Eliminar «{title}»? No se puede deshacer.", { title: listing.title }))) return;
    setBusy(true);
    const res = await fetch(`/api/host/listings/${listing.id}`, { method: "DELETE" }).catch(() => null);
    setBusy(false);
    if (res?.ok) {
      dropListing(listing.id);
      router.replace("/host/anuncios");
    }
    else setErr("No se pudo eliminar.");
  };

  return (
    <div className="pb-[calc(40px+env(safe-area-inset-bottom))]">
      <TopBar
        title={listing.title}
        back="/host/anuncios"
        right={
          listing.published ? (
            <Link href={`/alojamiento/${listing.slug}`} className="rounded-full px-3 py-1.5 text-sm font-semibold text-[#222] underline">
              {t("Ver")}
            </Link>
          ) : undefined
        }
      />

      <button type="button" onClick={() => setPanel("photos")} className="relative block aspect-[16/10] w-full bg-[#eee]">
        {listing.photos[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={sizedImage(listing.photos[0], 900)} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full flex-col items-center justify-center gap-1 text-sm text-[#717171]">
            <IconPlus />
            {t("Agrega fotos")}
          </span>
        )}
        <span
          className={`absolute left-4 top-4 rounded-full px-3 py-1 text-xs font-semibold shadow ${
            listing.published ? "bg-white text-[#1e7a3a]" : "bg-white text-[#717171]"
          }`}
        >
          ● {listing.published ? t("Publicado") : t("No publicado")}
        </span>
        {listing.photos.length > 0 && (
          <span className="absolute bottom-3 right-3 rounded-lg bg-black/70 px-2.5 py-1 text-xs font-medium text-white">
            {t("{n} fotos", { n: listing.photos.length })}
          </span>
        )}
      </button>

      <div className="px-5 pt-4">
        <div className="grid grid-cols-2 rounded-xl bg-[#f1f1f1] p-1">
          {[
            { id: "space" as const, label: "Tu espacio" },
            { id: "arrival" as const, label: "Guía de llegada" },
          ].map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => setTab(o.id)}
              className={`rounded-lg py-2.5 text-[15px] font-semibold ${tab === o.id ? "bg-white text-[#222] shadow" : "text-[#717171]"}`}
            >
              {t(o.label)}
            </button>
          ))}
        </div>
      </div>

      {err && <p className="mx-5 mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{t(err)}</p>}

      {tab === "space" ? (
        <ul className="mt-2 divide-y divide-[#f0f0f0] px-5">
          <Row label={t("Fotos")} value={t("{n} fotos", { n: listing.photos.length })} onClick={() => setPanel("photos")} />
          <Row label={t("Título")} value={listing.title} onClick={() => setPanel("title")} />
          <Row
            label={t("Tipo de propiedad")}
            value={`${category ? t(category.label) : listing.categoryKey} · ${t(listing.spaceType)}`}
            onClick={() => setPanel("type")}
          />
          <Row
            label={t("Precio")}
            value={[
              t("{price} por noche", { price: money(listing.pricePerNight) }),
              p.weekendPrice ? t("fin de semana {price}", { price: money(p.weekendPrice) }) : null,
              p.weeklyDiscountPct ? t("{n}% semanal", { n: p.weeklyDiscountPct }) : null,
              p.monthlyDiscountPct ? t("{n}% mensual", { n: p.monthlyDiscountPct }) : null,
              p.earlyBirdPct ? t("{n}% anticipada", { n: p.earlyBirdPct }) : null,
              p.lastMinutePct ? t("{n}% última hora", { n: p.lastMinutePct }) : null,
              p.seasonal?.length
                ? t(p.seasonal.length === 1 ? "1 promoción" : "{n} promociones", { n: p.seasonal.length })
                : null,
            ]
              .filter(Boolean)
              .join(" · ")}
            onClick={() => setPricesOpen(true)}
          />
          <Row
            label={t("Disponibilidad")}
            value={p.minNights ? t("Mínimo {n} noches · ver calendario", { n: p.minNights }) : t("Ver calendario")}
            href={`/host/calendario?anuncio=${encodeURIComponent(listing.id)}`}
          />
          <Row
            label={t("Huéspedes y espacios")}
            value={`${t(listing.guests === 1 ? "{n} huésped" : "{n} huéspedes", { n: listing.guests })} · ${t(
              listing.bedrooms === 1 ? "{n} recámara" : "{n} recámaras",
              { n: listing.bedrooms }
            )} · ${t(listing.bathrooms === 1 ? "{n} baño" : "{n} baños", { n: listing.bathrooms })}`}
            onClick={() => setPanel("capacity")}
          />
          <Row label={t("Descripción")} value={listing.description || t("Sin descripción")} onClick={() => setPanel("description")} />
          <Row
            label={t("Amenidades")}
            value={listing.amenities.length ? listing.amenities.slice(0, 3).map((a) => t(a)).join(", ") + (listing.amenities.length > 3 ? "…" : "") : t("Ninguna")}
            onClick={() => setPanel("amenities")}
          />
          <Row
            label={t("Ubicación")}
            value={[listing.zone, listing.city, listing.state].filter(Boolean).join(", ") || t("Sin ciudad")}
            onClick={() => setPanel("location")}
          />
          <Row
            label={t("Reglas de la casa")}
            value={rulesSummary.length ? t("Se permite: {list}", { list: rulesSummary.join(", ") }) : t("Nada adicional permitido")}
            onClick={() => setPanel("rules")}
          />
          <Row
            label={t("Cómo se reserva")}
            value={
              listing.bookingApprovalMode === "instant"
                ? listing.requireCreditCheck
                  ? t("Reservación inmediata · pide historial")
                  : t("Reservación inmediata")
                : listing.requireCreditCheck
                  ? t("Tú apruebas · pide historial")
                  : t("Tú apruebas cada solicitud")
            }
            onClick={() => setPanel("booking")}
          />
          <Row
            label={t("Impuestos")}
            value={
              !taxOn
                ? t("No configurados")
                : listing.chargeTax === false
                  ? t("No se cobran en este anuncio")
                  : listing.bookingApprovalMode === "instant"
                    ? t("Se cobran {taxes}", { taxes: taxSummary })
                    : t("Se cobran {taxes} · decides al aceptar", { taxes: taxSummary })
            }
            onClick={() => setPanel("taxes")}
          />
          <Row
            label={t("Contrato")}
            value={t(getContractTemplate(listing.contract?.templateId).title)}
            href={`/host/contratos?anuncio=${encodeURIComponent(listing.id)}`}
          />
        </ul>
      ) : (
        <>
          <p className="mx-5 mt-4 rounded-2xl bg-[#fdf6d8] px-4 py-3 text-sm text-[#5c4a0a]">
            {t("El huésped ve esta guía en «Viajes» en cuanto su reserva está confirmada.")}
          </p>
          <ul className="mt-2 divide-y divide-[#f0f0f0] px-5">
            <Row
              label={t("Llegada y salida")}
              value={
                ag.checkInTime || ag.checkOutTime
                  ? `${ag.checkInTime ? t("Llegada {time}", { time: ag.checkInTime }) : ""}${ag.checkInTime && ag.checkOutTime ? " · " : ""}${
                      ag.checkOutTime ? t("Salida {time}", { time: ag.checkOutTime }) : ""
                    }`
                  : t("Agregar horarios")
              }
              onClick={() => setPanel("times")}
            />
            <Row label={t("Cómo entrar")} value={ag.checkInMethod || t("Agregar detalles")} onClick={() => setPanel("checkin")} />
            <Row label={t("Cómo llegar")} value={ag.directions || t("Agregar detalles")} onClick={() => setPanel("directions")} />
            <Row
              label={t("Wifi")}
              value={ag.wifiName ? `${ag.wifiName}${ag.wifiPassword ? " · ••••••" : ""}` : t("Agregar detalles")}
              onClick={() => setPanel("wifi")}
            />
            <Row label={t("Manual de la casa")} value={ag.houseManual || t("Agregar detalles")} onClick={() => setPanel("manual")} />
            <Row
              label={t("Instrucciones de salida")}
              value={ag.checkoutInstructions || t("Agregar detalles")}
              onClick={() => setPanel("checkout")}
            />
          </ul>
        </>
      )}

      <div className="mt-6 space-y-3 px-5">
        <button
          type="button"
          disabled={busy}
          onClick={() => void togglePublish()}
          className={`w-full rounded-xl py-3.5 text-[15px] font-semibold disabled:opacity-50 ${
            listing.published ? "border border-[#222] text-[#222]" : "bg-[#dcb81e] text-black"
          }`}
        >
          {listing.published ? t("Pausar anuncio") : t("Publicar anuncio")}
        </button>
        <WebLink
          path={`/host/listings/${listing.id}/edit`}
          className="flex items-center justify-between rounded-2xl bg-[#f7f7f7] px-4 py-3.5 text-sm text-[#333]"
        >
          <span>{t("Contrato y pin exacto en el mapa")}</span>
          <span className="flex shrink-0 items-center gap-1 text-xs text-[#999]">
            {t("web")} <IconExternal />
          </span>
        </WebLink>
        <button type="button" disabled={busy} onClick={() => void remove()} className="w-full py-3 text-sm font-semibold text-red-600 underline">
          {t("Eliminar anuncio")}
        </button>
      </div>

      {toast && (
        <p className="fixed inset-x-0 top-4 z-[120] mx-auto w-fit rounded-full bg-[#111] px-4 py-2 text-sm font-medium text-white shadow-lg">
          {t(toast)}
        </p>
      )}

      <PriceSettings
        key={`prices:${pricesOpen}`}
        open={pricesOpen}
        listing={listing}
        onClose={() => setPricesOpen(false)}
        onSaved={(l) => {
          setPricesOpen(false);
          saved(l, "Precios guardados.");
        }}
      />

      {panel && (
        <PanelBody key={panel} id={panel} listing={listing} onClose={() => setPanel(null)} onSaved={(l) => saved(l)} onPhotos={putListing} />
      )}
    </div>
  );
}

function Row({ label, value, onClick, href }: { label: string; value: string; onClick?: () => void; href?: string }) {
  const body = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium text-[#222]">{label}</span>
        <span className="mt-0.5 line-clamp-2 block text-sm text-[#717171]">{value}</span>
      </span>
      <IconChevron className="h-5 w-5 shrink-0 text-[#999]" />
    </>
  );
  return (
    <li>
      {href ? (
        <Link href={href} className="flex items-center gap-3 py-4">
          {body}
        </Link>
      ) : (
        <button type="button" onClick={onClick} className="flex w-full items-center gap-3 py-4 text-left">
          {body}
        </button>
      )}
    </li>
  );
}

const PANEL_TITLE: Record<PanelId, string> = {
  photos: "Fotos",
  title: "Título",
  type: "Tipo de propiedad",
  capacity: "Huéspedes y espacios",
  description: "Descripción",
  amenities: "Amenidades",
  location: "Ubicación",
  rules: "Reglas de la casa",
  booking: "Cómo se reserva",
  taxes: "Impuestos",
  times: "Llegada y salida",
  checkin: "Cómo entrar",
  directions: "Cómo llegar",
  wifi: "Wifi",
  manual: "Manual de la casa",
  checkout: "Instrucciones de salida",
};

/** Pantalla completa para editar una sección; guarda sólo lo de esa sección. */
function PanelBody({
  id,
  listing,
  onClose,
  onSaved,
  onPhotos,
}: {
  id: PanelId;
  listing: HostListing;
  onClose: () => void;
  onSaved: (l: HostListing) => void;
  onPhotos: (l: HostListing) => void;
}) {
  const t = useT();
  const [draft, setDraft] = useState(() => ({
    title: listing.title,
    categoryKey: listing.categoryKey,
    spaceType: listing.spaceType,
    guests: listing.guests,
    bedrooms: listing.bedrooms,
    bathrooms: listing.bathrooms,
    description: listing.description,
    amenities: [...listing.amenities],
    city: listing.city,
    zone: listing.zone,
    county: listing.county,
    state: listing.state ?? "",
    country: listing.country,
    addressLine: listing.addressLine,
    locationPrecision: listing.locationPrecision ?? "approximate",
    rules: { ...listing.rules },
    bookingApprovalMode: listing.bookingApprovalMode,
    requireCreditCheck: listing.requireCreditCheck === true,
    creditCheckPayer: listing.creditCheckPayer === "host" ? "host" : "guest",
    chargeTax: listing.chargeTax !== false,
    arrival: { ...(listing.arrivalGuide ?? {}) } as ArrivalGuide,
  }));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const set = <K extends keyof typeof draft>(k: K, v: (typeof draft)[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const setArrival = (k: keyof ArrivalGuide, v: string) => setDraft((d) => ({ ...d, arrival: { ...d.arrival, [k]: v } }));

  const bodyFor = (): Record<string, unknown> => {
    switch (id) {
      case "title":
        return { title: draft.title.trim() };
      case "type":
        return { categoryKey: draft.categoryKey, spaceType: draft.spaceType };
      case "capacity":
        return { guests: draft.guests, bedrooms: draft.bedrooms, bathrooms: draft.bathrooms };
      case "description":
        return { description: draft.description };
      case "amenities":
        return { amenities: draft.amenities };
      case "location":
        return {
          city: draft.city,
          zone: draft.zone,
          county: draft.county,
          state: draft.state,
          country: draft.country,
          addressLine: draft.addressLine,
          locationPrecision: draft.locationPrecision,
        };
      case "rules":
        return { rules: draft.rules, arrivalGuide: draft.arrival };
      case "booking":
        return {
          bookingApprovalMode: draft.bookingApprovalMode,
          requireCreditCheck: draft.requireCreditCheck,
          creditCheckPayer: draft.creditCheckPayer,
        };
      case "taxes":
        return { chargeTax: draft.chargeTax };
      default:
        return { arrivalGuide: draft.arrival };
    }
  };

  const save = async () => {
    if (id === "title" && draft.title.trim().length < 4) {
      setErr("El título necesita al menos 4 letras.");
      return;
    }
    setBusy(true);
    setErr(null);
    const body = bodyFor();
    if (id === "location") {
      const q = [draft.addressLine, draft.zone, draft.city, draft.county, draft.state, draft.country]
        .map((x) => x.trim())
        .filter(Boolean)
        .join(", ");
      const geo = q.length >= 5 ? await fetch(`/api/geocode?q=${encodeURIComponent(q)}`).then((x) => (x.ok ? x.json() : null)).catch(() => null) : null;
      if (geo && typeof geo.lat === "number" && typeof geo.lng === "number") Object.assign(body, { lat: geo.lat, lng: geo.lng });
    }
    const r = await patchListing(listing.id, body);
    setBusy(false);
    if (r.listing) onSaved(r.listing);
    else setErr(r.error ?? "No se pudo guardar.");
  };

  const ta = (k: keyof ArrivalGuide, placeholder: string) => (
    <textarea
      value={draft.arrival[k] ?? ""}
      onChange={(e) => setArrival(k, e.target.value)}
      rows={8}
      placeholder={t(placeholder)}
      className={inputCls}
    />
  );

  return (
    <div className="fixed inset-0 z-[100] flex justify-center bg-black/40">
      <div role="dialog" aria-modal="true" aria-label={t(PANEL_TITLE[id])} className="flex h-dvh w-full max-w-xl flex-col bg-white">
        <header
          className="flex items-center gap-2 border-b border-[#f0f0f0] px-3"
          style={{ paddingTop: "env(safe-area-inset-top)", minHeight: "calc(56px + env(safe-area-inset-top))" }}
        >
          <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full text-[#222]" aria-label={t("Cerrar")}>
            <IconClose />
          </button>
          <h2 className="min-w-0 flex-1 truncate text-base font-semibold text-[#222]">{t(PANEL_TITLE[id])}</h2>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {id === "photos" && <PhotoManager listing={listing} onChange={onPhotos} />}

          {id === "title" && (
            <label className="block text-sm font-medium text-[#222]">
              {t("Un título corto y claro funciona mejor.")}
              <input value={draft.title} maxLength={90} onChange={(e) => set("title", e.target.value)} className={inputCls} />
              <span className="mt-1 block text-right text-xs text-[#999]">{draft.title.length}/90</span>
            </label>
          )}

          {id === "type" && (
            <>
              <p className="text-sm font-semibold text-[#222]">{t("¿Qué tipo de lugar es?")}</p>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORY_OPTIONS.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => set("categoryKey", c.key as ListingCategory)}
                    className={`rounded-2xl border p-4 text-left ${draft.categoryKey === c.key ? "border-[#222] ring-1 ring-[#222]" : "border-[#ddd]"}`}
                  >
                    <span className="text-2xl">{c.emoji}</span>
                    <span className="mt-1 block text-[15px] font-medium">{t(c.label)}</span>
                  </button>
                ))}
              </div>
              <p className="pt-2 text-sm font-semibold text-[#222]">{t("¿Qué espacio usan los huéspedes?")}</p>
              <div className="space-y-2">
                {[...new Set([...SPACE_OPTIONS, draft.spaceType])].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => set("spaceType", s)}
                    className={`w-full rounded-2xl border px-4 py-3.5 text-left text-[15px] ${draft.spaceType === s ? "border-[#222] ring-1 ring-[#222]" : "border-[#ddd]"}`}
                  >
                    {t(s)}
                  </button>
                ))}
              </div>
            </>
          )}

          {id === "capacity" && (
            <div className="divide-y divide-[#f0f0f0]">
              <Counter label={t("Huéspedes")} value={draft.guests} min={1} onChange={(v) => set("guests", v)} />
              <Counter label={t("Recámaras")} value={draft.bedrooms} min={0} onChange={(v) => set("bedrooms", v)} />
              <Counter label={t("Baños")} value={draft.bathrooms} min={0} onChange={(v) => set("bathrooms", v)} />
            </div>
          )}

          {id === "description" && (
            <textarea
              value={draft.description}
              rows={12}
              onChange={(e) => set("description", e.target.value)}
              className={inputCls}
              placeholder={t("Qué hace especial tu espacio, qué hay cerca, cómo es la llegada…")}
            />
          )}

          {id === "amenities" && (
            <div className="flex flex-wrap gap-2">
              {[...new Set([...AMENITY_OPTIONS, ...draft.amenities])].map((a) => {
                const on = draft.amenities.includes(a);
                return (
                  <button
                    key={a}
                    type="button"
                    onClick={() => set("amenities", on ? draft.amenities.filter((x) => x !== a) : [...draft.amenities, a])}
                    className={`rounded-full border px-3.5 py-2 text-sm font-medium ${on ? "border-[#222] bg-[#222] text-white" : "border-[#ddd] text-[#444]"}`}
                  >
                    {on ? "✓ " : ""}
                    {t(a)}
                  </button>
                );
              })}
            </div>
          )}

          {id === "location" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-medium text-[#222]">
                  {t("País")}
                  <input list="cb-countries" value={draft.country} onChange={(e) => set("country", e.target.value)} className={inputCls} />
                  <datalist id="cb-countries">
                    {COUNTRY_OPTIONS.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </label>
                <label className="block text-sm font-medium text-[#222]">
                  {t("Estado / provincia")}
                  <input
                    list={isMexico(draft.country) ? "cb-mx-states" : undefined}
                    value={draft.state}
                    onChange={(e) => set("state", e.target.value)}
                    className={inputCls}
                  />
                  <datalist id="cb-mx-states">
                    {MX_STATE_LIST.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                </label>
                <label className="block text-sm font-medium text-[#222]">
                  {t("Ciudad")}
                  <input value={draft.city} onChange={(e) => set("city", e.target.value)} className={inputCls} />
                </label>
                <label className="block text-sm font-medium text-[#222]">
                  {t("Municipio (opcional)")}
                  <input value={draft.county} onChange={(e) => set("county", e.target.value)} className={inputCls} />
                </label>
              </div>
              <label className="block text-sm font-medium text-[#222]">
                {t("Colonia / zona")}
                <input value={draft.zone} onChange={(e) => set("zone", e.target.value)} className={inputCls} />
              </label>
              <label className="block text-sm font-medium text-[#222]">
                {t("Calle, número y código postal")}
                <input value={draft.addressLine} onChange={(e) => set("addressLine", e.target.value)} className={inputCls} autoComplete="street-address" />
                <span className="mt-1 block text-xs text-[#717171]">{t("Al guardar, el mapa se centra con esta dirección.")}</span>
              </label>
              <div className="space-y-2 rounded-xl border border-[#ebebeb] p-3">
                <p className="text-sm font-semibold text-[#222]">{t("¿Qué ven los huéspedes antes de reservar?")}</p>
                {(
                  [
                    ["approximate", "Ubicación aproximada (recomendado)", "Un círculo de unos cientos de metros; la calle se comparte al confirmar la reserva."],
                    ["exact", "Ubicación exacta", "El punto exacto y la calle son públicos desde el anuncio."],
                  ] as const
                ).map(([value, label, help]) => (
                  <label key={value} className="flex items-start gap-3 text-sm">
                    <input
                      type="radio"
                      name="locationPrecision"
                      className="mt-1"
                      checked={draft.locationPrecision === value}
                      onChange={() => set("locationPrecision", value)}
                    />
                    <span>
                      <span className="font-medium text-[#222]">{t(label)}</span>
                      <span className="block text-xs text-[#717171]">{t(help)}</span>
                    </span>
                  </label>
                ))}
              </div>
            </>
          )}

          {id === "rules" && (
            <>
              {(
                [
                  ["pets", "Se permiten mascotas"],
                  ["children", "Se permiten niños"],
                  ["smoking", "Se permite fumar"],
                  ["parties", "Se permiten fiestas y eventos"],
                ] as const
              ).map(([k, label]) => (
                <div key={k} className="flex items-center justify-between gap-3">
                  <span className="text-[15px] text-[#222]">{t(label)}</span>
                  <YesNo value={draft.rules[k]} onChange={(v) => set("rules", { ...draft.rules, [k]: v })} />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3 border-t border-[#f0f0f0] pt-5">
                <TimeField label="Llegada desde" value={draft.arrival.checkInTime} onChange={(v) => setArrival("checkInTime", v)} />
                <TimeField label="Salida antes de" value={draft.arrival.checkOutTime} onChange={(v) => setArrival("checkOutTime", v)} />
              </div>
            </>
          )}

          {id === "booking" && (
            <div className="space-y-2">
              {(
                [
                  ["approval", "Tú apruebas cada solicitud", "Cuando aceptas, el huésped recibe el contrato, cómo pagarte y, si lo pediste, la liga del historial crediticio."],
                  ["instant", "Reservación inmediata", "Si paga con Stripe y el pago se confirma, la reserva queda aceptada sola. Tú no apruebas nada."],
                ] as const
              ).map(([v, label, hint]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => set("bookingApprovalMode", v)}
                  className={`w-full rounded-2xl border p-4 text-left ${draft.bookingApprovalMode === v ? "border-[#222] ring-1 ring-[#222]" : "border-[#ddd]"}`}
                >
                  <span className="block text-[15px] font-semibold text-[#222]">{t(label)}</span>
                  <span className="mt-0.5 block text-sm text-[#717171]">{t(hint)}</span>
                </button>
              ))}
              <div className="mt-4 rounded-2xl border border-[#ebebeb] p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[15px] font-semibold text-[#222]">{t("Pedir historial crediticio")}</span>
                  <button
                    type="button"
                    onClick={() => set("requireCreditCheck", !draft.requireCreditCheck)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold ${draft.requireCreditCheck ? "bg-[#222] text-white" : "bg-[#f2f2f2] text-[#222]"}`}
                  >
                    {draft.requireCreditCheck ? t("Sí") : t("No")}
                  </button>
                </div>
                <p className="mt-2 text-sm text-[#717171]">
                  {t("Para seguir con la reserva hace falta una consulta de crédito. El huésped recibe la liga para autorizar y, si le toca, pagar. Igual si la reserva es inmediata.")}
                </p>
                {draft.requireCreditCheck && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {(
                      [
                        ["guest", "Lo paga el huésped"],
                        ["host", "Lo pagas tú"],
                      ] as const
                    ).map(([payer, label]) => (
                      <button
                        key={payer}
                        type="button"
                        onClick={() => set("creditCheckPayer", payer)}
                        className={`rounded-xl border px-3 py-2.5 text-sm font-semibold ${draft.creditCheckPayer === payer ? "border-[#222] bg-[#222] text-white" : "border-[#ddd] text-[#222]"}`}
                      >
                        {t(label)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {id === "taxes" && (
            <TaxPanel
              chargeTax={draft.chargeTax}
              onChange={(v) => set("chargeTax", v)}
              approval={listing.bookingApprovalMode !== "instant"}
            />
          )}

          {id === "times" && (
            <div className="grid grid-cols-2 gap-3">
              <TimeField label="Llegada desde" value={draft.arrival.checkInTime} onChange={(v) => setArrival("checkInTime", v)} />
              <TimeField label="Salida antes de" value={draft.arrival.checkOutTime} onChange={(v) => setArrival("checkOutTime", v)} />
            </div>
          )}
          {id === "checkin" && ta("checkInMethod", "Ej.: Caja de llaves junto a la puerta, código 1234. O: te recibo en persona.")}
          {id === "directions" && ta("directions", "Cómo llegar, dónde estacionarse, qué timbre tocar…")}
          {id === "wifi" && (
            <>
              <label className="block text-sm font-medium text-[#222]">
                {t("Nombre de la red")}
                <input value={draft.arrival.wifiName ?? ""} onChange={(e) => setArrival("wifiName", e.target.value)} className={inputCls} />
              </label>
              <label className="block text-sm font-medium text-[#222]">
                {t("Contraseña")}
                <input value={draft.arrival.wifiPassword ?? ""} onChange={(e) => setArrival("wifiPassword", e.target.value)} className={inputCls} />
              </label>
            </>
          )}
          {id === "manual" && ta("houseManual", "Cómo usar el boiler, la tele, la basura, reglas de los vecinos…")}
          {id === "checkout" && ta("checkoutInstructions", "Ej.: Deja las llaves en la caja, saca la basura y apaga el aire.")}

          {err && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{t(err)}</p>}
        </div>

        {id !== "photos" && (
          <div className="border-t border-[#ebebeb] px-5 py-3" style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom))" }}>
            <button
              type="button"
              disabled={busy}
              onClick={() => void save()}
              className="w-full rounded-xl bg-[#dcb81e] py-3.5 text-[15px] font-semibold text-black disabled:opacity-50"
            >
              {busy ? t("Guardando…") : t("Guardar")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function PhotoManager({ listing, onChange }: { listing: HostListing; onChange: (l: HostListing) => void }) {
  const t = useT();
  const [uploading, setUploading] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const setPhotos = async (photos: string[]) => {
    const r = await patchListing(listing.id, { photos });
    if (r.listing) onChange(r.listing);
    else setErr(r.error ?? "No se pudo guardar.");
  };

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setErr(null);
    let current = listing;
    for (const file of Array.from(files)) {
      setUploading((n) => n + 1);
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/host/listings/${listing.id}/photos`, { method: "POST", body: fd }).catch(() => null);
      const j = res ? await res.json().catch(() => ({})) : {};
      if (res?.ok && Array.isArray(j.photos)) {
        current = { ...current, photos: j.photos };
        onChange(current);
      } else {
        setErr(typeof j.error === "string" ? j.error : t("No se pudo subir {name}.", { name: file.name }));
      }
      setUploading((n) => n - 1);
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const move = (i: number, dir: -1 | 1) => {
    const next = [...listing.photos];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    void setPhotos(next);
  };

  return (
    <>
      <p className="text-sm text-[#717171]">{t("La primera es la portada. Usa las flechas para cambiar el orden.")}</p>
      {err && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{t(err)}</p>}
      <div className="grid grid-cols-2 gap-3">
        {listing.photos.map((p, i) => (
          <div key={p} className="relative overflow-hidden rounded-2xl bg-[#eee]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={sizedImage(p, 500)} alt="" className="aspect-square w-full object-cover" />
            {i === 0 && <span className="absolute left-2 top-2 rounded-md bg-white px-2 py-0.5 text-[11px] font-semibold">{t("Portada")}</span>}
            <button
              type="button"
              onClick={() => window.confirm(t("¿Quitar esta foto?")) && void setPhotos(listing.photos.filter((x) => x !== p))}
              className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white"
              aria-label={t("Quitar foto")}
            >
              <IconClose className="h-4 w-4" />
            </button>
            <div className="absolute inset-x-2 bottom-2 flex justify-between">
              <button
                type="button"
                disabled={i === 0}
                onClick={() => move(i, -1)}
                className="h-8 w-8 rounded-full bg-white/90 text-sm font-bold disabled:opacity-0"
                aria-label={t("Mover antes")}
              >
                ←
              </button>
              <button
                type="button"
                disabled={i === listing.photos.length - 1}
                onClick={() => move(i, 1)}
                className="h-8 w-8 rounded-full bg-white/90 text-sm font-bold disabled:opacity-0"
                aria-label={t("Mover después")}
              >
                →
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex aspect-square flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-[#ccc] text-[#555]"
        >
          <IconPlus />
          <span className="text-sm">{uploading > 0 ? t("Subiendo…") : t("Agregar fotos")}</span>
        </button>
      </div>
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => void upload(e.target.files)} />
    </>
  );
}

function Counter({ label, value, min, onChange }: { label: string; value: number; min: number; onChange: (v: number) => void }) {
  const t = useT();
  return (
    <div className="flex items-center justify-between py-4">
      <span className="text-[15px] text-[#222]">{label}</span>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[#bbb] text-lg text-[#222] disabled:opacity-30"
          aria-label={t("Menos {label}", { label: label.toLowerCase() })}
        >
          −
        </button>
        <span className="w-6 text-center text-[15px] font-medium">{value}</span>
        <button
          type="button"
          onClick={() => onChange(Math.min(50, value + 1))}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[#bbb] text-lg text-[#222]"
          aria-label={t("Más {label}", { label: label.toLowerCase() })}
        >
          +
        </button>
      </div>
    </div>
  );
}

function YesNo({ value, onChange }: { value: boolean | null; onChange: (v: boolean) => void }) {
  const t = useT();
  return (
    <div className="flex shrink-0 gap-2">
      {[
        { v: false, label: "No" },
        { v: true, label: "Sí" },
      ].map((o) => (
        <button
          key={o.label}
          type="button"
          onClick={() => onChange(o.v)}
          className={`h-10 min-w-12 rounded-full border px-4 text-sm font-semibold ${value === o.v ? "border-[#222] bg-[#222] text-white" : "border-[#ccc] text-[#444]"}`}
        >
          {t(o.label)}
        </button>
      ))}
    </div>
  );
}

function TimeField({ label, value, onChange }: { label: string; value?: string; onChange: (v: string) => void }) {
  const t = useT();
  return (
    <label className="block text-sm font-medium text-[#222]">
      {t(label)}
      <input type="time" value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={inputCls} />
    </label>
  );
}
