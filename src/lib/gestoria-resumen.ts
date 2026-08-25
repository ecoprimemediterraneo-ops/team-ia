// Cómo está el día, en tres frases y en cristiano.
//
// POR QUÉ PROSA Y NO TARJETAS CON NÚMEROS
// ---------------------------------------
// Un panel con cinco tarjetas y cinco cifras obliga a Jose a leerlas, cruzarlas
// y decidir él qué significa el conjunto. Eso es exactamente el trabajo que se
// supone que le quitamos. Una secretaria no te enseña un cuadro de mandos: te
// dice "hoy tienes el aplazamiento de Bar El Puerto, que vence el sábado, y poco
// más". La cifra sirve cuando ya sabes qué buscas; la frase sirve cuando acabas
// de sentarte.
//
// LAS REGLAS DEL TEXTO, Y POR QUÉ CADA UNA
// ----------------------------------------
//   Tres frases como mucho.  Si son cinco, se lee la primera y se salta el resto.
//   Sin exclamaciones.       Un "¡Buenos días!" a las ocho de la mañana con dos
//                            requerimientos encima es una falta de respeto.
//   Sin palabras de software. "Registros", "ítems", "pendientes de procesar" no
//                            son palabras de gestoría.
//   Si el día está tranquilo, se dice.  Inventar urgencia para justificar la
//                            pantalla es la forma más rápida de que deje de
//                            creerse lo que pone.
//
// EL TEXTO SE CACHEA UNA HORA. Es una llamada de IA por carga si no; con Jose
// abriendo el panel veinte veces al día eso son veinte llamadas para contar lo
// mismo. La caché se tira sola cuando cambia el estado de verdad (ver `firma`).

import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { anthropic, MODELS } from "./claude";
import { kvGet, kvSet, supabaseEnabled } from "./supabase";
import { asuntosDelDia, type EstadoGestoria } from "./gestoria-estado";

const INSTRUCCIONES = `Eres la secretaria de una gestoría española. Te doy una lista de asuntos YA ORDENADA por urgencia y le escribes al gestor una línea por asunto.

CÓMO ESCRIBES CADA LÍNEA:
- UNA línea por asunto, en el MISMO orden en que te los doy. Ni los reordenes ni los juntes ni te saltes ninguno.
- Empieza cada línea con un guion y un espacio: "- ".
- UNA sola frase corta por línea. Menos de veinte palabras.
- El orden dentro de la frase: qué hay que hacer, de qué cliente, y al final cuándo vence.
- Español de España, tuteando. Como se lo dirías de viva voz.
- Copia las fechas TAL CUAL te las doy ("el lunes 24 de agosto"). No las traduzcas ni calcules tú los días.
- Nombra al cliente y las cifras concretas. "Bar El Puerto" y "1.180,44 €", no "un cliente".

LO QUE NO HACES NUNCA:
- Exclamaciones, ni saludos, ni emojis, ni negritas, ni asteriscos.
- Palabras de software: registros, ítems, procesar, sistema, plataforma, pendientes de revisión.
- Consejos ni órdenes: nada de "hay que hacerlo ya" o "conviene revisar". Cuentas lo que hay.
- Inventarte nada. Si un dato no está en lo que te doy, no existe.
- Escribir un párrafo. Son líneas sueltas, cada una con su guion.

Responde SOLO con las líneas. Sin introducción, sin cierre, sin numerarlas.`;

/** Como mucho cinco. Con seis ya no es un vistazo, es una lista que hay que leerse. */
const MAX_PUNTOS = 5;

/**
 * Deja la respuesta del modelo en COMO MUCHO cinco puntos, uno por línea.
 *
 * El tope y el formato se imponen AQUÍ, no se piden. Se pidieron: unas veces
 * devolvía cinco líneas y otras un párrafo de seis frases, y una portada que a
 * ratos es una lista y a ratos un ladrillo no se puede mirar de un vistazo. Un
 * formato del que depende el diseño de la pantalla no puede quedar a criterio
 * de un modelo.
 *
 * Se recorta por líneas enteras y se les quita cualquier adorno que se le haya
 * escapado (asteriscos, numeración, viñetas raras).
 */
export function aPuntos(texto: string, maximo = MAX_PUNTOS): string[] {
  return texto
    .split("\n")
    .map((l) =>
      l
        .trim()
        // "- ", "• ", "* ", "1. ", "1) " → fuera. El guion lo pone la pantalla.
        .replace(/^[-–—•*]\s*/, "")
        .replace(/^\d+[.)]\s*/, "")
        // Negritas de markdown, que se verían como asteriscos.
        .replace(/\*\*/g, "")
        .trim(),
    )
    .filter((l) => l.length > 1)
    .slice(0, maximo);
}

type Cacheado = { puntos: string[]; firma: string; hechoEn: string };

const CLAVE = (t: string) => `gestoria:resumen:${t}`;
const FICHERO = path.join(process.cwd(), "data", "gestoria-resumen.json");
const UNA_HORA = 60 * 60 * 1000;

/**
 * La huella del estado. Si cambia, el resumen caducado aunque no haya pasado la
 * hora: entra un requerimiento nuevo y el texto tiene que decirlo ya, no dentro
 * de cincuenta minutos.
 */
function firma(e: EstadoGestoria): string {
  return [
    e.hoy,
    e.agenda.total,
    e.agenda.vencidas.length,
    e.agenda.urgentes.length,
    e.agenda.estaSemana.length,
    e.agenda.criticas.length,
    e.documentos.hoy,
    e.documentos.sinIdentificar,
    e.documentos.duplicadosMes,
    e.banco.cargosSinFactura,
    e.banco.pagadoSinFactura.length,
  ].join("|");
}

