// Repaso de todo lo que hace falta para que el módulo de gestoría funcione EN
// PRODUCCIÓN. Founder-only.
//
//   GET             mira y dice qué falta. No toca nada.
//   GET ?preparar=1 deja lista la gestoría de demostración: la crea si no está,
//                   le da clientes si no tiene y se asegura del bucket.
//
// POR QUÉ EXISTE: la carpeta `data/` no viaja al despliegue. Todo lo que se
// sembró en local —los tenants de ejemplo, sus expedientes, sus facturas— existe
// solo en la máquina de quien lo sembró. En producción no había NI UNA gestoría,
// y eso solo se descubrió al abrir el desvío y ver la lista vacía. Un módulo
// entero que en local funciona y en producción no tiene dónde caerse.
//
// Así que en vez de mirar pieza a pieza, se pregunta de una vez: ¿hay gestoría?,
// ¿tiene clientes?, ¿hay dónde guardar los ficheros?, ¿está puesto el desvío?

import { NextResponse } from "next/server";
import { requireFounder } from "@/lib/admin-auth";
import { listTenants, getTenant } from "@/lib/tenants";
import { resolverSector } from "@/lib/sectores";
import { sembrarDemos } from "@/lib/sectores-demo";
import { listarExpedientes, guardarExpedientes, type Expediente } from "@/lib/gestoria";
import { listarClientes } from "@/lib/gestoria-clientes";
import { leerDesvio } from "@/lib/gestoria-desvio";
import { supabaseEnabled } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TENANT_DEMO = "tenant_demo_gestoria";
const BUCKET = "facturas";

/** Los tres clientes con los que se enseña el módulo. Mismos que en local. */
function expedientesDeMuestra(tenantId: string): Expediente[] {
  const ahora = new Date().toISOString();
  const base = (n: number) => ({
    tenantId,
    documentos: [] as Expediente["documentos"],
    creadoEn: ahora,
    actualizadoEn: ahora,
    id: `gxdemo${n}`,
  });
  return [
    {
      ...base(1),
      telefono: "600110011",
      clienteNombre: "Talleres Ruiz SL",
      tramite: "trimestrales",
      estado: "esperando_documentacion",
      periodo: "1T 2026",
      documentos: [
        { id: "gxdemo1_d0", nombre: "facturas de gastos del trimestre", recibido: false },
        { id: "gxdemo1_d1", nombre: "extracto bancario", recibido: false },
      ],
    },
    {
      ...base(2),
      telefono: "600220022",
      clienteNombre: "Bar El Puerto",
      tramite: "trimestrales",
      estado: "en_curso",
      periodo: "1T 2026",
    },
    {
      ...base(3),
      telefono: "600330033",
      clienteNombre: "María Ferrer",
      tramite: "renta",
      estado: "esperando_documentacion",
      periodo: "2025",
      documentos: [{ id: "gxdemo3_d0", nombre: "certificado de retenciones", recibido: false }],
    },
  ];
}

/** Lista los buckets de Storage. Nunca devuelve la clave. */
async function buckets(): Promise<{ ok: boolean; lista: Array<{ name: string; public: boolean }>; error?: string }> {
  const url = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_KEY || "";
  if (!url || !key) return { ok: false, lista: [], error: "sin credenciales de Supabase" };
  try {
    const res = await fetch(`${url}/storage/v1/bucket`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(10_000),
    });
    const txt = (await res.text()).split(key).join("«clave oculta»");
    if (!res.ok) return { ok: false, lista: [], error: `HTTP ${res.status} · ${txt.slice(0, 200)}` };
    return { ok: true, lista: JSON.parse(txt) as Array<{ name: string; public: boolean }> };
  } catch (e) {
    return { ok: false, lista: [], error: e instanceof Error ? e.message : String(e) };
  }
}

async function crearBucket(): Promise<string> {
  const url = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_KEY || "";
  try {
    const res = await fetch(`${url}/storage/v1/bucket`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false }),
      signal: AbortSignal.timeout(10_000),
    });
    const txt = (await res.text()).split(key).join("«clave oculta»");
    return res.ok ? "creado privado" : `NO se ha podido crear: HTTP ${res.status} · ${txt.slice(0, 160)}`;
  } catch (e) {
    return `NO se ha podido crear: ${e instanceof Error ? e.message : String(e)}`;
  }
}

