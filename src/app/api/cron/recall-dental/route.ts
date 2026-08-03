// GET/POST /api/cron/recall-dental — la pasada diaria de seguimiento de la clínica.
//
// Hace las dos cosas que una clínica dental no hace nunca por falta de tiempo:
//   1. RECALL: avisar al paciente al que le toca revisión (6 o 12 meses según el
//      tratamiento) y no tiene nada en agenda.
//   2. PRESUPUESTOS: recordar el presupuesto que se dio y sigue parado.
//
// Solo actúa sobre tenants cuyo sector tiene esas funciones encendidas
// (`recall` / `seguimientoPresupuestos` en sectores.ts → hoy, dental). El resto
// ni se miran.
//
// FRENOS: los envíos reales están detrás de RECALL_SEND_ENABLED y
// PRESUPUESTOS_SEND_ENABLED (los dos OFF por defecto). Apagados, el cron calcula
// todo y lo devuelve en la respuesta, pero no escribe a ningún paciente. Así se
// puede ver a quién avisaría antes de dejarle hablar.
//
// Auth: ?secret=<CRON_SECRET>, header x-cron-secret o Authorization: Bearer
// (esta última es la que manda Vercel Cron sola).

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { listTenants } from "@/lib/tenants";
import { resolverSector, tieneFuncion } from "@/lib/sectores";
import { getBusinessesForTenant } from "@/lib/booking";
import {
  candidatosRecall,
  avisarRecall,
  recallSendEnabled,
  MAX_POR_PASADA,
  type ResultadoAviso,
} from "@/lib/recall";
import {
  presupuestosPendientes,
  avisarPresupuesto,
  presupuestosSendEnabled,
} from "@/lib/presupuestos";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function authorized(req: Request, h: Headers): boolean {
  const expected = process.env.CRON_SECRET || "";
  // Fail-CLOSED en producción: sin secreto no se abre, porque este endpoint
  // manda WhatsApp a pacientes reales.
  if (!expected) return process.env.NODE_ENV !== "production";
  const qp = new URL(req.url).searchParams.get("secret") || "";
  const hdr = h.get("x-cron-secret") || "";
  const bearer = (h.get("authorization") || "").replace(/^Bearer\s+/i, "");
  return qp === expected || hdr === expected || bearer === expected;
}

type ResumenTenant = {
  tenantId: string;
  negocio: string;
  recall: { candidatos: number; avisados: number; resultados: ResultadoAviso[] };
  presupuestos: { pendientes: number; recordados: number; modos: string[] };
};

async function run(req: Request) {
  const h = await headers();
  if (!authorized(req, h)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // ?dry=1 fuerza el modo "solo mirar" aunque los flags estén encendidos.
  const dry = new URL(req.url).searchParams.get("dry") === "1";

  const tenants = await listTenants().catch(() => []);
  const resumen: ResumenTenant[] = [];

  for (const t of tenants) {
    const sector = resolverSector(t);
    const haceRecall = tieneFuncion(sector, "recall");
    const haceSeguimiento = tieneFuncion(sector, "seguimientoPresupuestos");
    if (!haceRecall && !haceSeguimiento) continue;

    const negocios = await getBusinessesForTenant(t.id).catch(() => []);
    const nombreNegocio = negocios[0]?.nombre || t.name || "tu clínica";

    const fila: ResumenTenant = {
      tenantId: t.id,
      negocio: nombreNegocio,
      recall: { candidatos: 0, avisados: 0, resultados: [] },
      presupuestos: { pendientes: 0, recordados: 0, modos: [] },
    };

    if (haceRecall) {
      const candidatos = await candidatosRecall(t.id).catch(() => []);
      fila.recall.candidatos = candidatos.length;
      if (!dry) {
        for (const c of candidatos.slice(0, MAX_POR_PASADA)) {
          const r = await avisarRecall(t.id, c, nombreNegocio);
          fila.recall.resultados.push(r);
          if (r.enviado) fila.recall.avisados++;
        }
      }
    }

    if (haceSeguimiento) {
      const pendientes = await presupuestosPendientes(t.id).catch(() => []);
      fila.presupuestos.pendientes = pendientes.length;
      if (!dry) {
        for (const p of pendientes.slice(0, MAX_POR_PASADA)) {
          const r = await avisarPresupuesto(t.id, p, nombreNegocio);
          fila.presupuestos.modos.push(r.modo);
          if (r.enviado) fila.presupuestos.recordados++;
        }
      }
    }

    resumen.push(fila);
  }

  return NextResponse.json({
    ok: true,
    dry,
    envios: {
      recall: recallSendEnabled() ? "activado" : "apagado (RECALL_SEND_ENABLED)",
      presupuestos: presupuestosSendEnabled() ? "activado" : "apagado (PRESUPUESTOS_SEND_ENABLED)",
    },
    clinicas: resumen.length,
    resumen,
  });
}

export async function GET(req: Request) {
  return run(req);
}
export async function POST(req: Request) {
  return run(req);
}
