/**
 * Tomás 2.0 · Chat soporte IA con contexto del cliente.
 * Si Tomás no puede resolver en N turnos, escala a ticket.
 */
import { anthropic, MODELS } from "@/lib/claude";
import { getClientContext, contextToPromptString, type ClientContext } from "./tomas-context";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

function getDb() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createClient } = require("@supabase/supabase-js");
  return createClient(url, key);
}

export type TomasMessage = { role: "user" | "assistant"; content: string };

const SYSTEM = (ctxStr: string) => `Eres Tomás, agente de soporte 24/7 de AI-Team (aiteam.marketing).

REGLAS DURAS:
1. Castellano España. Tono cercano, directo, sin paja.
2. NUNCA digas "magnífica pregunta" ni preámbulos.
3. NUNCA inventes datos. Si no sabes algo, dilo.
4. Respuestas cortas (máx 4-6 frases) salvo que pidan paso a paso.
5. Tienes EL CONTEXTO REAL del cliente abajo. Úsalo. No respuestas genéricas.

QUÉ PUEDES HACER:
- Responder dudas sobre cómo usar cualquier agente (Pablo, Marta, Lucía, Eva, Rocío, Carmen, Sergio, Diana, Tomás).
- Diagnosticar problemas leyendo el estado de sus agentes.
- Dar pasos concretos para arreglar lo que falle.
- Si el cliente está bloqueado y NO puedes resolverlo, propón "escalar a Cristóbal" con frase clara: "Voy a pasar tu caso al equipo. Te contactarán en menos de 24h."

QUÉ NO PUEDES HACER:
- Ejecutar acciones en sus sistemas (de momento). Solo informar y guiar.
- Inventar funciones que no existen.
- Prometer plazos inventados.
- Hablar de precios o cobros (si preguntan, dirige a /precios).

CUÁNDO ESCALAR:
- Cliente lleva 3+ mensajes sin que resuelvas.
- Problema técnico raro fuera de tu alcance.
- Queja seria sobre cobros, RGPD, datos.
- Cliente pide explícitamente hablar con persona.

ESCALADO: cuando escales, añade al final de tu mensaje exactamente esta línea:
[ESCALATE: <asunto corto> | <prioridad: urgente|alta|normal|baja>]

${ctxStr}`;

export type ChatResult = {
  reply: string;
  escalated: boolean;
  ticket?: { asunto: string; prioridad: string };
};

export async function tomasChat(input: { owner_email: string; messages: TomasMessage[] }): Promise<ChatResult> {
  const ctx = await getClientContext(input.owner_email);
  const ctxStr = contextToPromptString(ctx);

  try {
    const c = await anthropic.messages.create({
      model: MODELS.fast,
      max_tokens: 800,
      temperature: 0.4,
      system: SYSTEM(ctxStr),
      messages: input.messages.map((m) => ({ role: m.role, content: m.content })),
    });
    const block = c.content[0];
    const text = block && block.type === "text" ? block.text.trim() : "";

    const escalateMatch = text.match(/\[ESCALATE:\s*(.+?)\s*\|\s*(urgente|alta|normal|baja)\s*\]/i);
    if (escalateMatch) {
      const asunto = escalateMatch[1].trim();
      const prioridad = escalateMatch[2].toLowerCase();
      const reply = text.replace(escalateMatch[0], "").trim();
      // Crear ticket
      const ticket = await createTicket({
        owner_email: input.owner_email,
        asunto,
        problema_cliente: input.messages.filter((m) => m.role === "user").map((m) => m.content).join("\n---\n").slice(0, 3000),
        diagnostico_tomas: reply,
        prioridad,
        contexto_cliente: ctx as unknown as Row,
      });
      // Notificar Cristóbal por email
      if (ticket) await notifyAdmin(ticket, ctx);
      return { reply, escalated: true, ticket: { asunto, prioridad } };
    }

    return { reply: text, escalated: false };
  } catch (e) {
    console.error("[tomas-chat]", e);
    return { reply: "Disculpa, ha habido un error. Vuelve a intentarlo en unos segundos.", escalated: false };
  }
}

