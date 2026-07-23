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

// Resultado de crear una entrada manual (se llama directamente).
export type CrearManualResult = { ok: true; scheduledAt: string } | { ok: false; error: string };
