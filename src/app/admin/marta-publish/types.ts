// Tipos y constantes compartidas por la página /admin/marta-publish.
// Archivo separado para no romper la restricción de "use server"
// (un fichero con "use server" solo puede exportar funciones async).

export type PublishActionState = {
  ts: number;
  variant: "ok" | "skipped" | "error" | "idle";
  title: string;
  detail?: string;
  igMediaId?: string;
  permalink?: string;
  metaCode?: number;
};

export const IDLE_STATE: PublishActionState = { ts: 0, variant: "idle", title: "" };
