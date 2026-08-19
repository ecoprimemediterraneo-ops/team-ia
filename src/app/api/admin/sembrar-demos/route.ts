// Sembrar los negocios de ejemplo EN PRODUCCIÓN, comprobando que se han
// guardado de verdad.
//
// POR QUÉ NO BASTABA EL BOTÓN DE /admin/sectores: ese botón llama a
// `sembrarDemos()` y pinta "listo" sin volver a leer nada. Si la escritura se
// pierde —el disco de Vercel es de solo lectura fuera de /tmp, y `kvSet` no
// lanza excepción a propósito para no tumbar un webhook— la pantalla dice que
// ha ido bien y los cinco negocios siguen saliendo como "Todavía sin crear".
// Dos horas antes de una reunión eso no es un detalle.
//
// Aquí cada paso se ESCRIBE y se VUELVE A LEER. Lo que se devuelve es lo que
// hay en el almacén después, no lo que se ha intentado.
//
// AUTORIZACIÓN: la sesión de fundador, como el resto. Y además un token de
// arranque (`SETUP_TOKEN`) para poder ejecutarlo desde fuera del navegador
// mientras se monta la demostración. Si esa variable no existe, esa segunda
// puerta no existe: sin token no se compara nada.

import { NextResponse } from "next/server";
import { requireFounder } from "@/lib/admin-auth";
import { sembrarDemos } from "@/lib/sectores-demo";
import { listTenants, getTenant } from "@/lib/tenants";
import { resolverSector } from "@/lib/sectores";
import { listarExpedientes, guardarExpedientes, TRAMITES, type Expediente } from "@/lib/gestoria";
import { listarClientes } from "@/lib/gestoria-clientes";
import { kvGet, kvSet, kvDelete, supabaseEnabled } from "@/lib/supabase";
import { getBusinessBySlug } from "@/lib/booking";
import { guardarDesvio, leerDesvio } from "@/lib/gestoria-desvio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TENANT_DEMO = "tenant_demo_gestoria";
const BUCKET = "facturas";

async function autorizado(req: Request): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const esperado = process.env.SETUP_TOKEN || "";
  const dado = new URL(req.url).searchParams.get("token") || req.headers.get("x-setup-token") || "";
  // Fail-closed: sin variable puesta, la puerta del token no existe.
  if (esperado && dado && dado === esperado) return { ok: true };
  const f = await requireFounder();
  return f.ok ? { ok: true } : { ok: false, status: f.status, error: f.error };
}

function expedientesDeMuestra(tenantId: string): Expediente[] {
  const ahora = new Date().toISOString();
  const doc = (id: string, nombre: string) => ({ id, nombre, recibido: false });
  return [
    {
      id: "gxdemo1", tenantId, telefono: "600110011", clienteNombre: "Talleres Ruiz SL",
      tramite: "trimestrales", estado: "esperando_documentacion", periodo: "1T 2026",
      documentos: [doc("gxdemo1_d0", "facturas de gastos del trimestre"), doc("gxdemo1_d1", "extracto bancario")],
      creadoEn: ahora, actualizadoEn: ahora,
    },
    {
      id: "gxdemo2", tenantId, telefono: "600220022", clienteNombre: "Bar El Puerto",
      tramite: "trimestrales", estado: "en_curso", periodo: "1T 2026",
      documentos: [], creadoEn: ahora, actualizadoEn: ahora,
    },
    {
      id: "gxdemo3", tenantId, telefono: "600330033", clienteNombre: "María Ferrer",
      tramite: "renta", estado: "esperando_documentacion", periodo: "2025",
      documentos: [doc("gxdemo3_d0", "certificado de retenciones")],
      creadoEn: ahora, actualizadoEn: ahora,
    },
  ];
}

async function bucketFacturas(): Promise<string> {
  const url = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_KEY || "";
  if (!url || !key) return "sin credenciales de Supabase";
  const cab = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  const tapar = (t: string) => t.split(key).join("«clave oculta»").slice(0, 200);
  try {
    const lista = await fetch(`${url}/storage/v1/bucket`, { headers: cab, signal: AbortSignal.timeout(10_000) });
    const txt = await lista.text();
    if (!lista.ok) return `no se ha podido listar: HTTP ${lista.status} · ${tapar(txt)}`;
    const buckets = JSON.parse(txt) as Array<{ name: string; public: boolean }>;
    const f = buckets.find((b) => b.name === BUCKET);
    if (f) return f.public ? "existe pero es PÚBLICO — arréglalo en /api/admin/supabase-estado?crear=1" : "existe y es privado";
    const crear = await fetch(`${url}/storage/v1/bucket`, {
      method: "POST", headers: cab,
      body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false }),
      signal: AbortSignal.timeout(10_000),
    });
    return crear.ok ? "creado privado" : `NO se ha podido crear: HTTP ${crear.status} · ${tapar(await crear.text())}`;
  } catch (e) {
    return `fallo: ${e instanceof Error ? e.message : String(e)}`;
  }
}

