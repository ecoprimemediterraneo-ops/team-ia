import type { PostMes } from "@/lib/marta-mes";

export type MesState = {
  ts: number;
  variant?: "ok" | "error";
  title?: string;
  detail?: string;
  posts?: PostMes[];
  warnings?: string[];
  persistido?: boolean;
};

export const MES_STATE_INICIAL: MesState = { ts: 0 };

export type PublicarState = {
  ts: number;
  variant?: "ok" | "error" | "dry";
  mensaje?: string;
};

export const PUBLICAR_STATE_INICIAL: PublicarState = { ts: 0 };
