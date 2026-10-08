/** Portal de asociados (/asociados), sus APIs y /claim-admin. */
export const associates: Record<string, string> = {
  // Layout
  "Asociados · Cabibee": "Associates · Cabibee",
  "Cabibee · Asociados": "Cabibee · Associates",
  Inicio: "Home",
  "Subir capturas": "Upload screenshots",
  "Extensión de Chrome": "Chrome extension",

  // Inicio
  "Cuentas creadas": "Accounts created",
  "Reclamadas por el dueño": "Claimed by the owner",
  "Borradores por revisar": "Drafts to review",
  "+ Subir capturas": "+ Upload screenshots",
  "Nada pendiente. Importa un anuncio con la extensión de Chrome o sube capturas.":
    "Nothing pending. Import a listing with the Chrome extension or upload screenshots.",
  "Sin ciudad": "No city",
  Capturas: "Screenshots",
  "{count} fotos": "{count} photos",
  "Mis cuentas de anfitrión": "My host accounts",
  "Todavía no creas cuentas.": "You haven't created any accounts yet.",
  "Vistas / contactos": "Views / contacts",
  Reclamada: "Claimed",
  "Sin reclamar": "Unclaimed",

  // Subir capturas
  "Para anuncios de WhatsApp o del celular. Sube capturas del anuncio: texto, precio, contacto y cada foto. GPT lee los datos y Gemini recorta las fotos. Para que las fotos salgan bien, abre cada foto en pantalla completa antes de tomarle captura.":
    "For listings from WhatsApp or a phone. Upload screenshots of the listing: text, price, contact and each photo. GPT reads the details and Gemini crops the photos. For good photos, open each one full screen before taking the screenshot.",
  "Este anuncio se agregará a la cuenta de": "This listing will be added to the account of",
  "Sube al menos una captura.": "Upload at least one screenshot.",
  "No se pudo analizar.": "Couldn't analyze it.",
  "Arrastra, pega (Ctrl+V) o haz clic para elegir capturas": "Drag, paste (Ctrl+V) or click to choose screenshots",
  "Hasta {max} imágenes · JPEG, PNG o WebP · máx. {mb} MB c/u": "Up to {max} images · JPEG, PNG or WebP · max. {mb} MB each",
  Quitar: "Remove",
  "Notas para la IA (opcional)": "Notes for the AI (optional)",
  "Ej. el precio es por fin de semana; el dueño se llama Juan Pérez.": "E.g. the price is per weekend; the owner's name is Juan Pérez.",
  "Analizando con IA… (puede tardar un minuto)": "Analyzing with AI… (may take a minute)",
  Analizar: "Analyze",

  // Extensión
  "Abres un anuncio en Facebook Marketplace, un grupo de Facebook, Trovit, Inmuebles24 o cualquier sitio de alojamientos, y con un clic lo mandas a Cabibee. La extensión toma el texto exacto y las fotos originales; la IA arma el borrador y tú lo revisas aquí.":
    "Open a listing on Facebook Marketplace, a Facebook group, Trovit, Inmuebles24 or any lodging site, and send it to Cabibee with one click. The extension grabs the exact text and the original photos; the AI builds the draft and you review it here.",
  "Copia la carpeta": "Copy the",
  "del proyecto a tu computadora.": "folder from the project to your computer.",
  "En Chrome abre": "In Chrome open",
  activa: "turn on",
  "Modo de desarrollador": "Developer mode",
  "y elige": "and choose",
  "Cargar descomprimida": "Load unpacked",
  "con esa carpeta.": "with that folder.",
  "Genera tu token abajo y pégalo en la extensión junto con la dirección de Cabibee.":
    "Generate your token below and paste it into the extension along with the Cabibee address.",
  "En cada anuncio: abre la galería y pasa por todas las fotos (para que carguen), luego clic en el ícono 🐝 →":
    "On each listing: open the gallery and scroll through every photo (so they load), then click the 🐝 icon →",
  "Importar a Cabibee": "Import to Cabibee",
  "Los borradores aparecen en Inicio → Por revisar.": "Drafts show up under Home → To review.",
  "Usa la extensión a mano, un anuncio a la vez. No automatices la navegación: Facebook bloquea cuentas que se comportan como bots.":
    "Use the extension by hand, one listing at a time. Don't automate browsing: Facebook blocks accounts that behave like bots.",
  "Si ya tenías un token, dejará de funcionar. ¿Generar uno nuevo?": "If you already had a token, it will stop working. Generate a new one?",
  "Dirección de Cabibee": "Cabibee address",
  Copiar: "Copy",
  "Tu token (solo se muestra ahora)": "Your token (shown only now)",
  "Generando…": "Generating…",
  "Generar token": "Generate token",

  // Revisar borrador
  "Este borrador ya se publicó.": "This draft was already published.",
  "Este borrador ya se descartó.": "This draft was already discarded.",
  "← Volver": "← Back",
  "Habitación": "Room",
  Casa: "House",
  Departamento: "Apartment",
  "Cabaña": "Cabin",
  "Viñedo": "Vineyard",
  "mismo teléfono": "same phone",
  "mismo enlace de origen": "same source link",
  "título casi igual en la misma ciudad": "nearly identical title in the same city",
  "¿Descartar este borrador?": "Discard this draft?",
  "Publicado ✓": "Published ✓",
  "Se creó la cuenta del anfitrión y su anuncio ya está en Cabibee.": "The host account was created and their listing is now on Cabibee.",
  "El anuncio se agregó a la cuenta.": "The listing was added to the account.",
  "Ver anuncio": "View listing",
  "Acceso del anfitrión (solo se muestra ahora)": "Host login (shown only now)",
  "Usuario:": "Username:",
  "Contraseña:": "Password:",
  "Si la pierdes, genera otra desde la cuenta. Mensaje listo para mandarle (en español):":
    "If you lose it, generate another from the account page. Ready-to-send message (in Spanish):",
  "Copiado ✓": "Copied ✓",
  "Copiar mensaje": "Copy message",
  "+ Otro anuncio para esta misma cuenta": "+ Another listing for this same account",
  "Ver cuenta": "View account",
  "Siguiente borrador →": "Next draft →",
  "Volver al inicio": "Back to home",
  "Revisar anuncio": "Review listing",
  "Capturas de pantalla": "Screenshots",
  Descartar: "Discard",
  "Posible duplicado": "Possible duplicate",
  "Fotos ({count})": "Photos ({count})",
  "· la primera es la portada": "· the first one is the cover",
  "Sin fotos. Se publicará con una imagen genérica.": "No photos. It will be published with a generic image.",
  Portada: "Cover",
  "Quitadas (clic para regresar):": "Removed (click to restore):",
  Anuncio: "Listing",
  "Título": "Title",
  "Descripción": "Description",
  Tipo: "Type",
  Espacio: "Space",
  "Espacio completo": "Entire place",
  "Habitación privada": "Private room",
  "Habitación compartida": "Shared room",
  Ciudad: "City",
  "Colonia / zona": "Neighborhood / area",
  Municipio: "Municipality",
  "Dirección (si se ve)": "Address (if visible)",
  "Huéspedes": "Guests",
  "Recámaras": "Bedrooms",
  "Baños": "Bathrooms",
  "Limpieza (MXN)": "Cleaning (MXN)",
  "Amenidades (separadas por coma)": "Amenities (comma-separated)",
  Mascotas: "Pets",
  Fumar: "Smoking",
  Fiestas: "Parties",
  "Niños": "Children",
  "Contacto que verán los huéspedes registrados": "Contact shown to registered guests",
  "Teléfono": "Phone",
  "¿De quién es la cuenta?": "Whose account is it?",
  "Cuenta nueva": "New account",
  "Agregar a una cuenta que ya creé": "Add to an account I already created",
  "Nombre del anfitrión": "Host name",
  "Correo real (opcional)": "Real email (optional)",
  "Si lo dejas vacío, el usuario será tipo juanperez4821": "Leave blank and the username will look like juanperez4821",
  "Se genera una contraseña temporal. Al entrar por primera vez, el dueño pone su correo y su propia contraseña.":
    "A temporary password is generated. On first login, the owner sets their own email and password.",
  "Crear cuenta y publicar": "Create account and publish",
  "Publicar en esa cuenta": "Publish to that account",
  "Después": "Later",

  // Cuenta
  "← Inicio": "← Home",
  "Tel.": "Tel.",
  "Creada {date}": "Created {date}",
  "Reclamada el {date}": "Claimed on {date}",
  "El dueño ya administra esta cuenta; ya no puedes cambiar su acceso ni agregarle anuncios.":
    "The owner now manages this account; you can no longer change its login or add listings to it.",
  Anuncios: "Listings",
  "+ Agregar anuncio con capturas": "+ Add listing from screenshots",
  "Con la extensión, abre el otro anuncio y elige esta cuenta en la pantalla de revisión.":
    "With the extension, open the other listing and pick this account on the review screen.",
  "/ noche": "/ night",
  Publicado: "Published",
  Oculto: "Hidden",
  "{views} vistas · {contacts} contactos vistos": "{views} views · {contacts} contacts viewed",
  "La contraseña temporal anterior dejará de funcionar. ¿Generar una nueva?":
    "The previous temporary password will stop working. Generate a new one?",
  "No se pudo.": "Couldn't do it.",
  "Generar contraseña temporal": "Generate temporary password",

  // APIs y lib de asociados
  "No encontrado.": "Not found.",
  "Solicitud inválida.": "Invalid request.",
  "Datos inválidos.": "Invalid data.",
  "Token inválido. Genera uno nuevo en Cabibee → Asociados → Extensión.":
    "Invalid token. Generate a new one in Cabibee → Associates → Extension.",
  "Falta configurar la API key de OpenAI en el servidor.": "The OpenAI API key isn't configured on the server.",
  "No se pudo leer lo que mandó la extensión.": "Couldn't read what the extension sent.",
  "Falta la URL de la página.": "The page URL is missing.",
  "La página casi no tiene texto. Abre el anuncio completo y vuelve a intentar.":
    "The page has almost no text. Open the full listing and try again.",
  "Formato no permitido: {name}. Usa JPEG, PNG o WebP.": "Format not allowed: {name}. Use JPEG, PNG or WebP.",
  "{name} pesa más de 8 MB.": "{name} is larger than 8 MB.",
  "Máximo {max} capturas por anuncio.": "Maximum {max} screenshots per listing.",
  "JSON inválido": "Invalid JSON",
  "Borrador no encontrado.": "Draft not found.",
  "Este borrador ya se procesó.": "This draft was already processed.",
  "El anuncio necesita título.": "The listing needs a title.",
  "Esa cuenta no es tuya o el dueño ya la reclamó.": "That account isn't yours or the owner already claimed it.",
  "Escribe el nombre del anfitrión.": "Enter the host's name.",
  "El correo no es válido.": "The email isn't valid.",
  "Ese correo ya tiene cuenta en Cabibee.": "That email already has a Cabibee account.",
  "No se encontró la ubicación en el mapa; el dueño puede ajustarla en el editor.":
    "The location wasn't found on the map; the owner can adjust it in the editor.",
  "No se encontraron fotos del inmueble en las capturas.": "No property photos were found in the screenshots.",
  "No llegaron fotos del inmueble. Abre la galería del anuncio y vuelve a importar.":
    "No property photos came through. Open the listing's gallery and import again.",

  // /claim-admin
  "No se pudo activar admin.": "Couldn't activate admin.",
  "Listo. Redirigiendo al panel de administración…": "Done. Redirecting to the admin panel…",
  "Error de red.": "Network error.",
  "Activar administrador": "Activate administrator",
  "Solo funciona si en Railway existe": "Only works if Railway has",
  "con el mismo correo de tu sesión actual.": "set to the same email as your current session.",
  "Activando…": "Activating…",
  "Hacerme administrador": "Make me an administrator",
  "Iniciar sesión con otra cuenta": "Sign in with another account",
  "URBNBEE_ADMIN_EMAIL no está definida en el servidor.": "URBNBEE_ADMIN_EMAIL isn't set on the server.",
  "Este correo no coincide con URBNBEE_ADMIN_EMAIL del servidor.": "This email doesn't match the server's URBNBEE_ADMIN_EMAIL.",
  "Usuario no encontrado.": "User not found.",

  // Meta diaria y estadísticas
  "Mis cuentas": "My accounts",
  Creada: "Created",
  "Hoy: {done} de {goal}": "Today: {done} of {goal}",
  "Hoy: {done}": "Today: {done}",
  "Hoy tocan": "Today's goal",
  "cuentas nuevas creadas hoy": "new accounts created today",
  "¡Meta del día cumplida! 🎉": "Daily goal reached! 🎉",
  "Te faltan {count} para la meta de hoy.": "{count} more to reach today's goal.",
  "Todavía no tienes meta diaria asignada.": "You don't have a daily goal yet.",
  "Importar con la extensión": "Import with the extension",
  "Últimos 14 días": "Last 14 days",
  "Verde: llegaste a la meta. Línea punteada: tu meta diaria.": "Green: goal reached. Dashed line: your daily goal.",
  "Cuentas nuevas por día.": "New accounts per day.",
  "Últimos 7 días": "Last 7 days",
  "Este mes": "This month",
  "Cuentas en total": "Total accounts",
  "Anuncios publicados": "Published listings",
  "Cumpliste la meta {count} de los últimos 30 días.": "You hit the goal on {count} of the last 30 days.",
  "{count} por aprobar": "{count} to approve",
  "Tu panel de asociado": "Your associate panel",
  "Panel asociado": "Associate panel",

  // Revisión del borrador
  "Lo rellenó la IA · Aprobar": "Filled by AI · Approve",
  "Aprobado ✓": "Approved ✓",
  "Usar «{value}»": "Use “{value}”",
  "No se pudo revisar con IA.": "Couldn't review with AI.",
  "Ver página original": "View original page",
  "Sin ubicación": "No location",
  "Aproximada:": "Approximate:",
  "huésp.": "guests",
  "rec.": "bedr.",
  baños: "baths",
  "Sin nombre": "No name",
  "Este borrador no guardó la página original. Vuelve a importarlo para poder revisarlo con IA.":
    "This draft didn't keep the original page. Import it again to review it with AI.",
  "La IA no devolvió una revisión válida.": "The AI didn't return a valid review.",
  "La IA está revisando… (1-2 min)": "AI is reviewing… (1-2 min)",
  "Volver a revisar con IA": "Review again with AI",
  "Revisar con IA": "Review with AI",
  "Revisión de la IA": "AI review",
  "Rellenó {count} campos (en rojo). Revísalos y apruébalos uno por uno.":
    "It filled {count} fields (in red). Check and approve them one by one.",
  "No encontró errores.": "No errors found.",
  "· la primera es la portada · obligatorias": "· the first one is the cover · required",
  "Sin fotos no se puede publicar. Vuelve a importar con la galería abierta.":
    "Can't publish without photos. Import again with the gallery open.",
  "Contacto del dueño (obligatorio)": "Owner contact (required)",
  "Al menos uno: teléfono, WhatsApp, correo o su Facebook. Se muestra en «Contactar» a quien tenga cuenta en Cabibee.":
    "At least one: phone, WhatsApp, email or their Facebook. It's shown under «Contact» to anyone with a Cabibee account.",
  "Sólo se aceptan enlaces de Facebook o Messenger. Este no se va a guardar.":
    "Only Facebook or Messenger links are accepted. This one won't be saved.",
  Abrir: "Open",
  "Ubicación (obligatoria)": "Location (required)",
  Aproximada: "Approximate",
  "Exacta (calle y número)": "Exact (street and number)",
  "Si el anuncio no trae calle y número, basta con la colonia o una referencia. El dueño completa la dirección exacta después.":
    "If the listing has no street and number, the neighborhood or a landmark is enough. The owner completes the exact address later.",
  "Calle y número exterior tal como vienen en el anuncio.": "Street and number as they appear in the listing.",
  "Ej. a dos cuadras del malecón, Col. Centro": "E.g. two blocks from the boardwalk, Col. Centro",
  "Nombre en la cuenta": "Name on the account",
  "Correo de contacto": "Contact email",
  WhatsApp: "WhatsApp",
  "Facebook del dueño": "Owner's Facebook",
  "Calle y número": "Street and number",
  "Ubicación aproximada": "Approximate location",
  Ubicación: "Location",
  "Campos de la IA aprobados": "AI fields approved",
  "Agrega al menos una foto del inmueble.": "Add at least one photo of the property.",
  "Falta el contacto del dueño: teléfono, WhatsApp, correo o su Facebook.":
    "The owner's contact is missing: phone, WhatsApp, email or their Facebook.",
  "Falta la ciudad.": "The city is missing.",
  "Escribe la colonia o una ubicación aproximada.": "Enter the neighborhood or an approximate location.",
  "Aprueba los campos que rellenó la IA (marcados en rojo).": "Approve the fields the AI filled (marked in red).",
  "No se encontró cómo contactar al dueño. Agrega su teléfono, correo o su Facebook antes de publicar.":
    "No way to contact the owner was found. Add their phone, email or Facebook before publishing.",

  // Agregar anuncio (link, texto, capturas, compartido desde Android)
  "Agregar anuncio": "Add listing",
  "+ Agregar anuncio": "+ Add listing",
  Celular: "Phone",
  Extensión: "Extension",
  "Desde el celular": "From your phone",
  "Compartir desde el celular": "Share from your phone",
  "Extensión para computadora": "Computer extension",
  "Pega el link del anuncio, su texto, sube capturas, o todo junto. Con más información la IA se equivoca menos. Después revisas el borrador antes de crear la cuenta.":
    "Paste the listing link, its text, upload screenshots, or all of them. The more information, the fewer AI mistakes. You review the draft before the account is created.",
  "Recibimos lo que compartiste. Revisa que esté completo y dale Analizar.":
    "We got what you shared. Check it's complete and tap Analyze.",
  "{n} archivos no se pudieron usar.": "{n} files couldn't be used.",
  "No llegó nada de lo compartido. Intenta de nuevo.": "Nothing came through from the share. Try again.",
  "Lo compartido ya no está disponible. Compártelo otra vez.": "The shared item is no longer available. Share it again.",
  "Link del anuncio": "Listing link",
  Pegar: "Paste",
  "No se pudo leer el portapapeles. Mantén presionado el campo y elige Pegar.":
    "Couldn't read the clipboard. Long-press the field and choose Paste.",
  "{site} no deja que Cabibee lea el anuncio con el puro link. Agrega capturas o pega el texto; el link queda como referencia.":
    "{site} doesn't let Cabibee read the listing from the link alone. Add screenshots or paste the text; the link is kept as a reference.",
  "{site}: con el puro link basta.": "{site}: the link alone is enough.",
  "¿Qué sitios funcionan con el puro link?": "Which sites work with just the link?",
  "Con el puro link": "Just the link",
  "Pega el link y toca Analizar: Cabibee lee el texto y las fotos.": "Paste the link and tap Analyze: Cabibee reads the text and photos.",
  "Con capturas, texto o la extensión": "With screenshots, text or the extension",
  "Bloquean a Cabibee: pega el link como referencia y agrega capturas o el texto. En computadora, la extensión de Chrome funciona en todos.":
    "They block Cabibee: paste the link as a reference and add screenshots or the text. On a computer, the Chrome extension works on all of them.",
  "¿Otro sitio? Prueba con el link; si no se puede leer, Cabibee te pide capturas.":
    "Another site? Try the link; if it can't be read, Cabibee will ask for screenshots.",
  "Ese sitio no deja que Cabibee lo abra.": "That site doesn't let Cabibee open it.",
  "El anuncio ya no existe en ese sitio.": "The listing no longer exists on that site.",
  "Trovit, Inmuebles24, Vivanuncios, Lamudi y otros bloquean a Cabibee: ahí comparte capturas como con Facebook.":
    "Trovit, Inmuebles24, Vivanuncios, Lamudi and others block Cabibee: there, share screenshots like with Facebook.",
  "Texto del anuncio (opcional)": "Listing text (optional)",
  "Copia y pega aquí la descripción, precio y contacto tal como aparecen en la publicación.":
    "Copy and paste the description, price and contact exactly as they appear in the post.",
  "Toca para elegir capturas de tu galería": "Tap to pick screenshots from your gallery",
  "Toma captura del texto, del precio, del contacto y de cada foto abierta en pantalla completa.":
    "Screenshot the text, the price, the contact and each photo opened full screen.",
  "Cargando las imágenes compartidas…": "Loading the shared images…",
  "Pega un link, el texto del anuncio o sube capturas.": "Paste a link, the listing text or upload screenshots.",
  "{site} no deja que Cabibee abra el link. Agrega capturas del anuncio o pega su texto.":
    "{site} doesn't let Cabibee open the link. Add screenshots of the listing or paste its text.",
  "{site} no deja que Cabibee abra el anuncio con el puro link. Agrega capturas del anuncio (texto y fotos) o pega también el texto de la publicación.":
    "{site} doesn't let Cabibee open the listing from the link alone. Add screenshots of the listing (text and photos) or also paste the post text.",
  "No se pudo leer ese link: {reason} Prueba subiendo capturas del anuncio o pegando su texto.":
    "Couldn't read that link: {reason} Try uploading screenshots of the listing or pasting its text.",
  "El link debe empezar con https://": "The link must start with https://",
  "El link no es válido.": "The link isn't valid.",
  "Ese link no es una página de anuncio.": "That link isn't a listing page.",
  "No existe esa página.": "That page doesn't exist.",
  "La página es demasiado grande.": "The page is too large.",
  "La página redirige demasiadas veces.": "The page redirects too many times.",
  "La página tardó demasiado en responder.": "The page took too long to respond.",
  "No se pudo abrir el link.": "Couldn't open the link.",
  "No existe.": "Not found.",
  "La extensión no está en el servidor.": "The extension isn't on the server.",

  // Celular
  "Manda anuncios a Cabibee sin copiar nada: desde Facebook o tu galería tocas Compartir y eliges Cabibee Asociados. Sólo funciona con tu sesión de asociado abierta.":
    "Send listings to Cabibee without copying anything: in Facebook or your gallery tap Share and choose Cabibee Associates. Only works while you're signed in as an associate.",
  "Tu sesión se había cerrado y lo que compartiste no se guardó. Ya entraste: compártelo otra vez.":
    "Your session had expired and what you shared wasn't saved. You're signed in now: share it again.",
  "1. Instala Cabibee Asociados": "1. Install Cabibee Associates",
  "Instalar Cabibee Asociados": "Install Cabibee Associates",
  "Si no aparece el botón: en Chrome toca ⋮ (arriba a la derecha) → Instalar app o Agregar a pantalla principal → Instalar.":
    "If the button doesn't show: in Chrome tap ⋮ (top right) → Install app or Add to Home screen → Install.",
  "Usa Chrome. Instálala desde esta página con tu sesión de asociado abierta; así la app sólo aparece en tu celular.":
    "Use Chrome. Install it from this page while signed in as an associate, so the app only appears on your phone.",
  "2. Compartir un anuncio de Facebook": "2. Share a Facebook listing",
  "Abre la publicación en Facebook o Marketplace.": "Open the post on Facebook or Marketplace.",
  "Toma capturas: el texto completo, el precio, el contacto y cada foto abierta en grande.":
    "Take screenshots: the full text, the price, the contact and each photo opened large.",
  "Toca Compartir → Más opciones → Cabibee Asociados. Se abre Cabibee con el link. (O toca Copiar enlace y pégalo en Agregar anuncio.)":
    "Tap Share → More options → Cabibee Associates. Cabibee opens with the link. (Or tap Copy link and paste it in Add listing.)",
  "Agrega las capturas en esa misma pantalla y toca Analizar.": "Add the screenshots on that same screen and tap Analyze.",
  "Más rápido: compartir las capturas desde la galería": "Faster: share the screenshots from your gallery",
  "En Fotos o Galería, mantén presionada una captura y marca las demás del mismo anuncio.":
    "In Photos or Gallery, long-press one screenshot and select the others from the same listing.",
  "Toca Compartir → Cabibee Asociados.": "Tap Share → Cabibee Associates.",
  "Cabibee se abre con las capturas cargadas: pega el link si lo tienes y toca Analizar.":
    "Cabibee opens with the screenshots loaded: paste the link if you have it and tap Analyze.",
  "Mercado Libre, Casas y Terrenos y Airbnb": "Mercado Libre, Casas y Terrenos and Airbnb",
  "En el anuncio toca Compartir → Cabibee Asociados (o copia el link).": "On the listing tap Share → Cabibee Associates (or copy the link).",
  "Con el puro link basta: Cabibee lee el texto y las fotos. Toca Analizar.":
    "The link alone is enough: Cabibee reads the text and photos. Tap Analyze.",
  "¿No ves Cabibee Asociados en Compartir? Desliza la fila de apps hasta el final o toca Más. Si la acabas de instalar, espera un minuto.":
    "Don't see Cabibee Associates in Share? Scroll the app row to the end or tap More. If you just installed it, wait a minute.",
  "En iPhone, Apple no deja que las apps web aparezcan en el menú Compartir. Usa Agregar anuncio: pega el link o el texto y sube capturas desde tu galería.":
    "On iPhone, Apple doesn't let web apps appear in the Share menu. Use Add listing: paste the link or text and upload screenshots from your gallery.",
  "Tener el panel como app en el iPhone": "Get the panel as an app on iPhone",
  "Abre esta página en Safari.": "Open this page in Safari.",
  "Toca Compartir (el cuadro con flecha) → Agregar a inicio → Agregar.": "Tap Share (the box with an arrow) → Add to Home Screen → Add.",
  "Abre Cabibee Asociados desde tu pantalla de inicio.": "Open Cabibee Associates from your home screen.",
  "Estás en una computadora. Para recibir anuncios desde el botón Compartir, abre esta misma página en tu celular Android con tu cuenta de asociado:":
    "You're on a computer. To receive listings from the Share button, open this same page on your Android phone with your associate account:",
  "En la computadora usa la": "On a computer use the",
  "extensión de Chrome": "Chrome extension",
  o: "or",
  "Ver los pasos para Android": "See the Android steps",
  "Instala Cabibee Asociados y mándale anuncios desde el botón Compartir de Facebook o de tu galería.":
    "Install Cabibee Associates and send it listings from the Share button in Facebook or your gallery.",
  "Ver cómo": "Show me how",
  "Ya estás en la app instalada. Ya puedes compartirle anuncios.": "You're in the installed app. You can share listings to it now.",
  "Listo, quedó instalada.": "Done, it's installed.",

  // Extensión
  "Extensión de Chrome (computadora)": "Chrome extension (computer)",
  "La extensión sólo funciona en Chrome, Edge o Brave de computadora. En el celular usa":
    "The extension only works in Chrome, Edge or Brave on a computer. On your phone use",
  "1. Descarga la extensión": "1. Download the extension",
  "Versión {v} · ya trae la dirección de Cabibee configurada.": "Version {v} · the Cabibee address is already set.",
  "No disponible en este servidor.": "Not available on this server.",
  "Descargar extensión": "Download extension",
  "3. Instálala en Chrome (una sola vez)": "3. Install it in Chrome (one time)",
  "Abre una pestaña nueva, pega esta dirección y da Enter:": "Open a new tab, paste this address and press Enter:",
  "En Edge es edge://extensions y en Brave brave://extensions.": "In Edge it's edge://extensions and in Brave brave://extensions.",
  "Arriba a la derecha activa": "At the top right turn on",
  "Clic en": "Click",
  "y elige la carpeta": "and choose the folder",
  "Clic en la pieza de rompecabezas 🧩 junto a la barra de direcciones y fija 📌 Cabibee para tenerla siempre a la mano.":
    "Click the puzzle piece 🧩 next to the address bar and pin 📌 Cabibee to keep it handy.",
  "Clic en el ícono de Cabibee, pega tu token (abajo) y Guardar. La dirección ya viene puesta.":
    "Click the Cabibee icon, paste your token (below) and Save. The address is already filled in.",
  "Chrome puede mostrar el aviso “Desactiva las extensiones en modo de desarrollador”: elige Conservar o ciérralo. Es normal porque la extensión no viene de la Chrome Web Store.":
    "Chrome may show “Disable developer mode extensions”: choose Keep or close it. It's normal because the extension isn't from the Chrome Web Store.",
  "4. Tu token": "4. Your token",
  "5. Úsala en cada anuncio": "5. Use it on each listing",
  "Abre el anuncio y pasa por todas las fotos de la galería para que carguen.":
    "Open the listing and go through every photo in the gallery so they load.",
  "Clic en el ícono de Cabibee →": "Click the Cabibee icon →",
  "Importar esta página": "Import this page",
  "Cuando el ícono muestre ✓, el borrador aparece en Inicio → Por revisar.":
    "When the icon shows ✓, the draft appears in Home → To review.",
  "Actualizar a una versión nueva": "Update to a new version",
  "Descarga el ZIP otra vez, descomprímelo, reemplaza con eso el contenido de tu carpeta cabibee-extension y en chrome://extensions da clic en ↻ (Recargar) en la tarjeta de Cabibee. Tu token se conserva.":
    "Download the ZIP again, unzip it, use it to replace the contents of your cabibee-extension folder and in chrome://extensions click ↻ (Reload) on the Cabibee card. Your token is kept.",
  "Ver contraseña": "Show password",
  "Acceso del asociado (después la ves en la tabla con «Ver contraseña»)":
    "Associate access (you can see it later in the table with “Show password”)",
  "Todavía no la tenemos: se guarda la próxima vez que el asociado inicie sesión o cambie su contraseña.":
    "We don't have it yet: it's saved the next time the associate signs in or changes their password.",
  "Como asociado, el administrador de Cabibee puede ver tu contraseña. No uses una que tengas en tu correo, banco u otros sitios.":
    "As an associate, the Cabibee administrator can see your password. Don't use one you use for your email, bank or other sites.",
  "2. Descomprime el archivo (obligatorio)": "2. Unzip the file (required)",
  "Chrome no puede usar el archivo .zip directo: primero hay que descomprimirlo.":
    "Chrome can't use the .zip file directly: you have to unzip it first.",
  "Abre tu carpeta Descargas y busca": "Open your Downloads folder and find",
  "clic derecho sobre el archivo → Extraer todo… → Extraer.": "right-click the file → Extract All… → Extract.",
  "doble clic sobre el archivo.": "double-click the file.",
  "Te queda una carpeta normal (sin cierre) llamada": "You get a regular folder (no zipper) called",
  "Ábrela y revisa que adentro esté el archivo": "Open it and check that it contains the file",
  "Mueve esa carpeta a un lugar fijo, por ejemplo Documentos. Si la borras, la extensión deja de funcionar.":
    "Move that folder to a fixed place, e.g. Documents. If you delete it, the extension stops working.",
  "que descomprimiste (la que tiene manifest.json adentro), no el archivo .zip.":
    "you unzipped (the one with manifest.json inside), not the .zip file.",
  "Si sale “Manifest file is missing or unreadable”: elegiste el .zip o una carpeta de más arriba. Entra a la carpeta hasta ver manifest.json y elige esa.":
    "If you get “Manifest file is missing or unreadable”: you picked the .zip or a folder too high up. Open folders until you see manifest.json and pick that one.",

  // Vista previa del borrador
  "Vista previa del anuncio": "Listing preview",
  "Vista previa · así lo verá la gente": "Preview · how people will see it",
  "Todavía no está publicado.": "Not published yet.",
  "Seguir editando": "Keep editing",
  "Falta para publicar:": "Still needed to publish:",
  "Tarjeta en resultados de búsqueda": "Card in search results",
  "Página del anuncio": "Listing page",
  "Sin descripción todavía.": "No description yet.",
  "Sin características.": "No amenities.",
  "{name} es anfitrión en Cabibee.": "{name} is a host on Cabibee.",
  "Las {n} fotos aparecen en la galería del anuncio. El mapa se arma al publicar con la ubicación.":
    "All {n} photos appear in the listing gallery. The map is built from the location when you publish.",
};
