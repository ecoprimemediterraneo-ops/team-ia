"use client";

// CRM del panel (Biz) — listado de clientes con búsqueda + ficha (historial,
// gasto, no-shows, etiquetas y notas internas). Los clientes se derivan de las
// reservas; notas/etiquetas se guardan aparte.

import { useCallback, useEffect, useState } from "react";
import type { BookingRecord } from "@/lib/booking";

type ClienteAgg = {
  key: string; nombre: string; telefono?: string; email?: string;
  totalCitas: number; completadas: number; noShows: number; canceladas: number; gastoTotal: number;
  ultimaVisitaIso?: string; proximaCitaIso?: string; etiquetas: string[]; tieneNotas: boolean;
};
type Ficha = { cliente: ClienteAgg; historial: BookingRecord[]; meta: { notas?: string; etiquetas?: string[] } };

const ESTADO_LBL: Record<string, string> = { pendiente: "Pendiente", confirmada: "Confirmada", completada: "Completada", cancelada: "Cancelada", no_show: "No vino" };
const EST_COLOR: Record<string, string> = { pendiente: "#8a7500", confirmada: "#5A6B3F", completada: "#111", cancelada: "#999", no_show: "#C8202A" };
const fechaCorta = (iso?: string) => { if (!iso) return "—"; const [y, m, d] = iso.slice(0, 10).split("-"); return `${d}/${m}/${y.slice(2)}`; };

export default function ClientesView({ slug }: { slug: string }) {
  const [q, setQ] = useState("");
  const [clientes, setClientes] = useState<ClienteAgg[] | null>(null);
  const [cargando, setCargando] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [ficha, setFicha] = useState<Ficha | null>(null);

  const cargarLista = useCallback(async (query: string) => {
    setCargando(true);
    try {
      const r = await fetch(`/api/booking/${slug}/clientes?q=${encodeURIComponent(query)}`, { cache: "no-store" });
      const j = await r.json();
      if (j.ok) setClientes(j.clientes);
    } catch { /* */ } finally { setCargando(false); }
  }, [slug]);

  useEffect(() => { const t = setTimeout(() => cargarLista(q), 250); return () => clearTimeout(t); }, [q, cargarLista]);

  async function abrir(key: string) {
    setSel(key); setFicha(null);
    try {
      const r = await fetch(`/api/booking/${slug}/clientes?key=${encodeURIComponent(key)}`, { cache: "no-store" });
      const j = await r.json();
      if (j.ok) setFicha(j);
    } catch { /* */ }
  }

  if (sel) {
    if (!ficha) return <div className="animate-pulse text-black/40 font-mono text-sm py-8 text-center">Cargando ficha…</div>;
    return <FichaCliente slug={slug} ficha={ficha} onBack={() => { setSel(null); setFicha(null); cargarLista(q); }} />;
  }

  return (
    <div>
      <ReactivarDormidas slug={slug} />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, teléfono o email…" className="card-hard w-full px-3 py-2.5 mb-4 bg-white" />
      {clientes === null || cargando ? (
        <div className="animate-pulse text-black/40 font-mono text-sm py-6 text-center">Cargando…</div>
      ) : clientes.length === 0 ? (
        <div className="card-hard bg-white p-6 text-center"><div className="text-3xl mb-2">🧑‍🤝‍🧑</div><div className="font-bold">{q ? "Sin resultados" : "Sin clientes todavía"}</div><p className="text-sm text-black/50 mt-1">{q ? "Prueba otra búsqueda." : "Aparecerán aquí en cuanto reserven."}</p></div>
      ) : (
        <div className="space-y-2">{clientes.map((c) => <CardCliente key={c.key} c={c} onClick={() => abrir(c.key)} />)}</div>
      )}
    </div>
  );
}

function CardCliente({ c, onClick }: { c: ClienteAgg; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full text-left card-hard bg-white p-3 flex items-center justify-between gap-2 hover:translate-x-[1px] hover:translate-y-[1px] transition-transform">
      <div className="min-w-0">
        <div className="font-bold truncate flex items-center gap-2">
          {c.nombre}
          {c.etiquetas.slice(0, 3).map((t) => <span key={t} className="text-[9px] uppercase tracking-wide bg-[color:var(--mustard)] border border-black px-1 py-0.5">{t}</span>)}
          {c.tieneNotas && <span title="Tiene notas">📝</span>}
        </div>
        <div className="text-xs text-black/50 truncate">
          {c.telefono || c.email || "sin contacto"}
          {c.proximaCitaIso ? ` · próxima ${fechaCorta(c.proximaCitaIso)}` : c.ultimaVisitaIso ? ` · última ${fechaCorta(c.ultimaVisitaIso)}` : ""}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-xs"><b>{c.completadas}</b> <span className="text-black/40">visita{c.completadas === 1 ? "" : "s"}</span></div>
        {c.noShows > 0 && <div className="text-[10px] font-bold text-[color:var(--red)]">{c.noShows} no-show{c.noShows > 1 ? "s" : ""}</div>}
      </div>
    </button>
  );
}

