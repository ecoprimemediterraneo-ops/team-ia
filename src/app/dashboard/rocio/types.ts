import type { ProcessResult } from "@/lib/rocio-flow";
import type { RocioReviewProposal } from "@/lib/rocio-proposals";

export type ProcessState = {
  ts: number;
  variant: "idle" | "ok" | "error";
  title: string;
  detail?: string;
  result?: ProcessResult;
};

export const IDLE_PROCESS: ProcessState = { ts: 0, variant: "idle", title: "" };

export type RocioListProps = {
  proposals: RocioReviewProposal[];
};
