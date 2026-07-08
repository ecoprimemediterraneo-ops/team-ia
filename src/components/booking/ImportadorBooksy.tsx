"use client";

// Alta de salón (founder) con importador Booksy.
// 1) Pega URL de Booksy → "Importar" → el backend extrae y devuelve un borrador.
//    (o "Empezar en blanco" para alta manual con las categorías-familia por defecto)
// 2) Pantalla de revisión EDITABLE (marca, categorías, servicios, horario).
// 3) "Crear salón" → POST /api/admin/salones (geocodifica la dirección y guarda).

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIAS_FAMILIA } from "@/lib/booking-categorias";

type Cat = { id: string; nombre: string };
type Svc = { id: string; nombre: string; categoriaId?: string; precioEUR?: number; durationMin: number; descripcion?: string; activo: boolean };
type Dia = { abierto: boolean; franjas: { desde: string; hasta: string }[] };
type Horario = Record<string, Dia>;
type Draft = {
  nombre: string; descripcion?: string; direccion?: string; telefono?: string; instagram?: string;
  categorias: Cat[]; servicios: Svc[]; horario: Horario; avisos?: string[];
};

const DIAS: { n: number; label: string }[] = [
  { n: 1, label: "Lunes" }, { n: 2, label: "Martes" }, { n: 3, label: "Miércoles" },
  { n: 4, label: "Jueves" }, { n: 5, label: "Viernes" }, { n: 6, label: "Sábado" }, { n: 0, label: "Domingo" },
];

let seq = 0;
const nid = (p: string) => `${p}_${Date.now().toString(36)}${seq++}`;

function horarioVacio(): Horario {
  const lab = { abierto: true, franjas: [{ desde: "09:00", hasta: "14:00" }, { desde: "16:00", hasta: "20:00" }] };
  const sab = { abierto: true, franjas: [{ desde: "10:00", hasta: "14:00" }] };
  const cer = { abierto: false, franjas: [] as { desde: string; hasta: string }[] };
  return { "0": cer, "1": lab, "2": lab, "3": lab, "4": lab, "5": lab, "6": sab };
}

