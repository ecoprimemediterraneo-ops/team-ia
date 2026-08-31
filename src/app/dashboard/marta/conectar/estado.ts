// Tipos del paso de confirmar. FUERA del fichero "use server", que solo puede
// exportar funciones async (ver `mensajes/estado.ts` para la historia completa:
// exportar un objeto desde un "use server" tumbaba TODAS las server actions de
// /dashboard/marta con una página en blanco).

export type EstadoConfirmar = { estado: "quieto" | "error"; motivo?: string };

export const CONFIRMAR_QUIETO: EstadoConfirmar = { estado: "quieto" };

/** Lo que devuelve el boton de Desconectar. */
export type EstadoDesconectar = { estado: "quieto" | "error"; motivo?: string };

export const DESCONECTAR_QUIETO: EstadoDesconectar = { estado: "quieto" };
