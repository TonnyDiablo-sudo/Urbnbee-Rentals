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
  /** Foto o nota de voz; `body` es el texto que la acompaña (puede ir vacío). */
  attachment?: ChatAttachment;
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
