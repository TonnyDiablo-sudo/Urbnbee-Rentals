import type { HostContact } from "@/lib/listing-detail-data";

/** Quita teléfono, WhatsApp, correo y enlaces directos al anfitrión (exploración sin cuenta). */
export function stripHostContactChannels(host: HostContact): HostContact {
  return {
    ...host,
    whatsapp: undefined,
    phone: undefined,
    email: undefined,
    instagram: undefined,
    website: undefined,
    airbnbUrl: undefined,
  };
}
