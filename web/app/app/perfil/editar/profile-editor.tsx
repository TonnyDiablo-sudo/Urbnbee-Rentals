"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useT } from "@/components/i18n-provider";
import { PROFILE_INTERESTS, PROFILE_LANGUAGES, PROFILE_MAX_CHIPS } from "@/lib/profile-options";
import { TopBar } from "../../_components/top-bar";

export type ProfileDraft = {
  fullName: string;
  alias: string;
  showAlias: boolean;
  nameLocked: boolean;
  email: string;
  phone: string;
  addressLine: string;
  bio: string;
  avatarUrl: string;
  work: string;
  livesIn: string;
  languages: string[];
  interests: string[];
};

const AVATAR_PX = 640;

/** Recorta al centro en cuadrado y comprime a JPEG para que la subida sea rápida desde el celular. */
async function squareJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const side = Math.min(bitmap.width, bitmap.height);
  const out = Math.min(AVATAR_PX, side);
  const canvas = document.createElement("canvas");
  canvas.width = out;
  canvas.height = out;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, out, out);
  bitmap.close();
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", 0.86));
}

export function ProfileEditor({ initial, back }: { initial: ProfileDraft; back: string }) {
  const t = useT();
  const router = useRouter();
  const [d, setD] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [eraseEmail, setEraseEmail] = useState("");
  const [erasing, setErasing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const dirty = JSON.stringify(d) !== JSON.stringify(saved);

  const set = <K extends keyof ProfileDraft>(k: K, v: ProfileDraft[K]) => setD((prev) => ({ ...prev, [k]: v }));
  const toggle = (k: "languages" | "interests", v: string) =>
    setD((prev) => {
      const has = prev[k].includes(v);
      if (!has && prev[k].length >= PROFILE_MAX_CHIPS) return prev;
      return { ...prev, [k]: has ? prev[k].filter((x) => x !== v) : [...prev[k], v] };
    });

  async function upload(file: File) {
    setUploading(true);
    setMsg(null);
    const blob = await squareJpeg(file);
    const form = new FormData();
    form.append("file", blob, "avatar.jpg");
    const res = await fetch("/api/account/avatar", { method: "POST", body: form }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : {};
    setUploading(false);
    if (!res?.ok || typeof j.avatarUrl !== "string") {
      setMsg({ ok: false, text: typeof j.error === "string" ? j.error : "No se pudo subir la foto." });
      return;
    }
    set("avatarUrl", j.avatarUrl);
    setSaved((prev) => ({ ...prev, avatarUrl: j.avatarUrl }));
    setMsg({ ok: true, text: "Foto actualizada." });
    router.refresh();
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    const res = await fetch("/api/account/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(d.nameLocked ? {} : { fullName: d.fullName }),
        alias: d.alias,
        showAlias: d.showAlias,
        phone: d.phone,
        addressLine: d.addressLine,
        bio: d.bio,
        work: d.work,
        livesIn: d.livesIn,
        languages: d.languages,
        interests: d.interests,
      }),
    }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : {};
    setSaving(false);
    if (!res?.ok) {
      setMsg({ ok: false, text: typeof j.error === "string" ? j.error : "No se pudo guardar." });
      return;
    }
    const next = {
      ...d,
      fullName: typeof j.user?.fullName === "string" ? j.user.fullName : d.fullName,
      alias: typeof j.user?.alias === "string" ? j.user.alias : d.alias,
      showAlias: typeof j.user?.showAlias === "boolean" ? j.user.showAlias : d.showAlias,
      nameLocked: typeof j.user?.nameLocked === "boolean" ? j.user.nameLocked : d.nameLocked,
    };
    setD(next);
    setSaved(next);
    setMsg({ ok: true, text: "Perfil guardado." });
    router.refresh();
  }

  async function eraseAccount() {
    if (eraseEmail.trim().toLowerCase() !== d.email.trim().toLowerCase()) {
      setMsg({ ok: false, text: "Escribe tu correo tal como aparece en la cuenta." });
      return;
    }
    setErasing(true);
    setMsg(null);
    const res = await fetch("/api/account/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmEmail: eraseEmail.trim() }),
    }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) {
      setErasing(false);
      setMsg({ ok: false, text: typeof j.error === "string" ? j.error : "No se pudo borrar la cuenta." });
      return;
    }
    window.location.href = "/";
  }

  const initialLetter = (d.fullName || d.email).trim().charAt(0).toUpperCase();

  return (
    <div className="pb-[calc(100px+env(safe-area-inset-bottom))]">
      <TopBar title={t("Editar perfil")} back={back} />

      <div className="flex flex-col items-center px-5 pt-6">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="relative h-32 w-32 overflow-hidden rounded-full bg-[#111]"
          aria-label={t("Cambiar foto")}
        >
          {d.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={d.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-5xl font-bold text-[#dcb81e]">{initialLetter}</span>
          )}
          {uploading && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm font-semibold text-white">
              {t("Subiendo…")}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="mt-3 rounded-full border border-[#222] px-4 py-1.5 text-sm font-semibold text-[#222]"
        >
          {d.avatarUrl ? t("Cambiar foto") : t("Agregar foto")}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void upload(f);
          }}
        />
        <p className="mt-2 text-center text-xs text-[#888]">
          {t("Una foto clara de tu cara ayuda a que anfitriones y huéspedes confíen en ti.")}
        </p>
      </div>

      <div className="space-y-7 px-5 pt-6">
        <Group title={t("Sobre ti")}>
          <Field
            label={t("Nombre")}
            value={d.fullName}
            onChange={(v) => set("fullName", v)}
            autoComplete="name"
            disabled={d.nameLocked}
          />
          {d.nameLocked && (
            <p className="text-xs text-[#717171]">
              {t("Tu identidad ya está verificada. El nombre real queda fijo, aunque canceles la membresía.")}
            </p>
          )}
          <Field
            label={t("Alias")}
            value={d.alias}
            onChange={(v) => set("alias", v)}
            placeholder={t("Ej. Ana en Roma")}
          />
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1"
              checked={d.showAlias}
              onChange={(e) => set("showAlias", e.target.checked)}
            />
            <span className="text-sm text-[#222]">
              {t("Mostrar el alias en anuncios y en el chat")}
              <span className="mt-0.5 block text-xs font-normal text-[#717171]">
                {t("En una reserva, el contrato y el chat con esa persona se usa tu nombre real y completo.")}
              </span>
            </span>
          </label>
          <Field label={t("A qué te dedicas")} value={d.work} onChange={(v) => set("work", v)} placeholder={t("Ej. Diseñadora, estudiante, chef")} />
          <Field label={t("Dónde vives")} value={d.livesIn} onChange={(v) => set("livesIn", v)} placeholder={t("Ej. Guadalajara, Jalisco")} />
          <label className="block">
            <span className="text-sm font-medium text-[#222]">{t("Acerca de ti")}</span>
            <textarea
              value={d.bio}
              onChange={(e) => set("bio", e.target.value)}
              rows={5}
              maxLength={1000}
              placeholder={t("Cuéntale a la comunidad cómo eres, qué te gusta y cómo viajas.")}
              className="mt-1.5 w-full rounded-xl border border-[#ccc] px-3.5 py-3 text-base outline-none focus:border-[#222]"
            />
            <span className="text-xs text-[#999]">{d.bio.length}/1000</span>
          </label>
        </Group>

        <Group title={t("Idiomas que hablas")}>
          <Chips options={PROFILE_LANGUAGES} value={d.languages} onToggle={(v) => toggle("languages", v)} />
        </Group>

        <Group title={t("Tus gustos")} hint={t("Elige hasta {n}.", { n: PROFILE_MAX_CHIPS })}>
          <Chips options={PROFILE_INTERESTS} value={d.interests} onToggle={(v) => toggle("interests", v)} />
        </Group>

        <Group title={t("Datos privados")} hint={t("Sólo se usan en tus contratos y reservas; no se muestran en tu perfil.")}>
          <Field label={t("Correo")} value={d.email} onChange={() => {}} disabled />
          <Field label={t("Teléfono")} value={d.phone} onChange={(v) => set("phone", v)} type="tel" autoComplete="tel" />
          <Field
            label={t("Domicilio")}
            value={d.addressLine}
            onChange={(v) => set("addressLine", v)}
            autoComplete="street-address"
            placeholder={t("Calle, número, colonia, ciudad")}
          />
        </Group>

        <Group
          title={t("Borrar cuenta")}
          hint={t("Se eliminan tu perfil, tus anuncios y tus datos. Las reservas quedan sin tu nombre ni tu contacto, y las que aún no terminan se cancelan.")}
        >
          <Field
            label={t("Escribe tu correo para confirmar")}
            value={eraseEmail}
            onChange={setEraseEmail}
            type="email"
            autoComplete="off"
            placeholder={d.email}
          />
          <button
            type="button"
            disabled={erasing || !eraseEmail.trim()}
            onClick={() => void eraseAccount()}
            className="w-full rounded-xl border border-red-700 py-3 text-sm font-semibold text-red-700 disabled:opacity-40"
          >
            {erasing ? t("Borrando…") : t("Borrar mi cuenta para siempre")}
          </button>
        </Group>
      </div>

      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[#ebebeb] bg-white px-5 pt-3"
        style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom))" }}
      >
        {msg && <p className={`mb-2 text-center text-sm ${msg.ok ? "text-[#1e7a3a]" : "text-red-700"}`}>{t(msg.text)}</p>}
        <button
          type="button"
          disabled={!dirty || saving}
          onClick={() => void save()}
          className="mx-auto block w-full max-w-xl rounded-xl bg-[#222] py-3.5 text-[15px] font-semibold text-white disabled:opacity-40"
        >
          {saving ? t("Guardando…") : t("Guardar")}
        </button>
      </div>
    </div>
  );
}

