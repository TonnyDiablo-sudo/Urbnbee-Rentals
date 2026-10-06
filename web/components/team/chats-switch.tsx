"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useT } from "@/components/i18n-provider";
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
  if (!showSwitch) return <>{children}</>;

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

  return (
    <>
      <div className={web ? "mb-6 max-w-md" : "px-5 pb-2 pt-1"}>
        <div role="tablist" className="flex gap-1 rounded-full border border-[#e5e5e5] bg-white p-1">
          {pill("guests", t(guestsLabel), "💬")}
          {pill("team", t("Colaboradores"), "👥")}
        </div>
      </div>
      {tab === "guests" ? (
        children
      ) : (
        <div className={web ? "max-w-4xl space-y-5" : "space-y-5 px-5 pb-10 pt-2"}>
          {own && <TeamChat />}
          {(teams ?? []).map((team) => (
            <div key={team.id} className="space-y-2">
              {(own || (teams?.length ?? 0) > 1) && (
                <p className="text-xs font-semibold uppercase tracking-wide text-[#999]">{t("Equipo de {name}", { name: team.hostName })}</p>
              )}
              <TeamChat hostId={team.hostId} />
            </div>
          ))}
        </div>
      )}
    </>
  );
}
