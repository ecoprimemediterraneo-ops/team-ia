// =============================================================================
// LA VOZ DE CARMEN: cuál es, quién la elige y de dónde sale.
// =============================================================================
//
// LO PRIMERO, PORQUE SI NO SE CONFUNDE: CARMEN TIENE DOS VOCES.
//
//   1. La de las LLAMADAS DE TELÉFONO de verdad. Esa la pone **Retell**, y se
//      elige en el panel de Retell, no aquí. Este repositorio no llama a su API
//      en ningún sitio: solo recibe el webhook de después de colgar
//      (`/api/carmen/webhook`). Cambiar lo de este fichero NO cambia cómo suena
//      Carmen al descolgar el teléfono.
//   2. La del PANEL, el botón "Escucha cómo sonaría Carmen". Esa es la que vive
//      aquí, y es la que sirve para probar voces y para grabar un buzón.
//
// QUÉ ARREGLA ESTE FICHERO
// ------------------------
// El desplegable de voces del panel existía, pero era estado de React y nada
// más: volvía a "nova" en cada recarga y no lo sabía nadie más. Elegir una voz
// no era elegir nada, era una prueba que se olvidaba al momento.
//
// Ahora la elección SE GUARDA, y se guarda POR CLIENTE: una peluquería y una
// clínica dental no tienen por qué sonar igual, y hasta hoy sonaban igual
// porque la voz estaba escrita en el código.
//
// DOS PROVEEDORES, Y EL DE HOY NO SE TOCA
// ---------------------------------------
// Por defecto sigue siendo **OpenAI TTS con la voz `nova`**, exactamente lo que
// había. ElevenLabs se enciende solo si existe `ELEVENLABS_API_KEY` —que está
// dada de alta en Vercel desde hace meses sin que ninguna línea la usara— y sus
// voces se piden a su API en vez de escribirlas a mano: una lista escrita a mano
// se queda vieja el día que se añade una voz a la cuenta y nadie se entera.

import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { kvGet, kvSet, supabaseEnabled } from "./supabase";

export type Proveedor = "openai" | "elevenlabs";

export type VozDisponible = {
  proveedor: Proveedor;
  /** El identificador que entiende el proveedor. */
  id: string;
  /** Cómo se llama para una persona. */
  nombre: string;
  /** "mujer · cálida", "hombre · grave"… Puede ir vacío. */
  descripcion: string;
  /** Muestra que se puede escuchar sin gastar una generación. Solo ElevenLabs. */
  muestra?: string;
};

export type VozElegida = { proveedor: Proveedor; id: string };

/**
 * Lo que había antes de todo esto, escrito en
 * `src/app/api/carmen/voice/route.ts` como valor por defecto del esquema.
 * Se queda igual: nadie se encuentra la voz cambiada sin haberla cambiado.
 */
export const VOZ_POR_DEFECTO: VozElegida = { proveedor: "openai", id: "nova" };

/**
 * Las seis de OpenAI. Estas SÍ van escritas a mano y no pasa nada: son fijas,
 * las mismas para todas las cuentas del mundo, y no hay ninguna API que las
 * liste.
 */
export const VOCES_OPENAI: VozDisponible[] = [
  { proveedor: "openai", id: "nova", nombre: "Nova", descripcion: "mujer · cálida" },
  { proveedor: "openai", id: "shimmer", nombre: "Shimmer", descripcion: "mujer · suave" },
  { proveedor: "openai", id: "alloy", nombre: "Alloy", descripcion: "neutra" },
  { proveedor: "openai", id: "fable", nombre: "Fable", descripcion: "mujer · UK" },
  { proveedor: "openai", id: "echo", nombre: "Echo", descripcion: "hombre · grave" },
  { proveedor: "openai", id: "onyx", nombre: "Onyx", descripcion: "hombre · profundo" },
];

export const elevenLabsActivo = (): boolean => !!(process.env.ELEVENLABS_API_KEY || "").trim();

// -----------------------------------------------------------------------------
// Almacén — mismo patrón que el resto de la casa: Supabase en producción, JSON
// local cuando no hay credenciales. Por tenant.
// -----------------------------------------------------------------------------

const CLAVE = (tenantId: string) => `carmen:voz:${tenantId}`;
const FICHERO = path.join(process.cwd(), "data", "carmen-voz.json");

