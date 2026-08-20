// La FECHA LÍMITE que trae un correo oficial.
//
// El correo importante ya se marca por REMITENTE: si escribe Hacienda, la
// Seguridad Social, el ayuntamiento o un juzgado, el correo salta. Eso dice que
// hay que mirarlo; no dice CUÁNDO vence. Y lo que ordena el día del gestor es
// la fecha, no quién escribe.
//
// Aquí se lee el texto y se saca el plazo. Tres reglas, y las tres son de no
// inventar:
//
//   1. Si NO hay fecha, se dice y se deja sin plazo. Una fecha inventada en una
//      lista ordenada por fecha es peor que no tener fecha: coloca el trabajo en
//      el sitio equivocado y el gestor se fía.
//   2. Si no se sabe de qué cliente es, va SIN cliente. Atribuir mal un
//      vencimiento fiscal es peor que dejarlo sin dueño.
//   3. Solo se eligen clientes de la lista que se le pasa. No se inventan
//      nombres a partir del texto.

import "server-only";
import { anthropic, MODELS } from "./claude";

export type PlazoCorreo = {
  /** "AAAA-MM-DD" o null si el correo no lo dice. */
  fechaLimite: string | null;
  /** Por qué esa fecha, o por qué no hay ninguna. Se enseña al gestor. */
  porQue: string;
  /** De qué va, en una línea que se entienda sin abrir el correo. */
  deQueVa: string;
  /** Id del cliente (su teléfono en dígitos) o null. Nunca se fuerza. */
  clienteId: string | null;
  clienteNombre: string | null;
  /** Pago, presentación, requerimiento, notificación… tal y como lo llama el correo. */
  tipo: string | null;
  modelo: string;
  tokens?: { entrada: number; salida: number };
};

export type ResultadoPlazo = { ok: true; plazo: PlazoCorreo } | { ok: false; error: string };

const INSTRUCCIONES = `Eres el ayudante de una gestoría española. Te dan un correo de un organismo oficial (Hacienda, Seguridad Social, un ayuntamiento, un juzgado) y una lista de clientes de la gestoría.

Saca TRES cosas:

1. La FECHA LÍMITE de pago o de presentación, si el correo la dice. En formato AAAA-MM-DD.
   - Si el correo da un plazo relativo ("diez días hábiles desde la notificación"), NO lo calcules: pon null y explica en porQue cuál es el plazo que dice.
   - Si no hay ninguna fecha límite, pon null. NO INVENTES UNA FECHA. Es la regla más importante.
   - Una fecha de emisión, de registro o de la propia notificación NO es una fecha límite.

2. DE QUÉ VA, en una línea corta y clara, como se lo dirías a un gestor con prisa.

3. A QUÉ CLIENTE corresponde, eligiendo SOLO de la lista que te doy. Compara por nombre y por NIF.
   Si no estás seguro, pon null. Atribuirlo al cliente equivocado es peor que dejarlo sin dueño.

Responde SOLO con este JSON, sin texto alrededor y sin markdown:
{
  "fechaLimite": "2026-09-20" o null,
  "porQue": "una frase: de dónde sale la fecha, o por qué no hay",
  "deQueVa": "una línea",
  "clienteId": "id exacto de la lista" o null,
  "tipo": "pago" | "presentacion" | "requerimiento" | "notificacion" | null
}`;

