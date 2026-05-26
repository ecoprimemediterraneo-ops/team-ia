"use client";
import { useEffect, useState } from "react";

type Idioma = { code: string; nombre: string; flag: string };

export default function MartaTranslate() {
  const [idiomas, setIdiomas] = useState<Idioma[]>([]);
  const [text, setText] = useState("");
  const [target, setTarget] = useState("en");
  const [out, setOut] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { fetch("/api/marta/translate").then((r) => r.json()).then((j) => setIdiomas(j.idiomas || [])); }, []);

  async function go(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true); setOut("");
    try {
      const r = await fetch("/api/marta/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, target_lang: target }) });
      const j = await r.json();
      if (!r.ok) alert(j.error || "Error");
      else setOut(j.translated);
    } finally { setBusy(false); }
  }

  return (
    <div className="card-hard p-5 bg-white border-[#FF7A59]">
      <h3 className="font-stencil text-2xl mb-2">🌍 Caption multilingüe</h3>
      <p className="text-xs text-black/60 mb-3">Pega un caption ES y Marta lo traduce respetando emojis, hashtags y formato.</p>
      <form onSubmit={go} className="space-y-2">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder="Pega aquí el caption en español…" className="w-full border-2 border-black p-2 text-sm" />
        <div className="flex gap-2 items-end flex-wrap">
          <div>
            <label className="text-[10px] font-mono uppercase block mb-1">Traducir a</label>
            <select value={target} onChange={(e) => setTarget(e.target.value)} className="border-2 border-black px-2 py-1 text-sm bg-white">
              {idiomas.map((i) => (<option key={i.code} value={i.code}>{i.flag} {i.nombre}</option>))}
            </select>
          </div>
          <button type="submit" disabled={busy || !text.trim()} className="btn-mustard text-xs disabled:opacity-50">{busy ? "Traduciendo…" : "🌐 Traducir"}</button>
        </div>
      </form>
      {out && (
        <div className="mt-3 card-hard p-3 bg-[color:var(--cream)]">
          <div className="flex items-center justify-between mb-1">
            <div className="text-[10px] font-mono uppercase text-black/60">Traducción</div>
            <button onClick={() => { navigator.clipboard.writeText(out).catch(() => {}); alert("✓ Copiado"); }} className="text-[10px] font-bold uppercase border-2 border-black px-2 py-1 hover:bg-black hover:text-[color:var(--mustard)]">📋 Copiar</button>
          </div>
          <p className="text-sm whitespace-pre-wrap">{out}</p>
        </div>
      )}
    </div>
  );
}
