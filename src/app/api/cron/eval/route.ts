/**
 * Cron diario: evalúa muestras aleatorias de respuestas de los agentes
 * con Claude como juez. Si el % de calidad baja del umbral, alerta al founder.
 *
 * Configurar en vercel.json:
 *   "crons": [{ "path": "/api/cron/eval", "schedule": "0 4 * * *" }]
 *
 * Protección: requiere header CRON_SECRET o Vercel Cron auto-añade Authorization.
 */

import { NextResponse } from "next/server";
import { Resend } from "resend";
import fs from "node:fs/promises";
import path from "node:path";
import type { UserData } from "@/lib/store";
import { anthropic } from "@/lib/claude";

const DATA_DIR = process.env.VERCEL ? "/tmp/aiteam-data" : path.join(process.cwd(), "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const EVALS_FILE = path.join(DATA_DIR, "evals.json");

type EvalResult = {
  ts: string;
  email: string;
  agent: string;
  userMessage: string;
  agentResponse: string;
  score: number; // 1-10
  reasoning: string;
};

async function readUsers(): Promise<Record<string, UserData>> {
  try {
    return JSON.parse(await fs.readFile(USERS_FILE, "utf-8"));
  } catch { return {}; }
}

async function appendEvals(results: EvalResult[]) {
  let arr: EvalResult[] = [];
  try {
    arr = JSON.parse(await fs.readFile(EVALS_FILE, "utf-8"));
  } catch { /* first run */ }
  arr.push(...results);
  // Keep last 1000
  arr = arr.slice(-1000);
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(EVALS_FILE, JSON.stringify(arr, null, 2));
}

async function evaluateSample(
  userMessage: string,
  agentResponse: string,
  businessSector: string
): Promise<{ score: number; reasoning: string }> {
  const r = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 200,
    system: `Eres juez de calidad de respuestas de IA para PYMEs. Sector del negocio: ${businessSector}.

Evalúa la respuesta del agente del 1 al 10 según:
- Relevancia (responde lo que se pregunta)
- Tono (humano, no robótico)
- Brevedad (no verboso)
- Acción clara (pide datos, propone hueco, etc.)
- Sin errores factuales obvios

Devuelve SOLO JSON: {"score": 1-10, "reasoning": "1 frase corta"}.`,
    messages: [
      {
        role: "user",
        content: `MENSAJE DEL CLIENTE/PACIENTE:\n"${userMessage}"\n\nRESPUESTA DEL AGENTE:\n"${agentResponse}"`,
      },
    ],
  });
  const text = r.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");
  try {
    const json = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || "{}");
    return {
      score: Math.max(1, Math.min(10, Number(json.score) || 5)),
      reasoning: String(json.reasoning || "").slice(0, 200),
    };
  } catch {
    return { score: 5, reasoning: "Parse error" };
  }
}

export async function GET(req: Request) {
  // Protección básica
  const auth = req.headers.get("authorization") || "";
  const expected = process.env.CRON_SECRET;
  if (expected && !auth.includes(expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const users = await readUsers();
  const results: EvalResult[] = [];
  const alerts: string[] = [];

  for (const [email, user] of Object.entries(users)) {
    if (!user.business) continue;
    const sector = user.business.sector;
    const allChats = Object.entries(user.chats).flatMap(([agent, msgs]) =>
      msgs.map((m, i) => ({ agent, msg: m, prev: i > 0 ? msgs[i - 1] : null }))
    );
    // Coger 3 muestras aleatorias de respuestas asistente con un mensaje de usuario antes
    const samples = allChats
      .filter((c) => c.msg.role === "assistant" && c.prev?.role === "user")
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);

    for (const s of samples) {
      try {
        const ev = await evaluateSample(s.prev!.content, s.msg.content, sector);
        const result: EvalResult = {
          ts: new Date().toISOString(),
          email,
          agent: s.agent,
          userMessage: s.prev!.content.slice(0, 500),
          agentResponse: s.msg.content.slice(0, 1000),
          score: ev.score,
          reasoning: ev.reasoning,
        };
        results.push(result);
        if (ev.score <= 4) {
          alerts.push(`⚠️ ${email} · ${s.agent} · score ${ev.score}/10 — "${ev.reasoning}"`);
        }
      } catch { /* skip */ }
    }
  }

  if (results.length > 0) await appendEvals(results);

  // Mandar email al founder con resumen
  const apiKey = process.env.RESEND_API_KEY;
  const founder = process.env.FOUNDER_EMAIL || "ecoprimemediterraneo@gmail.com";
  const from = process.env.RESEND_FROM || "AI-Team <onboarding@resend.dev>";
  if (apiKey && results.length > 0) {
    const avg = results.reduce((s, r) => s + r.score, 0) / results.length;
    const resend = new Resend(apiKey);
    try {
      await resend.emails.send({
        from,
        to: founder,
        subject: `📊 Eval diario AI-Team · ${results.length} muestras · score medio ${avg.toFixed(1)}/10${alerts.length > 0 ? ` · ${alerts.length} ALERTAS` : ""}`,
        html: `<div style="font-family:monospace;padding:16px">
          <h2>Eval automático del día</h2>
          <p>Muestras evaluadas: ${results.length}</p>
          <p>Score medio: <b>${avg.toFixed(1)}/10</b></p>
          ${alerts.length > 0
            ? `<h3 style="color:#C8202A">${alerts.length} alertas (score ≤ 4):</h3><ul>${alerts.map((a) => `<li>${a}</li>`).join("")}</ul>`
            : `<p style="color:#0a7e0a">✅ Sin alertas. Todos los agentes responden bien.</p>`}
        </div>`,
      });
    } catch { /* no critical */ }
  }

  return NextResponse.json({
    evaluated: results.length,
    averageScore: results.length > 0 ? results.reduce((s, r) => s + r.score, 0) / results.length : null,
    alerts: alerts.length,
  });
}
