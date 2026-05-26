import { NextResponse } from "next/server";
import { z } from "zod";
import { anthropic, MODELS } from "@/lib/claude";
import { getResend, RESEND_FROM } from "@/lib/resend";
import fs from "node:fs/promises";
import path from "node:path";

const schema = z.object({
  nombre: z.string().min(1),
  email: z.string().email(),
  whatsapp: z.string().optional(),
  negocio: z.string().min(1),
  sector: z.enum(["dental", "estetica", "otro"]),
  ciudad: z.string().min(1),
  web: z.string().optional(),
  instagram: z.string().optional(),
  googleBusiness: z.string().optional(),
  respuestaWhatsapp: z.string().optional(),
  gestionSoftware: z.string().optional(),
  reseñasMes: z.string().optional(),
  publicacionesMes: z.string().optional(),
  emailMkt: z.string().optional(),
  cuelloBotella: z.string().optional(),
});

type Input = z.infer<typeof schema>;

const DATA_DIR = process.env.VERCEL ? "/tmp/aiteam-data" : path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "diagnosticos.json");

async function loadAll(): Promise<unknown[]> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf-8"));
  } catch {
    return [];
  }
}

async function saveAll(items: unknown[]) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(items, null, 2));
}

function systemPrompt() {
  return `Eres Diana (codename HOTEL-D8), agente IA auditora de clínicas dentales y estéticas en España. Tu trabajo es analizar la información del cliente y generar un informe de diagnóstico claro, directo y accionable.

REGLAS:
- Tono: directo, profesional, en español de España. Sin "como modelo de lenguaje".
- Estructura: usa secciones cortas con títulos claros, listas, y datos concretos.
- TIENES que estimar pérdida anual en euros basándote en datos realistas del sector:
  * Cita perdida en clínica dental: 60€ (limpieza) - 1.500€ (implante). Media razonable: 120€.
  * Cita perdida en clínica estética: 80€ (consulta) - 600€ (tratamiento). Media: 150€.
  * No-show medio sin recordatorios: 25-30% de citas.
  * Llamada perdida fuera de horario: 1 de cada 3 deriva a competencia.
  * Negocio sin email mkt: pierde 20-35% de retorno cliente.
- Sé específico con los cuellos de botella. Cita los datos del cliente.
- Cierra recomendando un plan específico de AI-Team:
  * Esencial 89€/mes: Pablo + Carmen + Rocío (problemas de comunicación + reseñas)
  * Completo 189€/mes: los 6 agentes activos (operación 360, añade Lucía + Eva + Marta)
  * Pro 389€/mes: Completo + onboarding 1:1 + multiusuario + integraciones a medida

FORMATO DE SALIDA (markdown plano, sin código):

# 📊 Diagnóstico de [Nombre del negocio]

## 🚦 Estado actual por área
- ✅/⚠️/🔴 **Web:** [análisis breve]
- ✅/⚠️/🔴 **Reseñas Google:** [análisis breve]
- ✅/⚠️/🔴 **WhatsApp:** [análisis breve]
- ✅/⚠️/🔴 **Redes sociales:** [análisis breve]
- ✅/⚠️/🔴 **Email marketing:** [análisis breve]
- ✅/⚠️/🔴 **Gestión:** [análisis breve]

## 🎯 Top 3 cuellos de botella
1. **[Título]** — [Por qué te cuesta dinero]
2. **[Título]** — [Por qué te cuesta dinero]
3. **[Título]** — [Por qué te cuesta dinero]

## 💸 Pérdida estimada anual
**[X.XXX € / año]**

Desglose:
- [Concepto 1]: [importe]
- [Concepto 2]: [importe]
- [Concepto 3]: [importe]

## ✅ Plan recomendado
**Pack [Local/Digital/Élite/Pro] · [precio]€/mes**

Cómo lo resuelve:
- [Agente 1] → soluciona [problema]
- [Agente 2] → soluciona [problema]
- [Agente 3] → soluciona [problema]

ROI estimado: tu equipo IA se paga solo con [X] citas recuperadas al mes.

## 🚀 Siguiente paso
Activa tu equipo en 24h con 6 meses gratis. Plaza fundador limitada: precio congelado para siempre.

[Activar mi equipo →](https://aiteam.marketing/reclutar)
`;
}

function userPrompt(d: Input) {
  return `DATOS DEL CLIENTE:
- Negocio: ${d.negocio}
- Sector: ${d.sector === "dental" ? "Clínica dental" : d.sector === "estetica" ? "Clínica estética" : "Otro"}
- Ciudad: ${d.ciudad}
- Web: ${d.web || "no facilitada"}
- Instagram: ${d.instagram || "no facilitado"}
- Google Business: ${d.googleBusiness || "no facilitado"}
- Tiempo medio respuesta WhatsApp: ${d.respuestaWhatsapp || "no especificado"}
- Software de gestión: ${d.gestionSoftware || "no especificado"}
- Reseñas Google nuevas/mes: ${d.reseñasMes || "no especificado"}
- Publicaciones IG/mes: ${d.publicacionesMes || "no especificado"}
- Email marketing: ${d.emailMkt || "no especificado"}
- Cuello de botella percibido: ${d.cuelloBotella || "no especificado"}

Genera el informe de diagnóstico para ${d.nombre} (propietario/a de ${d.negocio}) siguiendo el formato.`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const d = parsed.data;

    const completion = await anthropic.messages.create({
      model: MODELS.strong,
      max_tokens: 2200,
      system: systemPrompt(),
      messages: [{ role: "user", content: userPrompt(d) }],
    });

    const block = completion.content[0];
    const informe = block && block.type === "text" ? block.text : "";

    // Guardar registro
    const items = await loadAll();
    items.push({ ...d, informe, fecha: new Date().toISOString() });
    await saveAll(items);

    // Email
    try {
      const resend = getResend();
      await resend.emails.send({
        from: RESEND_FROM,
        to: d.email,
        subject: `Diagnóstico de ${d.negocio} — AI-Team`,
        text: informe + "\n\n— Diana · HOTEL-D8\nhttps://aiteam.marketing",
      });
    } catch (mailErr) {
      console.error("[diagnostico] email fallo:", mailErr);
    }

    return NextResponse.json({ ok: true, informe });
  } catch (e) {
    console.error("[diagnostico]", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
