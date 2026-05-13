"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function GuestProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>();
  const [toast, setToast] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const sRes = await fetch("/api/auth/session", { credentials: "include" });
        const sData = await sRes.json();
        if (!sData.user) {
          router.replace("/login?next=/guest/profile");
          return;
        }
        if (sData.user.role !== "guest") {
          router.replace("/guest");
          return;
        }
        const pRes = await fetch("/api/guest/profile", { credentials: "include" });
        const data = await pRes.json();
        if (!pRes.ok) {
          if (!cancelled) router.replace("/guest");
          return;
        }
        if (!cancelled) {
          setFullName(data.user?.fullName ?? "");
          setEmail(data.user?.email ?? "");
          setPhone(data.user?.phone ?? "");
          setBio(data.profile?.bio ?? "");
          setAvatarUrl(data.profile?.avatarUrl);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  function notify(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  async function saveAccount() {
    const res = await fetch("/api/guest/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ fullName: fullName.trim(), phone: phone.trim() || undefined }),
    });
    const data = await res.json();
    if (!res.ok) {
      notify(data.error ?? "Error");
      return;
    }
    notify("Datos guardados");
    router.refresh();
  }

  async function saveProfile() {
    const res = await fetch("/api/guest/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ bio }),
    });
    const data = await res.json();
    if (!res.ok) {
      notify(data.error ?? "Error");
      return;
    }
    notify("Perfil actualizado");
    if (data.profile?.avatarUrl) setAvatarUrl(data.profile.avatarUrl);
  }

  async function onAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/guest/profile/avatar", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        notify(data.error ?? "No se pudo subir");
        return;
      }
      if (data.avatarUrl) setAvatarUrl(data.avatarUrl);
      notify("Foto actualizada");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  if (loading) {
    return <p className="text-[#888]">Cargando…</p>;
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold text-[#484848]">Tu perfil</h1>
      <p className="mt-2 text-sm text-[#888]">Nombre, teléfono y foto se usan en reservas y mensajes.</p>
      {toast && (
        <p className="mt-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800" role="status">
          {toast}
        </p>
      )}

      <div className="mt-8 flex flex-col gap-6 rounded-xl border border-[#ebebeb] bg-white p-6 shadow-sm sm:flex-row">
        <div className="flex flex-col items-center">
          <div
            className="relative h-28 w-28 overflow-hidden rounded-full border-2"
            style={{ borderColor: "#dcb81e" }}
          >
            {avatarUrl ? (
              <Image src={avatarUrl} alt="" fill className="object-cover" sizes="112px" unoptimized={avatarUrl.startsWith("/uploads")} />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[#f5f5f5] text-2xl text-[#ccc]">
                ?
              </div>
            )}
          </div>
          <label className="mt-3 cursor-pointer text-xs font-semibold text-[#dcb81e] underline">
            {uploading ? "Subiendo…" : "Cambiar foto"}
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={onAvatar} disabled={uploading} />
          </label>
        </div>
        <div className="min-w-0 flex-1 space-y-4">
          <label className="block text-xs font-semibold uppercase tracking-wide text-[#888]">
            Nombre completo
            <input
              className="mt-1 w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm text-[#484848]"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </label>
          <label className="block text-xs font-semibold uppercase tracking-wide text-[#888]">
            Correo (solo lectura)
            <input className="mt-1 w-full rounded-lg border border-[#ebebeb] bg-[#fafafa] px-3 py-2 text-sm" readOnly value={email} />
          </label>
          <label className="block text-xs font-semibold uppercase tracking-wide text-[#888]">
            Teléfono
            <input
              type="tel"
              className="mt-1 w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>
          <button
            type="button"
            onClick={() => void saveAccount()}
            className="rounded-full bg-black px-5 py-2 text-sm font-semibold text-white"
          >
            Guardar datos de cuenta
          </button>
        </div>
      </div>

      <div className="mt-8 rounded-xl border border-[#ebebeb] bg-white p-6 shadow-sm">
        <label className="block text-xs font-semibold uppercase tracking-wide text-[#888]">
          Sobre ti (opcional)
          <textarea
            className="mt-1 w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm"
            rows={4}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Unas líneas sobre ti…"
          />
        </label>
        <button
          type="button"
          onClick={() => void saveProfile()}
          className="mt-4 rounded-full px-5 py-2 text-sm font-semibold text-black"
          style={{ backgroundColor: "#dcb81e" }}
        >
          Guardar biografía
        </button>
      </div>
    </div>
  );
}
