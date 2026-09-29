// Informe semanal de Carmen al WhatsApp de cada dueño. Lunes a las 9:00 (hora de
// España): se dispara desde n8n con CRON_SECRET (el plan Hobby de Vercel ya va
// lleno de crons). Solo manda si CARMEN_INFORME_SEND_ENABLED=true; si no,
// calcula y lo deja en la respuesta y en el log. `?tenant=<id>` lo limita a un
// tenant (para lanzarlo a mano sin tocar a los demás).
import { NextResponse } from "next/server";
import { cronAuthError } from "@/lib/cron-auth";
import { listTenants, agenteContratado } from "@/lib/tenants";
import { informeSemanal, avisarAlDueno } from "@/lib/carmen-llamadas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function run(req: Request) {
  const err = cronAuthError(req);
  if (err) return err;
  const enviar = (process.env.CARMEN_INFORME_SEND_ENABLED || "").toLowerCase() === "true";
  const solo = new URL(req.url).searchParams.get("tenant");
  const out = [];
  for (const t of await listTenants()) {
    if (solo && t.id !== solo) continue;
    // Negocio de cliente: con sector, o con negocio de agenda fijado (la cuenta
    // propia se presenta como el salón de demo y no tiene `sector`).
    if (!(t.sector || t.negocioAgenda) || !t.ownerWhatsapp || !(await agenteContratado(t.id, "carmen"))) continue;
    const inf = await informeSemanal(t.id);
    const envio = enviar
      ? await avisarAlDueno(t.id, inf.texto, process.env.CARMEN_INFORME_TEMPLATE ? { nombre: process.env.CARMEN_INFORME_TEMPLATE, variables: [String(inf.llamadas), String(inf.citas), String(inf.rescatadas), String(inf.euros)] } : undefined)
      : { enviado: false, modo: "apagado (CARMEN_INFORME_SEND_ENABLED)" };
    console.log(`[carmen-informe] ${t.id}: ${inf.texto.replace(/\n/g, " | ")} → ${envio.modo}`);
    out.push({ tenant: t.id, ...inf, envio });
  }
  return NextResponse.json({ ok: true, enviar, informes: out });
}
export const GET = run;
export const POST = run;
