"use client";

import { useEffect, useState, useCallback } from "react";
import type { AdminLogRow } from "@/lib/admin-data";

const ENTITY_COLORS: Record<string, string> = {
  booking: "bg-blue-100 text-blue-700",
  verification: "bg-amber-100 text-amber-700",
  user: "bg-purple-100 text-purple-700",
};

const ENTITY_ICONS: Record<string, string> = {
  booking: "🏠",
  verification: "🔒",
  user: "👤",
};

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<AdminLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [filterType, setFilterType] = useState<"all" | "booking" | "verification">("all");
  const [search, setSearch] = useState("");
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const load = useCallback(() => {
    fetch("/api/admin/logs?limit=300")
      .then((r) => r.json())
      .then((data) => {
        setLogs(data);
        setLastRefresh(new Date());
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [autoRefresh, load]);

  const filtered = logs.filter((l) => {
    if (filterType !== "all" && l.entityType !== filterType) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!l.event.toLowerCase().includes(q) && !l.detail.toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="p-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Actividad</h1>
          <p className="text-sm text-gray-500 mt-1">
            Registro de eventos recientes en la plataforma.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={load}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
          >
            ↺ Actualizar
          </button>
          <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="accent-amber-500"
            />
            Auto (15 s)
          </label>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <input
          type="text"
          placeholder="Buscar en eventos…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm flex-1 min-w-48 focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
        {(["all", "booking", "verification"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setFilterType(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filterType === t
                ? "bg-amber-500 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {t === "all" ? "Todo" : t === "booking" ? "Reservas" : "Verificación"}
          </button>
        ))}
        <span className="text-xs text-gray-400 ml-auto">
          Última actualización: {lastRefresh.toLocaleTimeString("es-MX")}
        </span>
      </div>

      {loading ? (
        <p className="text-gray-400 animate-pulse">Cargando eventos…</p>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-gray-400">
          Sin eventos que mostrar.
        </div>
      ) : (
        <div className="space-y-0 bg-white border border-gray-200 rounded-xl overflow-hidden">
          {filtered.map((log, i) => (
            <div
              key={log.id}
              className={`flex gap-4 px-5 py-4 ${
                i > 0 ? "border-t border-gray-100" : ""
              } hover:bg-gray-50 transition-colors`}
            >
              {/* Icon */}
              <div className="shrink-0 mt-0.5">
                <span
                  className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm ${
                    ENTITY_COLORS[log.entityType] ?? "bg-gray-100 text-gray-600"
                  }`}
                >
                  {ENTITY_ICONS[log.entityType] ?? "·"}
                </span>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <p className="text-sm font-medium text-gray-800">{log.event}</p>
                  <span
                    className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      ENTITY_COLORS[log.entityType] ?? "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {log.entityType}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5 truncate">{log.detail}</p>
                {log.meta && Object.keys(log.meta).length > 0 && (
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                    {Object.entries(log.meta)
                      .filter(([, v]) => v !== undefined && v !== "")
                      .map(([k, v]) => (
                        <span key={k} className="text-[10px] text-gray-400">
                          <span className="text-gray-300">{k}:</span>{" "}
                          <span className="font-mono">{String(v)}</span>
                        </span>
                      ))}
                  </div>
                )}
              </div>

              {/* Time */}
              <div className="shrink-0 text-right">
                <p className="text-xs text-gray-400 whitespace-nowrap">
                  {new Date(log.when).toLocaleDateString("es-MX", {
                    day: "2-digit",
                    month: "short",
                  })}
                </p>
                <p className="text-[10px] text-gray-300">
                  {new Date(log.when).toLocaleTimeString("es-MX", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-300 mt-4 text-center">
        {filtered.length} evento{filtered.length !== 1 ? "s" : ""} mostrado
        {filtered.length !== 1 ? "s" : ""}
      </p>
    </div>
  );
}
