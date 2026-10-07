/**
 * Prueba gratis y «modo vista previa» de las herramientas de equipo (limpieza y colaboradores).
 * Sin pagar, el anfitrión configura y explora todo; la herramienta sólo trabaja (avisos,
 * coordinación, chats) cuando está pagada o en su prueba gratis. Archivo sin dependencias de
 * servidor para poder importarlo desde la interfaz.
 */

export const TRIAL_DAYS = 30;
/** Colaboradores máximos en la prueba gratis y en la vista previa. */
export const TRIAL_MAX_COLLABORATORS = 5;
/** Familias del catálogo con prueba gratis. */
export const TRIAL_FAMILIES = ["cleaning_tool", "collaborator_seat"] as const;
export type TrialFamily = (typeof TRIAL_FAMILIES)[number];

export function isTrialFamily(family: string): family is TrialFamily {
  return (TRIAL_FAMILIES as readonly string[]).includes(family);
}

/** Lo que dice la API cuando una herramienta está en vista previa y se intenta usar algo que sí trabaja. */
export const TOOL_PREVIEW_CODE = "tool_preview";

export const TEAM_CHAT_PREVIEW_ERROR =
  "Los chats de equipo se encienden con la herramienta de colaboradores o la de limpieza. Pruébala 30 días gratis en la Tienda.";
export const CLEANING_PREVIEW_ERROR =
  "Tu herramienta de limpieza está en vista previa: puedes configurarla, pero todavía no está en marcha. Pruébala 30 días gratis en la Tienda.";
