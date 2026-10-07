"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLang, useT } from "@/components/i18n-provider";
import { VoiceNote } from "@/components/chat/attachment-view";
import { shrinkImage, useVoiceRecorder, VOICE_MAX_SEC } from "@/components/chat/media-input";
import { EmojiPicker } from "@/components/ui/emoji-picker";
import { chatMatches, useChatSearch } from "@/components/chat/chat-search";
import { ToolPreviewNotice } from "@/components/host/tool-preview-notice";
import { numberLocale } from "@/lib/i18n";

type Person = { id: string; name: string; host: boolean };
type Channel = {
  id: string;
  name: string;
  emoji: string;
  direct: boolean;
  lastAt: string;
  lastMine: boolean;
  preview: string;
  everyone: boolean;
  memberIds: string[];
  memberNames: string[];
};
type Msg = {
  id: string;
  byName: string;
  mine: boolean;
  body: string;
  at: string;
  attachment?: { kind: "image" | "audio" | "file"; name?: string; size: number; durationSec?: number; url: string };
};
type Thread = { channel: Channel; canManage: boolean; isHost: boolean; live?: boolean; people: Person[]; messages: Msg[] };

/** Elegir quién está en el grupo: todo el equipo o sólo algunas personas. El anfitrión siempre está. */
function MembersPicker({
  people,
  me,
  value,
  onChange,
}: {
  people: Person[];
  me: string;
  /** null = todo el equipo. */
  value: string[] | null;
  onChange: (v: string[] | null) => void;
}) {
  const t = useT();
  const others = people.filter((p) => !p.host && p.id !== me);
  if (others.length === 0) return null;
  return (
    <fieldset>
      <legend className="text-sm font-medium text-[#222]">{t("¿Quién está en este chat?")}</legend>
      <div className="mt-1.5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onChange(null)}
          className={`rounded-full border px-3 py-1.5 text-sm ${value === null ? "border-[#222] bg-[#222] text-white" : "border-[#ddd] bg-white text-[#222]"}`}
        >
          👥 {t("Todo el equipo")}
        </button>
        {others.map((p) => {
          const on = value !== null && value.includes(p.id);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                const base = value ?? [];
                onChange(on ? base.filter((x) => x !== p.id) : [...base, p.id]);
              }}
              className={`rounded-full border px-3 py-1.5 text-sm ${on ? "border-[#222] bg-[#222] text-white" : "border-[#ddd] bg-white text-[#222]"}`}
            >
              {on ? "✓ " : "+ "}
              {p.name}
            </button>
          );
        })}
      </div>
      <p className="mt-1 text-xs text-[#888]">{t("El anfitrión siempre ve todos los chats.")}</p>
    </fieldset>
  );
}

const SUGGESTED = [
  { emoji: "💰", name: "Cuentas" },
  { emoji: "🧹", name: "Limpiezas" },
  { emoji: "🧴", name: "Insumos" },
  { emoji: "🔧", name: "Mantenimiento" },
];

const time = (iso: string, locale: string) =>
  new Date(iso).toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

async function call(url: string, method = "GET", body?: unknown) {
  const res = await fetch(url, {
    method,
    cache: "no-store",
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  }).catch(() => null);
  const j = res ? await res.json().catch(() => ({})) : {};
  return { ok: Boolean(res?.ok), status: res?.status ?? 0, j: j as Record<string, unknown> };
}

