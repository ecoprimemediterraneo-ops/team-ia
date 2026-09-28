// POST /api/carmen/urgencia — función de Retell para URGENCIAS.
//
//   accion "comprobar" (por defecto): ¿lo que ha dicho es urgente según las
//     palabras de ESE negocio? Si sí, devuelve el móvil del dueño para que
//     Retell transfiera la llamada (herramienta transfer_call con {{transferir_a}}).
//   accion "sin_respuesta": el dueño no ha cogido la transferencia → se le avisa
//     por WhatsApp con el resumen y el teléfono del cliente.
import { NextResponse } from "next/server";
import { resolverSalonDeLlamada } from "@/lib/carmen-salon";
import { getTenant } from "@/lib/tenants";
import { configCarmen, esUrgencia, avisarAlDueno, idiomaDe } from "@/lib/carmen-llamadas";
import { carmenAutorizada, argsDeRetell } from "@/lib/carmen-auth";
import { logEvent, makeEventId } from "@/lib/event-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const a = carmenAutorizada(req);
  if (a !== "ok") return NextResponse.json({ success: false, message: "No autorizado." }, { status: a === "sin_secreto" ? 503 : 401 });
  const { get, call } = argsDeRetell((await req.json().catch(() => ({}))) as Record<string, unknown>);
  const salon = await resolverSalonDeLlamada(get("slug"), String(call.to_number ?? "") || undefined);
  if (!salon.ok) return NextResponse.json({ success: false, urgente: false, message: "No sé de qué negocio es la llamada." });
  const tenant = await getTenant(salon.tenantId);
  const texto = get("texto", "motivo", "resumen") || "";
  const telefono = get("telefono") || String(call.from_number ?? "");
  const en = idiomaDe(texto) === "en";

  if (get("accion") === "sin_respuesta") {
    const resumen = get("resumen", "texto") || "(sin resumen)";
    const r = await avisarAlDueno(salon.tenantId, `URGENCIA en llamada de Carmen\nCliente: ${telefono || "sin número"}\n${resumen}\nNo has podido coger la llamada: llámale en cuanto puedas.`,
      process.env.CARMEN_URGENCIA_TEMPLATE ? { nombre: process.env.CARMEN_URGENCIA_TEMPLATE, variables: [telefono || "—", resumen.slice(0, 500)] } : undefined);
    await logEvent(salon.tenantId, { id: makeEventId("carmen_urgencia", telefono, String(Date.now())), type: "handoff_human", channel: "carmen", senderId: telefono, meta: { kind: "urgencia_sin_respuesta", resumen, whatsapp: r.modo } }).catch(() => {});
    return NextResponse.json({ success: true, aviso_whatsapp: r, message: en ? "I've passed your details to the owner, who'll call you back as soon as possible." : "Le he pasado tus datos al responsable y te llamará lo antes posible." });
  }

  const palabra = esUrgencia(texto, configCarmen(tenant).urgencias);
  const movil = tenant?.ownerWhatsapp ? `+${tenant.ownerWhatsapp.replace(/\D/g, "")}` : "";
  if (!palabra) return NextResponse.json({ success: true, urgente: false });
  await logEvent(salon.tenantId, { id: makeEventId("carmen_urgencia", telefono, String(Date.now())), type: "handoff_human", channel: "carmen", senderId: telefono, meta: { kind: "urgencia", palabra, texto: texto.slice(0, 300) } }).catch(() => {});
  if (!movil) {
    const r = await avisarAlDueno(salon.tenantId, `URGENCIA: ${telefono} — ${texto.slice(0, 400)}`);
    return NextResponse.json({ success: true, urgente: true, transferir_a: "", aviso_whatsapp: r, message: en ? "I'll let the team know right now so they can call you back." : "Aviso ahora mismo al equipo para que te llame." });
  }
  return NextResponse.json({ success: true, urgente: true, transferir_a: movil, message: en ? "I'm putting you through to someone from the team right now." : "Te paso ahora mismo con el responsable." });
}
