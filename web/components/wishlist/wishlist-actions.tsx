"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/components/i18n-provider";
import { shareOrCopy } from "@/components/share-link-button";
import { dropWishlist, loadWishlists, patchWishlist } from "@/components/wishlist/wishlist-client";
import type { WishlistPerson } from "@/lib/wishlist-view";

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const t = useT();
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);
  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/50 sm:items-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-md rounded-t-3xl bg-white sm:rounded-3xl">
        <div className="relative flex items-center justify-center border-b border-[#f0f0f0] px-5 py-4">
          <h2 className="text-base font-semibold text-[#222]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 flex h-9 w-9 items-center justify-center rounded-full text-xl text-[#555] hover:bg-[#f5f5f5]"
            aria-label={t("Cerrar")}
          >
            ×
          </button>
        </div>
        <div className="px-5 py-5" style={{ paddingBottom: "calc(20px + env(safe-area-inset-bottom))" }}>
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}

/** Compartir, editar, borrar o salir de una lista; y ver quién está en ella. */
export function WishlistActions({
  id,
  name,
  checkIn,
  checkOut,
  isOwner,
  people,
  shared,
  backHref,
}: {
  id: string;
  name: string;
  checkIn?: string;
  checkOut?: string;
  isOwner: boolean;
  people: WishlistPerson[];
  shared: boolean;
  backHref: string;
}) {
  const t = useT();
  const router = useRouter();
  const [modal, setModal] = useState<null | "edit" | "people">(null);
  const [form, setForm] = useState({ name, checkIn: checkIn ?? "", checkOut: checkOut ?? "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3000);
  };

  const share = async () => {
    setError(null);
    try {
      const { token } = await patchWishlist(id, { share: true });
      if (!token) return;
      const url = new URL(`/viaje/${token}`, window.location.origin).toString();
      const result = await shareOrCopy({
        url,
        title: name,
        text: t("Te invito a planear «{name}» en Cabibee. Abre el enlace para ver los alojamientos y agregar los tuyos.", { name }),
      });
      if (result === "copied") flash(t("Enlace copiado. Pégalo en WhatsApp, correo o donde quieras."));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("No se pudo compartir."));
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await patchWishlist(id, form);
      setModal(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("No se pudo guardar."));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    const question = isOwner
      ? t("¿Borrar «{name}»? También se borra para quienes la compartiste.", { name })
      : t("¿Salir de «{name}»? Ya no la verás en tus favoritos.", { name });
    if (!window.confirm(question)) return;
    setBusy(true);
    const r = await fetch(`/api/wishlists/${encodeURIComponent(id)}`, { method: "DELETE", credentials: "include" });
    setBusy(false);
    if (!r.ok) {
      setError(t("No se pudo completar."));
      return;
    }
    dropWishlist(id);
    router.push(backHref);
    router.refresh();
  };

  const removePerson = async (memberId: string) => {
    setBusy(true);
    try {
      await patchWishlist(id, { removeMember: memberId });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("No se pudo completar."));
    } finally {
      setBusy(false);
    }
  };

  const stopSharing = async () => {
    if (!window.confirm(t("El enlace dejará de servir y los invitados ya no verán la lista. ¿Seguir?"))) return;
    setBusy(true);
    try {
      await patchWishlist(id, { stopSharing: true });
      await loadWishlists(true);
      setModal(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("No se pudo completar."));
    } finally {
      setBusy(false);
    }
  };

  const chip = "rounded-full border border-[#ddd] bg-white px-4 py-2 text-sm font-semibold text-[#222] active:bg-[#f5f5f5]";

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void share()} className="rounded-full bg-[#222] px-4 py-2 text-sm font-semibold text-white">
          ↗ {t("Compartir")}
        </button>
        <button type="button" onClick={() => setModal("people")} className={chip}>
          {t(people.length === 1 ? "Sólo tú" : "{n} personas", { n: people.length })}
        </button>
        <button
          type="button"
          onClick={() => {
            setForm({ name, checkIn: checkIn ?? "", checkOut: checkOut ?? "" });
            setModal("edit");
          }}
          className={chip}
        >
          {t("Editar")}
        </button>
        <button type="button" onClick={() => void remove()} disabled={busy} className={`${chip} text-[#c13515]`}>
          {isOwner ? t("Borrar") : t("Salir")}
        </button>
      </div>
      {notice && <p className="mt-3 rounded-xl bg-[#eef7f0] px-3 py-2 text-sm text-[#1e7a3a]">{notice}</p>}
      {error && !modal && <p className="mt-3 text-sm text-[#c13515]">{error}</p>}

      {modal === "edit" && (
        <Modal title={t("Editar lista")} onClose={() => setModal(null)}>
          <form onSubmit={save} className="space-y-4">
            <label className="block">
              <span className="text-sm font-semibold text-[#222]">{t("Nombre de la lista")}</span>
              <input
                value={form.name}
                maxLength={60}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-1.5 w-full rounded-xl border border-[#bbb] px-3 py-3 text-[15px] outline-none focus:border-[#222]"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-sm font-semibold text-[#222]">{t("Llegada")}</span>
                <input
                  type="date"
                  value={form.checkIn}
                  onChange={(e) => setForm({ ...form, checkIn: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-[#bbb] px-3 py-3 text-[15px] outline-none focus:border-[#222]"
                />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-[#222]">{t("Salida")}</span>
                <input
                  type="date"
                  value={form.checkOut}
                  min={form.checkIn || undefined}
                  onChange={(e) => setForm({ ...form, checkOut: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-[#bbb] px-3 py-3 text-[15px] outline-none focus:border-[#222]"
                />
              </label>
            </div>
            <p className="text-[13px] text-[#717171]">{t("Las fechas son opcionales: ayudan a que todos sepan cuándo es el viaje.")}</p>
            {error && <p className="text-sm text-[#c13515]">{error}</p>}
            <button
              type="submit"
              disabled={busy || !form.name.trim()}
              className="w-full rounded-xl bg-[#222] py-3 text-[15px] font-semibold text-white disabled:opacity-40"
            >
              {busy ? "…" : t("Guardar")}
            </button>
          </form>
        </Modal>
      )}

      {modal === "people" && (
        <Modal title={t("Quién está en esta lista")} onClose={() => setModal(null)}>
          <ul className="divide-y divide-[#eee]">
            {people.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-3">
                <span className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#222] text-sm font-semibold text-white">
                    {p.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="text-[15px] text-[#222]">
                    {p.name}
                    {p.owner && <span className="ml-2 text-[13px] text-[#717171]">{t("Creó la lista")}</span>}
                  </span>
                </span>
                {isOwner && !p.owner && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void removePerson(p.id)}
                    className="text-sm font-semibold text-[#c13515] underline"
                  >
                    {t("Quitar")}
                  </button>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[13px] text-[#717171]">
            {t("Quien abre tu enlace e inicia sesión entra a la lista: ve los alojamientos y puede agregar o quitar.")}
          </p>
          <button
            type="button"
            onClick={() => {
              setModal(null);
              void share();
            }}
            className="mt-4 w-full rounded-xl bg-[#222] py-3 text-[15px] font-semibold text-white"
          >
            ↗ {t("Invitar con un enlace")}
          </button>
          {isOwner && shared && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void stopSharing()}
              className="mt-2 w-full rounded-xl border border-[#ddd] py-3 text-sm font-semibold text-[#c13515]"
            >
              {t("Dejar de compartir")}
            </button>
          )}
          {error && <p className="mt-3 text-sm text-[#c13515]">{error}</p>}
        </Modal>
      )}
    </div>
  );
}
