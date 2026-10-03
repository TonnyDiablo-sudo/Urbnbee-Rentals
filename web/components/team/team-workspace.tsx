"use client";

import { useCallback, useEffect, useState } from "react";
import { useT } from "@/components/i18n-provider";
import { CleaningTaskCard, type CleaningTaskItem } from "@/components/host/cleaning-task-card";

type Role = "cleaning" | "bookings" | "contracts" | "messages";
const ROLE_LABEL: Record<Role, string> = {
  cleaning: "Limpieza",
  bookings: "Aceptar y verificar reservas",
  contracts: "Firmar contratos en nombre del anfitrión",
  messages: "Contestar mensajes",
};

type Team = {
  id: string;
  hostId: string;
  hostName: string;
  status: "pending" | "active";
  roles: Role[];
  listingTitles: string[];
};

type Booking = {
  id: string;
  status: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  effectiveListingTitle?: string;
  listingTitle: string;
  payInstruction?: unknown;
  payProof?: unknown;
  paidAt?: string;
  contract?: { hostAcceptedAt?: string } | null;
};

type Thread = {
  listingId: string;
  listingTitle: string;
  guestSessionId: string;
  guestName: string;
  lastAt: string;
  messages: { id: string; sender: "guest" | "host"; body: string; createdAt: string }[];
};

const day = (iso: string) => iso.slice(0, 10);

async function jsonCall(url: string, method = "GET", body?: unknown) {
  const res = await fetch(url, {
    method,
    cache: "no-store",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }).catch(() => null);
  const j = res ? await res.json().catch(() => ({})) : {};
  return { ok: Boolean(res?.ok), j: j as Record<string, unknown> };
}

