"use client";
import { useEffect, useState } from "react";

type TemplateInfo = { id: string; name: string; steps: number; preview: string };
type Preview = { delayHours: number; subject: string; body: string; to: string }[];

export default function CampaignLauncher({ sectors, cities }: { sectors: string[]; cities: string[] }) {
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [stage, setStage] = useState("new");
  const [sector, setSector] = useState("");
  const [city, setCity] = useState("");
  const [preview, setPreview] = useState<{ leadsCount: number; preview: Preview; firstLead: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ leadsTargeted: number; emailsScheduled: number } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/pipeline/campaign").then((r) => r.json()).then((d) => {
      setTemplates(d.templates || []);
      if (d.templates?.[0]) setTemplateId(d.templates[0].id);
    });
  }, []);

  async function doDryRun() {
    if (!templateId) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/pipeline/campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId,
          filter: {
            stage: stage || undefined,
            sector: sector || undefined,
            city: city || undefined,
          },
          dryRun: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setPreview(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally { setLoading(false); }
  }

  async function launch() {
    if (!preview) return;
    if (!confirm(`¿Lanzar campaña a ${preview.leadsCount} leads? Se programarán ${preview.leadsCount * (preview.preview?.length || 0)} emails. Eva los enviará en los próximos días según los delays.`)) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/pipeline/campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId,
          filter: {
            stage: stage || undefined,
            sector: sector || undefined,
            city: city || undefined,
          },
          dryRun: false,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setResult(data);
      setPreview(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally { setLoading(false); }
  }

  return (
    <div className="space-y-4">
      <div className="card-hard p-5">
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block sm:col-span-2">
            <span className="text-xs font-bold">Template de outreach</span>
            <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className="w-full border-2 border-black px-3 py-2 text-sm mt-1 bg-white">
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.steps} emails)</option>)}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-bold">Etapa</span>
            <select value={stage} onChange={(e) => setStage(e.target.value)} className="w-full border-2 border-black px-3 py-2 text-sm mt-1 bg-white">
              <option value="">(todas)</option>
              <option value="new">🆕 Nuevo</option>
              <option value="enriched">📊 Enriquecido</option>
              <option value="contacted">📤 Ya contactado</option>
              <option value="nurture">🌱 Nurture</option>
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-bold">Sector</span>
            <select value={sector} onChange={(e) => setSector(e.target.value)} className="w-full border-2 border-black px-3 py-2 text-sm mt-1 bg-white">
              <option value="">(todos)</option>
              {sectors.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>

          <label className="block sm:col-span-2">
            <span className="text-xs font-bold">Ciudad</span>
            <select value={city} onChange={(e) => setCity(e.target.value)} className="w-full border-2 border-black px-3 py-2 text-sm mt-1 bg-white">
              <option value="">(todas)</option>
              {cities.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        </div>

        <button onClick={doDryRun} disabled={loading || !templateId} className="btn-mustard text-sm mt-4">
          {loading ? "CALCULANDO…" : "👁 PREVIEW (sin enviar)"}
        </button>
      </div>

      {error && <div className="bg-red-200 border-2 border-black p-3 text-sm">⚠ {error}</div>}

      {preview && (
        <div className="card-hard p-5">
          <h2 className="font-stencil text-2xl mb-3">📨 Preview campaña</h2>
          <p className="text-sm mb-3"><b>{preview.leadsCount}</b> leads coinciden con el filtro · primer lead: <b>{preview.firstLead}</b></p>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {preview.preview.map((e, i) => (
              <div key={i} className="border-2 border-black p-3 bg-[color:var(--cream)]">
                <div className="text-[10px] font-mono text-black/50 mb-1">
                  EMAIL {i + 1} · Delay: {e.delayHours}h · Para: {e.to}
                </div>
                <div className="font-bold text-sm mb-2">{e.subject}</div>
                <div className="text-xs whitespace-pre-wrap text-black/80">{e.body}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-2 flex-wrap">
            <button onClick={launch} disabled={loading} className="btn-mustard">
              {loading ? "LANZANDO…" : `🚀 LANZAR A ${preview.leadsCount} LEADS`}
            </button>
            <button onClick={() => setPreview(null)} className="text-xs font-mono border-2 border-black px-3 py-2">CANCELAR</button>
          </div>
        </div>
      )}

      {result && (
        <div className="bg-green-200 border-2 border-black p-4 text-sm">
          ✅ Campaña lanzada · {result.leadsTargeted} leads contactados · {result.emailsScheduled} emails programados.
          <div className="mt-2">
            <a href="/admin/pipeline" className="underline font-bold">Ver pipeline →</a>
          </div>
        </div>
      )}
    </div>
  );
}
