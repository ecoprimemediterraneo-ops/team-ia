// POST /api/onboarding — cierra el alta de un negocio nuevo.
//
// Antes el alta solo guardaba el perfil en el store por login (`/api/perfil`) y
// NUNCA tocaba el tenant. Resultado: el cliente entraba a un panel genérico, sin
// sector, con los siete agentes y con las IAs hablando como un bot cualquiera.
//
// Esta ruta deja las TRES cosas montadas de una vez:
//   1. El tenant, con su sector y su ficha  → manda en el panel y en los prompts
//   2. Su negocio de reservas, con los servicios y el horario del sector
//   3. El perfil del store por login, para no romper las pantallas que aún lo leen
//
// Idempotente: si el usuario repite el alta, se actualiza lo que ya había.

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSessionLocal } from "@/lib/auth";
import { saveBusiness as saveBusinessLogin } from "@/lib/store";
import { aplicarAltaDeSector } from "@/lib/alta-sector";
import { esSectorNegocio } from "@/lib/sectores";

const schema = z.object({
  sector: z.string().refine(esSectorNegocio, "Sector no válido"),
  perfil: z.object({
    nombre: z.string().min(1).max(120),
    sector: z.string().min(1).max(200),
    ofrece: z.string().min(1).max(2000),
    tono: z.string().min(1).max(1000),
    publico: z.string().min(1).max(1000),
  }),
  servicios: z
    .array(
      z.object({
        nombre: z.string().min(1).max(120),
        durationMin: z.number().int().min(5).max(480),
        precioEUR: z.number().min(0).max(100000).optional(),
      }),
    )
    .max(40),
});

export async function POST(req: Request) {
  try {
    const { email } = await requireSessionLocal();
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const { sector, perfil, servicios } = parsed.data;

    // Lo importante: tenant + ficha + negocio de reservas.
    const r = await aplicarAltaDeSector({
      email,
      sector,
      perfil,
      servicios: servicios.filter((s) => s.nombre.trim()),
    });

    // Y el store por login, que aún lo leen algunas pantallas.
    await saveBusinessLogin(email, perfil);

    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    console.error("[onboarding] falló:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
