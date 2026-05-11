import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { getWelcomeSeries, saveWelcomeSeries } from "@/lib/store";

const schema = z.object({
  enabled: z.boolean(),
  emails: z.array(z.object({
    delayHours: z.number().int().min(0).max(720), // hasta 30 días
    subject: z.string().min(1).max(200),
    body: z.string().min(1).max(20000),
  })).min(1).max(10),
});

export async function GET() {
  try {
    const { email } = await requireSession();
    const series = await getWelcomeSeries(email);
    return NextResponse.json({ series: series || defaultSeries() });
  } catch {
    return NextResponse.json({ error: "Sesión inválida" }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const { email } = await requireSession();
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    await saveWelcomeSeries(email, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}

function defaultSeries() {
  return {
    enabled: false,
    emails: [
      {
        delayHours: 0,
        subject: "¡Bienvenid@ a {{negocio}}!",
        body: "Hola {{nombre}},\n\nGracias por unirte. Aquí estamos para lo que necesites.\n\nUn saludo,\nEquipo {{negocio}}",
      },
      {
        delayHours: 48,
        subject: "Esto es lo que ofrecemos en {{negocio}}",
        body: "Hola {{nombre}},\n\nQueremos contarte qué hacemos exactamente y cómo te podemos ayudar.\n\n[Personaliza este texto]\n\nSi te animas, contesta a este email o llámanos.\n\nUn saludo.",
      },
      {
        delayHours: 168,
        subject: "Una semana después · ¿podemos ayudarte con algo?",
        body: "Hola {{nombre}},\n\nHa pasado una semana desde que te uniste y queríamos saludarte.\n\nSi tienes alguna duda o quieres reservar una cita, responde a este email.\n\nGracias.",
      },
    ],
  };
}