export async function leerPlazoDeCorreo(opts: {
  remitente: string;
  asunto: string;
  cuerpo: string;
  clientes: Array<{ id: string; nombre: string }>;
}): Promise<ResultadoPlazo> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, error: "No hay ANTHROPIC_API_KEY: el correo no se puede leer." };
  }

  const lista = opts.clientes.length
    ? opts.clientes.map((c) => `- id "${c.id}": ${c.nombre}`).join("\n")
    : "(la gestoría no tiene clientes dados de alta)";

  // El cuerpo se recorta: las notificaciones oficiales traen pies de página
  // kilométricos y el plazo siempre va arriba.
  const cuerpo = opts.cuerpo.slice(0, 6000);

  try {
    const res = await anthropic.messages.create(
      {
        model: MODELS.fast,
        max_tokens: 600,
        system: INSTRUCCIONES,
        messages: [{
          role: "user",
          content: `CLIENTES DE LA GESTORÍA:\n${lista}\n\nDE: ${opts.remitente}\nASUNTO: ${opts.asunto}\n\n${cuerpo}`,
        }],
      },
      { timeout: 40_000 },
    );

    const texto = res.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("");
    const desde = texto.indexOf("{");
    const hasta = texto.lastIndexOf("}");
    if (desde < 0 || hasta <= desde) return { ok: false, error: `no ha devuelto JSON: ${texto.slice(0, 160)}` };

    const j = JSON.parse(texto.slice(desde, hasta + 1)) as Record<string, unknown>;

    // Red de seguridad: solo se acepta una fecha con forma de fecha, y solo un
    // cliente que esté de verdad en la lista. Lo demás, null.
    const f = typeof j.fechaLimite === "string" && /^\d{4}-\d{2}-\d{2}$/.test(j.fechaLimite)
      ? j.fechaLimite : null;
    const id = typeof j.clienteId === "string" ? j.clienteId : null;
    const cliente = id ? opts.clientes.find((c) => c.id === id) ?? null : null;

    return {
      ok: true,
      plazo: {
        fechaLimite: f,
        porQue: typeof j.porQue === "string" ? j.porQue : "",
        deQueVa: typeof j.deQueVa === "string" && j.deQueVa.trim() ? j.deQueVa.trim() : opts.asunto,
        clienteId: cliente?.id ?? null,
        clienteNombre: cliente?.nombre ?? null,
        tipo: typeof j.tipo === "string" ? j.tipo : null,
        modelo: MODELS.fast,
        tokens: { entrada: res.usage.input_tokens, salida: res.usage.output_tokens },
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Lee el correo y lo apunta en la lista de HOY.
 *
 * Devuelve la tarea creada, o null si no se ha podido leer. No lanza: un fallo
 * leyendo un correo no puede romper la bandeja de Lucía.
 */
export async function apuntarPlazoDeCorreo(opts: {
  tenantId: string;
  remitente: string;
  asunto: string;
  cuerpo: string;
}): Promise<{ ok: true; tarea: import("./gestoria-hoy").Tarea; plazo: PlazoCorreo } | { ok: false; error: string }> {
  const { listarClientes } = await import("./gestoria-clientes");
  const { apuntarTarea } = await import("./gestoria-hoy");
  const { anotarLectura } = await import("./gestoria-coste");

  const clientes = await listarClientes(opts.tenantId).catch(() => []);
  const r = await leerPlazoDeCorreo({
    remitente: opts.remitente, asunto: opts.asunto, cuerpo: opts.cuerpo,
    clientes: clientes.map((c) => ({ id: c.id, nombre: c.nombre })),
  });
  if (!r.ok) return r;

  if (r.plazo.tokens) {
    await anotarLectura({
      tenantId: opts.tenantId, modelo: r.plazo.modelo,
      entrada: r.plazo.tokens.entrada, salida: r.plazo.tokens.salida,
    });
  }

  const tarea = await apuntarTarea(opts.tenantId, {
    titulo: r.plazo.deQueVa,
    // Sin fecha se dice AQUÍ, en el detalle, para que el gestor lo mire en vez
    // de que pase por una tarea sin plazo cualquiera.
    detalle: r.plazo.fechaLimite
      ? `De ${opts.remitente}. ${r.plazo.porQue}`
      : `De ${opts.remitente}. SIN FECHA LÍMITE en el correo — míralo. ${r.plazo.porQue}`,
    vence: r.plazo.fechaLimite,
    clienteId: r.plazo.clienteId,
    clienteNombre: r.plazo.clienteNombre,
    origen: "correo",
  });

  return { ok: true, tarea, plazo: r.plazo };
}
