/** Mapa de búsqueda, descuentos, impuestos por anuncio, sello de identidad y revisión crediticia. */
export const appSearchDiscounts: Record<string, string> = {
  // Mapa de búsqueda
  Mapa: "Map",
  Lista: "List",
  "Ver mapa": "Show map",
  "Ver lista": "Show list",
  "Ninguno de estos alojamientos tiene ubicación en el mapa todavía.": "None of these places has a map location yet.",
  "✓ Verificados": "✓ Verified",

  // Identidad verificada
  "✓ Identidad verificada": "✓ ID verified",
  "Identidad verificada": "ID verified",
  "Perfil verificado: Cabibee comprobó la identidad de este anfitrión con su identificación oficial.":
    "Verified profile: Cabibee checked this host's identity against their official ID.",
  "Este anfitrión todavía no verifica su identidad en Cabibee.": "This host hasn't verified their identity on Cabibee yet.",

  // Descuentos
  "Reserva anticipada ({n}%)": "Early-bird discount ({n}%)",
  "Descuento de última hora ({n}%)": "Last-minute discount ({n}%)",
  "Reserva anticipada ({n}+ días antes)": "Early bird ({n}+ days ahead)",
  "Última hora (llegada en {n} días o menos)": "Last minute (arriving within {n} days)",
  "{label}: {from} al {to}": "{label}: {from} to {to}",
  "Temporada: {from} al {to}": "Season: {from} to {to}",
  "Promoción de temporada": "Seasonal promotion",
  "Promociones de temporada": "Seasonal promotions",
  "Reserva anticipada": "Early bird",
  "Días de anticipación": "Days ahead",
  "Última hora": "Last minute",
  "Días antes de llegar": "Days before arrival",
  "Para quien reserva con al menos {n} días antes de llegar.": "For guests who book at least {n} days before arrival.",
  "Para quien llega dentro de {n} días o menos. Llena huecos de tu calendario.":
    "For guests arriving within {n} days. Fills gaps in your calendar.",
  "No se acumulan: si aplican varios, el huésped recibe el mayor.":
    "They don't stack: if several apply, the guest gets the biggest one.",
  "Descuento para las noches dentro de un rango de fechas (temporada baja, ofertas). Se suma antes del descuento de estancia.":
    "A discount for nights within a date range (low season, deals). It's applied before the stay discount.",
  Desde: "From",
  Hasta: "To",
  "Nombre (opcional)": "Name (optional)",
  "Temporada baja": "Low season",
  Descuento: "Discount",
  "Quitar promoción": "Remove promotion",
  "Agregar promoción de temporada": "Add seasonal promotion",
  "Cada promoción de temporada necesita fecha de inicio, fecha de fin y porcentaje.":
    "Each seasonal promotion needs a start date, an end date and a percentage.",
  "{n}% mensual": "{n}% monthly",
  "{n}% anticipada": "{n}% early bird",
  "{n}% última hora": "{n}% last minute",
  "1 promoción": "1 promotion",
  "{n} promociones": "{n} promotions",

  // Impuestos por anuncio y por reserva
  incluidos: "included",
  "No cobra": "Not charged",
  "No configurados": "Not set up",
  "No se cobran en este anuncio": "Not charged on this listing",
  "Se cobran {taxes}": "Charged: {taxes}",
  "Se cobran {taxes} · decides al aceptar": "Charged: {taxes} · you decide when accepting",
  "Todavía no configuras impuestos. Primero elige tu país y los impuestos que cobras (IVA, hospedaje…).":
    "You haven't set up taxes yet. First choose your country and the taxes you charge (VAT, lodging…).",
  "Configurar impuestos": "Set up taxes",
  "Tus impuestos: {taxes} ({mode}).": "Your taxes: {taxes} ({mode}).",
  "ya incluidos en el precio": "already included in the price",
  "se suman al precio": "added to the price",
  "Cobrar impuestos en este anuncio": "Charge taxes on this listing",
  "El huésped ve el desglose antes de pagar y se agrega a su contrato.":
    "The guest sees the breakdown before paying and it's added to their contract.",
  "No cobrar impuestos": "Don't charge taxes",
  "El huésped ve que este anuncio no cobra impuestos.": "The guest sees that this listing doesn't charge taxes.",
  "Como tú apruebas cada solicitud, esto es lo que se propone al huésped. Al aceptar puedes cambiarlo para esa reserva; si el total cambia, Cabibee le cobra o le devuelve la diferencia.":
    "Since you approve each request, this is what the guest is offered. When accepting you can change it for that booking; if the total changes, Cabibee charges or refunds the difference.",
  "Con reservación inmediata se aplica tal cual al pagar, así que decide aquí.":
    "With instant booking it's applied as is at payment, so decide here.",
  "Cambiar país o porcentajes": "Change country or rates",
  "Cobrar impuestos en esta reserva": "Charge taxes on this booking",
  "Incluye {amount} de impuestos.": "Includes {amount} in taxes.",
  "Se suman {amount} de impuestos.": "{amount} in taxes is added.",
  "Con {amount} de impuestos.": "With {amount} in taxes.",
  "Se agregan al total y al contrato.": "They're added to the total and the contract.",
  "El huésped no paga impuestos en esta reserva.": "The guest doesn't pay taxes on this booking.",
  "Total: {total}": "Total: {total}",
  "Sin impuestos.": "No taxes.",
  "Los impuestos ya vienen en el precio.": "Taxes are already included in the price.",
  "Este anfitrión cobra impuestos en esta reserva.": "This host charges taxes on this booking.",
  "Este anfitrión no cobra impuestos (IVA) en esta reserva.": "This host doesn't charge taxes (VAT) on this booking.",
  "El anfitrión aprueba tu solicitud y confirma el total final (fechas e impuestos). Si cambia, te avisamos antes de cobrar o devolver la diferencia. Puedes platicarlo por el chat.":
    "The host approves your request and confirms the final total (dates and taxes). If it changes, we'll let you know before charging or refunding the difference. You can talk it over in the chat.",
  "El anfitrión aprueba cada solicitud y confirma el total final (fechas e impuestos) antes de que se te cobre cualquier diferencia.":
    "The host approves each request and confirms the final total (dates and taxes) before any difference is charged.",

  // Revisión crediticia
  "Historial crediticio": "Credit history",
  "Pide una revisión de crédito ({price}). El huésped tiene que autorizarla; tú decides quién la paga.":
    "Request a credit check ({price}). The guest has to authorize it; you decide who pays.",
  "La pago yo": "I'll pay",
  "Que la pague el huésped": "Guest pays",
  "La revisión de crédito no está disponible por ahora.": "Credit checks aren't available right now.",
  "Resultado: {band}": "Result: {band}",
  "Esperando a que el huésped la autorice. Ya le avisamos.": "Waiting for the guest to authorize it. We've notified them.",
  "El huésped autorizó; falta que pague la consulta.": "The guest authorized it; they still need to pay for the check.",
  "El huésped autorizó. Paga la consulta para ver el resultado.": "The guest authorized it. Pay for the check to see the result.",
  "Pagar consulta": "Pay for the check",
  "No se pudo pedir la revisión.": "Couldn't request the check.",
  "Tu anfitrión pide revisar tu historial crediticio": "Your host is asking for a credit check",
  "Autoriza y paga la consulta para que pueda continuar con tu reserva.":
    "Authorize and pay for the check so they can move forward with your booking.",
  "Autoriza la consulta para continuar. La paga el anfitrión.": "Authorize the check to continue. The host pays for it.",
  "Revisar y autorizar": "Review and authorize",
  "{listing}: autoriza y paga la consulta para que el anfitrión pueda continuar con tu reserva.":
    "{listing}: authorize and pay for the check so the host can move forward with your booking.",
  "{listing}: autoriza la consulta para continuar. La paga el anfitrión.":
    "{listing}: authorize the check to continue. The host pays for it.",
  "{name} autorizó la revisión crediticia": "{name} authorized the credit check",
  "Paga la consulta para ver el resultado.": "Pay for the check to see the result.",
  "Falta que el huésped pague la consulta.": "The guest still needs to pay for the check.",
  "Resultado de crédito listo": "Credit result ready",
  "Ya puedes ver el resumen de {name} en la solicitud.": "You can now see {name}'s summary in the request.",
};
