/** Baños, entrada, precio por mes, amenidades por categoría, llegada y mensaje de llegada. */
export const listingSetup: Record<string, string> = {
  // Baños
  "{n} baño privado": "{n} private bathroom",
  "{n} baños privados": "{n} private bathrooms",
  "{n} baño compartido": "{n} shared bathroom",
  "{n} baños compartidos": "{n} shared bathrooms",
  "¿Los baños son privados o compartidos?": "Are the bathrooms private or shared?",
  Privados: "Private",
  Compartidos: "Shared",
  "Sólo para tus huéspedes.": "Only for your guests.",
  "Con otros huéspedes o contigo.": "With other guests or with you.",
  "Tipo de baño": "Bathroom type",
  "Sin indicar": "Not specified",
  "Privados (sólo para tus huéspedes)": "Private (only for your guests)",

  // Entrada
  "Entrada autónoma": "Self check-in",
  "Te recibe el anfitrión": "The host greets you",
  Entrada: "Check-in",
  "¿Cómo es la entrada?": "How do guests check in?",
  "Caja de llaves, cerradura con código…": "Lockbox, keypad lock…",
  "Tú o alguien de tu equipo entrega las llaves.": "You or someone on your team hands over the keys.",
  "Esto sí se muestra en el anuncio. Lo demás sólo lo ve el huésped con reserva.":
    "This is shown on the listing. Everything else is only visible to guests with a booking.",
  "Instrucciones para entrar": "Check-in instructions",
  "Código de acceso": "Access code",
  "Ej.: Puerta 4821#, caja de llaves 0912": "E.g.: Door 4821#, lockbox 0912",
  "Se le comparte al huésped sólo cuando reserva y paga con el Motor de reservas.":
    "Shared with the guest only when they book and pay through the Booking engine.",

  // Precio
  "/ mes": "/ month",
  "MXN al mes": "MXN per month",
  "{price} al mes": "{price} per month",
  "Renta mensual": "Monthly rent",
  "Renta mensual (MXN)": "Monthly rent (MXN)",
  "¿Cómo cobras?": "How do you charge?",
  "Por noche": "Per night",
  "Estancias cortas.": "Short stays.",
  "Mínimo 30 noches.": "30 nights minimum.",
  "Se cobra por noche como la renta entre 30. La estancia mínima queda en 30 noches.":
    "Each night is charged as the rent divided by 30. The minimum stay is set to 30 nights.",
  "Escribe la renta mensual.": "Enter the monthly rent.",
  "Descuento por 7 noches o más (%)": "Discount for 7 nights or more (%)",
  "Descuento por 28 noches o más (%)": "Discount for 28 nights or more (%)",
  "Descuento semanal.": "Weekly discount.",
  "Descuento mensual.": "Monthly discount.",
  "En renta mensual son al menos 30.": "With monthly rent it's at least 30.",
  "Descuentos por estancia larga": "Long-stay discounts",
  "En renta mensual la estancia mínima es de al menos {n} noches.":
    "With monthly rent the minimum stay is at least {n} nights.",
  "Fin de semana, temporadas y más opciones están en el calendario de la app.":
    "Weekend prices, seasonal promotions and more are in the app calendar.",

  // Amenidades
  "Amenidades del lugar": "Property amenities",
  "Complementos y servicios": "Extras and services",
  "Ideal para": "Great for",
  Otras: "Other",
  Gimnasio: "Gym",
  Jacuzzi: "Hot tub",
  Sauna: "Sauna",

  // Guía y mensaje de llegada
  "Guardar guía de llegada": "Save arrival guide",
  "Mensaje de llegada": "Arrival message",
  "Guardar mensaje de llegada": "Save arrival message",
  "Automático el día de llegada": "Automatic on arrival day",
  "Automático 1 día antes": "Automatic 1 day before",
  "Automático {n} días antes": "Automatic {n} days before",
  "Manual: lo mandas desde la reservación": "Manual: you send it from the reservation",
  "Cuando una reserva del Motor de reservas queda confirmada, le mandamos al huésped este mensaje por el chat y por correo con la dirección exacta, la llegada y tus instrucciones.":
    "When a Booking engine reservation is confirmed, we send the guest this message by chat and email with the exact address, arrival details and your instructions.",
  Automático: "Automatic",
  "Sale solo antes de la llegada.": "Goes out on its own before arrival.",
  Manual: "Manual",
  "Tú lo mandas desde la reservación.": "You send it from the reservation.",
  "¿Cuántos días antes de la llegada?": "How many days before arrival?",
  "El mismo día de llegada": "On arrival day",
  "1 día antes": "1 day before",
  "{n} días antes": "{n} days before",
  "Si la reserva se confirma después, el mensaje sale en cuanto se confirma.":
    "If the booking is confirmed later, the message goes out as soon as it's confirmed.",
  "Plantilla del mensaje": "Message template",
  "Usar la plantilla de Cabibee": "Use the Cabibee template",
  "Datos que puedes usar": "Details you can use",
  "Si un dato está vacío, se quita la línea que lo usa.": "If a detail is empty, the line that uses it is removed.",
  "Vista previa": "Preview",
  "La plantilla quedó vacía.": "The template is empty.",
  "Con un huésped de ejemplo y fechas de prueba.": "With a sample guest and test dates.",
  "Nombre del huésped": "Guest name",
  "Título del anuncio": "Listing title",
  "Dirección exacta": "Exact address",
  "Fecha de llegada": "Arrival date",
  "Hora de llegada": "Check-in time",
  "Fecha de salida": "Departure date",
  "Hora de salida": "Check-out time",
  "Nombre del wifi": "Wi-Fi name",
  "Contraseña del wifi": "Wi-Fi password",
  "Tu nombre": "Your name",

  // Reservación
  "Instrucciones de llegada": "Arrival instructions",
  "Enviar instrucciones de llegada": "Send arrival instructions",
  "Volver a enviar": "Send again",
  "Ya se mandaron. ¿Enviarlas otra vez?": "They were already sent. Send them again?",
  "Enviadas el {date}.": "Sent on {date}.",
  "Dirección, llegada, código y wifi, con la plantilla de tu anuncio. Van por el chat y por correo.":
    "Address, arrival, access code and Wi-Fi, using your listing's template. Sent by chat and email.",
  "Sólo se manda con la reserva confirmada.": "It can only be sent once the booking is confirmed.",
  "Este anuncio no tiene el motor de reservas activo.": "This listing doesn't have the booking engine turned on.",
  "No tenemos cómo contactar a este huésped.": "We have no way to contact this guest.",
  "El mensaje de llegada ya se mandó.": "The arrival message was already sent.",
  "Acabas de mandarlo. Espera un par de minutos para volver a enviarlo.":
    "You just sent it. Wait a couple of minutes before sending it again.",
};
