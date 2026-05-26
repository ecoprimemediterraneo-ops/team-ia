/**
 * Cron diario — comprueba si hay solicitudes de beta en estado "pendiente"
 * con más de 24h y avisa al founder por email.
 *
 * Schedule: 0 10 * * * (cada día a las 10:00 UTC = 11:00 ES)
 */
import { NextResponse } from "next/server";
import { kvGet } from "@/lib/supabase";
import { getResend, RESEND_FROM } from "@/lib/resend";
import { checkCronAuth } from "@/lib/cron-auth";
import { getFounderEmails } from "@/lib/auth";

type Beta = {
  nombre: string;
  email: string;
  whatsapp: string;
  negocio: string;
  sector: string;
  ciudad: string;
  porQue: string;
  fecha: string;
  estado: "pendiente" | "activo" | "cerrado";
};

export const runtime = "nodejs";

export async function GET(req: Request) {
  const a = checkCronAuth(req);
  if (!a.ok) return NextResponse.json({ error: a.reason }, { status: 401 });

  const beta = (await kvGet<Beta[]>("beta:all")) || [];
  const ahora = Date.now();
  const dia = 24 * 60 * 60 * 1000;

  const pendientesAtrasados = beta.filter((b) => {
    if (b.estado !== "pendiente") return false;
    const edad = ahora - new Date(b.fecha).getTime();
    return edad > dia;
  });

  if (pendientesAtrasados.length === 0) {
    return NextResponse.json({ ok: true, atrasados: 0 });
  }

  const filas = pendientesAtrasados
    .map((b) => {
      const horas = Math.round((ahora - new Date(b.fecha).getTime()) / (60 * 60 * 1000));
      return `• ${b.negocio} (${b.sector}, ${b.ciudad}) — ${b.nombre} · ${b.whatsapp} · ${b.email}
   Solicitó hace ${horas}h. Dolor: ${b.porQue.slice(0, 120)}${b.porQue.length > 120 ? "…" : ""}`;
    })
    .join("\n\n");

  try {
    const resend = getResend();
    for (const to of getFounderEmails()) {
      await resend.emails.send({
        from: RESEND_FROM,
        to,
        subject: `🚨 ${pendientesAtrasados.length} solicitud(es) beta sin contestar > 24h`,
        text: `Hay solicitudes de beta privada que llevan más de 24h sin respuesta:

${filas}

Acción: contáctales hoy o cámbiales el estado en https://aiteam.marketing/admin/leads

(Recordatorio diario · Cristóbal — eres tú quien promete responder en 48h)`,
      });
    }
  } catch (e) {
    console.error("[cron beta-pendientes] mail fail:", e);
  }

  return NextResponse.json({ ok: true, atrasados: pendientesAtrasados.length });
}
