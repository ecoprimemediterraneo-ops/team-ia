// Panel del Orquestador central de reservas (solo fundador).
// Muestra el log de decisiones (booked / rejected_conflict / locked / error)
// y un banco de pruebas para demostrar la prevención de doble-booking.

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listDecisions, supabaseEnabled, type DecisionRow } from "@/lib/orchestrator";
import OrquestadorTester from "./OrquestadorTester";

const FOUNDER_EMAIL = process.env.FOUNDER_EMAIL || "ecoprimemediterraneo@gmail.com";

export const dynamic = "force-dynamic";

function DecisionChip({ d }: { d: DecisionRow["decision"] }) {
  const map: Record<string, { label: string; bg: string }> = {
    booked: { label: "RESERVADA", bg: "#22c55e" },
    rejected_conflict: { label: "CONFLICTO", bg: "#f59e0b" },
    locked: { label: "BLOQUEADA", bg: "#ef4444" },
    error: { label: "ERROR", bg: "#000" },
  };
  const c = map[d] ?? { label: d, bg: "#999" };
  return (
    <span className="text-[10px] font-bold uppercase tracking-widest border-2 border-black px-1.5 py-0.5 text-white" style={{ background: c.bg }}>
      {c.label}
    </span>
  );
}

export default async function OrquestadorPage() {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.email !== FOUNDER_EMAIL && s.email !== "crisasky@gmail.com") redirect("/admin");

  const decisions = await listDecisions();
  const hasSupabase = supabaseEnabled();

  const booked = decisions.filter((d) => d.decision === "booked").length;
  const conflicts = decisions.filter((d) => d.decision === "rejected_conflict").length;
  const locks = decisions.filter((d) => d.decision === "locked").length;

  return (
    <main className="min-h-screen bg-[color:var(--cream)] py-10 px-5">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3 text-xs">
          <a href="/admin" className="font-mono uppercase tracking-widest text-black/60 hover:text-black underline">← Admin</a>
          <span className="text-black/30">·</span>
          <span className="font-mono uppercase tracking-widest text-black/40">Orquestador · agenda compartida</span>
        </div>

        <header>
          <div className="text-[10px] font-mono tracking-[0.25em] text-black/60 mb-2">CEREBRO CENTRAL · NO ES UN AGENTE</div>
          <h1 className="font-stencil text-3xl md:text-5xl leading-tight">Orquestador de reservas</h1>
          <p className="text-sm text-black/60 mt-3 max-w-2xl">
            Punto único por el que pasan Pablo, Carmen, Eva y Lucía para reservar. Verifica
            disponibilidad, evita que dos agentes choquen en el mismo hueco (lock + cola) y
            registra cada decisión. El cliente nunca lo ve.
          </p>
        </header>

        {/* Estado del lock distribuido */}
        <div className={`card-hard p-3 text-sm ${hasSupabase ? "bg-white" : "bg-[color:var(--mustard)]/30"}`}>
          <strong>Lock distribuido:</strong>{" "}
          {hasSupabase
            ? "Supabase detectado → lock cross-instancia activo (INSERT atómico + TTL)."
            : "Sin Supabase (entorno local) → solo mutex en memoria. En prod con Supabase se activa el lock cross-instancia."}
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3">
          <div className="card-hard p-3 bg-white"><div className="text-[10px] uppercase tracking-widest text-black/60">Reservadas</div><div className="font-stencil text-3xl">{booked}</div></div>
          <div className="card-hard p-3 bg-white"><div className="text-[10px] uppercase tracking-widest text-black/60">Conflictos evitados</div><div className="font-stencil text-3xl">{conflicts}</div></div>
          <div className="card-hard p-3 bg-white"><div className="text-[10px] uppercase tracking-widest text-black/60">Bloqueos (lock)</div><div className="font-stencil text-3xl">{locks}</div></div>
        </div>

        <OrquestadorTester />

        {/* Log de decisiones */}
        <section className="card-hard bg-white p-4">
          <h2 className="font-stencil text-2xl mb-3">Log de decisiones</h2>
          {decisions.length === 0 ? (
            <p className="text-sm text-black/55">Sin decisiones aún. Usa el banco de pruebas o deja que un agente reserve.</p>
          ) : (
            <ul className="space-y-2">
              {decisions.map((d) => (
                <li key={d.id} className="border-2 border-black/15 p-2.5 text-sm flex flex-wrap items-center gap-2">
                  <DecisionChip d={d.decision} />
                  <span className="font-mono text-[11px] text-black/50">{new Date(d.ts).toLocaleString("es-ES")}</span>
                  <span className="font-bold">{d.agenteOrigen}</span>
                  <span className="text-black/70">{d.nombre} · {d.motivo}</span>
                  <span className="font-mono text-[11px] text-black/50">{d.startIso}</span>
                  {d.suggested && <span className="text-[11px] text-amber-700">→ sugerido {d.suggested}</span>}
                  {d.simulated && <span className="text-[10px] bg-black/10 px-1">SIM</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
