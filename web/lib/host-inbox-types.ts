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
  createdAt: string;
};