/** Chats de equipo: el anfitrión y su gente arman los que quieran (cuentas, limpiezas, insumos…). */
export function TeamChat({ hostId, pad = "px-5", storeHref = "/tienda" }: { hostId?: string; pad?: string; storeHref?: string }) {
  const t = useT();
  const locale = numberLocale(useLang());
  const query = useChatSearch();
  const [creating, setCreating] = useState<"group" | "direct" | false>(false);
  const q = hostId ? `?host=${encodeURIComponent(hostId)}` : "";
  const [channels, setChannels] = useState<Channel[] | null>(null);
  const [locked, setLocked] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ emoji: string; name: string; members: string[] | null }>({ emoji: "💬", name: "", members: null });
  const [err, setErr] = useState<string | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [me, setMe] = useState("");
  const [isHost, setIsHost] = useState(false);
  /** false = vista previa: se arman chats pero nadie puede escribir hasta activar una herramienta. */
  const [live, setLive] = useState(true);

  const load = useCallback(async () => {
    const r = await call(`/api/team-chat${q}`);
    if (r.ok) {
      setLocked(null);
      const list = (r.j.channels as Channel[]) ?? [];
      setChannels(list);
      const want = new URLSearchParams(window.location.search).get("chat");
      if (want && list.some((c) => c.id === want)) setOpen((cur) => cur ?? want);
      setPeople((r.j.people as Person[]) ?? []);
      setMe(typeof r.j.me === "string" ? r.j.me : "");
      setIsHost(r.j.isHost === true);
      setLive(r.j.live !== false);
    } else {
      setLocked(typeof r.j.error === "string" ? r.j.error : "No se pudo cargar.");
      setChannels([]);
    }
  }, [q]);

  useEffect(() => {
    const id = setTimeout(() => void load(), 0);
    return () => clearTimeout(id);
  }, [load]);

  async function create(name: string, emoji: string, members: string[] | null) {
    setErr(null);
    const r = await call("/api/team-chat", "POST", { host: hostId, name, emoji, memberIds: members ?? "all" });
    if (!r.ok) return setErr(typeof r.j.error === "string" ? r.j.error : "No se pudo crear.");
    setCreating(false);
    setDraft({ emoji: "💬", name: "", members: null });
    await load();
    setOpen(r.j.id as string);
  }

  async function openDirect(personId: string) {
    setErr(null);
    const r = await call("/api/team-chat", "POST", { host: hostId, direct: personId });
    if (!r.ok) return setErr(typeof r.j.error === "string" ? r.j.error : "No se pudo abrir.");
    setCreating(false);
    await load();
    setOpen(r.j.id as string);
  }

  if (!channels) return null;

  if (open) {
    return (
      <ChannelView
        id={open}
        me={me}
        pad={pad}
        storeHref={storeHref}
        onBack={() => {
          setOpen(null);
          const url = new URL(window.location.href);
          if (url.searchParams.has("chat")) {
            url.searchParams.delete("chat");
            window.history.replaceState(null, "", url.toString());
          }
          void load();
        }}
      />
    );
  }

  const others = people.filter((p) => p.id !== me);
  const shown = channels.filter((c) => chatMatches(query, c.name, c.preview, ...c.memberNames));
  const groupNames = new Set(channels.filter((c) => !c.direct).map((c) => c.name));

  return (
    <section>
      {locked && <p className={`${pad} py-3 text-sm text-[#555]`}>{t(locked)}</p>}
      {!locked && !live && isHost && (
        <div className={`${pad} pb-3`}>
          <ToolPreviewNotice tool="teamChat" storeHref={storeHref} compact />
        </div>
      )}
      {!locked && !live && !isHost && (
        <p className={`${pad} pb-3 text-sm text-[#555]`}>
          {t("Los chats de este equipo se activan cuando el anfitrión encienda su herramienta de colaboradores o de limpieza.")}
        </p>
      )}

      {!locked && (
        <div className={`${pad} flex gap-2 pb-2`}>
          <button
            type="button"
            onClick={() => setCreating(creating === "direct" ? false : "direct")}
            className={`rounded-full border px-4 py-2 text-sm font-medium ${creating === "direct" ? "border-[#222] bg-[#222] text-white" : "border-[#ddd] text-[#222]"}`}
          >
            {t("👤 Nuevo chat")}
          </button>
          <button
            type="button"
            onClick={() => setCreating(creating === "group" ? false : "group")}
            className={`rounded-full border px-4 py-2 text-sm font-medium ${creating === "group" ? "border-[#222] bg-[#222] text-white" : "border-[#ddd] text-[#222]"}`}
          >
            {t("👥 Nuevo grupo")}
          </button>
        </div>
      )}

      {err && <p className={`${pad} pb-2 text-sm text-red-700`}>{t(err)}</p>}

      {creating === "direct" && (
        <div className={`${pad} pb-3`}>
          <p className="pb-1 text-sm text-[#717171]">{t("¿Con quién quieres hablar?")}</p>
          {others.length === 0 ? (
            <p className="text-sm text-[#888]">{t("Todavía no hay nadie más en el equipo.")}</p>
          ) : (
            <ul className="divide-y divide-[#f0f0f0] rounded-2xl bg-[#fafafa]">
              {others.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => void openDirect(p.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#111] text-sm font-bold text-[#dcb81e]">
                      {p.name.trim().charAt(0).toUpperCase() || "?"}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[15px] text-[#222]">{p.name}</span>
                    {p.host && <span className="shrink-0 text-xs text-[#888]">{t("Anfitrión")}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {isHost && (
            <a href="/host/colaboradores#invitar" className="mt-2 block text-xs font-semibold text-[#222] underline">
              {t("¿Falta alguien? Invítalo como colaborador")}
            </a>
          )}
        </div>
      )}

      {creating === "group" && (
        <form
          className={`${pad} space-y-3 pb-4`}
          onSubmit={(e) => {
            e.preventDefault();
            void create(draft.name, draft.emoji, draft.members);
          }}
        >
          <div className="flex flex-wrap gap-2">
            {SUGGESTED.filter((s) => !groupNames.has(t(s.name))).map((s) => (
              <button
                key={s.name}
                type="button"
                onClick={() => setDraft({ ...draft, name: t(s.name), emoji: s.emoji })}
                className={`rounded-full border px-3 py-1.5 text-sm ${draft.name === t(s.name) ? "border-[#222] bg-[#222] text-white" : "border-[#ddd] bg-white text-[#222]"}`}
              >
                {s.emoji} {t(s.name)}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <EmojiPicker value={draft.emoji} onChange={(emoji) => setDraft({ ...draft, emoji })} />
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder={t("Nombre del grupo")}
              maxLength={40}
              className="min-w-0 flex-1 rounded-xl border border-[#ddd] px-3 py-2 text-[15px] text-[#222]"
            />
          </div>
          <MembersPicker people={people} me={me} value={draft.members} onChange={(members) => setDraft({ ...draft, members })} />
          {isHost && (
            <a href="/host/colaboradores#invitar" className="block text-xs font-semibold text-[#222] underline">
              {t("¿Falta alguien? Invítalo como colaborador")}
            </a>
          )}
          <div className="flex gap-2">
            <button type="submit" disabled={!draft.name.trim()} className="rounded-xl bg-[#222] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {t("Crear")}
            </button>
            <button type="button" onClick={() => setCreating(false)} className="rounded-xl border border-[#ddd] px-4 py-2 text-sm text-[#222]">
              {t("Cancelar")}
            </button>
          </div>
        </form>
      )}

      {!locked && channels.length === 0 && !creating && (
        <p className={`${pad} py-6 text-sm text-[#717171]`}>
          {t("Todavía no hay chats. Escríbele a alguien o arma un grupo para cuentas, limpiezas o insumos.")}
        </p>
      )}
      {channels.length > 0 && shown.length === 0 && <p className={`${pad} py-6 text-sm text-[#717171]`}>{t("No hay chats que coincidan.")}</p>}

      {shown.length > 0 && (
        <ul className="divide-y divide-[#f0f0f0]">
          {shown.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => setOpen(c.id)} className={`${pad} flex w-full items-start gap-3 py-4 text-left active:bg-[#fafafa]`}>
                {c.direct ? (
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#111] text-base font-bold text-[#dcb81e]">
                    {c.name.trim().charAt(0).toUpperCase() || "?"}
                  </span>
                ) : (
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#fdf6d8] text-xl">{c.emoji}</span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[15px] font-semibold text-[#222]">{c.name}</span>
                    <span className="shrink-0 text-xs text-[#999]">{time(c.lastAt, locale)}</span>
                  </span>
                  <span className="block truncate text-xs text-[#999]">
                    {c.direct ? t("Chat directo") : `👥 ${c.everyone ? t("Todo el equipo") : c.memberNames.join(", ")}`}
                  </span>
                  <span className="mt-0.5 line-clamp-2 text-sm text-[#717171]">
                    {c.preview ? `${c.lastMine ? t("Tú: ") : ""}${c.preview}` : t("Sin mensajes")}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ChannelView({ id, me, pad, storeHref, onBack }: { id: string; me: string; pad: string; storeHref: string; onBack: () => void }) {
  const t = useT();
  const locale = numberLocale(useLang());
  const [data, setData] = useState<Thread | null>(null);
  const [showMembers, setShowMembers] = useState(false);
  const [members, setMembers] = useState<string[] | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const voice = useVoiceRecorder();
  const lastCount = useRef(0);

  const load = useCallback(async () => {
    const r = await call(`/api/team-chat/${id}`);
    if (r.ok) setData(r.j as unknown as Thread);
    else if (r.status === 404) onBack();
  }, [id, onBack]);

  useEffect(() => {
    const first = setTimeout(() => void load(), 0);
    const every = setInterval(() => void load(), 6000);
    return () => {
      clearTimeout(first);
      clearInterval(every);
    };
  }, [load]);

  useEffect(() => {
    const n = data?.messages.length ?? 0;
    if (n !== lastCount.current) endRef.current?.scrollIntoView({ block: "end" });
    lastCount.current = n;
  }, [data]);

  async function sendText() {
    if (!text.trim()) return;
    setBusy(true);
    setErr(null);
    const r = await call(`/api/team-chat/${id}`, "POST", { body: text });
    setBusy(false);
    if (!r.ok) return setErr(typeof r.j.error === "string" ? r.j.error : "No se pudo enviar.");
    setText("");
    await load();
  }

  async function upload(blob: Blob, name: string, durationSec?: number) {
    setBusy(true);
    setErr(null);
    const form = new FormData();
    form.append("file", blob, name);
    if (text.trim()) form.append("caption", text.trim());
    if (durationSec) form.append("durationSec", String(durationSec));
    const res = await fetch(`/api/team-chat/${id}`, { method: "POST", body: form }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      const j = res ? await res.json().catch(() => ({})) : {};
      return setErr(typeof j.error === "string" ? j.error : "No se pudo enviar.");
    }
    setText("");
    await load();
  }

  async function toggleVoice() {
    if (!voice.recording) return void voice.start();
    const r = await voice.stop();
    if (r) await upload(r.blob, r.blob.type.includes("mp4") ? "audio.m4a" : "audio.webm", r.seconds);
  }

  async function removeMessage(messageId: string) {
    if (!confirm(t("¿Borrar este mensaje?"))) return;
    await call(`/api/team-chat/${id}?message=${encodeURIComponent(messageId)}`, "DELETE");
    await load();
  }

  async function rename() {
    if (!data) return;
    const name = prompt(t("Nuevo nombre del chat"), data.channel.name);
    if (!name?.trim()) return;
    await call(`/api/team-chat/${id}`, "PATCH", { name });
    await load();
  }

  function openMembers() {
    if (!data) return;
    setMembers(data.channel.everyone ? null : data.channel.memberIds.filter((x) => !data.people.find((p) => p.id === x)?.host));
    setShowMembers(!showMembers);
  }

  async function saveMembers() {
    setErr(null);
    const r = await call(`/api/team-chat/${id}`, "PATCH", { memberIds: members ?? "all" });
    if (!r.ok) return setErr(typeof r.j.error === "string" ? r.j.error : "No se pudo guardar.");
    setShowMembers(false);
    await load();
  }

  async function removeChannel() {
    if (!confirm(t("¿Borrar este chat con todos sus mensajes y archivos?"))) return;
    const r = await call(`/api/team-chat/${id}`, "DELETE");
    if (r.ok) onBack();
  }

  if (!data) return <p className={`${pad} text-sm text-[#999]`}>{t("Cargando…")}</p>;

  return (
    <section className="flex h-[calc(100dvh-230px)] min-h-[420px] flex-col bg-white">
      <header className={`${pad || "px-1"} flex items-center gap-3 border-b border-[#f0f0f0] py-3`}>
        <button type="button" onClick={onBack} aria-label={t("Volver")} className="text-2xl leading-none text-[#222]">
          ‹
        </button>
        {data.channel.direct ? (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#111] text-sm font-bold text-[#dcb81e]">
            {data.channel.name.trim().charAt(0).toUpperCase() || "?"}
          </span>
        ) : (
          <span className="text-xl">{data.channel.emoji}</span>
        )}
        <h2 className="min-w-0 flex-1 truncate text-[16px] font-semibold text-[#222]">{data.channel.name}</h2>
        {!data.channel.direct && (
          <button
            type="button"
            onClick={openMembers}
            aria-label={t("Personas en el chat")}
            className="shrink-0 rounded-full border border-[#ddd] px-2.5 py-1 text-sm text-[#222]"
          >
            👥 {data.channel.memberIds.length}
          </button>
        )}
        {data.canManage && (
          <>
            <button type="button" onClick={() => void rename()} className="text-sm text-[#555] underline">
              {t("Renombrar")}
            </button>
            <button type="button" onClick={() => void removeChannel()} className="text-sm text-red-700 underline">
              {t("Borrar")}
            </button>
          </>
        )}
      </header>

      {showMembers && (
        <div className="space-y-3 border-b border-[#f0f0f0] bg-[#fafafa] px-4 py-3">
          <p className="text-sm text-[#555]">
            {data.channel.everyone ? t("Todo el equipo") : data.channel.memberNames.join(", ")}
          </p>
          {data.canManage && (
            <>
              <MembersPicker people={data.people} me={me} value={members} onChange={setMembers} />
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => void saveMembers()} className="rounded-lg bg-[#222] px-3 py-1.5 text-sm font-semibold text-white">
                  {t("Guardar")}
                </button>
                {data.isHost && (
                  <a href="/host/colaboradores#invitar" className="text-xs font-semibold text-[#222] underline">
                    {t("¿Falta alguien? Invítalo como colaborador")}
                  </a>
                )}
              </div>
            </>
          )}
        </div>
      )}

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {data.messages.length === 0 && <p className="text-center text-sm text-[#999]">{t("Escribe el primer mensaje.")}</p>}
        {data.messages.map((m) => (
          <div key={m.id} className={`group flex flex-col ${m.mine ? "items-end" : "items-start"}`}>
            {!m.mine && <span className="mb-0.5 text-xs font-semibold text-[#555]">{m.byName}</span>}
            <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.mine ? "bg-[#222] text-white" : "bg-[#f3f3f3] text-[#222]"}`}>
              {m.attachment?.kind === "image" && (
                <a href={m.attachment.url} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.attachment.url} alt={t("Foto")} className="mb-1 max-h-64 rounded-xl object-cover" />
                </a>
              )}
              {m.attachment?.kind === "audio" && (
                <div className={m.mine ? "rounded-xl bg-[#dcb81e] px-2" : ""}>
                  <VoiceNote a={{ url: m.attachment.url }} mine={m.mine} />
                </div>
              )}
              {m.attachment?.kind === "file" && (
                <a href={m.attachment.url} className="mb-1 block underline">
                  📎 {m.attachment.name} ({Math.max(1, Math.round(m.attachment.size / 1024))} KB)
                </a>
              )}
              {m.body && <p className="whitespace-pre-wrap">{m.body}</p>}
            </div>
            <span className="mt-0.5 flex gap-2 text-[11px] text-[#aaa]">
              {time(m.at, locale)}
              {(m.mine || data.canManage) && (
                <button type="button" onClick={() => void removeMessage(m.id)} className="hidden underline group-hover:inline">
                  {t("Borrar")}
                </button>
              )}
            </span>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {(err || voice.error) && <p className="px-4 text-sm text-red-700">{t((err || voice.error)!)}</p>}

      {data.live === false ? (
        <div className="border-t border-[#f0f0f0] p-3">
          <ToolPreviewNotice tool="teamChat" storeHref={storeHref} compact />
        </div>
      ) : (
      <div className="flex items-end gap-2 border-t border-[#f0f0f0] p-3">
        <input
          ref={photoRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) await upload(await shrinkImage(f), "foto.jpg");
          }}
        />
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) await upload(f, f.name);
          }}
        />
        <button type="button" disabled={busy} onClick={() => photoRef.current?.click()} aria-label={t("Mandar foto")} className="h-10 w-10 shrink-0 rounded-full border border-[#ddd] text-lg">
          📷
        </button>
        <button type="button" disabled={busy} onClick={() => fileRef.current?.click()} aria-label={t("Mandar archivo")} className="h-10 w-10 shrink-0 rounded-full border border-[#ddd] text-lg">
          📎
        </button>
        {voice.supported && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void toggleVoice()}
            aria-label={voice.recording ? t("Terminar y mandar audio") : t("Grabar audio")}
            className={`h-10 shrink-0 rounded-full px-3 text-sm ${voice.recording ? "bg-red-600 text-white" : "w-10 border border-[#ddd] text-lg"}`}
          >
            {voice.recording ? `■ ${Math.floor(voice.seconds)}s/${VOICE_MAX_SEC}` : "🎤"}
          </button>
        )}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void sendText();
            }
          }}
          rows={1}
          placeholder={t("Escribe al equipo…")}
          className="max-h-32 min-w-0 flex-1 resize-none rounded-2xl border border-[#ddd] px-3 py-2 text-[15px] text-[#222]"
        />
        <button
          type="button"
          disabled={busy || !text.trim()}
          onClick={() => void sendText()}
          className="h-10 shrink-0 rounded-full bg-[#222] px-4 text-sm font-semibold text-white disabled:opacity-40"
        >
          {t("Enviar")}
        </button>
      </div>
      )}
    </section>
  );
}
