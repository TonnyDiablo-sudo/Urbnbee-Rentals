import { CREDIT_CHECK_ENABLED } from "@/lib/feature-flags";
import type { Lang } from "@/lib/i18n";
import type { TermsDoc, TermsSection } from "@/lib/terms";

const ES: TermsDoc = {
  title: "Aviso de privacidad de Cabibee",
  updated: "Última actualización: 8 de octubre de 2026",
  intro:
    "Este aviso explica qué datos personales trata Cabibee, para qué, con quién se comparten y cómo puedes verlos, corregirlos o borrarlos. Aplica al sitio cabibee.com, a la aplicación y a los servicios relacionados (la «Plataforma»). El uso de la Plataforma también se rige por los Términos y condiciones.",
  sections: [
    {
      title: "1. Quién es responsable",
      paragraphs: [
        "Cabibee es operado por Urbnbee LLC, una sociedad de responsabilidad limitada constituida en el estado de Nevada, Estados Unidos. En este aviso, «Cabibee» se refiere a Urbnbee LLC.",
        "Para cualquier tema de privacidad escribe a support@cabibee.com.",
      ],
    },
    {
      title: "2. Qué datos tratamos",
      paragraphs: [
        "Cuenta. Nombre, alias si lo eliges, correo, teléfono, domicilio, foto, descripción, idiomas y gustos. En anuncios y en el chat público se muestra el alias o el nombre, según lo que elijas. En una reserva y en el contrato se usa el nombre real y completo.",
        "Identidad. Si verificas tu identidad, Stripe revisa tu documento. Cabibee guarda el resultado de esa revisión y, cuando sale bien, el nombre que aparece en el documento. Ese nombre queda fijo en la cuenta, aunque canceles una membresía.",
        "Reservas y contratos. Fechas, montos, nombres reales de las dos personas, firmas y la fecha en que se firmó.",
        "Mensajes. El texto, las fotos y las notas de voz que envías en el chat.",
        "Comprobantes. El recibo de domicilio que sube un anfitrión y el comprobante de un pago manual. El recibo de domicilio lo revisa el equipo de Cabibee y no se muestra a otros usuarios.",
        "Ubicación. Sólo si tú la compartes en ese momento, por ejemplo para comprobar que estás en el alojamiento al marcar una limpieza o al enviar un comprobante de domicilio. Es un punto, no un rastreo continuo, y no aparece en el anuncio ni se enseña a otros usuarios.",
        "Pagos. Stripe procesa la tarjeta. Cabibee no guarda el número completo de la tarjeta.",
        "Avisos. Si activas las notificaciones del teléfono, guardamos un identificador del dispositivo para enviártelas. Puedes apagar cada tema en el Centro de alarmas.",
        "Datos técnicos. Dirección IP, tipo de navegador y páginas visitadas, para que el sitio funcione y para detectar abuso.",
      ],
    },
    {
      title: "3. Para qué los usamos",
      paragraphs: [
        "Para crear y mantener tu cuenta, publicar anuncios, conectar el chat, llevar reservas y contratos, cobrar los servicios que contratas y mostrar las etiquetas de verificación que sí completaste.",
        "Para enviarte los avisos que tengas activos, prevenir fraude y cumplir la ley.",
        "No vendemos tus datos personales ni los usamos para publicidad de terceros.",
      ],
    },
    {
      title: "4. Con quién se comparten",
      paragraphs: [
        "Con la otra persona de una reserva o un contrato, los datos necesarios para ese trato: nombre real, contacto y lo que el contrato incluye. Esa persona es responsable del uso que haga de ellos.",
        "Con Stripe, para cobros y verificación de identidad. Stripe trata esos datos con su propio aviso de privacidad.",
        "Con proveedores que hospedan la Plataforma, envían correo o entregan notificaciones, sólo para prestarnos ese servicio.",
        "Con una herramienta que tú conectas, como BeeAgent, lo necesario para esa conexión.",
        "Con una autoridad, cuando la ley lo exige.",
      ],
    },
    {
      title: "5. Permisos del teléfono",
      paragraphs: [
        "Notificaciones, cámara, fotos, archivos, micrófono y ubicación se piden cuando usas esa función, no al abrir la aplicación. Puedes negarlos o quitarlos en los ajustes del teléfono.",
        "Sin ubicación puedes seguir usando Cabibee. Algunas comprobaciones opcionales, como marcar la entrada a una limpieza, no se completan si no la compartes.",
      ],
    },
    {
      title: "6. Cuánto tiempo los guardamos",
      paragraphs: [
        "Mientras tu cuenta existe. Al borrarla quitamos el perfil, los anuncios y los datos de contacto. Las reservas que aún no terminan se cancelan. Las ya hechas se quedan sin tu nombre ni tu contacto, porque la otra persona necesita el registro del trato.",
        "Los contratos y los registros de pago se conservan el tiempo que exija la ley.",
      ],
    },
    {
      title: "7. Cómo verlos, corregirlos o borrarlos",
      paragraphs: [
        "Puedes pedir acceso, rectificación, cancelación u oposición de tus datos, y los derechos que te den las leyes aplicables de Estados Unidos, escribiendo a support@cabibee.com. En México estos derechos se ejercen conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares.",
        "Para borrar la cuenta entra a Editar perfil y escribe tu correo en «Borrar mi cuenta para siempre». Si no puedes entrar, escribe a support@cabibee.com desde el correo de la cuenta y pide la eliminación.",
        "Teléfono, domicilio, alias y foto se cambian en Editar perfil. El nombre real ya verificado no se puede cambiar, porque comprobamos quién eres.",
      ],
    },
    {
      title: "8. Menores",
      paragraphs: [
        "Cabibee no está dirigida a menores de 13 años y no recogemos a sabiendas sus datos. Si crees que un menor nos dio datos, escríbenos a support@cabibee.com y los borraremos.",
      ],
    },
    {
      title: "9. Seguridad",
      paragraphs: [
        "La Plataforma se sirve con conexión cifrada y las contraseñas se guardan de forma que no se puedan leer. Ningún sistema es infalible: avísanos a support@cabibee.com si notas un uso indebido de tu cuenta.",
      ],
    },
    {
      title: "10. Cambios a este aviso",
      paragraphs: [
        "Si este aviso cambia de forma relevante, actualizaremos la fecha de arriba. La versión vigente está siempre en cabibee.com/privacidad.",
      ],
    },
  ],
};

