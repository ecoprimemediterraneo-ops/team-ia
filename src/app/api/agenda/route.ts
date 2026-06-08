// GET /api/agenda?from=ISO&to=ISO
// Devuelve las citas reales del calendario primary del usuario logueado,
// cruzadas con el event-log (appointment_set) para añadir agenteOrigen.
//
// - Si no se pasan from/to: ahora → +30 días.
// - Si Calendar no está conectado o falta scope: 401/403 con mensaje claro.
//   NUNCA devuelve [] silencioso ante fallos de token.

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { requireSession } from "@/lib/auth";
import { getRedirectUri } from "@/lib/gmail";
import { listEvents } from "@/lib/calendar";
import { getMonthEvents, monthKey } from "@/lib/event-log";
import { DEFAULT_TENANT_ID } from "@/lib/tenants";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type LogMeta = {
  nombre?: string;
  motivo?: string;
  eventId?: string;
  htmlLink?: string;
  agenteOrigen?: string;
};

export async function GET(req: Request) {
  try {
    const { email } = await requireSession();
    const url = new URL(req.url);
    const now = new Date();
    const default30 = new Date(now.getTime() + 30 * 86_400_000);
    const from = url.searchParams.get("from") || now.toISOString();
    const to = url.searchParams.get("to") || default30.toISOString();

    const h = await headers();
    const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
    const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
    const redirectUri = getRedirectUri(host, proto);

    const result = await listEvents(email, redirectUri, from, to);

    if (!result.ok) {
      const status =
        result.reason === "no_tokens" ? 401 :
        result.reason === "insufficient_scope" ? 403 : 500;
      return NextResponse.json(
        {
          ok: false,
          reason: result.reason,
          error: result.detail,
          hint: result.reason === "no_tokens"
            ? "Conecta Google Calendar desde el panel de Lucía."
            : result.reason === "insufficient_scope"
            ? "El token no tiene scope calendar.events. Reconecta Lucía con el alcance correcto."
            : "Error al leer Google Calendar.",
        },
        { status },
      );
    }

    // Cargar event-log de los meses que cubre el rango para cruzar agenteOrigen.
    const months = new Set<string>();
    months.add(monthKey(from));
    months.add(monthKey(to));
    const logs = (
      await Promise.all([...months].map((m) => getMonthEvents(DEFAULT_TENANT_ID, m)))
    ).flat();

    // Índice por eventId (de Google) → metadatos del log.
    const byEventId = new Map<string, { agenteOrigen: string; meta: LogMeta }>();
    for (const e of logs) {
      if (e.type !== "appointment_set") continue;
      const meta = (e.meta ?? {}) as LogMeta;
      const evId = meta.eventId;
      if (evId) byEventId.set(evId, { agenteOrigen: e.channel, meta });
    }

    const citas = result.events.map((ev) => {
      const log = byEventId.get(ev.id);
      return {
        id: ev.id,
        summary: ev.summary,
        description: ev.description,
        location: ev.location,
        start: ev.start,
        end: ev.end,
        allDay: ev.allDay,
        htmlLink: ev.htmlLink,
        agenteOrigen: log?.agenteOrigen ?? null,
        nombre: log?.meta?.nombre ?? null,
        motivo: log?.meta?.motivo ?? null,
      };
    });

    // KPIs: esta semana y este mes (sobre el set devuelto)
    const startOfWeek = (() => {
      const d = new Date();
      const day = (d.getDay() + 6) % 7;
      d.setDate(d.getDate() - day);
      d.setHours(0, 0, 0, 0);
      return d;
    })();
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 7);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const inRange = (iso: string, a: Date, b: Date) => {
      const t = new Date(iso).getTime();
      return t >= a.getTime() && t < b.getTime();
    };

    const kpis = {
      semana: citas.filter((c) => inRange(c.start, startOfWeek, endOfWeek)).length,
      mes: citas.filter((c) => inRange(c.start, startOfMonth, endOfMonth)).length,
      total: citas.length,
    };

    return NextResponse.json({
      ok: true,
      range: { from, to },
      timezone: result.timezone ?? "Europe/Madrid",
      citas,
      kpis,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Error" },
      { status: 500 },
    );
  }
}
