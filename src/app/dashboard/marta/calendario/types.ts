// Estado de las acciones del cliente por la página del calendario.

// Publicar ahora / reprogramar una entrada.
export type PublicarState = {
  ts: number;
  variant?: "ok" | "error" | "dry";
  mensaje?: string;
};

export const PUBLICAR_STATE_INICIAL: PublicarState = { ts: 0 };

// Bloque 1 (automático): guardar pauta / generar posts del mes.
export type AutoState = {
  ts: number;
  variant?: "ok" | "error";
  mensaje?: string;
  generados?: number;
};

export const AUTO_STATE_INICIAL: AutoState = { ts: 0 };

// Resultado de "mejorar con IA" (se llama directamente, devuelve el texto).
export type MejorarResult = { ok: true; texto: string } | { ok: false; error: string };

// Identidad visual: guardar marca del negocio.
export type MarcaState = { ts: number; variant?: "ok" | "error"; mensaje?: string };
export const MARCA_STATE_INICIAL: MarcaState = { ts: 0 };

// Colores propuestos desde una captura (se llama directamente).
export type ColoresResult =
  | { ok: true; fondo: string; acento: string; texto: string }
  | { ok: false; error: string };

// Subida del logo a URL durable (se llama directamente).
export type LogoResult = { ok: true; url: string } | { ok: false; error: string };

// Resultado de crear una entrada manual (se llama directamente).
export type CrearManualResult = { ok: true; scheduledAt: string } | { ok: false; error: string };

/**
 * Tema con el que se marcan los posts SUBIDOS A MANO. Su imagen es del usuario,
 * así que no se regenera (solo se pule el texto). Vive aquí — y no en actions.ts,
 * que es "use server" — para que lo puedan leer también los componentes.
 */
export const TEMA_MANUAL = "Subido a mano";
