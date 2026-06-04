// Propuestas pendientes de aprobación de Rocío (respuesta a reseña).
//
// Patrón paralelo a marta-proposals.ts pero para reseñas. Cuando Rocío
// detecta una reseña nueva y la respuesta NO es candidata a auto-reply,
// crea una propuesta y la envía al WhatsApp del cliente. La aprobación se
// gestiona desde el interceptor de Pablo webhook con classifyClientReply.

import fs from "node:fs/promises";
import path from "node:path";
import { kvGet, kvSet } from "./supabase";

export type RocioProposalStatus = "pending" | "published" | "expired" | "cancelled";

export type RocioReviewProposal = {
  id: string;
  tenantId: string;
  recipientWhatsapp: string;
  reviewName: string;        // accounts/{A}/locations/{L}/reviews/{R}
  reviewerName: string;
  rating: 1 | 2 | 3 | 4 | 5;
  reviewText: string;
  draftReply: string;
  status: RocioProposalStatus;
  createdAt: string;
  publishedAt?: string;
  lastClientReply?: string;
  lastClientReplyAt?: string;
  lastIntent?: string;
};

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "rocio-proposals.json");
const USE_SUPABASE = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);

function clampInt(raw: string | undefined, def: number, min: number, max: number): number {
  const n = raw ? parseInt(raw, 10) : def;
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
}
const TTL_HOURS = clampInt(process.env.ROCIO_PROPOSAL_TTL_HRS, 72, 1, 24 * 30);

function key(tenantId: string, recipient: string): string {
  return `rocio-proposal:${tenantId}:${recipient}`;
}

function isStale(p: RocioReviewProposal): boolean {
  const t = Date.parse(p.createdAt);
  if (!Number.isFinite(t)) return true;
  return Date.now() - t > TTL_HOURS * 60 * 60 * 1000;
}

type LocalMap = Record<string, RocioReviewProposal>;

async function readOne(k: string): Promise<RocioReviewProposal | null> {
  if (USE_SUPABASE) return (await kvGet<RocioReviewProposal>(k)) ?? null;
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const raw = await fs.readFile(FILE, "utf-8").catch(() => "{}");
    const all = raw.trim() ? (JSON.parse(raw) as LocalMap) : {};
    return all[k] ?? null;
  } catch {
    return null;
  }
}

async function writeOne(k: string, p: RocioReviewProposal): Promise<void> {
  if (USE_SUPABASE) {
    await kvSet(k, p);
    return;
  }
  await fs.mkdir(DATA_DIR, { recursive: true });
  const raw = await fs.readFile(FILE, "utf-8").catch(() => "{}");
  const all = raw.trim() ? (JSON.parse(raw) as LocalMap) : {};
  all[k] = p;
  await fs.writeFile(FILE, JSON.stringify(all, null, 2));
}

async function readAllLocal(): Promise<LocalMap> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const raw = await fs.readFile(FILE, "utf-8").catch(() => "{}");
    return raw.trim() ? (JSON.parse(raw) as LocalMap) : {};
  } catch {
    return {};
  }
}

// -----------------------------------------------------------------------------
// API pública
// -----------------------------------------------------------------------------

export async function createRocioProposal(input: {
  tenantId: string;
  recipientWhatsapp: string;
  reviewName: string;
  reviewerName: string;
  rating: 1 | 2 | 3 | 4 | 5;
  reviewText: string;
  draftReply: string;
}): Promise<RocioReviewProposal> {
  const now = new Date().toISOString();
  const proposal: RocioReviewProposal = {
    id: `rocp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    tenantId: input.tenantId,
    recipientWhatsapp: input.recipientWhatsapp,
    reviewName: input.reviewName,
    reviewerName: input.reviewerName,
    rating: input.rating,
    reviewText: input.reviewText,
    draftReply: input.draftReply,
    status: "pending",
    createdAt: now,
  };
  await writeOne(key(input.tenantId, input.recipientWhatsapp), proposal);
  return proposal;
}

export async function findPendingRocioByWhatsapp(
  recipientWhatsapp: string,
): Promise<RocioReviewProposal | null> {
  if (USE_SUPABASE) {
    const fundador = await readOne(key("tenant_aiteam", recipientWhatsapp));
    return filterPending(fundador);
  }
  const all = await readAllLocal();
  let best: RocioReviewProposal | null = null;
  for (const [k, p] of Object.entries(all)) {
    if (!k.startsWith("rocio-proposal:")) continue;
    if (p.recipientWhatsapp !== recipientWhatsapp) continue;
    if (p.status !== "pending") continue;
    if (!best || Date.parse(p.createdAt) > Date.parse(best.createdAt)) best = p;
  }
  return filterPending(best);
}

async function filterPending(p: RocioReviewProposal | null): Promise<RocioReviewProposal | null> {
  if (!p) return null;
  if (p.status !== "pending") return null;
  if (isStale(p)) {
    p.status = "expired";
    await writeOne(key(p.tenantId, p.recipientWhatsapp), p);
    return null;
  }
  return p;
}

export async function markRocioPublished(p: RocioReviewProposal): Promise<RocioReviewProposal> {
  const u: RocioReviewProposal = { ...p, status: "published", publishedAt: new Date().toISOString() };
  await writeOne(key(p.tenantId, p.recipientWhatsapp), u);
  return u;
}

export async function markRocioRejected(p: RocioReviewProposal): Promise<RocioReviewProposal> {
  const u: RocioReviewProposal = { ...p, status: "cancelled" };
  await writeOne(key(p.tenantId, p.recipientWhatsapp), u);
  return u;
}

export async function recordRocioClientReply(
  p: RocioReviewProposal,
  text: string,
  intent?: string,
): Promise<RocioReviewProposal> {
  const u: RocioReviewProposal = {
    ...p,
    lastClientReply: text.slice(0, 500),
    lastClientReplyAt: new Date().toISOString(),
    lastIntent: intent,
  };
  await writeOne(key(p.tenantId, p.recipientWhatsapp), u);
  return u;
}

export async function listRocioByTenant(tenantId: string): Promise<RocioReviewProposal[]> {
  if (USE_SUPABASE) return [];
  const all = await readAllLocal();
  const out: RocioReviewProposal[] = [];
  for (const [k, p] of Object.entries(all)) {
    if (!k.startsWith(`rocio-proposal:${tenantId}:`)) continue;
    out.push(p);
  }
  return out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}
