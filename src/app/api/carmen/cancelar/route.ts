// POST /api/carmen/cancelar — FUNCTION DE RETELL (en directo, durante la llamada).
// Cuando la clienta quiere CANCELAR o MOVER su cita, Carmen llama a esta función:
// buscamos su(s) cita(s) activa(s) por su teléfono y le ENVIAMOS por WhatsApp el
// enlace de autocancelación web (por token). Carmen no dicta el enlace: lo manda por
// WhatsApp (mismo sistema que Pablo, sendWhatsAppText) y dice que ya se lo ha enviado.
//
// Alta en Retell (Custom function):
//   · URL (POST):  https://aiteam.marketing/api/carmen/cancelar?secret=CARMEN_WEBHOOK_SECRET
//   · Params opcionales: telefono, slug (si no llegan, usa call.from_number y el salón piloto).
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { timingSafeEqual } from "node:crypto";
import { getBusinessBySlug } from "@/lib/booking";
import { resolverCancelacion, textoCancelacionChat, textoCancelacionVoz } from "@/lib/booking-cancel-intent";
import { sendWhatsAppText } from "@/lib/whatsapp-sender";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULT_SLUG = "bendito-arte"; // salón piloto de Carmen si Retell no manda slug

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a), bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
function auth(req: Request, h: Headers): "ok" | "no_secret_configured" | "unauthorized" {
  const expected = process.env.CARMEN_WEBHOOK_SECRET || "";
  if (!expected) return "no_secret_configured";
  const qp = new URL(req.url).searchParams.get("secret") || "";
  const hdr = h.get("x-carmen-secret") || "";
  if ((qp && safeEqual(qp, expected)) || (hdr && safeEqual(hdr, expected))) return "ok";
  return "unauthorized";
}
function asObj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

export async function POST(req: Request) {
  const h = await headers();
  const a = auth(req, h);
  if (a === "no_secret_configured") {
    // En dev sin secreto, permitimos para poder probar; en prod exigimos secreto.
    if (process.env.NODE_ENV === "production") return NextResponse.json({ success: false, message: "Falta CARMEN_WEBHOOK_SECRET." }, { status: 503 });
  } else if (a === "unauthorized") {
    return NextResponse.json({ success: false, message: "No autorizado." }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const call = asObj(body.call) || {};
  const containers = [asObj(body.args), asObj(body.arguments), asObj(body.parameters), asObj(body.params), asObj((asObj(body.function) || {}).arguments), body].filter((c): c is Record<string, unknown> => c !== null);
  const get = (...keys: string[]): string | undefined => {
    for (const src of containers) for (const k of keys) { const v = src[k]; if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim(); }
    return undefined;
  };

  const fromNumber = String(call.from_number ?? "").trim() || undefined;
  const telefono = get("telefono", "customer_phone", "phone", "telefono_cliente", "numero") || fromNumber;
  const slug = get("slug", "salon", "negocio", "business", "tenant", "salon_slug") || DEFAULT_SLUG;

  if (!telefono) {
    return NextResponse.json({ success: false, reason: "no_phone", message: "No tengo tu número para localizar la cita. ¿Me lo dices, por favor?" });
  }
  const business = await getBusinessBySlug(slug);
  if (!business) {
    return NextResponse.json({ success: false, reason: "no_business", message: "No he podido localizar el salón. Inténtalo de nuevo en un momento." });
  }

  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const baseUrl = `${proto}://${host}`;

  const caso = await resolverCancelacion(slug, telefono, baseUrl);

  // Enviar el/los enlace(s) por WhatsApp (mismo mecanismo que Pablo). Best-effort.
  let waEnviado = false, waModo = "no_intentado";
  if (caso.caso !== "ninguna") {
    const texto = textoCancelacionChat(caso, `${baseUrl}/reservas/${slug}`);
    const r = await sendWhatsAppText(telefono, texto);
    waEnviado = r.ok; waModo = r.ok ? "enviado" : r.reason;
  }

  return NextResponse.json({
    success: true,
    caso: caso.caso,
    // Lo que Carmen DICE en la llamada (el enlace va por WhatsApp, no se dicta).
    message: textoCancelacionVoz(caso),
    whatsapp: { enviado: waEnviado, modo: waModo },
  });
}
