"use client";
import { useEffect, useState } from "react";

type Step = { slug: string; name: string; emoji: string; status: string; description: string };

const COLORS: Record<string, string> = { ok: "#14B8A6", config: "#FBBF24", needs_oauth: "#A88BE8", needs_provision: "#FF7A59", needs_dns: "#60A5FA", ready: "#94A3B8" };

export default function AgentsHealthStrip() {
  const [steps, setSteps] = useState<Step[] | null>(null);

  async function load() {
    try {
      const r = await fetch("/api/onboarding-status");
      if (!r.ok) return;
      const j = await r.json();
      setSteps(j.steps || []);
    } catch { /* */ }
  }
  useEffect(() => { load(); }, []);
  if (!steps) return null;
  const ok = steps.filter((s) => s.status === "ok").length;
  const total = steps.length;
  const needAttention = steps.filter((s) => s.status !== "ok" && s.status !== "ready");

  return (
    <div className="card-hard p-4 bg-white mb-4">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
        <div className="font-bold text-sm">🩺 Estado de tu equipo IA</div>
        <a href="/dashboard/onboarding" className="text-[10px] font-bold uppercase border-2 border-black px-2 py-1 hover:bg-black hover:text-[color:var(--mustard)]">
          {ok}/{total} listos · Ver onboarding →
        </a>
      </div>
      <div className="flex gap-1 flex-wrap">
        {steps.map((s) => (
          <span key={s.slug} title={`${s.name} · ${s.description}`} className="text-[10px] font-mono uppercase px-2 py-0.5 text-white" style={{ background: COLORS[s.status] }}>
            {s.emoji} {s.slug}
          </span>
        ))}
      </div>
      {needAttention.length > 0 && (
        <div className="text-[11px] text-black/60 mt-2">
          {needAttention.length} agente{needAttention.length > 1 ? "s" : ""} requieren configuración.
        </div>
      )}
    </div>
  );
}
