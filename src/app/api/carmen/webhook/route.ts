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
import { createHmac, timingSafeEqual } from "node:crypto";
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

// Comparación en tiempo constante (evita timing attacks al comparar secretos).
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Autentica la petición de Retell por TRES vías (en orden de preferencia):
 *   1. Firma nativa de Retell: header `x-retell-signature` = HMAC-SHA256(rawBody)
 *      con RETELL_API_KEY. La más segura (no viaja ningún secreto en la URL).
 *   2. Secret por query param: `?secret=<CARMEN_WEBHOOK_SECRET>`. Funciona en
 *      versiones de Retell que NO permiten cabeceras personalizadas.
 *   3. Header `x-carmen-secret` (legacy, por compatibilidad).
 * Devuelve null si OK, o un mensaje de error si falla.
 */
function authRetell(req: Request, h: Headers, rawBody: string): string | null {
  const url = new URL(req.url);
  const secretExpected = process.env.CARMEN_WEBHOOK_SECRET || "";
  const retellKey = process.env.RETELL_API_KEY || "";

  // Vía 1 — firma nativa de Retell
  const sig = h.get("x-retell-signature") || "";
  if (retellKey && sig) {
    const expectedSig = createHmac("sha256", retellKey).update(rawBody).digest("hex");
    // Retell puede prefijar el algoritmo; comparamos contra hex puro y v=hex.
    if (safeEqual(sig, expectedSig) || safeEqual(sig.replace(/^v=?/, ""), expectedSig)) {
      return null;
    }
  }

  // Vía 2 — secret por query param
  const qpSecret = url.searchParams.get("secret") || "";
  if (secretExpected && qpSecret && safeEqual(qpSecret, secretExpected)) return null;

  // Vía 3 — header legacy
  const hdrSecret = h.get("x-carmen-secret") || "";
  if (secretExpected && hdrSecret && safeEqual(hdrSecret, secretExpected)) return null;

  if (!secretExpected && !retellKey) {
    return "no_auth_configured"; // ni CARMEN_WEBHOOK_SECRET ni RETELL_API_KEY en server
  }
  return "auth_failed";
}

export async function POST(req: Request) {
  const h = await headers();

  // Necesitamos el cuerpo en crudo para verificar la firma de Retell.
  const rawBody = await req.text();

  const authErr = authRetell(req, h, rawBody);
  if (authErr === "no_auth_configured") {
    return NextResponse.json(
      { ok: false, error: "Falta CARMEN_WEBHOOK_SECRET (o RETELL_API_KEY) en el servidor." },
      { status: 503 },
    );
  }
  if (authErr) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: RetellPayload;
  try {
    body = JSON.parse(rawBody) as RetellPayload;
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
