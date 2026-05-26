"use client";
import { useEffect, useState } from "react";

type Competidor = {
  id: string;
  username: string;
  motivo: string | null;
  active: boolean;
};

type Oportunidad = {
  id: string;
  source_username: string | null;
  source_url: string | null;
  tipo_contenido: string | null;
  por_que: string;
  propuesta_adaptada: string;
  created_at: string;
};

export default function MartaVirales() {
  const [comps, setComps] = useState<Competidor[]>([]);
  const [oports, setOports] = useState<Oportunidad[]>([]);

  const [newComp, setNewComp] = useState({ username: "", motivo: "" });
  const [showAddComp, setShowAddComp] = useState(false);

  const [showAnalizar, setShowAnalizar] = useState(false);
  const [analizar, setAnalizar] = useState({ descripcionViral: "", sourceUsername: "", tipoContenido: "reel" });
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const r = await fetch("/api/marta/virales");
      const j = await r.json();
      setComps(j.competidores || []);
      setOports(j.oportunidades || []);
    } catch { /* */ }
  }
  useEffect(() => { load(); }, []);

  async function addComp(e: React.FormEvent) {
    e.preventDefault();
    if (!newComp.username.trim()) return;
    await fetch("/api/marta/virales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "addCompetidor", username: newComp.username.trim(), motivo: newComp.motivo || undefined }),
    });
    setNewComp({ username: "", motivo: "" });
    setShowAddComp(false);
    load();
  }

  async function delComp(id: string) {
    if (!confirm("¿Quitar competidor?")) return;
    await fetch("/api/marta/virales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "deleteCompetidor", id }),
    });
    load();
  }

  async function submitAnalizar(e: React.FormEvent) {
    e.preventDefault();
    if (!analizar.descripcionViral.trim() || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/marta/virales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "analizarManual",
          descripcionViral: analizar.descripcionViral,
          sourceUsername: analizar.sourceUsername || undefined,
          tipoContenido: analizar.tipoContenido,
        }),
      });
      const j = await res.json();
      if (!res.ok) alert(j.error || "Error");
      else {
        setAnalizar({ descripcionViral: "", sourceUsername: "", tipoContenido: "reel" });
        setShowAnalizar(false);
        load();
      }
    } finally {
      setBusy(false);
    }
  }

  async function actOport(id: string, action: "aceptar" | "descartar") {
    await fetch("/api/marta/virales", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    load();
  }

  async function copyOport(o: Oportunidad) {
    const text = `🔥 OPORTUNIDAD VIRAL${o.source_username ? ` · vista en @${o.source_username}` : ""}

═══ POR QUÉ FUNCIONÓ ═══
${o.por_que}

═══ TU VERSIÓN PROPUESTA ═══
${o.propuesta_adaptada}`;
    await navigator.clipboard.writeText(text).catch(() => {});
    alert("✓ Oportunidad copiada");
  }

  return (
    <div className="card-hard p-5 bg-white border-[#FF7A59]">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <h3 className="font-stencil text-2xl">🔥 Oportunidades virales</h3>
      </div>
      <p className="text-xs text-black/60 mb-3">
        Marta vigila cuentas del sector + analiza posts que estén reventando para generar tu versión adaptada.
      </p>

      {/* Competidores */}
      <div className="mb-4">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
          <div className="text-xs font-mono uppercase tracking-widest text-black/60">CUENTAS A VIGILAR ({comps.length})</div>
          <button onClick={() => setShowAddComp((s) => !s)} className="text-[10px] font-bold uppercase tracking-widest border-2 border-black px-2 py-1 hover:bg-black hover:text-[color:var(--mustard)]">
            {showAddComp ? "Cerrar" : "+ Añadir"}
          </button>
        </div>

        {showAddComp && (
          <form onSubmit={addComp} className="card-hard p-3 bg-[color:var(--cream)] mb-2 space-y-2">
            <input value={newComp.username} onChange={(e) => setNewComp({ ...newComp, username: e.target.value })} placeholder="@usuario_instagram" required className="w-full border-2 border-black px-2 py-1 text-sm" />
            <input value={newComp.motivo} onChange={(e) => setNewComp({ ...newComp, motivo: e.target.value })} placeholder="Motivo (opcional): competidor directo / referente sector" className="w-full border-2 border-black px-2 py-1 text-sm" />
            <button type="submit" className="btn-mustard text-xs">Añadir</button>
          </form>
        )}

        {comps.length === 0 ? (
          <p className="text-[11px] text-black/40 italic">Añade cuentas IG del sector que quieras vigilar.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {comps.map((c) => (
              <div key={c.id} className="border-2 border-black px-3 py-1 text-xs flex items-center gap-2 bg-white">
                <span className="font-bold">@{c.username}</span>
                {c.motivo && <span className="text-[10px] text-black/50">· {c.motivo}</span>}
                <button onClick={() => delComp(c.id)} className="text-[color:var(--red)] font-bold hover:bg-[color:var(--red)] hover:text-white px-1">✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Análisis manual */}
      <div className="mb-4">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
          <div className="text-xs font-mono uppercase tracking-widest text-black/60">📝 ANÁLISIS MANUAL</div>
          <button onClick={() => setShowAnalizar((s) => !s)} className="text-[10px] font-bold uppercase tracking-widest border-2 border-black px-2 py-1 hover:bg-black hover:text-[color:var(--mustard)]">
            {showAnalizar ? "Cerrar" : "+ Analizar viral"}
          </button>
        </div>

        {showAnalizar && (
          <form onSubmit={submitAnalizar} className="card-hard p-3 bg-[color:var(--cream)] space-y-2">
            <p className="text-[11px] text-black/60">Pega aquí descripción de un post/reel viral que has visto. Marta te dará por qué funcionó + tu versión adaptada.</p>
            <textarea value={analizar.descripcionViral} onChange={(e) => setAnalizar({ ...analizar, descripcionViral: e.target.value })} placeholder="Ej: Reel de @clinicarival con 100k views donde explica 3 mitos sobre implantes con hook 'esto te lo escondieron'..." rows={4} className="w-full border-2 border-black p-2 text-sm" />
            <div className="grid sm:grid-cols-2 gap-2">
              <input value={analizar.sourceUsername} onChange={(e) => setAnalizar({ ...analizar, sourceUsername: e.target.value })} placeholder="@usuario fuente (opcional)" className="border-2 border-black px-2 py-1 text-sm" />
              <select value={analizar.tipoContenido} onChange={(e) => setAnalizar({ ...analizar, tipoContenido: e.target.value })} className="border-2 border-black px-2 py-1 text-sm bg-white">
                <option value="reel">Reel</option>
                <option value="post">Post</option>
                <option value="carrusel">Carrusel</option>
                <option value="story">Story</option>
              </select>
            </div>
            <button type="submit" disabled={busy || !analizar.descripcionViral} className="btn-mustard text-xs disabled:opacity-50">
              {busy ? "Analizando…" : "🧠 Generar mi versión"}
            </button>
          </form>
        )}
      </div>

      {/* Oportunidades */}
      {oports.length === 0 ? (
        <p className="text-sm text-black/50 text-center py-4">
          Sin oportunidades activas. Usa &quot;Analizar viral&quot; para registrar uno que hayas visto.
        </p>
      ) : (
        <div className="space-y-3">
          {oports.map((o) => (
            <div key={o.id} className="border-2 border-black bg-white p-3">
              <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-lg">🔥</span>
                  {o.source_username && <span className="font-bold text-sm">@{o.source_username}</span>}
                  {o.tipo_contenido && <span className="text-[10px] font-mono uppercase border border-black/40 px-2 py-0.5">{o.tipo_contenido}</span>}
                </div>
                <span className="text-[10px] font-mono text-black/40">{new Date(o.created_at).toLocaleDateString("es-ES")}</span>
              </div>
              <div className="mb-2">
                <div className="text-[10px] font-mono uppercase tracking-widest text-black/40 mb-1">POR QUÉ FUNCIONÓ</div>
                <p className="text-sm">{o.por_que}</p>
              </div>
              <div className="mb-3">
                <div className="text-[10px] font-mono uppercase tracking-widest text-black/40 mb-1">TU VERSIÓN PROPUESTA</div>
                <p className="text-sm font-bold border-l-4 border-[#FF7A59] pl-3">{o.propuesta_adaptada}</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => copyOport(o)} className="text-[10px] font-bold uppercase tracking-widest border-2 border-black px-2 py-1 hover:bg-black hover:text-[color:var(--mustard)]">📋 Copiar</button>
                <button onClick={() => actOport(o.id, "aceptar")} className="text-[10px] font-bold uppercase tracking-widest border-2 border-[#14B8A6] text-[#14B8A6] px-2 py-1 hover:bg-[#14B8A6] hover:text-white">✓ La haré</button>
                <button onClick={() => actOport(o.id, "descartar")} className="text-[10px] font-bold uppercase tracking-widest border-2 border-black/30 text-black/60 px-2 py-1 hover:bg-black/10">Descartar</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
