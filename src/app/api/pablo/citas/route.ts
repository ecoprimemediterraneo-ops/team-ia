import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { createCita, listCitas, updateCita, deleteCita, generateRecordatorioText } from "@/lib/pablo-crm";
import { getPabloProfile } from "@/lib/pablo-profile";

const createSchema = z.object({ lead_id: z.string().uuid().optional(), phone: z.string().min(5), nombre: z.string().optional(), servicio: z.string().optional(), scheduled_at: z.string(), duracion_min: z.number().optional(), notas: z.string().optional() });
const updateSchema = z.object({ action: z.literal("update"), id: z.string().uuid(), status: z.enum(["programada", "confirmada", "completada", "no_show", "cancelada"]).optional() });

export async function GET(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const status = url.searchParams.get("status") || undefined;
  const items = await listCitas(s.email, status);
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  if (body.action === "update") {
    const c = updateSchema.safeParse(body);
    if (!c.success) return NextResponse.json({ error: c.error.issues[0].message }, { status: 400 });
    await updateCita(c.data.id, s.email, c.data.status ? { status: c.data.status } : {});
    return NextResponse.json({ ok: true });
  }
  if (body.action === "delete") {
    if (typeof body.id !== "string") return NextResponse.json({ error: "id requerido" }, { status: 400 });
    await deleteCita(body.id, s.email);
    return NextResponse.json({ ok: true });
  }
  if (body.action === "preview_recordatorio") {
    if (typeof body.id !== "string") return NextResponse.json({ error: "id requerido" }, { status: 400 });
    const profile = await getPabloProfile(s.email);
    const all = await listCitas(s.email);
    const cita = all.find((c: { id: string }) => c.id === body.id);
    if (!cita) return NextResponse.json({ error: "Cita no encontrada" }, { status: 404 });
    return NextResponse.json({
      recordatorio_24h: generateRecordatorioText({ tipo: "24h", profile, nombre: cita.nombre, servicio: cita.servicio, scheduled_at: cita.scheduled_at }),
      recordatorio_2h: generateRecordatorioText({ tipo: "2h", profile, nombre: cita.nombre, servicio: cita.servicio, scheduled_at: cita.scheduled_at }),
      followup: generateRecordatorioText({ tipo: "followup", profile, nombre: cita.nombre, servicio: cita.servicio, scheduled_at: cita.scheduled_at }),
    });
  }
  const c = createSchema.safeParse(body);
  if (!c.success) return NextResponse.json({ error: c.error.issues[0].message }, { status: 400 });
  const cita = await createCita({ owner_email: s.email, ...c.data });
  return NextResponse.json({ cita });
}
