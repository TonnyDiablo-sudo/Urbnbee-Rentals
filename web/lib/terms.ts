import type { Lang } from "@/lib/i18n";

/** Al cambiar el texto de forma relevante, sube la versión: todos vuelven a aceptar. */
export const TERMS_VERSION = "2026-10-04";

export type TermsSection = { title: string; paragraphs: string[] };
export type TermsDoc = { title: string; updated: string; intro: string; sections: TermsSection[] };

export function hasAcceptedTerms(user: { termsVersion?: string } | null | undefined): boolean {
  return user?.termsVersion === TERMS_VERSION;
}

const ES: TermsDoc = {
  title: "Términos y condiciones de uso de Cabibee",
  updated: "Última actualización: 4 de octubre de 2026",
  intro:
    "Estos Términos y condiciones (los «Términos») regulan el uso del sitio web, la aplicación y los servicios de Cabibee (en conjunto, la «Plataforma»). Al crear una cuenta, reclamar una cuenta creada a tu nombre o seguir usando la Plataforma, aceptas estos Términos de forma electrónica. Si no estás de acuerdo, no uses la Plataforma.",
  sections: [
    {
      title: "1. Qué es Cabibee",
      paragraphs: [
        "Cabibee es propiedad de Urbnbee LLC, una sociedad de responsabilidad limitada constituida en el estado de Nevada, Estados Unidos, que la opera. En estos Términos, «Cabibee» también se refiere a Urbnbee LLC.",
        "Cabibee es una plataforma tecnológica que permite a anfitriones publicar alojamientos y a huéspedes encontrarlos y contactarlos. También ofrece herramientas opcionales, como plantillas de contrato, firma electrónica, motor de reservas, cobro, verificación de identidad y domicilio, y gestión de limpieza.",
        "Cabibee no es propietario, arrendador, arrendatario, administrador, agente inmobiliario, corredor, aseguradora ni representante de ningún usuario, y no presta servicios de hospedaje.",
      ],
    },
    {
      title: "2. Cabibee no es parte de los acuerdos entre usuarios",
      paragraphs: [
        "Cualquier reserva, renta, contrato, pago acordado directamente, mensaje, llamada o trato entre un anfitrión y un huésped, o entre cualquier usuario y un tercero (por ejemplo, personal de limpieza o colaboradores), es un acuerdo exclusivamente entre ellos. Cabibee no es parte de esos acuerdos ni asume las obligaciones de ninguna de las partes.",
        "Los contratos que se generan con las plantillas de Cabibee son contratos entre el anfitrión y el huésped. El anfitrión elige la plantilla, la adapta y es el único responsable de su contenido, de que sea válido y de que cumpla la ley aplicable. Cabibee facilita la herramienta para que el acuerdo quede por escrito y firmado, pero no garantiza que una plantilla sea adecuada para un caso concreto.",
        "Los chats, datos de contacto y comunicaciones entre usuarios son responsabilidad de quienes los envían. Cabibee no está obligado a vigilarlos, aunque puede revisarlos y retirarlos si recibe un reporte o detecta un incumplimiento de estos Términos.",
      ],
    },
    {
      title: "3. Controversias entre usuarios",
      paragraphs: [
        "Cualquier desacuerdo sobre el estado del alojamiento, pagos, depósitos, cancelaciones, daños, conducta, desalojos o cualquier otro tema derivado de un trato entre usuarios debe resolverse entre ellos. Cabibee puede, a su criterio y sin obligación, compartir la información que tenga sobre una reserva hecha en la Plataforma cuando la ley lo exija o una autoridad la solicite.",
        "Liberas a Cabibee, sus socios, empleados y afiliados de cualquier reclamación, daño o pérdida, conocida o desconocida, que surja de tus tratos con otros usuarios o con terceros. Si resides en California, renuncias a la protección del artículo 1542 del Código Civil de California en la medida en que aplique a esta liberación.",
      ],
    },
    {
      title: "4. Obligaciones de los anfitriones",
      paragraphs: [
        "El anfitrión declara que tiene derecho a rentar el inmueble, que cuenta con los permisos, licencias y registros que exija su localidad, que paga los impuestos que le correspondan (por ejemplo, el impuesto sobre hospedaje, ISR e IVA en México, o los impuestos de ocupación en Estados Unidos) y que respeta las reglas de su condominio, asociación o arrendador.",
        "El anfitrión es responsable de que la información de sus anuncios sea veraz, de cumplir los contratos que firme con sus huéspedes, de las estancias mínimas o máximas que fije su localidad y de la seguridad del inmueble. Los consejos que muestra Cabibee son generales y no son asesoría legal, fiscal ni contable.",
      ],
    },
    {
      title: "5. Obligaciones de los huéspedes",
      paragraphs: [
        "El huésped es responsable de revisar el anuncio, las etiquetas de verificación y el contrato antes de reservar; de respetar las reglas de la casa y el contrato firmado; y de pagar los daños que cause, conforme a lo acordado con el anfitrión.",
      ],
    },
    {
      title: "6. Verificaciones y etiquetas",
      paragraphs: [
        "Las etiquetas como «Identidad verificada», «Miembro verificado» o «Ubicación verificada» indican que un usuario completó un proceso concreto en una fecha concreta. No son una garantía sobre la conducta, solvencia o honestidad de ese usuario ni sobre el estado del inmueble. Usa tu propio criterio.",
      ],
    },
    {
      title: "7. Pagos y servicios de la Tienda",
      paragraphs: [
        "Publicar, buscar y contactar en Cabibee es gratis. Algunos servicios opcionales de la Tienda tienen costo, que se muestra antes de contratarlos. Los cobros se procesan con proveedores externos, como Stripe, sujetos a sus propios términos.",
        "Cuando un huésped paga a través del motor de reservas de un anfitrión, el pago corresponde al acuerdo entre ambos. Las devoluciones se rigen por la política de cancelación del contrato que firmaron, salvo que la ley disponga otra cosa.",
      ],
    },
    {
      title: "8. Conducta prohibida",
      paragraphs: [
        "No puedes publicar información falsa, suplantar a otra persona, usar la Plataforma para fraudes, discriminar por raza, origen, religión, género, orientación sexual, discapacidad u otra condición protegida, acosar a otros usuarios, ni extraer datos de forma automatizada. Cabibee puede suspender o cerrar cuentas que incumplan estos Términos.",
      ],
    },
    {
      title: "9. Limitación de responsabilidad",
      paragraphs: [
        "La Plataforma se ofrece «tal cual» y «según disponibilidad». En la máxima medida que permita la ley, Cabibee no otorga garantías, expresas o implícitas, de comerciabilidad, idoneidad para un fin determinado o no infracción, y no responde por daños indirectos, incidentales, especiales, consecuentes o punitivos, ni por pérdida de ingresos, datos o reputación.",
        "En la máxima medida que permita la ley, la responsabilidad total de Cabibee frente a ti por cualquier reclamación relacionada con la Plataforma no excederá la cantidad que hayas pagado a Cabibee en los doce meses anteriores al hecho que la originó, o 100 dólares estadounidenses (o su equivalente en pesos mexicanos), lo que sea mayor.",
        "Nada en estos Términos limita derechos que, conforme a la Ley Federal de Protección al Consumidor u otra ley aplicable, no puedan renunciarse.",
      ],
    },
    {
      title: "10. Indemnización",
      paragraphs: [
        "Te obligas a defender, indemnizar y sacar en paz y a salvo a Cabibee, sus socios, empleados y afiliados frente a cualquier reclamación, multa, daño o gasto (incluidos honorarios razonables de abogados) que surja de tu uso de la Plataforma, de tus anuncios o contratos, de tus tratos con otros usuarios o de tu incumplimiento de estos Términos o de la ley.",
      ],
    },
    {
      title: "11. Datos personales",
      paragraphs: [
        "Cabibee trata tus datos personales para operar la Plataforma, conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares en México y a las leyes de privacidad aplicables en Estados Unidos. Puedes ejercer tus derechos de acceso, rectificación, cancelación y oposición escribiendo a hola@cabibee.com, y puedes borrar tu cuenta desde la configuración.",
        "Cuando reservas o firmas un contrato, los datos necesarios se comparten con la otra parte. Esa persona es responsable del uso que haga de ellos.",
      ],
    },
    {
      title: "12. Cuentas creadas por terceros",
      paragraphs: [
        "Si un asociado de Cabibee creó una cuenta con tu información pública, al reclamarla confirmas que eres el titular o estás autorizado, revisas tus anuncios y aceptas estos Términos. Si no la reclamas, puedes pedir que se elimine escribiendo a hola@cabibee.com.",
      ],
    },
    {
      title: "13. Ley aplicable y controversias con Cabibee",
      paragraphs: [
        "Si resides en México, estos Términos se rigen por las leyes federales de los Estados Unidos Mexicanos y te sometes a los tribunales competentes de la Ciudad de México, sin perjuicio de los derechos que te otorga la Procuraduría Federal del Consumidor.",
        "Si resides en Estados Unidos, estos Términos se rigen por las leyes del estado de Nevada, sin considerar sus normas de conflicto de leyes. Antes de demandar, ambas partes intentarán resolver la controversia de buena fe durante 30 días. Las controversias se resolverán de manera individual, no como demanda colectiva, ante el tribunal competente o el tribunal de reclamos menores de tu condado.",
      ],
    },
    {
      title: "14. Cambios a estos Términos",
      paragraphs: [
        "Cabibee puede actualizar estos Términos. Si el cambio es relevante, te pediremos que los aceptes de nuevo al entrar a la Plataforma. Si no estás de acuerdo, puedes dejar de usarla y borrar tu cuenta.",
      ],
    },
    {
      title: "15. Aceptación electrónica",
      paragraphs: [
        "Al marcar la casilla y dar clic en aceptar, otorgas tu consentimiento por medios electrónicos, con la misma validez que una firma autógrafa, conforme al Código de Comercio y al Código Civil Federal en México, y a la ley federal E-SIGN y la Uniform Electronic Transactions Act en Estados Unidos. Guardamos la fecha y la versión que aceptaste. Puedes consultar estos Términos en cualquier momento en la Plataforma.",
        "Contacto: hola@cabibee.com.",
      ],
    },
  ],
};

