import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { requireSession } from "@/lib/auth";
import { fetchInbox, getRedirectUri } from "@/lib/gmail";
import { anthropic } from "@/lib/claude";
import { getUser } from "@/lib/store";

export async function POST() {
  try {
    const { email } = await requireSession();
    const user = await getUser(email);
    const h = await headers();
    const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
    const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
    const result = await fetchInbox(email, getRedirectUri(host, proto), 20);
    if (!result) return NextResponse.json({ error: "Gmail no conectado" }, { status: 400 });

    const lines = result.messages.map((m, i) =>
      `${i + 1}. [${m.unread ? "NO LEÍDO" : "leído"}] DE: ${m.from} | ASUNTO: ${m.subject} | ${m.snippet}`
    ).join("\n");

    const businessCtx = user.business
      ? `Contexto del negocio: ${user.business.nombre} — ${user.business.sector}. Ofrece: ${user.business.ofrece}.`
      : "";

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      system: `Eres Lucía, asistente ejecutiva. Te dan los últimos 20 correos de la bandeja de entrada del jefe. ${businessCtx} Devuelve un análisis útil en español, formato markdown, con esta estructura exacta:

## 🔴 Urgente / responder hoy
Lista numerada con remitente y por qué es urgente. Si no hay, escribe "Nada urgente".

## 🟡 Importantes (responder esta semana)
Lista numerada.

## 🟢 Promociones / newsletters / ignorables
Cuenta total + 2-3 ejemplos.

## 📋 Acciones recomendadas
3-5 bullets concretos: "Llamar a X", "Confirmar cita Y", etc.

Sé conciso, directo, sin paja. El jefe está ocupado.`,
      messages: [{ role: "user", content: `Mis 20 últimos correos:\n\n${lines}` }],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("\n");

    return NextResponse.json({ summary: text, count: result.messages.length });
  } catch (e) {
    console.error("[api]", e); return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
