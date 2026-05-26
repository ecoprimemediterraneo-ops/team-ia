/**
 * POST /api/rocio/reviews
 *   body: { location_id?, reviewer_name?, rating, text }
 * Inserta una reseña (manual hoy, automático cuando llegue GBP API).
 * Automáticamente clasifica intent + genera respuesta propuesta + guarda en pending.
 * Si rating <= 2 → notifica al founder por email (escalado).
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { createReview, createRocioPending, listReviews } from "@/lib/rocio-db";
import { generateReviewResponse } from "@/lib/rocio-responder";
import { getRocioProfile } from "@/lib/rocio-profile";
import { getResend, RESEND_FROM } from "@/lib/resend";

const schema = z.object({
  location_id: z.string().uuid().optional(),
  reviewer_name: z.string().max(120).optional(),
  rating: z.number().int().min(1).max(5),
  text: z.string().min(2).max(3000),
});

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const reviews = await listReviews(s.email, { limit: 100 });
  return NextResponse.json({ reviews });
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const { location_id, reviewer_name, rating, text } = parsed.data;
  const isBad = rating <= 2;

  const review = await createReview({
    owner_email: s.email,
    location_id: location_id ?? null,
    reviewer_name: reviewer_name ?? null,
    rating,
    text,
    google_review_id: null,
    created_at_google: null,
    status: isBad ? "escalated" : "pending",
  });
  if (!review) return NextResponse.json({ error: "Supabase no configurado" }, { status: 500 });

  const profile = await getRocioProfile(s.email);
  const { response, intent } = await generateReviewResponse(
    { reviewerName: reviewer_name ?? null, rating, reviewText: text },
    profile,
  );

  const pending = await createRocioPending({
    owner_email: s.email,
    review_id: review.id,
    proposed_response: response,
    intent,
  });

  // Escalado de reseñas negativas → email founder
  if (isBad) {
    try {
      const resend = getResend();
      await resend.emails.send({
        from: RESEND_FROM,
        to: s.email,
        subject: `🔴 Rocío · Reseña negativa (${rating}★) recibida`,
        text: `Has recibido una reseña ${rating}★ que necesita tu atención.

De: ${reviewer_name || "Anónimo"}
Texto:
"${text}"

Rocío ha generado una respuesta propuesta y la ha guardado en la cola de aprobación. Revísala y apruebala/edítala desde:
https://aiteam.marketing/dashboard/rocio

— Rocío · GOLF-R2`,
      });
    } catch (e) {
      console.error("[rocio] notify bad review fail:", e);
    }
  }

  return NextResponse.json({ ok: true, review, pending });
}