const EN: TermsDoc = {
  title: "Cabibee Terms of Use",
  updated: "Last updated: October 4, 2026",
  intro:
    "These Terms of Use (the \"Terms\") govern your use of the Cabibee website, app and services (together, the \"Platform\"). By creating an account, claiming an account created in your name, or continuing to use the Platform, you accept these Terms electronically. If you do not agree, do not use the Platform.",
  sections: [
    {
      title: "1. What Cabibee is",
      paragraphs: [
        "Cabibee is owned and operated by Urbnbee LLC, a limited liability company organized under the laws of the State of Nevada, United States. In these Terms, \"Cabibee\" also refers to Urbnbee LLC.",
        "Cabibee is a technology platform that lets hosts list places to stay and lets guests find and contact them. It also offers optional tools such as contract templates, electronic signature, a booking engine, payments, identity and address verification, and cleaning management.",
        "Cabibee is not an owner, landlord, tenant, property manager, real estate agent, broker, insurer or representative of any user, and it does not provide lodging services.",
      ],
    },
    {
      title: "2. Cabibee is not a party to agreements between users",
      paragraphs: [
        "Any booking, rental, contract, directly agreed payment, message, call or dealing between a host and a guest, or between any user and a third party (for example, cleaning staff or collaborators), is an agreement solely between them. Cabibee is not a party to those agreements and does not assume any party's obligations.",
        "Contracts generated with Cabibee templates are contracts between the host and the guest. The host chooses the template, adapts it, and is solely responsible for its content, its validity and its compliance with applicable law. Cabibee provides the tool so the agreement is put in writing and signed, but does not guarantee that a template fits any specific situation.",
        "Chats, contact details and communications between users are the responsibility of those who send them. Cabibee has no duty to monitor them, although it may review and remove them if it receives a report or detects a breach of these Terms.",
      ],
    },
    {
      title: "3. Disputes between users",
      paragraphs: [
        "Any disagreement about the condition of a property, payments, deposits, cancellations, damage, conduct, evictions or any other matter arising from dealings between users must be resolved between them. Cabibee may, at its discretion and without obligation, share information it holds about a booking made on the Platform when required by law or requested by an authority.",
        "You release Cabibee, its partners, employees and affiliates from any claim, damage or loss, known or unknown, arising from your dealings with other users or third parties. If you are a California resident, you waive California Civil Code Section 1542 to the extent it applies to this release.",
      ],
    },
    {
      title: "4. Host obligations",
      paragraphs: [
        "The host represents that they have the right to rent the property, hold the permits, licenses and registrations required locally, pay the taxes that apply to them (for example, lodging tax, ISR and VAT in Mexico, or occupancy taxes in the United States), and follow the rules of their condominium, association or landlord.",
        "The host is responsible for the accuracy of their listings, for honoring the contracts they sign with guests, for any minimum or maximum stay rules in their area, and for the safety of the property. Tips shown by Cabibee are general and are not legal, tax or accounting advice.",
      ],
    },
    {
      title: "5. Guest obligations",
      paragraphs: [
        "The guest is responsible for reviewing the listing, verification tags and contract before booking; for following the house rules and the signed contract; and for paying for any damage they cause, as agreed with the host.",
      ],
    },
    {
      title: "6. Verifications and tags",
      paragraphs: [
        "Tags such as \"Identity verified\", \"Verified member\" or \"Location verified\" mean that a user completed a specific process on a specific date. They are not a guarantee of that user's conduct, solvency or honesty, or of the condition of the property. Use your own judgment.",
      ],
    },
    {
      title: "7. Payments and Store services",
      paragraphs: [
        "Listing, searching and contacting on Cabibee is free. Some optional Store services have a cost, shown before you buy them. Charges are processed by third-party providers such as Stripe, subject to their own terms.",
        "When a guest pays through a host's booking engine, the payment belongs to the agreement between them. Refunds follow the cancellation policy in the contract they signed, unless the law provides otherwise.",
      ],
    },
    {
      title: "8. Prohibited conduct",
      paragraphs: [
        "You may not post false information, impersonate anyone, use the Platform for fraud, discriminate based on race, national origin, religion, sex, sexual orientation, disability or any other protected characteristic, harass other users, or scrape data by automated means. Cabibee may suspend or close accounts that breach these Terms.",
      ],
    },
    {
      title: "9. Limitation of liability",
      paragraphs: [
        "The Platform is provided \"as is\" and \"as available\". To the fullest extent permitted by law, Cabibee disclaims all warranties, express or implied, including merchantability, fitness for a particular purpose and non-infringement, and is not liable for indirect, incidental, special, consequential or punitive damages, or for lost revenue, data or goodwill.",
        "To the fullest extent permitted by law, Cabibee's total liability to you for any claim related to the Platform will not exceed the greater of the amount you paid Cabibee in the twelve months before the event giving rise to the claim, or US$100 (or its equivalent in Mexican pesos).",
        "Nothing in these Terms limits rights that cannot be waived under Mexico's Federal Consumer Protection Law or other applicable law.",
      ],
    },
    {
      title: "10. Indemnification",
      paragraphs: [
        "You agree to defend, indemnify and hold harmless Cabibee, its partners, employees and affiliates from any claim, fine, damage or expense (including reasonable attorneys' fees) arising from your use of the Platform, your listings or contracts, your dealings with other users, or your breach of these Terms or the law.",
      ],
    },
    {
      title: "11. Personal data",
      paragraphs: [
        "Cabibee processes your personal data to operate the Platform, in accordance with Mexico's Federal Law on the Protection of Personal Data Held by Private Parties and applicable US privacy laws. You can exercise your rights of access, correction, deletion and objection by writing to hola@cabibee.com, and you can delete your account from your settings.",
        "When you book or sign a contract, the necessary data is shared with the other party. That person is responsible for how they use it.",
      ],
    },
    {
      title: "12. Accounts created by others",
      paragraphs: [
        "If a Cabibee associate created an account with your public information, by claiming it you confirm that you are the owner or are authorized, you review your listings and you accept these Terms. If you do not claim it, you can ask for it to be deleted by writing to hola@cabibee.com.",
      ],
    },
    {
      title: "13. Governing law and disputes with Cabibee",
      paragraphs: [
        "If you reside in Mexico, these Terms are governed by the federal laws of the United Mexican States and you submit to the competent courts of Mexico City, without prejudice to your rights before the Federal Consumer Protection Agency (PROFECO).",
        "If you reside in the United States, these Terms are governed by the laws of the State of Nevada, without regard to its conflict-of-law rules. Before filing a claim, both parties will try in good faith to resolve the dispute for 30 days. Disputes will be resolved on an individual basis, not as a class action, before the competent court or the small claims court of your county.",
      ],
    },
    {
      title: "14. Changes to these Terms",
      paragraphs: [
        "Cabibee may update these Terms. If a change is material, we will ask you to accept them again when you next use the Platform. If you do not agree, you may stop using it and delete your account.",
      ],
    },
    {
      title: "15. Electronic acceptance",
      paragraphs: [
        "By checking the box and clicking accept, you give your consent electronically, with the same validity as a handwritten signature, under Mexico's Commerce Code and Federal Civil Code, and under the federal E-SIGN Act and the Uniform Electronic Transactions Act in the United States. We store the date and the version you accepted. You can read these Terms at any time on the Platform.",
        "Contact: hola@cabibee.com.",
      ],
    },
  ],
};

export function termsDoc(lang: Lang): TermsDoc {
  return lang === "en" ? EN : ES;
}
