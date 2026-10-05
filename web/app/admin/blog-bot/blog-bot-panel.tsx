"use client";

import { useCallback, useEffect, useState } from "react";
import { useT } from "@/components/i18n-provider";

type SafeConfig = {
  enabled: boolean;
  apiBaseUrl: string;
  chatCompletionsUrl?: string;
  model: string;
  temperature: number;
  maxTokens: number;
  systemPromptAppend: string;
  brandKeywords: string;
  timeoutMs: number;
  topics: string[];
  scheduleEnabled: boolean;
  scheduleTimezone: string;
  scheduleDaysOfWeek: number[];
  scheduleTimeLocal: string;
  scheduleLastPublishedDate?: string;
  apiKeyFromEnv: boolean;
  apiKeyEffectivePresent: boolean;
  storedApiKeyMasked: string | null;
  hasStoredApiKey: boolean;
};

type PreviewPost = {
  slug: string;
  title: string;
  publishedAt: string;
  excerpt: string;
  paragraphs: string[];
};

const WEEKDAY_OPTS = [
  { v: 0, l: "Dom" },
  { v: 1, l: "Lun" },
  { v: 2, l: "Mar" },
  { v: 3, l: "Mié" },
  { v: 4, l: "Jue" },
  { v: 5, l: "Vie" },
  { v: 6, l: "Sáb" },
];

const code = "text-xs bg-gray-100 px-1 rounded";
const codeLight = "text-xs bg-white/80 px-1 rounded";

