// Modo inglés para grabar el vídeo del App Review.
//
// POR QUÉ ESTO Y NO i18n DE VERDAD
// --------------------------------
// Meta pide, textualmente, "usar el inglés como idioma de la interfaz de usuario
// de la aplicación". El producto es para pymes españolas y va a seguir siéndolo:
// montar `next-intl`, rutas `[locale]` y traducir las veinticinco pantallas del
// panel sería semanas de trabajo y una segunda versión de todo que mantener,
// para que la lea UNA persona UNA vez.
//
// Así que esto es un diccionario plano y una función. Cubre SOLO las pantallas
// que salen en la grabación: conectar, elegir cuenta, la bandeja de mensajes, y
// los rótulos que están en pantalla todo el rato (pestañas y cabecera). Todo lo
// demás sigue en español, y está bien que siga: no sale en el vídeo.
//
// SIN `?lang=en` NO CAMBIA NADA. `idiomaDe` devuelve "es" ante cualquier cosa
// que no sea exactamente "en", así que un cliente español no puede caer aquí ni
// por accidente.
//
// NO lleva "server-only" a propósito: lo importan tanto componentes de servidor
// como de cliente.

export type Idioma = "es" | "en";

/**
 * Galleta donde viaja el idioma mientras el usuario está en Instagram.
 *
 * La pone `/api/instagram/login` y la recoge el callback. Vive diez minutos, lo
 * mismo que el `state`, porque el viaje entero dura menos que eso.
 */
export const COOKIE_IDIOMA = "ig_login_lang";

export function idiomaDe(valor?: string | null): Idioma {
  return valor === "en" ? "en" : "es";
}

/**
 * Añade el idioma a un enlace, si hace falta.
 *
 * Los enlaces son el único sitio por el que se puede perder: las pestañas del
 * panel son estado de React y no tocan la URL, así que ahí el parámetro
 * sobrevive solo. Donde sí se sale de la aplicación —el botón que va a
 * Instagram— hay que arrastrarlo, y si se pierde a mitad de la grabación la toma
 * se va al traste.
 */
export function conIdioma(href: string, idioma: Idioma): string {
  if (idioma === "es") return href;
  return href.includes("?") ? `${href}&lang=en` : `${href}?lang=en`;
}

/** El locale que se le pasa a `toLocaleDateString` y compañía. */
export function localeDe(idioma: Idioma): string {
  return idioma === "en" ? "en-GB" : "es-ES";
}

type Par = { es: string; en: string };

