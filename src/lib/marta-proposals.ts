// Store de propuestas pendientes de aprobación de Marta.
//
// Flujo:
//   1. Marta genera una propuesta (imagen + caption) y la envía al WhatsApp
//      del cliente. Crea la propuesta aquí con status "pending".
//   2. El cliente responde por WhatsApp. El webhook de Pablo intercepta el
//      mensaje, mira si hay una propuesta pendiente para ese número, y:
//        - Si el texto es aprobación → publica en Instagram y marca como
//          "published" (idempotente: no se vuelve a publicar).
//        - Si no → deja la propuesta como "pending" pendiente de cambios.
//   3. Las propuestas viejas se descartan por TTL (default 48 h).
//
// Storage: misma capa que conversation-store / event-log:
//   - Supabase kv_store si SUPABASE_URL + SUPABASE_SERVICE_KEY (prod).
//   - Fallback a data/marta-proposals.json (dev).
//
// Clave en kv_store:
//   marta-proposal:<tenantId>:<recipientWhatsapp>
// (una sola propuesta pendiente activa por (tenant, número). Si se crea otra
//  para el mismo destinatario, sustituye a la anterior.)

import fs from "node:fs/promises";
import path from "node:path";
import { kvGet, kvSet } from "./supabase";

export type ProposalStatus = "pending" | "published" | "expired" | "cancelled";

export type ProposalMediaType =
  | "IMAGE"
  | "REELS"
  | "STORIES_IMAGE"
  | "STORIES_VIDEO";

export type MartaProposal = {
  id: string;
  tenantId: string;
  recipientWhatsapp: string;
  imageUrl: string;        // URL pública (imagen para IMAGE, vídeo para REELS)
  caption: string;
  mediaType: ProposalMediaType;
  status: ProposalStatus;
  createdAt: string; // ISO
  publishedAt?: string;
  igMediaId?: string;
  igPermalink?: string;
  lastClientReply?: string;
  lastClientReplyAt?: string;
  lastIntent?: string;
};

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "marta-proposals.json");
const USE_SUPABASE = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);

function clampInt(raw: string | undefined, def: number, min: number, max: number): number {
  const n = raw ? parseInt(raw, 10) : def;
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
}

const TTL_HOURS = clampInt(process.env.MARTA_PROPOSAL_TTL_HRS, 48, 1, 24 * 30);

function key(tenantId: string, recipient: string): string {
  return `marta-proposal:${tenantId}:${recipient}`;
}

function isStale(p: MartaProposal): boolean {
  const t = Date.parse(p.createdAt);
  if (!Number.isFinite(t)) return true;
  return Date.now() - t > TTL_HOURS * 60 * 60 * 1000;
}

// -----------------------------------------------------------------------------
// Backend
// -----------------------------------------------------------------------------

type LocalMap = Record<string, MartaProposal>;

async function readOne(k: string): Promise<MartaProposal | null> {
  if (USE_SUPABASE) return (await kvGet<MartaProposal>(k)) ?? null;
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const raw = await fs.readFile(FILE, "utf-8").catch(() => "{}");
    const all = raw.trim() ? (JSON.parse(raw) as LocalMap) : {};
    return all[k] ?? null;
  } catch {
    return null;
  }
}

