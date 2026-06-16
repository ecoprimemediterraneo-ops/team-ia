// Comentario → DM de Marta (la función estrella de ManyChat).
//
// Cuando alguien comenta una PALABRA CLAVE en un post de Instagram del cliente,
// Marta le envía al instante un DM (private reply, EXENTO de la ventana de 24h
// de Meta — es el mismo mecanismo que usa ManyChat). El PRIMER DM es una
// PLANTILLA FIJA configurable; la conversación posterior la lleva el motor de IA
// de DMs del webhook (memoria por interlocutor en conversation-store).
//
// Modelo: una config por tenant con una LISTA de reglas. Cada regla:
//   { keywords[], matchMode (contiene/exacto), dmMessage, scope ("all"|mediaId),
//     replyPublic, publicReplyText?, enabled }
//
// Storage: igual que marta-schedule / marta-proposals:
//   - Supabase kv_store (clave `marta-comment-rules:<tenantId>`)
//   - Fallback fichero local data/marta-comment-rules.json
//
// Dedup de comentarios ya procesados (anti doble-DM si Meta reentrega el
// webhook): clave `marta-comment-seen:<tenantId>` con un mapa
// { commentId: tsISO } podado por TTL.

import fs from "node:fs/promises";
import path from "node:path";
import { kvGet, kvSet } from "./supabase";

export type MatchMode = "contiene" | "exacto";

export type CommentRule = {
  id: string;
  enabled: boolean;
  keywords: string[]; // dispara si el comentario casa CUALQUIERA (OR)
  matchMode: MatchMode; // "contiene" (palabra suelta) | "exacto" (todo el comentario)
  dmMessage: string; // plantilla fija del primer DM ({usuario} = @nombre del que comenta)
  scope: "all" | string; // "all" = cualquier post | un media id concreto
  replyPublic: boolean; // además, responder públicamente al comentario
  publicReplyText?: string; // texto de la respuesta pública (opcional)
  createdAt: string;
  updatedAt?: string;
};

export type MartaCommentConfig = {
  tenantId: string;
  rules: CommentRule[];
  updatedAt?: string;
};

export type CommentRuleInput = {
  id?: string;
  enabled?: boolean;
  keywords: string[];
  matchMode: MatchMode;
  dmMessage: string;
  scope?: string; // "all" o un media id
  replyPublic?: boolean;
  publicReplyText?: string;
};

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "marta-comment-rules.json");
const SEEN_FILE = path.join(DATA_DIR, "marta-comment-seen.json");
const USE_SUPABASE = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);

// TTL del registro anti-duplicado de comentarios (los ids viejos se podan).
const SEEN_TTL_HRS = 72;

// -----------------------------------------------------------------------------
// Gating del ENVÍO real (igual filosofía que MARTA_PUBLISH_ENABLED).
// -----------------------------------------------------------------------------
//
// El envío del DM requiere DOS permisos de Meta aún pendientes de App Review:
//   - instagram_manage_comments          → leer/recibir los comentarios.
//   - instagram_business_manage_messages → mandar el DM (private reply).
//
// Mientras MARTA_COMMENT_DM_ENABLED != "true", el webhook DETECTA la
// coincidencia y la registra (logs + eventos), pero NO llama a Meta. Así se
// puede configurar y probar el matching sin riesgo de mandar nada por error.
export function isCommentDmEnabled(): boolean {
  return (process.env.MARTA_COMMENT_DM_ENABLED || "").toLowerCase() === "true";
}

function kvKey(tenantId: string): string {
  return `marta-comment-rules:${tenantId}`;
}

function seenKey(tenantId: string): string {
  return `marta-comment-seen:${tenantId}`;
}

export function defaultCommentConfig(tenantId: string): MartaCommentConfig {
  return { tenantId, rules: [] };
}

type LocalMap = Record<string, MartaCommentConfig>;

// -----------------------------------------------------------------------------
// Storage de reglas
// -----------------------------------------------------------------------------

