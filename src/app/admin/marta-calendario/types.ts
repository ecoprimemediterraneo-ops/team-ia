import type { CalendarEntry } from "@/lib/marta-calendar";

export type CalendarState = {
  ts: number;
  variant: "idle" | "ok" | "error";
  title: string;
  detail?: string;
  scheduled?: CalendarEntry[];
  warnings?: string[];
};

export const IDLE_STATE: CalendarState = { ts: 0, variant: "idle", title: "" };
