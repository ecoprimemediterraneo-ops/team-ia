/**
 * GET   /api/marta/virales              — competidores + oportunidades
 * POST  /api/marta/virales               — varios actions:
 *   { action: "addCompetidor", username, motivo? }
 *   { action: "deleteCompetidor", id }
 *   { action: "analizarManual", descripcionViral, sourceUsername?, tipoContenido? }
 * PATCH /api/marta/virales               — cambia status oportunidad
 *   { id, action: "aceptar"|"descartar" }
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import {
  listCompetidores,
  addCompetidor,
  deleteCompetidor,
  listOportunidades,
  setOportunidadStatus,
  adaptarPostViral,
  saveOportunidad,
} from "@/lib/marta-virales";
import { getMartaProfile } from "@/lib/marta-profile";

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [competidores, oportunidades] = await Promise.all([
    listCompetidores(s.email),
    listOportunidades(s.email, "pending"),
  ]);
  return NextResponse.json({ competidores, oportunidades });
}

const addCompSchema = z.object({
  action: z.literal("addCompetidor"),
  username: z.string().min(2).max(255),
  motivo: z.string().max(200).optional(),
});
const delCompSchema = z.object({
  action: z.literal("deleteCompetidor"),
  id: z.string().uuid(),
});
const analizarSchema = z.object({
  action: z.literal("analizarManual"),
  descripcionViral: z.string().min(20).max(2000),
  sourceUsername: z.string().max(255).optional(),
  tipoContenido: z.string().max(40).optional(),
});

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  try {
    if (body.action === "addCompetidor") {
      const p = addCompSchema.safeParse(body);
      if (!p.success) return NextResponse.json({ error: p.error.issues[0].message }, { status: 400 });
      const c = await addCompetidor({ owner_email: s.email, username: p.data.username, motivo: p.data.motivo });
      return NextResponse.json({ competidor: c });
    }
    if (body.action === "deleteCompetidor") {
      const p = delCompSchema.safeParse(body);
      if (!p.success) return NextResponse.json({ error: p.error.issues[0].message }, { status: 400 });
      await deleteCompetidor(p.data.id, s.email);
      return NextResponse.json({ ok: true });
    }
    if (body.action === "analizarManual") {
      const p = analizarSchema.safeParse(body);
      if (!p.success) return NextResponse.json({ error: p.error.issues[0].message }, { status: 400 });
      const profile = await getMartaProfile(s.email);
      const adapt = await adaptarPostViral({
        descripcionViral: p.data.descripcionViral,
        sourceUsername: p.data.sourceUsername,
        tipoContenido: p.data.tipoContenido,
        profile,
      });
      const saved = await saveOportunidad({
        owner_email: s.email,
        source_username: p.data.sourceUsername,
        tipo_contenido: p.data.tipoContenido,
        ...adapt,
      });
      return NextResponse.json({ oportunidad: saved });
    }
    return NextResponse.json({ error: "Acción desconocida" }, { status: 400 });
  } catch (e) {
    console.error("[api]", e); return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

const patchSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(["aceptar", "descartar"]),
});
export async function PATCH(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const status = parsed.data.action === "aceptar" ? "aceptada" : "descartada";
  await setOportunidadStatus(parsed.data.id, s.email, status);
  return NextResponse.json({ ok: true });
}
