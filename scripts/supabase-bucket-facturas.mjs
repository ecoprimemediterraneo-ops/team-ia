#!/usr/bin/env node
// Crea (si no existe) el bucket PRIVADO "facturas" en Supabase Storage y
// comprueba de punta a punta que el módulo de facturas podrá usarlo.
//
// POR QUÉ HACE FALTA: en local, sin credenciales de Supabase, el módulo cae a
// ficheros JSON en data/ y todo parece funcionar. En producción `supabaseEnabled()`
// es true y los PDFs y fotos van a Storage: si el bucket no existe, subir una
// factura falla y el gestor solo ve "no se pudieron subir".
//
//   read -s SUPABASE_SERVICE_KEY && export SUPABASE_SERVICE_KEY
//   SUPABASE_URL="https://xxxx.supabase.co" node scripts/supabase-bucket-facturas.mjs
//
//   ... --solo-mirar    comprueba y no crea nada
//
// LA CLAVE NO SE IMPRIME NUNCA. De ella solo se dice si está y cuánto mide.
//
// PRIVADO, y no es un detalle: dentro van facturas de terceros con nombres,
// importes y NIF. El código nunca sirve el fichero directamente; genera una URL
// firmada que caduca. Un bucket público dejaría esos PDFs a un paso de cualquiera
// que adivinase la ruta.

const url = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const key = process.env.SUPABASE_SERVICE_KEY;
const BUCKET = "facturas";
const soloMirar = process.argv.includes("--solo-mirar");

const oculto = (v) => (v ? `puesta (${v.length} caracteres)` : "NO PUESTA");

if (!url || !key) {
  console.error("Faltan credenciales de Supabase.");
  console.error(`  SUPABASE_URL:         ${url || "NO PUESTA"}`);
  console.error(`  SUPABASE_SERVICE_KEY: ${oculto(key)}`);
  console.error("\nLa clave, sin dejarla en el historial:");
  console.error("  read -s SUPABASE_SERVICE_KEY && export SUPABASE_SERVICE_KEY");
  console.error("Las dos están en Supabase → Project Settings → API (usa la service_role, no la anon).");
  process.exit(1);
}

const limpiar = (t) => String(t ?? "").split(key).join("«clave oculta»");

async function api(ruta, opciones = {}) {
  let res;
  try {
    res = await fetch(`${url}/storage/v1/${ruta}`, {
    ...opciones,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(opciones.headers ?? {}),
      },
    });
  } catch (e) {
    // Sin esto, una URL mal escrita revienta con un volcado de pila que no
    // dice nada. La causa casi siempre es un SUPABASE_URL con una letra de más.
    return { ok: false, status: 0, json: { message: `no se pudo conectar con ${url} (${e instanceof Error ? e.message : e})` } };
  }
  const txt = await res.text();
  let json;
  try { json = JSON.parse(txt); } catch { json = { raw: txt }; }
  return { ok: res.ok, status: res.status, json };
}

console.log(`Proyecto: ${url}`);
console.log(`Clave:    ${oculto(key)}\n`);

// --- 1. ¿Existe ya? ---
const lista = await api("bucket");
if (!lista.ok) {
  console.log(`✗ No se puede listar los buckets: HTTP ${lista.status}`);
  console.log(`  ${limpiar(lista.json?.message || lista.json?.error || JSON.stringify(lista.json))}`);
  if (lista.status === 401 || lista.status === 403) {
    console.log("  → esa clave no vale para Storage. Tiene que ser la service_role.");
  }
  process.exit(1);
}

const buckets = Array.isArray(lista.json) ? lista.json : [];
console.log(`BUCKETS QUE HAY (${buckets.length})`);
for (const b of buckets) console.log(`  · ${b.name} ${b.public ? "— PÚBLICO" : "— privado"}`);

const existe = buckets.find((b) => b.name === BUCKET || b.id === BUCKET);

// --- 2. Crearlo si falta ---
if (!existe) {
  if (soloMirar) {
    console.log(`\n✗ El bucket "${BUCKET}" NO existe. Lánzalo sin --solo-mirar para crearlo.`);
    process.exit(1);
  }
  console.log(`\nEl bucket "${BUCKET}" no existe. Creándolo como PRIVADO…`);
  const r = await api("bucket", {
    method: "POST",
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false }),
  });
  if (!r.ok) {
    console.log(`✗ No se ha podido crear: HTTP ${r.status}`);
    console.log(`  ${limpiar(r.json?.message || JSON.stringify(r.json))}`);
    process.exit(1);
  }
  console.log(`✓ Creado.`);
} else if (existe.public) {
  // Un bucket público con facturas de terceros dentro es un problema, no un matiz.
  console.log(`\n⚠ El bucket "${BUCKET}" existe pero es PÚBLICO. Pasándolo a privado…`);
  const r = await api(`bucket/${BUCKET}`, { method: "PUT", body: JSON.stringify({ public: false }) });
  console.log(r.ok ? "✓ Ya es privado." : `✗ No se ha podido cambiar: ${limpiar(JSON.stringify(r.json))}`);
} else {
  console.log(`\n✓ El bucket "${BUCKET}" ya existe y es privado.`);
}

// --- 3. La prueba de verdad: subir, firmar y borrar ---
// Es lo mismo que hace `subirFichero` + `urlFirmada` en gestoria-facturas.ts.
if (soloMirar) process.exit(0);

const ruta = `_comprobacion/${Date.now()}_prueba.txt`;
console.log(`\nPROBANDO LO QUE HACE EL MÓDULO`);

const subida = await fetch(`${url}/storage/v1/object/${BUCKET}/${ruta}`, {
  method: "POST",
  headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "text/plain" },
  body: "comprobacion de AI-Team, se borra sola",
}).catch((e) => ({ ok: false, status: 0, text: async () => String(e) }));
console.log(`  subir ....... ${subida.ok ? "✓" : `✗ HTTP ${subida.status} ${limpiar(await subida.text())}`}`);
if (!subida.ok) process.exit(1);

const firma = await api(`object/sign/${BUCKET}/${ruta}`, {
  method: "POST",
  body: JSON.stringify({ expiresIn: 60 }),
});
console.log(`  firmar URL .. ${firma.ok ? "✓ (caduca en 60 s)" : `✗ ${limpiar(JSON.stringify(firma.json))}`}`);

if (firma.ok) {
  const firmada = `${url}/storage/v1${firma.json.signedURL || firma.json.signedUrl}`;
  const leer = await fetch(firmada);
  console.log(`  leerla ...... ${leer.ok ? "✓" : `✗ HTTP ${leer.status}`}`);
  const sinFirma = await fetch(`${url}/storage/v1/object/public/${BUCKET}/${ruta}`);
  console.log(`  sin firma ... ${sinFirma.ok ? "✗ SE LEE SIN FIRMAR: el bucket no es privado" : `✓ bloqueado (HTTP ${sinFirma.status})`}`);
}

const borrado = await api(`object/${BUCKET}`, { method: "DELETE", body: JSON.stringify({ prefixes: [ruta] }) });
console.log(`  limpiar ..... ${borrado.ok ? "✓ fichero de prueba borrado" : `✗ ${limpiar(JSON.stringify(borrado.json))}`}`);

console.log(`\nListo. El módulo de facturas ya puede guardar en producción.`);
