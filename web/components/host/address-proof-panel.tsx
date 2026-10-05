"use client";

import { useCallback, useEffect, useState } from "react";
import { useT } from "@/components/i18n-provider";
import { ADDRESS_PROOF_GEOLOCATION_ENABLED } from "@/lib/feature-flags";

type DeviceLoc = { lat: number; lng: number; accuracy: number };

type Latest = { status: "pending" | "approved" | "rejected" | "review"; createdAt: string; message: string | null; reasons: string[] };
type Row = {
  listingId: string;
  title: string;
  address: string;
  hasAddress: boolean;
  locationVerified: boolean;
  covered?: boolean;
  latest: Latest | null;
};

/**
 * Segunda insignia, por anuncio: "Ubicación verificada". Se gana con un recibo (luz, agua, internet, renta…)
 * cuya dirección coincide con la del anuncio. La identidad se verifica aparte.
 */
export function AddressProofPanel({ surface }: { surface: "app" | "web" }) {
  const t = useT();
  const editHref = (id: string) => (surface === "app" ? `/host/anuncios/${id}` : `/host/listings/${id}/edit?tab=ubicacion`);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [identityVerified, setIdentityVerified] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const [loc, setLoc] = useState<DeviceLoc | null>(null);
  const [locBusy, setLocBusy] = useState(false);
  const [locErr, setLocErr] = useState<string | null>(null);

  function shareLocation() {
    if (!("geolocation" in navigator)) return setLocErr("Tu dispositivo no permite compartir la ubicación.");
    setLocBusy(true);
    setLocErr(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
        setLocBusy(false);
      },
      (e) => {
        setLocErr(e.code === e.PERMISSION_DENIED ? "No diste permiso para usar tu ubicación." : "No pudimos obtener tu ubicación. Intenta de nuevo.");
        setLocBusy(false);
      },
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 }
    );
  }

  useEffect(() => {
    let alive = true;
    fetch("/api/host/address-proof")
      .then((r) => r.json())
      .catch(() => ({}))
      .then((j: { listings?: Row[]; identityVerified?: boolean }) => {
        if (!alive) return;
        setRows(j.listings ?? []);
        setIdentityVerified(Boolean(j.identityVerified));
      });
    return () => {
      alive = false;
    };
  }, [version]);

  async function upload(listingId: string, file: File) {
    setBusy(listingId);
    setErr(null);
    const fd = new FormData();
    fd.set("listingId", listingId);
    fd.set("file", file);
    if (ADDRESS_PROOF_GEOLOCATION_ENABLED && loc) {
      fd.set("lat", String(loc.lat));
      fd.set("lng", String(loc.lng));
      fd.set("accuracy", String(loc.accuracy));
    }
    try {
      const res = await fetch("/api/host/address-proof", { method: "POST", body: fd });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) setErr(j.error ?? t("No se pudo subir el comprobante."));
    } finally {
      setBusy(null);
      reload();
    }
  }

  if (!rows) return <p className="text-sm text-[#888]">{t("Cargando…")}</p>;
  const anyMissing = rows.some((r) => !r.locationVerified);

  return (
    <section className="rounded-xl border border-[#ebebeb] bg-white p-5">
      <h2 className="text-base font-semibold text-[#222]">📍 {t("Ubicación verificada")}</h2>
      <p className="mt-1 text-sm leading-relaxed text-[#717171]">
        {t(
          "Sube un recibo reciente donde se vea la dirección del alojamiento: luz, agua, gas, teléfono, internet, predial, estado de cuenta o contrato de renta. Puede estar a nombre de otra persona. Lo revisa una IA y, si hay dudas, una persona del equipo. El documento nunca se muestra a nadie."
        )}
      </p>

      {identityVerified && anyMissing && rows.length > 0 && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
          {t(
            "Tu identidad ya está verificada y esa insignia sí aparece. La de «Ubicación verificada» no aparecerá en un anuncio hasta que subas un comprobante que coincida con su dirección."
          )}
        </p>
      )}
      {err && (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {t(err)}
        </p>
      )}
      {ADDRESS_PROOF_GEOLOCATION_ENABLED && rows.some((r) => r.hasAddress && !r.locationVerified) && (
        <div className="mt-3 rounded-lg border border-[#f0f0f0] bg-[#fafafa] px-3 py-2.5">
          <p className="text-sm font-semibold text-[#222]">{t("Opcional: comparte tu ubicación")}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-[#717171]">
            {t("Hazlo estando en el alojamiento, antes de subir el recibo. Nos ayuda a confirmar que la dirección es real; no se muestra a nadie.")}
          </p>
          {loc ? (
            <p className="mt-2 text-xs font-medium text-green-800">
              {t("Ubicación lista (±{m} m). Se enviará con tu comprobante.", { m: String(Math.round(loc.accuracy)) })}
            </p>
          ) : (
            <button
              type="button"
              onClick={shareLocation}
              disabled={locBusy}
              className="mt-2 rounded-lg border border-[#222] px-3 py-1.5 text-xs font-semibold text-[#222] disabled:opacity-50"
            >
              {locBusy ? t("Obteniendo ubicación…") : t("Compartir mi ubicación")}
            </button>
          )}
          {locErr && <p className="mt-1 text-xs text-red-600">{t(locErr)}</p>}
        </div>
      )}
      {rows.length === 0 && <p className="mt-3 text-sm text-[#888]">{t("Todavía no tienes anuncios.")}</p>}

      <ul className="mt-4 space-y-3">
        {rows.map((r) => (
          <li key={r.listingId} className="rounded-lg border border-[#f0f0f0] p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#222]">{r.title}</p>
                <p className="text-xs text-[#888]">{r.address || t("Sin dirección")}</p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                  r.locationVerified
                    ? "bg-green-100 text-green-800"
                    : r.latest?.status === "review" || r.latest?.status === "pending"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-[#f3f3f3] text-[#666]"
                }`}
              >
                {r.locationVerified
                  ? t("Verificada")
                  : r.latest?.status === "review" || r.latest?.status === "pending"
                    ? t("En revisión")
                    : r.latest?.status === "rejected"
                      ? t("Rechazado")
                      : t("Sin comprobante")}
              </span>
            </div>
            {r.locationVerified && r.covered === false && (
              <p className="mt-2 text-xs text-amber-800">
                {t("Comprobante aprobado. La insignia se muestra cuando el anuncio tiene la verificación de domicilio pagada.")}{" "}
                <a href="/tienda" className="font-semibold underline">
                  {t("Ir a la Tienda")}
                </a>
              </p>
            )}
            {!r.locationVerified && r.latest?.message && (
              <p className="mt-2 text-xs text-[#484848]">{t(r.latest.message)}</p>
            )}
            {!r.locationVerified && r.latest?.status === "rejected" && r.latest.reasons.length > 0 && (
              <ul className="mt-1 list-disc pl-5 text-xs text-[#717171]">
                {r.latest.reasons.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            )}
            {r.locationVerified && r.latest?.status !== "approved" && (
              <p className="mt-2 text-xs text-[#717171]">{t("Tienes un comprobante aprobado anterior para esta dirección.")}</p>
            )}
            {!r.hasAddress ? (
              <a href={editHref(r.listingId)} className="mt-2 inline-block text-xs font-semibold text-[#222] underline">
                {t("Primero escribe la dirección completa del anuncio")}
              </a>
            ) : (
              !r.locationVerified &&
              r.latest?.status !== "review" && (
                <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-black px-3 py-2 text-xs font-semibold text-white hover:bg-[#222]">
                  {busy === r.listingId ? t("Revisando… (hasta 1 minuto)") : t("Subir comprobante")}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    className="hidden"
                    disabled={busy !== null}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (f) void upload(r.listingId, f);
                    }}
                  />
                </label>
              )
            )}
          </li>
        ))}
      </ul>
      <p className="mt-4 text-[11px] text-[#999]">
        {t("Si cambias la dirección del anuncio, la insignia se quita hasta que subas un comprobante de la nueva dirección.")}
      </p>
    </section>
  );
}
