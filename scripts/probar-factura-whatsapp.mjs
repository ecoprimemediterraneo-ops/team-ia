#!/usr/bin/env node
// Prueba de punta a punta del camino que sostiene el módulo de gestoría:
// llega una foto por WhatsApp → aparece en la bandeja de facturas del gestor.
//
// POR QUÉ HACE FALTA: ese camino nunca se había ejecutado entero. El webhook
// devolvía 200 y ahí se acababa lo que se sabía. Un 200 en un webhook de Meta no
// significa que se haya hecho nada: significa que no ha explotado.
//
// QUÉ HACE
//   1. Levanta un Graph de mentira en el puerto 4545. Meta entrega los medios en
//      DOS pasos —primero una URL temporal, luego el binario con el token— y el
//      falso hace los dos igual.
//   2. Manda al webhook local un mensaje de imagen con la forma exacta que manda
//      Meta.
//   3. Mira si la factura ha aparecido en la bandeja del tenant que toca.
//   4. Repite con un audio, para comprobar que Pablo contesta en vez de callarse.
//
//   node scripts/probar-factura-whatsapp.mjs [--tenant tenant_demo_gestoria]
//
// EL SERVIDOR DE DESARROLLO TIENE QUE ESTAR LEVANTADO CON:
//   META_GRAPH_URL=http://127.0.0.1:4545 npm run dev
// (esa variable se ignora en Vercel a propósito, ver gestoria-adjuntos.ts)

import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";

const WEBHOOK = process.env.WEBHOOK_URL || "http://localhost:3000/api/pablo/webhook";
const PUERTO_STUB = 4545;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || "1189470684259465";
const REMITENTE = "34600111222";

const iTenant = process.argv.indexOf("--tenant");
const TENANT_ESPERADO = iTenant > -1 ? process.argv[iTenant + 1] : "tenant_demo_gestoria";

const MEDIA_ID = `PRUEBA-${Date.now()}`;
const FICHERO_FACTURAS = path.join(process.cwd(), "data", "gestoria-facturas.json");

// Un JPEG de verdad, 1x1 px. Tiene que serlo: el módulo mira el mime y el
// contenido, y un fichero de texto con la extensión cambiada no valdría.
const JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a" +
    "HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAA" +
    "AAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==",
  "base64",
);

const ok = (t) => console.log(`  \x1b[32m✓\x1b[0m ${t}`);
const mal = (t) => console.log(`  \x1b[31m✗\x1b[0m ${t}`);

// --- 1. El Graph de mentira -------------------------------------------------
const stub = http.createServer((req, res) => {
  const ruta = req.url.split("?")[0];
  if (ruta.startsWith("/bin/")) {
    res.writeHead(200, { "Content-Type": "image/jpeg", "Content-Length": JPEG.length });
    res.end(JPEG);
    return;
  }
  const id = ruta.slice(1);
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({
    id,
    url: `http://127.0.0.1:${PUERTO_STUB}/bin/${id}`,
    mime_type: "image/jpeg",
    file_size: JPEG.length,
  }));
});

await new Promise((r) => stub.listen(PUERTO_STUB, "127.0.0.1", r));
console.log(`Graph de mentira en http://127.0.0.1:${PUERTO_STUB}`);

const leerFacturas = async () => {
  try {
    return JSON.parse(await fs.readFile(FICHERO_FACTURAS, "utf-8"));
  } catch {
    return {};
  }
};

const enviar = async (mensaje) => {
  const cuerpo = {
    object: "whatsapp_business_account",
    entry: [{
      id: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || "1409997207694647",
      changes: [{
        field: "messages",
        value: {
          messaging_product: "whatsapp",
          metadata: { display_phone_number: "34722823703", phone_number_id: PHONE_NUMBER_ID },
          contacts: [{ profile: { name: "Jose Gestor" }, wa_id: REMITENTE }],
          messages: [mensaje],
        },
      }],
    }],
  };
  // Sin cabecera de firma: en local no hay App Secret y la comprobación está en
  // modo aviso. Si algún día se enciende el modo estricto, esta prueba tendrá
  // que firmar, y que falle es lo correcto.
  const res = await fetch(WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
  });
  return { status: res.status, texto: (await res.text()).slice(0, 200) };
};

