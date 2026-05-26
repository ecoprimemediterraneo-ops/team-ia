/**
 * POST /api/pablo/sandbox
 * Prueba Pablo con la config actual del cliente sin enviar nada a WhatsApp.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getPabloProfile } from "@/lib/pablo-profile";
import { profileToWaNegocio, generateWaResponse, type WaNegocioConfig } from "@/lib/pablo-wa-responder";
import { classifyWaMessage } from "@/lib/pablo-wa-classifier";
import type { WaMessage } from "@/lib/pablo-wa-db";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

const schema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().min(1).max(2000),
  })).min(1).max(20),
  profileOverride: z.object({
    nombre_negocio: z.string().optional(),
    sector: z.string().optional(),
    horario: z.string().optional(),
    servicios_destacados: z.string().optional(),
    tono_marca: z.string().optional(),
    reglas_custom: z.string().optional(),
  }).optional(),
});

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = rateLimit({ key: "pablo-sandbox", ip: getClientIp(req), limit: 30, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ error: `Espera ${Math.ceil(rl.resetIn / 1000)}s` }, { status: 429 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const { messages, profileOverride } = parsed.data;
  const stored = await getPabloProfile(s.email);
  const baseCfg = profileToWaNegocio(stored);
  const cfg: WaNegocioConfig = {
    nombreNegocio: profileOverride?.nombre_negocio ?? baseCfg.nombreNegocio,
    sector: profileOverride?.sector ?? baseCfg.sector,
    horario: profileOverride?.horario ?? baseCfg.horario,
    serviciosDestacados: profileOverride?.servicios_destacados ?? baseCfg.serviciosDestacados,
    tonoMarca: profileOverride?.tono_marca ?? baseCfg.tonoMarca,
    reglasCustom: profileOverride?.reglas_custom ?? baseCfg.reglasCustom,
  };

  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUser) return NextResponse.json({ error: "Falta mensaje" }, { status: 400 });

  const history: WaMessage[] = messages.slice(0, -1).map((m, i) => ({
    id: `sb-${i}`,
    conversation_id: "sandbox",
    direction: m.role === "user" ? "in" : "out",
    content: m.content,
    intent: null,
    confidence: null,
    reasoning: null,
    responded_by: "bot",
    wa_message_id: null,
    created_at: new Date().toISOString(),
  }));

  const { intent, confidence, reasoning } = await classifyWaMessage(lastUser.content, history);
  const wouldEscalate = intent === "queja" || confidence < 0.7;

  let respuesta = "";
  if (intent === "spam") respuesta = "(Pablo ignoraría este mensaje por ser spam)";
  else if (wouldEscalate) respuesta = `(Pablo NO respondería automáticamente — escalaría a humano por ${intent === "queja" ? "queja" : "baja confianza"}.)`;
  else respuesta = await generateWaResponse(lastUser.content, intent, history, cfg);

  return NextResponse.json({ intent, confidence, reasoning, respuesta, wouldEscalate });
}
