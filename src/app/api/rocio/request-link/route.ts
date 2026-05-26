/**
 * POST /api/rocio/request-link
 *   body: { location_id, channel: "whatsapp"|"sms"|"email", customer_name?, customer_phone?, customer_email? }
 * Genera el mensaje según canal + crea registro de tracking.
 * Devuelve el texto y el wa.me link (si es WhatsApp).
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getLocationForOwner, createRequest } from "@/lib/rocio-db";
import { getRocioProfile } from "@/lib/rocio-profile";
import { buildReviewRequestMessage } from "@/lib/rocio-responder";

const schema = z.object({
  location_id: z.string().uuid(),
  channel: z.enum(["whatsapp", "sms", "email"]),
  customer_name: z.string().max(120).optional(),
  customer_phone: z.string().max(40).optional(),
  customer_email: z.string().email().optional(),
});

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const loc = await getLocationForOwner(parsed.data.location_id, s.email);
  if (!loc) return NextResponse.json({ error: "Local no encontrado" }, { status: 404 });
  if (!loc.google_review_link) {
    return NextResponse.json({ error: "Este local no tiene link de Google. Edita el local y añade el link primero." }, { status: 400 });
  }

  const profile = await getRocioProfile(s.email);
  const businessName = profile.nombre_negocio || loc.name;

  const message = buildReviewRequestMessage(
    parsed.data.channel,
    parsed.data.customer_name ?? null,
    businessName,
    loc.google_review_link,
  );

  // Tracking
  await createRequest({
    owner_email: s.email,
    location_id: loc.id,
    customer_name: parsed.data.customer_name ?? null,
    customer_phone: parsed.data.customer_phone ?? null,
    customer_email: parsed.data.customer_email ?? null,
    channel: parsed.data.channel,
    message_sent: message,
  });

  // Si es WhatsApp, devolver wa.me link listo para abrir
  let actionUrl: string | null = null;
  if (parsed.data.channel === "whatsapp" && parsed.data.customer_phone) {
    const cleanPhone = parsed.data.customer_phone.replace(/[^\d]/g, "");
    actionUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  }

  return NextResponse.json({ ok: true, message, actionUrl, reviewLink: loc.google_review_link });
}
