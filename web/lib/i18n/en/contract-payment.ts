/** Contrato firmado por ambas partes antes de pagar, plazo de pago, sellos y reabrir/archivar. */
export const contractPayment: Record<string, string> = {
  "Se venció el plazo para pagar y el contrato quedó anulado. Puedes reabrir la reserva para generar uno nuevo.":
    "The payment deadline passed and the contract was voided. You can reopen the booking to generate a new one.",
  "El anfitrión todavía no firma el contrato. Le avisamos; en cuanto firme podrás pagar.":
    "The host hasn't signed the contract yet. We let them know; you can pay as soon as they sign.",
  "Se venció el plazo para pagar. En unos minutos el contrato queda anulado y podrás reabrir la reserva.":
    "The payment deadline passed. In a few minutes the contract is voided and you'll be able to reopen the booking.",
  "Para reabrir y firmar en nombre del anfitrión necesitas el rol «Firmar contratos».":
    "To reopen and sign on the host's behalf you need the “Sign contracts” role.",
  "Acción no válida (accept | reject | sign | reopen | archive).": "Invalid action (accept | reject | sign | reopen | archive).",

  "El contrato se anuló porque no se pagó a tiempo": "The contract was voided because it wasn't paid on time",
  "Contrato y pago": "Contract and payment",
  "Se rechazó el pago. El huésped tiene hasta el {when} para volver a pagar; si no, el contrato se anula.":
    "The payment was declined. The guest has until {when} to pay again; otherwise the contract is voided.",
  "El huésped tiene hasta el {when} para pagar. Ambos firman antes; el contrato surte efectos con el pago.":
    "The guest has until {when} to pay. Both sign first; the contract takes effect with the payment.",
  "Reábrela con las mismas fechas u otras: se genera un contrato nuevo (el anulado queda archivado) y el huésped tiene un nuevo plazo para firmar y pagar.":
    "Reopen it with the same dates or new ones: a new contract is generated (the voided one is archived) and the guest gets a new deadline to sign and pay.",
  "Reabrir con contrato nuevo": "Reopen with a new contract",
  "¿Archivar esta reserva? Ya no se podrá reabrir.": "Archive this booking? It can't be reopened afterwards.",
  "Archivar": "Archive",
  "Archivando…": "Archiving…",
  "Reabriendo…": "Reopening…",
  "Reserva archivada.": "Booking archived.",
  "Reserva reabierta con contrato nuevo. Avisamos al huésped.": "Booking reopened with a new contract. We let the guest know.",
  "Contrato firmado. Avisamos al huésped para que pague.": "Contract signed. We let the guest know so they can pay.",
  "No se pudo reabrir.": "Couldn't reopen.",
  "No se pudo archivar.": "Couldn't archive.",
  "No se pudo completar.": "Couldn't complete it.",
  "Anulada (no se pagó a tiempo)": "Voided (not paid on time)",

  "Se rechazó tu pago. Vuelve a pagar antes del {when} o el contrato se anula.":
    "Your payment was declined. Pay again before {when} or the contract is voided.",
  "Las dos partes firman antes de pagar. El contrato surte efectos cuando se recibe el pago; si no se paga antes del {when}, se anula.":
    "Both parties sign before paying. The contract takes effect once the payment is received; if it isn't paid before {when}, it's voided.",
  "Ya firmaste. Falta la firma del anfitrión; te avisamos en cuanto firme para que puedas pagar.":
    "You've signed. The host's signature is still missing; we'll let you know as soon as they sign so you can pay.",
  "Volver a pagar": "Pay again",
  "Resuelto: el pago se recibió después": "Resolved: the payment was received later",
  "Esta reserva se archivó.": "This booking was archived.",
  "Esta reserva ya no está activa.": "This booking is no longer active.",
  "Puedes reabrir la reserva con las mismas fechas u otras: se genera un contrato nuevo que ambos vuelven a firmar. O archívala si ya no la quieres.":
    "You can reopen the booking with the same dates or new ones: a new contract is generated and both of you sign again. Or archive it if you no longer want it.",
  "PAGO RECIBIDO": "PAYMENT RECEIVED",
  "PAGO RECHAZADO": "PAYMENT DECLINED",
  "CONTRATO ANULADO": "CONTRACT VOIDED",

  "Esta reserva ya se archivó.": "This booking was already archived.",
  "Sólo se reabren reservas anuladas por falta de pago.": "Only bookings voided for non-payment can be reopened.",
  "Este alojamiento ya no está disponible.": "This place is no longer available.",
  "Las fechas deben ser AAAA-MM-DD.": "Dates must be YYYY-MM-DD.",
  "Esas fechas ya pasaron. Elige otras para reabrir la reserva.": "Those dates have passed. Pick others to reopen the booking.",
  "No se pudieron apartar esas noches. Intenta de nuevo.": "Couldn't hold those nights. Try again.",
  "No se pudo reabrir la reserva.": "Couldn't reopen the booking.",
  "Sólo se archivan reservas anuladas.": "Only voided bookings can be archived.",

  "Se rechazó el pago de tu reserva": "Your booking payment was declined",
  "{listing}: vuelve a pagar antes del {when} o la reserva se anula.": "{listing}: pay again before {when} or the booking is voided.",
  "Se rechazó el pago de una reserva": "A booking payment was declined",
  "{listing}: el huésped tiene hasta el {when} para volver a pagar; si no, se anula.":
    "{listing}: the guest has until {when} to pay again; otherwise it's voided.",
  "Firma el contrato para que tu huésped pueda pagar": "Sign the contract so your guest can pay",
  "{guest} ya firmó el contrato de {listing}. El pago se habilita en cuanto tú firmes.":
    "{guest} already signed the contract for {listing}. Payment opens as soon as you sign.",
  "El anfitrión firmó: ya puedes pagar": "The host signed: you can pay now",
  "{listing}: paga antes del {when} para que el contrato surta efectos.": "{listing}: pay before {when} so the contract takes effect.",
  "El anfitrión reabrió tu reserva": "The host reopened your booking",
  "{listing}: firma el contrato nuevo y paga antes del {when}.": "{listing}: sign the new contract and pay before {when}.",
  "Tu huésped reabrió una reserva anulada": "Your guest reopened a voided booking",
  "{listing}: el huésped tiene hasta el {when} para firmar y pagar.": "{listing}: the guest has until {when} to sign and pay.",
  "{listing}: firma el contrato nuevo para que el huésped pueda pagar antes del {when}.":
    "{listing}: sign the new contract so the guest can pay before {when}.",
};
