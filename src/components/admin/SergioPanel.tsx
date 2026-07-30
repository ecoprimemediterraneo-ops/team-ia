"use client";
import { useState } from "react";
import type { CompetidorVigilado } from "@/lib/sergio";
import { CATEGORIA_LABEL, FRECUENCIA_LABEL } from "@/lib/sergio";

// Este panel lista las fuentes que alguien ha dado de alta DE VERDAD. Antes
// pintaba siete competidores inventados en el código, con valoración de Google y
// "debilidades" ficticias, que parecían los competidores reales del negocio.
// Ahora, si no hay fuentes, se enseña un estado vacío que lo dice.

const CATEGORIAS = [
  { value: "", label: "(todas)" },
  { value: "direct_competitor", label: "Competidor directo" },
  { value: "adjacent", label: "Sector adyacente" },
  { value: "inspiration", label: "Referencia" },
];

function fecha(iso: string | null): string {
  if (!iso) return "nunca";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "nunca" : d.toLocaleDateString("es-ES");
}

// Los datos iniciales llegan YA CARGADOS desde el servidor (la página de admin
// los lee antes de pintar). Así no hace falta un efecto que dispare la primera
// petición, y el panel no parpadea. Los filtros sí recargan, pero desde el
// manejador del propio control, que es donde toca.
export default function SergioPanel({
  inicial,
  hayFuentesInicial,
  motivoInicial,
}: {
  inicial: CompetidorVigilado[];
  hayFuentesInicial: boolean;
  motivoInicial?: string;
}) {
  const [categoria, setCategoria] = useState("");
  const [soloActivos, setSoloActivos] = useState(false);
  const [competidores, setCompetidores] = useState<CompetidorVigilado[]>(inicial);
  const [hayFuentes, setHayFuentes] = useState<boolean>(hayFuentesInicial);
  const [motivo, setMotivo] = useState<string | null>(motivoInicial ?? null);
  const [loading, setLoading] = useState(false);
  const [pitch, setPitch] = useState<{ text: string; name: string } | null>(null);
  const [pitchLoading, setPitchLoading] = useState("");

  async function cargar(cat: string, activos: boolean) {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (cat) params.set("categoria", cat);
      if (activos) params.set("activos", "1");
      const res = await fetch(`/api/sergio?${params}`, { cache: "no-store" });
      const data = await res.json();
      setCompetidores(data.competidores ?? []);
      setHayFuentes(!!data.hayFuentes);
      setMotivo(data.motivo ?? null);
    } catch {
      setCompetidores([]);
      setHayFuentes(false);
      setMotivo("error_de_red");
    } finally {
      setLoading(false);
    }
  }

  function cambiarCategoria(v: string) { setCategoria(v); cargar(v, soloActivos); }
  function cambiarActivos(v: boolean) { setSoloActivos(v); cargar(categoria, v); }

  async function generarPitch(id: string, nombre: string) {
    setPitchLoading(id);
    try {
      const res = await fetch("/api/sergio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ competitorId: id }),
      });
      const data = await res.json();
      setPitch({ text: data.pitch ?? data.error ?? "Sin respuesta", name: nombre });
    } finally {
      setPitchLoading("");
    }
  }

  // --- Estado vacío honesto -------------------------------------------------
  if (!loading && !hayFuentes && !categoria && !soloActivos) {
    return (
      <div className="card-hard p-6 bg-white">
        <h3 className="font-stencil text-2xl mb-2">Sergio todavía no está configurado</h3>
        <p className="text-sm text-black/70 max-w-xl">
          No hay ninguna web dada de alta para vigilar, así que no hay nada que enseñar. Para que
          Sergio empiece a trabajar, añade las webs de los competidores que quieres seguir.
        </p>
        {motivo === "sin_base_de_datos" && (
          <p className="text-xs font-mono text-[color:var(--red)] mt-3">
            Además, ahora mismo no se puede leer el almacén de fuentes.
          </p>
        )}
        {motivo === "error_de_red" && (
          <p className="text-xs font-mono text-[color:var(--red)] mt-3">
            No se ha podido consultar el servidor. Vuelve a intentarlo.
          </p>
        )}
        <a href="/admin/sergio/fuentes" className="btn-mustard inline-block text-sm mt-4">
          Dar de alta la primera web →
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Filtros — solo por campos que existen de verdad */}
      <div className="card-hard p-4 flex flex-wrap gap-3 items-end">
        <label className="block">
          <span className="text-xs font-bold">Categoría</span>
          <select
            value={categoria}
            onChange={(e) => cambiarCategoria(e.target.value)}
            className="block w-52 border-2 border-black px-2 py-2 text-sm mt-1 bg-white"
          >
            {CATEGORIAS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm font-bold pb-2">
          <input type="checkbox" checked={soloActivos} onChange={(e) => cambiarActivos(e.target.checked)} />
          Solo las activas
        </label>
        <button onClick={() => cargar(categoria, soloActivos)} disabled={loading} className="btn-mustard text-sm">
          {loading ? "CARGANDO…" : "🔄 ACTUALIZAR"}
        </button>
        <a href="/admin/sergio/fuentes" className="text-xs font-mono border-2 border-black px-3 py-2 hover:bg-black hover:text-white">
          ⚙ GESTIONAR FUENTES
        </a>
      </div>

      {/* Resultados */}
      {loading ? (
        <p className="text-xs font-mono text-black/50">Cargando…</p>
      ) : competidores.length === 0 ? (
        <div className="card-hard p-5 bg-white">
          <p className="text-sm text-black/70">
            Ninguna fuente coincide con ese filtro. Hay {" "}
            <button onClick={() => { setCategoria(""); setSoloActivos(false); cargar("", false); }} className="underline font-bold">
              quitar los filtros
            </button>{" "}
            para verlas todas.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs font-mono text-black/50">
            {competidores.length} {competidores.length === 1 ? "web vigilada" : "webs vigiladas"}
          </p>
          {competidores.map((c) => (
            <div key={c.id} className="card-hard p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-stencil text-lg">{c.nombre}</span>
                    <span className="text-xs font-mono border border-black/30 px-1.5 py-0.5">
                      {CATEGORIA_LABEL[c.categoria] ?? c.categoria}
                    </span>
                    {c.activo ? (
                      <span className="bg-green-200 text-green-900 px-1.5 py-0.5 text-[10px] font-bold">ACTIVA</span>
                    ) : (
                      <span className="bg-black/10 text-black/60 px-1.5 py-0.5 text-[10px] font-bold">PAUSADA</span>
                    )}
                  </div>
                  <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-xs font-mono underline text-black/60 break-all">
                    {c.url}
                  </a>
                  <div className="flex items-center gap-3 text-xs mt-2 flex-wrap text-black/70">
                    <span>Revisión: {FRECUENCIA_LABEL[c.frecuencia] ?? c.frecuencia}</span>
                    <span>Última: {fecha(c.ultimaRevision)}</span>
                    <span>{c.cambiosDetectados} {c.cambiosDetectados === 1 ? "cambio detectado" : "cambios detectados"}</span>
                  </div>
                  {!c.ultimaRevision && (
                    <p className="text-xs text-[color:var(--red)] mt-2 font-mono">
                      Todavía no se ha revisado esta web ni una vez.
                    </p>
                  )}
                </div>
                <button
                  onClick={() => generarPitch(c.id, c.nombre)}
                  disabled={pitchLoading === c.id}
                  className="text-xs font-mono border-2 border-black px-3 py-2 hover:bg-[color:var(--mustard)] whitespace-nowrap"
                >
                  {pitchLoading === c.id ? "GENERANDO…" : "🎯 GENERAR PITCH"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pitch */}
      {pitch && (
        <div className="card-hard p-5 border-4 border-[color:var(--mustard)]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-stencil text-xl">🎯 Pitch para un negocio como {pitch.name}</h3>
            <button onClick={() => setPitch(null)} className="text-xs font-mono border-2 border-black px-2 py-1">✕ CERRAR</button>
          </div>
          <div className="text-sm whitespace-pre-wrap bg-white border-2 border-black p-4">{pitch.text}</div>
          <button
            onClick={() => navigator.clipboard.writeText(pitch.text)}
            className="mt-3 text-xs font-mono border-2 border-black px-3 py-2 hover:bg-black hover:text-white"
          >
            📋 COPIAR PITCH
          </button>
        </div>
      )}
    </div>
  );
}
