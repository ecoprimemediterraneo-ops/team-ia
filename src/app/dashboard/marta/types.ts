// Tipos / constantes del panel LIVE de Marta para el cliente.
// Separado de actions.ts para no romper la regla de "use server"
// (solo funciones async en archivos con esa directiva).

import type { MartaProposal } from "@/lib/marta-proposals";
import type { SeedDraft } from "@/lib/marta-arranque";

export type ArranqueState = {
  ts: number;
  variant: "idle" | "ok" | "error";
  title: string;
  detail?: string;
  bio?: string;
  drafts?: SeedDraft[];
  warnings?: string[];
};

export const IDLE_ARRANQUE: ArranqueState = { ts: 0, variant: "idle", title: "" };

export type ProposalState = {
  ts: number;
  variant: "idle" | "ok" | "error";
  title: string;
  detail?: string;
  caption?: string;
  proposalId?: string;
  recipient?: string;
};

export const IDLE_PROPOSAL: ProposalState = { ts: 0, variant: "idle", title: "" };

export type ProposalsListState = {
  ts: number;
  variant: "idle" | "ok" | "error";
  proposals?: MartaProposal[];
};

export const IDLE_LIST: ProposalsListState = { ts: 0, variant: "idle" };
