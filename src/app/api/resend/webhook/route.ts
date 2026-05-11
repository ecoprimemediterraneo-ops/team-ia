/**
 * Webhook receptor de Resend.
 * Eventos relevantes:
 *  - email.opened   → busca lead por email destino → mueve a "engaged" + activity
 *  - email.clicked  → activity
 *  - email.bounced  → mueve a "lost"
 *  - email.complained → mueve a "lost" + log
 *
 * Configurar en Resend dashboard:
 *  Webhooks → Add endpoint → https://aiteam.marketing/api/resend/webhook
 *  Events: email.opened, email.clicked, email.bounced, email.complained, email.delivered
 *  Signing secret → RESEND_WEBHOOK_SECRET
 */

import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { Webhook } from "svix";
import { listLeads, addLeadActivity, moveLead } from "@/lib/pipeline";

function verify(body: string, headers: Headers): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return true; // permitir si no hay secret (dev)
  try {
    const wh = new Webhook(secret);
    wh.verify(body, {
      "svix-id": headers.get("svix-id") || "",
      "svix-timestamp": headers.get("svix-timestamp") || "",
      "svix-signature": headers.get("svix-signature") || "",
    });
    return true;
  } catch {
    // Fallback: simple HMAC check if Resend usa firma directa
    const sig = headers.get("resend-signature") || headers.get("x-resend-signature");
    if (!sig) return false;
    const computed = crypto.createHmac("sha256", secret).update(body).digest("hex");
    return computed === sig;
  }
}

async function findLeadByEmail(targetEmail: string) {
  const leads = await listLeads();
  return leads.find((l) => l.email?.toLowerCase() === targetEmail.toLowerCase());
}

export async function POST(req: Request) {
  try {
    const raw = await req.text();
    if (!verify(raw, req.headers)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const event = JSON.parse(raw);
    const type = event.type as string;
    const to = event.data?.to?.[0] || event.data?.email || "";

    if (!to) return NextResponse.json({ ok: true, skipped: "no email" });

    const lead = await findLeadByEmail(to);
    if (!lead) return NextResponse.json({ ok: true, skipped: "lead not in pipeline" });

    switch (type) {
      case "email.opened":
        await addLeadActivity(lead.id, { type: "email_opened", data: { subject: event.data?.subject } });
        if (lead.stage === "contacted") await moveLead(lead.id, "engaged");
        break;
      case "email.clicked":
        await addLeadActivity(lead.id, { type: "email_opened", data: { clicked: true, url: event.data?.link?.url } });
        if (lead.stage === "contacted" || lead.stage === "new") await moveLead(lead.id, "engaged");
        break;
      case "email.bounced":
      case "email.complained":
        await moveLead(lead.id, "lost");
        await addLeadActivity(lead.id, { type: "note", data: { reason: type } });
        break;
      case "email.delivered":
        // No movemos stage por delivered solo
        break;
    }

    return NextResponse.json({ ok: true, type, leadId: lead.id });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
