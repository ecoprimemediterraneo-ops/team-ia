import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getUser, appendMessage, logActivity, bumpStats } from "@/lib/store";
import { anthropic, SYSTEM_BUILDERS, MODEL_BY_AGENT } from "@/lib/claude";
import type { AgentSlug } from "@/lib/agents";

const VALID = new Set<AgentSlug>(["lucia", "marta", "carmen", "pablo", "rocio", "eva", "sergio", "diana"]);

export async function POST(
  req: Request,
  { params }: { params: Promise<{ agent: string }> }
) {
  try {
    const { email } = await requireSession();
    const { agent } = await params;
    if (!VALID.has(agent as AgentSlug)) {
      return NextResponse.json({ error: "Agente no existe" }, { status: 404 });
    }
    const key = agent as AgentSlug;

    const user = await getUser(email);
    if (!user.business) return NextResponse.json({ error: "Falta briefing" }, { status: 400 });

    const { message } = await req.json();
    if (typeof message !== "string" || !message.trim()) {
      return NextResponse.json({ error: "Mensaje vacío" }, { status: 400 });
    }

    let system = SYSTEM_BUILDERS[key](user.business);

    // Skills dentales: si el negocio es clínica dental, enriquecer el prompt según contexto del mensaje.
    const sectorLower = (user.business?.sector || "").toLowerCase();
    if (sectorLower.includes("dental") || sectorLower.includes("dentista") || sectorLower.includes("odonto")) {
      const { buildDentalSystemPrompt } = await import("@/lib/skills/dental");
      system = buildDentalSystemPrompt(system, message);
    }

    // Inyectar lecciones aprendidas (gold standards) del usuario para este agente
    const { getLearnedPatterns } = await import("@/lib/store");
    const lessons = await getLearnedPatterns(email, key, 5);
    if (lessons.length > 0) {
      const lessonsBlock = lessons
        .map((l, i) => `Lección ${i + 1}:\nContexto: "${l.context}"\nRespuesta correcta validada por el usuario: "${l.goldStandard}"`)
        .join("\n\n");
      system += `\n\n────────────────────────────\nLECCIONES APRENDIDAS DE ESTE USUARIO\n────────────────────────────\nEl usuario ha corregido respuestas anteriores. Sigue su estilo:\n\n${lessonsBlock}`;
    }

    const history = user.chats[key];

    await appendMessage(email, key, { role: "user", content: message });

    const response = await anthropic.messages.create({
      model: MODEL_BY_AGENT[key],
      max_tokens: 1024,
      system,
      messages: [
        ...history.map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: message },
      ],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("\n");

    await appendMessage(email, key, { role: "assistant", content: text });
    await bumpStats(email, { lastChatAgent: key });
    await logActivity(email, {
      type: "chat",
      agent: key,
      detail: message.length > 60 ? message.slice(0, 57) + "…" : message,
    });

    return NextResponse.json({ reply: text });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}