const EN: TermsDoc = {
  title: "Cabibee Privacy Notice",
  updated: "Last updated: October 8, 2026",
  intro:
    "This notice explains what personal data Cabibee processes, why, who it is shared with, and how you can see it, correct it or delete it. It applies to cabibee.com, the app and related services (the \"Platform\"). Use of the Platform is also governed by the Terms of Use.",
  sections: [
    {
      title: "1. Who is responsible",
      paragraphs: [
        "Cabibee is operated by Urbnbee LLC, a limited liability company organized under the laws of the State of Nevada, United States. In this notice, \"Cabibee\" means Urbnbee LLC.",
        "For any privacy question write to support@cabibee.com.",
      ],
    },
    {
      title: "2. Data we process",
      paragraphs: [
        "Account. Name, alias if you choose one, email, phone, address, photo, bio, languages and interests. Listings and public chat show the alias or the name, whichever you choose. A booking and its contract use your real full name.",
        "Identity. If you verify your identity, Stripe reviews your document. Cabibee keeps the result of that review and, when it succeeds, the name on the document. That name stays on the account even if you cancel a membership.",
        "Bookings and contracts. Dates, amounts, the real names of both people, signatures and the date they were signed.",
        "Messages. The text, photos and voice notes you send in chat.",
        "Proofs. The address bill a host uploads and the receipt for a manual payment. The Cabibee team reviews the address bill and it is not shown to other users.",
        "Location. Only if you share it at that moment, for example to confirm you are at the property when you clock in for a cleaning or when you send an address proof. It is one point, not continuous tracking, and it does not appear on the listing or get shown to other users.",
        "Payments. Stripe processes the card. Cabibee does not store the full card number.",
        "Alerts. If you turn on phone notifications, we store a device identifier so we can send them. You can turn each topic off in the Alarm center.",
        "Technical data. IP address, browser type and pages visited, so the site works and so we can detect abuse.",
      ],
    },
    {
      title: "3. Why we use it",
      paragraphs: [
        "To create and keep your account, publish listings, run chat, bookings and contracts, charge for services you buy, and show verification tags you actually completed.",
        "To send the alerts you have turned on, prevent fraud and comply with the law.",
        "We do not sell your personal data and we do not use it for third-party advertising.",
      ],
    },
    {
      title: "4. Who it is shared with",
      paragraphs: [
        "The other person in a booking or a contract receives the data that deal needs: real name, contact details and what the contract includes. That person is responsible for how they use it.",
        "Stripe, for charges and identity verification. Stripe processes that data under its own privacy notice.",
        "Providers that host the Platform, send email or deliver notifications, only to perform that service for us.",
        "A tool you connect, such as BeeAgent, receives what that connection needs.",
        "An authority, when the law requires it.",
      ],
    },
    {
      title: "5. Phone permissions",
      paragraphs: [
        "Notifications, camera, photos, files, microphone and location are requested when you use that feature, not when you open the app. You can refuse them or turn them off in your phone settings.",
        "You can keep using Cabibee without location. Some optional checks, such as clocking in for a cleaning, do not complete if you do not share it.",
      ],
    },
    {
      title: "6. How long we keep it",
      paragraphs: [
        "For as long as your account exists. When you delete it we remove the profile, the listings and the contact details. Bookings that have not finished are cancelled. Finished ones stay without your name or contact details, because the other person needs the record of the deal.",
        "Contracts and payment records are kept for as long as the law requires.",
      ],
    },
    {
      title: "7. How to see, correct or delete it",
      paragraphs: [
        "You can request access, correction, deletion or objection, and the rights you have under applicable United States privacy laws, by writing to support@cabibee.com. In Mexico these rights are exercised under the Federal Law on the Protection of Personal Data Held by Private Parties.",
        "To delete your account, open Edit profile and type your email under \"Delete my account forever\". If you cannot sign in, write to support@cabibee.com from the account email and ask for deletion.",
        "Phone, address, alias and photo are changed in Edit profile. A verified legal name cannot be changed, because we have confirmed who you are.",
      ],
    },
    {
      title: "8. Children",
      paragraphs: [
        "Cabibee is not directed at children under 13 and we do not knowingly collect their data. If you believe a child gave us data, write to support@cabibee.com and we will delete it.",
      ],
    },
    {
      title: "9. Security",
      paragraphs: [
        "The Platform is served over an encrypted connection and passwords are stored so they cannot be read back. No system is infallible: write to support@cabibee.com if you notice misuse of your account.",
      ],
    },
    {
      title: "10. Changes to this notice",
      paragraphs: [
        "If this notice changes in a material way, we will update the date above. The current version is always at cabibee.com/privacidad.",
      ],
    },
  ],
};

