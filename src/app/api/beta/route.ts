import { NextResponse } from "next/server";
import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";
import { kvGet, kvSet } from "@/lib/supabase";
import { getResend, RESEND_FROM } from "@/lib/resend";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

const schema = z.object({
  nombre: z.string().min(2),
  email: z.string().email(),
  whatsapp: z.string().min(6),
  negocio: z.string().min(2),
  sector: z.string().min(2),
  ciudad: z.string().min(2),
  web: z.string().optional(),
  porQue: z.string().min(10),
  agentesInteres: z.array(z.string()).optional(),
  empleados: z.string().optional(),
});

type Beta = z.infer<typeof schema> & { fecha: string; estado: "pendiente" | "activo" | "cerrado" };

const DATA_DIR = process.env.VERCEL ? "/tmp/aiteam-data" : path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "beta.json");
const KV_KEY = "beta:all";
const USE_SUPABASE = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);

async function loadAll(): Promise<Beta[]> {
  if (USE_SUPABASE) {
    return (await kvGet<Beta[]>(KV_KEY)) || [];
  }
  try {
    return JSON.parse(await fs.readFile(FILE, "utf-8"));
  } catch {
    return [];
  }
}

async function saveAll(items: Beta[]) {
  if (USE_SUPABASE) {
    await kvSet(KV_KEY, items);
    return;
  }
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(items, null, 2));
}

export async function POST(req: Request) {
  try {
    const rl = rateLimit({ key: "beta", ip: getClientIp(req), limit: 3, windowMs: 60_000 });
    if (!rl.ok) {
      return NextResponse.json(
        { error: `Demasiadas peticiones. Espera ${Math.ceil(rl.resetIn / 1000)}s` },
        { status: 429 },
      );
    }
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const d = parsed.data;

    const items = await loadAll();
    const yaExiste = items.find((p) => p.email === d.email);
    if (yaExiste) {
      return NextResponse.json({ ok: true, message: "Ya tenías una solicitud en marcha. Te contactamos en 48h." });
    }

    const nuevo: Beta = { ...d, fecha: new Date().toISOString(), estado: "pendiente" };
    items.push(nuevo);
    await saveAll(items);

    // Email confirmación al lead
    try {
      const resend = getResend();
      await resend.emails.send({
        from: RESEND_FROM,
        to: d.email,
        subject: `Solicitud beta AI-Team recibida — ${d.negocio}`,
        text: `Hola ${d.nombre},

Hemos recibido tu solicitud para entrar en la beta privada de AI-Team. Gracias por tu interés.

Lo que sigue:

1. En menos de 48h te escribimos por email o WhatsApp (${d.whatsapp}) para una llamada de 30 min sin compromiso.
2. Si encajamos, activamos tu equipo de agentes IA gratis durante 3 meses completos.
3. A cambio te pedimos: 1 llamada semanal de 30 min, 1 formulario de feedback cada 2 semanas, y (con tu permiso) grabar la pantalla cuando uses el dashboard para mejorar el producto.
4. Pasados los 3 meses, si te ha servido: precio fundador 249€/mes congelado para siempre (vs 449€ del precio público).
5. Si no te ha servido: te das de baja sin permanencia. Te exportamos tus datos o los borramos.

Plazas limitadas a 10. Si no entras en esta tanda, te avisamos cuando abramos la siguiente.

Cualquier duda: responde a este email.

— Lucía · BRAVO-L4
AI-Team · https://aiteam.marketing`,
      });
    } catch (mailErr) {
      console.error("[beta] email fallo:", mailErr);
    }

    // Email aviso al founder
    try {
      const resend = getResend();
      await resend.emails.send({
        from: RESEND_FROM,
        to: process.env.FOUNDER_EMAIL || "ecoprimemediterraneo@gmail.com",
        subject: `🚨 Nueva solicitud BETA: ${d.negocio} (${d.ciudad})`,
        text: `Solicitud beta privada nueva:

NEGOCIO: ${d.negocio}
SECTOR: ${d.sector}
CIUDAD: ${d.ciudad}
NOMBRE: ${d.nombre}
EMAIL: ${d.email}
WHATSAPP: ${d.whatsapp}
WEB: ${d.web || "—"}
EMPLEADOS: ${d.empleados || "—"}
AGENTES INTERÉS: ${d.agentesInteres?.join(", ") || "—"}

DOLOR / POR QUÉ QUIERE:
${d.porQue}

— Contactar en menos de 48h. Está esperando.`,
      });
    } catch (e) {
      console.error("[beta] founder mail fail:", e);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[beta]", e);
    return NextResponse.json({ error: "Error al procesar" }, { status: 500 });
  }
}
