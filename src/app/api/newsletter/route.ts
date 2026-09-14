// Alta en la newsletter.
//
// Antes escribía en `data/newsletter.json` DENTRO del proyecto. En Vercel ese
// directorio es de solo lectura: el guardado reventaba y el visitante recibía
// un 500 justo después de darnos su correo. Ahora va por `listas-captacion.ts`
// (Supabase en producción, archivo local solo en desarrollo).

import { NextResponse } from "next/server";
import { z } from "zod";
import { apuntar, type ApuntadoNewsletter } from "@/lib/listas-captacion";

const schema = z.object({ email: z.string().email() });

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Email inválido" }, { status: 400 });
    }

    const res = await apuntar<ApuntadoNewsletter>("newsletter", {
      email: parsed.data.email,
      date: new Date().toISOString(),
    });

    if (res.duplicado) return NextResponse.json({ ok: true, message: "Ya estabas suscrito" });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[api/newsletter] no se pudo guardar la suscripción:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
