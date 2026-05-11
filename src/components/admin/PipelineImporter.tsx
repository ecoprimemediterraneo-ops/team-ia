"use client";
import { useState } from "react";

export default function PipelineImporter() {
  const [csv, setCsv] = useState("");
  const [defaultSector, setDefaultSector] = useState("Clínica dental");
  const [defaultSource, setDefaultSource] = useState("apollo");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ added: number; skipped: number; parsed: number } | null>(null);
  const [error, setError] = useState("");

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setCsv(String(reader.result || ""));
    reader.readAsText(f);
  }

  async function doImport() {
    if (!csv.trim()) { setError("Pega un CSV"); return; }
    setImporting(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/pipeline/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv, defaultSector, defaultSource }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setResult({ added: data.added, skipped: data.skipped, parsed: data.parsed });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally { setImporting(false); }
  }

  return (
    <div className="card-hard p-5 space-y-4">
      <input type="file" accept=".csv,.txt" onChange={handleFile} className="block text-sm" />

      <textarea
        value={csv}
        onChange={(e) => setCsv(e.target.value)}
        rows={10}
        placeholder="Pega aquí tu CSV o sube archivo arriba…"
        className="w-full border-2 border-black px-3 py-2 text-sm font-mono"
      />

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-mono uppercase tracking-widest text-black/60 mb-1">Sector por defecto</label>
          <select value={defaultSector} onChange={(e) => setDefaultSector(e.target.value)} className="w-full border-2 border-black px-3 py-2 text-sm bg-white">
            <option>Clínica dental</option>
            <option>Peluquería / estética</option>
            <option>Fisio / nutrición</option>
            <option>Restaurante / hostelería</option>
            <option>Inmobiliaria</option>
            <option>Gestoría / asesoría</option>
            <option>Coach / consultor</option>
            <option>E-commerce</option>
            <option>Otro</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-mono uppercase tracking-widest text-black/60 mb-1">Fuente</label>
          <select value={defaultSource} onChange={(e) => setDefaultSource(e.target.value)} className="w-full border-2 border-black px-3 py-2 text-sm bg-white">
            <option value="apollo">Apollo</option>
            <option value="hunter">Hunter.io</option>
            <option value="linkedin">LinkedIn Sales Nav</option>
            <option value="manual">Manual</option>
            <option value="csv">CSV genérico</option>
          </select>
        </div>
      </div>

      <button onClick={doImport} disabled={importing} className="btn-mustard">
        {importing ? "IMPORTANDO…" : "📤 IMPORTAR AL PIPELINE"}
      </button>

      {error && <div className="bg-red-200 border-2 border-black p-3 text-sm">⚠ {error}</div>}
      {result && (
        <div className="bg-green-200 border-2 border-black p-3 text-sm">
          ✓ <b>{result.added}</b> leads importados · <b>{result.skipped}</b> duplicados saltados · {result.parsed} parseados del CSV
          <div className="mt-2">
            <a href="/admin/pipeline" className="underline font-bold">Ver pipeline →</a>
          </div>
        </div>
      )}
    </div>
  );
}