export default function ImportadorBooksy() {
  const router = useRouter();
  const [fase, setFase] = useState<"inicio" | "revision">("inicio");
  const [url, setUrl] = useState("");
  const [importando, setImportando] = useState(false);
  const [error, setError] = useState("");
  const [fuente, setFuente] = useState("");
  const [d, setD] = useState<Draft | null>(null);
  const [creando, setCreando] = useState(false);

  async function importar() {
    setError("");
    setImportando(true);
    try {
      const r = await fetch("/api/admin/salones/importar", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: url.trim() }),
      });
      const j = await r.json();
      if (r.ok && j.ok) {
        setD(normalizar(j.draft));
        setFuente(j.fuente || "");
        setFase("revision");
      } else {
        setError(j.error || "No se pudo importar. Revisa la URL o empieza en blanco.");
      }
    } catch {
      setError("Fallo de red al importar.");
    } finally {
      setImportando(false);
    }
  }

  function empezarEnBlanco() {
    setD({ nombre: "", categorias: [], servicios: [], horario: horarioVacio(), avisos: [] });
    setFuente("");
    setFase("revision");
  }

  function normalizar(draft: Draft): Draft {
    const horario = draft.horario && Object.keys(draft.horario).length ? draft.horario : horarioVacio();
    return { ...draft, horario, servicios: draft.servicios || [], categorias: draft.categorias || [] };
  }

  async function crear() {
    if (!d) return;
    setError("");
    if (!d.nombre.trim()) { setError("Ponle un nombre al salón."); return; }
    if (d.servicios.length === 0) { setError("Añade al menos un servicio."); return; }
    setCreando(true);
    try {
      const payload = {
        nombre: d.nombre.trim(),
        descripcion: d.descripcion?.trim() || undefined,
        direccion: d.direccion?.trim() || undefined,
        telefono: d.telefono?.trim() || undefined,
        instagram: d.instagram?.replace(/^@/, "").trim() || undefined,
        categorias: d.categorias.map((c) => ({ id: c.id, nombre: c.nombre })),
        servicios: d.servicios.map((s) => ({
          id: s.id, nombre: s.nombre.trim(), categoriaId: s.categoriaId || undefined,
          durationMin: Math.max(5, s.durationMin || 30),
          precioEUR: typeof s.precioEUR === "number" && s.precioEUR >= 0 ? s.precioEUR : undefined,
          descripcion: s.descripcion?.trim() || undefined, activo: s.activo,
        })),
        horario: d.horario,
      };
      const r = await fetch("/api/admin/salones", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const j = await r.json();
      if (r.ok && j.ok) {
        router.push(`/admin/salones?creado=${j.slug}`);
      } else {
        setError(j.error || "No se pudo crear el salón.");
      }
    } catch {
      setError("Fallo de red al crear.");
    } finally {
      setCreando(false);
    }
  }

  // --- edición de estado -----------------------------------------------------
  const patch = (p: Partial<Draft>) => setD((prev) => (prev ? { ...prev, ...p } : prev));
  const toggleFamilia = (fam: Cat) => {
    if (!d) return;
    const existe = d.categorias.some((c) => c.id === fam.id);
    if (existe) patch({ categorias: d.categorias.filter((c) => c.id !== fam.id) });
    else patch({ categorias: [...d.categorias, { id: fam.id, nombre: fam.nombre }] });
  };
  const addCategoriaCustom = () => { if (d) patch({ categorias: [...d.categorias, { id: nid("cat"), nombre: "Nueva categoría" }] }); };
  const setCatNombre = (id: string, nombre: string) => d && patch({ categorias: d.categorias.map((c) => (c.id === id ? { ...c, nombre } : c)) });
  const delCategoria = (id: string) => d && patch({ categorias: d.categorias.filter((c) => c.id !== id) });
  const addServicio = () => d && patch({ servicios: [...d.servicios, { id: nid("svc"), nombre: "", categoriaId: d.categorias[0]?.id, durationMin: 30, precioEUR: undefined, activo: true }] });
  const setSvc = (id: string, p: Partial<Svc>) => d && patch({ servicios: d.servicios.map((s) => (s.id === id ? { ...s, ...p } : s)) });
  const delServicio = (id: string) => d && patch({ servicios: d.servicios.filter((s) => s.id !== id) });
  const setDia = (n: number, p: Partial<Dia>) => d && patch({ horario: { ...d.horario, [n]: { ...d.horario[String(n)], ...p } } });
  const setFranja = (n: number, i: number, campo: "desde" | "hasta", val: string) => {
    if (!d) return;
    const dia = d.horario[String(n)];
    const franjas = dia.franjas.map((f, idx) => (idx === i ? { ...f, [campo]: val } : f));
    setDia(n, { franjas });
  };
  const addFranja = (n: number) => { if (!d) return; const dia = d.horario[String(n)]; setDia(n, { franjas: [...dia.franjas, { desde: "16:00", hasta: "20:00" }] }); };
  const delFranja = (n: number, i: number) => { if (!d) return; const dia = d.horario[String(n)]; setDia(n, { franjas: dia.franjas.filter((_, idx) => idx !== i) }); };

  // ---------------------------------------------------------------------------
  if (fase === "inicio") {
    return (
      <div className="max-w-xl">
        <div className="card-hard bg-white p-6">
          <label className="block text-xs font-bold uppercase tracking-widest mb-1">URL de Booksy del salón</label>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") importar(); }}
            placeholder="https://booksy.com/es-es/..."
            className="card-hard w-full px-3 py-2 bg-white mb-2"
          />
          <p className="text-xs text-black/50 mb-4">Pega el enlace de la ficha pública del salón en Booksy. Extraeremos nombre, dirección, teléfono, Instagram, servicios y horario para que los revises antes de crear.</p>
          {error && <div className="border-2 border-[color:var(--red)] text-[color:var(--red)] text-sm font-bold p-2 mb-3">⚠ {error}</div>}
          <div className="flex gap-2">
            <button onClick={importar} disabled={importando || !url.trim()} className="btn-mustard disabled:opacity-50">{importando ? "Importando… (10-30s)" : "Importar de Booksy"}</button>
            <button onClick={empezarEnBlanco} className="border-[3px] border-black bg-white px-4 py-2 text-sm font-bold uppercase tracking-widest hover:bg-[color:var(--cream)]">Empezar en blanco</button>
          </div>
        </div>
      </div>
    );
  }

  if (!d) return null;
  const famSet = new Set(d.categorias.map((c) => c.id));

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-2 text-xs font-mono">
        <button onClick={() => setFase("inicio")} className="underline text-black/50">← volver</button>
        {fuente && <span className="border-2 border-black px-2 py-0.5 uppercase tracking-widest">Fuente: {fuente}</span>}
        <span className="text-black/40">Revisa y corrige antes de crear</span>
      </div>

      {d.avisos && d.avisos.length > 0 && (
        <div className="border-2 border-[color:var(--mustard)] bg-[color:var(--mustard)]/10 p-3 text-sm">
          {d.avisos.map((a, i) => <div key={i}>• {a}</div>)}
        </div>
      )}

      {/* Marca */}
      <section className="card-hard bg-white p-5">
        <h2 className="font-stencil text-2xl mb-3">Datos del salón</h2>
        <div className="grid gap-3">
          <Campo label="Nombre" value={d.nombre} onChange={(v) => patch({ nombre: v })} placeholder="Nombre del salón" />
          <Campo label="Descripción" value={d.descripcion || ""} onChange={(v) => patch({ descripcion: v })} placeholder="1-2 frases" />
          <Campo label="Dirección" value={d.direccion || ""} onChange={(v) => patch({ direccion: v })} placeholder="Calle, nº, CP, ciudad" hint="Se geocodifica al crear (para el mapa)." />
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Teléfono" value={d.telefono || ""} onChange={(v) => patch({ telefono: v })} placeholder="+34 …" />
            <Campo label="Instagram (sin @)" value={d.instagram || ""} onChange={(v) => patch({ instagram: v })} placeholder="usuario" />
          </div>
        </div>
      </section>

      {/* Categorías-familia */}
      <section className="card-hard bg-white p-5">
        <h2 className="font-stencil text-2xl mb-1">Categorías</h2>
        <p className="text-xs text-black/50 mb-3">Familias por defecto (marca las que ofrece el salón). Puedes añadir propias.</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {CATEGORIAS_FAMILIA.map((f) => (
            <button key={f.id} onClick={() => toggleFamilia(f)} className={`text-xs font-bold uppercase tracking-wide border-2 border-black px-2.5 py-1 ${famSet.has(f.id) ? "bg-black text-white" : "bg-white hover:bg-[color:var(--cream)]"}`}>
              {famSet.has(f.id) ? "✓ " : ""}{f.nombre}
            </button>
          ))}
        </div>
        {/* Categorías propias (las que no son familia por defecto) */}
        <div className="space-y-2">
          {d.categorias.filter((c) => !CATEGORIAS_FAMILIA.some((f) => f.id === c.id)).map((c) => (
            <div key={c.id} className="flex gap-2 items-center">
              <input value={c.nombre} onChange={(e) => setCatNombre(c.id, e.target.value)} className="card-hard px-3 py-1.5 bg-white text-sm flex-1" />
              <button onClick={() => delCategoria(c.id)} className="border-2 border-black px-2 py-1 text-xs font-bold hover:bg-black hover:text-white">✕</button>
            </div>
          ))}
          <button onClick={addCategoriaCustom} className="text-xs font-bold uppercase tracking-widest underline">+ categoría propia</button>
        </div>
      </section>

      {/* Servicios */}
      <section className="card-hard bg-white p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-stencil text-2xl">Servicios ({d.servicios.length})</h2>
          <button onClick={addServicio} className="btn-mustard text-xs">＋ Servicio</button>
        </div>
        <div className="space-y-2">
          {d.servicios.length === 0 && <p className="text-sm text-black/40">Sin servicios. Añade uno.</p>}
          {d.servicios.map((s) => (
            <div key={s.id} className="border-2 border-black p-2 grid gap-2">
              <div className="flex gap-2">
                <input value={s.nombre} onChange={(e) => setSvc(s.id, { nombre: e.target.value })} placeholder="Nombre del servicio" className="card-hard px-2 py-1.5 bg-white text-sm flex-1" />
                <button onClick={() => delServicio(s.id)} className="border-2 border-black px-2 text-xs font-bold hover:bg-black hover:text-white" title="Eliminar">✕</button>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <select value={s.categoriaId || ""} onChange={(e) => setSvc(s.id, { categoriaId: e.target.value || undefined })} className="card-hard px-2 py-1.5 bg-white text-xs">
                  <option value="">— categoría —</option>
                  {d.categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
                <label className="text-xs flex items-center gap-1">Precio €
                  <input type="number" min={0} step={1} value={s.precioEUR ?? ""} onChange={(e) => setSvc(s.id, { precioEUR: e.target.value === "" ? undefined : Math.max(0, +e.target.value) })} className="card-hard px-2 py-1 bg-white w-20 text-xs" />
                </label>
                <label className="text-xs flex items-center gap-1">Min
                  <input type="number" min={5} step={5} value={s.durationMin} onChange={(e) => setSvc(s.id, { durationMin: Math.max(5, +e.target.value || 30) })} className="card-hard px-2 py-1 bg-white w-16 text-xs" />
                </label>
                <label className="text-xs flex items-center gap-1">
                  <input type="checkbox" checked={s.activo} onChange={(e) => setSvc(s.id, { activo: e.target.checked })} /> activo
                </label>
              </div>
              <input value={s.descripcion || ""} onChange={(e) => setSvc(s.id, { descripcion: e.target.value })} placeholder="Descripción (opcional)" className="card-hard px-2 py-1.5 bg-white text-xs" />
            </div>
          ))}
        </div>
      </section>

      {/* Horario */}
      <section className="card-hard bg-white p-5">
        <h2 className="font-stencil text-2xl mb-3">Horario semanal</h2>
        <div className="space-y-2">
          {DIAS.map(({ n, label }) => {
            const dia = d.horario[String(n)] || { abierto: false, franjas: [] };
            return (
              <div key={n} className="flex flex-wrap items-center gap-2 border-b border-black/10 pb-2">
                <label className="w-28 flex items-center gap-2 text-sm font-bold">
                  <input type="checkbox" checked={dia.abierto} onChange={(e) => setDia(n, { abierto: e.target.checked })} /> {label}
                </label>
                {dia.abierto ? (
                  <div className="flex flex-wrap gap-2 items-center">
                    {dia.franjas.map((f, i) => (
                      <span key={i} className="inline-flex items-center gap-1 border-2 border-black px-1.5 py-0.5">
                        <input type="time" value={f.desde} onChange={(e) => setFranja(n, i, "desde", e.target.value)} className="text-xs bg-white" />
                        <span className="text-xs">–</span>
                        <input type="time" value={f.hasta} onChange={(e) => setFranja(n, i, "hasta", e.target.value)} className="text-xs bg-white" />
                        <button onClick={() => delFranja(n, i)} className="text-xs font-bold text-[color:var(--red)] ml-1">✕</button>
                      </span>
                    ))}
                    <button onClick={() => addFranja(n)} className="text-xs font-bold underline">+ franja</button>
                  </div>
                ) : (
                  <span className="text-xs text-black/40">cerrado</span>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {error && <div className="border-2 border-[color:var(--red)] text-[color:var(--red)] text-sm font-bold p-2">⚠ {error}</div>}

      <div className="flex gap-2 sticky bottom-0 bg-[color:var(--cream)] py-3 border-t-[3px] border-black">
        <button onClick={crear} disabled={creando} className="btn-mustard disabled:opacity-50">{creando ? "Creando salón…" : "Crear salón"}</button>
        <button onClick={() => setFase("inicio")} className="border-[3px] border-black bg-white px-4 py-2 text-sm font-bold uppercase tracking-widest hover:bg-[color:var(--cream)]">Cancelar</button>
      </div>
    </div>
  );
}

function Campo({ label, value, onChange, placeholder, hint }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; hint?: string }) {
  return (
    <div>
      <label className="block text-xs font-bold uppercase tracking-widest mb-1">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="card-hard w-full px-3 py-2 bg-white" />
      {hint && <p className="text-[11px] text-black/40 mt-1">{hint}</p>}
    </div>
  );
}
