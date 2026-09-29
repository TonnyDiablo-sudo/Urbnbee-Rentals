"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CATEGORY_OPTIONS } from "../listing-options";

export function NewListingStart() {
  const router = useRouter();
  const [category, setCategory] = useState<string>("casas");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const start = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/host/listings", { method: "POST" });
      const j = await res.json().catch(() => ({}));
      const id = j.listing?.id as string | undefined;
      if (!res.ok || !id) {
        setErr(typeof j.error === "string" ? j.error : "No se pudo crear el anuncio.");
        return;
      }
      await fetch(`/api/host/listings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryKey: category,
          ...(title.trim() ? { title: title.trim(), regenerateSlug: true } : {}),
        }),
      });
      router.replace(`/app/host/anuncios/${id}`);
    } catch {
      setErr("Sin conexión.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="px-5 py-5">
      <h2 className="text-2xl font-bold text-[#222]">¿Qué vas a publicar?</h2>
      <div className="mt-5 grid grid-cols-2 gap-3">
        {CATEGORY_OPTIONS.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setCategory(c.key)}
            className={`rounded-2xl border-2 p-4 text-left ${category === c.key ? "border-[#222] bg-[#fafafa]" : "border-[#ebebeb]"}`}
          >
            <span className="text-2xl">{c.emoji}</span>
            <p className="mt-2 text-[15px] font-semibold text-[#222]">{c.label}</p>
          </button>
        ))}
      </div>
      <label className="mt-6 block text-sm font-medium text-[#222]">
        Título
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={90}
          placeholder="Ej. Casa con alberca cerca del centro"
          className="mt-1 w-full rounded-xl border border-[#ccc] px-3.5 py-3 text-[15px] outline-none focus:border-[#222]"
        />
      </label>
      {err && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{err}</p>}
      <button
        type="button"
        disabled={busy}
        onClick={() => void start()}
        className="mt-8 w-full rounded-xl bg-[#dcb81e] py-3.5 text-[15px] font-semibold text-black disabled:opacity-60"
      >
        {busy ? "Creando…" : "Continuar"}
      </button>
      <p className="mt-3 text-center text-xs text-[#999]">Se guarda como borrador. Lo publicas cuando quieras.</p>
    </div>
  );
}