export function BlogBotPanel() {
  const t = useT();
  const [cfg, setCfg] = useState<SafeConfig | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [apiBaseUrl, setApiBaseUrl] = useState("");
  const [chatCompletionsUrl, setChatCompletionsUrl] = useState("");
  const [model, setModel] = useState("");
  const [temperature, setTemperature] = useState(0.75);
  const [maxTokens, setMaxTokens] = useState(2200);
  const [timeoutMs, setTimeoutMs] = useState(120000);
  const [systemPromptAppend, setSystemPromptAppend] = useState("");
  const [brandKeywords, setBrandKeywords] = useState("");
  const [newApiKey, setNewApiKey] = useState("");
  const [previewDate, setPreviewDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewPost, setPreviewPost] = useState<PreviewPost | null>(null);
  const [previewErr, setPreviewErr] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [topicsText, setTopicsText] = useState("");
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleTimezone, setScheduleTimezone] = useState("America/Mexico_City");
  const [scheduleDaysOfWeek, setScheduleDaysOfWeek] = useState<number[]>([1, 3, 5]);
  const [scheduleTimeLocal, setScheduleTimeLocal] = useState("09:00");
  const [previewTopic, setPreviewTopic] = useState("");
  const [publishedRows, setPublishedRows] = useState<
    (PreviewPost & { source: string; origin: string })[]
  >([]);
  const [publishedMeta, setPublishedMeta] = useState<{ static: number; disk: number; totalUnique: number } | null>(
    null
  );
  const [batchCount, setBatchCount] = useState(5);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchMsg, setBatchMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadErr(null);
    const res = await fetch("/api/admin/blog-bot/config", { credentials: "include" });
    if (!res.ok) {
      setLoadErr("No se pudo cargar la configuración.");
      return;
    }
    const d = (await res.json()) as SafeConfig;
    setCfg(d);
    setEnabled(d.enabled);
    setApiBaseUrl(d.apiBaseUrl);
    setChatCompletionsUrl(d.chatCompletionsUrl ?? "");
    setModel(d.model);
    setTemperature(d.temperature);
    setMaxTokens(d.maxTokens);
    setTimeoutMs(d.timeoutMs);
    setSystemPromptAppend(d.systemPromptAppend);
    setBrandKeywords(d.brandKeywords);
    setTopicsText((d.topics ?? []).join("\n"));
    setScheduleEnabled(d.scheduleEnabled ?? false);
    setScheduleTimezone(d.scheduleTimezone ?? "America/Mexico_City");
    setScheduleDaysOfWeek(d.scheduleDaysOfWeek?.length ? d.scheduleDaysOfWeek : [1, 3, 5]);
    setScheduleTimeLocal(d.scheduleTimeLocal ?? "09:00");
  }, []);

  const loadPublished = useCallback(async () => {
    const res = await fetch("/api/admin/blog/published", { credentials: "include" });
    if (!res.ok) return;
    const data = (await res.json()) as {
      posts: (PreviewPost & { source: string; origin: string })[];
      counts: { static: number; disk: number; totalUnique: number };
    };
    setPublishedRows(data.posts);
    setPublishedMeta(data.counts);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadPublished();
  }, [loadPublished]);

  async function save(partial?: {
    clearStoredApiKey?: boolean;
    apiKey?: string;
  }) {
    setSaving(true);
    setSaveMsg(null);
    try {
      const body: Record<string, unknown> = {
        enabled,
        apiBaseUrl,
        chatCompletionsUrl: chatCompletionsUrl.trim() || null,
        model,
        temperature,
        maxTokens,
        timeoutMs,
        systemPromptAppend,
        brandKeywords,
        topics: topicsText
          .split("\n")
          .map((x) => x.trim())
          .filter(Boolean),
        scheduleEnabled,
        scheduleTimezone,
        scheduleDaysOfWeek,
        scheduleTimeLocal,
      };
      if (partial?.clearStoredApiKey) body.clearStoredApiKey = true;
      if (partial?.apiKey) body.apiKey = partial.apiKey;
      else if (newApiKey.trim()) body.apiKey = newApiKey.trim();

      const res = await fetch("/api/admin/blog-bot/config", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        setSaveMsg(t((e as { error?: string }).error ?? "Error al guardar"));
        return;
      }
      setNewApiKey("");
      setSaveMsg(t("Guardado."));
      await load();
      await loadPublished();
    } finally {
      setSaving(false);
    }
  }

  async function runPreview() {
    setPreviewLoading(true);
    setPreviewErr(null);
    setPreviewPost(null);
    try {
      const res = await fetch("/api/admin/blog-bot/preview", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publishedAt: previewDate,
          topicAngle: previewTopic.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const detail = typeof data.detail === "string" ? `\n${data.detail}` : "";
        setPreviewErr(t(data.error ?? "Error en la generación") + detail);
        return;
      }
      setPreviewPost(data.post as PreviewPost);
    } catch {
      setPreviewErr(t("Error de red"));
    } finally {
      setPreviewLoading(false);
    }
  }

  function copyPreviewJson() {
    if (!previewPost) return;
    void navigator.clipboard.writeText(JSON.stringify(previewPost, null, 2));
  }

  function toggleWeekday(d: number) {
    setScheduleDaysOfWeek((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => a - b)
    );
  }

  async function runBatch() {
    setBatchLoading(true);
    setBatchMsg(null);
    try {
      const res = await fetch("/api/admin/blog-bot/generate-batch", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: batchCount }),
      });
      const data = (await res.json()) as {
        message?: string;
        messageVars?: Record<string, number>;
        error?: string;
        errors?: string[];
      };
      if (!res.ok) {
        setBatchMsg(t(data.error ?? "Error en lote"));
        return;
      }
      const errTail =
        data.errors?.length && data.errors.length > 0 ? ` · ${data.errors.map((e) => t(e)).join(" · ")}` : "";
      setBatchMsg((data.message ? t(data.message, data.messageVars) : t("Listo.")) + errTail);
      await loadPublished();
    } finally {
      setBatchLoading(false);
    }
  }

  if (loadErr) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <p className="text-red-600">{t(loadErr)}</p>
      </div>
    );
  }

  if (!cfg) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <p className="text-gray-400 animate-pulse">{t("Cargando configuración…")}</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl pb-16">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{t("Blog automático (LLM)")}</h1>
        <p className="text-sm text-gray-600 mt-2 leading-relaxed">
          {t("Configura cómo Cabibee genera borradores de artículos con un modelo compatible con la API de")}{" "}
          <strong>OpenAI</strong> (Chat Completions). {t("En producción lo habitual es guardar la API key en")}{" "}
          <code className={code}>BLOG_BOT_OPENAI_API_KEY</code> {t("o")} <code className={code}>OPENAI_API_KEY</code>
          {t(", usar modelos con salida JSON o un esquema fijo, y disparar la generación con un")} <strong>cron</strong>{" "}
          {t("(Vercel Cron, GitHub Actions, Kubernetes CronJob) o una cola (BullMQ, SQS), no desde el navegador del usuario final.")}
        </p>
      </div>

      {/* Industry checklist */}
      <section className="mb-8 rounded-xl border border-amber-200 bg-amber-50/80 p-5 text-sm text-gray-800 space-y-3">
        <p className="font-semibold text-amber-900">{t("Lo que suele hacer la industria")}</p>
        <ul className="list-disc pl-5 space-y-1.5 text-gray-700">
          <li>
            <strong>{t("Secretos:")}</strong>{" "}
            {t("variables de entorno en el host (o Vault / Secrets Manager), no en el cliente ni en Git.")}
          </li>
          <li>
            <strong>{t("Salida estructurada:")}</strong> JSON Schema /{" "}
            <code className={codeLight}>response_format json_object</code> {t("(OpenAI) para parsear sin ambigüedades.")}
          </li>
          <li>
            <strong>{t("Costos y límites:")}</strong> {t("modelo económico para borradores (p. ej.")}{" "}
            <code className="text-xs bg-white/80 px-1">gpt-4o-mini</code>),{" "}
            <code className="text-xs bg-white/80 px-1">max_tokens</code> {t("acotado, reintentos con backoff.")}
          </li>
          <li>
            <strong>{t("Publicación:")}</strong> {t("aquí los artículos generados se guardan en")}{" "}
            <code className={codeLight}>data/blog-published-posts.json</code> {t("y el blog público los fusiona con")}{" "}
            <code className={codeLight}>blog-data.ts</code>. {t("En hosting sin disco persistente usa base de datos u Object Storage.")}
          </li>
          <li>
            <strong>Azure OpenAI:</strong>{" "}
            {t("usa la URL completa del deployment en \"URL de completions\" y la misma cabecera Bearer con tu API key de Azure.")}
          </li>
        </ul>
      </section>

      {/* Toggle */}
      <section className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4 accent-amber-600"
          />
          <span className="font-medium text-gray-900">{t("Bot habilitado")}</span>
        </label>
        <p className="text-xs text-gray-500 mt-2 ml-7">
          {t("Si está desactivado, la vista previa rechazará la llamada aunque exista API key.")}
        </p>
      </section>

      {/* LLM connection */}
      <section className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">{t("Conexión al modelo")}</h2>
        <label className="block text-sm">
          <span className="text-gray-600">Base URL (OpenAI-compatible)</span>
          <input
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            value={apiBaseUrl}
            onChange={(e) => setApiBaseUrl(e.target.value)}
            placeholder="https://api.openai.com/v1"
          />
        </label>
        <label className="block text-sm">
          <span className="text-gray-600">
            {t("URL completa de Chat Completions (opcional, p. ej. Azure OpenAI)")}
          </span>
          <input
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-xs"
            value={chatCompletionsUrl}
            onChange={(e) => setChatCompletionsUrl(e.target.value)}
            placeholder={t("Vacío = {base}/chat/completions")}
          />
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block text-sm">
            <span className="text-gray-600">{t("Modelo")}</span>
            <input
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              value={model}
              onChange={(e) => setModel(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-gray-600">Timeout (ms)</span>
            <input
              type="number"
              min={5000}
              max={600000}
              step={1000}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              value={timeoutMs}
              onChange={(e) => setTimeoutMs(Number(e.target.value))}
            />
          </label>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block text-sm">
            <span className="text-gray-600">Temperature (0–2)</span>
            <input
              type="number"
              min={0}
              max={2}
              step={0.05}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              value={temperature}
              onChange={(e) => setTemperature(Number(e.target.value))}
            />
          </label>
          <label className="block text-sm">
            <span className="text-gray-600">Max tokens</span>
            <input
              type="number"
              min={256}
              max={16000}
              step={64}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              value={maxTokens}
              onChange={(e) => setMaxTokens(Number(e.target.value))}
            />
          </label>
        </div>
      </section>

      {/* API keys */}
      <section className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
        <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">API key</h2>
        <div className="text-xs text-gray-600 space-y-1">
          <p>
            {t("Variable de entorno detectada:")}{" "}
            <strong>{cfg?.apiKeyFromEnv ? t("sí (BLOG_BOT_OPENAI_API_KEY u OPENAI_API_KEY)") : t("no")}</strong>
          </p>
          <p>
            {t("Clave efectiva para llamadas:")}{" "}
            <strong className={cfg?.apiKeyEffectivePresent ? "text-green-700" : "text-red-600"}>
              {cfg?.apiKeyEffectivePresent ? t("disponible") : t("no configurada")}
            </strong>
          </p>
          {cfg?.hasStoredApiKey && (
            <p>
              {t("Clave guardada en servidor (archivo):")}{" "}
              <code className="bg-gray-100 px-1 rounded">{cfg.storedApiKeyMasked}</code>
            </p>
          )}
        </div>
        <label className="block text-sm">
          <span className="text-gray-600">{t("Nueva API key (solo servidor; opcional si usas env)")}</span>
          <input
            type="password"
            autoComplete="off"
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            value={newApiKey}
            onChange={(e) => setNewApiKey(e.target.value)}
            placeholder="sk-..."
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => save()}
            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
          >
            {saving ? t("Guardando…") : t("Guardar configuración")}
          </button>
          {cfg?.hasStoredApiKey && (
            <button
              type="button"
              disabled={saving}
              onClick={() => save({ clearStoredApiKey: true })}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {t("Borrar clave guardada en archivo")}
            </button>
          )}
        </div>
        {saveMsg && <p className="text-sm text-gray-600">{saveMsg}</p>}
      </section>

      {/* Prompts */}
      <section className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">{t("Instrucciones de marca")}</h2>
        <label className="block text-sm">
          <span className="text-gray-600">{t("Tono y lineamientos (se añaden al system prompt)")}</span>
          <textarea
            rows={4}
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            value={systemPromptAppend}
            onChange={(e) => setSystemPromptAppend(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="text-gray-600">{t("Palabras clave / temas (Cabibee, anfitriones, …)")}</span>
          <textarea
            rows={3}
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            value={brandKeywords}
            onChange={(e) => setBrandKeywords(e.target.value)}
          />
        </label>
      </section>

      {/* Temas editoriales */}
      <section className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
        <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">{t("Temas del blog (rotación)")}</h2>
        <p className="text-xs text-gray-500">
          {t(
            "Un tema por línea. El lote y el cron usan esta lista en orden (rotando). Ej.: consejos de anfitrión, Cabibee AI, temporada alta, etc."
          )}
        </p>
        <textarea
          rows={6}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono"
          value={topicsText}
          onChange={(e) => setTopicsText(e.target.value)}
          placeholder={t("Consejos para anfitriones\nHuéspedes en Cabibee\n...")}
        />
      </section>

      {/* Programación */}
      <section className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">{t("Calendario y horario (cron)")}</h2>
        <p className="text-xs text-gray-500">
          {t("Define cuándo puede ejecutarse la publicación automática. Debes programar una llamada HTTP externa a")}{" "}
          <code className="bg-gray-100 px-1 rounded">/api/cron/blog-scheduled</code> {t("con")}{" "}
          <code className="bg-gray-100 px-1 rounded">CRON_SECRET</code> ({t("cabecera")}{" "}
          <code className="bg-gray-100 px-1 rounded">Authorization: Bearer …</code> {t("o query")}{" "}
          <code className="bg-gray-100 px-1 rounded">?secret=</code>).{" "}
          {t("En la ventana de tiempo indicada se genera como máximo un post por día civil en tu zona.")}
        </p>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={scheduleEnabled}
            onChange={(e) => setScheduleEnabled(e.target.checked)}
            className="h-4 w-4 accent-amber-600"
          />
          <span className="font-medium text-gray-900">{t("Activar ventana programada")}</span>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block text-sm">
            <span className="text-gray-600">{t("Zona horaria (IANA)")}</span>
            <input
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono"
              value={scheduleTimezone}
              onChange={(e) => setScheduleTimezone(e.target.value)}
              placeholder="America/Mexico_City"
            />
          </label>
          <label className="block text-sm">
            <span className="text-gray-600">{t("Hora local (HH:mm)")}</span>
            <input
              type="time"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              value={scheduleTimeLocal}
              onChange={(e) => setScheduleTimeLocal(e.target.value)}
            />
          </label>
        </div>
        <div>
          <span className="text-sm text-gray-600">{t("Días de la semana")}</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {WEEKDAY_OPTS.map(({ v, l }) => (
              <button
                key={v}
                type="button"
                onClick={() => toggleWeekday(v)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  scheduleDaysOfWeek.includes(v)
                    ? "bg-amber-500 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {t(l)}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-gray-400 mt-1">
            {t("Última publicación automática registrada:")}{" "}
            <strong>{cfg.scheduleLastPublishedDate ?? "—"}</strong> {t("(en tu zona configurada).")}
          </p>
        </div>
      </section>

      {/* Preview */}
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">{t("Vista previa (una entrada)")}</h2>
        <p className="text-xs text-gray-500">
          {t("No guarda en disco; sirve para revisar tono y JSON. Para publicar varios a la vez usa la sección inferior.")}
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="text-gray-600 block mb-1">{t("Fecha del artículo")}</span>
            <input
              type="date"
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
              value={previewDate}
              onChange={(e) => setPreviewDate(e.target.value)}
            />
          </label>
          <label className="text-sm flex-1 min-w-[200px]">
            <span className="text-gray-600 block mb-1">{t("Tema opcional (sobrescribe rotación)")}</span>
            <input
              type="text"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              value={previewTopic}
              onChange={(e) => setPreviewTopic(e.target.value)}
              placeholder={t("Vacío = tema por defecto del bot")}
            />
          </label>
          <button
            type="button"
            disabled={previewLoading}
            onClick={() => runPreview()}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {previewLoading ? t("Generando…") : t("Generar vista previa")}
          </button>
        </div>
        {previewErr && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 whitespace-pre-wrap">{previewErr}</div>
        )}
        {previewPost && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={copyPreviewJson}
                className="text-sm text-amber-700 underline hover:text-amber-900"
              >
                {t("Copiar JSON")}
              </button>
            </div>
            <article className="rounded-lg border border-gray-100 bg-gray-50 p-4">
              <h3 className="text-lg font-bold text-gray-900">{previewPost.title}</h3>
              <p className="text-xs text-gray-500 mt-1">{previewPost.publishedAt}</p>
              <p className="text-gray-700 mt-3 font-medium">{previewPost.excerpt}</p>
              <div className="mt-4 space-y-3 text-sm text-gray-700 leading-relaxed">
                {previewPost.paragraphs.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </article>
            <pre className="text-xs bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto max-h-64 overflow-y-auto">
              {JSON.stringify(previewPost, null, 2)}
            </pre>
          </div>
        )}
      </section>

      {/* Generación masiva */}
      <section className="mt-8 rounded-xl border border-amber-200 bg-amber-50/50 p-5 shadow-sm space-y-3">
        <h2 className="text-sm font-semibold text-amber-900 uppercase tracking-wide">{t("Generar varios posts ahora")}</h2>
        <p className="text-xs text-gray-600">
          {t(
            "Usa los temas configurados (uno por fecha, desde hoy). Requiere API key; no exige el interruptor \"Bot habilitado\". Máximo 12 por petición para no saturar al proveedor."
          )}
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="text-gray-600 block mb-1">{t("Cantidad")}</span>
            <input
              type="number"
              min={1}
              max={12}
              className="w-24 rounded-lg border border-gray-200 px-3 py-2 text-sm"
              value={batchCount}
              onChange={(e) => setBatchCount(Number(e.target.value))}
            />
          </label>
          <button
            type="button"
            disabled={batchLoading}
            onClick={() => runBatch()}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {batchLoading ? t("Generando…") : t("Generar y publicar en disco")}
          </button>
        </div>
        {batchMsg && <p className="text-sm text-gray-700 whitespace-pre-wrap">{batchMsg}</p>}
      </section>

      {/* Lista publicados */}
      <section className="mt-8 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">{t("Posts publicados en el sitio")}</h2>
          <button
            type="button"
            onClick={() => loadPublished()}
            className="text-xs text-amber-700 hover:underline"
          >
            {t("Actualizar lista")}
          </button>
        </div>
        {publishedMeta && (
          <p className="text-xs text-gray-500 mb-3">
            {t("Código estático: {static} · En disco: {disk} · Slugs únicos: {unique}", {
              static: publishedMeta.static,
              disk: publishedMeta.disk,
              unique: publishedMeta.totalUnique,
            })}
          </p>
        )}
        <div className="overflow-x-auto border border-gray-100 rounded-lg">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left border-b border-gray-100">
                <th className="px-3 py-2 text-xs font-semibold text-gray-500">{t("Fecha")}</th>
                <th className="px-3 py-2 text-xs font-semibold text-gray-500">{t("Título")}</th>
                <th className="px-3 py-2 text-xs font-semibold text-gray-500">Slug</th>
                <th className="px-3 py-2 text-xs font-semibold text-gray-500">{t("Origen")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {publishedRows.map((row) => (
                <tr key={`${row.source}-${row.slug}`} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{row.publishedAt}</td>
                  <td className="px-3 py-2 text-gray-800 max-w-xs truncate">{row.title}</td>
                  <td className="px-3 py-2 font-mono text-xs text-gray-600">{row.slug}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        row.source === "static" ? "bg-gray-100 text-gray-600" : "bg-green-100 text-green-800"
                      }`}
                    >
                      {t(row.origin)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {publishedRows.length === 0 && (
            <p className="p-4 text-sm text-gray-400 text-center">{t("No hay entradas.")}</p>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-3">
          {t("Los artículos en disco tienen enlace público")} <code className="bg-gray-100 px-1 rounded">/blog/[slug]</code>{" "}
          {t("igual que los del código.")}
        </p>
      </section>
    </div>
  );
}
