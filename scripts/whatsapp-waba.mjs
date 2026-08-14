#!/usr/bin/env node
// Diagnóstico y arreglo de la suscripción de la app a una cuenta de WhatsApp
// Business (WABA).
//
// EL FALLO QUE ARREGLA: al cambiar de número, la app queda configurada (URL del
// webhook verificada, campos suscritos) pero NO suscrita a la WABA nueva. La
// suscripción es de la app A CADA WABA por separado y no se hereda: en Meta todo
// se ve verde y al webhook no llega ni una petición. Es el paso que se olvida.
//
//   node scripts/whatsapp-waba.mjs --estado
//   node scripts/whatsapp-waba.mjs --suscribir
//
// Credenciales por entorno, nunca por parámetro:
//   WHATSAPP_ACCESS_TOKEN         token con whatsapp_business_management
//                                 y whatsapp_business_messaging sobre la WABA
//   WHATSAPP_BUSINESS_ACCOUNT_ID  WABA (por defecto, la nueva)
//   WHATSAPP_PHONE_NUMBER_ID      número emisor (por defecto, el nuevo)
//
// EL TOKEN NO SE IMPRIME NUNCA. Ni entero, ni troceado, ni en los errores.

const GRAPH = "https://graph.facebook.com/v21.0";

const token = process.env.WHATSAPP_ACCESS_TOKEN;
const waba = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || "1409997207694647";
const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || "1189470684259465";
const args = process.argv.slice(2);
const tiene = (n) => args.includes(n);

