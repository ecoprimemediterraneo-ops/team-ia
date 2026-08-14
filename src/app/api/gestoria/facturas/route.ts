// Saco de facturas del cliente: listar, subir a mano y editar.
//
// TODAS las verbos exigen sesión válida y trabajan SIEMPRE dentro del tenant de
// quien pregunta: el tenant NO se acepta por parámetro, se resuelve del contexto
// del panel. Si viniera de fuera, cualquiera con sesión podría leer el saco de
// otra gestoría cambiando un id en la URL.

import { NextResponse } from "next/server";
import { getSessionLocal } from "@/lib/auth";
import { contextoPanelODefecto } from "@/lib/panel-contexto";
import {
  listarFacturas, listarSinAsignar, crearFactura, actualizarFactura,
  asignarCliente, urlFirmada,
} from "@/lib/gestoria-facturas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function guardia() {
  const s = await getSessionLocal();
  if (!s) return { ok: false as const, res: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  const ctx = await contextoPanelODefecto();
  return { ok: true as const, tenantId: ctx.tenantId };
}

export async function GET(req: Request) {
  const g = await guardia();
  if (!g.ok) return g.res;

  const q = new URL(req.url).searchParams;
  const clienteId = q.get("clienteId") || undefined;
  // `?sinAsignar=1` devuelve la bandeja de las que entraron sin dueño. Es una
  // lista aparte a propósito: no pertenecen a ningún cliente y no deben
  // aparecer mezcladas en el saco de nadie.
  const facturas = q.get("sinAsignar") === "1"
    ? await listarSinAsignar(g.tenantId)
    : await listarFacturas(g.tenantId, clienteId);

  // La URL firmada se genera al vuelo y caduca: nunca se guarda ni se cachea.
  const conUrl = await Promise.all(
    facturas.map(async (f) => ({ ...f, verUrl: await urlFirmada(f.fichero_url) })),
  );
  return NextResponse.json({ ok: true, total: conUrl.length, facturas: conUrl });
}

export async function POST(req: Request) {
  const g = await guardia();
  if (!g.ok) return g.res;

  try {
    const form = await req.formData();
    const clienteId = String(form.get("clienteId") || "").trim();
    if (!clienteId) return NextResponse.json({ error: "falta clienteId" }, { status: 400 });

    // Varios a la vez: el gestor suelta un puñado de fotos de golpe.
    const ficheros = form.getAll("ficheros").filter((x): x is File => x instanceof File);
    if (!ficheros.length) return NextResponse.json({ error: "no llegó ningún fichero" }, { status: 400 });

    const creadas = [];
    const rechazadas: string[] = [];
    for (const f of ficheros) {
      try {
        const buf = Buffer.from(await f.arrayBuffer());
        creadas.push(
          await crearFactura({
            tenantId: g.tenantId,
            clienteId,
            origen: "manual",
            nombre: f.name || "factura",
            contenido: buf,
            mime: f.type || "",
          }),
        );
      } catch (e) {
        // Un fichero que no vale no tumba la subida de los demás.
        rechazadas.push(`${f.name}: ${e instanceof Error ? e.message : "error"}`);
      }
    }
    return NextResponse.json({ ok: true, creadas: creadas.length, rechazadas, facturas: creadas });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const g = await guardia();
  if (!g.ok) return g.res;

  const body = (await req.json().catch(() => ({}))) as {
    id?: string; importe?: number | null; fecha_factura?: string | null;
    proveedor?: string | null;
    estado?: "sin_asignar" | "pendiente" | "conciliada" | "descartada";
    notas?: string; cliente_id?: string;
  };
  if (!body.id) return NextResponse.json({ error: "falta id" }, { status: 400 });

  // Asignar cliente va por su propio camino: cambia dueño Y estado a la vez, y
  // así no depende de que quien llama se acuerde de mandar los dos campos.
  if (body.cliente_id) {
    const asignada = await asignarCliente(g.tenantId, body.id, body.cliente_id);
    return asignada
      ? NextResponse.json({ ok: true, factura: asignada })
      : NextResponse.json({ error: "no encontrada" }, { status: 404 });
  }

  // Solo se mandan los campos que vienen. `actualizarFactura` hace un spread, y
  // un `undefined` explícito PISA el valor guardado: descartar una factura
  // borraría su importe y su proveedor de paso.
  const cambios: Parameters<typeof actualizarFactura>[2] = {};
  if (body.importe !== undefined) cambios.importe = body.importe;
  if (body.fecha_factura !== undefined) cambios.fecha_factura = body.fecha_factura;
  if (body.proveedor !== undefined) cambios.proveedor = body.proveedor;
  if (body.estado !== undefined) cambios.estado = body.estado;
  if (body.notas !== undefined) cambios.notas = body.notas;

  const actualizada = await actualizarFactura(g.tenantId, body.id, cambios);
  return actualizada
    ? NextResponse.json({ ok: true, factura: actualizada })
    : NextResponse.json({ error: "no encontrada" }, { status: 404 });
}
