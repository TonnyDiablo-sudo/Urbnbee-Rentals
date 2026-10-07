export type HostInboxSender = "guest" | "host";

/** Mensaje en el hilo huésped ↔ anfitrión (persistido en JSON en desarrollo). */
export type HostInboxMessageRecord = {
  id: string;
  listingId: string;
  hostId: string;
  /** Identifica el hilo en este alojamiento (cookie anónima del navegador huésped). */
  guestSessionId: string;
  sender: HostInboxSender;
  guestName: string;
  guestEmail?: string;
  body: string;
  /** Si quien mandó usó el traductor: lo que escribió tal cual (`body` va ya traducido). */
  original?: string;
  /** Idioma al que se tradujo `body`. */
  lang?: string;
  /** Foto o nota de voz; `body` es el texto que la acompaña (puede ir vacío). */
  attachment?: ChatAttachment;
  /** Transcripción de la nota de voz, en el idioma en que se habló (se llena en segundo plano). */
  transcript?: string;
  /** "ai": lo escribió el agente de urbnbeeai a nombre del anfitrión. */
  via?: "ai";
  /** Id que mandó urbnbeeai; un reintento con el mismo id no duplica el mensaje. */
  partnerMessageId?: string;
  createdAt: string;
};

export type ChatAttachment = {
  /** Nombre del archivo dentro del hilo: `<id>.<ext>`. */
  file: string;
  kind: "image" | "audio";
  mime: string;
  bytes: number;
  durationSec?: number;
  width?: number;
  height?: number;
};

/** Lo que recibe el cliente: la URL ya revisa permisos. */
export type ChatAttachmentView = {
  url: string;
  kind: "image" | "audio";
  durationSec?: number;
  width?: number;
  height?: number;
};
