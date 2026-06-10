/**
 * POST /api/eva/sequences — Enrolla un lead en una secuencia de email.
 * GET  /api/eva/sequences — Lista secuencias disponibles.
 */
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getLead, addLeadActivity as addActivity } from "@/lib/pipeline";
import { SEQUENCES, getSequence, getSequenceForSector } from "@/lib/sequences";
import { Resend } from "resend";
import { kvGet, kvSet } from "@/lib/supabase";

export type SequenceEnrollment = {
  leadId: string;
  sequenceId: string;
  enrolledAt: string;
  currentStep: number;
  nextSendAt: string;
  done: boolean;
  unsubscribed: boolean;
};

async function readEnrollments(): Promise<SequenceEnrollment[]> {
  return (await kvGet<SequenceEnrollment[]>("seq_enrollments")) ?? [];
}
async function writeEnrollments(data: SequenceEnrollment[]) {
  await kvSet("seq_enrollments", data);
}

export async function GET() {
  return NextResponse.json({ sequences: SEQUENCES.map((s) => ({ id: s.id, name: s.name, sector: s.sector, steps: s.steps.length })) });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { leadId, sequenceId, autoDetect } = await req.json();
  if (!leadId) return NextResponse.json({ error: "leadId required" }, { status: 400 });

  const lead = await getLead(leadId);
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  let seqId = sequenceId;
  if (!seqId && autoDetect) {
    const seq = getSequenceForSector(lead.sector);
    seqId = seq?.id ?? "dental-cold";
  }
  if (!seqId) return NextResponse.json({ error: "sequenceId required" }, { status: 400 });

  const seq = getSequence(seqId);
  if (!seq) return NextResponse.json({ error: "Sequence not found" }, { status: 404 });

  const enrollments = await readEnrollments();
  const existing = enrollments.find((e) => e.leadId === leadId && e.sequenceId === seqId && !e.done);
  if (existing) return NextResponse.json({ error: "Already enrolled" }, { status: 409 });

  const enrollment: SequenceEnrollment = {
    leadId,
    sequenceId: seqId,
    enrolledAt: new Date().toISOString(),
    currentStep: 0,
    nextSendAt: new Date().toISOString(), // send step 1 immediately
    done: false,
    unsubscribed: false,
  };

  // Send first email immediately
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey && lead.email) {
    const resend = new Resend(apiKey);
    const step = seq.steps[0];
    const vars = {
      businessName: lead.businessName,
      contactName: lead.contactName ?? lead.businessName,
      reviewCount: String(lead.reviewCount ?? ""),
      sector: lead.sector,
      city: lead.city ?? "",
      unsubscribeUrl: `https://aiteam.marketing/api/eva/unsubscribe?leadId=${leadId}`,
    };
    await resend.emails.send({
      from: process.env.RESEND_FROM || "Eva (AI-Team) <eva@aiteam.marketing>",
      to: lead.email,
      subject: step.subject.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k as keyof typeof vars] ?? ""),
      html: step.bodyHtml(vars),
      replyTo: process.env.EVA_REPLY_TO || "cita@parse.aiteam.marketing",
    });
    await addActivity(leadId, { type: "email_sent", data: { subject: step.subject, sequenceId: seqId, step: 1 } });
    enrollment.currentStep = 1;
    // Set next send date based on step 2 delay
    if (seq.steps[1]) {
      const next = new Date();
      next.setDate(next.getDate() + seq.steps[1].delayDays);
      enrollment.nextSendAt = next.toISOString();
    } else {
      enrollment.done = true;
    }
  }

  enrollments.push(enrollment);
  await writeEnrollments(enrollments);

  return NextResponse.json({ ok: true, sequenceId: seqId, stepsTotal: seq.steps.length });
}
