import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { requireSession } from "@/lib/auth";
import { fetchInbox, getRedirectUri } from "@/lib/gmail";
import { anthropic } from "@/lib/claude";
import { getUser } from "@/lib/store";
import { contextoPanelODefecto } from "@/lib/panel-contexto";
import { tieneFuncion } from "@/lib/sectores";

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

    // GESTORÍA: el resumen no opina sobre urgencia ni sobre qué hacer.
    //
    // Quién es importante lo dice la lista de remitentes, no el modelo. Y una
    // gestoría no puede tener a una IA diciendo plazos, obligaciones o
    // consecuencias fiscales: eso es asesorar, lo firma un profesional y aquí
    // se equivocaría con toda la seguridad del mundo. Lucía cuenta DE QUÉ VA
    // cada correo y se calla el resto.
    const ctx = await contextoPanelODefecto();
    const sinInterpretar = tieneFuncion(ctx.sector, "clasificacionCorreo");

    const systemGestoria = `Eres Lucía, la asistente de correo de una gestoría. Te dan los últimos 20 correos de la bandeja. ${businessCtx} Devuelve en español, formato markdown, un resumen de DE QUÉ VA cada cosa, agrupado así:

## 🏛️ De organismos y administración
Quién escribe y sobre qué asunto, en una línea por correo.

## 👤 De clientes
Quién escribe y qué pide o envía.

## 🧾 De proveedores y otros
Una línea por correo.

## 📰 Promociones y boletines
Solo el número total y 2-3 ejemplos.

PROHIBIDO, sin excepciones:
- NO digas qué hay que hacer, ni recomiendes acciones, ni priorices.
- NO menciones plazos, fechas límite, vencimientos ni "urgente".
- NO expliques obligaciones, consecuencias, sanciones ni nada fiscal o legal.
- NO decidas tú qué correo es importante: eso lo marca la lista de remitentes del gestor, no tú.

Si un correo parece exigir algo, describe lo que dice y punto: "Hacienda escribe sobre el modelo 303". El gestor decide. Sé conciso.`;

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      system: sinInterpretar ? systemGestoria : `Eres Lucía, asistente ejecutiva. Te dan los últimos 20 correos de la bandeja de entrada del jefe. ${businessCtx} Devuelve un análisis útil en español, formato markdown, con esta estructura exacta:

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
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