const DIC = {
  // ---------------------------------------------------------------- pestañas
  tab_arranque: { es: "Empezar cuenta", en: "Get started" },
  tab_mensajes: { es: "Mensajes", en: "Messages" },
  tab_calendario: { es: "Calendario de posts", en: "Content calendar" },
  tab_comentarios: { es: "Comentarios → DM", en: "Comments → DM" },
  tab_historial: { es: "Historial", en: "History" },

  // ---------------------------------------------------------------- cabecera
  // Estos tres salen en pantalla TODO EL RATO, en las dos pantallas que se
  // graban. Dejarlos en español sería el primer sitio donde se le va la vista al
  // revisor, justo encima de lo que sí está traducido.
  cab_rol: { es: "INSTAGRAM Y REDES", en: "INSTAGRAM & SOCIAL" },
  cab_subtitulo: {
    es: "Genera y publica contenido para Instagram, LinkedIn y TikTok con el tono y la estrategia de tu negocio.",
    en: "Creates and publishes content for Instagram, LinkedIn and TikTok in your business's own voice and strategy.",
  },
  pausa_titulo: { es: "Publicación pausada por configuración", en: "Publishing is paused by configuration" },
  pausa_texto: {
    es: "El interruptor de publicación de Marta está apagado en producción. Las propuestas se generan y llegan a tu WhatsApp, pero al aprobar no se publica en Instagram hasta que se reactive.",
    en: "Marta's publishing switch is turned off in production. Drafts are still created and sent to your WhatsApp, but approving one won't post it to Instagram until publishing is switched back on.",
  },
  cab_conectada_como: { es: "✓ Conectada como", en: "✓ Connected as" },
  cab_aprobacion: { es: "aprobación en la app", en: "you approve in the app" },
  cab_tu_cuenta: { es: "tu cuenta", en: "your account" },

  aviso_sin_conectar_titulo: {
    es: "Todavía no has conectado tu Instagram",
    en: "You haven't connected your Instagram yet",
  },
  aviso_sin_conectar_texto: {
    es: "Marta puede preparar contenido, pero no podrá publicar ni contestar mensajes hasta que conectes la cuenta de tu negocio. Se hace una vez y se tarda un minuto.",
    en: "Marta can draft content, but she won't be able to post or reply to messages until you connect your business account. You only do this once, and it takes a minute.",
  },
  aviso_pendiente_titulo: {
    es: "Te falta confirmar tu cuenta de Instagram",
    en: "One step left: confirm your Instagram account",
  },
  aviso_pendiente_texto: {
    es: "Instagram ya nos ha dado permiso sobre {cuenta}. Solo falta que confirmes que es la cuenta correcta; hasta entonces Marta no publicará nada.",
    en: "Instagram has already granted access to {cuenta}. Just confirm it's the right account — until then, Marta won't post anything.",
  },
  aviso_boton_conectar: { es: "Conectar Instagram", en: "Connect Instagram" },
  aviso_boton_confirmar: { es: "Confirmar mi cuenta", en: "Confirm my account" },

  // ------------------------------------------------------- bloque de conectar
  paso_1: { es: "Paso 1", en: "Step 1" },
  conectar_titulo: { es: "Conectar Instagram", en: "Connect Instagram" },
  conectar_intro: {
    es: "Conecta la cuenta de Instagram de tu negocio para que Marta pueda contestar tus mensajes y publicar por ti.",
    en: "Connect your business Instagram account so Marta can reply to your messages and post on your behalf.",
  },
  conectar_boton: { es: "Conectar Instagram", en: "Connect Instagram" },
  conectar_boton_tip: {
    es: "Abre Instagram para que entres con tu cuenta y nos des permiso. Tu contraseña no pasa por AI-Team.",
    en: "Opens Instagram so you can sign in and grant access. Your password is never handled by AI-Team.",
  },
  conectar_nota_password: {
    es: "Se abrirá Instagram para que entres con tu cuenta y autorices. Tu contraseña no pasa por aquí en ningún momento.",
    en: "Instagram will open so you can sign in and authorise access. Your password never passes through AI-Team.",
  },
  permisos_titulo_previo: {
    es: "Qué te va a pedir Instagram, y para qué",
    en: "What Instagram will ask for, and why",
  },
  permisos_nota: {
    es: "Nada se publica sin que tú lo apruebes antes. Puedes desconectar la cuenta cuando quieras desde esta misma pantalla.",
    en: "Nothing is ever posted without your approval. You can disconnect the account at any time from this screen.",
  },

  scope_basic: {
    es: "Ver el nombre y la foto de tu cuenta, para saber que es la tuya.",
    en: "See your account name and profile picture, so we know it's really yours.",
  },
  scope_messages: {
    es: "Leer y contestar los mensajes privados que te llegan.",
    en: "Read and reply to the direct messages people send you.",
  },
  scope_comments: {
    es: "Leer los comentarios de tus publicaciones y responderlos.",
    en: "Read the comments on your posts and reply to them.",
  },
  scope_publish: {
    es: "Publicar en tu cuenta los posts que tú apruebes antes.",
    en: "Publish posts to your account, but only ones you've approved.",
  },

  // ---------------------------------------------------- elegir/confirmar cuenta
  elegir_etiqueta: { es: "Falta un paso", en: "One step left" },
  elegir_titulo: { es: "Confirma que esta es tu cuenta", en: "Confirm this is your account" },
  elegir_intro: {
    es: "Instagram nos ha dado permiso sobre la cuenta de abajo. Compruébalo y confírmalo para terminar. Hasta entonces Marta no publicará nada.",
    en: "Instagram has granted access to the account below. Check it and confirm to finish. Until you do, Marta won't post anything.",
  },
  elegir_sin_cuentas: {
    es: "Instagram no nos ha devuelto ninguna cuenta. Vuelve a empezar la conexión.",
    en: "Instagram didn't return any account. Please start the connection again.",
  },
  elegir_boton: { es: "Usar esta cuenta", en: "Use this account" },
  elegir_boton_tip: {
    es: "Confirma que esta es la cuenta de tu negocio. Marta empezará a usarla a partir de ahora.",
    en: "Confirms this is your business account. Marta will start using it from now on.",
  },
  elegir_otra: { es: "Elegir otra cuenta", en: "Choose a different account" },
  elegir_otra_tip: {
    es: "Descarta esta conexión y vuelve a empezar para elegir otra cuenta en Instagram.",
    en: "Discards this connection so you can pick a different account on Instagram.",
  },
  elegir_nota_cambio: {
    es: "Para cambiar de cuenta hay que volver a entrar en Instagram: el permiso que nos han dado es solo de la cuenta de arriba.",
    en: "To switch accounts you'll need to sign in to Instagram again — the access we've been granted covers only the account above.",
  },
  elegir_aviso_cache: {
    es: "No hemos podido comprobarlo con Instagram ahora mismo, así que enseñamos lo que nos dio al autorizar. Si el nombre no es el que esperas, elige otra cuenta.",
    en: "We couldn't reach Instagram just now, so we're showing what it gave us when you authorised. If this isn't the account you expected, choose a different one.",
  },
  aviso_no_empresa: {
    es: "Esta cuenta no es de empresa. Para que Marta pueda publicar, cámbiala a cuenta profesional en Instagram y vuelve a conectarla.",
    en: "This isn't a business account. For Marta to post, switch it to a professional account in Instagram and connect it again.",
  },

  // ------------------------------------------------------------ ficha conectada
  ficha_titulo: { es: "Cuenta de Instagram conectada", en: "Connected Instagram account" },
  ficha_sin_nombre: { es: "cuenta sin nombre", en: "unnamed account" },
  ficha_user_id: { es: "Instagram user ID:", en: "Instagram user ID:" },
  ficha_tipo: { es: "Tipo de cuenta:", en: "Account type:" },
  ficha_conectada: { es: "✓ Conectada", en: "✓ Connected" },
  ficha_desde: { es: "Conectada desde", en: "Connected since" },
  ficha_confirmada: { es: "Confirmada por ti el", en: "Confirmed by you on" },
  ficha_caduca: { es: "El permiso caduca", en: "Access expires" },
  ficha_quedan: { es: "· quedan {n} días", en: "· {n} days left" },
  ficha_queda_poco: {
    es: "Queda poco. Vuelve a conectar la cuenta para que Marta no se quede sin permiso.",
    en: "Not much time left. Reconnect the account so Marta doesn't lose access.",
  },
  ficha_permisos: { es: "Permisos concedidos", en: "Access granted" },
  ficha_reconectar: { es: "Volver a conectar", en: "Reconnect" },
  ficha_reconectar_tip: {
    es: "Vuelve a pasar por Instagram para renovar el permiso o cambiar de cuenta.",
    en: "Goes through Instagram again to renew access or switch to a different account.",
  },
  ficha_desconectar: { es: "Desconectar", en: "Disconnect" },
  ficha_desconectar_tip: {
    es: "Quita el acceso de AI-Team a esta cuenta. Marta dejará de publicar y de contestar.",
    en: "Revokes AI-Team's access to this account. Marta will stop posting and replying.",
  },
  ficha_nota_desconectar: {
    es: "Al desconectar, Marta deja de publicar y de contestar en esta cuenta. Tus publicaciones y tus mensajes de Instagram no se tocan.",
    en: "Disconnecting stops Marta posting and replying on this account. Your existing Instagram posts and messages are left untouched.",
  },

  // ---------------------------------------------------------- banners del OAuth
  banner_ok_titulo: { es: "Cuenta conectada", en: "Account connected" },
  banner_ok_texto: { es: "{cuenta} ya está conectada con Marta.", en: "{cuenta} is now connected to Marta." },
  banner_ok_generico: { es: "Tu cuenta", en: "Your account" },

  err_cancelado_t: { es: "No se ha completado la conexión", en: "The connection wasn't completed" },
  err_cancelado_x: {
    es: "Instagram no ha dado el permiso. Si has cerrado la ventana o has pulsado Cancelar, vuelve a intentarlo cuando quieras.",
    en: "Instagram didn't grant access. If you closed the window or pressed Cancel, you can try again whenever you like.",
  },
  err_credenciales_t: {
    es: "Esta instalación todavía no puede conectar con Instagram",
    en: "This installation can't connect to Instagram yet",
  },
  err_credenciales_x: {
    es: "Faltan las credenciales de la aplicación en el servidor. No es cosa tuya ni de tu cuenta: avísanos y lo dejamos listo.",
    en: "The app credentials are missing on the server. This isn't anything to do with your account — let us know and we'll sort it out.",
  },
  err_vuelta_t: { es: "La vuelta desde Instagram no ha llegado bien", en: "The return from Instagram didn't come through" },
  err_vuelta_x: {
    es: "Ha pasado demasiado tiempo entre que empezaste y volviste, o la conexión se abrió en otra ventana. Vuelve a pulsar el botón y hazlo del tirón.",
    en: "Too much time passed between starting and coming back, or the connection opened in another window. Press the button again and do it in one go.",
  },
  err_canje_t: { es: "Instagram no ha terminado de darnos el permiso", en: "Instagram didn't finish granting access" },
  err_canje_x: {
    es: "La autorización se ha quedado a medias. Vuelve a intentarlo; si se repite, dínoslo y lo miramos con el detalle que ha quedado guardado en el servidor.",
    en: "The authorisation stopped halfway. Please try again — if it keeps happening, tell us and we'll look at the details logged on the server.",
  },
  err_guardado_t: { es: "No se ha podido guardar la conexión", en: "We couldn't save the connection" },
  err_guardado_x: {
    es: "Instagram nos ha dado el permiso, pero no hemos podido guardarlo. Avísanos, es cosa nuestra.",
    en: "Instagram granted access, but we couldn't save it. Let us know — this one's on us.",
  },

  // ------------------------------------------------------------------- bandeja
  band_enviando_desde: { es: "Enviando desde", en: "Sending from" },
  band_vacia_titulo: { es: "Todavía no hay mensajes", en: "No messages yet" },
  band_vacia_texto: {
    es: "Aquí aparecerán los mensajes privados que te lleguen a {cuenta}. En cuanto alguien te escriba por Instagram, la conversación sale sola en esta lista.",
    en: "Direct messages sent to {cuenta} will show up here. As soon as someone messages you on Instagram, the conversation appears in this list.",
  },
  band_elige: { es: "Elige una conversación de la lista.", en: "Pick a conversation from the list." },
  band_cerrada: { es: "cerrada", en: "closed" },
  band_cerrada_tip: {
    es: "Fuera de la ventana de 24 horas: no se puede escribir hasta que vuelva a escribir esta persona.",
    en: "Outside the 24-hour window: you can't write until this person messages you again.",
  },
  band_tu: { es: "Tú", en: "You" },
  band_tu_prefijo: { es: "Tú: ", en: "You: " },
  band_cliente: { es: "Cliente", en: "Customer" },
  band_automatico: { es: "automático", en: "automated" },
  band_conversacion: { es: "Conversación", en: "Conversation" },
  band_escribe: { es: "Escribe tu respuesta…", en: "Write your reply…" },
  band_enviar: { es: "Enviar", en: "Send" },
  band_enviando: { es: "Enviando…", en: "Sending…" },
  band_enviar_tip: {
    es: "Envía este mensaje al usuario de Instagram desde tu cuenta conectada.",
    en: "Sends this message to the Instagram user from your connected account.",
  },
  band_quedan_horas: { es: "Puedes escribirle {n} h más", en: "You can reply for another {n} h" },
  band_enviado: { es: "Mensaje enviado.", en: "Message sent." },
  band_no_escribir: { es: "No se puede escribir ahora", en: "You can't write right now" },
  band_fuera_negrita: { es: "Han pasado más de 24 horas", en: "More than 24 hours have passed" },
  band_fuera_texto: {
    es: " desde el último mensaje de esta persona. Instagram solo deja escribir durante el día siguiente a que te escriban. En cuanto vuelva a mandarte algo, podrás contestarle desde aquí.",
    en: " since this person's last message. Instagram only lets you write for one day after someone messages you. As soon as they write again, you'll be able to reply from here.",
  },

  band_sin_conectar_t: {
    es: "Conecta tu Instagram para ver tus mensajes",
    en: "Connect your Instagram to see your messages",
  },
  band_sin_conectar_x: {
    es: "Los mensajes privados de tu cuenta de Instagram se leen y se contestan desde aquí. Primero hay que conectar la cuenta de tu negocio.",
    en: "This is where you read and reply to your Instagram direct messages. First you need to connect your business account.",
  },
  band_pendiente_t: { es: "Te falta confirmar tu cuenta", en: "One step left: confirm your account" },
  band_pendiente_x: {
    es: "Instagram ya nos ha dado permiso sobre {cuenta}. En cuanto confirmes que es la cuenta correcta, tus mensajes privados aparecerán aquí.",
    en: "Instagram has already granted access to {cuenta}. Once you confirm it's the right account, your direct messages will appear here.",
  },
  band_ir_arranque: { es: "Ir a Empezar cuenta", en: "Go to Get started" },

  // Motivos de fallo del envío, por código (ver `ResultadoEnvio.codigo`).
  envio_vacio: { es: "El mensaje está vacío.", en: "The message is empty." },
  envio_sin_cuenta: {
    es: "No hay ninguna cuenta de Instagram conectada y confirmada.",
    en: "There's no connected and confirmed Instagram account.",
  },
  envio_fuera_ventana: {
    es: "Han pasado más de 24 horas desde el último mensaje de esta persona. Instagram no deja escribirle hasta que vuelva a escribirte ella.",
    en: "More than 24 hours have passed since this person's last message. Instagram won't let you write to them until they message you again.",
  },
  envio_token: {
    es: "El permiso de Instagram ha dejado de valer. Vuelve a conectar la cuenta en «Empezar cuenta».",
    en: "Instagram access is no longer valid. Reconnect the account under “Get started”.",
  },
  envio_config: {
    es: "Esta instalación todavía no puede enviar mensajes: falta configuración en el servidor. No es cosa tuya, avísanos.",
    en: "This installation can't send messages yet: something is missing on the server. Not your fault — let us know.",
  },
  envio_generico: {
    es: "Instagram no ha aceptado el mensaje. Inténtalo otra vez en un momento.",
    en: "Instagram didn't accept the message. Please try again in a moment.",
  },
  envio_sesion: { es: "Tu sesión ha caducado. Vuelve a entrar.", en: "Your session has expired. Please sign in again." },
  envio_sin_destino: { es: "No se sabe a quién enviar.", en: "No recipient selected." },
} satisfies Record<string, Par>;

export type ClaveTexto = keyof typeof DIC;

/**
 * Devuelve la función de traducción del idioma pedido.
 *
 * Acepta sustituciones sencillas con `{nombre}`. No hay plurales ni géneros a
 * propósito: en cuanto haga falta eso, lo que hace falta es una librería, no
 * más código aquí.
 */
export function traductor(idioma: Idioma) {
  return function t(clave: ClaveTexto, vars?: Record<string, string | number>): string {
    let s: string = DIC[clave][idioma];
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
    return s;
  };
}

export type T = ReturnType<typeof traductor>;
