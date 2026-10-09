"use client";

import { useEffect, useState } from "react";
import { useT } from "@/components/i18n-provider";

type View = "page" | "card";
type Device = "desktop" | "phone";
type Viewer = "member" | "guest";

/**
 * Vista previa con la misma página pública del anuncio (`/listings/[slug]`), armada en el servidor con lo que hay
 * en el formulario y la misma lógica que al publicar: nombre público, contactos, mapa, reglas y detalles.
 */
export function ListingPreview({
  draftId,
  body,
  problems,
  publishLabel,
  publishing,
  onPublish,
  onClose,
}: {
  draftId: string;
  /** Lo mismo que se manda al publicar: cambios del formulario y cuenta destino. */
  body: Record<string, unknown>;
  problems: string[];
  publishLabel: string;
  publishing: boolean;
  onPublish: () => void;
  onClose: () => void;
}) {
  const t = useT();
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [mapFound, setMapFound] = useState(true);
  const [view, setView] = useState<View>("page");
  const [device, setDevice] = useState<Device>("desktop");
  const [viewer, setViewer] = useState<Viewer>("member");
  const [bodyJson] = useState(() => JSON.stringify(body));

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/associate/drafts/${draftId}/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: bodyJson,
    })
      .then(async (res) => {
        const j = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok || typeof j.url !== "string") {
          setErr(typeof j.error === "string" ? t(j.error) : t("No se pudo armar la vista previa."));
          return;
        }
        setUrl(j.url);
        setMapFound(j.mapFound !== false);
      })
      .catch(() => !cancelled && setErr(t("No se pudo armar la vista previa.")));
    return () => {
      cancelled = true;
    };
  }, [draftId, bodyJson, t]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const src = url
    ? `${url}?${new URLSearchParams({ ...(view === "card" ? { vista: "tarjeta" } : {}), ...(viewer === "guest" ? { como: "visitante" } : {}) })}`
    : null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/60" role="dialog" aria-modal="true">
      <div className="flex flex-wrap items-center gap-3 bg-gray-900 px-4 py-3 text-white">
        <span className="text-sm font-semibold">👁 {t("Vista previa · así lo verá la gente")}</span>
        <span className="hidden text-xs text-gray-400 sm:inline">{t("Todavía no está publicado.")}</span>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-white/30 px-3 py-1.5 text-sm">
            {t("Seguir editando")}
          </button>
          <button
            type="button"
            disabled={publishing || problems.length > 0}
            onClick={onPublish}
            title={problems.length ? problems.map((p) => t(p)).join("\n") : undefined}
            className="rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-semibold disabled:opacity-40"
          >
            {publishing ? t("Publicando…") : publishLabel}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 bg-white px-4 py-2 text-xs">
        <Toggle
          value={view}
          onChange={setView}
          options={[
            ["page", t("Página del anuncio")],
            ["card", t("Tarjeta en búsquedas")],
          ]}
        />
        <Toggle
          value={device}
          onChange={setDevice}
          options={[
            ["desktop", `🖥 ${t("Computadora")}`],
            ["phone", `📱 ${t("Celular")}`],
          ]}
        />
        {view === "page" && (
          <Toggle
            value={viewer}
            onChange={setViewer}
            options={[
              ["member", t("Visitante con cuenta")],
              ["guest", t("Visitante sin cuenta")],
            ]}
          />
        )}
        {view === "page" && (
          <span className="text-gray-500">
            {viewer === "member"
              ? t("Pícale a «Ver datos de contacto del anfitrión» para ver cómo le salen sus contactos.")
              : t("Sin cuenta, la gente tiene que registrarse gratis para ver teléfono y WhatsApp.")}
          </span>
        )}
      </div>

      {problems.length > 0 && (
        <div className="bg-red-50 px-4 py-2 text-xs text-red-800">
          {t("Falta para publicar:")} {problems.map((p) => t(p)).join(" · ")}
        </div>
      )}
      {url && !mapFound && (
        <div className="bg-amber-50 px-4 py-2 text-xs text-amber-800">
          {t("No encontramos la ubicación en el mapa: revisa la ciudad y la colonia, si no el mapa sale en un lugar equivocado.")}
        </div>
      )}

      <div className="flex flex-1 justify-center overflow-hidden bg-gray-200">
        {err ? (
          <p className="self-center rounded-lg bg-white px-4 py-3 text-sm text-red-700">{err}</p>
        ) : !src ? (
          <p className="self-center text-sm text-gray-600">{t("Armando la vista previa…")}</p>
        ) : (
          <iframe
            key={src}
            src={src}
            title={t("Vista previa del anuncio")}
            className={`h-full bg-white ${device === "phone" ? "my-3 w-[390px] rounded-2xl border-8 border-gray-900" : "w-full"}`}
          />
        )}
      </div>
    </div>
  );
}

function Toggle<V extends string>({
  value,
  onChange,
  options,
}: {
  value: V;
  onChange: (v: V) => void;
  options: [V, string][];
}) {
  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-gray-300">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={`px-2.5 py-1 ${value === v ? "bg-gray-900 text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
