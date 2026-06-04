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

export const IDLE_STATE: ArranqueState = { ts: 0, variant: "idle", title: "" };
