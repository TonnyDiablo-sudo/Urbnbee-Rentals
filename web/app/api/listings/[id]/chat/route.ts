import { NextRequest, NextResponse } from "next/server";
import { resolveListingDetail } from "@/lib/get-listing-detail";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { message } = await req.json();

  if (!message?.trim()) {
    return NextResponse.json({ reply: "Por favor escribe tu pregunta." });
  }

  const listing = resolveListingDetail(id);

  if (!listing) {
    return NextResponse.json({ reply: "No encontré información sobre este alojamiento." });
  }

  // --- Real AI (GPT-4o-mini) if API key is present ---
  const apiKey = process.env.OPENAI_API_KEY;

  if (apiKey) {
    try {
      const systemPrompt = `Eres el asistente virtual del alojamiento "${listing.title}" en Urbnbee.
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

Nunca inventes ni reveles teléfono, WhatsApp, correo ni redes del anfitrión. Si preguntan cómo contactar, di que con cuenta en Urbnbee pueden usar el botón de contacto y el chat de la página, y que la verificación de huésped aplica al reservar.

Si el usuario pregunta por reservar, indica el calendario de la página y el flujo de reserva en Urbnbee.`;

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

      const data = await response.json();
      const reply = data.choices?.[0]?.message?.content?.trim();
      if (reply) return NextResponse.json({ reply });
    } catch (err) {
      console.error("[chat] OpenAI error:", err);
    }
  }

  // --- Fallback: keyword-based responses ---
  const msg = message.toLowerCase();
  let reply = "";

  if (msg.includes("precio") || msg.includes("costo") || msg.includes("cuánto") || msg.includes("cuanto")) {
    reply = `El precio es $${listing.pricePerNight.toLocaleString("es-MX")} MXN por noche${listing.cleaningFee ? `. Tarifa de limpieza única: $${listing.cleaningFee}.` : "."}`;
  } else if (msg.includes("wifi") || msg.includes("internet")) {
    const hasWifi = listing.amenities.some((a) => a.toLowerCase().includes("internet") || a.toLowerCase().includes("wifi"));
    reply = hasWifi ? "Sí, el alojamiento cuenta con Internet inalámbrico incluido." : "No tenemos confirmación de WiFi en este momento, te recomendamos contactar al anfitrión.";
  } else if (msg.includes("mascota") || msg.includes("perro") || msg.includes("gato")) {
    reply = listing.rules.pets ? "¡Sí! Se aceptan mascotas en este alojamiento." : "Lo sentimos, este alojamiento no acepta mascotas.";
  } else if (msg.includes("fumar")) {
    reply = listing.rules.smoking === false ? "Este es un alojamiento 100% libre de humo." : "Se permite fumar en áreas exteriores.";
  } else if (msg.includes("niño") || msg.includes("niños") || msg.includes("familia")) {
    reply = listing.rules.children ? "¡Sí! Este alojamiento es apto para familias con niños." : "Este alojamiento no es recomendable para niños.";
  } else if (msg.includes("disponib") || msg.includes("fecha") || msg.includes("reserv")) {
    reply =
      "Puedes verificar la disponibilidad y reservar con el calendario de esta página. Para escribir al anfitrión o ver sus datos de contacto directos necesitas una cuenta gratuita en Urbnbee; al reservar se aplicará la verificación de huésped.";
  } else if (msg.includes("check") || msg.includes("entrada") || msg.includes("salida")) {
    reply = `El check-in y check-out se coordinan directamente con el anfitrión, ${listing.host.name}. ${listing.extras?.lateCheckIn ? `Entrada tardía permitida hasta: ${listing.extras.lateCheckIn}.` : ""}`;
  } else if (msg.includes("dirección") || msg.includes("donde") || msg.includes("ubicación") || msg.includes("ubicacion")) {
    reply = `El alojamiento está en ${listing.city}, ${listing.zone}, ${listing.country}. La dirección exacta se proporciona tras confirmar la reserva.`;
  } else if (msg.includes("cocina") || msg.includes("comer")) {
    const hasCocina = listing.amenities.some((a) => a.toLowerCase().includes("cocina"));
    reply = hasCocina ? "Sí, este alojamiento cuenta con cocina totalmente equipada para que puedas preparar tus comidas." : "Este alojamiento no incluye cocina. Te recomendamos preguntar al anfitrión por opciones cercanas.";
  } else if (msg.includes("hola") || msg.includes("buenas") || msg.includes("buenos")) {
    reply = `¡Hola! 😊 Bienvenido al asistente de "${listing.title}". ¿En qué puedo ayudarte? Puedes preguntarme sobre precios, disponibilidad, amenidades o las reglas del alojamiento.`;
  } else {
    reply = `Gracias por tu pregunta. Para más detalles sobre "${listing.title}", ${listing.host.name} está disponible a través de Urbnbee: crea una cuenta gratuita y usa el chat con el anfitrión o el botón de contacto en esta página. Los datos directos no se muestran a visitantes sin cuenta, por seguridad de todos.`;
  }

  return NextResponse.json({ reply });
}
