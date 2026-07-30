// POST /api/admin/sector-lab — el MISMO mensaje, contestado por Pablo en los
// cuatro sectores, para poder comparar cómo suena cada uno.
//
// Es la prueba de que el perfil de sector hace algo de verdad: si las cuatro
// respuestas se parecen, el trabajo no está hecho.
//
// Solo fundador. Consume Claude (4 llamadas por prueba), por eso no es público.

import { NextResponse } from "next/server";
import { getSessionLocal } from "@/lib/auth";
import { anthropic, MODELS } from "@/lib/claude";
import { personaDesde } from "@/lib/persona";
import { SECTORES_LISTA, type SectorNegocio } from "@/lib/sectores";
import { getTenant } from "@/lib/tenants";
import { DEMOS } from "@/lib/sectores-demo";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const FOUNDER_EMAIL = process.env.FOUNDER_EMAIL || "ecoprimemediterraneo@gmail.com";
const esFundador = (e: string) => e === FOUNDER_EMAIL || e === "crisasky@gmail.com";
const esLocal = () => process.env.NODE_ENV !== "production" && !process.env.VERCEL;

export type RespuestaSector = {
  sector: SectorNegocio;
  label: string;
  negocio: string;
  respuesta: string;
  error?: string;
};

export async function POST(req: Request) {
  const s = await getSessionLocal();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!esFundador(s.email) && !esLocal()) {
    return NextResponse.json({ error: "solo founder" }, { status: 403 });
  }

  const { mensaje } = await req.json().catch(() => ({ mensaje: "" }));
  if (typeof mensaje !== "string" || !mensaje.trim()) {
    return NextResponse.json({ error: "Escribe un mensaje" }, { status: 400 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Falta ANTHROPIC_API_KEY: sin ella no hay respuestas que comparar." }, { status: 400 });
  }

  // Las cuatro en paralelo: es la misma pregunta, no dependen entre sí.
  const resultados = await Promise.all(
    SECTORES_LISTA.map(async (perfil): Promise<RespuestaSector> => {
      const demo = DEMOS.find((d) => d.sector === perfil.id);
      const tenant = demo ? await getTenant(demo.id) : null;
      const negocio = tenant?.ficha?.nombreNegocio || perfil.label;
      const system = personaDesde({
        agente: "pablo",
        canal: "whatsapp",
        sector: perfil.id,
        ficha: tenant?.ficha ?? null,
      });
      try {
        const r = await anthropic.messages.create({
          model: MODELS.fast,
          max_tokens: 400,
          system,
          messages: [{ role: "user", content: mensaje.trim() }],
        });
        const texto = r.content
          .filter((b) => b.type === "text")
          .map((b) => (b as { type: "text"; text: string }).text)
          .join("\n")
          .trim();
        return { sector: perfil.id, label: perfil.label, negocio, respuesta: texto };
      } catch (e) {
        return {
          sector: perfil.id,
          label: perfil.label,
          negocio,
          respuesta: "",
          error: e instanceof Error ? e.message : "error",
        };
      }
    }),
  );

  return NextResponse.json({ mensaje: mensaje.trim(), resultados });
}
