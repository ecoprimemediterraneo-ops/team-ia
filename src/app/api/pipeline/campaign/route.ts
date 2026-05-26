/**
 * Lanza una campaña outreach: para cada lead filtrado, mete sus emails
 * en la cola de scheduled emails con los delays definidos.
 *
 * IMPORTANTE: NO envía inmediato. El cron eva-dispatcher lo procesa.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, isFounder } from "@/lib/auth";
import { listLeads, addLeadActivity, moveLead } from "@/lib/pipeline";
import { addScheduledEmail } from "@/lib/store";
import { fillLeadVars, OUTREACH_TEMPLATES } from "@/lib/email-personalization";


const schema = z.object({
  templateId: z.string(),
  filter: z.object({
    stage: z.string().optional(),
    sector: z.string().optional(),
    city: z.string().optional(),
  }).optional(),
  dryRun: z.boolean().default(false),
});

export async function POST(req: Request) {
  try {
    const { email } = await requireSession();
    if (!isFounder(email)) return NextResponse.json({ error: "Solo founder" }, { status: 403 });
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

    const template = OUTREACH_TEMPLATES[parsed.data.templateId];
    if (!template) return NextResponse.json({ error: "Template no encontrado" }, { status: 404 });

    let leads = await listLeads(email);
    if (parsed.data.filter?.stage) leads = leads.filter((l) => l.stage === parsed.data.filter!.stage);
    if (parsed.data.filter?.sector) leads = leads.filter((l) => l.sector === parsed.data.filter!.sector);
    if (parsed.data.filter?.city) leads = leads.filter((l) => l.city === parsed.data.filter!.city);

    // Solo a leads con email
    leads = leads.filter((l) => l.email && l.email.includes("@"));

    if (leads.length === 0) {
      return NextResponse.json({ error: "Ningún lead con email cumple el filtro" }, { status: 400 });
    }

    // Dry run: previsualizar primer lead
    if (parsed.data.dryRun) {
      const first = leads[0];
      const preview = template.sequence.map((s) => ({
        delayHours: s.delayHours,
        subject: fillLeadVars(s.subject, first),
        body: fillLeadVars(s.body, first),
        to: first.email,
      }));
      return NextResponse.json({ dryRun: true, leadsCount: leads.length, preview, firstLead: first.businessName });
    }

    // Encolar emails
    const now = Date.now();
    let totalScheduled = 0;
    for (const l of leads) {
      for (let i = 0; i < template.sequence.length; i++) {
        const s = template.sequence[i];
        await addScheduledEmail(email, {
          to: l.email!,
          subject: fillLeadVars(s.subject, l),
          body: fillLeadVars(s.body, l),
          scheduledFor: new Date(now + s.delayHours * 3600 * 1000).toISOString(),
        });
        totalScheduled++;
      }
      // Marcar como "contactado" en pipeline
      if (l.stage === "new" || l.stage === "enriched") {
        await moveLead(l.id, "contacted");
      }
      await addLeadActivity(l.id, {
        type: "email_sent",
        data: { template: parsed.data.templateId, count: template.sequence.length },
      });
    }

    return NextResponse.json({
      leadsTargeted: leads.length,
      emailsScheduled: totalScheduled,
      sequence: template.name,
    });
  } catch (e) {
    console.error("[api]", e); return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const { email } = await requireSession();
    if (!isFounder(email)) return NextResponse.json({ error: "Solo founder" }, { status: 403 });
    const templates = Object.entries(OUTREACH_TEMPLATES).map(([id, t]) => ({
      id,
      name: t.name,
      steps: t.sequence.length,
      preview: t.sequence[0].subject,
    }));
    return NextResponse.json({ templates });
  } catch (e) {
    console.error("[api]", e); return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
