import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { listLeads, createLead, pipelineStats, STAGE_ORDER } from "@/lib/pipeline";

const FOUNDER_EMAIL = process.env.FOUNDER_EMAIL || "ecoprimemediterraneo@gmail.com";

const createSchema = z.object({
  businessName: z.string().min(1).max(200),
  contactName: z.string().max(120).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(40).optional(),
  city: z.string().max(80).optional(),
  country: z.string().max(80).optional(),
  sector: z.string().min(1).max(80),
  subsector: z.string().max(80).optional(),
  size: z.enum(["1-3", "4-10", "11-50", "50+"]).optional(),
  website: z.string().url().optional(),
  rating: z.number().min(0).max(5).optional(),
  reviewCount: z.number().int().min(0).optional(),
  instagram: z.string().max(200).optional(),
  linkedin: z.string().max(200).optional(),
  stage: z.enum(STAGE_ORDER as [string, ...string[]]).default("new"),
  source: z.string().max(80).default("manual"),
  notes: z.string().max(5000).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
});

function isFounder(email: string) {
  return email === FOUNDER_EMAIL || email === "crisasky@gmail.com";
}

export async function GET() {
  try {
    const { email } = await requireSession();
    if (!isFounder(email)) return NextResponse.json({ error: "Solo founder" }, { status: 403 });
    const leads = await listLeads(email);
    const stats = await pipelineStats();
    return NextResponse.json({ leads, stats });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { email } = await requireSession();
    if (!isFounder(email)) return NextResponse.json({ error: "Solo founder" }, { status: 403 });
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    const lead = await createLead({
      ...parsed.data,
      stage: parsed.data.stage as never,
      ownerEmail: email,
    });
    return NextResponse.json({ ok: true, lead });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
