// POST /api/admin/orquestador/test — banco de pruebas LOCAL del orquestador.
//
// Dispara N reservas CONCURRENTES sobre el MISMO hueco en modo `simulate`
// (sin tocar Google) para demostrar que el lock/mutex evita el doble-booking:
// solo una debería salir "booked", el resto "rejected_conflict"/"locked".
//
// Solo fundador. Acciones:
//   { action: "fire", nombre, motivo, startIso, agentes: ["pablo","carmen"] }
//   { action: "reset" }   → limpia las reservas simuladas en memoria.

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { reservarSlot, resetSimulacion, type ReservaResult } from "@/lib/orchestrator";
import type { EventChannel } from "@/lib/event-log";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const FOUNDER_EMAIL = process.env.FOUNDER_EMAIL || "ecoprimemediterraneo@gmail.com";

export async function POST(req: Request) {
  const s = await getSession();
  if (!s || (s.email !== FOUNDER_EMAIL && s.email !== "crisasky@gmail.com")) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    nombre?: string;
    motivo?: string;
    startIso?: string;
    agentes?: EventChannel[];
  };

  if (body.action === "reset") {
    resetSimulacion();
    return NextResponse.json({ ok: true, reset: true });
  }

  const nombre = body.nombre?.trim() || "Cliente de prueba";
  const motivo = body.motivo?.trim() || "Prueba orquestador";
  const startIso = body.startIso?.trim() || "2026-06-20T10:00:00";
  const agentes: EventChannel[] = body.agentes && body.agentes.length > 0
    ? body.agentes
    : ["pablo", "carmen", "eva"];

  // Disparo CONCURRENTE: todas piden el mismo hueco a la vez.
  const results = await Promise.all(
    agentes.map((agenteOrigen) =>
      reservarSlot({
        userEmail: FOUNDER_EMAIL,
        redirectUri: "http://localhost/sim",
        nombre,
        motivo,
        startIso,
        agenteOrigen,
        simulate: true,
      }).then((r: ReservaResult) => ({ agente: agenteOrigen, result: r })),
    ),
  );

  const booked = results.filter((r) => r.result.ok).length;
  return NextResponse.json({
    ok: true,
    startIso,
    disparadas: agentes.length,
    confirmadas: booked,
    rechazadas: agentes.length - booked,
    detalle: results.map((r) => ({
      agente: r.agente,
      estado: r.result.ok ? "booked" : r.result.reason,
    })),
  });
}
