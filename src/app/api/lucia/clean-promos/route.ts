import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { requireSession } from "@/lib/auth";
import { archiveMessages, fetchInbox, getRedirectUri } from "@/lib/gmail";
import { anthropic } from "@/lib/claude";

export async function POST() {
  try {
    const { email } = await requireSession();
    const h = await headers();
    const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
    const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
    const redirect = getRedirectUri(host, proto);

    const inbox = await fetchInbox(email, redirect, 20);
    if (!inbox) return NextResponse.json({ error: "Gmail no conectado" }, { status: 400 });

    const lines = inbox.messages.map((m, i) => `${i + 1}. DE: ${m.from} | ASUNTO: ${m.subject} | ${m.snippet.slice(0, 120)}`).join("\n");

    const ai = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      system: `Identifica qué correos son PROMOCIONES, NEWSLETTERS o NOTIFICACIONES AUTOMÁTICAS (claramente ignorables). NO marques: correos personales, de clientes, facturas, alertas de seguridad, recordatorios importantes. Devuelve SOLO los números separados por comas, sin texto adicional. Ejemplo: "2,5,8,12". Si ninguno es promo, devuelve "ninguno".`,
      messages: [{ role: "user", content: lines }],
    });

    const text = ai.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("")
      .trim()
      .toLowerCase();

    if (text.includes("ninguno") || !text) {
      return NextResponse.json({ archived: 0, identified: [] });
    }

    const indices = text.split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n) && n >= 1 && n <= inbox.messages.length);
    const ids = indices.map((i) => inbox.messages[i - 1].id);
    const identified = indices.map((i) => ({ from: inbox.messages[i - 1].from, subject: inbox.messages[i - 1].subject }));

    const archived = await archiveMessages(email, redirect, ids);
    return NextResponse.json({ archived, identified });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