export async function GET(req: Request) {
  const auth = await requireFounder();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const preparar = new URL(req.url).searchParams.get("preparar") === "1";
  const hecho: string[] = [];

  // --- 1. ¿Hay alguna gestoría? --------------------------------------------
  let gestorias = (await listTenants()).filter((t) => resolverSector(t) === "gestoria");
  if (!gestorias.length && preparar) {
    const r = await sembrarDemos();
    hecho.push(`Creados los negocios de ejemplo: ${r.filter((x) => x.creado).length} nuevos, ${r.filter((x) => !x.creado).length} actualizados.`);
    gestorias = (await listTenants()).filter((t) => resolverSector(t) === "gestoria");
  }

  // --- 2. ¿Tiene clientes? --------------------------------------------------
  // Los clientes de una gestoría SALEN de sus expedientes. Sin expedientes no
  // hay a quién asignarle una factura, y la bandeja de sin asignar no sirve de
  // nada porque el desplegable de asignar sale vacío.
  const demo = await getTenant(TENANT_DEMO);
  let clientes = demo ? await listarClientes(TENANT_DEMO) : [];
  if (demo && !clientes.length && preparar) {
    const previos = await listarExpedientes(TENANT_DEMO);
    await guardarExpedientes(TENANT_DEMO, [...previos, ...expedientesDeMuestra(TENANT_DEMO)]);
    clientes = await listarClientes(TENANT_DEMO);
    hecho.push(`Dados de alta ${clientes.length} clientes de muestra en ${TENANT_DEMO}.`);
  }

  // --- 3. ¿Hay dónde guardar los ficheros? ---------------------------------
  let bucket: string;
  const b = await buckets();
  if (!supabaseEnabled()) {
    bucket = "SIN SUPABASE en este entorno: las facturas no se guardarían.";
  } else if (!b.ok) {
    bucket = `no se ha podido comprobar: ${b.error}`;
  } else {
    const f = b.lista.find((x) => x.name === BUCKET);
    if (f) bucket = f.public ? `existe pero es PÚBLICO — arréglalo en /api/admin/supabase-estado?crear=1` : "existe y es privado";
    else if (preparar) { bucket = await crearBucket(); hecho.push(`Bucket "${BUCKET}": ${bucket}`); }
    else bucket = `NO EXISTE. Subir una factura fallará. Lánzalo con ?preparar=1`;
  }

  // --- 4. ¿Está puesto el desvío? ------------------------------------------
  const d = await leerDesvio();
  const desvio = d?.activo
    ? `activo: los adjuntos de ${d.phoneNumberId} van a ${d.tenantId}`
    : "sin poner — las fotos que lleguen al número de AI-Team NO entrarán en ninguna gestoría";

  const listaGestorias = gestorias.map((t) => ({
    id: t.id,
    nombre: t.name,
    numeroPropio: t.whatsappPhoneNumberId ?? null,
    clientes: t.id === TENANT_DEMO ? clientes.length : undefined,
  }));

  const problemas: string[] = [];
  if (!gestorias.length) problemas.push("no hay ninguna gestoría");
  if (!clientes.length) problemas.push("la gestoría de demostración no tiene clientes");
  if (!bucket.includes("privado") && !bucket.includes("creado")) problemas.push(`el bucket de ficheros: ${bucket}`);
  if (!d?.activo) problemas.push("falta poner el desvío");

  return NextResponse.json({
    veredicto: problemas.length
      ? `FALTA: ${problemas.join(" · ")}.`
      : "TODO LISTO. Manda una foto al número y aparecerá en la bandeja.",
    ...(hecho.length ? { seHaHecho: hecho } : {}),
    gestorias: listaGestorias,
    clientesDeLaDemo: clientes.map((c) => `${c.nombre} (${c.telefono})`),
    bucketDeFicheros: bucket,
    desvio,
    siguiente: problemas.length
      ? preparar
        ? "Vuelve a abrir esta dirección sin ?preparar=1 para ver qué queda."
        : "Abre esta misma dirección con ?preparar=1"
      : `Manda la foto al número y míralo en /admin/ver-panel/${TENANT_DEMO} → /dashboard/facturas`,
    paraElDesvio: `/api/admin/gestoria-desvio?tenant=${TENANT_DEMO}`,
  });
}
