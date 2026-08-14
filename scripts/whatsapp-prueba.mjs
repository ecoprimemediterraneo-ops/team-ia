#!/usr/bin/env node
// Manda un WhatsApp de prueba desde el número de AI-Team, o cuenta cómo está la
// configuración. Sirve para saber si el número nuevo funciona ANTES de tocar
// nada del producto.
//
//   node scripts/whatsapp-prueba.mjs --estado
//   node scripts/whatsapp-prueba.mjs 34600111222
//   node scripts/whatsapp-prueba.mjs 34600111222 --texto "Hola desde AI-Team"
//   node scripts/whatsapp-prueba.mjs 34600111222 --plantilla gestoria_falta_factura
//
// Credenciales por entorno (nunca por parámetro, que quedan en el historial del
// shell y en los logs):
//   WHATSAPP_ACCESS_TOKEN         token con permiso whatsapp_business_messaging
//   WHATSAPP_PHONE_NUMBER_ID      id del número emisor
//   WHATSAPP_BUSINESS_ACCOUNT_ID  id de la WABA (solo para --estado)
//
// EL TOKEN NO SE IMPRIME NUNCA: ni entero, ni en trozos, ni en los errores. De
// él solo se dice si está y cuánto mide. Un token de WhatsApp filtrado deja
// escribir a cualquiera desde tu número de empresa.

const GRAPH = "https://graph.facebook.com/v21.0";

const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const tiene = (n) => args.includes(n);

const token = process.env.WHATSAPP_ACCESS_TOKEN;
const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;

const oculto = (v) => (v ? `puesto (${v.length} caracteres)` : "NO PUESTO");

if (!token || !phoneId) {
  console.error("Faltan credenciales.");
  console.error(`  WHATSAPP_ACCESS_TOKEN:    ${oculto(token)}`);
  console.error(`  WHATSAPP_PHONE_NUMBER_ID: ${phoneId || "NO PUESTO"}`);
  console.error("\nPonlas delante del comando, sin dejarlas en el historial:");
  console.error('  read -s WHATSAPP_ACCESS_TOKEN && export WHATSAPP_ACCESS_TOKEN');
  process.exit(1);
}

/**
 * Tapa el token en cualquier cosa que se vaya a imprimir.
 *
 * No es paranoia: Meta DEVUELVE EL TOKEN dentro de su propio mensaje de error
 * ("Malformed access token EAAxxxx…"). Imprimir `error.message` tal cual lo
 * filtraba a la consola y a cualquier log que recoja esa salida. Se tapa el
 * token exacto y, por si acaso, cualquier cadena con pinta de token de Meta.
 */
const limpiar = (t) =>
  String(t ?? "")
    .split(token).join("«token oculto»")
    .replace(/EAA[A-Za-z0-9_-]{10,}/g, "«token oculto»");

