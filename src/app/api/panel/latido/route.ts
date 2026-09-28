// GET /api/panel/latido — "¿ha cambiado algo desde la última vez?"
//
// El panel lo pregunta cada pocos segundos (ver `LatidoPanel.tsx`) y, si la
// huella cambia, se refresca solo: una cita que entra por WhatsApp, por
// teléfono o por la web, un DM de Instagram, una cancelación… aparecen sin
// tocar nada. Antes había que recargar la página a mano.
//
// Devuelve solo una huella (un hash), nunca datos: es barato y no enseña nada.

import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { getSessionLocal } from "@/lib/auth";
import { contextoPanelODefecto } from "@/lib/panel-contexto";
import { getBusinessesForTenant, listRecords } from "@/lib/booking";
import { getMonthEvents, monthKey } from "@/lib/event-log";
import { listarConversaciones } from "@/lib/marta-inbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const s = await getSessionLocal();
  if (!s) return NextResponse.json({ ok: false }, { status: 401 });
  const ctx = await contextoPanelODefecto();
  const h = crypto.createHash("sha1");
  h.update(ctx.tenantId);
  try {
    const slugs = new Set((await getBusinessesForTenant(ctx.tenantId)).map((b) => b.slug));
    if (slugs.size) {
      for (const r of await listRecords()) {
        if (!slugs.has(r.slug)) continue;
        h.update(`${r.id}|${r.estado}|${r.startIso}|${r.empleadoId ?? ""}|${r.durationMin};`);
      }
    }
  } catch { /* sin agenda: solo cuenta lo demás */ }
  try {
    const ev = await getMonthEvents(ctx.tenantId, monthKey(new Date()));
    h.update(`ev:${ev.length}:${ev[ev.length - 1]?.id ?? ""}`);
  } catch { /* nada */ }
  try {
    const dms = await listarConversaciones(ctx.tenantId);
    h.update(`dm:${dms.length}:${dms[0]?.ultimoMovimientoEn ?? ""}`);
  } catch { /* nada */ }
  return NextResponse.json({ ok: true, v: h.digest("hex").slice(0, 16) }, { headers: { "Cache-Control": "no-store" } });
}
