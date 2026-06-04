// Tipos / constantes compartidas por /admin/marta-flujo.
// Separado para no romper la restricción de "use server".

export type FlujoState = {
  ts: number;
  variant: "idle" | "ok" | "error";
  title: string;
  detail?: string;
  proposalId?: string;
  caption?: string;
  imageUrl?: string;
  recipient?: string;
};

export const IDLE_STATE: FlujoState = { ts: 0, variant: "idle", title: "" };
