/**
 * Sergio · Servicio de scraping con Firecrawl.
 * Genera snapshots y detecta cambios vs el snapshot anterior.
 */
import crypto from "node:crypto";
import type { Source, Snapshot } from "./sergio-db";
import { getLastSnapshot, createSnapshot, createChange, updateSource } from "./sergio-db";

function hash(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex").slice(0, 16);
}

async function firecrawlScrape(url: string): Promise<{ markdown: string; metadata: Record<string, unknown> }> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) throw new Error("FIRECRAWL_API_KEY not set");

  const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
  });

  if (!res.ok) throw new Error(`Firecrawl error ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return { markdown: json.data?.markdown ?? "", metadata: json.data?.metadata ?? {} };
}

function diffContent(before: string, after: string): { added: string[]; removed: string[] } {
  const beforeLines = new Set(before.split("\n").map((l) => l.trim()).filter(Boolean));
  const afterLines = new Set(after.split("\n").map((l) => l.trim()).filter(Boolean));
  const added = [...afterLines].filter((l) => !beforeLines.has(l)).slice(0, 20);
  const removed = [...beforeLines].filter((l) => !afterLines.has(l)).slice(0, 20);
  return { added, removed };
}

function detectChangeType(diff: { added: string[]; removed: string[] }): import("./sergio-db").ChangeType {
  const text = [...diff.added, ...diff.removed].join(" ").toLowerCase();
  if (/€|precio|price|\$|plan|tarifa|coste|cost/.test(text)) return "price";
  if (/feature|función|funcionalidad|integración|integration/.test(text)) return "feature";
  if (/equipo|team|join|contrata|hiring|empleado/.test(text)) return "team";
  if (/plan|suscripción|subscription|tier/.test(text)) return "pricing_plan";
  return "content";
}

export async function scrapeSource(source: Source): Promise<{ changed: boolean; snapshotId: string }> {
  const { markdown } = await firecrawlScrape(source.url);
  const contentHash = hash(markdown);
  const now = new Date().toISOString();

  const prev = await getLastSnapshot(source.id);

  const snapshot = await createSnapshot({
    source_id: source.id,
    scraped_at: now,
    raw_content: markdown,
    parsed_data: { url: source.url, competitor: source.competitor_name },
    hash: contentHash,
  });

  await updateSource(source.id, { last_scraped_at: now });

  if (!prev || prev.hash === contentHash) {
    return { changed: false, snapshotId: snapshot.id };
  }

  // Change detected — create a pending change record (Claude will analyze it in Sprint 2)
  const diff = diffContent(prev.raw_content, markdown);
  const changeType = detectChangeType(diff);

  await createChange({
    source_id: source.id,
    snapshot_before: prev.id,
    snapshot_after: snapshot.id,
    change_type: changeType,
    diff: { added: diff.added, removed: diff.removed },
    relevance: "medium", // Claude will re-classify in Sprint 2
    summary: `Cambio detectado en ${source.competitor_name}: ${diff.added.length} líneas añadidas, ${diff.removed.length} eliminadas.`,
    detected_at: now,
    acknowledged: false,
  });

  return { changed: true, snapshotId: snapshot.id };
}

export async function scrapeAllActiveSources(): Promise<{ total: number; changed: number; errors: number }> {
  const { listSources } = await import("./sergio-db");
  const sources = await listSources(true);

  let changed = 0;
  let errors = 0;

  for (const source of sources) {
    // Respect frequency — skip if scraped recently
    if (source.last_scraped_at) {
      const lastMs = new Date(source.last_scraped_at).getTime();
      const ageHours = (Date.now() - lastMs) / 3600000;
      const minAge = source.frequency === "daily" ? 20 : source.frequency === "weekly" ? 160 : 320;
      if (ageHours < minAge) continue;
    }

    try {
      const result = await scrapeSource(source);
      if (result.changed) changed++;
    } catch {
      errors++;
    }

    // Rate limiting — wait 2s between requests
    await new Promise((r) => setTimeout(r, 2000));
  }

  return { total: sources.length, changed, errors };
}
