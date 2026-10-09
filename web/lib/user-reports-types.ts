/** Reportes que mandan huéspedes y anfitriones al equipo de Cabibee. */
export type UserReportKind = "report_account" | "claim_account" | "complaint" | "suggestion";

export type UserReportStatus = "open" | "in_review" | "resolved" | "dismissed";

export type ReportAiDecision = "pending" | "suspend" | "keep" | "error";

/** Folio que ve quien reportó. */
export function reportReceipt(id: string): string {
  return `R-${id.replace(/^rpt_/, "").slice(0, 8).toUpperCase()}`;
}

export type UserReportRecord = {
  id: string;
  kind: UserReportKind;
  category: string;
  reporterId: string;
  reporterEmail: string;
  reporterName: string;
  /** Modo desde el que escribió (huésped o anfitrión). */
  reporterMode: "guest" | "host";
  /** Cuenta señalada, si se pudo identificar. */
  targetUserId?: string;
  /** Lo que escribió el usuario para identificar la cuenta: correo, nombre o liga. */
  targetLabel?: string;
  listingId?: string;
  bookingId?: string;
  message: string;
  /** Cuestionario de una denuncia de cuenta. */
  answers?: { where: string; ongoing: string };
  /** Decisión automática sobre la cuenta señalada. El motivo es interno. */
  aiDecision?: ReportAiDecision;
  aiReason?: string;
  aiModel?: string;
  aiAt?: string;
  aiAttempts?: number;
  /** Correo o teléfono para responder, si no es el de la cuenta. */
  contact?: string;
  status: UserReportStatus;
  adminNote?: string;
  /** Respuesta visible para quien reportó. */
  adminReply?: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
};

export const REPORT_KINDS: { kind: UserReportKind; label: string; hint: string; needsTarget: boolean }[] = [
  {
    kind: "report_account",
    label: "Denunciar una cuenta",
    hint: "Fraude, acoso, anuncio falso o algo que va contra las reglas.",
    needsTarget: true,
  },
  {
    kind: "claim_account",
    label: "Reclamar una cuenta",
    hint: "Alguien usa tu nombre, tus fotos o tu propiedad, o perdiste acceso a tu cuenta.",
    needsTarget: true,
  },
  {
    kind: "complaint",
    label: "Queja de una reserva o del servicio",
    hint: "Algo salió mal en una estancia, un pago o en Cabibee.",
    needsTarget: false,
  },
  {
    kind: "suggestion",
    label: "Sugerencia",
    hint: "Ideas para mejorar Cabibee.",
    needsTarget: false,
  },
];

export const REPORT_CATEGORIES: Record<UserReportKind, string[]> = {
  report_account: [
    "Fraude o estafa",
    "Pide pagar fuera de Cabibee",
    "Anuncio falso o engañoso",
    "Acoso o lenguaje ofensivo",
    "Suplantación de identidad",
    "Discriminación",
    "Contenido inapropiado",
    "Otro",
  ],
  claim_account: [
    "Usa mi nombre o mis fotos",
    "Publica mi propiedad sin permiso",
    "Perdí acceso a mi cuenta",
    "Tengo una cuenta duplicada",
    "Otro",
  ],
  complaint: ["Problema con una estancia", "Problema con un pago o reembolso", "Problema con la app o el sitio", "Otro"],
  suggestion: ["Nueva función", "Mejora de algo que ya existe", "Diseño o facilidad de uso", "Otro"],
};

export const REPORT_WHERE = ["En el chat de Cabibee", "En un anuncio", "En el perfil", "Fuera de Cabibee"] as const;

export const REPORT_ONGOING = ["Sí, sigue pasando", "No, ya pasó"] as const;

export const REPORT_STATUS_LABEL: Record<UserReportStatus, string> = {
  open: "Recibido",
  in_review: "En revisión",
  resolved: "Resuelto",
  dismissed: "Cerrado sin acción",
};

export function reportKindLabel(kind: UserReportKind): string {
  return REPORT_KINDS.find((k) => k.kind === kind)?.label ?? kind;
}

/** Lo que ve quien reportó: sin la nota interna del equipo. */
export type MyReportView = Omit<UserReportRecord, "adminNote" | "reporterEmail" | "targetUserId" | "aiReason" | "aiDecision" | "aiModel" | "aiAt" | "aiAttempts"> & {
  targetName?: string;
};

/** Cuentas con las que el usuario ya trató (reservas o chats): se ofrecen para no escribir el correo a mano. */
export type ReportCounterpart = {
  userId: string;
  name: string;
  /** "host": es anfitrión de quien reporta; "guest": es su huésped. */
  relation: "host" | "guest";
  listingId?: string;
  listingTitle?: string;
};