function BookingsBlock({ hostId, canSign }: { hostId: string; canSign: boolean }) {
  const t = useT();
  const [rows, setRows] = useState<Booking[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await jsonCall(`/api/host/bookings?host=${encodeURIComponent(hostId)}`);
    if (r.ok) setRows((r.j.bookings as Booking[]) ?? []);
  }, [hostId]);

  useEffect(() => {
    const id = setTimeout(() => void load(), 0);
    return () => clearTimeout(id);
  }, [load]);

  async function act(url: string, body: unknown) {
    setBusy(true);
    setErr(null);
    const r = await jsonCall(url, url.endsWith("/pay") ? "POST" : "PATCH", body);
    setBusy(false);
    if (!r.ok) return setErr(typeof r.j.error === "string" ? r.j.error : "No se pudo guardar.");
    await load();
  }

  if (!rows) return null;
  const today = new Date().toISOString().slice(0, 10);
  const open = rows
    .filter((b) => ["PENDING", "PENDING_HOST", "AWAITING_PAYMENT", "AWAITING_DETAILS", "CONFIRMED"].includes(b.status))
    .filter((b) => day(b.checkOut) >= today)
    .sort((a, b) => a.checkIn.localeCompare(b.checkIn));

  return (
    <div>
      <h3 className="text-base font-semibold text-[#222]">{t("Reservas")}</h3>
      {err && <p className="mt-1 text-sm text-red-700">{t(err)}</p>}
      {open.length === 0 ? (
        <p className="mt-1 text-sm text-[#888]">{t("No hay reservas por atender.")}</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {open.map((b) => {
            const pendingHost = b.status === "PENDING" || b.status === "PENDING_HOST";
            const proofToCheck = b.status === "AWAITING_PAYMENT" && Boolean(b.payInstruction && b.payProof) && !b.paidAt;
            const toSign = canSign && !pendingHost && Boolean(b.contract) && !b.contract?.hostAcceptedAt;
            return (
              <li key={b.id} className="rounded-xl border border-[#e5e5e5] p-3">
                <p className="text-[15px] font-medium text-[#222]">{b.guestName}</p>
                <p className="text-xs text-[#888]">
                  {b.effectiveListingTitle ?? b.listingTitle} · {day(b.checkIn)} → {day(b.checkOut)} ·{" "}
                  {t("{n} noches", { n: b.nights })}
                </p>
                <p className="mt-1 text-xs font-semibold text-[#555]">
                  {pendingHost
                    ? t("Esperando que la aceptes")
                    : b.status === "AWAITING_PAYMENT"
                      ? proofToCheck
                        ? t("Revisar comprobante de pago")
                        : t("Esperando pago")
                      : b.status === "AWAITING_DETAILS"
                        ? t("Esperando datos del huésped")
                        : t("Confirmada")}
                </p>
                {(pendingHost || proofToCheck || toSign) && (
                  <div className="mt-2 flex gap-2">
                    {pendingHost && (
                      <>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void act(`/api/host/bookings/${b.id}`, { action: "accept", acceptContract: true })}
                          className="rounded-lg bg-[#222] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
                        >
                          {t("Aceptar")}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            if (confirm(t("¿Rechazar esta reserva? Se le devuelve el pago al huésped.")))
                              void act(`/api/host/bookings/${b.id}`, { action: "reject" });
                          }}
                          className="rounded-lg border border-[#ddd] px-3 py-1.5 text-sm text-[#222]"
                        >
                          {t("Rechazar")}
                        </button>
                      </>
                    )}
                    {toSign && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          if (confirm(t("Vas a firmar el contrato en nombre del anfitrión, con su nombre legal. ¿Continuar?")))
                            void act(`/api/host/bookings/${b.id}`, { action: "sign" });
                        }}
                        className="rounded-lg border border-[#222] px-3 py-1.5 text-sm font-semibold text-[#222] disabled:opacity-50"
                      >
                        {t("Firmar contrato")}
                      </button>
                    )}
                    {proofToCheck && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          if (confirm(t("¿Ya verificaste que el dinero llegó a la cuenta del anfitrión?")))
                            void act(`/api/host/bookings/${b.id}/pay`, { action: "confirm" });
                        }}
                        className="rounded-lg bg-[#222] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        {t("Confirmar pago")}
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function MessagesBlock({ hostId }: { hostId: string }) {
  const t = useT();
  const [threads, setThreads] = useState<Thread[] | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await jsonCall(`/api/host/inbox?host=${encodeURIComponent(hostId)}`);
    if (r.ok) setThreads((r.j.threads as Thread[]) ?? []);
  }, [hostId]);

  useEffect(() => {
    const id = setTimeout(() => void load(), 0);
    return () => clearTimeout(id);
  }, [load]);

  async function reply(th: Thread) {
    setBusy(true);
    setErr(null);
    const r = await jsonCall("/api/host/inbox/reply", "POST", {
      listingId: th.listingId,
      guestSessionId: th.guestSessionId,
      body: text,
    });
    setBusy(false);
    if (!r.ok) return setErr(typeof r.j.error === "string" ? r.j.error : "No se pudo enviar.");
    setText("");
    await load();
  }

  if (!threads) return null;
  return (
    <div>
      <h3 className="text-base font-semibold text-[#222]">{t("Mensajes")}</h3>
      {threads.length === 0 ? (
        <p className="mt-1 text-sm text-[#888]">{t("No hay conversaciones.")}</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {threads.slice(0, 30).map((th) => {
            const key = `${th.listingId}:${th.guestSessionId}`;
            const last = th.messages[th.messages.length - 1];
            const waiting = last?.sender === "guest";
            return (
              <li key={key} className="rounded-xl border border-[#e5e5e5]">
                <button
                  type="button"
                  className="flex w-full items-start justify-between gap-3 p-3 text-left"
                  onClick={() => {
                    setOpenKey(openKey === key ? null : key);
                    setText("");
                    setErr(null);
                  }}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-medium text-[#222]">{th.guestName}</span>
                    <span className="block truncate text-xs text-[#888]">
                      {th.listingTitle} · {last?.body}
                    </span>
                  </span>
                  {waiting && <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[#dcb81e]" />}
                </button>
                {openKey === key && (
                  <div className="border-t border-[#f0f0f0] p-3">
                    <div className="max-h-72 space-y-2 overflow-y-auto">
                      {th.messages.map((m) => (
                        <p
                          key={m.id}
                          className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                            m.sender === "host" ? "ml-auto bg-[#222] text-white" : "bg-[#f3f3f3] text-[#222]"
                          }`}
                        >
                          {m.body}
                        </p>
                      ))}
                    </div>
                    {err && <p className="mt-2 text-sm text-red-700">{t(err)}</p>}
                    <div className="mt-2 flex gap-2">
                      <input
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder={t("Responder en nombre del anfitrión…")}
                        className="min-w-0 flex-1 rounded-xl border border-[#ddd] px-3 py-2 text-sm text-[#222]"
                      />
                      <button
                        type="button"
                        disabled={busy || !text.trim()}
                        onClick={() => void reply(th)}
                        className="rounded-xl bg-[#222] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        {t("Enviar")}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function CleaningBlock({
  tasks,
  requirePhoto,
  hostName,
  reload,
}: {
  tasks: CleaningTaskItem[];
  requirePhoto: boolean;
  hostName: string;
  reload: () => Promise<void>;
}) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function patch(id: string, body: unknown) {
    setBusy(true);
    setErr(null);
    const r = await jsonCall(`/api/cleaning/${id}`, "PATCH", body);
    setBusy(false);
    if (!r.ok) return setErr(typeof r.j.error === "string" ? r.j.error : "No se pudo guardar.");
    await reload();
  }

  return (
    <div>
      <h3 className="text-base font-semibold text-[#222]">{t("Mis limpiezas")}</h3>
      {err && <p className="mt-1 text-sm text-red-700">{t(err)}</p>}
      {tasks.length === 0 ? (
        <p className="mt-1 text-sm text-[#888]">{t("No tienes limpiezas asignadas.")}</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {tasks.map((task) => (
            <CleaningTaskCard
              key={task.id}
              task={task}
              busy={busy}
              requirePhoto={requirePhoto}
              chatPath={`/mensajes/${encodeURIComponent(task.listingId)}`}
              chatLabel={t("Chat con {name}", { name: hostName })}
              onChanged={reload}
              onDone={(done) => void patch(task.id, { done })}
              onNote={(note) => void patch(task.id, { note })}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

/** Lo que ve quien colabora con uno o varios anfitriones. */
export function TeamWorkspace() {
  const t = useT();
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [cleaning, setCleaning] = useState<Record<string, { requirePhoto: boolean; tasks: CleaningTaskItem[] }>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const loadCleaning = useCallback(async () => {
    const r = await jsonCall("/api/team/cleaning");
    if (!r.ok) return;
    const groups = (r.j.groups as { hostId: string; requirePhoto: boolean; tasks: CleaningTaskItem[] }[]) ?? [];
    setCleaning(Object.fromEntries(groups.map((g) => [g.hostId, { requirePhoto: g.requirePhoto, tasks: g.tasks }])));
  }, []);

  const load = useCallback(async () => {
    const r = await jsonCall("/api/team");
    if (r.ok) setTeams((r.j.teams as Team[]) ?? []);
    await loadCleaning();
  }, [loadCleaning]);

  useEffect(() => {
    const id = setTimeout(() => void load(), 0);
    return () => clearTimeout(id);
  }, [load]);

  async function respond(id: string, action: "accept" | "decline") {
    setBusy(true);
    setErr(null);
    const r = await jsonCall("/api/team", "POST", { id, action });
    setBusy(false);
    if (!r.ok) return setErr(typeof r.j.error === "string" ? r.j.error : "No se pudo guardar.");
    setTeams((r.j.teams as Team[]) ?? []);
    await loadCleaning();
  }

  if (!teams) return null;
  const invites = teams.filter((x) => x.status === "pending");
  const active = teams.filter((x) => x.status === "active");

  return (
    <div className="space-y-6">
      {err && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{t(err)}</p>}

      {invites.map((inv) => (
        <section key={inv.id} className="rounded-2xl border border-[#dcb81e] bg-[#fffbea] p-5">
          <p className="text-[15px] text-[#222]">
            {t("{name} te invitó a su equipo.", { name: inv.hostName })}
          </p>
          <p className="mt-1 text-sm text-[#555]">
            {inv.roles.map((r) => t(ROLE_LABEL[r])).join(" · ")} — {inv.listingTitles.map((x) => t(x)).join(", ")}
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void respond(inv.id, "accept")}
              className="rounded-xl bg-[#222] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {t("Aceptar")}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void respond(inv.id, "decline")}
              className="rounded-xl border border-[#ddd] bg-white px-4 py-2 text-sm text-[#222]"
            >
              {t("Rechazar")}
            </button>
          </div>
        </section>
      ))}

      {active.length === 0 && invites.length === 0 && (
        <section className="rounded-2xl border border-[#e5e5e5] bg-white p-6 text-center shadow-sm">
          <p className="text-3xl">🤝</p>
          <p className="mt-2 text-sm text-[#717171]">
            {t("Todavía no colaboras con ningún anfitrión. Cuando alguien te invite con tu correo, aparecerá aquí.")}
          </p>
        </section>
      )}

      {active.map((team) => (
        <section key={team.id} className="space-y-5 rounded-2xl border border-[#e5e5e5] bg-white p-5 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold text-[#222]">{team.hostName}</h2>
            <p className="text-xs text-[#888]">
              {team.roles.length
                ? team.roles.map((r) => t(ROLE_LABEL[r])).join(" · ")
                : t("Tu acceso está en pausa: el anfitrión debe renovar su plan.")}{" "}
              — {team.listingTitles.map((x) => t(x)).join(", ")}
            </p>
          </div>
          {team.roles.includes("cleaning") && (
            <CleaningBlock
              tasks={cleaning[team.hostId]?.tasks ?? []}
              requirePhoto={cleaning[team.hostId]?.requirePhoto ?? false}
              hostName={team.hostName}
              reload={loadCleaning}
            />
          )}
          {team.roles.includes("bookings") && (
            <BookingsBlock hostId={team.hostId} canSign={team.roles.includes("contracts")} />
          )}
          {team.roles.includes("messages") && <MessagesBlock hostId={team.hostId} />}
        </section>
      ))}
    </div>
  );
}
