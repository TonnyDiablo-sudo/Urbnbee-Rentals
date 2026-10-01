/** Centro de notificaciones, cobro de diferencias e impuestos del anfitrión. */
export const appNotificationsTax: Record<string, string> = {
  // Centro de notificaciones
  Ayer: "Yesterday",
  Todas: "All",
  "Reservas y solicitudes": "Bookings & requests",
  Nueva: "New",
  "Notificaciones ({n} sin leer)": "Notifications ({n} unread)",
  "Inicia sesión para ver tus notificaciones.": "Log in to see your notifications.",
  "Sin notificaciones": "No notifications",
  "Aquí te avisamos de solicitudes, reservas, pagos, mensajes y reseñas.":
    "We'll let you know here about requests, bookings, payments, messages and reviews.",

  // Avisos (servidor)
  "Respuesta del anfitrión · {listing}": "Host reply · {listing}",
  "Nueva reserva confirmada": "New confirmed booking",
  "Nueva solicitud de reserva": "New booking request",
  "{name} · {listing} · 1 noche": "{name} · {listing} · 1 night",
  "{name} · {listing} · {nights} noches": "{name} · {listing} · {nights} nights",
  "¡Tu reserva fue aceptada!": "Your booking was accepted!",
  "Tu solicitud no fue aceptada": "Your request wasn't accepted",
  "{listing}: el anfitrión no pudo recibirte en esas fechas.": "{listing}: the host couldn't host you on those dates.",
  "{listing}: el anfitrión ajustó las fechas. Paga la diferencia de ${amount} y firma el contrato.":
    "{listing}: the host adjusted the dates. Pay the ${amount} difference and sign the contract.",
  "{listing}: completa tus datos para cerrar la reserva.": "{listing}: complete your details to finalize the booking.",
  "Reserva confirmada": "Booking confirmed",
  "{name} firmó el contrato de {listing} ({checkIn} → {checkOut}).":
    "{name} signed the contract for {listing} ({checkIn} → {checkOut}).",
  "{listing}: {checkIn} → {checkOut}. ¡Buen viaje!": "{listing}: {checkIn} → {checkOut}. Have a great trip!",
  "Diferencia pagada": "Difference paid",
  "{name} pagó ${amount} por el cambio de fechas en {listing}.":
    "{name} paid ${amount} for the date change at {listing}.",
  "Te devolvimos la diferencia": "We refunded the difference",
  "{listing}: las nuevas fechas cuestan menos; reembolsamos ${amount}.":
    "{listing}: the new dates cost less; we refunded ${amount}.",
  "Nueva reseña · {stars}": "New review · {stars}",
  "{name} calificó {listing}.": "{name} rated {listing}.",
  "tu alojamiento": "your place",

  // Diferencia por cambio de fechas
  "El anfitrión cambió las fechas: falta pagar {amount} MXN": "The host changed the dates: {amount} MXN left to pay",
  "Ya pagaste ${paid}. Tu reserva se confirma cuando pagues la diferencia y firmes el contrato nuevo.":
    "You already paid ${paid}. Your booking is confirmed once you pay the difference and sign the new contract.",
  "Tu reserva se confirma cuando pagues la diferencia y firmes el contrato nuevo.":
    "Your booking is confirmed once you pay the difference and sign the new contract.",
  "Pagar diferencia de {amount}": "Pay {amount} difference",
  "Diferencia pagada. Gracias.": "Difference paid. Thank you.",
  "No hay diferencia pendiente de pago.": "There's no pending difference to pay.",
  "No se pudo iniciar el pago.": "Couldn't start the payment.",
  "No se pudo verificar el pago.": "Couldn't verify the payment.",
  "El Stripe del anfitrión ya no está conectado; pídele que lo reconecte.":
    "The host's Stripe is no longer connected; ask them to reconnect it.",
  "Pago no disponible: Stripe no está configurado.": "Payment unavailable: Stripe isn't configured.",
  "Este cobro ya no está vigente.": "This charge is no longer valid.",
  "El importe pagado no coincide con la diferencia.": "The amount paid doesn't match the difference.",

  // Impuestos
  "Impuestos (IVA)": "Taxes (VAT)",
  "Cobra IVA u otros impuestos según tu país": "Charge VAT or other taxes for your country",
  "Si facturas, cobra el IVA y los impuestos de hospedaje de tu país. Se muestran al huésped antes de reservar, se cobran junto con la estancia y quedan en el contrato.":
    "If you invoice, charge your country's VAT and lodging taxes. Guests see them before booking, they're charged with the stay and they appear in the contract.",
  "Cobrar impuestos": "Charge taxes",
  "Apagado: tus precios se cobran tal cual.": "Off: your prices are charged as they are.",
  Impuestos: "Taxes",
  impuestos: "taxes",
  "Ajusta el porcentaje a tu estado o municipio (p. ej. el ISH varía de 2% a 5%).":
    "Adjust the rate for your state or city (e.g. Mexico's lodging tax ranges from 2% to 5%).",
  Porcentaje: "Rate",
  "Agregar impuesto": "Add tax",
  "¿Tus precios ya incluyen impuestos?": "Do your prices already include taxes?",
  "No, súmalos al total del huésped": "No, add them to the guest's total",
  "Sí, ya vienen incluidos en mi precio": "Yes, they're already included in my price",
  "Registro fiscal (RFC, NIF, NIT…) — opcional": "Tax ID (RFC, NIF, NIT…) — optional",
  "Aparece en el contrato de cada reserva.": "It appears in every booking contract.",
  "Ejemplo con una estancia de {amount}": "Example for a {amount} stay",
  Incluye: "Includes",
  "Incluye {taxes}": "Includes {taxes}",
  "El huésped paga": "Guest pays",
  "Guardado. Aplica a las reservas nuevas.": "Saved. It applies to new bookings.",
  "Agrega al menos un impuesto con su porcentaje.": "Add at least one tax with its rate.",
  "Datos inválidos.": "Invalid data.",
  "No se pudo cargar.": "Couldn't load.",
  "Occupancy tax": "Occupancy tax",
  Impuesto: "Tax",
  México: "Mexico",
  España: "Spain",
  Colombia: "Colombia",
  Argentina: "Argentina",
  Chile: "Chile",
  Perú: "Peru",
  "Estados Unidos": "United States",
  Canadá: "Canada",
  "Otro país": "Other country",
};
