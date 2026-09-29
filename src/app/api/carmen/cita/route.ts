// =============================================================================
// POST /api/carmen/cita — FUNCTION DE RETELL (en directo, durante la llamada)
//
// Carmen CANCELA o MUEVE la cita del cliente en la propia llamada, por el MISMO
// motor que Pablo y el panel (`cambiarEstadoRecord` / `reprogramarRecord`, con
// el candado de la agenda). El hueco queda libre al instante.
//
// Antes, por teléfono solo se podía pedir el ENLACE de cancelación por WhatsApp
// (`/api/carmen/cancelar`, que sigue existiendo): cancelar o mover de verdad
// solo se podía por WhatsApp o desde el panel.
//
// ─── ALTA EN RETELL (tu agente Carmen → Functions → Add function, Custom) ─────
//   · Name:  gestionar_cita
//   · URL (POST): https://aiteam.marketing/api/carmen/cita?secret=CARMEN_WEBHOOK_SECRET
//   · Description: "Cancela o cambia de hora la cita del cliente. Primero
//       llama con accion=consultar para saber qué citas tiene; confirma con el
//       cliente; después llama con accion=cancelar o accion=mover."
//   · Parameters:
//       - accion      (string, requerido)  "consultar" | "cancelar" | "mover"
//       - fecha_hora  (string, para mover) ISO Europe/Madrid de la hora NUEVA
//       - cita        (string, opcional)   fecha y hora de la cita a tocar,
//                                          si tiene varias ("2026-10-02T10:00")
//       - telefono    (string, opcional)   si no, el número desde el que llama
//
// Respuesta: { success, message } — `message` es lo que Carmen dice.
// =============================================================================
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { timingSafeEqual } from "node:crypto";
import { resolverSalonDeLlamada, MENSAJE_SIN_SALON } from "@/lib/carmen-salon";
import { citasActivasDeCliente, cambiarEstadoRecord, reprogramarRecord, type BookingRecord } from "@/lib/booking";
import { normalizarFecha, PASADO } from "@/lib/fecha-es";
import { huecosCercanos, cuandoHablado, listaDeOpciones } from "@/lib/guion-huecos";
import { getRedirectUri } from "@/lib/gmail";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a), bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
function autorizado(req: Request, h: Headers): "ok" | "no_secret_configured" | "unauthorized" {
  const expected = process.env.CARMEN_WEBHOOK_SECRET || "";
  if (!expected) return "no_secret_configured";
  const qp = new URL(req.url).searchParams.get("secret") || "";
  const hdr = h.get("x-carmen-secret") || "";
  return (qp && safeEqual(qp, expected)) || (hdr && safeEqual(hdr, expected)) ? "ok" : "unauthorized";
}
const asObj = (v: unknown): Record<string, unknown> | null => {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  if (typeof v === "string" && v.trim().startsWith("{")) {
    try { const o = JSON.parse(v); if (o && typeof o === "object") return o as Record<string, unknown>; } catch { /* noop */ }
  }
  return null;
};
const describir = (r: BookingRecord) => `${r.servicioNombre ? `${r.servicioNombre} ` : ""}${cuandoHablado(r.startIso)}`;
const responder = (success: boolean, message: string, extra: Record<string, unknown> = {}) => NextResponse.json({ success, message, ...extra });

