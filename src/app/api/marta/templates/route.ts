import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { EVENTOS_ES, generateTemplate, saveTemplate, listTemplates, deleteTemplate } from "@/lib/marta-templates";
import { getMartaProfile } from "@/lib/marta-profile";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

const createSchema = z.object({
  evento_key: z.string().min(1),
  tipo_pieza: z.enum(["post", "reel", "carrusel", "story"]),
  fecha_objetivo: z.string().optional(),
});

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const items = await listTemplates(s.email);
  return NextResponse.json({ eventos: EVENTOS_ES, items });
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rl = rateLimit({ key: "marta-tmpl", ip: getClientIp(req), limit: 15, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ error: `Espera ${Math.ceil(rl.resetIn / 1000)}s` }, { status: 429 });

  const body = await req.json();
  try {
    if (body.action === "delete") {
      if (typeof body.id !== "string") return NextResponse.json({ error: "id requerido" }, { status: 400 });
      await deleteTemplate(body.id, s.email);
      return NextResponse.json({ ok: true });
    }
    const c = createSchema.safeParse(body);
    if (!c.success) return NextResponse.json({ error: c.error.issues[0].message }, { status: 400 });
    const evento = EVENTOS_ES.find((e) => e.key === c.data.evento_key);
    if (!evento) return NextResponse.json({ error: "Evento desconocido" }, { status: 400 });

    const profile = await getMartaProfile(s.email);
    if (!profile.nombre_negocio) return NextResponse.json({ error: "Configura el editor de Marta primero" }, { status: 400 });

    const tmpl = await generateTemplate({ evento, tipoPieza: c.data.tipo_pieza, profile });
    if (!tmpl) return NextResponse.json({ error: "No se pudo generar" }, { status: 500 });

    const saved = await saveTemplate({
      owner_email: s.email,
      evento_key: evento.key,
      evento_nombre: evento.nombre,
      fecha_objetivo: c.data.fecha_objetivo || null,
      tipo_pieza: c.data.tipo_pieza,
      caption: tmpl.caption,
      hashtags: tmpl.hashtags,
      hook: tmpl.hook,
      cta: tmpl.cta,
      notas_visuales: tmpl.notas_visuales,
    });
    return NextResponse.json({ template: saved });
  } catch (e) {
    console.error("[api]", e); return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