export async function getCommentConfig(tenantId: string): Promise<MartaCommentConfig> {
  if (USE_SUPABASE) {
    const c = await kvGet<MartaCommentConfig>(kvKey(tenantId));
    return c ?? defaultCommentConfig(tenantId);
  }
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const raw = await fs.readFile(FILE, "utf-8").catch(() => "{}");
    const all = raw.trim() ? (JSON.parse(raw) as LocalMap) : {};
    return all[kvKey(tenantId)] ?? defaultCommentConfig(tenantId);
  } catch {
    return defaultCommentConfig(tenantId);
  }
}

export async function getCommentRules(tenantId: string): Promise<CommentRule[]> {
  const c = await getCommentConfig(tenantId);
  return c.rules ?? [];
}

async function writeCommentConfig(config: MartaCommentConfig): Promise<void> {
  const next: MartaCommentConfig = { ...config, updatedAt: new Date().toISOString() };
  if (USE_SUPABASE) {
    await kvSet(kvKey(config.tenantId), next);
    return;
  }
  await fs.mkdir(DATA_DIR, { recursive: true });
  const raw = await fs.readFile(FILE, "utf-8").catch(() => "{}");
  const all = raw.trim() ? (JSON.parse(raw) as LocalMap) : {};
  all[kvKey(config.tenantId)] = next;
  await fs.writeFile(FILE, JSON.stringify(all, null, 2));
}

