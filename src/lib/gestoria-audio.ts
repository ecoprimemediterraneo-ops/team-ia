// Los audios que le manda el GESTOR a Pablo.
//
// OJO CON QUIÉN ESCRIBE. Hace dos días pusimos que Pablo conteste "los audios
// todavia no los escucho". Eso vale para los CLIENTES: abrir la transcripción a
// cualquiera que escriba al número es coste y es riesgo, y no se ha decidido.
// Para el gestor sí se transcribe: se lo dicta en el coche y Pablo tiene que
// actuar. Quien decide es el número: solo el `ownerWhatsapp` del tenant.
//
// Y SIEMPRE SE CONFIRMA POR ESCRITO lo que se ha entendido. Un audio mal
// transcrito que se apunta en silencio es una tarea inventada en la lista que
// ordena el día del gestor.

import "server-only";
import { anthropic, MODELS } from "./claude";
import { hoyMadrid } from "./gestoria-hoy";

/** ¿Es este número el del gestor de este tenant? */
export function esElGestor(telefono: string, ownerWhatsapp?: string): boolean {
  const a = (telefono || "").replace(/\D/g, "");
  const b = (ownerWhatsapp || "").replace(/\D/g, "");
  if (!a || !b) return false;
  // Se comparan los últimos nueve dígitos: el prefijo del país viene de una
  // forma en el tenant y de otra en el webhook de Meta.
  return a.slice(-9) === b.slice(-9);
}

export type Transcripcion = { ok: true; texto: string } | { ok: false; error: string };

/**
 * Audio → texto. Usa Whisper de OpenAI: Claude no oye.
 *
 * Sin OPENAI_API_KEY no se inventa nada — se dice que no se ha podido y Pablo
 * le pide al gestor que lo escriba.
 */
export async function transcribir(audio: Buffer, mime: string): Promise<Transcripcion> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { ok: false, error: "no hay OPENAI_API_KEY: no se pueden transcribir audios" };

  const ext = mime.includes("mp4") ? "mp4" : mime.includes("mpeg") ? "mp3" : mime.includes("wav") ? "wav" : "ogg";
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(audio)], { type: mime || "audio/ogg" }), `nota.${ext}`);
  form.append("model", "whisper-1");
  form.append("language", "es");

  try {
    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
      signal: AbortSignal.timeout(60_000),
    });
    const txt = await res.text();
    if (!res.ok) return { ok: false, error: `HTTP ${res.status} · ${txt.slice(0, 200).split(key).join("«oculto»")}` };
    const j = JSON.parse(txt) as { text?: string };
    if (!j.text?.trim()) return { ok: false, error: "la transcripción ha salido vacía" };
    return { ok: true, texto: j.text.trim() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export type Intencion =
  | { tipo: "recordatorio"; titulo: string; vence: string | null; clienteNombre: string | null; urgente: boolean }
  | { tipo: "pregunta"; sobre: "hoy" | "otra" }
  | { tipo: "otra" };

const INSTRUCCIONES = (hoy: string, clientes: string) => `Eres el ayudante de un gestor español. Te dan la transcripción de una nota de voz que el gestor le ha dictado a su ayudante.

Decide qué quiere:

- "recordatorio": quiere apuntar algo que hay que hacer. Saca:
  - titulo: qué hay que hacer, en una línea corta, sin "recuérdame que" ni "tengo que".
  - vence: la fecha límite en AAAA-MM-DD si la dice. Hoy es ${hoy}. Entiende "mañana", "el viernes", "el día 20", "antes de fin de mes". Si no dice ninguna fecha, null. NO INVENTES.
  - clienteNombre: el cliente, eligiendo SOLO de la lista. Si no lo dice o no está en la lista, null.
  - urgente: true si lo dice con sus palabras ("esto es urgente", "corre prisa", "para ya", "lo primero"). No lo deduzcas de la fecha.
- "pregunta": está preguntando algo. Si pregunta qué tiene hoy / qué le queda / qué hay pendiente, sobre = "hoy". Si no, sobre = "otra".
- "otra": ni una cosa ni la otra.

CLIENTES: ${clientes}

Responde SOLO con JSON, sin markdown:
{"tipo":"recordatorio","titulo":"...","vence":null,"clienteNombre":null,"urgente":false}
o {"tipo":"pregunta","sobre":"hoy"}
o {"tipo":"otra"}`;

/** Qué quería el gestor. Ante la duda, "otra": es mejor preguntar que apuntar mal. */
export async function entender(
  texto: string,
  clientes: Array<{ id: string; nombre: string }>,
): Promise<Intencion> {
  if (!process.env.ANTHROPIC_API_KEY) return { tipo: "otra" };
  try {
    const res = await anthropic.messages.create(
      {
        model: MODELS.fast,
        max_tokens: 400,
        system: INSTRUCCIONES(hoyMadrid(), clientes.map((c) => c.nombre).join(", ") || "(ninguno)"),
        messages: [{ role: "user", content: texto }],
      },
      { timeout: 30_000 },
    );
    const t = res.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("");
    const d = t.indexOf("{"), h = t.lastIndexOf("}");
    if (d < 0 || h <= d) return { tipo: "otra" };
    const j = JSON.parse(t.slice(d, h + 1)) as Record<string, unknown>;

    if (j.tipo === "pregunta") return { tipo: "pregunta", sobre: j.sobre === "hoy" ? "hoy" : "otra" };
    if (j.tipo === "recordatorio" && typeof j.titulo === "string" && j.titulo.trim()) {
      const nombre = typeof j.clienteNombre === "string" ? j.clienteNombre : null;
      return {
        tipo: "recordatorio",
        titulo: j.titulo.trim(),
        vence: typeof j.vence === "string" && /^\d{4}-\d{2}-\d{2}$/.test(j.vence) ? j.vence : null,
        // Igual que en las facturas: solo un cliente que esté de verdad en la lista.
        clienteNombre: nombre && clientes.some((c) => c.nombre === nombre) ? nombre : null,
        urgente: j.urgente === true,
      };
    }
    return { tipo: "otra" };
  } catch {
    return { tipo: "otra" };
  }
}
