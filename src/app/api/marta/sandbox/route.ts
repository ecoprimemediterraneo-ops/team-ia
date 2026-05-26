/**
 * POST /api/marta/sandbox
 * Simula una conversación con Marta usando la config actual del cliente.
 * NO toca BD ni envía nada a Instagram. Solo prueba.
 *
 * Body: { messages: [{ role: "user"|"assistant", content: string }, ...] }
 * Devuelve: { intent, confidence, reasoning, respuesta }
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getMartaProfile, profileToNegocioConfig } from "@/lib/marta-profile";
import { classifyIgMessage } from "@/lib/marta-ig-classifier";
import { generateIgResponse, type NegocioConfig } from "@/lib/marta-ig-responder";
import type { Message } from "@/lib/marta-ig-db";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

const schema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string().min(1).max(2000),
    })
  ).min(1).max(20),
  // Permite probar con un perfil ad-hoc sin guardar (ej. mientras edita)
  profileOverride: z
    .object({
      nombre_negocio: z.string().optional(),
      sector: z.string().optional(),
      horario: z.string().optional(),
      servicios_destacados: z.string().optional(),
      tono_marca: z.string().optional(),
      reglas_custom: z.string().optional(),
    })
    .optional(),
});

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = rateLimit({ key: "marta-sandbox", ip: getClientIp(req), limit: 30, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Demasiadas pruebas. Espera ${Math.ceil(rl.resetIn / 1000)}s` },
      { status: 429 },
    );
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { messages, profileOverride } = parsed.data;

  // Construir NegocioConfig: perfil guardado + override opcional
  const stored = await getMartaProfile(s.email);
  const baseCfg = profileToNegocioConfig(stored);
  const cfg: NegocioConfig = {
    nombreNegocio: profileOverride?.nombre_negocio ?? baseCfg.nombreNegocio,
    sector: profileOverride?.sector ?? baseCfg.sector,
    horario: profileOverride?.horario ?? baseCfg.horario,
    serviciosDestacados: profileOverride?.servicios_destacados ?? baseCfg.serviciosDestacados,
    tonoMarca: profileOverride?.tono_marca ?? baseCfg.tonoMarca,
  };

  // Último mensaje del usuario es el que clasificamos y respondemos
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUser) {
    return NextResponse.json({ error: "Falta mensaje del usuario" }, { status: 400 });
  }

  // Historial = mensajes anteriores en formato compatible con classifier/responder
  const history: Message[] = messages.slice(0, -1).map((m, i) => ({
    id: `sandbox-${i}`,
    conversation_id: "sandbox",
    direction: m.role === "user" ? "in" : "out",
    message_type: "dm",
    content: m.content,
    media_url: null,
    intent: null,
    confidence: null,
    reasoning: null,
    responded_by: "bot",
    meta_message_id: null,
    created_at: new Date().toISOString(),
  }));

  // Clasificar
  const { intent, confidence, reasoning } = await classifyIgMessage(lastUser.content, history);

  // Si es queja/spam o confidence baja → marcar como "se escalaría a humano"
  const wouldEscalate = intent === "queja" || confidence < 0.7;
  let respuesta = "";
  if (intent === "spam") {
    respuesta = "(Marta ignoraría este mensaje por ser spam)";
  } else if (wouldEscalate) {
    respuesta = `(Marta NO respondería automáticamente — escalaría a humano por ${intent === "queja" ? "queja" : "baja confianza"}. Recibirías email para contestar tú.)`;
  } else {
    respuesta = await generateIgResponse(lastUser.content, intent, history, cfg);
  }

  return NextResponse.json({
    intent,
    confidence,
    reasoning,
    respuesta,
    wouldEscalate,
  });
}
