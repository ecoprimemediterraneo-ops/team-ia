// POST /api/booking/[slug]/chat — chat de dudas del cliente final (público).
// Contexto = servicios, precios, duraciones, horario y dirección del salón.
// Responde con Haiku (MODELS.fast). Si detecta intención de reservar, marca
// iniciarReserva:true para que el widget lleve al flujo de reserva.
import { NextResponse } from "next/server";
import { z } from "zod";
import { anthropic, MODELS } from "@/lib/claude";
import { getBusinessBySlug, type BusinessBooking } from "@/lib/booking";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

const schema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(2000) }))
    .min(1)
    .max(20),
});

const dur = (min: number) => (min >= 60 ? `${Math.floor(min / 60)}h${min % 60 ? ` ${min % 60}min` : ""}` : `${min} min`);

/** Contexto del negocio en texto para el system prompt de Haiku. */
function construirContexto(b: BusinessBooking): string {
  const catNombre = new Map(b.categorias.map((c) => [c.id, c.nombre]));
  const porCat = new Map<string, string[]>();
  for (const s of b.servicios.filter((x) => x.activo)) {
    const cat = (s.categoriaId && catNombre.get(s.categoriaId)) || "Otros";
    let precio = "";
    if (s.variantes?.length) {
      const min = Math.min(...s.variantes.map((v) => v.precioEUR));
      precio = `desde ${min}€`;
    } else if (typeof s.precioEUR === "number") {
      precio = `${s.precioEUR}€`;
    } else {
      precio = "consultar";
    }
    const linea = `  · ${s.nombre} — ${dur(s.durationMin)} — ${precio}${s.descripcion ? ` (${s.descripcion})` : ""}`;
    if (!porCat.has(cat)) porCat.set(cat, []);
    porCat.get(cat)!.push(linea);
  }
  const serviciosTxt = [...porCat.entries()].map(([cat, lineas]) => `${cat}:\n${lineas.join("\n")}`).join("\n");

  const horarioTxt = Object.entries(b.horario || {})
    .sort((a, b2) => (Number(a[0]) === 0 ? 7 : Number(a[0])) - (Number(b2[0]) === 0 ? 7 : Number(b2[0])))
    .map(([d, h]) => {
      const nombre = DIAS[Number(d)];
      if (!h.abierto || !h.franjas.length) return `  ${nombre}: cerrado`;
      return `  ${nombre}: ${h.franjas.map((f) => `${f.desde}-${f.hasta}`).join(", ")}`;
    })
    .join("\n");

  return `NEGOCIO: ${b.nombre}
${b.descripcion ? `DESCRIPCIÓN: ${b.descripcion}\n` : ""}${b.direccion ? `DIRECCIÓN: ${b.direccion}\n` : ""}${b.telefono ? `TELÉFONO: ${b.telefono}\n` : ""}${b.instagram ? `INSTAGRAM: @${b.instagram}\n` : ""}ZONA HORARIA: ${b.timezone}

SERVICIOS (nombre — duración — precio):
${serviciosTxt || "  (sin servicios cargados)"}

HORARIO:
${horarioTxt || "  (sin horario cargado)"}`;
}

function systemPrompt(b: BusinessBooking): string {
  return `Eres el asistente de reservas de "${b.nombre}", un salón de estética/belleza. Ayudas a los clientes a resolver dudas ANTES de reservar, por chat en la web de reservas.

${construirContexto(b)}

REGLAS:
- Español de España, tuteo, cercano y breve (1-3 frases). Sin emojis salvo que aporten.
- Responde SOLO con la información de arriba. Precios, duraciones, servicios, horario y dirección salen de ahí.
- Si te preguntan por disponibilidad concreta ("¿tenéis hueco el viernes?"), NO inventes huecos: explica el horario y anima a mirar los huecos reales pulsando en reservar (el calendario muestra la disponibilidad al momento).
- Si no sabes algo (p. ej. parking, formas de pago), dilo con naturalidad y sugiere llamar al teléfono${b.telefono ? ` (${b.telefono})` : ""}.
- Cuando el cliente muestre intención clara de reservar ("quiero pedir cita", "resérvame", "vale, lo cojo", elige un servicio para reservar), ayúdale y termina tu mensaje con la etiqueta exacta [RESERVAR] en una línea aparte. Usa [RESERVAR] solo cuando quiera reservar de verdad, no para dudas.`;
}

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const b = await getBusinessBySlug(slug);
  if (!b) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ ok: true, reply: "Ahora mismo no puedo responder por chat. Puedes ver los servicios y reservar directamente aquí abajo.", iniciarReserva: false });
  }

  try {
    const ai = await anthropic.messages.create({
      model: MODELS.fast, // Claude Haiku 4.5
      max_tokens: 500,
      system: systemPrompt(b),
      messages: parsed.data.messages,
    });
    let reply = ai.content.map((c) => (c.type === "text" ? c.text : "")).join("").trim();
    const iniciarReserva = /\[RESERVAR\]/i.test(reply);
    reply = reply.replace(/\[RESERVAR\]/gi, "").trim();
    return NextResponse.json({ ok: true, reply: reply || "¿En qué puedo ayudarte?", iniciarReserva });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "error" }, { status: 500 });
  }
}
