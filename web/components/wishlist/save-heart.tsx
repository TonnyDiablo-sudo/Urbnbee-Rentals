"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/components/i18n-provider";
import { sizedImage } from "@/lib/image-url";
import {
  createWishlistClient,
  isSavedAnywhere,
  loadWishlists,
  patchWishlist,
  useWishlists,
} from "@/components/wishlist/wishlist-client";

export type Surface = "app" | "web";

export function loginHref(surface: Surface, next: string): string {
  const q = `next=${encodeURIComponent(next)}`;
  return surface === "app" ? `/cuenta/entrar?${q}` : `/login?${q}`;
}

export function HeartIcon({ filled, className = "h-6 w-6" }: { filled: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        d="M12 20.5s-7.5-4.4-9.3-9.2C1.4 7.8 3.6 4.5 7 4.5c2 0 3.6 1.1 5 3 1.4-1.9 3-3 5-3 3.4 0 5.6 3.3 4.3 6.8-1.8 4.8-9.3 9.2-9.3 9.2z"
        fill={filled ? "#e0245e" : "rgba(0,0,0,0.45)"}
        stroke="#fff"
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Corazón para guardar un alojamiento en una lista o viaje.
 * `overlay`: encima de la foto de una tarjeta. `button`: botón con texto (página del alojamiento).
 */
export function SaveHeart({
  slug,
  surface,
  variant = "overlay",
  className = "",
}: {
  slug: string;
  surface: Surface;
  variant?: "overlay" | "button" | "plain";
  className?: string;
}) {
  const t = useT();
  const s = useWishlists();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const saved = isSavedAnywhere(s, slug);

  const onClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const now = s.status === "ready" || s.status === "anon" ? s : await loadWishlists();
    if (now.status === "anon") {
      window.location.href = loginHref(surface, window.location.pathname + window.location.search);
      return;
    }
    setOpen(true);
  };

  return (
    <>
      {variant === "overlay" ? (
        <button
          type="button"
          onClick={onClick}
          aria-label={saved ? t("Guardado en tus listas") : t("Guardar")}
          aria-pressed={saved}
          className={`flex h-9 w-9 items-center justify-center rounded-full active:scale-90 ${className}`}
        >
          <HeartIcon filled={saved} className="h-7 w-7 drop-shadow" />
        </button>
      ) : (
        <button
          type="button"
          onClick={onClick}
          aria-pressed={saved}
          className={
            variant === "plain"
              ? `flex items-center justify-center gap-1.5 ${className}`
              : `flex items-center gap-1.5 rounded-full bg-white px-3 py-2 text-sm font-semibold text-[#222] shadow-md active:scale-95 ${className}`
          }
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
            <path
              d="M12 20.5s-7.5-4.4-9.3-9.2C1.4 7.8 3.6 4.5 7 4.5c2 0 3.6 1.1 5 3 1.4-1.9 3-3 5-3 3.4 0 5.6 3.3 4.3 6.8-1.8 4.8-9.3 9.2-9.3 9.2z"
              fill={saved ? "#e0245e" : "none"}
              stroke={saved ? "#e0245e" : "#222"}
              strokeWidth={1.8}
              strokeLinejoin="round"
            />
          </svg>
          {saved ? t("Guardado") : t("Guardar")}
        </button>
      )}
      {open && (
        <SaveSheet
          slug={slug}
          onClose={(changed) => {
            setOpen(false);
            if (changed) router.refresh();
          }}
        />
      )}
    </>
  );
}

function SaveSheet({ slug, onClose: done }: { slug: string; onClose: (changed: boolean) => void }) {
  const t = useT();
  const s = useWishlists();
  const changed = useRef(false);
  const doneRef = useRef(done);
  useEffect(() => {
    doneRef.current = done;
  });
  const onClose = () => doneRef.current(changed.current);
  const [creating, setCreating] = useState(s.lists.length === 0);
  const [name, setName] = useState(s.lists.length === 0 ? t("Favoritos") : "");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && doneRef.current(changed.current);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const toggle = async (id: string, on: boolean) => {
    setBusy(id);
    setError(null);
    try {
      await patchWishlist(id, { slug, saved: on });
      changed.current = true;
    } catch (e) {
      setError(e instanceof Error ? e.message : t("No se pudo guardar."));
    } finally {
      setBusy(null);
    }
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy("new");
    setError(null);
    try {
      await createWishlistClient({ name: name.trim(), slug });
      changed.current = true;
      setCreating(false);
      setName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("No se pudo guardar."));
    } finally {
      setBusy(null);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/50 sm:items-center"
      onClick={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("Guardar en una lista")}
        className="flex max-h-[85dvh] w-full max-w-md flex-col rounded-t-3xl bg-white sm:rounded-3xl"
      >
        <div className="relative flex items-center justify-center border-b border-[#f0f0f0] px-5 py-4">
          <h2 className="text-base font-semibold text-[#222]">{t("Guardar en una lista")}</h2>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 flex h-9 w-9 items-center justify-center rounded-full text-xl text-[#555] hover:bg-[#f5f5f5]"
            aria-label={t("Cerrar")}
          >
            ×
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">
          {s.lists.length > 0 && (
            <ul className="space-y-1">
              {s.lists.map((l) => {
                const on = l.slugs.includes(slug);
                return (
                  <li key={l.id}>
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => void toggle(l.id, !on)}
                      className="flex w-full items-center gap-3 rounded-xl px-1 py-2 text-left hover:bg-[#f7f7f7] disabled:opacity-70"
                    >
                      <span className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-[#eee]">
                        {l.covers[0] && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={sizedImage(l.covers[0], 160)} alt="" className="h-full w-full object-cover" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-semibold text-[#222]">{l.name}</span>
                        <span className="block text-[13px] text-[#717171]">
                          {t(l.slugs.length === 1 ? "1 guardado" : "{n} guardados", { n: l.slugs.length })}
                          {l.people.length > 1 && ` · ${t("Compartida")}`}
                        </span>
                      </span>
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 text-sm text-white ${
                          on ? "border-[#222] bg-[#222]" : "border-[#bbb]"
                        }`}
                        aria-hidden
                      >
                        {busy === l.id ? "…" : on ? "✓" : ""}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {creating ? (
            <form onSubmit={create} className={s.lists.length ? "mt-4 border-t border-[#eee] pt-4" : ""}>
              <label className="block text-sm font-semibold text-[#222]" htmlFor="wl-name">
                {t("Nombre de la lista")}
              </label>
              <input
                id="wl-name"
                autoFocus
                value={name}
                maxLength={60}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("Ej. Viaje a Oaxaca con amigos")}
                className="mt-2 w-full rounded-xl border border-[#bbb] px-3 py-3 text-[15px] outline-none focus:border-[#222]"
              />
              <p className="mt-2 text-[13px] text-[#717171]">
                {t("Después puedes compartirla con un enlace para que otros la vean y agreguen alojamientos.")}
              </p>
              <button
                type="submit"
                disabled={!name.trim() || busy !== null}
                className="mt-3 w-full rounded-xl bg-[#222] py-3 text-[15px] font-semibold text-white disabled:opacity-40"
              >
                {busy === "new" ? "…" : t("Crear y guardar")}
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="mt-3 flex w-full items-center gap-3 rounded-xl px-1 py-2 text-left hover:bg-[#f7f7f7]"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-xl border border-dashed border-[#bbb] text-2xl text-[#222]">
                +
              </span>
              <span className="text-[15px] font-semibold text-[#222]">{t("Crear una lista o viaje nuevo")}</span>
            </button>
          )}
          {error && <p className="mt-3 text-sm text-[#c13515]">{error}</p>}
        </div>
        {s.lists.length > 0 && (
          <div className="border-t border-[#eee] px-5 py-3" style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom))" }}>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-xl border border-[#222] py-3 text-[15px] font-semibold text-[#222]"
            >
              {t("Listo")}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
