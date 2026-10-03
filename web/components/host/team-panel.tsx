"use client";

import { useCallback, useEffect, useState } from "react";
import { useT } from "@/components/i18n-provider";

type Role = "cleaning" | "bookings" | "contracts" | "messages";
const ROLES: { id: Role; label: string; hint: string }[] = [
  { id: "bookings", label: "Aceptar y verificar reservas", hint: "Usa un asiento de colaborador" },
  {
    id: "contracts",
    label: "Firmar contratos en nombre del anfitrión",
    hint: "Firma con tu nombre legal; incluye aceptar reservas",
  },
  { id: "messages", label: "Contestar mensajes", hint: "Usa un asiento de colaborador" },
  { id: "cleaning", label: "Limpieza", hint: "Incluido en la herramienta de limpieza" },
];

type Member = {
  id: string;
  email: string;
  name: string;
  roles: Role[];
  effectiveRoles: Role[];
  listingIds: string[] | "all";
  listingTitles: string[];
  status: "pending" | "active";
};

type View = {
  members: Member[];
  seats: { paid: number; used: number };
  cleaningTool: boolean;
  listings: { id: string; title: string }[];
};

type Draft = { roles: Role[]; listingIds: string[] | "all" };

function AccessEditor({
  draft,
  onChange,
  listings,
}: {
  draft: Draft;
  onChange: (d: Draft) => void;
  listings: View["listings"];
}) {
  const t = useT();
  const toggleRole = (r: Role) => {
    let roles = draft.roles.includes(r) ? draft.roles.filter((x) => x !== r) : [...draft.roles, r];
    if (r === "contracts" && roles.includes("contracts") && !roles.includes("bookings")) roles = [...roles, "bookings"];
    if (r === "bookings" && !roles.includes("bookings")) roles = roles.filter((x) => x !== "contracts");
    onChange({ ...draft, roles });
  };
  const ids = draft.listingIds === "all" ? [] : draft.listingIds;
  return (
    <div className="space-y-3">
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#888]">{t("Puede")}</p>
        {ROLES.map((r) => (
          <label key={r.id} className="flex items-start gap-2 py-1 text-sm text-[#222]">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-[#dcb81e]"
              checked={draft.roles.includes(r.id)}
              onChange={() => toggleRole(r.id)}
            />
            <span>
              {t(r.label)} <span className="text-xs text-[#888]">· {t(r.hint)}</span>
            </span>
          </label>
        ))}
      </div>
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#888]">{t("En estos anuncios")}</p>
        <label className="flex items-center gap-2 py-1 text-sm text-[#222]">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[#dcb81e]"
            checked={draft.listingIds === "all"}
            onChange={(e) => onChange({ ...draft, listingIds: e.target.checked ? "all" : [] })}
          />
          {t("Todos, incluidos los nuevos")}
        </label>
        {draft.listingIds !== "all" &&
          listings.map((l) => (
            <label key={l.id} className="flex items-center gap-2 py-1 pl-6 text-sm text-[#222]">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[#dcb81e]"
                checked={ids.includes(l.id)}
                onChange={() =>
                  onChange({ ...draft, listingIds: ids.includes(l.id) ? ids.filter((x) => x !== l.id) : [...ids, l.id] })
                }
              />
              <span className="truncate">{l.title}</span>
            </label>
          ))}
      </div>
    </div>
  );
}

/** Invitar personas con cuenta de Cabibee y decidir qué pueden hacer y en qué anuncios. */
export function TeamPanel({ storeHref = "/tienda" }: { storeHref?: string }) {
  const t = useT();
  const [data, setData] = useState<View | null>(null);
  const [email, setEmail] = useState("");
  const [draft, setDraft] = useState<Draft>({ roles: ["bookings"], listingIds: "all" });
  const [editing, setEditing] = useState<{ id: string; draft: Draft } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/host/team", { cache: "no-store" }).catch(() => null);
    if (res?.ok) setData(await res.json());
  }, []);

  useEffect(() => {
    const id = setTimeout(() => void load(), 0);
    return () => clearTimeout(id);
  }, [load]);

  async function call(url: string, method: string, body?: unknown, success?: string) {
    setBusy(true);
    setErr(null);
    setOk(null);
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (!res?.ok) {
      setErr(typeof j.error === "string" ? j.error : "No se pudo guardar.");
      return false;
    }
    setData(j as View);
    if (success) setOk(success);
    return true;
  }

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (await call("/api/host/team", "POST", { email, ...draft }, "Invitación enviada. La verá en sus notificaciones.")) {
      setEmail("");
      setDraft({ roles: ["bookings"], listingIds: "all" });
    }
  }

  if (!data) return null;
  const { seats } = data;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-[#e5e5e5] bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-[#222]">{t("Tu equipo")}</h2>
        <p className="mt-1 text-sm text-[#717171]">
          {seats.paid === 0
            ? t("Para que alguien acepte reservas o conteste mensajes necesitas asientos de colaborador.")
            : t("Usas {used} de {paid} asientos de colaborador.", { used: seats.used, paid: seats.paid })}{" "}
          {!data.cleaningTool && t("El rol de limpieza viene con la herramienta de limpieza.")}{" "}
          <a href={storeHref} className="font-semibold text-[#222] underline">
            {t("Ir a la Tienda")}
          </a>
        </p>
        {editing && err && <p className="mt-2 text-sm text-red-700">{t(err)}</p>}

        {data.members.length === 0 ? (
          <p className="mt-4 text-sm text-[#888]">{t("Todavía no invitas a nadie.")}</p>
        ) : (
          <ul className="mt-4 divide-y divide-[#f0f0f0]">
            {data.members.map((m) => {
              const off = m.status === "active" ? m.roles.filter((r) => !m.effectiveRoles.includes(r)) : [];
              return (
                <li key={m.id} className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-medium text-[#222]">{m.name}</p>
                      <p className="truncate text-xs text-[#888]">
                        {m.email} · {m.status === "pending" ? t("Invitación pendiente") : t("Activo")}
                      </p>
                      <p className="mt-1 text-sm text-[#444]">
                        {m.roles.map((r) => t(ROLES.find((x) => x.id === r)!.label)).join(" · ")}
                      </p>
                      <p className="text-xs text-[#888]">{m.listingTitles.map((x) => t(x)).join(", ")}</p>
                      {off.length > 0 && (
                        <p className="mt-1 text-xs text-amber-700">
                          {t("Sin acceso ahora a: {roles}. Revisa tus asientos o la herramienta de limpieza.", {
                            roles: off.map((r) => t(ROLES.find((x) => x.id === r)!.label)).join(", "),
                          })}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        className="rounded-lg border border-[#ddd] px-3 py-1.5 text-sm text-[#222]"
                        onClick={() => setEditing({ id: m.id, draft: { roles: m.roles, listingIds: m.listingIds } })}
                      >
                        {t("Editar")}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-700"
                        onClick={() => {
                          if (confirm(t("¿Quitar a {name} del equipo?", { name: m.name }))) {
                            void call(`/api/host/team/${m.id}`, "DELETE");
                          }
                        }}
                      >
                        {t("Quitar")}
                      </button>
                    </div>
                  </div>
                  {editing?.id === m.id && (
                    <div className="mt-3 rounded-xl bg-[#fafafa] p-4">
                      <AccessEditor
                        draft={editing.draft}
                        listings={data.listings}
                        onChange={(d) => setEditing({ id: m.id, draft: d })}
                      />
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          className="rounded-lg bg-[#222] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                          onClick={async () => {
                            if (await call(`/api/host/team/${m.id}`, "PATCH", editing.draft, "Guardado.")) setEditing(null);
                          }}
                        >
                          {t("Guardar")}
                        </button>
                        <button type="button" className="px-3 py-2 text-sm text-[#555]" onClick={() => setEditing(null)}>
                          {t("Cancelar")}
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <form onSubmit={invite} className="rounded-2xl border border-[#e5e5e5] bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-[#222]">{t("Invitar a alguien")}</h2>
        <p className="mt-1 text-sm text-[#717171]">
          {t("La persona necesita una cuenta de Cabibee (es gratis). Escribe el correo con el que se registró.")}
        </p>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="correo@ejemplo.com"
          className="mt-3 w-full rounded-xl border border-[#ddd] px-3 py-2.5 text-[15px] text-[#222] outline-none focus:border-[#222]"
        />
        <div className="mt-4">
          <AccessEditor draft={draft} onChange={setDraft} listings={data.listings} />
        </div>
        {!editing && err && <p className="mt-3 text-sm text-red-700">{t(err)}</p>}
        {ok && <p className="mt-3 text-sm text-green-700">{t(ok)}</p>}
        <button
          type="submit"
          disabled={busy || !email.trim()}
          className="mt-4 rounded-xl bg-[#222] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? t("Enviando…") : t("Enviar invitación")}
        </button>
      </form>
    </div>
  );
}