async function leerCache(tenantId: string): Promise<Cacheado | null> {
  if (supabaseEnabled()) return (await kvGet<Cacheado>(CLAVE(tenantId))) ?? null;
  try {
    const todo = JSON.parse(await fs.readFile(FICHERO, "utf-8")) as Record<string, Cacheado>;
    return todo[tenantId] ?? null;
  } catch {
    return null;
  }
}

async function guardarCache(tenantId: string, c: Cacheado): Promise<void> {
  if (supabaseEnabled()) { await kvSet(CLAVE(tenantId), c); return; }
  await fs.mkdir(path.dirname(FICHERO), { recursive: true });
  let todo: Record<string, Cacheado> = {};
  try { todo = JSON.parse(await fs.readFile(FICHERO, "utf-8")); } catch { /* primera vez */ }
  todo[tenantId] = c;
  await fs.writeFile(FICHERO, JSON.stringify(todo, null, 2));
}

/**
 * Lo que se dice cuando no hay IA disponible.
 *
 * No es un texto de relleno: son los mismos datos, escritos a mano. Una portada
 * en blanco porque falta una clave de API es peor que una frase sosa, y mentir
 * ("todo en orden") cuando hay dos requerimientos encima es inaceptable.
 */
export function resumenSinIA(e: EstadoGestoria): string[] {
  const asuntos = asuntosDelDia(e);
  if (!asuntos.length) return ["No hay nada pendiente con fecha límite."];
  // Los datos crudos ya vienen legibles: se enseñan tal cual, sin adornar. Una
  // portada sosa es mucho mejor que una portada vacía o que una que miente.
  return asuntos.slice(0, MAX_PUNTOS).map((a) => a.texto);
}

export type Resumen = {
  /** Una línea por asunto. La pantalla les pone el guion. */
  puntos: string[];
  /** Cuántos asuntos quedan fuera del tope. 0 = están todos. */
  restantes: number;
  hechoEn: string;
  conIA: boolean;
};

/**
 * El resumen del día. Cacheado una hora, o hasta que cambie el estado.
 *
 * Nunca lanza y nunca devuelve vacío: si la IA falla, se escribe a mano con los
 * mismos datos.
 */
export async function resumenDelDia(
  tenantId: string,
  estado: EstadoGestoria,
  opts: { forzar?: boolean } = {},
): Promise<Resumen> {
  // CUÁLES y EN QUÉ ORDEN se decide aquí, no en el modelo. El modelo solo pone
  // las palabras. Ver `asuntosDelDia` para el porqué.
  const asuntos = asuntosDelDia(estado);
  const restantes = Math.max(0, asuntos.length - MAX_PUNTOS);
  const elegidos = asuntos.slice(0, MAX_PUNTOS);

  if (!elegidos.length) {
    return {
      puntos: ["No hay nada pendiente con fecha límite."],
      restantes: 0,
      hechoEn: new Date().toISOString(),
      conIA: false,
    };
  }

  const huella = firma(estado);
  const cache = await leerCache(tenantId).catch(() => null);
  if (
    !opts.forzar &&
    cache &&
    cache.firma === huella &&
    Date.now() - Date.parse(cache.hechoEn) < UNA_HORA
  ) {
    return { puntos: cache.puntos, restantes, hechoEn: cache.hechoEn, conIA: true };
  }

  const aMano = (): Resumen => ({
    puntos: resumenSinIA(estado),
    restantes,
    hechoEn: new Date().toISOString(),
    conIA: false,
  });

  if (!process.env.ANTHROPIC_API_KEY) return aMano();

  try {
    const res = await anthropic.messages.create(
      {
        model: MODELS.fast,
        // Espacio para cinco líneas cortas y poco más: con sitio de sobra se
        // explaya y hay que recortarle la mitad.
        max_tokens: 400,
        system: INSTRUCCIONES,
        messages: [{
          role: "user",
          content:
            `Escribe una línea por cada uno de estos ${elegidos.length} asuntos, en este mismo orden:\n\n` +
            elegidos.map((a, i) => `${i + 1}. ${a.texto}`).join("\n"),
        }],
      },
      { timeout: 25_000 },
    );

    const texto = res.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("")
      .trim()
      // Por si se le escapa una exclamación: se quita en vez de rehacer la
      // llamada. Una regla de estilo no merece pagar dos veces.
      .replace(/[¡!]/g, "");

    // El tope se aplica SIEMPRE, lo haya respetado o no.
    const puntos = aPuntos(texto, elegidos.length);

    // Si devuelve menos líneas de las que se le dieron, se ha comido asuntos: se
    // usa la versión a mano, que los tiene todos. Perder un vencimiento porque
    // el modelo lo juntó con otro no es un problema de estilo.
    if (puntos.length < elegidos.length) {
      console.warn(
        `[gestoria/resumen] devolvió ${puntos.length} líneas para ${elegidos.length} asuntos: se usa el respaldo.`,
      );
      return aMano();
    }

    const hechoEn = new Date().toISOString();
    await guardarCache(tenantId, { puntos, firma: huella, hechoEn }).catch(() => {});

    const { anotarLectura } = await import("./gestoria-coste");
    await anotarLectura({
      tenantId, modelo: MODELS.fast,
      entrada: res.usage.input_tokens, salida: res.usage.output_tokens,
    }).catch(() => {});

    return { puntos, restantes, hechoEn, conIA: true };
  } catch (e) {
    console.warn("[gestoria/resumen] la IA no ha contestado:", e instanceof Error ? e.message : e);
    return aMano();
  }
}
