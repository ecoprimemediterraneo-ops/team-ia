/**
 * Cron cada hora — procesa secuencias de email pendientes y re-contacto de leads fríos.
 * Registrar en cron-job.org: GET https://aiteam.marketing/api/cron/eva-sequences
 * Schedule: cada hora (0 * * * *)
 */
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { kvGet, kvSet } from "@/lib/supabase";
import { getSequence, getSequenceForSector } from "@/lib/sequences";
import { listLeads, getLead, addLeadActivity as addActivity, updateLead } from "@/lib/pipeline";
import { checkCronAuth } from "@/lib/cron-auth";
import type { SequenceEnrollment } from "@/app/api/eva/sequences/route";

export const runtime = "nodejs";

async function readEnrollments(): Promise<SequenceEnrollment[]> {
  return (await kvGet<SequenceEnrollment[]>("seq_enrollments")) ?? [];
}
async function writeEnrollments(data: SequenceEnrollment[]) {
  await kvSet("seq_enrollments", data);
}

export async function GET(req: Request) {
  const a = checkCronAuth(req);
  if (!a.ok) return NextResponse.json({ error: a.reason }, { status: 401 });

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return NextResponse.json({ skipped: "no resend key" });
  const resend = new Resend(apiKey);
  const from = process.env.RESEND_FROM || "Eva (AI-Team) <eva@aiteam.marketing>";

  const now = new Date();
  let stepsSent = 0;
  let recontactEnrolled = 0;

  // 1. Process pending sequence steps
  const enrollments = await readEnrollments();
  const updated: SequenceEnrollment[] = [];

  for (const enrollment of enrollments) {
    if (enrollment.done || enrollment.unsubscribed) {
      updated.push(enrollment);
      continue;
    }
    if (new Date(enrollment.nextSendAt) > now) {
      updated.push(enrollment);
      continue;
    }

    const seq = getSequence(enrollment.sequenceId);
    if (!seq) { updated.push({ ...enrollment, done: true }); continue; }

    const stepIndex = enrollment.currentStep; // 0-based index into steps array
    const step = seq.steps[stepIndex];
    if (!step) { updated.push({ ...enrollment, done: true }); continue; }

    const lead = await getLead(enrollment.leadId);
    if (!lead?.email) { updated.push({ ...enrollment, done: true }); continue; }

    const vars: Record<string, string> = {
      businessName: lead.businessName,
      contactName: lead.contactName ?? lead.businessName,
      reviewCount: String(lead.reviewCount ?? ""),
      sector: lead.sector,
      city: lead.city ?? "",
      unsubscribeUrl: `https://aiteam.marketing/api/eva/unsubscribe?leadId=${lead.id}`,
    };

    try {
      const subject = step.subject.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
      await resend.emails.send({ from, to: lead.email, subject, html: step.bodyHtml(vars) });
      await addActivity(lead.id, { type: "email_sent", data: { subject, sequenceId: seq.id, step: stepIndex + 1 } });
      stepsSent++;

      const nextIndex = stepIndex + 1;
      if (nextIndex >= seq.steps.length) {
        updated.push({ ...enrollment, currentStep: nextIndex, done: true });
      } else {
        const nextStep = seq.steps[nextIndex];
        const nextDate = new Date(now);
        nextDate.setDate(nextDate.getDate() + nextStep.delayDays);
        updated.push({ ...enrollment, currentStep: nextIndex, nextSendAt: nextDate.toISOString() });
      }
    } catch {
      updated.push(enrollment);
    }
  }

  await writeEnrollments(updated);

  // 2. Auto-enroll leads fríos (nurture 30/60/90d)
  const allLeads = await listLeads();
  const enrolledIds = new Set(updated.map((e) => `${e.leadId}:${e.sequenceId}`));

  for (const lead of allLeads) {
    if (!lead.email) continue;
    if (lead.stage === "client" || lead.stage === "lost") continue;

    const lastTouch = lead.lastTouchAt ?? lead.createdAt;
    const daysSinceTouch = Math.floor((now.getTime() - new Date(lastTouch).getTime()) / 86400000);

    // 30d nurture — if no cold sequence sent yet and 30+ days without contact
    if (daysSinceTouch >= 30 && daysSinceTouch < 45) {
      const key30 = `${lead.id}:nurture-30d`;
      if (!enrolledIds.has(key30)) {
        const enrollment: SequenceEnrollment = {
          leadId: lead.id,
          sequenceId: "nurture-30d",
          enrolledAt: now.toISOString(),
          currentStep: 0,
          nextSendAt: now.toISOString(),
          done: false,
          unsubscribed: false,
        };
        updated.push(enrollment);
        enrolledIds.add(key30);
        recontactEnrolled++;
      }
    }

    // 60d nurture
    if (daysSinceTouch >= 60 && daysSinceTouch < 75) {
      const key60 = `${lead.id}:nurture-60d`;
      if (!enrolledIds.has(key60)) {
        const enrollment: SequenceEnrollment = {
          leadId: lead.id,
          sequenceId: "nurture-60d",
          enrolledAt: now.toISOString(),
          currentStep: 0,
          nextSendAt: now.toISOString(),
          done: false,
          unsubscribed: false,
        };
        updated.push(enrollment);
        enrolledIds.add(key60);
        recontactEnrolled++;
      }
    }
  }

  if (recontactEnrolled > 0) await writeEnrollments(updated);

  return NextResponse.json({ ok: true, stepsSent, recontactEnrolled, ts: now.toISOString() });
}
