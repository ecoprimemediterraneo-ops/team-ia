// Los datos con los que se reconoce de quién es una factura.
//
//   GET   → los clientes con su ficha de identificación y cuántos van sin NIF
//   POST  → guardar la ficha de un cliente
//
// El NIF repetido devuelve error y NO guarda. El formato raro guarda y avisa:
// ver el porqué en `gestoria-identidad.ts`.

import { NextResponse } from "next/server";
import { getSessionLocal } from "@/lib/auth";
import { contextoPanelODefecto } from "@/lib/panel-contexto";
import { tieneFuncion } from "@/lib/sectores";
import { listarClientes } from "@/lib/gestoria-clientes";
import { guardarIdentidad, comprobarNif, soloDigitos, normalizarEmail } from "@/lib/gestoria-identidad";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

/** El aviso de formato, o null si el NIF está bien (o no hay NIF). */
function avisoDe(nif: string | undefined): string | null {
  if (!nif) return null;
  const r = comprobarNif(nif);
  return r.valido ? null : r.aviso || null;
}

export async function GET() {
  const g = await guardia();
  if (!g.ok) return g.res;

  const clientes = await listarClientes(g.tenantId);
  const sinNif = clientes.filter((c) => !c.nif).length;

  return NextResponse.json({
    ok: true,
    total: clientes.length,
    sinNif,
    clientes: clientes.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      telefono: c.telefono,
      nif: c.nifMostrado || c.nif || "",
      // El teléfono de su ficha no se puede quitar desde aquí: es su clave.
      telefonos: (c.telefonos || []).filter((t) => t !== c.id),
      emails: c.emails || [],
      // El aviso se calcula también al leer, no solo al guardar: si un NIF se
      // metió mal hace un mes, el gestor tiene que verlo hoy sin tocar nada.
      aviso: avisoDe(c.nifMostrado || c.nif),
    })),
  });
}

export async function POST(req: Request) {
  const g = await guardia();
  if (!g.ok) return g.res;

  const body = (await req.json().catch(() => ({}))) as {
    clienteId?: string;
    nif?: string;
    telefonos?: string[];
    emails?: string[];
  };
  if (!body.clienteId) return NextResponse.json({ error: "Falta saber de qué cliente es." }, { status: 400 });

  const clientes = await listarClientes(g.tenantId);
  const cliente = clientes.find((c) => c.id === body.clienteId);
  if (!cliente) return NextResponse.json({ error: "Ese cliente no está en esta gestoría." }, { status: 404 });

  // Los correos que no tienen forma de correo se rechazan aquí: no hay caso raro
  // legítimo, al revés que con el NIF.
  const emails = (body.emails || []).map(normalizarEmail).filter(Boolean);
  const malos = emails.filter((e) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
  if (malos.length) {
    return NextResponse.json({ error: `Esto no parece un correo: ${malos.join(", ")}` }, { status: 400 });
  }

  const r = await guardarIdentidad({
    tenantId: g.tenantId,
    clienteId: body.clienteId,
    nif: body.nif,
    // Su teléfono de siempre se guarda también, para que la ficha esté completa.
    telefonos: [cliente.id, ...(body.telefonos || []).map(soloDigitos)],
    emails,
  });

  if (!r.ok) {
    // Se dice CON QUIÉN choca por su nombre, no por su id: "teléfono 600330033"
    // no le dice nada a nadie, "Bar El Puerto" sí.
    const choque = clientes.find((c) => r.error.includes(c.id));
    return NextResponse.json(
      { error: choque ? r.error.replace(`teléfono ${choque.id}`, choque.nombre) : r.error },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: true, identidad: r.identidad, aviso: r.aviso ?? null });
}