function Group({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-[#222]">{title}</h2>
      {hint && <p className="mt-0.5 text-sm text-[#717171]">{hint}</p>}
      <div className="mt-3 space-y-4">{children}</div>
    </section>
  );
}

function Field(p: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  autoComplete?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-[#222]">{p.label}</span>
      <input
        value={p.value}
        onChange={(e) => p.onChange(e.target.value)}
        placeholder={p.placeholder}
        type={p.type ?? "text"}
        autoComplete={p.autoComplete}
        disabled={p.disabled}
        className="mt-1.5 w-full rounded-xl border border-[#ccc] px-3.5 py-3 text-base outline-none focus:border-[#222] disabled:bg-[#f7f7f7] disabled:text-[#888]"
      />
    </label>
  );
}

function Chips({ options, value, onToggle }: { options: string[]; value: string[]; onToggle: (v: string) => void }) {
  const t = useT();
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o);
        return (
          <button
            key={o}
            type="button"
            onClick={() => onToggle(o)}
            aria-pressed={on}
            className={`rounded-full border px-3.5 py-2 text-sm ${
              on ? "border-[#222] bg-[#222] font-semibold text-white" : "border-[#ddd] bg-white text-[#333]"
            }`}
          >
            {t(o)}
          </button>
        );
      })}
    </div>
  );
}