async function writeOne(k: string, p: MartaProposal): Promise<void> {
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

export async function createProposal(input: {
  tenantId: string;
  recipientWhatsapp: string;
  imageUrl: string;
  caption: string;
  mediaType?: ProposalMediaType;
}): Promise<MartaProposal> {
  const now = new Date().toISOString();
  const proposal: MartaProposal = {
    id: `prop_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    tenantId: input.tenantId,
    recipientWhatsapp: input.recipientWhatsapp,
    imageUrl: input.imageUrl,
    caption: input.caption,
    mediaType: input.mediaType ?? "IMAGE",
    status: "pending",
    createdAt: now,
  };
  await writeOne(key(input.tenantId, input.recipientWhatsapp), proposal);
  return proposal;
}

/**
 * Busca una propuesta PENDIENTE para este número de WhatsApp en CUALQUIER
 * tenant. Usado por el webhook de Pablo, que solo conoce el número del
 * remitente (no el tenant). Si hay varias en distintos tenants (caso raro),
 * devuelve la más reciente.
 *
 * Limpia automáticamente la propuesta si está stale por TTL.
 */
export async function findPendingProposalByWhatsapp(
  recipientWhatsapp: string,
): Promise<MartaProposal | null> {
  // Supabase: necesitaríamos un índice. Como hoy las propuestas activas son
  // pocas (≤ 20 plazas), iteramos el bucket local. En prod con muchos tenants
  // habría que migrar a una tabla con índice por recipient.
  if (USE_SUPABASE) {
    // Sin búsqueda por prefijo en kvGet → seguimos la convención: buscamos
    // primero en el tenant fundador (caso 99%).
    const fundador = await readOne(key("tenant_aiteam", recipientWhatsapp));
    return await filterPending(fundador);
  }
  const all = await readAllLocal();
  let best: MartaProposal | null = null;
  for (const [k, p] of Object.entries(all)) {
    if (!k.startsWith("marta-proposal:")) continue;
    if (p.recipientWhatsapp !== recipientWhatsapp) continue;
    if (p.status !== "pending") continue;
    if (!best || Date.parse(p.createdAt) > Date.parse(best.createdAt)) best = p;
  }
  return await filterPending(best);
}

async function filterPending(p: MartaProposal | null): Promise<MartaProposal | null> {
  if (!p) return null;
  if (p.status !== "pending") return null;
  if (isStale(p)) {
    p.status = "expired";
    await writeOne(key(p.tenantId, p.recipientWhatsapp), p);
    return null;
  }
  return p;
}

export async function markProposalPublished(
  proposal: MartaProposal,
  igMediaId: string,
  igPermalink?: string,
): Promise<MartaProposal> {
  const updated: MartaProposal = {
    ...proposal,
    status: "published",
    publishedAt: new Date().toISOString(),
    igMediaId,
    igPermalink,
  };
  await writeOne(key(proposal.tenantId, proposal.recipientWhatsapp), updated);
  return updated;
}

export async function recordClientReply(
  proposal: MartaProposal,
  text: string,
  intent?: string,
): Promise<MartaProposal> {
  const updated: MartaProposal = {
    ...proposal,
    lastClientReply: text.slice(0, 500),
    lastClientReplyAt: new Date().toISOString(),
    lastIntent: intent,
  };
  await writeOne(key(proposal.tenantId, proposal.recipientWhatsapp), updated);
  return updated;
}

export async function markProposalRejected(proposal: MartaProposal): Promise<MartaProposal> {
  const updated: MartaProposal = { ...proposal, status: "cancelled" };
  await writeOne(key(proposal.tenantId, proposal.recipientWhatsapp), updated);
  return updated;
}

export async function cancelProposal(
  tenantId: string,
  recipient: string,
): Promise<void> {
  const k = key(tenantId, recipient);
  const p = await readOne(k);
  if (!p || p.status !== "pending") return;
  await writeOne(k, { ...p, status: "cancelled" });
}

/** Lista propuestas (pendientes + recientes) de un tenant, ordenadas por fecha desc. */
export async function listProposalsByTenant(tenantId: string): Promise<MartaProposal[]> {
  if (USE_SUPABASE) return [];
  const all = await readAllLocal();
  const out: MartaProposal[] = [];
  for (const [k, p] of Object.entries(all)) {
    if (!k.startsWith(`marta-proposal:${tenantId}:`)) continue;
    out.push(p);
  }
  return out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

// -----------------------------------------------------------------------------
// Detección de aprobación (case-insensitive, flexible)
// -----------------------------------------------------------------------------

const APPROVAL_PATTERNS: RegExp[] = [
  /^\s*ok\s*[.!]?\s*$/i,
  /^\s*okay\s*[.!]?\s*$/i,
  /^\s*vale\s*[.!]?\s*$/i,
  /^\s*dale\s*[.!]?\s*$/i,
  /^\s*si\s*[.!]?\s*$/i,
  /^\s*sí\s*[.!]?\s*$/i,
  /^\s*publica(?:lo)?\s*[.!]?\s*$/i,
  /^\s*publícalo\s*[.!]?\s*$/i,
  /^\s*publi[cq]a\s*ya\s*[.!]?\s*$/i,
  /\bsí?\s+publica/i,
  /\bok\s+publica/i,
  /\bperfecto\b/i,
  /\bme\s+gusta\s*[.!]*$/i,
  /\badelante\b/i,
  /^\s*👍\s*$/u,
  /^\s*✅\s*$/u,
  /^\s*🚀\s*$/u,
];

export function isApprovalText(text: string): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  if (trimmed.length === 0) return false;
  // Si el texto es muy largo, asumimos que NO es una aprobación simple
  // (probablemente es feedback de cambios).
  if (trimmed.length > 40) return false;
  return APPROVAL_PATTERNS.some((re) => re.test(trimmed));
}

export const __config = { TTL_HOURS };
