import "server-only";
import type { ListingDetail } from "@/lib/listing-detail-data";

export async function listingChatLocalReply(
  listing: ListingDetail,
  message: string
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (apiKey) {
    try {
      const systemPrompt = `Eres el asistente virtual del alojamiento "${listing.title}" en Cabibee.
Responde SOLO en español, de forma concisa y amigable.

Información del alojamiento:
- Título: ${listing.title}
- Descripción: ${listing.description}
- Ubicación: ${listing.city}, ${listing.zone}, ${listing.country}
- Precio: $${listing.pricePerNight} MXN por noche${listing.cleaningFee ? `, tarifa de limpieza $${listing.cleaningFee}` : ""}
- Capacidad: ${listing.guests} huéspedes, ${listing.bedrooms} recámaras, ${listing.bathrooms} baños
- Comodidades: ${listing.amenities.join(", ")}
- Reglas: ${listing.rules.smoking === false ? "No fumar" : "Se permite fumar"}, ${listing.rules.pets ? "Se aceptan mascotas" : "No mascotas"}, ${listing.rules.children ? "Niños bienvenidos" : "No niños"}, ${listing.rules.parties === false ? "No fiestas" : "Eventos permitidos"}
- Anfitrión: ${listing.host.name}

Nunca inventes ni reveles teléfono, WhatsApp, correo ni redes del anfitrión. Si preguntan cómo contactar, di que con cuenta en Cabibee pueden usar el botón de contacto y el chat de la página, y que la verificación de huésped aplica al reservar.

Si el usuario pregunta por reservar, indica el calendario de la página y el flujo de reserva en Cabibee.`;

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: message },
          ],
          max_tokens: 200,
          temperature: 0.7,
        }),
      });
      const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
      const reply = data.choices?.[0]?.message?.content?.trim();
      if (reply) return reply;
    } catch (err) {
      console.error("[chat] OpenAI error:", err);
    }
  }

  return listingChatKeywordReply(listing, message);
}

export function listingChatKeywordReply(listing: ListingDetail, message: string): string {
  const msg = message.toLowerCase();

  if (msg.includes("precio") || msg.includes("costo") || msg.includes("cuánto") || msg.includes("cuanto")) {
    return `El precio es $${listing.pricePerNight.toLocaleString("es-MX")} MXN por noche${listing.cleaningFee ? `. Tarifa de limpieza única: $${listing.cleaningFee}.` : "."}`;
  }
  if (msg.includes("wifi") || msg.includes("internet")) {
    const hasWifi = listing.amenities.some((a) => a.toLowerCase().includes("internet") || a.toLowerCase().includes("wifi"));
    return hasWifi
      ? "Sí, el alojamiento cuenta con Internet inalámbrico incluido."
      : "No tenemos confirmación de WiFi en este momento, te recomendamos contactar al anfitrión.";
  }
  if (msg.includes("mascota") || msg.includes("perro") || msg.includes("gato")) {
    return listing.rules.pets
      ? "¡Sí! Se aceptan mascotas en este alojamiento."
      : "Lo sentimos, este alojamiento no acepta mascotas.";
  }
  if (msg.includes("fumar")) {
    return listing.rules.smoking === false
      ? "Este es un alojamiento 100% libre de humo."
      : "Se permite fumar en áreas exteriores.";
  }
  if (msg.includes("niño") || msg.includes("niños") || msg.includes("familia")) {
    return listing.rules.children
      ? "¡Sí! Este alojamiento es apto para familias con niños."
      : "Este alojamiento no es recomendable para niños.";
  }
  if (msg.includes("disponib") || msg.includes("fecha") || msg.includes("reserv")) {
    return "Puedes verificar la disponibilidad y reservar con el calendario de esta página. Para escribir al anfitrión o ver sus datos de contacto directos necesitas una cuenta gratuita en Cabibee; al reservar se aplicará la verificación de huésped.";
  }
  if (msg.includes("check") || msg.includes("entrada") || msg.includes("salida")) {
    return `El check-in y check-out se coordinan directamente con el anfitrión, ${listing.host.name}.`;
  }
  if (msg.includes("dirección") || msg.includes("donde") || msg.includes("ubicación") || msg.includes("ubicacion")) {
    return `El alojamiento está en ${listing.city}, ${listing.zone}, ${listing.country}. La dirección exacta se proporciona tras confirmar la reserva.`;
  }
  if (msg.includes("cocina") || msg.includes("comer")) {
    const hasCocina = listing.amenities.some((a) => a.toLowerCase().includes("cocina"));
    return hasCocina
      ? "Sí, este alojamiento cuenta con cocina totalmente equipada para que puedas preparar tus comidas."
      : "Este alojamiento no incluye cocina. Te recomendamos preguntar al anfitrión por opciones cercanas.";
  }
  if (msg.includes("hola") || msg.includes("buenas") || msg.includes("buenos")) {
    return `¡Hola! 😊 Bienvenido al asistente de "${listing.title}". ¿En qué puedo ayudarte? Puedes preguntarme sobre precios, disponibilidad, amenidades o las reglas del alojamiento.`;
  }
  return `Gracias por tu pregunta. Para más detalles sobre "${listing.title}", ${listing.host.name} está disponible a través de Cabibee: crea una cuenta gratuita y usa el chat con el anfitrión o el botón de contacto en esta página. Los datos directos no se muestran a visitantes sin cuenta, por seguridad de todos.`;
}
