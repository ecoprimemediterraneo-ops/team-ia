"use client";
import { useMemo, useState } from "react";

type Inputs = {
  citasMes: number;          // citas totales al mes
  ticketMedio: number;       // ticket medio €
  whatsappPerdidos: number;  // % mensajes WhatsApp no respondidos a tiempo
  noShows: number;           // % de no-shows actuales
  resenasMes: number;        // reseñas nuevas/mes
  publicacionesMes: number;  // posts IG/mes actuales
  emailMkt: boolean;         // ¿hace email marketing?
};

const DEFAULT: Inputs = {
  citasMes: 120,
  ticketMedio: 120,
  whatsappPerdidos: 25,
  noShows: 22,
  resenasMes: 3,
  publicacionesMes: 2,
  emailMkt: false,
};

function computeROI(i: Inputs) {
  // Pérdidas mensuales
  const facturacionMensual = i.citasMes * i.ticketMedio;

  // 1. WhatsApp perdidos: % de mensajes perdidos × 0.4 (los que sí habrían convertido si respondemos) × ticket
  const leadsPerdidosMes = Math.round((i.citasMes * i.whatsappPerdidos / 100) * 0.4);
  const perdidaWhatsApp = leadsPerdidosMes * i.ticketMedio;

  // 2. No-shows reducibles: con recordatorios pasamos de noShows actual → 8% (mejor caso)
  const noShowsActual = Math.round(i.citasMes * i.noShows / 100);
  const noShowsConBot = Math.round(i.citasMes * 0.08);
  const noShowsRecuperados = Math.max(0, noShowsActual - noShowsConBot);
  const perdidaNoShows = noShowsRecuperados * i.ticketMedio;

  // 3. Reseñas: cada reseña adicional vale ~120€ en ranking local (estimado)
  const resenasObjetivo = 18; // pilotos AI-Team
  const resenasGanadas = Math.max(0, resenasObjetivo - i.resenasMes);
  const valorPorResena = 120;
  const perdidaResenas = resenasGanadas * valorPorResena;

  // 4. Redes sociales: si publica <4/mes, asumimos pérdida de 4-8 citas/mes por baja visibilidad
  const perdidaRedes = i.publicacionesMes < 4 ? 6 * i.ticketMedio : 0;

  // 5. Email mkt: sin email, pierde 20-30% de retención
  const perdidaEmail = i.emailMkt ? 0 : Math.round(i.citasMes * 0.05) * i.ticketMedio;

  const perdidaTotalMensual = perdidaWhatsApp + perdidaNoShows + perdidaResenas + perdidaRedes + perdidaEmail;
  const perdidaAnual = perdidaTotalMensual * 12;

  // Pack recomendado
  let pack: { nombre: string; precio: number; agentes: string[] };
  if (perdidaTotalMensual < 800) {
    pack = { nombre: "Local", precio: 79, agentes: ["Pablo (WhatsApp)", "Rocío (Google)", "Carmen (Contestador)", "Diana (Auditora)", "Tomás (Soporte)"] };
  } else if (perdidaTotalMensual < 2000) {
    pack = { nombre: "Digital", precio: 149, agentes: ["Pack Local +", "Lucía (Gmail)", "Marta (Redes)", "Eva (Email Mkt)"] };
  } else if (perdidaTotalMensual < 4000) {
    pack = { nombre: "Élite", precio: 249, agentes: ["Pack Digital +", "Sergio (Mercado)", "Carmen Pro (Agenda)"] };
  } else {
    pack = { nombre: "Pro", precio: 449, agentes: ["Pack Élite +", "Onboarding 1:1", "Multi-usuario", "Integraciones a medida"] };
  }

  const ahorroNetoMes = perdidaTotalMensual - pack.precio;
  const ahorroNetoAnual = ahorroNetoMes * 12;
  const roi = pack.precio > 0 ? (perdidaTotalMensual / pack.precio).toFixed(1) : "—";

  return {
    facturacionMensual,
    perdidas: {
      whatsapp: perdidaWhatsApp,
      noShows: perdidaNoShows,
      resenas: perdidaResenas,
      redes: perdidaRedes,
      email: perdidaEmail,
    },
    perdidaTotalMensual,
    perdidaAnual,
    leadsPerdidosMes,
    noShowsRecuperados,
    pack,
    ahorroNetoMes,
    ahorroNetoAnual,
    roi,
  };
}

