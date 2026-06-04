// Tipos / constantes compartidas por la página /admin/ficha-cliente.
// Archivo separado para no romper la restricción de "use server"
// (un archivo con "use server" solo puede exportar funciones async).

export type SaveState = {
  ts: number;
  variant: "idle" | "ok" | "error";
  title: string;
  detail?: string;
};

export const IDLE_STATE: SaveState = { ts: 0, variant: "idle", title: "" };
