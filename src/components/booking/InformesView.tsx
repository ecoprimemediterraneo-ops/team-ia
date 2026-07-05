"use client";

// Informes del panel (Biz): ingresos, citas, no-shows, ocupación estimada,
// clientes nuevos vs recurrentes, y desglose por empleado y por servicio.
// Sin pagos online: "ingresos" = precio de las citas completadas.
import { useCallback, useEffect, useState } from "react";

type Fila = { id: string; nombre: string; ingresos: number; citas: number };
type Informe = {
  from: string; to: string; ingresos: number;
  citas: { total: number; completadas: number; confirmadas: number; canceladas: number; noShow: number };
  tasaNoShow: number;
  clientes: { nuevos: number; recurrentes: number };
  ocupacion: { reservadoMin: number; capacidadMin: number; pct: number };
  porEmpleado: Fila[]; porServicio: Fila[];
};

const eur = (n: number) => `${(n || 0).toLocaleString("es-ES")} €`;
const ymd = (d: Date) => d.toISOString().slice(0, 10);
function rango(preset: "semana" | "mes" | "30"): [string, string] {
  const now = new Date();
  const to = ymd(now);
  if (preset === "semana") { const d = new Date(now); const wd = (d.getDay() + 6) % 7; d.setDate(d.getDate() - wd); return [ymd(d), to]; }
  if (preset === "mes") { return [ymd(new Date(now.getFullYear(), now.getMonth(), 1)), to]; }
  const d = new Date(now); d.setDate(d.getDate() - 29); return [ymd(d), to];
}
const fechaCorta = (iso: string) => { const [y, m, d] = iso.split("-"); return `${d}/${m}/${y.slice(2)}`; };

const PRESETS = [["semana", "Esta semana"], ["mes", "Este mes"], ["30", "Últimos 30 días"]] as const;

