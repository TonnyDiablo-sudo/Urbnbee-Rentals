/** Historial crediticio con proveedor de buró (Kibai). */
export const creditBureau: Record<string, string> = {
  "Falta que el huésped confirme con su NIP": "Waiting for the guest to confirm with their PIN",
  "El buró está procesando la consulta": "The credit bureau is processing the check",
  "Autorizo a Cabibee a pedir mi reporte de crédito a un buró de crédito, por medio de un proveedor autorizado, solo para esta reserva. La consulta la confirmo yo con mi NIP en la página del proveedor. Cabibee no es el buró: no guarda el reporte ni el score, solo el resumen (apto / revisar / no recomendado), la fecha y este consentimiento. El anfitrión solo ve el resumen. Puedo negar el permiso; en ese caso el anfitrión no verá resultado.":
    "I authorize Cabibee to request my credit report from a credit bureau, through an authorized provider, only for this booking. I confirm the check myself with my PIN on the provider's page. Cabibee is not the credit bureau: it does not keep the report or the score, only the summary (approved / review / not recommended), the date, and this consent. The host only sees the summary. I can refuse; in that case the host will not see a result.",
  "Cabibee pide el reporte a un proveedor autorizado y cobra su costo más un margen. El huésped confirma con su NIP. El reporte no se queda aquí: el anfitrión solo ve un resumen. No somos el buró.":
    "Cabibee requests the report from an authorized provider and charges its cost plus a margin. The guest confirms with their PIN. The report isn't stored here: the host only sees a summary. We are not the credit bureau.",
  "Último paso: confirma la consulta con tu NIP en la página del proveedor. Cabibee no ve tu NIP.":
    "Last step: confirm the check with your PIN on the provider's page. Cabibee never sees your PIN.",
  "Confirmar con mi NIP": "Confirm with my PIN",
  "Pagado. Falta que el huésped confirme con su NIP.": "Paid. Waiting for the guest to confirm with their PIN.",
  "El buró está procesando la consulta. Te avisamos cuando esté el resultado.":
    "The credit bureau is processing the check. We'll let you know when the result is ready.",
  "Si un anfitrión te lo pide, autorizas aquí y confirmas con tu NIP en la página del proveedor. Cabibee solo guarda el resumen, nunca tu reporte completo ni tu score.":
    "If a host asks for it, you authorize here and confirm with your PIN on the provider's page. Cabibee only keeps the summary, never your full report or your score.",
  "Falta que el huésped confirme la consulta con su NIP en la página del proveedor.":
    "Waiting for the guest to confirm the check with their PIN on the provider's page.",
  "El proveedor está procesando la consulta.": "The provider is processing the check.",
  "No pudimos iniciar la consulta con el proveedor. El equipo de Cabibee la revisa.":
    "We couldn't start the check with the provider. The Cabibee team is looking into it.",
  "El proveedor no pudo completar la consulta. El equipo de Cabibee revisa el reembolso.":
    "The provider couldn't complete the check. The Cabibee team is reviewing the refund.",
  "Resumen del buró. Cabibee no guarda el reporte completo ni el score.":
    "Credit bureau summary. Cabibee does not keep the full report or the score.",
  "Pago recibido. Estamos iniciando la consulta con el proveedor.":
    "Payment received. We're starting the check with the provider.",
  "Confirma la consulta de crédito": "Confirm the credit check",
  "Abre Cabibee en la web y confirma con tu NIP en la página del proveedor. Sin eso el anfitrión no ve el resultado.":
    "Open Cabibee on the web and confirm with your PIN on the provider's page. Without it, the host won't see the result.",
  "Tu consulta de crédito terminó": "Your credit check is done",
  "El anfitrión ya puede ver el resumen. Cabibee no guarda tu reporte completo.":
    "The host can now see the summary. Cabibee does not keep your full report.",
  "La revisión de historial crediticio se hace desde la web de Cabibee.":
    "The credit history check is done from the Cabibee website.",
  "Esta consulta ya no necesita tu NIP.": "This check no longer needs your PIN.",
  "Lo que se cobra es el costo del proveedor más el margen de Cabibee. El anfitrión elige si lo paga él o se lo cobra al huésped. El huésped confirma con su NIP en la página del proveedor.":
    "The charge is the provider's cost plus Cabibee's margin. The host chooses whether to pay it or pass it to the guest. The guest confirms with their PIN on the provider's page.",
  "Prendido en web y PWA. La app de Android no lo muestra.": "On for web and PWA. The Android app doesn't show it.",
  "Apagado: huéspedes y anfitriones no lo ven. Se prende con NEXT_PUBLIC_CREDIT_CHECK_ENABLED=1 y las llaves del proveedor (CREDIT_BUREAU_PROVIDER, KIBAI_API_URL, KIBAI_API_KEY, KIBAI_WEBHOOK_SECRET).":
    "Off: guests and hosts don't see it. Turn it on with NEXT_PUBLIC_CREDIT_CHECK_ENABLED=1 and the provider keys (CREDIT_BUREAU_PROVIDER, KIBAI_API_URL, KIBAI_API_KEY, KIBAI_WEBHOOK_SECRET).",
};
