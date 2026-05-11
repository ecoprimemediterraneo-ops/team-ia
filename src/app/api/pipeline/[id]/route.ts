import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { getLead, updateLead, moveLead, deleteLead, addLeadActivity, STAGE_ORDER } from "@/lib/pipeline";

const FOUNDER_EMAIL = process.env.FOUNDER_EMAIL || "ecoprimemediterraneo@gmail.com";
const isFounder = (e: string) => e === FOUNDER_EMAIL || e === "crisasky@gmail.com";

const patchSchema = z.object({
  stage: z.enum(STAGE_ORDER as [string, ...string[]]).optional(),
  notes: z.string().max(5000).optional(),
  tags: z.array(z.string()).optional(),
  contactName: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { email } = await requireSession();
    if (!isFounder(email)) return NextResponse.json({ error: "Solo founder" }, { status: 403 });
    const { id } = await params;
    const lead = await getLead(id);
    if (!lead) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    return NextResponse.json({ lead });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { email } = await requireSession();
    if (!isFounder(email)) return NextResponse.json({ error: "Solo founder" }, { status: 403 });
    const { id } = await params;
    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

    let lead;
    if (parsed.data.stage) {
      lead = await moveLead(id, parsed.data.stage as never);
    }
    const rest = { ...parsed.data };
    delete rest.stage;
    if (Object.keys(rest).length > 0) {
      lead = await updateLead(id, rest as Parameters<typeof updateLead>[1]);
    }
    if (!lead) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    return NextResponse.json({ ok: true, lead });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}

const activitySchema = z.object({
  type: z.enum(["email_sent", "email_opened", "email_replied", "whatsapp_sent", "whatsapp_replied", "call", "demo", "note"]),
  data: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { email } = await requireSession();
    if (!isFounder(email)) return NextResponse.json({ error: "Solo founder" }, { status: 403 });
    const { id } = await params;
    const body = await req.json();
    const parsed = activitySchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    const lead = await addLeadActivity(id, parsed.data);
    if (!lead) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    return NextResponse.json({ ok: true, lead });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { email } = await requireSession();
    if (!isFounder(email)) return NextResponse.json({ error: "Solo founder" }, { status: 403 });
    const { id } = await params;
    const ok = await deleteLead(id);
    return NextResponse.json({ ok });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