function FichaCliente({ slug, ficha, onBack }: { slug: string; ficha: Ficha; onBack: () => void }) {
  const c = ficha.cliente;
  const [notas, setNotas] = useState(ficha.meta.notas || "");
  const [etiquetas, setEtiquetas] = useState<string[]>(ficha.meta.etiquetas || c.etiquetas || []);
  const [nuevaEt, setNuevaEt] = useState("");
  const [estado, setEstado] = useState<"idle" | "guardando" | "ok">("idle");

  const guardar = useCallback(async (tags: string[], notasVal: string) => {
    setEstado("guardando");
    try {
      const r = await fetch(`/api/booking/${slug}/clientes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: c.key, notas: notasVal, etiquetas: tags }) });
      if (r.ok) { setEstado("ok"); setTimeout(() => setEstado("idle"), 1500); } else setEstado("idle");
    } catch { setEstado("idle"); }
  }, [slug, c.key]);

  function addTag() { const t = nuevaEt.trim(); if (!t || etiquetas.includes(t)) { setNuevaEt(""); return; } const next = [...etiquetas, t]; setEtiquetas(next); setNuevaEt(""); guardar(next, notas); }
  function delTag(t: string) { const next = etiquetas.filter((x) => x !== t); setEtiquetas(next); guardar(next, notas); }

  return (
    <div>
      <button onClick={onBack} className="text-xs font-mono underline text-black/50 mb-3">← clientes</button>
      <h2 className="font-stencil text-2xl sm:text-3xl leading-none">{c.nombre}</h2>
      <div className="text-sm text-black/60 mt-1">{[c.telefono, c.email].filter(Boolean).join(" · ") || "sin contacto"}</div>

      <div className="grid grid-cols-4 gap-2 my-4">
        <Stat n={c.completadas} l="visitas" />
        <Stat n={`${c.gastoTotal}€`} l="gasto" />
        <Stat n={c.noShows} l="no-shows" alerta={c.noShows > 0} />
        <Stat n={c.canceladas} l="cancel." />
      </div>
      {c.proximaCitaIso && <div className="card-hard bg-[color:var(--mustard)] p-2.5 text-sm mb-4">📅 Próxima cita: <b>{fechaCorta(c.proximaCitaIso)} · {c.proximaCitaIso.slice(11, 16)}</b></div>}

      <div className="mb-4">
        <div className="text-xs font-bold uppercase tracking-widest mb-1">Etiquetas</div>
        <div className="flex flex-wrap gap-1.5 items-center">
          {etiquetas.map((t) => (
            <span key={t} className="text-xs font-bold bg-black text-white px-2 py-0.5 flex items-center gap-1">{t}<button onClick={() => delTag(t)} className="text-white/60 hover:text-white">✕</button></span>
          ))}
          <input value={nuevaEt} onChange={(e) => setNuevaEt(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }} placeholder="+ etiqueta" className="border-2 border-black px-2 py-0.5 text-xs w-24 bg-white" />
        </div>
      </div>

      <div className="mb-5">
        <div className="text-xs font-bold uppercase tracking-widest mb-1">Notas internas</div>
        <textarea value={notas} onChange={(e) => setNotas(e.target.value)} onBlur={() => guardar(etiquetas, notas)} rows={3} placeholder="Alergias, preferencias, incidencias…" className="card-hard w-full px-3 py-2 bg-white text-sm" />
        <div className="text-[11px] text-black/40 mt-1">{estado === "guardando" ? "Guardando…" : estado === "ok" ? "✓ Guardado" : "Se guarda al salir del campo."}</div>
      </div>

      <div>
        <div className="text-xs font-bold uppercase tracking-widest mb-2">Historial ({ficha.historial.length})</div>
        <div className="space-y-1.5">
          {ficha.historial.map((r) => (
            <div key={r.id} className="card-hard bg-white p-2.5 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="font-bold text-sm truncate">{[r.servicioNombre, r.varianteNombre].filter(Boolean).join(" · ")}</div>
                <div className="text-xs text-black/50">{fechaCorta(r.startIso)} · {r.startIso.slice(11, 16)}{r.empleadoNombre ? ` · ${r.empleadoNombre}` : ""}</div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-[10px] uppercase tracking-wide font-bold" style={{ color: EST_COLOR[r.estado] || "#111" }}>{ESTADO_LBL[r.estado] || r.estado}</div>
                {typeof r.precioEUR === "number" && r.precioEUR > 0 && <div className="text-xs text-black/50">{r.precioEUR}€</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ n, l, alerta }: { n: number | string; l: string; alerta?: boolean }) {
  return (
    <div className={`border-2 border-black p-2 text-center ${alerta ? "bg-[color:var(--red)]/10" : "bg-white"}`}>
      <div className={`font-stencil text-xl leading-none ${alerta ? "text-[color:var(--red)]" : ""}`}>{n}</div>
      <div className="text-[10px] uppercase tracking-wide text-black/50">{l}</div>
    </div>
  );
}

// ── Reactivar clientas dormidas ──────────────────────────────────────────────
type Dormida = {
  key: string; nombre: string; email: string; ultimaCitaIso: string; diasSinVenir: number;
  reactivacionEnviadaIso?: string; diasDesdeAviso?: number; puedeEnviar: boolean;
};

function textoTiempo(dias: number): string {
  if (dias >= 60) return `${Math.round(dias / 30)} meses`;
  return `${dias} días`;
}

function ReactivarDormidas({ slug }: { slug: string }) {
  const [dormidas, setDormidas] = useState<Dormida[] | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [enviando, setEnviando] = useState<string | null>(null); // key concreta, "__todas" o null
  const [msg, setMsg] = useState("");

  const cargar = useCallback(async () => {
    try {
      const r = await fetch(`/api/booking/${slug}/reactivar`, { cache: "no-store" });
      const j = await r.json();
      if (j.ok) setDormidas(j.dormidas as Dormida[]);
    } catch { /* */ }
  }, [slug]);
  useEffect(() => { cargar(); }, [cargar]);

  async function enviar(keys: string[], etiqueta: string) {
    if (!keys.length || enviando) return;
    setEnviando(etiqueta); setMsg("");
    try {
      const r = await fetch(`/api/booking/${slug}/reactivar`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ keys }) });
      const j = await r.json();
      if (r.ok && j.ok) setMsg(`✓ ${j.enviados} email${j.enviados === 1 ? "" : "s"} enviado${j.enviados === 1 ? "" : "s"}${j.saltados ? ` · ${j.saltados} saltado(s)` : ""}`);
      else setMsg("⚠ No se pudo enviar.");
      await cargar();
    } catch { setMsg("⚠ Fallo de red."); }
    finally { setEnviando(null); }
  }

  if (dormidas === null) return null; // silencioso hasta que cargue
  const enviables = dormidas.filter((d) => d.puedeEnviar);

  return (
    <div className="card-hard bg-white mb-4">
      <button onClick={() => setAbierto((v) => !v)} aria-expanded={abierto} className="w-full flex items-center justify-between gap-2 p-3 text-left hover:bg-[color:var(--cream)]">
        <span className="font-bold flex items-center gap-2">💤 Reactivar dormidas
          <span className="text-xs font-mono bg-[color:var(--mustard)] border border-black px-1.5 py-0.5">{dormidas.length}</span>
        </span>
        <span className={`text-2xl font-bold text-[color:var(--red)] leading-none transition-transform ${abierto ? "rotate-90" : ""}`} aria-hidden>›</span>
      </button>
      {abierto && (
        <div className="border-t-[3px] border-black p-3">
          {dormidas.length === 0 ? (
            <p className="text-sm text-black/50">No hay clientas dormidas ahora mismo. 🎉<br /><span className="text-xs text-black/40">(sin venir hace más de 60 días, sin cita futura y con email)</span></p>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2 mb-3">
                <p className="text-xs text-black/50">Sin venir hace &gt; 2 meses y sin cita futura.</p>
                <button onClick={() => enviar(enviables.map((d) => d.key), "__todas")} disabled={!enviables.length || enviando !== null} className="btn-mustard text-xs px-3 py-1.5 disabled:opacity-50">
                  {enviando === "__todas" ? "Enviando…" : `Reactivar todas (${enviables.length})`}
                </button>
              </div>
              <div className="space-y-2">
                {dormidas.map((d) => (
                  <div key={d.key} className="flex items-center justify-between gap-2 border-2 border-black/15 p-2">
                    <div className="min-w-0">
                      <div className="font-bold text-sm truncate">{d.nombre}</div>
                      <div className="text-xs text-black/50 truncate">{d.email} · {textoTiempo(d.diasSinVenir)} sin venir</div>
                    </div>
                    {d.puedeEnviar ? (
                      <button onClick={() => enviar([d.key], d.key)} disabled={enviando !== null} className="shrink-0 text-xs font-bold border-2 border-black px-2 py-1 hover:bg-black hover:text-white disabled:opacity-50">
                        {enviando === d.key ? "…" : "Reactivar"}
                      </button>
                    ) : (
                      <span className="shrink-0 text-[11px] text-black/40 text-right leading-tight" title={`Ya avisada hace ${d.diasDesdeAviso} días`}>✓ avisada<br />hace {d.diasDesdeAviso}d</span>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
          {msg && <p className={`text-xs font-bold mt-3 ${msg.startsWith("✓") ? "text-[color:var(--olive,#5A6B3F)]" : "text-[color:var(--red)]"}`}>{msg}</p>}
        </div>
      )}
    </div>
  );
}