const CREDIT_SECTION: Record<Lang, TermsSection> = {
  es: {
    title: "Historial crediticio (sólo en la web)",
    paragraphs: [
      "Si un anfitrión lo pide para una reserva y tú lo autorizas, Cabibee solicita tu reporte de crédito a un buró de crédito por medio de un proveedor autorizado. La consulta la confirmas tú con tu NIP en la página del proveedor; Cabibee no ve tu NIP.",
      "Cabibee no guarda el reporte ni el score. Sólo guarda el resumen (apto, revisar o no recomendado), la fecha, tu consentimiento y la dirección IP desde la que lo diste. El anfitrión de esa reserva sólo ve el resumen.",
      "Puedes negar la consulta. En ese caso el anfitrión no ve ningún resultado y decide si sigue con la reserva. Esta función se ofrece en cabibee.com y en la aplicación web, no en la aplicación de Android.",
    ],
  },
  en: {
    title: "Credit history (web only)",
    paragraphs: [
      "If a host asks for it on a booking and you authorize it, Cabibee requests your credit report from a credit bureau through an authorized provider. You confirm the check with your PIN on the provider's page; Cabibee never sees your PIN.",
      "Cabibee does not keep the report or the score. It keeps only the summary (approved, review, or not recommended), the date, your consent, and the IP address you gave it from. The host of that booking only sees the summary.",
      "You can refuse the check. In that case the host sees no result and decides whether to continue with the booking. This feature is offered on cabibee.com and the web app, not in the Android app.",
    ],
  },
};

export function privacyDoc(lang: Lang): TermsDoc {
  const doc = lang === "en" ? EN : ES;
  if (!CREDIT_CHECK_ENABLED) return doc;
  const sections = [...doc.sections];
  sections.splice(4, 0, CREDIT_SECTION[lang === "en" ? "en" : "es"]);
  return { ...doc, sections };
}
