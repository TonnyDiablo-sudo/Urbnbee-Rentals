/** Motor de reservas, verificación de identidad, país para precios y confirmación de correo. */
export const billingAccount: Record<string, string> = {
  "México": "Mexico",
  "Estados Unidos": "United States",
  "Otro país": "Other country",
  "Tu país": "Your country",
  "¿De qué país eres?": "Which country are you from?",
  "México paga en pesos (MXN). Estados Unidos y otros países, en dólares (USD).":
    "Mexico pays in pesos (MXN). The United States and other countries pay in dollars (USD).",
  "No se pudo guardar. Intenta otra vez.": "Couldn't save. Please try again.",
  "Enviando…": "Sending…",
  "Te lo mandamos. Revisa tu correo.": "Sent. Check your inbox.",
  "Tu correo ya está confirmado": "Your email is already confirmed",
  "Mandarme el correo de confirmación": "Send me the confirmation email",
  "Pon tu correo personal": "Add your personal email",
  "Tu cuenta todavía usa un usuario temporal. Para comprar, pon tu correo en tu perfil y confírmalo.":
    "Your account still uses a temporary username. To buy, add your own email in your profile and confirm it.",
  "Confirma tu correo para poder comprar": "Confirm your email to make purchases",
  "Te mandamos un enlace a {email} desde noreply@cabibee.com. Si no te llegó, revisa spam o pide otro.":
    "We sent a link to {email} from noreply@cabibee.com. If it didn't arrive, check spam or request another.",
  "Te mandamos un enlace desde noreply@cabibee.com. Si no te llegó, revisa spam o pide otro.":
    "We sent you a link from noreply@cabibee.com. If it didn't arrive, check spam or request another.",
  "Primero pon tu correo personal.": "Add your personal email first.",

  "¿Qué es Cabibee?": "What is Cabibee?",

  "Los huéspedes se identifican, pagan y firman contrato en Cabibee.":
    "Guests verify their identity, pay and sign the contract on Cabibee.",
  "Publicar y chatear es gratis. Para recibir reservas necesitas tu Stripe conectado y el Motor de reservas.":
    "Listing and chatting are free. To receive bookings you need your Stripe connected and the Booking engine.",
  "Conecta tu Stripe": "Connect your Stripe",
  "Gratis. Conectarlo no activa el motor de reservas.": "Free. Connecting it doesn't activate the booking engine.",
  "Motor de reservas": "Booking engine",
  "Activo hasta el {d}": "Active until {d}",
  "Activo": "Active",
  "Se paga por anuncio.": "Paid per listing.",
  "Elige abajo qué anuncios lo usan. Para más anuncios, súbele la cantidad en la Tienda.":
    "Choose below which listings use it. For more listings, raise the quantity in the Store.",
  "El huésped se identifica con identificación oficial y selfie antes de reservar.":
    "The guest verifies with an official ID and a selfie before booking.",
  "Paga con tarjeta en tu Stripe y la reserva se confirma sola.":
    "They pay by card into your Stripe and the booking confirms itself.",
  "Se genera el contrato y lo firman en línea.": "The contract is generated and signed online.",
  "Incluye tu verificación de identidad como anfitrión, obligatoria para la seguridad del huésped.":
    "Includes your identity verification as a host, required for guest safety.",
  "Todavía no hay planes del motor de reservas a la venta.": "There are no booking engine plans for sale yet.",
  "Tu identidad": "Your identity",
  "Comprobada": "Verified",
  "En revisión": "Under review",
  "Obligatoria. Viene incluida en el motor de reservas.": "Required. It comes with the booking engine.",
  "Ten a la mano tu licencia de manejo, State ID o pasaporte. Te tomarás una selfie. Lo revisa Stripe Identity; Cabibee no guarda las fotos.":
    "Have your driver's license, State ID or passport ready. You'll take a selfie. Stripe Identity reviews it; Cabibee doesn't keep the photos.",
  "Ten a la mano tu identificación oficial. Te tomarás una selfie. Lo revisa Stripe Identity; Cabibee no guarda las fotos.":
    "Have your official ID ready. You'll take a selfie. Stripe Identity reviews it; Cabibee doesn't keep the photos.",
  "Continuar verificación de identidad": "Continue identity verification",
  "Verificar mi identidad": "Verify my identity",
  "La verificación de identidad no está disponible ahorita.": "Identity verification isn't available right now.",
  "Se habilita en cuanto contrates el motor de reservas: primero se cobra y luego te pedimos tu identificación.":
    "It unlocks once you buy the booking engine: we charge first, then ask for your ID.",
  "Ver más productos en la Tienda": "See more products in the Store",
  "Limpieza, colaboradores, anuncio destacado, verificación de domicilio…":
    "Cleaning, collaborators, featured listing, address verification…",
  "Las estancias se cobran en tu cuenta.": "Stays are charged to your account.",
  "Listo. Para que tus anuncios reciban reservas, falta contratar el motor de reservas (paso 2).":
    "Done. For your listings to receive bookings, you still need the booking engine (step 2).",
  "Si no tienes cuenta, te ayudamos a crearla en unos minutos. Conectarla es gratis; Cabibee nunca cobra la estancia.":
    "If you don't have an account, we'll help you create one in minutes. Connecting is free; Cabibee never charges the stay.",
  "Primero contrata el Motor de reservas (ya incluye la verificación de identidad). Se cobra antes de pedirte la identificación.":
    "Buy the Booking engine first (it already includes identity verification). We charge before asking for your ID.",
  "Dinos de qué país eres para darte el precio correcto.": "Tell us your country so we can show the right price.",
  "Antes de comprar pon tu correo personal en tu perfil y confírmalo.":
    "Before buying, add your personal email in your profile and confirm it.",
  "Confirma tu correo antes de comprar. Te mandamos un enlace desde noreply@cabibee.com.":
    "Confirm your email before buying. We sent you a link from noreply@cabibee.com.",

  "Planes": "Plans",
  "Te identificas con tu licencia de manejo, State ID o pasaporte y una selfie.":
    "You verify with your driver's license, State ID or passport and a selfie.",
  "Te identificas con tu identificación oficial y una selfie.": "You verify with your official ID and a selfie.",
  "Contratar": "Buy",
  "Contratar (demo)": "Buy (demo)",
  "El huésped se identifica, paga con tarjeta en tu Stripe y firma el contrato. Incluye tu verificación de identidad como anfitrión. Conectar Stripe es gratis, pero no activa las reservas.":
    "The guest verifies their identity, pays by card into your Stripe and signs the contract. Includes your identity verification as a host. Connecting Stripe is free, but it doesn't turn on bookings.",

  "Los pagos del motor de reservas son sólo en línea, con tarjeta, y caen directo en tu Stripe. Conectarlo es gratis.":
    "Booking engine payments are online only, by card, straight into your Stripe. Connecting it is free.",
  "Tu Stripe ya está conectado. Falta el motor de reservas.": "Your Stripe is connected. The booking engine is still missing.",
  "Conectar Stripe es gratis, pero no activa las reservas. Para que tus huéspedes reserven y paguen, contrata el Motor de reservas: se paga por anuncio, por 1, 6 o 12 meses, e incluye tu verificación de identidad.":
    "Connecting Stripe is free, but it doesn't turn on bookings. For guests to book and pay, buy the Booking engine: paid per listing for 1, 6 or 12 months, and it includes your identity verification.",
  "Contratar el motor de reservas": "Buy the booking engine",
  "Stripe conectado. Las estancias se cobran en tu cuenta.": "Stripe connected. Stays are charged to your account.",
  "Stripe conectado. Para recibir reservas falta contratar el motor de reservas.":
    "Stripe connected. To receive bookings you still need the booking engine.",

  "Comprobante aprobado. La insignia se muestra cuando el anuncio tiene la verificación de domicilio pagada.":
    "Proof approved. The badge shows when the listing has paid address verification.",
  "La revisión de historial crediticio todavía no está disponible.": "Credit history checks aren't available yet.",
  "Agotado por ahora. Vuelve en unos días.": "Sold out for now. Check back in a few days.",
  "Mucha demanda: +{p}% sobre el precio normal · quedan {n} lugares": "High demand: +{p}% over the normal price · {n} spots left",
  "Quedan {n} lugares": "{n} spots left",
  "Agotado": "Sold out",
};
