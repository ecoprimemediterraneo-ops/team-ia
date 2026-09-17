// La barra roja de "lo que aprieta" del panel de dental. Mismo formato que usa
// `BarraUrgente` en gestoría ({texto, href} | null), con datos propios: citas
// de hoy sin confirmar primero (es lo más accionable — una llamada rápida), y
// si no hay ninguna, el paciente con más retraso en su revisión.

import { NextResponse } from "next/server";
import { getSessionLocal } from "@/lib/auth";
import { contextoPanelODefecto } from "@/lib/panel-contexto";
import { getBusinessesForTenant, listRecordsForRange } from "@/lib/booking";
import { candidatosRecall } from "@/lib/recall";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function hoyISO(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Madrid" });
}

export async function GET() {
  const s = await getSessionLocal();
  if (!s) return NextResponse.json({ ok: false }, { status: 401 });
  const ctx = await contextoPanelODefecto();
  if (ctx.perfil.id !== "dental") return NextResponse.json({ ok: false }, { status: 403 });

  let urgente: { texto: string; href: string } | null = null;

  try {
    const negocios = await getBusinessesForTenant(ctx.tenantId);
    const negocio = negocios[0];
    if (negocio) {
      const hoy = hoyISO();
      const sinConfirmar = (await listRecordsForRange(negocio.slug, hoy, hoy)).filter(
        (r) => r.tipo === "cita" && r.estado === "pendiente",
      );
      if (sinConfirmar.length > 0) {
        urgente = {
          texto: `${sinConfirmar.length} ${sinConfirmar.length === 1 ? "cita de hoy sigue" : "citas de hoy siguen"} sin confirmar.`,
          href: "/dashboard",
        };
      }
    }
  } catch { /* si falla, se sigue sin barra en vez de romper el panel */ }

  if (!urgente) {
    try {
      const candidatos = await candidatosRecall(ctx.tenantId, { incluirAvisados: false });
      const peor = candidatos.sort((a, b) => b.diasDeRetraso - a.diasDeRetraso)[0];
      if (peor && peor.diasDeRetraso > 0) {
        urgente = {
          texto: `${peor.nombre || "Un paciente"} lleva ${peor.diasDeRetraso} días de retraso en su revisión.`,
          href: "/dashboard/presupuestos-revisiones",
        };
      }
    } catch { /* idem */ }
  }

  return NextResponse.json({ ok: true, urgente });
}