export default function InformesView({ slug }: { slug: string }) {
  const [preset, setPreset] = useState<"semana" | "mes" | "30" | "custom">("30");
  const [from, setFrom] = useState(rango("30")[0]);
  const [to, setTo] = useState(rango("30")[1]);
  const [data, setData] = useState<Informe | null>(null);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async (f: string, t: string) => {
    setCargando(true);
    try {
      const r = await fetch(`/api/booking/${slug}/informe?from=${f}&to=${t}`, { cache: "no-store" });
      const j = await r.json();
      if (j.ok) setData(j.informe);
    } catch { /* */ } finally { setCargando(false); }
  }, [slug]);
  useEffect(() => { cargar(from, to); }, [cargar, from, to]);

  function elegirPreset(p: "semana" | "mes" | "30") { setPreset(p); const [f, t] = rango(p); setFrom(f); setTo(t); }

  return (
    <div>
      {/* Periodo */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="inline-flex border-[3px] border-black">
          {PRESETS.map(([p, label]) => (
            <button key={p} onClick={() => elegirPreset(p)} className={`px-3 py-1.5 text-xs font-bold uppercase tracking-widest ${preset === p ? "bg-black text-white" : "bg-white hover:bg-[color:var(--cream)]"}`}>{label}</button>
          ))}
        </div>
        <div className="flex items-center gap-1 text-sm">
          <input type="date" value={from} onChange={(e) => { setPreset("custom"); setFrom(e.target.value); }} className="border-2 border-black px-2 py-1 bg-white" />
          <span className="text-black/40">→</span>
          <input type="date" value={to} onChange={(e) => { setPreset("custom"); setTo(e.target.value); }} className="border-2 border-black px-2 py-1 bg-white" />
        </div>
      </div>

      {cargando || !data ? (
        <div className="animate-pulse text-black/40 font-mono text-sm py-8 text-center">Calculando…</div>
      ) : (
        <div className="space-y-4">
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Kpi grande valor={eur(data.ingresos)} label="Ingresos" nota={`${data.citas.completadas} completadas`} />
            <Kpi valor={data.citas.total} label="Citas" nota={`${data.citas.confirmadas} próximas`} />
            <Kpi valor={`${data.citas.noShow}`} label="No-shows" nota={`${data.tasaNoShow}% del total`} alerta={data.citas.noShow > 0} />
            <Kpi valor={data.clientes.nuevos} label="Clientes nuevos" nota={`${data.clientes.recurrentes} recurrentes`} />
          </div>

          {/* Ocupación */}
          <div className="card-hard bg-white p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold uppercase tracking-widest text-black/50">Ocupación estimada</span>
              <span className="font-stencil text-xl">{data.ocupacion.pct}%</span>
            </div>
            <div className="h-3 bg-black/10 border border-black/10"><div className="h-full bg-[color:var(--olive,#5A6B3F)]" style={{ width: `${Math.min(100, data.ocupacion.pct)}%` }} /></div>
            <div className="text-[11px] text-black/40 mt-1">{Math.round(data.ocupacion.reservadoMin / 60)} h reservadas de ~{Math.round(data.ocupacion.capacidadMin / 60)} h de capacidad · aprox.</div>
          </div>

          {/* Nuevos vs recurrentes */}
          {(data.clientes.nuevos + data.clientes.recurrentes) > 0 && (
            <div className="card-hard bg-white p-4">
              <div className="text-xs font-bold uppercase tracking-widest text-black/50 mb-2">Clientes nuevos vs. recurrentes</div>
              <div className="flex h-6 border-2 border-black overflow-hidden">
                <div className="bg-[color:var(--mustard)] flex items-center justify-center text-[11px] font-bold" style={{ width: `${pct(data.clientes.nuevos, data.clientes.nuevos + data.clientes.recurrentes)}%` }}>{data.clientes.nuevos > 0 ? data.clientes.nuevos : ""}</div>
                <div className="bg-black text-white flex items-center justify-center text-[11px] font-bold" style={{ width: `${pct(data.clientes.recurrentes, data.clientes.nuevos + data.clientes.recurrentes)}%` }}>{data.clientes.recurrentes > 0 ? data.clientes.recurrentes : ""}</div>
              </div>
              <div className="flex gap-4 mt-1.5 text-[11px]"><span><span className="inline-block w-2.5 h-2.5 bg-[color:var(--mustard)] border border-black mr-1" />Nuevos</span><span><span className="inline-block w-2.5 h-2.5 bg-black mr-1" />Recurrentes</span></div>
            </div>
          )}

          <Desglose titulo="Por profesional" filas={data.porEmpleado} />
          <Desglose titulo="Por servicio" filas={data.porServicio} />

          <p className="text-[11px] text-black/40">Periodo {fechaCorta(data.from)} – {fechaCorta(data.to)}. Ingresos = citas completadas (el cobro es en el salón, no online).</p>
        </div>
      )}
    </div>
  );
}

const pct = (n: number, total: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

function Kpi({ valor, label, nota, grande, alerta }: { valor: string | number; label: string; nota?: string; grande?: boolean; alerta?: boolean }) {
  return (
    <div className={`card-hard p-3 ${alerta ? "bg-[color:var(--red)]/10" : "bg-white"}`}>
      <div className={`font-stencil leading-none ${grande ? "text-2xl sm:text-3xl" : "text-2xl"} ${alerta ? "text-[color:var(--red)]" : ""}`}>{valor}</div>
      <div className="text-[10px] uppercase tracking-wide text-black/50 mt-1">{label}</div>
      {nota && <div className="text-[11px] text-black/40">{nota}</div>}
    </div>
  );
}

function Desglose({ titulo, filas }: { titulo: string; filas: Fila[] }) {
  if (filas.length === 0) return null;
  const max = Math.max(1, ...filas.map((f) => f.ingresos));
  return (
    <div className="card-hard bg-white p-4">
      <div className="text-xs font-bold uppercase tracking-widest text-black/50 mb-2">{titulo}</div>
      <div className="space-y-2">
        {filas.map((f) => (
          <div key={f.id}>
            <div className="flex items-center justify-between text-sm mb-0.5">
              <span className="font-bold truncate">{f.nombre} <span className="font-normal text-black/40">· {f.citas} cita{f.citas === 1 ? "" : "s"}</span></span>
              <span className="font-bold shrink-0">{eur(f.ingresos)}</span>
            </div>
            <div className="h-2 bg-black/10"><div className="h-full bg-[color:var(--mustard)]" style={{ width: `${Math.round((f.ingresos / max) * 100)}%` }} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}