export async function GET(req: Request) {
  const auth = await autorizado(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const pasos: Array<{ paso: string; ok: boolean; detalle: string }> = [];
  const anota = (paso: string, ok: boolean, detalle: string) => { pasos.push({ paso, ok, detalle }); return ok; };

  // --- 0. ¿Dónde se está escribiendo? --------------------------------------
  const host = (process.env.SUPABASE_URL || "").replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  anota(
    "Almacén",
    supabaseEnabled(),
    supabaseEnabled()
      ? `Supabase (${host})`
      : "NO HAY SUPABASE: se escribiría en disco, y en Vercel el disco es de solo lectura. Todo se perdería.",
  );

  // --- 1. ¿Se puede escribir de verdad? ------------------------------------
  // Escribir y volver a leer. Es la única prueba que vale: `kvSet` no lanza
  // excepción cuando falla, así que "no ha dado error" no significa nada.
  if (supabaseEnabled()) {
    const clave = "__prueba_escritura";
    const valor = { cuando: new Date().toISOString(), n: Math.floor(Math.random() * 1e9) };
    await kvSet(clave, valor);
    const vuelta = await kvGet<typeof valor>(clave);
    anota(
      "Escribir y volver a leer",
      vuelta?.n === valor.n,
      vuelta?.n === valor.n ? "el almacén guarda y devuelve lo guardado" : `se escribió pero al leer volvió: ${JSON.stringify(vuelta)}`,
    );
    await kvDelete(clave).catch(() => {});
  }

  // --- 2. Sembrar los negocios de ejemplo ----------------------------------
  const antes = (await listTenants()).map((t) => t.id);
  let sembrado: Awaited<ReturnType<typeof sembrarDemos>> = [];
  try {
    sembrado = await sembrarDemos();
    anota("Sembrar los 5 negocios", true, sembrado.map((s) => `${s.id}${s.creado ? " (nuevo)" : " (actualizado)"}`).join(", "));
  } catch (e) {
    anota("Sembrar los 5 negocios", false, e instanceof Error ? e.message : String(e));
  }

  // Lo que importa: LEERLOS OTRA VEZ.
  const despues = (await listTenants()).map((t) => t.id);
  const demoOk = !!(await getTenant(TENANT_DEMO));
  anota(
    `Comprobar que "${TENANT_DEMO}" está guardado`,
    demoOk,
    demoOk ? "sí, se lee después de escribirlo" : `NO. Tenants antes: [${antes.join(", ")}] · después: [${despues.join(", ")}]`,
  );

  // --- 2b. El negocio de reservas del tenant --------------------------------
  // Va por OTRA clave del almacén (`booking:configs`) y por otra función, así
  // que puede perderse aunque el tenant se haya guardado. Se comprueba aparte:
  // el tenant guardado y su negocio perdido es un panel a medias.
  const negocio = await getBusinessBySlug("demo-gestoria-marquez");
  anota(
    "Negocio de reservas de la gestoría",
    !!negocio,
    negocio
      ? `"${negocio.nombre}" con ${negocio.servicios?.length ?? 0} servicios`
      : "NO se lee después de escribirlo: la escritura de booking:configs se está perdiendo",
  );

  // --- 3. Clientes de la gestoría ------------------------------------------
  // Los clientes salen de los expedientes: sin ellos no hay a quién asignarle
  // una factura y el desplegable de la bandeja sale vacío.
  let clientes: Awaited<ReturnType<typeof listarClientes>> = [];
  if (demoOk) {
    const previos = await listarExpedientes(TENANT_DEMO);
    if (!previos.length) {
      await guardarExpedientes(TENANT_DEMO, expedientesDeMuestra(TENANT_DEMO));
    }
    const ahora = await listarExpedientes(TENANT_DEMO);
    clientes = await listarClientes(TENANT_DEMO);
    anota(
      "Clientes de la gestoría",
      clientes.length > 0,
      clientes.length
        ? `${ahora.length} expedientes → ${clientes.map((c) => c.nombre).join(", ")}`
        : "se guardaron los expedientes pero al leerlos no hay ninguno",
    );
  }

  // --- 4. Dónde se guardan los ficheros ------------------------------------
  const bucket = await bucketFacturas();
  anota("Bucket privado de facturas", bucket.includes("privado"), bucket);

  // --- 5. El desvío de adjuntos --------------------------------------------
  // Se deja puesto aquí mismo: dejarlo como un paso suelto a mano es lo que
  // hace que el día de la demostración falte justo eso.
  if (demoOk) {
    const yaEsta = await leerDesvio();
    if (!yaEsta?.activo || yaEsta.tenantId !== TENANT_DEMO) {
      await guardarDesvio({
        phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || "1189470684259465",
        tenantId: TENANT_DEMO,
        activo: true,
        puesto_en: new Date().toISOString(),
        nota: "Puente mientras la gestoría no tiene su propio número de WhatsApp.",
      });
    }
    const ahora = await leerDesvio();
    anota(
      "Desvío de adjuntos",
      !!ahora?.activo && ahora.tenantId === TENANT_DEMO,
      ahora?.activo ? `los adjuntos de ${ahora.phoneNumberId} van a ${ahora.tenantId}` : "no se ha podido dejar puesto",
    );
  }

  const gestorias = (await listTenants())
    .filter((t) => resolverSector(t) === "gestoria")
    .map((t) => ({ id: t.id, nombre: t.name }));

  const fallos = pasos.filter((p) => !p.ok);

  return NextResponse.json({
    veredicto: fallos.length
      ? `NO ESTÁ LISTO. Ha fallado: ${fallos.map((f) => f.paso).join(" · ")}.`
      : "LISTO. La gestoría de demostración existe, tiene clientes y hay dónde guardar los ficheros.",
    comprobacion: pasos.map((p) => `${p.ok ? "✓" : "✗"} ${p.paso}: ${p.detalle}`),
    gestorias,
    clientes: clientes.map((c) => `${c.nombre} (${c.telefono})`),
    tramitesConTarifa: TRAMITES.map((t) => `${t.nombre} · ${t.precioEUR} €`),
    siguiente: fallos.length
      ? "Mira qué paso ha fallado arriba."
      : `Enciende el desvío en /api/admin/gestoria-desvio?tenant=${TENANT_DEMO} y manda la foto.`,
  });
}
