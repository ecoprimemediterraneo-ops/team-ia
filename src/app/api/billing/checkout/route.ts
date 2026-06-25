/**
 * Stripe checkout stub — listo para activar cuando tengamos las keys.
 *
 * Configurar:
 *  1. Crear cuenta en stripe.com
 *  2. Crear el producto Sistema Operativo (149€/mes fundador, 299€ normal) + extra Gestión (249€/mes)
 *  3. Para cada producto, crear un Price recurring monthly
 *  4. Copiar los price IDs y ponerlos en STRIPE_PRICES env var.
 *     (El enum interno aún usa local/digital/elite/pro como claves
 *      hasta que se haga la migración Stripe; ver TODO)
 *  5. Añadir STRIPE_SECRET_KEY a Vercel
 *  6. Configurar webhook en Stripe → /api/billing/webhook
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";

const schema = z.object({
  pack: z.enum(["local", "digital", "elite", "pro"]),
});

function parsePrices(): Record<string, string> {
  const raw = process.env.STRIPE_PRICES || "";
  const out: Record<string, string> = {};
  for (const pair of raw.split(",")) {
    const [k, v] = pair.split(":");
    if (k && v) out[k.trim()] = v.trim();
  }
  return out;
}

export async function POST(req: Request) {
  try {
    const { email } = await requireSession();
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    const prices = parsePrices();
    const priceId = prices[parsed.data.pack];

    if (!stripeKey || !priceId) {
      // Stripe no configurado todavía — devolvemos URL placeholder
      return NextResponse.json({
        url: null,
        message: "Stripe pendiente de configurar. Te contactaremos por email para procesar el pago manualmente con descuento fundador.",
      });
    }

    // Carga lazy de Stripe SDK (solo si está configurado)
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(stripeKey);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: email,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.PUBLIC_URL || "https://aiteam.marketing"}/dashboard?billing=ok`,
      cancel_url: `${process.env.PUBLIC_URL || "https://aiteam.marketing"}/#packs?billing=cancel`,
      subscription_data: {
        trial_period_days: 180,
        metadata: { user_email: email, pack: parsed.data.pack },
      },
    });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
