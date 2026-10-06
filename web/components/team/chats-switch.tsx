"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useT } from "@/components/i18n-provider";
import { ChatSearchContext } from "@/components/chat/chat-search";
import { TeamChat } from "@/components/team/team-chat";

type Team = { id: string; hostId: string; hostName: string; status: string };
type Tab = "guests" | "team";

function tabFromUrl(): Tab {
  return new URLSearchParams(window.location.search).get("tab") === "equipo" ? "team" : "guests";
}

/**
 * Mensajes con dos pestañas: los chats con huéspedes o anfitriones y los chats de equipo.
 * Con `own` (anfitrión) siempre sale la de equipo; si no, sólo cuando la persona colabora con alguien.
 */
export function ChatsSwitch({ guestsLabel, own = false, web = false, children }: { guestsLabel: string; own?: boolean; web?: boolean; children: ReactNode }) {
  const t = useT();
  const [tab, setTab] = useState<Tab>("guests");
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const id = setTimeout(() => setTab(tabFromUrl()), 0);
    let alive = true;
    fetch("/api/team", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { teams: [] }))
      .then((j) => alive && setTeams(((j.teams as Team[]) ?? []).filter((x) => x.status === "active")))
      .catch(() => alive && setTeams([]));
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, []);

  const showSwitch = own || (teams?.length ?? 0) > 0;

  function pick(next: Tab) {
    setTab(next);
    const url = new URL(window.location.href);
    if (next === "team") url.searchParams.set("tab", "equipo");
    else url.searchParams.delete("tab");
    url.searchParams.delete("chat");
    window.history.replaceState(null, "", url.toString());
  }

  const pill = (id: Tab, label: string, icon: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === id}
      onClick={() => pick(id)}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition ${
        tab === id ? "bg-[#222] text-white" : "text-[#484848]"
      }`}
    >
      <span aria-hidden>{icon}</span>
      {label}
    </button>
  );

  const pad = web ? "" : "px-5";
  const current = showSwitch ? tab : "guests";

  return (
    <ChatSearchContext.Provider value={query}>
      <div className={web ? "mb-4 max-w-md space-y-3" : "space-y-3 px-5 pb-3 pt-1"}>
        {showSwitch && (
          <div role="tablist" className="flex gap-1 rounded-full border border-[#e5e5e5] bg-white p-1">
            {pill("guests", t(guestsLabel), "💬")}
            {pill("team", t("Colaboradores"), "👥")}
          </div>
        )}
        <label className="flex items-center gap-2 rounded-full bg-[#f3f3f3] px-4 py-2.5">
          <span aria-hidden className="text-[#888]">
            🔎
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("Buscar en chats")}
            aria-label={t("Buscar en chats")}
            className="min-w-0 flex-1 bg-transparent text-[15px] text-[#222] outline-none placeholder:text-[#999]"
          />
        </label>
      </div>
      {current === "guests" ? (
        children
      ) : (
        <div className={web ? "max-w-4xl space-y-6" : "space-y-6 pb-10"}>
          {own && <TeamChat pad={pad} />}
          {(teams ?? []).map((team) => (
            <div key={team.id}>
              {(own || (teams?.length ?? 0) > 1) && (
                <p className={`${pad} pb-1 text-xs font-semibold uppercase tracking-wide text-[#999]`}>{t("Equipo de {name}", { name: team.hostName })}</p>
              )}
              <TeamChat hostId={team.hostId} pad={pad} />
            </div>
          ))}
        </div>
      )}
    </ChatSearchContext.Provider>
  );
}
