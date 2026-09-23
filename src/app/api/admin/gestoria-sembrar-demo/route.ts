// GET /api/admin/gestoria-sembrar-demo — founder-only. Deja `tenant_demo_gestoria`
// con datos de demostración en producción (allí `data/` no existe). Solo esa demo.
//
//   GET               dice qué hay y qué falta. NO escribe nada.
//   GET ?sembrar=1    crea el tenant si falta y mete lo que falte: clientes,
//                     expedientes, vencimientos, documentos y extracto. Idempotente:
//                     se compara por id, así que dos veces seguidas no duplican ni
//                     pisan lo que el gestor haya tocado.
//   GET ?migrar=1     cambia por teléfonos de mentira (prefijo 099) los "600…" de
//                     una siembra anterior.
//
// NADA de esto puede escribir a nadie: todos los teléfonos de la demo empiezan por
// 099 (no es un número español válido), los correos son de dominio reservado, y
// `whatsapp-sender.ts` bloquea esos números antes de llamar a Meta. Esta ruta ni
// siquiera importa un módulo de envío.

import { NextResponse } from "next/server";
import { requireFounder } from "@/lib/admin-auth";
import { getTenant } from "@/lib/tenants";
import { sembrarDemoConservando } from "@/lib/sectores-demo";
import { sembrarDatosDemoGestoria, migrarTelefonosDemo, estadoDemoGestoria, TENANT_DEMO } from "@/lib/gestoria-demo-datos";
import { listarClientes } from "@/lib/gestoria-clientes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const auth = await requireFounder();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const q = new URL(req.url).searchParams;
  const hecho: string[] = [];

  // La migración va PRIMERO: si la demo se sembró con los teléfonos antiguos, hay que
  // cambiarlos antes de sembrar; al revés, la semilla nueva metería una ficha por
  // cliente encima de las antiguas y quedarían dos.
  if (q.get("migrar") === "1") {
    const m = await migrarTelefonosDemo();
    if (!m.ok) return NextResponse.json({ ok: false, error: m.error, seHaHecho: [...hecho, ...m.detalle] }, { status: 500 });
    hecho.push(...m.detalle);
  }

  if (q.get("sembrar") === "1") {
    const t = await sembrarDemoConservando(TENANT_DEMO);
    hecho.push(t?.creado ? `Tenant ${TENANT_DEMO} creado.` : `Tenant ${TENANT_DEMO} ya existía: no se ha tocado.`);
    const r = await sembrarDatosDemoGestoria();
    if (!r.ok) return NextResponse.json({ ok: false, error: r.error, seHaHecho: [...hecho, ...r.detalle] }, { status: 500 });
    hecho.push(...r.detalle);
  }
  const existe = !!(await getTenant(TENANT_DEMO));
  const estado = existe ? await estadoDemoGestoria() : null;
  const clientes = existe ? (await listarClientes(TENANT_DEMO)).length : 0;
  const problemas: string[] = [];
  if (!existe) problemas.push("el tenant de la demo no existe");
  if (estado && !estado.documentos) problemas.push("sin documentos");
  if (estado && !estado.expedientes) problemas.push("sin expedientes");
  if (estado?.telefonosAntiguosPresentes.length) problemas.push("quedan teléfonos antiguos (600…): abre con ?migrar=1");

  return NextResponse.json({
    ok: true,
    tenant: TENANT_DEMO,
    veredicto: problemas.length ? `FALTA: ${problemas.join(" · ")}.` : "DEMO COMPLETA.",
    ...(hecho.length ? { seHaHecho: hecho } : {}),
    ...(estado ? { hay: { ...estado, clientes } } : {}),
    siguiente: existe && !problemas.length
      ? `Míralo en /admin/ver-panel/${TENANT_DEMO}`
      : "Abre esta misma dirección con ?sembrar=1 (y después ?migrar=1 si avisa de teléfonos antiguos).",
  });
}
