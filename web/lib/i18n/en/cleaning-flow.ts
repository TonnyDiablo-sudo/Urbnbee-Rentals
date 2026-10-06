/** Limpieza por pestañas, confirmación, cancelación con motivo, aprobación, insumos por anuncio y grupos de chat. */
export const cleaningFlow: Record<string, string> = {
  // Pestañas del panel
  "Secciones de limpieza": "Cleaning sections",
  "Por anuncio": "By listing",
  "Por aprobar": "To approve",
  "Sin confirmar": "Unconfirmed",
  "Revisa las fotos y comentarios de quien limpió y apruébala o pide que corrija algo.":
    "Check the cleaner's photos and comments, then approve it or ask them to fix something.",
  "Agrega en Ajustes los anuncios que quieres en la herramienta.": "Add the listings you want in the tool under Settings.",
  "Todavía no tienes anuncios en la herramienta.": "You don't have any listings in the tool yet.",
  "Elegir anuncios en Ajustes": "Choose listings in Settings",
  "Quién limpia (en orden de prioridad)": "Who cleans (in priority order)",
  "A la primera le llega cada limpieza nueva. Si cancela, pasa sola a la siguiente.":
    "Every new cleaning goes to the first person. If they cancel, it moves to the next one automatically.",
  "Estás en asignación manual: esta lista es tu referencia y tú eliges quién va.":
    "You're on manual assignment: this list is your reference and you choose who goes.",
  Prioridad: "Priority",
  Subir: "Move up",
  Bajar: "Move down",
  "+ Agregar persona": "+ Add person",
  "No hay limpiezas pendientes.": "No pending cleanings.",
  "Quién limpia": "Who cleans",
  "Todas las personas": "Everyone",

  // Ajustes
  "Cómo se asignan": "How they're assigned",
  "Cada limpieza nueva va a la primera persona de la lista de ese anuncio; si cancela, a la siguiente.":
    "Each new cleaning goes to the first person on that listing's list; if they cancel, to the next one.",
  "Confirmar y cancelar": "Confirming and canceling",
  "En cuanto se crea una limpieza, a quien le toca le llega un aviso para que confirme. Si no confirma a tiempo, te avisamos.":
    "As soon as a cleaning is created, the assigned person gets a notice to confirm. If they don't confirm in time, we let you know.",
  "Debe confirmar a más tardar": "Must confirm no later than",
  "Antes de empezar": "Before it starts",
  "{n} horas antes": "{n} hours before",
  "Puede cancelar hasta": "Can cancel up to",
  "Cuando sea, antes de empezar": "Anytime before it starts",
  "Al cancelar tiene que decir por qué; el motivo te llega y queda en tus notificaciones.":
    "When canceling they have to say why; you get the reason and it stays in your notifications.",
  "Al terminar": "When finished",
  "Aprobar cada limpieza": "Approve every cleaning",
  "Revisas fotos y comentarios y la apruebas, o le pides a quien limpió que corrija algo.":
    "You review photos and comments and approve it, or ask the cleaner to fix something.",

  // Tarjeta de limpieza
  "Confirma antes del {when}": "Confirm before {when}",
  "Falta que confirme": "Not confirmed yet",
  "El anfitrión pidió corregir:": "The host asked to fix:",
  "{name} canceló el {when}: «{reason}»": "{name} canceled on {when}: “{reason}”",
  "Sí puedo": "I can do it",
  "No puedo": "I can't",
  "Cancelar mi limpieza": "Cancel my cleaning",
  "Ya no puedes cancelar: faltan menos de {n} h. Escríbele al anfitrión.":
    "You can't cancel anymore: it's less than {n} h away. Message the host.",
  "Ya no puedes cancelar. Escríbele al anfitrión.": "You can't cancel anymore. Message the host.",
  "Pedir corrección": "Ask for a fix",
  "¿Por qué no puedes? Le llega al anfitrión.": "Why can't you? The host will see this.",
  "¿Qué falta corregir?": "What needs fixing?",
  "Cancelar limpieza": "Cancel cleaning",
  Mandar: "Send",

  // Quien limpia
  "Confirma cada limpieza a más tardar {n} horas antes.": "Confirm each cleaning at least {n} hours before.",
  "Confirma cada limpieza antes de empezar.": "Confirm each cleaning before it starts.",
  "Si no puedes ir, cancela con al menos {n} horas de anticipación y di por qué.":
    "If you can't go, cancel at least {n} hours ahead and say why.",
  "Si no puedes ir, cancela y di por qué.": "If you can't go, cancel and say why.",

  // Errores
  "Máximo 10 personas por anuncio.": "Up to 10 people per listing.",
  "Cuéntale al anfitrión por qué no puedes.": "Tell the host why you can't.",
  "Ya no puedes cancelar con tan poca anticipación. Escríbele al anfitrión.":
    "It's too late to cancel. Message the host.",
  "La limpieza todavía no está terminada.": "The cleaning isn't finished yet.",
  "Escribe qué falta corregir.": "Write what needs fixing.",
  "Sólo el anfitrión aprueba las limpiezas.": "Only the host approves cleanings.",
  "La confirma quien limpia.": "The cleaner confirms it.",
  "La cancela quien limpia; tú puedes reasignarla.": "The cleaner cancels it; you can reassign it.",

  // Avisos
  "Confirma tu limpieza": "Confirm your cleaning",
  "{listing} · {date}. Confirma que sí puedes, a más tardar {hours} h antes.":
    "{listing} · {date}. Confirm you can make it, at least {hours} h before.",
  "{listing} · {date}. Confirma que sí puedes.": "{listing} · {date}. Confirm you can make it.",
  "Limpieza cancelada": "Cleaning canceled",
  "Se canceló la reserva de {listing} del {date}.": "The booking at {listing} on {date} was canceled.",
  "{listing}: ahora es el {date}. Vuelve a confirmar que sí puedes.": "{listing}: it's now on {date}. Please confirm again.",
  "Nueva limpieza: confirma que sí puedes": "New cleaning: confirm you can make it",
  "{listing} · {date}. Elige quién va.": "{listing} · {date}. Choose who goes.",
  "{name} no ha confirmado una limpieza": "{name} hasn't confirmed a cleaning",
  "{listing} · {date}. Escríbele o asígnala a alguien más.": "{listing} · {date}. Message them or assign it to someone else.",
  "Falta que confirmes tu limpieza": "You still need to confirm your cleaning",
  "Hoy: limpieza": "Today: cleaning",
  "Hoy: limpieza sin asignar": "Today: unassigned cleaning",
  "Mañana: limpieza": "Tomorrow: cleaning",
  "Mañana: limpieza sin asignar": "Tomorrow: unassigned cleaning",
  "{listing} · {date} · llega huésped {next}.": "{listing} · {date} · guest arrives {next}.",
  "{listing} · {date}.": "{listing} · {date}.",
  "{name} confirmó una limpieza": "{name} confirmed a cleaning",
  "{name} canceló una limpieza": "{name} canceled a cleaning",
  "{listing} · {date}. Motivo: «{reason}». Se la pasamos a {next}.":
    "{listing} · {date}. Reason: “{reason}”. We passed it to {next}.",
  "{listing} · {date}. Motivo: «{reason}». Quedó sin asignar: elige a alguien.":
    "{listing} · {date}. Reason: “{reason}”. It's unassigned now: pick someone.",
  "Te pasaron una limpieza": "A cleaning was passed to you",
  "Aprobaron tu limpieza": "Your cleaning was approved",
  "{listing} · {date}. ¡Gracias!": "{listing} · {date}. Thank you!",
  "Hay que corregir una limpieza": "A cleaning needs fixing",
  "{listing} · {date}: {note}": "{listing} · {date}: {note}",
  "El anfitrión canceló la limpieza de {listing} del {date}.": "The host canceled the cleaning at {listing} on {date}.",
  "Revisa y aprueba una limpieza": "Review and approve a cleaning",
  "{name} terminó {listing} ({date}).": "{name} finished {listing} ({date}).",
  "Te agregaron al chat {chat}": "You were added to the {chat} chat",
  "{name} te agregó a un chat de equipo.": "{name} added you to a team chat.",

  // Insumos
  "¿De qué anuncio?": "Which listing?",
  "Este anuncio todavía no tiene insumos. Agrégalos para saber qué le falta.":
    "This listing has no supplies yet. Add them to know what it's missing.",
  "Faltan {n}": "{n} missing",
  "Juegos de sábanas": "Sheet sets",
  "Garrafón de agua": "Water jug",

  // Selector de íconos
  "Elegir ícono": "Choose icon",
  "Elige un ícono": "Pick an icon",
  Baño: "Bathroom",
  Recámara: "Bedroom",
  Exterior: "Outdoors",
  Chats: "Chats",

  // Grupos de chat
  "¿Quién está en este chat?": "Who's in this chat?",
  "El anfitrión siempre ve todos los chats.": "The host always sees every chat.",
  "¿Falta alguien? Invítalo como colaborador": "Missing someone? Invite them as a collaborator",
  "Personas en el chat": "People in the chat",
};