/** Llama a Graph y devuelve el resultado ya masticado. El token va en cabecera. */
async function graph(ruta, opciones = {}) {
  const res = await fetch(`${GRAPH}/${ruta}`, {
    ...opciones,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(opciones.headers ?? {}) },
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
}

// --- Estado de la configuración ---
if (tiene("--estado")) {
  console.log("CREDENCIALES");
  console.log(`  token ......... ${oculto(token)}`);
  console.log(`  número (id) ... ${phoneId}`);
  console.log(`  WABA .......... ${wabaId || "NO PUESTA"}`);

  const num = await graph(`${phoneId}?fields=display_phone_number,verified_name,quality_rating,platform_type`);
  console.log("\nNÚMERO EN META");
  if (num.ok) {
    console.log(`  teléfono ...... ${num.json.display_phone_number}`);
    console.log(`  nombre ........ ${num.json.verified_name}`);
    console.log(`  calidad ....... ${num.json.quality_rating ?? "—"}`);
  } else {
    console.log(`  ERROR ${num.status}: ${limpiar(num.json?.error?.message ?? "sin detalle")}`);
  }

  if (wabaId) {
    const pl = await graph(`${wabaId}/message_templates?fields=name,status,language,category&limit=50`);
    console.log("\nPLANTILLAS DE LA CUENTA");
    if (pl.ok) {
      for (const t of pl.json.data ?? []) {
        console.log(`  ${t.status === "APPROVED" ? "✓" : "·"} ${t.name} (${t.language}, ${t.category}) — ${t.status}`);
      }
      if (!(pl.json.data ?? []).length) console.log("  (ninguna)");
    } else {
      console.log(`  ERROR ${pl.status}: ${limpiar(pl.json?.error?.message ?? "sin detalle")}`);
    }

    const subs = await graph(`${wabaId}/subscribed_apps`);
    console.log("\nAPPS SUSCRITAS AL WEBHOOK DE ESTA CUENTA");
    if (subs.ok) {
      const apps = subs.json.data ?? [];
      if (!apps.length) console.log("  NINGUNA — el webhook no recibirá nada. Hay que suscribir la app a la WABA.");
      for (const a of apps) console.log(`  · ${a.whatsapp_business_api_data?.name ?? "?"} (id ${a.whatsapp_business_api_data?.id ?? "?"})`);
    } else {
      console.log(`  ERROR ${subs.status}: ${limpiar(subs.json?.error?.message ?? "sin detalle")}`);
    }
  }
  process.exit(0);
}

// --- Envío de prueba ---
const destino = (args.find((a) => /^\+?\d[\d\s]{6,}$/.test(a)) || "").replace(/\D/g, "");
if (!destino) {
  console.error("Dime a qué móvil, en formato internacional y sin +: 34600111222");
  process.exit(1);
}

const plantilla = flag("--plantilla");
const texto = flag("--texto") || "Prueba de AI-Team. Si lees esto, el número nuevo funciona.";

const cuerpo = plantilla
  ? {
      messaging_product: "whatsapp", recipient_type: "individual", to: destino, type: "template",
      template: {
        name: plantilla,
        language: { code: flag("--idioma") || "es" },
        // 5 variables de ejemplo, el orden de gestoria_falta_factura.
        components: [{ type: "body", parameters: [
          "Bar El Puerto", "Gestoría Márquez", "12 de agosto", "459,80 EUR", "RECIBOS VARIOS",
        ].map((t) => ({ type: "text", text: t })) }],
      },
    }
  : {
      messaging_product: "whatsapp", recipient_type: "individual", to: destino,
      type: "text", text: { body: texto, preview_url: false },
    };

console.log(`Enviando ${plantilla ? `plantilla "${plantilla}"` : "texto"} a ${destino} desde el número ${phoneId}…`);
const r = await graph(`${phoneId}/messages`, { method: "POST", body: JSON.stringify(cuerpo) });

if (r.ok) {
  console.log(`\n✓ ACEPTADO POR META · id del mensaje: ${r.json.messages?.[0]?.id ?? "—"}`);
  console.log("  Aceptado no es lo mismo que entregado: mira el móvil.");
  console.log("  Si no llega y el número está en modo desarrollo, el destinatario");
  console.log("  tiene que estar dado de alta como número de prueba en Meta.");
} else {
  const e = r.json?.error ?? {};
  console.log(`\n✗ RECHAZADO · HTTP ${r.status}`);
  console.log(`  ${limpiar(e.message ?? "sin mensaje")}`);
  if (e.code) console.log(`  código ${e.code}${e.error_subcode ? `/${e.error_subcode}` : ""}`);
  if (e.error_data?.details) console.log(`  detalle: ${limpiar(e.error_data.details)}`);
  if (e.fbtrace_id) console.log(`  fbtrace_id: ${e.fbtrace_id}  (dáselo a Meta si hay que abrir incidencia)`);
  if (e.code === 190) console.log("  → el token no vale o ha caducado.");
  if (e.code === 131030) console.log("  → el destinatario no está en la lista de números de prueba.");
  if (e.code === 132001) console.log("  → esa plantilla no existe o no está aprobada en esta cuenta.");
  process.exit(1);
}
