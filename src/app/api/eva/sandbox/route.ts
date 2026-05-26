/**
 * POST /api/eva/sandbox — genera una campaña ficticia para probar el tono.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getEvaProfile } from "@/lib/eva-profile";
import { generateEvaCampaign } from "@/lib/eva-responder";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

const schema = z.object({
  tipo: z.enum(["newsletter", "welcome", "promo", "reactivacion", "cumpleanos", "otro"]),
  briefing: z.string().min(5).max(2000),
  profileOverride: z.object({
    nombre_marca: z.string().optional(),
    sector: z.string().optional(),
    remitente_nombre: z.string().optional(),
    firma: z.string().optional(),
    tono_marca: z.string().optional(),
    reglas_custom: z.string().optional(),
    audiencia_target: z.string().optional(),
    cta_principal: z.string().optional(),
  }).optional(),
});

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = rateLimit({ key: "eva-sandbox", ip: getClientIp(req), limit: 20, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ error: `Espera ${Math.ceil(rl.resetIn / 1000)}s` }, { status: 429 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const stored = await getEvaProfile(s.email);
  const profile = {
    ...stored,
    ...(parsed.data.profileOverride
      ? {
          nombre_marca: parsed.data.profileOverride.nombre_marca ?? stored.nombre_marca,
          sector: parsed.data.profileOverride.sector ?? stored.sector,
          remitente_nombre: parsed.data.profileOverride.remitente_nombre ?? stored.remitente_nombre,
          firma: parsed.data.profileOverride.firma ?? stored.firma,
          tono_marca: parsed.data.profileOverride.tono_marca ?? stored.tono_marca,
          reglas_custom: parsed.data.profileOverride.reglas_custom ?? stored.reglas_custom,
          audiencia_target: parsed.data.profileOverride.audiencia_target ?? stored.audiencia_target,
          cta_principal: parsed.data.profileOverride.cta_principal ?? stored.cta_principal,
        }
      : {}),
  };

  const result = await generateEvaCampaign(parsed.data.tipo, parsed.data.briefing, profile);
  return NextResponse.json(result);
}
