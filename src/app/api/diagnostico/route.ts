// API del diagnóstico/auditoría con IA.
//   POST → PÚBLICO. Es el formulario que rellena el visitante: analiza
//          web+IG+8 respuestas, calcula €/mes, evalúa los 5 frentes y guarda el
//          lead. Lleva freno anti-bot (honeypot + límite por IP + validación).
//   GET  → SOLO ADMINISTRADOR. Lista los diagnósticos guardados.
//
// EL GET ERA PÚBLICO Y NO DEBÍA SERLO. Devolvía nombre, email, web e Instagram
// de todos los registros a cualquiera que tecleara la URL — 103 personas cuando
// se detectó. Ahora exige la misma sesión de fundador que el resto de /admin y,
// sin ella, contesta 401 sin filtrar un solo dato.

import { NextResponse } from "next/server";
import { z } from "zod";
import { headers } from "next/headers";
import { requireFounder } from "@/lib/admin-auth";
import { ejecutarDiagnostico, listarDiagnosticos, registrarEnvioInforme } from "@/lib/diagnostico";
import { enviarInformeDiagnostico, construirInformeEmail } from "@/lib/diagnostico-email";
import { pasaElFreno, ipDe, webParecePlausible } from "@/lib/anti-bot";

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
  // Campo TRAMPA. No se pinta para el visitante (ver DiagnosticoForm); un
  // navegador humano lo deja vacío y un bot que rellena todo lo que encuentra
  // lo completa. Si viene con algo, la petición se descarta EN SILENCIO.
  web_url: z.string().max(300).optional(),
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

    // --- Freno anti-bot ---
    // Se responde 200 con un ok:true de mentira a propósito: a un bot no se le
    // dice que ha sido detectado, porque entonces prueba otra cosa. Al visitante
    // real esto no le afecta nunca: el campo trampa está oculto para él.
    if (parsed.data.web_url && parsed.data.web_url.trim()) {
      console.warn("[api/diagnostico] honeypot relleno — petición descartada sin guardar");
      return NextResponse.json({ ok: true, id: "descartado" });
    }

    const h = await headers();
    const freno = pasaElFreno(ipDe(h));
    if (!freno.ok) {
      return NextResponse.json(
        { ok: false, error: "Demasiadas peticiones desde esta conexión. Inténtalo dentro de un rato." },
        { status: 429, headers: { "Retry-After": String(freno.esperaSeg) } },
      );
    }

    if (!webParecePlausible(parsed.data.web)) {
      return NextResponse.json(
        { ok: false, error: "La dirección de la web no parece válida. Revísala o déjala en blanco." },
        { status: 400 },
      );
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
  // Puerta ANTES de tocar nada: si no hay sesión de fundador, no se lee ni se
  // devuelve un solo registro.
  const auth = await requireFounder();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: auth.status });
  }
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
