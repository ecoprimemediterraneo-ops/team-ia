// API del diagnóstico/auditoría con IA — FASE 2.
//   POST → ejecuta el motor (analiza web+IG+8 respuestas), calcula €/mes,
//          evalúa los 5 frentes y GUARDA el lead. Devuelve el resultado.
//   GET  → lista los diagnósticos guardados (para verificar la captación).
//          GET ?id=<id> → devuelve uno concreto.

import { NextResponse } from "next/server";
import { z } from "zod";
import { ejecutarDiagnostico, listarDiagnosticos, registrarEnvioInforme } from "@/lib/diagnostico";
import { enviarInformeDiagnostico, construirInformeEmail } from "@/lib/diagnostico-email";

export const runtime = "nodejs";
export const maxDuration = 60;

const respuestasSchema = z.object({
  q1_volumen: z.string().max(40).default(""),
  q2_tiempo: z.string().max(40).default(""),
  q3_fuera_horario: z.string().max(40).default(""),
  q4_ticket: z.string().max(20).default(""),
  q5_herramientas: z.string().max(600).default(""),
  q5_conectadas: z.string().max(40).default(""),
  q6_resenas: z.string().max(40).default(""),
  q7_origen: z.string().max(40).default(""),
  q8_seguimiento: z.string().max(40).default(""),
});

const schema = z.object({
  nombre: z.string().max(120).default(""),
  tipo: z.string().max(80).default(""),
  web: z.string().max(300).optional(),
  instagram: z.string().max(120).optional(),
  ciudad: z.string().max(80).optional(),
  googleNombre: z.string().max(120).optional(),
  email: z.string().email("Email no válido"),
  respuestas: respuestasSchema,
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { record, almacenado } = await ejecutarDiagnostico(parsed.data);

    // FASE 4 — Enviar el informe completo por email (Eva/Resend). NO bloquea ni
    // rompe la pantalla: enviarInformeDiagnostico nunca lanza (devuelve estado),
    // y registrarEnvioInforme es best-effort. Si el correo falla, el adelanto en
    // pantalla se muestra igual.
    const informeEmail = await enviarInformeDiagnostico(record);
    await registrarEnvioInforme(record.id, informeEmail);

    // Devolvemos el resultado completo (Fase 3 muestra solo el adelanto, el
    // detalle PROBLEMA+SOLUCIÓN va en el email de la Fase 4).
    return NextResponse.json({
      ok: true,
      id: record.id,
      almacenado, // "supabase" | "local"
      sector: record.sector,
      senales: {
        web: record.webSignals,
        instagram: record.igSignals,
        google: record.googleSignals,
      },
      resultado: record.resultado,
      informeEmail, // estado del envío (enviado / log_local / error) — para verificación
    });
  } catch (err) {
    console.error("[api/diagnostico] error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Error en el diagnóstico" },
      { status: 500 },
    );
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const all = await listarDiagnosticos();

    // Previsualizar el EMAIL completo (Fase 4) en el navegador, sin enviar nada.
    // Uso: /api/diagnostico?previewEmail=<id>  ó  ?previewEmail=last
    const previewEmail = searchParams.get("previewEmail");
    if (previewEmail) {
      const rec = previewEmail === "last" ? all[0] : all.find((d) => d.id === previewEmail);
      if (!rec) return NextResponse.json({ ok: false, error: "No encontrado" }, { status: 404 });
      const { html } = construirInformeEmail(rec);
      return new NextResponse(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
    }

    if (id) {
      const one = all.find((d) => d.id === id);
      return one
        ? NextResponse.json({ ok: true, diagnostico: one })
        : NextResponse.json({ ok: false, error: "No encontrado" }, { status: 404 });
    }
    // Resumen ligero para no volcar todo.
    return NextResponse.json({
      ok: true,
      total: all.length,
      items: all.slice(0, 50).map((d) => ({
        id: d.id,
        createdAt: d.createdAt,
        nombre: d.nombre,
        sector: d.sector,
        email: d.email,
        web: d.web,
        instagram: d.instagram,
        perdidaMesEUR: d.resultado?.dinero?.totalMesEUR,
        resumen: d.resultado?.resumenTitular,
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Error" },
      { status: 500 },
    );
  }
}