let fallos = 0;

// --- 2. La foto -------------------------------------------------------------
console.log(`\nUNA FOTO DESDE ${REMITENTE} AL NÚMERO ${PHONE_NUMBER_ID}`);
const antes = (await leerFacturas())[TENANT_ESPERADO]?.length ?? 0;

const r1 = await enviar({
  from: REMITENTE,
  id: `wamid.PRUEBA.${MEDIA_ID}`,
  timestamp: String(Math.floor(Date.now() / 1000)),
  type: "image",
  image: { mime_type: "image/jpeg", sha256: "no-importa", id: MEDIA_ID },
});
r1.status === 200 ? ok(`el webhook responde 200`) : (mal(`el webhook responde ${r1.status}: ${r1.texto}`), fallos++);

// El webhook contesta antes de terminar de guardar.
await new Promise((r) => setTimeout(r, 2500));

const despues = await leerFacturas();
const lista = despues[TENANT_ESPERADO] ?? [];
const nueva = lista[lista.length - 1];

if (lista.length > antes && nueva) {
  ok(`la factura está en "${TENANT_ESPERADO}" (${antes} → ${lista.length})`);
  console.log(`      id ......... ${nueva.id}`);
  console.log(`      origen ..... ${nueva.origen}`);
  console.log(`      estado ..... ${nueva.estado}`);
  console.log(`      cliente .... ${nueva.cliente_id ?? "sin asignar"}`);
  console.log(`      remitente .. ${nueva.remitente ?? "—"}`);
  console.log(`      fichero .... ${nueva.fichero_url ?? "—"}`);

  if (nueva.estado === "sin_asignar") ok("entra SIN ASIGNAR, que es lo que se busca con un remitente desconocido");
  else { mal(`estado "${nueva.estado}", se esperaba "sin_asignar"`); fallos++; }
  if (nueva.origen === "whatsapp") ok("el origen queda marcado como WhatsApp");
  else { mal(`origen "${nueva.origen}"`); fallos++; }
} else {
  mal(`NO ha aparecido ninguna factura en "${TENANT_ESPERADO}"`);
  const otros = Object.entries(despues).map(([k, v]) => `${k}:${v.length}`).join(", ");
  console.log(`      lo que hay ahora mismo: ${otros || "nada"}`);
  fallos++;
}

// --- 3. El duplicado --------------------------------------------------------
// Meta reintenta el mismo mensaje cuando la respuesta tarda. Si no se corta, el
// gestor ve la misma factura tres veces y deja de fiarse de la bandeja.
console.log(`\nEL MISMO MENSAJE OTRA VEZ (Meta reintenta)`);
await enviar({
  from: REMITENTE,
  id: `wamid.PRUEBA.${MEDIA_ID}`,
  timestamp: String(Math.floor(Date.now() / 1000)),
  type: "image",
  image: { mime_type: "image/jpeg", sha256: "no-importa", id: MEDIA_ID },
});
await new Promise((r) => setTimeout(r, 1500));
const trasRepe = ((await leerFacturas())[TENANT_ESPERADO] ?? []).length;
if (trasRepe === lista.length) ok("no se duplica");
else { mal(`se ha duplicado: ${lista.length} → ${trasRepe}`); fallos++; }

// --- 4. El audio ------------------------------------------------------------
console.log(`\nUNA NOTA DE VOZ`);
const r3 = await enviar({
  from: REMITENTE,
  id: `wamid.AUDIO.${Date.now()}`,
  timestamp: String(Math.floor(Date.now() / 1000)),
  type: "audio",
  audio: { mime_type: "audio/ogg; codecs=opus", id: `AUDIO-${Date.now()}`, voice: true },
});
r3.status === 200 ? ok("el webhook responde 200") : (mal(`responde ${r3.status}`), fallos++);
console.log("      mira en el log del servidor que NO diga «mensaje no-texto ignorado: audio»;");
console.log("      tiene que intentar enviar la respuesta de que no escucha audios.");

stub.close();
console.log(fallos === 0 ? "\nTODO BIEN.\n" : `\n${fallos} FALLO(S).\n`);
process.exit(fallos === 0 ? 0 : 1);
