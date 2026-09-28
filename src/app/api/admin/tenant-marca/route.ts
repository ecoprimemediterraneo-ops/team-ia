// MULTI-MARCA POR TENANT (founder-only).
//
// Los mismos agentes se venden también sueltos (cristobalserrano.tech) con el
// MISMO panel y el MISMO motor de agenda: lo único que cambia por cliente es el
// logo, los colores y qué agentes tiene encendidos.
//
//   GET                                   → cómo está cada tenant
//   GET ?tenant=<id>&nombre=Estudio%20Rosa&logo=https://…&color=%23ff4fa3&acento=%231e7a5a
//   GET ?tenant=<id>&agentes=pablo,marta  → solo esos agentes (el resto, apagados)
//   GET ?tenant=<id>&agentes=todos        → vuelve a todos los del sector
//   GET ?tenant=<id>&quitarMarca=1        → vuelve al logo y colores de AI-Team
//
// Con agentes apagados: el panel no los enseña y sus webhooks (Pablo por
// WhatsApp, Marta por Instagram, Carmen por teléfono) no contestan en nombre de
// ese negocio.

import { NextResponse } from "next/server";
import { requireFounder } from "@/lib/admin-auth";
import { getTenant, listTenants, upsertTenant, type MarcaPanel } from "@/lib/tenants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AGENTES = ["pablo", "marta", "carmen", "rocio", "lucia", "eva", "sergio"];
const COLOR = /^#[0-9a-f]{3,8}$/i;

export async function GET(req: Request) {
  const auth = await requireFounder();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const q = new URL(req.url).searchParams;
  const id = q.get("tenant");
  if (!id) {
    return NextResponse.json({
      ok: true,
      tenants: (await listTenants()).map((t) => ({ id: t.id, negocio: t.name, marca: t.marcaPanel ?? null, agentes: t.agentesContratados ?? "todos los del sector" })),
    });
  }
  const t = await getTenant(id);
  if (!t) return NextResponse.json({ error: `no existe el tenant ${id}` }, { status: 404 });

  const siguiente = { ...t };
  if (q.get("quitarMarca") === "1") delete siguiente.marcaPanel;
  const m: MarcaPanel = { ...(siguiente.marcaPanel ?? {}) };
  let tocaMarca = false;
  for (const [param, campo] of [["nombre", "nombre"], ["logo", "logoUrl"], ["color", "colorPrincipal"], ["acento", "colorAcento"]] as const) {
    const v = q.get(param);
    if (v === null) continue;
    tocaMarca = true;
    if (!v) { delete m[campo]; continue; }
    if ((campo === "colorPrincipal" || campo === "colorAcento") && !COLOR.test(v)) {
      return NextResponse.json({ error: `"${param}" tiene que ser un color como #ff4fa3` }, { status: 400 });
    }
    if (campo === "logoUrl" && !/^(https:\/\/|\/)/.test(v)) {
      return NextResponse.json({ error: "el logo tiene que ser una URL https:// o una ruta /… de este sitio" }, { status: 400 });
    }
    m[campo] = v.slice(0, 500);
  }
  if (tocaMarca) siguiente.marcaPanel = m;

  const agentes = q.get("agentes");
  if (agentes !== null) {
    if (agentes === "todos" || agentes === "") delete siguiente.agentesContratados;
    else {
      const lista = agentes.split(",").map((a) => a.trim().toLowerCase()).filter(Boolean);
      const malos = lista.filter((a) => !AGENTES.includes(a));
      if (malos.length) return NextResponse.json({ error: `agentes que no existen: ${malos.join(", ")}` }, { status: 400 });
      siguiente.agentesContratados = lista;
    }
  }
  await upsertTenant(siguiente);
  return NextResponse.json({ ok: true, tenant: id, marca: siguiente.marcaPanel ?? null, agentes: siguiente.agentesContratados ?? "todos los del sector" });
}