/** Crea o actualiza una regla (upsert por id). Devuelve la regla resultante. */
export async function saveCommentRule(
  tenantId: string,
  input: CommentRuleInput,
): Promise<CommentRule> {
  const config = await getCommentConfig(tenantId);
  const rules = [...(config.rules ?? [])];

  const keywords = normalizeKeywordList(input.keywords);
  const scope = input.scope && input.scope.trim() ? input.scope.trim() : "all";
  const now = new Date().toISOString();

  const idx = input.id ? rules.findIndex((r) => r.id === input.id) : -1;

  let rule: CommentRule;
  if (idx >= 0) {
    rule = {
      ...rules[idx],
      enabled: input.enabled ?? rules[idx].enabled,
      keywords,
      matchMode: input.matchMode,
      dmMessage: input.dmMessage,
      scope,
      replyPublic: !!input.replyPublic,
      publicReplyText: input.publicReplyText?.trim() || undefined,
      updatedAt: now,
    };
    rules[idx] = rule;
  } else {
    rule = {
      id: `rule_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      enabled: input.enabled ?? true,
      keywords,
      matchMode: input.matchMode,
      dmMessage: input.dmMessage,
      scope,
      replyPublic: !!input.replyPublic,
      publicReplyText: input.publicReplyText?.trim() || undefined,
      createdAt: now,
    };
    rules.push(rule);
  }

  await writeCommentConfig({ tenantId, rules });
  return rule;
}

/** Cambia solo el on/off de una regla. */
export async function setCommentRuleEnabled(
  tenantId: string,
  id: string,
  enabled: boolean,
): Promise<CommentRule | null> {
  const config = await getCommentConfig(tenantId);
  const rules = [...(config.rules ?? [])];
  const idx = rules.findIndex((r) => r.id === id);
  if (idx < 0) return null;
  rules[idx] = { ...rules[idx], enabled, updatedAt: new Date().toISOString() };
  await writeCommentConfig({ tenantId, rules });
  return rules[idx];
}

/** Elimina una regla por id. Devuelve true si existía. */
export async function deleteCommentRule(tenantId: string, id: string): Promise<boolean> {
  const config = await getCommentConfig(tenantId);
  const rules = config.rules ?? [];
  const next = rules.filter((r) => r.id !== id);
  if (next.length === rules.length) return false;
  await writeCommentConfig({ tenantId, rules: next });
  return true;
}

// -----------------------------------------------------------------------------
// Matching
// -----------------------------------------------------------------------------

/** Lowercase + sin acentos + espacios colapsados, para casar sin distinguir tildes/mayúsculas. */
export function normalizeText(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita acentos/diacríticos
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeKeywordList(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list ?? []) {
    const k = (raw || "").trim();
    if (!k) continue;
    const norm = normalizeText(k);
    if (seen.has(norm)) continue;
    seen.add(norm);
    out.push(k);
  }
  return out;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** ¿Casa este comentario con la regla (scope + keyword + modo)? */
export function commentMatchesRule(
  rule: CommentRule,
  commentText: string,
  mediaId?: string,
): boolean {
  if (!rule.enabled) return false;
  // Scope: si la regla es de un post concreto, exige media id y que coincida.
  if (rule.scope !== "all") {
    if (!mediaId || rule.scope !== mediaId) return false;
  }
  const text = normalizeText(commentText);
  if (!text) return false;

  for (const kwRaw of rule.keywords) {
    const kw = normalizeText(kwRaw);
    if (!kw) continue;
    if (rule.matchMode === "exacto") {
      if (text === kw) return true;
    } else {
      // "contiene" = la palabra aparece como token (con límites no alfanuméricos),
      // para que "info" NO dispare con "información". Soporta keywords de varias palabras.
      const re = new RegExp(
        `(^|[^\\p{L}\\p{N}])${escapeRegExp(kw)}([^\\p{L}\\p{N}]|$)`,
        "u",
      );
      if (re.test(text)) return true;
    }
  }
  return false;
}

/**
 * Primera regla habilitada que casa. Prioriza las reglas de un post concreto
 * sobre las de "todos los posts", para que una campaña de un post específico
 * gane a la regla general.
 */
export function findMatchingRule(
  rules: CommentRule[],
  commentText: string,
  mediaId?: string,
): CommentRule | null {
  const enabled = (rules ?? []).filter((r) => r.enabled);
  const specific = enabled.filter((r) => r.scope !== "all");
  const general = enabled.filter((r) => r.scope === "all");
  for (const r of [...specific, ...general]) {
    if (commentMatchesRule(r, commentText, mediaId)) return r;
  }
  return null;
}

/** Rellena la plantilla del DM. {usuario} / {user} → @nombre del que comenta. */
export function renderDmTemplate(template: string, vars: { usuario?: string }): string {
  const usuario = vars.usuario ? `@${vars.usuario.replace(/^@/, "")}` : "";
  return (template || "")
    .replace(/\{usuario\}/gi, usuario)
    .replace(/\{user\}/gi, usuario)
    .replace(/[ \t]{2,}/g, " ") // limpia dobles espacios si {usuario} quedó vacío
    .trim();
}

// -----------------------------------------------------------------------------
// Dedup de comentarios procesados (anti doble-DM)
// -----------------------------------------------------------------------------

type SeenMap = Record<string, string>; // commentId -> tsISO

async function readSeen(tenantId: string): Promise<SeenMap> {
  if (USE_SUPABASE) {
    return (await kvGet<SeenMap>(seenKey(tenantId))) ?? {};
  }
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const raw = await fs.readFile(SEEN_FILE, "utf-8").catch(() => "{}");
    const all = raw.trim() ? (JSON.parse(raw) as Record<string, SeenMap>) : {};
    return all[seenKey(tenantId)] ?? {};
  } catch {
    return {};
  }
}

async function writeSeen(tenantId: string, map: SeenMap): Promise<void> {
  if (USE_SUPABASE) {
    await kvSet(seenKey(tenantId), map);
    return;
  }
  await fs.mkdir(DATA_DIR, { recursive: true });
  const raw = await fs.readFile(SEEN_FILE, "utf-8").catch(() => "{}");
  const all = raw.trim() ? (JSON.parse(raw) as Record<string, SeenMap>) : {};
  all[seenKey(tenantId)] = map;
  await fs.writeFile(SEEN_FILE, JSON.stringify(all, null, 2));
}

/**
 * Marca un comentario como procesado. Devuelve true si era NUEVO (hay que
 * actuar), false si ya se había procesado (ignorar). Poda ids viejos por TTL.
 */
export async function markCommentProcessed(
  tenantId: string,
  commentId: string,
): Promise<boolean> {
  if (!commentId) return true;
  const map = await readSeen(tenantId);
  const now = Date.now();
  // Poda
  for (const [cid, ts] of Object.entries(map)) {
    const t = Date.parse(ts);
    if (!Number.isFinite(t) || now - t > SEEN_TTL_HRS * 60 * 60 * 1000) {
      delete map[cid];
    }
  }
  if (map[commentId]) {
    await writeSeen(tenantId, map);
    return false;
  }
  map[commentId] = new Date().toISOString();
  await writeSeen(tenantId, map);
  return true;
}