export default function CalculadoraROI() {
  const [i, setI] = useState<Inputs>(DEFAULT);
  const r = useMemo(() => computeROI(i), [i]);

  function set<K extends keyof Inputs>(k: K, v: Inputs[K]) {
    setI((s) => ({ ...s, [k]: v }));
  }

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Inputs */}
      <div className="card-hard p-5 bg-white">
        <h2 className="font-stencil text-2xl mb-4">Tu negocio</h2>
        <div className="space-y-4">
          <Num label="Citas al mes" value={i.citasMes} onChange={(v) => set("citasMes", v)} min={10} max={1000} step={10} />
          <Num label="Ticket medio por cita (€)" value={i.ticketMedio} onChange={(v) => set("ticketMedio", v)} min={20} max={2000} step={10} prefix="€" />
          <Num label="% mensajes WhatsApp sin contestar a tiempo" value={i.whatsappPerdidos} onChange={(v) => set("whatsappPerdidos", v)} min={0} max={100} step={5} sufix="%" />
          <Num label="% de no-shows (pacientes que no aparecen)" value={i.noShows} onChange={(v) => set("noShows", v)} min={0} max={50} step={1} sufix="%" />
          <Num label="Reseñas Google nuevas al mes" value={i.resenasMes} onChange={(v) => set("resenasMes", v)} min={0} max={50} step={1} />
          <Num label="Posts Instagram al mes" value={i.publicacionesMes} onChange={(v) => set("publicacionesMes", v)} min={0} max={30} step={1} />
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={i.emailMkt} onChange={(e) => set("emailMkt", e.target.checked)} className="w-5 h-5" />
            <span className="text-sm font-bold">¿Hacéis email marketing actualmente?</span>
          </label>
        </div>
      </div>

      {/* Resultados */}
      <div className="space-y-4 sticky top-4 self-start">
        <div className="card-hard p-5 bg-[color:var(--red)] text-white">
          <div className="text-xs font-mono uppercase tracking-widest mb-1 opacity-90">PIERDES AL AÑO ESTIMADO</div>
          <div className="font-stencil text-5xl md:text-6xl">{r.perdidaAnual.toLocaleString("es-ES")} €</div>
          <div className="text-xs mt-2 opacity-90">≈ {r.perdidaTotalMensual.toLocaleString("es-ES")} €/mes</div>
        </div>

        <div className="card-hard p-5 bg-white">
          <h3 className="font-stencil text-xl mb-3">Desglose mensual</h3>
          <ul className="space-y-2 text-sm">
            <Item label="WhatsApp sin respuesta" value={r.perdidas.whatsapp} agent="Pablo" />
            <Item label="No-shows reducibles" value={r.perdidas.noShows} agent="Pablo + Carmen" />
            <Item label="Reseñas no generadas" value={r.perdidas.resenas} agent="Rocío" />
            <Item label="Baja visibilidad redes" value={r.perdidas.redes} agent="Marta" />
            <Item label="Sin email marketing" value={r.perdidas.email} agent="Eva" />
          </ul>
        </div>

        <div className="card-hard p-5 bg-[color:var(--mustard)] relative overflow-hidden">
          <div className="absolute right-0 top-3 stamp scale-75 opacity-90 pointer-events-none select-none border-red text-red">RECOMENDADO</div>
          <div className="text-xs font-mono uppercase tracking-widest mb-1">PACK RECOMENDADO</div>
          <div className="font-stencil text-3xl mb-1">{r.pack.nombre}</div>
          <div className="text-2xl font-bold">{r.pack.precio}€/mes</div>
          <ul className="text-xs mt-3 space-y-1">
            {r.pack.agentes.map((a) => <li key={a}>▸ {a}</li>)}
          </ul>
          <div className="mt-4 pt-4 border-t-2 border-black space-y-2 text-sm">
            <div className="flex justify-between"><span>Ahorro neto/mes:</span><strong>{r.ahorroNetoMes.toLocaleString("es-ES")} €</strong></div>
            <div className="flex justify-between"><span>Ahorro neto/año:</span><strong>{r.ahorroNetoAnual.toLocaleString("es-ES")} €</strong></div>
            <div className="flex justify-between"><span>ROI:</span><strong>{r.roi}×</strong></div>
          </div>
          <a href="/diagnostico" className="btn-mustard bg-black text-[color:var(--mustard)] hover:bg-[color:var(--red)] hover:text-white w-full text-center block mt-4">
            DIAGNÓSTICO COMPLETO →
          </a>
        </div>

        <p className="text-[10px] font-mono text-black/50 uppercase tracking-widest text-center">
          * Cifras estimadas basadas en pilotos AI-Team. Tu caso real puede variar.
        </p>
      </div>
    </div>
  );
}

function Num({ label, value, onChange, min, max, step, prefix, sufix }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; step: number; prefix?: string; sufix?: string }) {
  return (
    <div>
      <label className="block text-xs font-bold uppercase tracking-widest mb-1">{label}</label>
      <div className="flex items-center gap-2">
        {prefix && <span className="font-mono text-sm font-bold text-black/50">{prefix}</span>}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 accent-[color:var(--red)] cursor-pointer h-2 bg-black/10 rounded-none appearance-none"
        />
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-20 border-2 border-black px-2 py-1 text-right font-mono font-bold bg-[color:var(--cream)] focus:outline-none focus:ring-2 focus:ring-black"
          min={min}
          max={max}
        />
        {sufix && <span className="font-mono text-sm font-bold text-black/50">{sufix}</span>}
      </div>
    </div>
  );
}

function Item({ label, value, agent }: { label: string; value: number; agent: string }) {
  return (
    <li className="flex justify-between items-baseline border-b border-black/10 pb-1">
      <div>
        <div className="font-semibold">{label}</div>
        <div className="text-[10px] font-mono uppercase tracking-widest text-black/50">{agent}</div>
      </div>
      <span className={`font-stencil text-lg ${value > 0 ? "text-[color:var(--red)]" : "text-black/30"}`}>
        {value.toLocaleString("es-ES")} €
      </span>
    </li>
  );
}
