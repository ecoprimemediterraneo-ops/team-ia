/**
 * Pipeline interno SDR — almacenado en JSON (Vercel /tmp).
 * Cuando tengamos Supabase, migrar este módulo manteniendo la API.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { kvGet, kvSet } from "./supabase";

// Re-export types and constants from client-safe module
export type { LeadStage, Lead, LeadActivity } from "./pipeline-constants";
export { STAGE_ORDER, STAGE_LABEL } from "./pipeline-constants";
import type { Lead, LeadStage, LeadActivity } from "./pipeline-constants";
import { STAGE_ORDER } from "./pipeline-constants";

const DATA_DIR = path.join(process.cwd(), "data");
const PIPELINE_FILE = path.join(DATA_DIR, "pipeline.json");
const USE_SUPABASE = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);

async function readPipeline(): Promise<Lead[]> {
  if (USE_SUPABASE) {
    return (await kvGet<Lead[]>("pipeline")) ?? [];
  }
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    return JSON.parse(await fs.readFile(PIPELINE_FILE, "utf-8"));
  } catch { return []; }
}

async function writePipeline(leads: Lead[]) {
  if (USE_SUPABASE) {
    await kvSet("pipeline", leads);
    return;
  }
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(PIPELINE_FILE, JSON.stringify(leads, null, 2));
}

export async function listLeads(ownerEmail?: string): Promise<Lead[]> {
  const all = await readPipeline();
  if (!ownerEmail) return all;
  return all.filter((l) => l.ownerEmail === ownerEmail);
}

export async function getLead(id: string): Promise<Lead | null> {
  const all = await readPipeline();
  return all.find((l) => l.id === id) || null;
}

export async function createLead(input: Omit<Lead, "id" | "createdAt" | "updatedAt" | "activities">): Promise<Lead> {
  const all = await readPipeline();
  const now = new Date().toISOString();
  const lead: Lead = {
    ...input,
    id: `lead_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: now,
    updatedAt: now,
    activities: [
      { id: `act_${Date.now()}`, type: "stage_change", ts: now, data: { from: null, to: input.stage } },
    ],
  };
  all.push(lead);
  await writePipeline(all);
  return lead;
}

export async function bulkCreateLeads(items: Omit<Lead, "id" | "createdAt" | "updatedAt" | "activities">[]): Promise<{ added: number; skipped: number }> {
  const all = await readPipeline();
  const existing = new Set(all.map((l) => `${l.email?.toLowerCase() || l.businessName.toLowerCase()}`));
  let added = 0, skipped = 0;
  const now = new Date().toISOString();
  for (const item of items) {
    const key = `${item.email?.toLowerCase() || item.businessName.toLowerCase()}`;
    if (existing.has(key)) { skipped++; continue; }
    existing.add(key);
    all.push({
      ...item,
      id: `lead_${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${added}`,
      createdAt: now,
      updatedAt: now,
      activities: [
        { id: `act_${Date.now()}_${added}`, type: "stage_change", ts: now, data: { from: null, to: item.stage } },
      ],
    });
    added++;
  }
  await writePipeline(all);
  return { added, skipped };
}

export async function updateLead(id: string, patch: Partial<Lead>): Promise<Lead | null> {
  const all = await readPipeline();
  const l = all.find((x) => x.id === id);
  if (!l) return null;
  Object.assign(l, patch, { updatedAt: new Date().toISOString() });
  await writePipeline(all);
  return l;
}

export async function moveLead(id: string, newStage: LeadStage): Promise<Lead | null> {
  const all = await readPipeline();
  const l = all.find((x) => x.id === id);
  if (!l) return null;
  const old = l.stage;
  l.stage = newStage;
  l.updatedAt = new Date().toISOString();
  l.lastTouchAt = l.updatedAt;
  l.activities.unshift({
    id: `act_${Date.now()}`,
    type: "stage_change",
    ts: new Date().toISOString(),
    data: { from: old, to: newStage },
  });
  await writePipeline(all);
  return l;
}

export async function addLeadActivity(id: string, activity: Omit<LeadActivity, "id" | "ts">): Promise<Lead | null> {
  const all = await readPipeline();
  const l = all.find((x) => x.id === id);
  if (!l) return null;
  l.activities.unshift({
    ...activity,
    id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    ts: new Date().toISOString(),
  });
  l.lastTouchAt = new Date().toISOString();
  l.updatedAt = l.lastTouchAt;
  await writePipeline(all);
  return l;
}

export async function deleteLead(id: string): Promise<boolean> {
  const all = await readPipeline();
  const next = all.filter((l) => l.id !== id);
  if (next.length === all.length) return false;
  await writePipeline(next);
  return true;
}

export async function pipelineStats(): Promise<{ total: number; byStage: Record<LeadStage, number>; bySector: Record<string, number> }> {
  const all = await readPipeline();
  const byStage = Object.fromEntries(STAGE_ORDER.map((s) => [s, 0])) as Record<LeadStage, number>;
  const bySector: Record<string, number> = {};
  for (const l of all) {
    byStage[l.stage] = (byStage[l.stage] || 0) + 1;
    bySector[l.sector] = (bySector[l.sector] || 0) + 1;
  }
  return { total: all.length, byStage, bySector };
}