export async function POST(req: Request) {
  const h = await headers();
  const a = autorizado(req, h);
  if (a === "no_secret_configured" && process.env.NODE_ENV === "production") return NextResponse.json({ success: false, message: "Falta CARMEN_WEBHOOK_SECRET." }, { status: 503 });
  if (a === "unauthorized") return NextResponse.json({ success: false, message: "No autorizado." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const call = asObj(body.call) || {};
  const fuentes = [asObj(body.args), asObj(body.arguments), asObj(body.parameters), asObj(body.params), asObj((asObj(body.function) || {}).arguments), body]
    .filter((c): c is Record<string, unknown> => c !== null);
  const get = (...keys: string[]): string | undefined => {
    for (const src of fuentes) for (const k of keys) { const v = src[k]; if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim(); }
    return undefined;
  };
  const accion = (get("accion", "action") || "consultar").toLowerCase();
  const telefono = get("telefono", "customer_phone", "phone") || String(call.from_number ?? "").trim();
  const salon = await resolverSalonDeLlamada(get("slug"), String(call.to_number ?? "").trim() || undefined);
  if (!salon.ok) return responder(false, MENSAJE_SIN_SALON, { reason: "salon_desconocido" });
  if (!telefono) return responder(false, "No tengo tu número para buscar la cita. ¿Me lo dices, por favor?", { reason: "no_phone" });

  const citas = await citasActivasDeCliente(salon.slug, telefono).catch(() => null);
  if (!citas) return responder(false, "Ahora mismo no puedo consultar la agenda. ¿Te llamamos en un momento para cerrarlo?", { reason: "error" });
  if (!citas.length) return responder(false, "No encuentro ninguna cita a tu nombre con este teléfono. ¿Puede estar con otro número?", { reason: "sin_citas" });

  const pedida = get("cita", "cita_actual", "fecha_cita");
  let cita = citas[0];
  if (pedida) {
    const iso = normalizarFecha(pedida);
    cita = citas.find((c) => c.startIso.slice(0, 16) === String(iso).slice(0, 16)) || citas.find((c) => c.startIso.slice(0, 10) === String(iso).slice(0, 10)) || cita;
  } else if (citas.length > 1 && accion !== "consultar") {
    return responder(false, `Tienes ${citas.length} citas: ${listaDeOpciones(citas.map((c) => c.startIso))}. ¿Cuál quieres ${accion === "mover" ? "cambiar" : "cancelar"}?`, {
      reason: "varias", citas: citas.map((c) => c.startIso),
    });
  }

  if (accion === "consultar") {
    return responder(true, citas.length === 1 ? `Tienes cita de ${describir(citas[0])}.` : `Tienes ${citas.length} citas: ${citas.map(describir).join("; ")}.`, {
      citas: citas.map((c) => c.startIso),
    });
  }

  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const redirectUri = getRedirectUri(host, proto);

  if (accion === "cancelar") {
    const r = await cambiarEstadoRecord(cita.id, "cancelada", redirectUri, salon.slug);
    if (!r.ok) return responder(false, "No he podido cancelarla ahora mismo. Te la cancela alguien del equipo en un momento.", { reason: r.reason });
    return responder(true, `Hecho, he cancelado tu cita de ${describir(cita)}. ¿Quieres que te busque otro día?`, { citaCancelada: cita.startIso });
  }

  if (accion === "mover") {
    const nuevaRaw = get("fecha_hora", "nueva_fecha", "fecha_nueva");
    if (!nuevaRaw) return responder(false, "¿A qué día y hora te la cambio?", { reason: "missing_fields" });
    const nueva = normalizarFecha(nuevaRaw);
    if (nueva === PASADO) return responder(false, "Esa hora ya ha pasado. ¿Qué otro momento te viene bien?", { reason: "pasado" });
    const r = await reprogramarRecord(cita.id, nueva, undefined, redirectUri, salon.slug);
    if (r.ok) return responder(true, `Listo, te la he cambiado al ${cuandoHablado(r.record.startIso)}.`, { citaNueva: r.record.startIso });
    if (r.reason === "slot_taken" || r.reason === "locked") {
      const opciones = await huecosCercanos(salon.tenantId, { startIso: nueva, motivo: cita.servicioNombre || "", empleadoId: cita.empleadoId }).catch(() => [] as string[]);
      return responder(false, `A esa hora no hay hueco.${opciones.length ? ` Te puedo ofrecer ${listaDeOpciones(opciones)}. ¿Cuál prefieres?` : " ¿Qué otro momento te viene bien?"}`, {
        reason: "slot_taken", alternativas: opciones,
      });
    }
    if (r.reason === "no_movible") return responder(false, "Esa cita ya no está activa, así que no la puedo mover. ¿Te busco una nueva?", { reason: "no_movible" });
    return responder(false, "No he podido cambiarla ahora mismo. Te llamamos en un momento para cerrarlo.", { reason: r.reason });
  }

  return responder(false, "¿Quieres cancelar la cita o cambiarla de hora?", { reason: "accion_desconocida" });
}