export async function leerVoz(tenantId: string): Promise<VozElegida> {
  try {
    if (supabaseEnabled()) return (await kvGet<VozElegida>(CLAVE(tenantId))) ?? VOZ_POR_DEFECTO;
    const raw = await fs.readFile(FICHERO, "utf-8").catch(() => "{}");
    const todo = raw.trim() ? (JSON.parse(raw) as Record<string, VozElegida>) : {};
    return todo[tenantId] ?? VOZ_POR_DEFECTO;
  } catch {
    // Ante cualquier duda, la de siempre. Quedarse sin voz por no poder leer una
    // preferencia sería cambiar un ajuste por una avería.
    return VOZ_POR_DEFECTO;
  }
}

export async function guardarVoz(tenantId: string, voz: VozElegida): Promise<void> {
  if (supabaseEnabled()) return kvSet(CLAVE(tenantId), voz);
  await fs.mkdir(path.dirname(FICHERO), { recursive: true });
  const raw = await fs.readFile(FICHERO, "utf-8").catch(() => "{}");
  const todo = raw.trim() ? (JSON.parse(raw) as Record<string, VozElegida>) : {};
  todo[tenantId] = voz;
  await fs.writeFile(FICHERO, JSON.stringify(todo, null, 2));
}

// -----------------------------------------------------------------------------
// ElevenLabs
// -----------------------------------------------------------------------------

type VozEL = {
  voice_id?: string;
  name?: string;
  preview_url?: string;
  labels?: Record<string, string>;
};

/**
 * Las voces de la cuenta, preguntadas a ElevenLabs.
 *
 * Sin clave devuelve lista vacía y no es un error: significa que ese proveedor
 * no está encendido, que es el estado normal hoy.
 */
export async function listarVocesElevenLabs(): Promise<{ voces: VozDisponible[]; error?: string }> {
  const clave = (process.env.ELEVENLABS_API_KEY || "").trim();
  if (!clave) return { voces: [] };
  try {
    const res = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: { "xi-api-key": clave },
      signal: AbortSignal.timeout(10_000),
    });
    // El texto de error se limpia de la clave antes de salir de aquí: un mensaje
    // de error es lo más fácil de acabar pegando en un chat.
    const txt = (await res.text()).split(clave).join("«clave oculta»");
    if (!res.ok) return { voces: [], error: `ElevenLabs ha dicho HTTP ${res.status} · ${txt.slice(0, 160)}` };
    const j = JSON.parse(txt) as { voices?: VozEL[] };
    const voces = (j.voices ?? [])
      .filter((v) => v.voice_id && v.name)
      .map<VozDisponible>((v) => ({
        proveedor: "elevenlabs",
        id: v.voice_id!,
        nombre: v.name!,
        // Las etiquetas de ElevenLabs vienen en inglés y sueltas ("female",
        // "young", "spanish"): se pegan tal cual porque traducirlas a medias
        // engaña más que dejarlas.
        descripcion: Object.values(v.labels ?? {}).filter(Boolean).join(" · "),
        muestra: v.preview_url,
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    return { voces };
  } catch (e) {
    return { voces: [], error: e instanceof Error ? e.message : String(e) };
  }
}

/** Todas las voces que se pueden elegir hoy, de los dos proveedores. */
export async function vocesDisponibles(): Promise<{ voces: VozDisponible[]; avisoElevenLabs?: string }> {
  const el = await listarVocesElevenLabs();
  return { voces: [...VOCES_OPENAI, ...el.voces], ...(el.error ? { avisoElevenLabs: el.error } : {}) };
}

/** Convierte texto en audio con ElevenLabs. Devuelve el mp3 o el motivo del fallo. */
export async function hablarElevenLabs(
  voiceId: string,
  texto: string,
): Promise<{ ok: true; audio: ArrayBuffer } | { ok: false; error: string }> {
  const clave = (process.env.ELEVENLABS_API_KEY || "").trim();
  if (!clave) return { ok: false, error: "ElevenLabs no está configurado en este entorno." };
  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`, {
      method: "POST",
      headers: { "xi-api-key": clave, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({ text: texto, model_id: "eleven_multilingual_v2" }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      const txt = (await res.text()).split(clave).join("«clave oculta»");
      return { ok: false, error: `ElevenLabs ha dicho HTTP ${res.status} · ${txt.slice(0, 160)}` };
    }
    return { ok: true, audio: await res.arrayBuffer() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
