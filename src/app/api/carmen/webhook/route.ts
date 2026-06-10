// Webhook de Carmen — Post-Call Data Extraction de Retell.
//
// FLUJO:
//   1. Cliente llama por teléfono. Retell levanta a Carmen (voz IA).
//   2. Al colgar, Retell ejecuta "Post-Call Data Extraction" sobre la
//      transcripción y nos manda un POST a esta ruta con los campos
//      extraídos.
//   3. Esta ruta llama a agendarCita() con agenteOrigen:"carmen".
//
// AUTH:
//   - Header: `X-Carmen-Secret: <CARMEN_WEBHOOK_SECRET>`
//     Inventa un secreto y configúralo en Retell + Vercel.
//
// PAYLOAD esperado (form JSON desde Retell):
//   {
//     "customer_name":   "María García",
//     "customer_phone":  "+34600111222",        // opcional
//     "appointment_motivo":   "Limpieza dental",
//     "appointment_datetime": "2026-06-15T10:00:00",   // ISO local Europe/Madrid
//     "duration_min":    30,                     // opcional, default 30
//     "call_id":         "call_xxx",             // opcional, para dedup
//     "transcript":      "..."                   // opcional, sólo log
//   }
//
// CÓMO CONFIGURAR EN RETELL (paso a paso):
//   1. Retell dashboard → tu agente "Carmen" → tab "Post-Call Analysis".
//   2. Define los siguientes "Custom Analysis Fields" (que Retell extrae
//      con LLM de la transcripción al final de cada llamada):
//        - customer_name           (Text)
//        - customer_phone          (Text)
//        - appointment_motivo      (Text)
//        - appointment_datetime    (Datetime · ISO 8601)
//        - duration_min            (Number, opcional)
//   3. Tab "Webhooks" → "Add webhook" → URL:
//        https://aiteam.marketing/api/carmen/webhook
//        Event: "call_analyzed".
//      Añade header: `X-Carmen-Secret: <el secreto que pongas en Vercel>`.
//   4. Vercel → Settings → Environment Variables → añade
//        CARMEN_WEBHOOK_SECRET = <el mismo valor>
//      en Production (y Preview si quieres testear).
//   5. Redeploya.

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { reservarSlot } from "@/lib/orchestrator";
import { getRedirectUri } from "@/lib/gmail";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RetellPayload = {
  customer_name?: string;
  customer_phone?: string;
  appointment_motivo?: string;
  appointment_datetime?: string;
  duration_min?: number;
  call_id?: string;
  transcript?: string;
  // Retell también puede mandar la estructura genérica:
  call_analysis?: {
    custom_analysis_data?: Record<string, unknown>;
  };
};

const FOUNDER_EMAIL = process.env.FOUNDER_EMAIL || "ecoprimemediterraneo@gmail.com";

function pick<T = string>(payload: RetellPayload, key: string): T | undefined {
  // primero a nivel raíz, luego en call_analysis.custom_analysis_data
  const direct = (payload as unknown as Record<string, unknown>)[key];
  if (direct !== undefined && direct !== null && direct !== "") return direct as T;
  const inner = payload.call_analysis?.custom_analysis_data?.[key];
  if (inner !== undefined && inner !== null && inner !== "") return inner as T;
  return undefined;
}

export async function POST(req: Request) {
  // Auth
  const h = await headers();
  const expected = process.env.CARMEN_WEBHOOK_SECRET || "";
  const provided = h.get("x-carmen-secret") || "";
  if (!expected) {
    return NextResponse.json({ ok: false, error: "CARMEN_WEBHOOK_SECRET no configurado en server." }, { status: 503 });
  }
  if (provided !== expected) {
    return NextResponse.json({ ok: false, error: "secret_mismatch" }, { status: 401 });
  }

  let body: RetellPayload;
  try {
    body = (await req.json()) as RetellPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  console.log("[carmen/webhook] payload:", JSON.stringify(body).slice(0, 1500));

  const nombre = pick<string>(body, "customer_name");
  const motivo = pick<string>(body, "appointment_motivo");
  const startIso = pick<string>(body, "appointment_datetime");
  const customerPhone = pick<string>(body, "customer_phone");
  const durationMin = Number(pick<number>(body, "duration_min")) || 30;

  if (!nombre || !motivo || !startIso) {
    return NextResponse.json({
      ok: false,
      error: "Faltan campos requeridos en la extracción de Retell",
      missing: { nombre: !nombre, motivo: !motivo, startIso: !startIso },
    }, { status: 422 });
  }

  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const redirectUri = getRedirectUri(host, proto);

  // Reserva vía ORQUESTADOR (disponibilidad + lock + log de decisión)
  const result = await reservarSlot({
    userEmail: FOUNDER_EMAIL,
    redirectUri,
    nombre,
    motivo,
    startIso,
    durationMin,
    agenteOrigen: "carmen",
    customerPhone,
  });

  if (!result.ok) {
    if (result.reason === "slot_taken") {
      return NextResponse.json({
        ok: false,
        error: "slot_taken",
        suggested: result.suggested,
        message: result.suggested
          ? `El hueco solicitado está ocupado. Sugerencia: ${result.suggested}`
          : "El hueco solicitado está ocupado y no hay alternativa ese día.",
      }, { status: 409 });
    }
    if (result.reason === "locked") {
      return NextResponse.json({ ok: false, error: "locked", message: "Otro agente está reservando ese hueco." }, { status: 423 });
    }
    return NextResponse.json({ ok: false, error: result.detail }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    eventId: result.eventId,
    htmlLink: result.htmlLink,
    eventLogId: result.eventLogId,
  });
}
