export const siteHostListings: Record<string, string> = {
  // Lista de alojamientos
  "Mis alojamientos": "My listings",
  "Edita fotos, descripción, ubicación y datos de contacto.": "Edit photos, description, location, and contact details.",
  "+ Nuevo": "+ New",
  "Aún no tienes alojamientos.": "You don't have any listings yet.",
  "Crea uno": "Create one",
  Publicado: "Published",
  Borrador: "Draft",
  Editar: "Edit",

  // Nuevo alojamiento
  "Nuevo alojamiento": "New listing",
  "Elige cómo quieres empezar.": "Choose how you want to get started.",
  "Creas un borrador vacío y completas fotos, descripción, ubicación y precio tú mismo.":
    "Start with a blank draft and add the photos, description, location, and price yourself.",
  "Continuar →": "Continue →",
  "Asistido con capturas": "Assisted with screenshots",
  "Sube capturas de pantalla de tu anuncio en otra plataforma. La IA prellena el borrador; tú revisas antes de publicar.":
    "Upload screenshots of your listing on another platform. AI pre-fills the draft; you review it before publishing.",
  "Usar capturas →": "Use screenshots →",
  "Importación con IA deshabilitada. Configura": "AI import is disabled. Set",
  "en el servidor.": "on the server.",
  "← Volver a mis alojamientos": "← Back to my listings",
  "Creando borrador…": "Creating draft…",
  "No se pudo crear": "Could not create the listing",
  "Error de red": "Network error",
  Volver: "Back",

  // Importar con capturas
  "Importar con capturas": "Import from screenshots",
  "Sube capturas de pantalla de": "Upload screenshots of",
  tu: "your",
  "anuncio (título, precio, amenidades, ubicación, etc.).": "listing (title, price, amenities, location, etc.).",
  "La IA solo configura el borrador con esa información; las fotos las subes tú en el editor.":
    "AI only sets up the draft with that information; you upload the photos yourself in the editor.",
  "Soy el anfitrión o tengo permiso para usar esta información. Las capturas son de mi anuncio. Revisaré los datos generados; la IA puede equivocarse. Subiré mis propias fotos en el editor.":
    "I'm the host or have permission to use this information. The screenshots are of my listing. I'll review the generated details, since AI can make mistakes. I'll upload my own photos in the editor.",
  "Arrastra capturas aquí o haz clic": "Drag screenshots here or click",
  "Hasta {max} imágenes · JPEG, PNG, WebP · máx. {mb} MB c/u": "Up to {max} images · JPEG, PNG, WebP · max {mb} MB each",
  Quitar: "Remove",
  "Notas opcionales": "Optional notes",
  "Ej. el precio en la captura es por semana, no por noche.": "E.g. the price in the screenshot is per week, not per night.",
  "Analizando capturas…": "Analyzing screenshots…",
  "Analizar y crear borrador": "Analyze and create draft",
  "Acepta las condiciones para continuar.": "Accept the terms to continue.",
  "Sube al menos una captura.": "Upload at least one screenshot.",
  "Respuesta inválida del servidor.": "Invalid server response.",
  "Error de red.": "Network error.",

  // Uso de IA
  "Uso de IA en esta importación": "AI usage for this import",
  "Estimación según tokens reportados por OpenAI (solo lectura de capturas, sin recorte de fotos).":
    "Estimate based on tokens reported by OpenAI (screenshot reading only, no photo cropping).",
  "{input} entrada + {output} salida =": "{input} input + {output} output =",
  "{n} tokens": "{n} tokens",
  "Total: {n} tokens": "Total: {n} tokens",
  "Extraer datos del anuncio (texto)": "Extract listing details (text)",

  // Errores de la API de importación
  "No autorizado.": "Unauthorized.",
  "La importación asistida no está habilitada en el servidor.": "Assisted import is not enabled on the server.",
  "No se pudo leer el formulario.": "Could not read the form.",
  "Debes aceptar las condiciones de uso.": "You must accept the terms of use.",
  "Sube al menos una captura (JPEG, PNG o WebP).": "Upload at least one screenshot (JPEG, PNG, or WebP).",
  "Máximo 6 imágenes por importación.": "Maximum 6 images per import.",
  "Cada imagen debe pesar menos de 5 MB.": "Each image must be under 5 MB.",
  "El total de imágenes supera el límite permitido.": "The total size of the images exceeds the allowed limit.",
  "No hay API key de OpenAI configurada (OPENAI_API_KEY o BLOG_BOT_OPENAI_API_KEY en Railway).":
    "No OpenAI API key is configured (OPENAI_API_KEY or BLOG_BOT_OPENAI_API_KEY on Railway).",
  "El modelo no devolvió contenido.": "The model returned no content.",
  "La respuesta no es JSON válido.": "The response is not valid JSON.",
  "La operación tardó demasiado. Prueba con menos capturas.": "The operation took too long. Try with fewer screenshots.",
  "La IA no devolvió un objeto JSON válido.": "The AI did not return a valid JSON object.",
  "No se pudo extraer un título del anuncio.": "Could not extract a title from the listing.",
  "JSON inválido": "Invalid JSON",
  "Sube tus propias fotos en la pestaña Fotos del editor.": "Upload your own photos in the editor's Photos tab.",
  "Revisa con cuidado los campos marcados con baja confianza (precio, ubicación, reglas).":
    "Carefully review the fields marked as low confidence (price, location, rules).",

  // Editor: general
  "Cargando editor…": "Loading editor…",
  "Este alojamiento no existe o el enlace es antiguo (por ejemplo, un borrador ya no guardado).":
    "This listing doesn't exist or the link is outdated (for example, a draft that was never saved).",
  "Abre la lista actualizada y edita el anuncio correcto.": "Open the updated list and edit the right listing.",
  "Ir a mis alojamientos": "Go to my listings",
  "Borrador generado con IA — revísalo antes de publicar": "AI-generated draft — review it before publishing",
  Entendido: "Got it",
  "Editar alojamiento": "Edit listing",
  "Slug público:": "Public slug:",
  "Publicado en el directorio": "Published in the directory",
  "Ver página pública →": "View public page →",
  Fotos: "Photos",
  Información: "Details",
  Ubicación: "Location",
  "Tu perfil y contacto": "Your profile and contact",
  Precio: "Price",
  "Comodidades y reglas": "Amenities and rules",
  Contrato: "Contract",
  "Viñedos / experiencias": "Vineyards / experiences",

  // Editor: avisos
  "Error al guardar": "Couldn't save",
  "Cambios guardados": "Changes saved",
  "Datos guardados": "Details saved",
  "Error al guardar perfil": "Couldn't save profile",
  "Perfil actualizado": "Profile updated",
  "No se pudo subir la foto": "Couldn't upload the photo",
  "Foto de perfil actualizada": "Profile photo updated",
  "No se pudo subir": "Couldn't upload",
  "Foto agregada": "Photo added",
  "¿Eliminar esta foto?": "Delete this photo?",
  "Completa calle, ciudad o país para buscar en el mapa.": "Enter a street, city, or country to search the map.",
  "No se encontró la dirección": "Address not found",
  "Ubicación encontrada. Revisa el mapa.": "Location found. Check the map.",
  "Coordenadas actualizadas.": "Coordinates updated.",
  "Usuario no encontrado.": "User not found.",
  "No encontrado.": "Not found.",
  "Archivo requerido.": "A file is required.",
  "La imagen supera 4 MB.": "The image is larger than 4 MB.",
  "La imagen supera 6 MB.": "The image is larger than 6 MB.",
  "Formato no permitido (JPG, PNG, WebP, GIF).": "Format not allowed (JPG, PNG, WebP, GIF).",
  "La insignia de verificado no se edita desde aquí: se obtiene verificando tu identidad en «Verificación».":
    "The verified badge can't be edited here: you get it by verifying your identity under “Verification”.",
  "Escribe al menos la dirección o la ciudad para buscar en el mapa.":
    "Enter at least the address or city to search the map.",
  "El servicio de mapas no respondió. Intenta de nuevo.": "The map service didn't respond. Please try again.",
  "No encontramos esa dirección. Revisa calle, colonia y ciudad, o ajusta lat/lng a mano.":
    "We couldn't find that address. Check the street, neighborhood, and city, or adjust lat/lng manually.",
  "Coordenadas inválidas en la respuesta.": "Invalid coordinates in the response.",
  "Error al geocodificar.": "Geocoding failed.",

  // Editor: fotos
  "La primera foto es la portada. Arrastra el orden con los botones.":
    "The first photo is the cover. Change the order with the buttons.",
  "Subiendo…": "Uploading…",
  "+ Subir foto": "+ Upload photo",
  Portada: "Cover",
  "Aún no hay fotos. Sube al menos una para publicar.": "No photos yet. Upload at least one to publish.",

  // Editor: información
  "Fotos del anuncio (vista previa)": "Listing photos (preview)",
  "Gestionar fotos →": "Manage photos →",
  "Aún no hay fotos.": "No photos yet.",
  "Ir a la pestaña Fotos para subirlas": "Go to the Photos tab to upload them",
  "Título del anuncio": "Listing title",
  Descripción: "Description",
  Categoría: "Category",
  "Tipo de espacio": "Type of place",
  "Ej. Espacio completo, Habitación privada…": "E.g. Entire place, Private room…",
  Huéspedes: "Guests",
  Recámaras: "Bedrooms",
  Baños: "Bathrooms",
  "Tamaño (opcional)": "Size (optional)",
  "Ej. 85 m²": "E.g. 85 m²",
  "¿Generar un nuevo enlace (slug) desde el título actual? Los enlaces antiguos dejarán de funcionar.":
    "Generate a new link (slug) from the current title? Old links will stop working.",
  "Regenerar URL amigable desde el título": "Regenerate friendly URL from the title",

  // Editor: ubicación
  "Dirección (no se muestra completa hasta la reserva)": "Address (not shown in full until booking)",
  Ciudad: "City",
  "Zona / barrio": "Area / neighborhood",
  "Estado / provincia": "State / province",
  País: "Country",
  "Mapa de ubicación": "Location map",
  "Usa el botón para colocar el pin según tu dirección; revisa que coincida con tu lugar y ajusta lat/lng si hace falta.":
    "Use the button to place the pin based on your address; check that it matches your place and adjust lat/lng if needed.",
  "Buscando…": "Searching…",
  "Centrar mapa según dirección": "Center map on address",
  "Abrir en Google Maps": "Open in Google Maps",
  "Vista previa del mapa": "Map preview",
  Latitud: "Latitude",
  Longitud: "Longitude",
  "El mapa usa Google Maps en vista incrustada (sin API propia). Si mueves lat/lng manualmente, el mapa se actualiza al guardar.":
    "The map uses an embedded Google Maps view (no API key of its own). If you change lat/lng manually, the map updates when you save.",

  // Editor: perfil y contacto
  "Correo de acceso:": "Login email:",
  "(solo para iniciar sesión). Los datos de abajo son los que verán los huéspedes.":
    "(for logging in only). The details below are what guests will see.",
  "Nombre público": "Public name",
  "Bio / sobre ti": "Bio / about you",
  "Foto de perfil (la ven los huéspedes)": "Profile photo (visible to guests)",
  "Tu foto de perfil": "Your profile photo",
  "Sin foto": "No photo",
  "No se pudo cargar": "Couldn't load",
  "Revisa la URL": "Check the URL",
  "Vista previa actual": "Current preview",
  "Subir imagen desde tu equipo": "Upload image from your device",
  "JPG, PNG, WebP o GIF · máx. 4 MB": "JPG, PNG, WebP, or GIF · max 4 MB",
  "O pega una URL de imagen": "Or paste an image URL",
  "URL guardada:": "Saved URL:",
  "Aún no hay URL de foto.": "No photo URL yet.",
  "WhatsApp (solo número, sin +)": "WhatsApp (number only, no +)",
  "Email de contacto público": "Public contact email",
  "Sitio web": "Website",
  "Tu Facebook (anuncio o perfil)": "Your Facebook (listing or profile)",

  // Editor: precio y reservas
  "Precio por noche (MXN)": "Price per night (MXN)",
  "Tarifa de limpieza (MXN)": "Cleaning fee (MXN)",
  Reservas: "Bookings",
  "El huésped debe tener cuenta e iniciar sesión; siempre paga el total estimado antes de que la reserva avance.":
    "Guests must have an account and be logged in; they always pay the estimated total before the booking moves forward.",
  "Validar cada solicitud": "Review each request",
  "Cuando aceptas, el huésped recibe el contrato, cómo pagarte y, si lo pediste, la liga del historial crediticio.":
    "When you accept, the guest gets the contract, how to pay you, and the credit-check link if you asked for one.",
  "Aceptación automática": "Instant Book",
  "Si paga con Stripe y el pago se confirma, la reserva queda aceptada sola. Tú no apruebas nada.":
    "If they pay with Stripe and the payment is confirmed, the booking is accepted on its own. You don't approve anything.",

  // Editor: comodidades y reglas
  Comodidades: "Amenities",
  Piscina: "Pool",
  "Desayuno incluido": "Breakfast included",
  "Mesa de comedor": "Dining table",
  Fumar: "Smoking",
  Mascotas: "Pets",
  "Fiestas / eventos": "Parties / events",
  Niños: "Children",
  Sí: "Yes",
  "Preguntar / no indicado": "Ask / not specified",

  // Editor: contrato
  "Contrato de cada reserva": "Contract for each booking",
  "Eliges la plantilla y pones tus datos. Al reservar, el huésped entra con el nombre, correo, teléfono y dirección de su cuenta. Ambos firman el mismo documento.":
    "Pick a template and add your details. When booking, the guest's name, email, phone, and address are filled in from their account. You both sign the same document.",
  "Reserva estándar": "Standard booking",
  "Estancias cortas. Fechas, montos, reglas de casa y cancelación simple.":
    "Short stays. Dates, amounts, house rules, and simple cancellation.",
  "Estancia media": "Mid-length stay",
  "Semanas o un mes. Más énfasis en uso de la vivienda y salida en orden.":
    "Weeks or a month. More emphasis on use of the home and an orderly checkout.",
  "Reserva con depósito": "Booking with deposit",
  "Igual que el estándar, más un depósito que pactas tú. Cabibee no lo guarda.":
    "Same as standard, plus a deposit you agree on. Cabibee doesn't hold it.",
  "Opcional. Si lo dejas en 0, el contrato dice que no hay depósito declarado.":
    "Optional. If you leave it at 0, the contract states that no deposit was declared.",
  "Recomendado si hay amenidades de valor. Cabibee no lo retiene.":
    "Recommended if there are valuable amenities. Cabibee doesn't hold it.",
  "Declara el monto. El dinero no pasa por Cabibee.": "State the amount. The money doesn't go through Cabibee.",
  "Tu nombre legal (firma)": "Your legal name (signature)",
  "Tu domicilio": "Your address",
  "Dirección del inmueble": "Property address",
  "Depósito pactado (MXN)": "Agreed deposit (MXN)",
  "Cláusulas tuyas (se suman a la plantilla)": "Your own clauses (added to the template)",
  "Cancelación (deja vacío para usar la de la plantilla)": "Cancellation (leave blank to use the template's)",
  "Confirmo esta plantilla y mis datos. En reservas de aceptación automática, esto cuenta como mi firma de oferta.":
    "I confirm this template and my details. For Instant Book reservations, this counts as my offer signature.",
};
