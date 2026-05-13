/** Proveedor con API tipo OpenAI Chat Completions (POST JSON). */
export type BlogBotProvider = "openai_compatible";

export type BlogBotConfigRecord = {
  version: 1;
  enabled: boolean;
  provider: BlogBotProvider;
  /**
   * Base OpenAI-compatible, sin barra final. Ej: https://api.openai.com/v1
   * Se usa con /chat/completions salvo que definas `chatCompletionsUrl`.
   */
  apiBaseUrl: string;
  /**
   * Si lo defines (p. ej. Azure OpenAI), se usa esta URL completa para POST.
   * Debe incluir query api-version si aplica.
   */
  chatCompletionsUrl?: string;
  model: string;
  temperature: number;
  maxTokens: number;
  /** Instrucciones de marca / tono (se añaden al system prompt del bot). */
  systemPromptAppend: string;
  /** Palabras clave que deben aparecer o inspirar el post (Urbnbee, Urbnbee AI, etc.). */
  brandKeywords: string;
  /** Timeout ms para la llamada HTTP al LLM. */
  timeoutMs: number;
  /** Temas o líneas editoriales (uno por entrada al rotar en lotes / cron). */
  topics: string[];
  /** Programación automática (requiere llamar el endpoint cron desde el exterior). */
  scheduleEnabled: boolean;
  /** IANA, ej. America/Mexico_City */
  scheduleTimezone: string;
  /** Días en que puede ejecutarse: 0=domingo … 6=sábado (según calendario local en `scheduleTimezone`). */
  scheduleDaysOfWeek: number[];
  /** Hora local en la zona configurada, formato 24h HH:mm */
  scheduleTimeLocal: string;
  /** Último día (YYYY-MM-DD en scheduleTimezone) en que el cron ya publicó un post (anti-duplicados). */
  scheduleLastPublishedDate?: string;
  updatedAt: string;
};

/** Respuesta JSON esperada del modelo al generar un post. */
export type GeneratedBlogPostPayload = {
  slug: string;
  title: string;
  publishedAt: string;
  excerpt: string;
  paragraphs: string[];
};
