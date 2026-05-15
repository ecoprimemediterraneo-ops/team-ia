/**
 * Stripe webhook — registra eventos de suscripción.
 *
 * Configurar:
 *  1. En Stripe Dashboard → Developers → Webhooks → Add endpoint
 *  2. URL: https://aiteam.marketing/api/billing/webhook
 *  3. Eventos: checkout.session.completed, customer.subscription.updated,
 *     customer.subscription.deleted, invoice.payment_failed
 *  4. Copiar el signing secret y ponerlo en STRIPE_WEBHOOK_SECRET (Vercel env).
 */

import { NextResponse } from "next/server";
import type Stripe from "stripe";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeKey || !webhookSecret) {
    return NextResponse.json({ error: "Stripe webhook no configurado" }, { status: 503 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Falta firma" }, { status: 400 });

  const body = await req.text();
  const StripeMod = (await import("stripe")).default;
  const stripe = new StripeMod(stripeKey);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Firma inválida" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      console.log("[stripe] checkout completado", {
        email: session.customer_email,
        pack: session.metadata?.pack,
      });
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      console.log("[stripe]", event.type, { id: sub.id, status: sub.status });
      break;
    }
    case "invoice.payment_failed": {
      const inv = event.data.object as Stripe.Invoice;
      console.log("[stripe] pago fallido", { customer: inv.customer });
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