if (!token) {
  console.error("Falta WHATSAPP_ACCESS_TOKEN.");
  console.error("Pásalo sin que quede en el historial:");
  console.error("  read -s WHATSAPP_ACCESS_TOKEN && export WHATSAPP_ACCESS_TOKEN");
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

/** Llama a Graph. Devuelve el error de Meta ENTERO, que es lo que hace falta. */
async function graph(ruta, opciones = {}) {
  const res = await fetch(`${GRAPH}/${ruta}`, {
    ...opciones,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(opciones.headers ?? {}) },
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
}

function pintarError(r) {
  const e = r.json?.error ?? {};
  console.log(`   ✗ HTTP ${r.status}`);
  console.log(`     mensaje ....: ${limpiar(e.message ?? "(sin mensaje)")}`);
  console.log(`     tipo .......: ${e.type ?? "—"}`);
  console.log(`     código .....: ${e.code ?? "—"}${e.error_subcode ? ` / subcódigo ${e.error_subcode}` : ""}`);
  if (e.error_user_title) console.log(`     título .....: ${limpiar(e.error_user_title)}`);
  if (e.error_user_msg) console.log(`     explicación : ${limpiar(e.error_user_msg)}`);
  if (e.error_data?.details) console.log(`     detalle ....: ${limpiar(e.error_data.details)}`);
  console.log(`     fbtrace_id .: ${e.fbtrace_id ?? "—"}`);
  if (e.code === 190) console.log("     → el token no vale o ha caducado.");
  if (e.code === 200 || e.code === 10) console.log("     → al token le falta permiso sobre esta cuenta (whatsapp_business_management).");
  if (e.code === 100) console.log("     → el id no existe o el token no lo ve.");
}

async function verSuscripcion() {
  console.log(`\n1. APPS SUSCRITAS A LA WABA ${waba}`);
  const r = await graph(`${waba}/subscribed_apps`);
  if (!r.ok) { pintarError(r); return null; }
  const apps = r.json.data ?? [];
  if (!apps.length) {
    console.log("   (ninguna) ← ESTE ES EL FALLO: sin app suscrita, Meta no manda nada al webhook.");
    return [];
  }
  for (const a of apps) {
    const d = a.whatsapp_business_api_data ?? {};
    console.log(`   · ${d.name ?? "?"} · id ${d.id ?? "?"}${d.link ? ` · ${d.link}` : ""}`);
  }
  return apps;
}

async function verNumero() {
  console.log(`\n3. NÚMERO ${phoneId} EN CLOUD API`);
  const r = await graph(
    `${phoneId}?fields=display_phone_number,verified_name,status,name_status,quality_rating,code_verification_status,platform_type,throughput`,
  );
  if (!r.ok) { pintarError(r); return; }
  const n = r.json;
  console.log(`   teléfono ..............: ${n.display_phone_number ?? "—"}`);
  console.log(`   nombre para mostrar ...: ${n.verified_name ?? "—"}`);
  console.log(`   status ................: ${n.status ?? "—"}`);
  console.log(`   name_status ...........: ${n.name_status ?? "—"}`);
  console.log(`   quality_rating ........: ${n.quality_rating ?? "—"}`);
  console.log(`   verificación del código: ${n.code_verification_status ?? "—"}`);
  console.log(`   plataforma ............: ${n.platform_type ?? "—"}`);
  if (n.status && n.status !== "CONNECTED") {
    console.log("   → el número NO está conectado a Cloud API. Hace falta");
    console.log("     POST /" + phoneId + "/register con el PIN de verificación en dos pasos.");
    console.log("     Ese PIN lo tienes tú: no lo inventes ni lo pruebes a ciegas,");
    console.log("     que a los intentos fallidos Meta bloquea el registro.");
  }
}

async function verPlantillas() {
  console.log(`\n4a. PLANTILLAS DE ESTA WABA`);
  const r = await graph(`${waba}/message_templates?fields=name,status,language,category&limit=100`);
  if (!r.ok) { pintarError(r); return; }
  const ts = r.json.data ?? [];
  if (!ts.length) {
    console.log("   (ninguna) ← las plantillas NO se migran entre cuentas: hay que volver a crearlas y que Meta las apruebe.");
    return;
  }
  for (const t of ts) console.log(`   ${t.status === "APPROVED" ? "✓" : "·"} ${t.name} (${t.language}, ${t.category}) — ${t.status}`);
  const faltan = ["gestoria_falta_factura", "aviso_dueno_cita"].filter((n) => !ts.some((t) => t.name === n));
  if (faltan.length) console.log(`   OJO: el código usa plantillas que aquí no están: ${faltan.join(", ")}`);
}

async function verNumerosDeLaWaba() {
  console.log(`\n4b. NÚMEROS DE ESTA WABA`);
  const r = await graph(`${waba}/phone_numbers?fields=display_phone_number,verified_name,status,quality_rating`);
  if (!r.ok) { pintarError(r); return; }
  for (const n of r.json.data ?? []) {
    console.log(`   · ${n.display_phone_number} · ${n.verified_name ?? "—"} · status ${n.status ?? "—"} · id ${n.id}`);
  }
}

console.log("=".repeat(72));
console.log(`WABA ${waba} · número ${phoneId}`);
console.log(`token: puesto (${token.length} caracteres)`);
console.log("=".repeat(72));

const antes = await verSuscripcion();

if (tiene("--suscribir")) {
  console.log(`\n2. SUSCRIBIENDO LA APP A LA WABA ${waba}`);
  const r = await graph(`${waba}/subscribed_apps`, { method: "POST" });
  if (!r.ok) {
    pintarError(r);
  } else {
    console.log(`   ✓ respuesta de Meta: ${limpiar(JSON.stringify(r.json))}`);
    console.log("\n   Volviendo a consultar para confirmar…");
    const despues = await verSuscripcion();
    if (despues?.length) console.log("\n   ✓ CONFIRMADO: la app ya está suscrita a esta WABA.");
    else console.log("\n   ✗ Sigue sin aparecer. Mira el error de arriba.");
  }
} else if (antes && !antes.length) {
  console.log("\n2. (no se ha suscrito nada: vuelve a lanzarlo con --suscribir)");
}

await verNumero();
await verPlantillas();
await verNumerosDeLaWaba();

console.log(`
${"=".repeat(72)}
LO QUE NO SE MIGRA AL CAMBIAR DE CUENTA, y hay que rehacer:
  · La suscripción de la app a la WABA  ← lo de arriba
  · Las plantillas: se aprueban por cuenta, no por app
  · El registro del número en Cloud API (PIN de verificación en dos pasos)
  · Los destinatarios de prueba, si la app sigue en modo Desarrollo
Y una que no se ve por API: si la app está en modo DESARROLLO, solo llegan
mensajes de gente con un rol en la app. Con el número de prueba no se nota
—Meta te da 5 destinatarios de prueba— y con el número real deja el webhook
mudo. Se mira en Meta → Configuración de la app → arriba, Desarrollo/Activo.`);
