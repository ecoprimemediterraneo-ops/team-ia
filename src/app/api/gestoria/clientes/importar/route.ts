// Importar los clientes de la gestoría desde una hoja de cálculo.
//
//   POST (multipart, campo `fichero`)  → lee el fichero y devuelve columnas + vista previa
//   POST (json {filas, mapa})          → recalcula la vista previa con otro emparejamiento
//   POST (json {filas, mapa, aplicar}) → GUARDA. Solo aquí se escribe algo.
//
// El fichero NO se guarda en ningún sitio: se lee, se devuelven sus filas al
// navegador, y el navegador las manda de vuelta al confirmar. Así el gestor
// puede cambiar el emparejamiento de columnas todas las veces que quiera sin
// volver a subirlo, y no queda un Excel con datos de cien clientes tirado en el
// servidor.

import { NextResponse } from "next/server";
import { getSessionLocal } from "@/lib/auth";
import { contextoPanelODefecto } from "@/lib/panel-contexto";
import { tieneFuncion } from "@/lib/sectores";
import { listarClientes } from "@/lib/gestoria-clientes";
import { guardarIdentidad } from "@/lib/gestoria-identidad";
import { listarExpedientes, guardarExpedientes, type Expediente } from "@/lib/gestoria";
import {
  leerFichero, adivinarMapa, planificar, saltadasComoCsv,
  type CampoCliente,
} from "@/lib/gestoria-importar-clientes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Tope de filas. Cien clientes es el caso real; mil es un fichero equivocado. */
const MAX_FILAS = 2000;

async function guardia() {
  const s = await getSessionLocal();
  if (!s) {
    return {
      ok: false as const,
      res: NextResponse.json({ error: "Tu sesión ha caducado. Vuelve a entrar en el panel." }, { status: 401 }),
    };
  }
  const ctx = await contextoPanelODefecto();
  if (!tieneFuncion(ctx.sector, "estadoExpediente")) {
    return { ok: false as const, res: NextResponse.json({ error: "Esto es para gestorías." }, { status: 403 }) };
  }
  return { ok: true as const, tenantId: ctx.tenantId };
}

export async function POST(req: Request) {
  const g = await guardia();
  if (!g.ok) return g.res;

  const tipo = req.headers.get("content-type") || "";

  // --- 1. Sube el fichero: se lee y se propone un emparejamiento ---
  if (tipo.includes("multipart/form-data")) {
    const form = await req.formData();
    const f = form.get("fichero");
    if (!(f instanceof File)) return NextResponse.json({ error: "No llegó ningún fichero." }, { status: 400 });
    if (!/\.(xlsx|xls|csv|txt|tsv)$/i.test(f.name)) {
      return NextResponse.json({ error: "Solo Excel (.xlsx) o CSV." }, { status: 400 });
    }

    const contenido = Buffer.from(await f.arrayBuffer());
    const filas = await leerFichero({ contenido, nombre: f.name }).catch(() => [] as string[][]);
    if (filas.length < 2) {
      return NextResponse.json({ error: "El fichero está vacío o no tiene filas debajo de la cabecera." }, { status: 400 });
    }
    if (filas.length > MAX_FILAS) {
      return NextResponse.json({ error: `El fichero tiene ${filas.length - 1} filas. El tope son ${MAX_FILAS}.` }, { status: 400 });
    }

    const cabecera = filas[0];
    const mapa = adivinarMapa(cabecera);
    const existentes = await listarClientes(g.tenantId).catch(() => []);
    const plan = planificar(filas, mapa, existentes);

    return NextResponse.json({ ok: true, nombre: f.name, cabecera, mapa, filas, plan: resumen(plan) });
  }

  // --- 2 y 3. Recalcular la vista previa, o aplicarla ---
  const body = (await req.json().catch(() => ({}))) as {
    filas?: string[][];
    mapa?: Array<CampoCliente | null>;
    aplicar?: boolean;
  };
  if (!Array.isArray(body.filas) || !Array.isArray(body.mapa)) {
    return NextResponse.json({ error: "Falta el fichero. Vuelve a subirlo." }, { status: 400 });
  }

  const existentes = await listarClientes(g.tenantId).catch(() => []);
  const plan = planificar(body.filas, body.mapa, existentes);

  if (!body.aplicar) return NextResponse.json({ ok: true, plan: resumen(plan) });

  // --- APLICAR. A partir de aquí sí se escribe. ---
  const expedientes: Expediente[] = await listarExpedientes(g.tenantId).catch(() => [] as Expediente[]);
  const ahora = new Date().toISOString();
  let creados = 0;
  let actualizados = 0;
  const fallos: string[] = [];

  // Los NUEVOS necesitan un expediente: los clientes de la gestoría salen de
  // ahí, no de una lista aparte. Se les crea uno mínimo, sin trámite empezado.
  for (const n of plan.nuevos) {
    const id = n.telefonos[0];
    if (!id) continue;
    expedientes.push({
      id: `imp_${id}_${Date.now().toString(36)}`,
      tenantId: g.tenantId,
      telefono: id,
      email: n.emails[0],
      clienteNombre: n.nombre,
      nif: n.nif || undefined,
      tramite: "trimestrales",
      estado: "recibido",
      documentos: [],
      nota: "Dado de alta importando una hoja de cálculo",
      creadoEn: ahora,
      actualizadoEn: ahora,
    } as Expediente);
    creados++;
  }
  if (creados) await guardarExpedientes(g.tenantId, expedientes);

  // Y ahora las fichas de identificación, nuevos y viejos por igual.
  const todos = [
    ...plan.nuevos.map((n) => ({ ...n, clienteId: n.telefonos[0] })),
    ...plan.actualizar,
  ];
  for (const c of todos) {
    if (!c.clienteId) continue;
    const antes = existentes.find((x) => x.id === c.clienteId);
    // FUSIÓN, NUNCA PISAR. Lo que no viene en el fichero se queda como estaba:
    // una columna vacía significa "no traigo ese dato", no "bórralo".
    const r = await guardarIdentidad({
      tenantId: g.tenantId,
      clienteId: c.clienteId,
      nif: c.nif || undefined,
      telefonos: c.telefonos.length ? [...new Set([...(antes?.telefonos ?? []), ...c.telefonos])] : undefined,
      emails: c.emails.length ? [...new Set([...(antes?.emails ?? []), ...c.emails])] : undefined,
    });
    if (!r.ok) fallos.push(`${c.nombre}: ${r.error}`);
    else if (plan.actualizar.some((a) => a.clienteId === c.clienteId)) actualizados++;
  }

  return NextResponse.json({
    ok: true,
    creados,
    actualizados,
    saltados: plan.saltadas.length,
    fallos,
    saltadasCsv: plan.saltadas.length ? saltadasComoCsv(plan.saltadas) : null,
  });
}

/** La vista previa que se le enseña al gestor. Sin datos de más. */
function resumen(plan: ReturnType<typeof planificar>) {
  return {
    nuevos: plan.nuevos.length,
    actualizar: plan.actualizar.length,
    saltadas: plan.saltadas.length,
    avisos: plan.avisos.slice(0, 20),
    // Unas pocas de cada, para poder comprobar que el emparejamiento es el bueno
    // antes de guardar cien fichas.
    ejemploNuevos: plan.nuevos.slice(0, 5),
    ejemploActualizar: plan.actualizar.slice(0, 5),
    listaSaltadas: plan.saltadas.slice(0, 30),
    saltadasCsv: plan.saltadas.length ? saltadasComoCsv(plan.saltadas) : null,
  };
}
