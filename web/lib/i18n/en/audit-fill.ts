/**
 * Claves que faltaban según scripts/i18n-missing.mjs. Va antes que los demás diccionarios en index.ts,
 * así cualquier traducción curada de otro archivo tiene prioridad.
 */
export const auditFill: Record<string, string> = {
  // Pantallas y textos de la app
  "Activa tu cuenta": "Activate your account",
  "Reclamar anuncio": "Claim listing",
  Cargando: "Loading",
  Cabibee: "Cabibee",
  Instagram: "Instagram",
  Total: "Total",
  nuevo: "new",
  anuncio: "listing",
  anuncios: "listings",
  "correo@ejemplo.com": "name@example.com",
  "Clave secreta de firma del webhook": "Webhook signing secret",
  "Espacio de trabajo #{id}": "Workspace #{id}",
  "Entra para ver tus equipos": "Sign in to see your teams",
  "Si un anfitrión te invitó a colaborar, entra con el correo al que te llegó la invitación.":
    "If a host invited you to collaborate, sign in with the email the invitation was sent to.",
  "La tienda es para miembros": "The store is for members",
  "Crea tu cuenta gratis para ver las membresías y herramientas de Cabibee.":
    "Create a free account to see Cabibee's memberships and tools.",
  "{n} anuncios con verificación de domicilio pagada.": "{n} listings with paid address verification.",
  "El asistente de IA puede dar el código de entrada a huéspedes con reserva confirmada":
    "The AI assistant can share the entry code with guests who have a confirmed booking",
  "Descuento 7+ noches (%)": "7+ night discount (%)",
  "Descuento 28+ noches (%)": "28+ night discount (%)",
  "Reglas, calendario, contrato y ubicación exacta": "Rules, calendar, contract and exact location",
  "Para publicar necesitas al menos una foto, la ciudad, el estado y un precio.":
    "To publish you need at least one photo, the city, the state and a price.",
  "Confirma que revisaste el contrato antes de guardarlo.": "Confirm you reviewed the contract before saving it.",
  "No se pudo mandar el correo. Intenta en un rato.": "We couldn't send the email. Try again in a bit.",
  "Teléfono (WhatsApp)": "Phone (WhatsApp)",
  "El anfitrión los usa para contactarte sobre esta reserva y van en el contrato.":
    "The host uses them to contact you about this booking, and they go in the contract.",
  "Para trabajar": "For working",
  "Cargo de servicio": "Service fee",

  // Plantillas de contrato
  "Hospedaje estándar": "Standard stay",
  "Estancias cortas. Fechas, montos, reglas de casa, cancelación simple y la ley del lugar.":
    "Short stays. Dates, amounts, house rules, simple cancellation and local law.",
  "Semanas o meses. Más detalle sobre uso de la vivienda, servicios y salida en orden.":
    "Weeks or months. More detail on use of the home, utilities and an orderly move-out.",
  "Hospedaje con depósito": "Stay with deposit",
  "Igual que el estándar, más un depósito en garantía que pactas directo con el huésped.":
    "Same as standard, plus a security deposit you agree on directly with the guest.",

  // Sugerencias para mejorar el anuncio
  "Sube fotos: los anuncios sin fotos casi no reciben visitas.": "Add photos: listings without photos get almost no views.",
  "Verifica tu identidad: los anuncios verificados salen con sello y los huéspedes pueden filtrar solo verificados.":
    "Verify your identity: verified listings show a badge and guests can filter for verified only.",
  "Escribe una descripción más completa: qué hay cerca, cómo es el espacio y para quién es ideal.":
    "Write a fuller description: what's nearby, what the space is like and who it's ideal for.",
  "Marca todas tus amenidades (wifi, estacionamiento, cocina, aire…): los huéspedes filtran por ellas.":
    "Check all your amenities (wifi, parking, kitchen, A/C…): guests filter by them.",
  "Haz el título más descriptivo: tipo de espacio, zona y lo que lo hace especial.":
    "Make the title more descriptive: type of space, area and what makes it special.",
  "Pon una foto tuya en tu perfil: genera más confianza.": "Add a photo of yourself to your profile: it builds trust.",
  "Escribe una bio corta sobre ti como anfitrión.": "Write a short bio about yourself as a host.",
  "Este anuncio está oculto: publícalo para que aparezca en búsquedas.":
    "This listing is hidden: publish it so it shows up in search.",

  // Planes de la tienda
  "Por cada anuncio: el huésped se identifica con identificación oficial y selfie, paga con tarjeta (Stripe), firma contrato en línea con la ley del lugar y las fechas se bloquean solas. Incluye tu verificación de identidad como anfitrión.":
    "Per listing: the guest verifies with a government ID and selfie, pays by card (Stripe), signs a contract online under local law, and the dates block automatically. Includes your identity verification as a host.",
  "Insignia «Ubicación verificada» en un anuncio con comprobante de domicilio.":
    "“Verified location” badge on a listing with proof of address.",
  "Consulta de screening con proveedor externo. Cabibee no es el buró.":
    "Screening check with an outside provider. Cabibee is not the credit bureau.",
  "Modo demo: screening de prueba. No se consultó ningún buró.":
    "Demo mode: test screening. No credit bureau was checked.",

  // Correos: avisos de cuenta, verificación y contraseña
  "Hola {name},": "Hi {name},",
  "Cambiaron el correo de tu cuenta Cabibee": "Your Cabibee account email was changed",
  "Cambió el correo de tu cuenta": "Your account email changed",
  "El correo para entrar a tu cuenta de Cabibee ahora es {email}. Este correo ya no sirve para iniciar sesión.":
    "The email to sign in to your Cabibee account is now {email}. This address can no longer be used to sign in.",
  "La contraseña de tu cuenta de Cabibee se cambió con el enlace de recuperación. Cerramos las sesiones abiertas en otros dispositivos.":
    "Your Cabibee account password was changed using the reset link. We signed you out on other devices.",
  "La contraseña de tu cuenta de Cabibee se cambió desde tu cuenta. Cerramos las sesiones abiertas en otros dispositivos.":
    "Your Cabibee account password was changed from your account. We signed you out on other devices.",
  "Tu contraseña de Cabibee cambió": "Your Cabibee password changed",
  "Tu contraseña cambió": "Your password changed",
  "Confirma tu correo en Cabibee": "Confirm your email on Cabibee",
  "Confirma tu correo para asegurar tu cuenta de Cabibee. Con él podrás recuperar tu contraseña si la olvidas.":
    "Confirm your email to secure your Cabibee account. You'll be able to recover your password with it if you forget it.",
  "El enlace vence en 48 horas. Si no abriste una cuenta, ignora este correo o escríbenos a {support}.":
    "The link expires in 48 hours. If you didn't create an account, ignore this email or write to us at {support}.",
  "Confirma tu correo": "Confirm your email",
  "Confirmar mi correo": "Confirm my email",
  "Pediste restablecer la contraseña de tu cuenta de Cabibee. El enlace vence en 1 hora.":
    "You asked to reset your Cabibee account password. The link expires in 1 hour.",
  "Si no fuiste tú, ignora este correo o escríbenos a {support}.":
    "If this wasn't you, ignore this email or write to us at {support}.",
  "Restablece tu contraseña de Cabibee": "Reset your Cabibee password",
  "Restablece tu contraseña": "Reset your password",
  "Elegir contraseña nueva": "Choose a new password",
  "Este aviso lo manda {from}. Si contestas, te leemos en {support}.":
    "This notice is sent by {from}. If you reply, we'll read it at {support}.",

  // Correos: llegada próxima y reseñas
  "tu anfitrión": "your host",
  "Tu estancia en {listing} se acerca.": "Your stay at {listing} is coming up.",
  "Llegada: {checkIn}. Salida: {checkOut}.": "Check-in: {checkIn}. Checkout: {checkOut}.",
  "Hora de entrada: desde las {time}.": "Check-in time: from {time}.",
  "Tu anfitrión te mandará las instrucciones de llegada por el chat. Cualquier duda, escríbele desde la app.":
    "Your host will send you arrival instructions in the chat. Any questions, message them from the app.",
  "{guest} llega pronto a {listing}.": "{guest} arrives soon at {listing}.",
  "Revisa que el lugar esté listo y que las instrucciones de llegada estén completas.":
    "Make sure the place is ready and the arrival instructions are complete.",
  "Tu reserva en {listing} se acerca": "Your booking at {listing} is coming up",
  "Llegada próxima · {listing}": "Upcoming arrival · {listing}",
  "Tu reserva se acerca": "Your booking is coming up",
  "Tienes una llegada próxima": "You have an upcoming arrival",
  "Ver mi reserva": "View my booking",
  "Ver la reserva": "View booking",
  "¿Qué tal tu estancia en {listing}? Califica al anfitrión y ayuda a otros viajeros.":
    "How was your stay at {listing}? Rate the host and help other travelers.",
  "Terminó la estancia de {guest} en {listing}. Califica al huésped para que otros anfitriones lo conozcan.":
    "{guest}'s stay at {listing} has ended. Rate the guest so other hosts can get to know them.",
  "En Cabibee las reseñas son de ida y vuelta: sólo se pueden dejar en reservas hechas con el motor de reservas, y nuestro equipo las revisa antes de publicarlas.":
    "On Cabibee, reviews go both ways: they can only be left on bookings made through the booking engine, and our team reviews them before they're published.",
  "¿Cómo te fue en {listing}?": "How did it go at {listing}?",
  "Califica a {guest}": "Rate {guest}",
  "Dejar mi reseña": "Leave my review",
  "Tú y tu huésped se califican al terminar la estancia; nuestro equipo revisa las reseñas.":
    "You and your guest rate each other when the stay ends; our team reviews the reviews before they're published.",
  "Quita teléfonos, correos o redes sociales de tu reseña.": "Remove phone numbers, emails or social media from your review.",
  "Tu reseña no cumple las reglas de la comunidad. Escríbela sin insultos ni datos personales.":
    "Your review doesn't meet the community rules. Write it without insults or personal details.",

  // Errores de API
  "Elige México, Estados Unidos u otro país.": "Choose Mexico, the United States or another country.",
  "Modo demo: usa «Confirmar pago (demo)» desde la ficha o /bookings/confirm.":
    "Demo mode: use “Confirm payment (demo)” from the listing page or /bookings/confirm.",
  "Esta reserva todavía no tiene contrato.": "This booking doesn't have a contract yet.",
  "Para firmar en nombre del anfitrión necesitas el rol «Firmar contratos».":
    "To sign on the host's behalf you need the “Sign contracts” role.",
  "El anfitrión tiene que firmar por adelantado el contrato de este anuncio (en Contratos) o darte el rol «Firmar contratos» para que puedas aceptar.":
    "The host has to pre-sign this listing's contract (in Contracts) or give you the “Sign contracts” role so you can accept.",
  "Para aceptar, el anfitrión tiene que firmar por adelantado el contrato de este anuncio o darle a urbnbeeai el permiso «Firmar contratos».":
    "To accept, the host has to pre-sign this listing's contract or give urbnbeeai the “Sign contracts” permission.",
  "Faltan los permisos.": "Permissions are missing.",
  "agentCanShareAccessCode debe ser true o false.": "agentCanShareAccessCode must be true or false.",
  "La verificación de identidad no está activada en el servidor (STRIPE_IDENTITY_ENABLED).":
    "Identity verification isn't enabled on the server (STRIPE_IDENTITY_ENABLED).",
  "Stripe no devolvió URL de verificación. Revisa que Identity esté habilitado en tu cuenta.":
    "Stripe didn't return a verification URL. Check that Identity is enabled on your account.",
  "Espera un momento antes de enviar otro mensaje.": "Wait a moment before sending another message.",
  "Inicia sesión para registrar la consulta.": "Sign in to record the inquiry.",
  "JSON inválido.": "Invalid JSON.",
  "La suscripción no tiene renglón.": "The subscription has no line item.",
  "Falta el código o el id de la reserva.": "The booking code or ID is missing.",
  "No hay ninguna cuenta con ese correo.": "There's no account with that email.",
  "No existe ese reporte.": "That report doesn't exist.",
  "La fecha debe ser AAAA-MM-DD.": "The date must be YYYY-MM-DD.",
  "La fecha ya pasó.": "That date has already passed.",
  "La hora debe ser HH:MM.": "The time must be HH:MM.",

  // Errores de pagos, reembolsos y screening
  "No se pudo registrar el pago.": "We couldn't record the payment.",
  "Sesión sin diferencia asociada.": "Session has no linked balance.",
  "El pago no está completado.": "The payment isn't complete.",
  "No se pudo actualizar la reserva.": "We couldn't update the booking.",
  "sin cobro localizable": "no traceable charge",
  "Esta sesión no corresponde al pago de una reserva.": "This session isn't a booking payment.",
  "Sesión sin reserva asociada.": "Session has no linked booking.",
  "Reserva ya procesada o inválida.": "Booking already processed or invalid.",
  "El importe pagado no coincide con la reserva.": "The amount paid doesn't match the booking.",
  "No se pudo registrar el reembolso.": "We couldn't record the refund.",
  "No se pudo localizar el cobro en Stripe.": "We couldn't find the charge in Stripe.",
  "Esta reserva está marcada como pagada pero no tiene un cobro localizable en Stripe.":
    "This booking is marked as paid but has no traceable charge in Stripe.",
  "Stripe rechazó el reembolso.": "Stripe declined the refund.",
  "El reembolso no se pudo completar en Stripe.": "The refund couldn't be completed in Stripe.",
  "El reembolso se hizo pero no se pudo guardar.": "The refund went through but couldn't be saved.",
  "Esta sesión no es de screening.": "This session isn't for a screening.",
  "Screening no encontrado.": "Screening not found.",
  "No se pudo actualizar el screening.": "We couldn't update the screening.",

  // Errores de configuración del servidor e integraciones
  "Stripe no está configurado (falta STRIPE_SECRET_KEY).": "Stripe isn't configured (STRIPE_SECRET_KEY is missing).",
  "Stripe webhook no configurado.": "Stripe webhook isn't configured.",
  "Stripe sólo acepta webhooks con https; en este servidor hay que crearlo a mano.":
    "Stripe only accepts https webhooks; on this server you have to create it manually.",
  "Stripe no devolvió el signing secret.": "Stripe didn't return the signing secret.",
  "Este anfitrión no tiene webhook secret guardado.": "This host doesn't have a webhook secret saved.",
  "Stripe del anfitrión no conectado.": "The host's Stripe isn't connected.",
  "Credencial de pago ilegible.": "Unreadable payment credential.",
  "SMTP falló": "SMTP failed",
  "Falta GEMINI_API_KEY: las fotos no se recortaron.": "GEMINI_API_KEY is missing: the photos weren't cropped.",
  "Requiere beeagent_customer_id (entero) y email válido.": "Requires beeagent_customer_id (integer) and a valid email.",
  "Este workspace BeeAgent ya está vinculado a otro anfitrión.": "This BeeAgent workspace is already linked to another host.",
  "Ese correo ya tiene cuenta en Cabibee. El anfitrión debe confirmar el vínculo en Integraciones.":
    "That email already has a Cabibee account. The host must confirm the link in Integrations.",
  "No se pudo provisionar el anfitrión.": "We couldn't set up the host.",
  "Requiere beeagent_customer_id y link_code.": "Requires beeagent_customer_id and link_code.",
  "Código inválido o expirado. Genera uno nuevo en Cabibee → Integraciones.":
    "Invalid or expired code. Generate a new one in Cabibee → Integrations.",
  "Anfitrión no encontrado.": "Host not found.",
  "No se pudo completar la vinculación.": "We couldn't complete the link.",
};
