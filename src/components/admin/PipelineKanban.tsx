"use client";
import { useState } from "react";
import type { Lead, LeadStage } from "@/lib/pipeline-constants";
import { STAGE_ORDER, STAGE_LABEL } from "@/lib/pipeline-constants";

export default function PipelineKanban({ initialLeads }: { initialLeads: Lead[] }) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [sector, setSector] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Lead | null>(null);

  const sectors = Array.from(new Set(leads.map((l) => l.sector))).sort();

  const visibleLeads = leads.filter((l) => {
    if (sector !== "all" && l.sector !== sector) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return l.businessName.toLowerCase().includes(q) ||
             (l.contactName?.toLowerCase().includes(q)) ||
             (l.city?.toLowerCase().includes(q)) ||
             (l.email?.toLowerCase().includes(q));
    }
    return true;
  });

  // Solo mostramos las primeras 9 stages en kanban (lost y nurture se ven aparte)
  const kanbanStages: LeadStage[] = STAGE_ORDER.filter((s) => s !== "lost" && s !== "nurture");

  async function moveStage(leadId: string, newStage: LeadStage) {
    const res = await fetch(`/api/pipeline/${leadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: newStage }),
    });
    const data = await res.json();
    if (res.ok && data.lead) {
      setLeads(leads.map((l) => (l.id === leadId ? data.lead : l)));
      if (selected?.id === leadId) setSelected(data.lead);
    }
  }

  async function deleteLead(leadId: string) {
    if (!confirm("¿Eliminar este lead?")) return;
    await fetch(`/api/pipeline/${leadId}`, { method: "DELETE" });
    setLeads(leads.filter((l) => l.id !== leadId));
    if (selected?.id === leadId) setSelected(null);
  }

  return (
    <>
      {/* Filtros */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <input
          type="search"
          placeholder="Buscar (nombre, ciudad, email…)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border-2 border-black px-3 py-2 text-sm flex-1 min-w-[200px] max-w-md"
        />
        <select value={sector} onChange={(e) => setSector(e.target.value)} className="border-2 border-black px-3 py-2 text-sm bg-white">
          <option value="all">Todos los sectores ({leads.length})</option>
          {sectors.map((s) => <option key={s} value={s}>{s} ({leads.filter((l) => l.sector === s).length})</option>)}
        </select>
        <span className="text-xs font-mono text-black/60">Mostrando {visibleLeads.length}</span>
      </div>

      {/* Kanban scroll horizontal */}
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-3 min-w-max">
          {kanbanStages.map((st) => {
            const cards = visibleLeads.filter((l) => l.stage === st);
            return (
              <div key={st} className="w-72 shrink-0">
                <div className="card-hard p-3 mb-2 bg-black text-white flex items-center justify-between sticky top-0 z-10">
                  <span className="font-stencil text-sm">{STAGE_LABEL[st]}</span>
                  <span className="text-[10px] font-mono bg-[color:var(--mustard)] text-black px-2 py-0.5 font-bold">{cards.length}</span>
                </div>
                <ul className="space-y-2">
                  {cards.length === 0 ? (
                    <li className="text-xs text-black/40 italic p-2 text-center border border-dashed border-black/20">Vacío</li>
                  ) : cards.map((l) => (
                    <li
                      key={l.id}
                      onClick={() => setSelected(l)}
                      className="card-hard p-3 cursor-pointer hover:-translate-y-0.5 transition bg-white"
                    >
                      <div className="font-bold text-sm truncate">{l.businessName}</div>
                      {l.contactName && <div className="text-xs text-black/70 truncate">{l.contactName}</div>}
                      <div className="text-[10px] text-black/50 mt-1 flex flex-wrap gap-1">
                        {l.city && <span>📍 {l.city}</span>}
                        {l.rating && <span>★ {l.rating}</span>}
                        {l.reviewCount && <span>({l.reviewCount})</span>}
                      </div>
                      <div className="text-[9px] font-mono text-black/40 mt-1 truncate">{l.email || l.phone || ""}</div>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      {/* Lost + Nurture aparte */}
      <div className="mt-6 grid sm:grid-cols-2 gap-4">
        {(["lost", "nurture"] as LeadStage[]).map((st) => {
          const cards = visibleLeads.filter((l) => l.stage === st);
          return (
            <div key={st} className="card-hard p-3">
              <div className="font-stencil text-sm mb-2">{STAGE_LABEL[st]} <span className="text-xs font-mono">({cards.length})</span></div>
              <ul className="text-xs space-y-1 max-h-40 overflow-y-auto">
                {cards.map((l) => (
                  <li key={l.id} onClick={() => setSelected(l)} className="cursor-pointer hover:bg-[color:var(--cream)] p-1">
                    {l.businessName} <span className="text-black/40">· {l.city}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {/* Panel detalle */}
      {selected && (
        <div className="fixed inset-0 bg-black/60 z-40 flex items-end sm:items-center justify-center p-0 sm:p-6" onClick={() => setSelected(null)}>
          <div className="bg-[color:var(--cream)] border-[3px] border-black w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-[6px_6px_0_#000]" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b-[3px] border-black flex items-center justify-between">
              <div className="min-w-0">
                <h2 className="font-stencil text-2xl truncate">{selected.businessName}</h2>
                {selected.contactName && <p className="text-sm text-black/60">{selected.contactName}</p>}
              </div>
              <button onClick={() => setSelected(null)} className="text-3xl shrink-0">×</button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                {selected.email && <div><span className="font-bold">Email:</span> <a href={`mailto:${selected.email}`} className="underline">{selected.email}</a></div>}
                {selected.phone && <div><span className="font-bold">Tel:</span> <a href={`tel:${selected.phone}`} className="underline">{selected.phone}</a></div>}
                {selected.city && <div><span className="font-bold">Ciudad:</span> {selected.city}</div>}
                {selected.sector && <div><span className="font-bold">Sector:</span> {selected.sector}</div>}
                {selected.website && <div className="col-span-2 truncate"><span className="font-bold">Web:</span> <a href={selected.website} target="_blank" rel="noopener noreferrer" className="underline">{selected.website}</a></div>}
                {selected.rating !== undefined && <div><span className="font-bold">★ Rating:</span> {selected.rating} ({selected.reviewCount} reseñas)</div>}
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-widest text-black/60 mb-1">Mover a etapa</label>
                <select
                  value={selected.stage}
                  onChange={(e) => moveStage(selected.id, e.target.value as LeadStage)}
                  className="w-full border-2 border-black px-3 py-2 text-sm font-bold bg-white"
                >
                  {STAGE_ORDER.map((s) => (
                    <option key={s} value={s}>{STAGE_LABEL[s]}</option>
                  ))}
                </select>
              </div>

              {selected.notes && (
                <div>
                  <label className="block text-xs font-mono uppercase tracking-widest text-black/60 mb-1">Notas</label>
                  <p className="text-sm whitespace-pre-wrap bg-white border-2 border-black/20 p-3">{selected.notes}</p>
                </div>
              )}

              <div>
                <label className="block text-xs font-mono uppercase tracking-widest text-black/60 mb-1">Actividad ({selected.activities.length})</label>
                <ul className="text-xs space-y-1 max-h-60 overflow-y-auto bg-white border-2 border-black/20 p-3">
                  {selected.activities.slice(0, 20).map((a) => (
                    <li key={a.id} className="flex items-baseline gap-2">
                      <span className="font-mono text-black/50 shrink-0">{new Date(a.ts).toLocaleString("es-ES")}</span>
                      <span className="font-bold">{a.type.replace(/_/g, " ")}</span>
                      {a.data?.from !== undefined && <span className="text-black/60">· {String(a.data.from)} → {String(a.data.to)}</span>}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex gap-2 flex-wrap">
                <button onClick={() => deleteLead(selected.id)} className="text-xs font-mono border-2 border-[color:var(--red)] text-[color:var(--red)] px-3 py-2 hover:bg-[color:var(--red)] hover:text-white">🗑 ELIMINAR</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