export async function createTicket(input: {
  owner_email: string; asunto: string; problema_cliente: string; diagnostico_tomas: string;
  prioridad: string; contexto_cliente: Row;
}): Promise<Row | null> {
  const db = getDb();
  if (!db) return null;
  const { data, error } = await (db as Row).from("tomas_tickets").insert({
    owner_email: input.owner_email,
    asunto: input.asunto,
    problema_cliente: input.problema_cliente,
    diagnostico_tomas: input.diagnostico_tomas,
    prioridad: input.prioridad,
    contexto_cliente: input.contexto_cliente,
    status: "abierto",
  }).select().single();
  if (error) { console.error("[ticket]", error); return null; }
  return data;
}

export async function listTickets(opts: { status?: string; limit?: number } = {}) {
  const db = getDb(); if (!db) return [];
  let q = (db as Row).from("tomas_tickets").select("*");
  if (opts.status) q = q.eq("status", opts.status);
  const { data } = await q.order("created_at", { ascending: false }).limit(opts.limit ?? 100);
  return data ?? [];
}

export async function updateTicket(id: string, patch: { status?: string; resolucion?: string; asignado_a?: string }) {
  const db = getDb(); if (!db) return;
  const update: Row = { ...patch };
  if (patch.status === "resuelto" || patch.status === "cerrado") update.resolved_at = new Date().toISOString();
  await (db as Row).from("tomas_tickets").update(update).eq("id", id);
}

async function notifyAdmin(ticket: Row, ctx: ClientContext) {
  if (!process.env.RESEND_API_KEY) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getResend, RESEND_FROM } = require("./resend");
    const resend = getResend();
    const adminEmail = process.env.ADMIN_EMAIL || "ecoprimemediterraneo@gmail.com";
    const prioridadEmoji = ticket.prioridad === "urgente" ? "🚨" : ticket.prioridad === "alta" ? "⚠️" : "📋";

    await resend.emails.send({
      from: RESEND_FROM,
      to: adminEmail,
      subject: `${prioridadEmoji} Ticket AI-Team [${ticket.prioridad}] · ${ticket.asunto}`,
      html: `<div style="font-family:system-ui;max-width:680px;margin:0 auto">
<h2 style="border-bottom:3px solid #C8202A;padding-bottom:8px">${prioridadEmoji} ${ticket.asunto}</h2>
<p><b>Cliente:</b> ${ctx.email} · ${ctx.business_name || "(sin negocio)"} · ${ctx.sector || "(sin sector)"}</p>
<p><b>Plan:</b> ${ctx.plan || "sin plan"}</p>
<p><b>Tickets abiertos cliente:</b> ${ctx.active_tickets}</p>
<h3>🗣️ Lo que dijo el cliente:</h3>
<blockquote style="background:#FAF7F0;padding:12px;border-left:3px solid #000">${escapeHtml(ticket.problema_cliente).replace(/\n/g, "<br>")}</blockquote>
<h3>🤖 Diagnóstico de Tomás:</h3>
<blockquote style="background:#FFF4D6;padding:12px;border-left:3px solid #F5C518">${escapeHtml(ticket.diagnostico_tomas).replace(/\n/g, "<br>")}</blockquote>
<h3>📊 Estado de sus agentes:</h3>
<pre style="background:#f5f5f5;padding:10px;font-size:12px">${escapeHtml(JSON.stringify(ctx.agents_status, null, 2))}</pre>
<p style="margin-top:24px"><a href="https://aiteam.marketing/admin/tickets" style="background:#F5C518;color:#000;padding:10px 20px;text-decoration:none;border:2px solid #000;font-weight:bold">Ver en panel admin</a></p>
</div>`,
      text: `[${ticket.prioridad}] ${ticket.asunto}\n\nCliente: ${ctx.email}\nNegocio: ${ctx.business_name}\n\nProblema:\n${ticket.problema_cliente}\n\nDiagnóstico:\n${ticket.diagnostico_tomas}\n\nVer en: https://aiteam.marketing/admin/tickets`,
    });

    const db = getDb();
    if (db) await (db as Row).from("tomas_tickets").update({ notificado_email: true }).eq("id", ticket.id);
  } catch (e) { console.error("[tomas-notify]", e); }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c] || c));
}
