import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { upsertLead, listLeads, updateLeadStage, deleteLead, ETAPAS } from "@/lib/pablo-crm";

const createSchema = z.object({ phone: z.string().min(5), nombre: z.string().optional(), fuente: z.string().optional() });
const updateSchema = z.object({ action: z.literal("update"), id: z.string().uuid(), etapa: z.enum(ETAPAS).optional(), tags: z.array(z.string()).optional(), notas: z.string().optional(), valor_estim: z.number().optional() });
const deleteSchema = z.object({ action: z.literal("delete"), id: z.string().uuid() });

export async function GET(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const etapa = url.searchParams.get("etapa") || undefined;
  const items = await listLeads(s.email, etapa);
  return NextResponse.json({ items, etapas: ETAPAS });
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  if (body.action === "update") {
    const c = updateSchema.safeParse(body);
    if (!c.success) return NextResponse.json({ error: c.error.issues[0].message }, { status: 400 });
    const { action: _a, id, ...patch } = c.data;
    void _a;
    await updateLeadStage(id, s.email, patch);
    return NextResponse.json({ ok: true });
  }
  if (body.action === "delete") {
    const c = deleteSchema.safeParse(body);
    if (!c.success) return NextResponse.json({ error: c.error.issues[0].message }, { status: 400 });
    await deleteLead(c.data.id, s.email);
    return NextResponse.json({ ok: true });
  }
  const c = createSchema.safeParse(body);
  if (!c.success) return NextResponse.json({ error: c.error.issues[0].message }, { status: 400 });
  const lead = await upsertLead({ owner_email: s.email, ...c.data });
  return NextResponse.json({ lead });
}
