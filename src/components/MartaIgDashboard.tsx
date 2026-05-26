"use client";
import { useEffect, useState } from "react";

type Conversation = {
  id: string;
  ig_username: string | null;
  ig_user_id: string;
  status: "active" | "escalated" | "closed";
  intent_last: string | null;
  updated_at: string;
  message_count: number;
  last_message: {
    direction: "in" | "out";
    content: string;
    intent: string | null;
    confidence: number | null;
    created_at: string;
  } | null;
};

type Lead = {
  id: string;
  ig_username: string | null;
  lead_type: "cita" | "presupuesto" | "info";
  notes: string;
  created_at: string;
  notified_at: string | null;
};

type Metrics = {
  dms_7d: number;
  leads_7d: number;
  escalados_7d: number;
  total_conversaciones: number;
  ultimo_dm: { content: string; created_at: string; intent: string | null } | null;
  note?: string;
};

const INTENT_COLORS: Record<string, string> = {
  pedir_cita: "#14B8A6",
  consulta_precio: "#F5C518",
  info_servicio: "#60A5FA",
  queja: "#EF4444",
  spam: "#9CA3AF",
  saludo: "#A88BE8",
  otro: "#6B7280",
};

const INTENT_LABELS: Record<string, string> = {
  pedir_cita: "Pide cita",
  consulta_precio: "Consulta precio",
  info_servicio: "Info servicio",
  queja: "Queja",
  spam: "Spam",
  saludo: "Saludo",
  otro: "Otro",
};

export default function MartaIgDashboard() {
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [supabaseConfigured, setSupabaseConfigured] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [c, l, m] = await Promise.all([
        fetch("/api/marta/conversations").then((r) => r.json()),
        fetch("/api/marta/leads").then((r) => r.json()),
        fetch("/api/marta/metrics").then((r) => r.json()),
      ]);
      setConvs(c.conversations || []);
      setLeads(l.leads || []);
      setMetrics(m);
      if (m.note === "supabase_not_configured") setSupabaseConfigured(false);
    } catch (e) {
      console.error("[marta dashboard]", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 30_000); // refresh cada 30s
    return () => clearInterval(interval);
  }, []);

  if (!supabaseConfigured) {
    return (
      <div className="mt-8 card-hard p-6 bg-[color:var(--mustard)]/30">
        <h3 className="font-stencil text-xl mb-2">⚙️ Marta IG · Pendiente configuración</h3>
        <p className="text-sm text-black/70">
          Para que Marta empiece a procesar DMs de Instagram falta correr la
          migración SQL en Supabase y configurar las variables de entorno de Meta.
          Ver <code className="bg-white px-1">docs/marta-instagram-setup.md</code> en el repo.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-6">
      {/* Header + Refresh */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-stencil text-3xl">📨 DMs de Instagram</h2>
          <p className="text-xs font-mono text-black/60 mt-1">
            Marta procesa cada DM en tiempo real · Refresco automático cada 30s
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="border-2 border-black px-3 py-1 text-xs font-bold uppercase tracking-widest hover:bg-black hover:text-[color:var(--mustard)] disabled:opacity-50"
        >
          {loading ? "Actualizando…" : "Actualizar"}
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="DMs últimos 7d"
          value={metrics?.dms_7d ?? 0}
          color="#FF7A59"
        />
        <StatCard
          label="Leads detectados (7d)"
          value={metrics?.leads_7d ?? 0}
          color="#14B8A6"
          highlight
        />
        <StatCard
          label="Escalados a ti"
          value={metrics?.escalados_7d ?? 0}
          color="#EF4444"
        />
        <StatCard
          label="Conversaciones total"
          value={metrics?.total_conversaciones ?? 0}
          color="#3B82F6"
        />
      </div>

      {/* Leads recientes */}
      {leads.length > 0 && (
        <div className="card-hard p-5 bg-white border-[#14B8A6]">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h3 className="font-stencil text-2xl">🎯 Leads cualificados</h3>
            <span className="text-xs font-mono text-black/50">
              {leads.length} total · {leads.filter((l) => !l.notified_at).length} sin contactar
            </span>
          </div>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {leads.slice(0, 10).map((l) => (
              <div key={l.id} className="border-2 border-black p-3 bg-white">
                <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest border-2 border-black"
                      style={{
                        backgroundColor: l.lead_type === "cita" ? "#14B8A6" : l.lead_type === "presupuesto" ? "#F5C518" : "#60A5FA",
                        color: l.lead_type === "presupuesto" ? "#000" : "#fff",
                      }}
                    >
                      {l.lead_type}
                    </span>
                    <span className="font-bold text-sm">
                      @{l.ig_username || l.id.slice(0, 8)}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-black/40">
                    {new Date(l.created_at).toLocaleString("es-ES")}
                  </span>
                </div>
                <p className="text-sm text-black/80 mt-1">{l.notes}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Conversaciones */}
      <div className="card-hard p-5 bg-white">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="font-stencil text-2xl">💬 Conversaciones recientes</h3>
          <span className="text-xs font-mono text-black/50">{convs.length} activas</span>
        </div>

        {convs.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-black/50 mb-2">
              Aún no hay DMs procesados.
            </p>
            <p className="text-xs font-mono text-black/40">
              Cuando alguien escriba a tu Instagram, Marta lo procesará aquí.
              Pendiente activación Meta App Review.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {convs.map((c) => (
              <div
                key={c.id}
                className={`border-2 border-black p-3 ${
                  c.status === "escalated" ? "bg-[color:var(--red)]/10" : "bg-white"
                }`}
              >
                <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm">
                      @{c.ig_username || c.ig_user_id.slice(0, 12)}
                    </span>
                    {c.intent_last && (
                      <span
                        className="px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest border-2 border-black"
                        style={{
                          backgroundColor: INTENT_COLORS[c.intent_last] || "#000",
                          color: "#fff",
                        }}
                      >
                        {INTENT_LABELS[c.intent_last] || c.intent_last}
                      </span>
                    )}
                    {c.status === "escalated" && (
                      <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest border-2 border-[color:var(--red)] bg-[color:var(--red)] text-white">
                        ⚠ Escalado · contesta tú
                      </span>
                    )}
                    <span className="text-[10px] font-mono text-black/40">
                      {c.message_count} msg
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-black/40">
                    {new Date(c.updated_at).toLocaleString("es-ES")}
                  </span>
                </div>
                {c.last_message && (
                  <div className="text-sm">
                    <span className="text-[10px] font-mono text-black/40 mr-2">
                      [{c.last_message.direction === "in" ? "Cliente" : "Marta"}]
                    </span>
                    <span className={c.last_message.direction === "in" ? "" : "italic text-black/70"}>
                      {c.last_message.content.slice(0, 200)}
                      {c.last_message.content.length > 200 && "…"}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Estado activación */}
      <div className="card-hard p-4 bg-[color:var(--cream)] text-xs">
        <div className="font-bold mb-1">🔒 Estado de activación</div>
        <p className="text-black/70">
          El motor de Marta IG está <strong>100% programado y desplegado</strong>. La activación real
          (envío automático de respuestas a Instagram) requiere aprobación de Meta App Review para los
          permisos <code className="bg-white px-1">instagram_manage_messages</code>. Mientras tanto,
          Marta guarda todos los DMs en BD y te notifica los leads + quejas por email — pero no envía
          respuestas a Instagram automáticamente.
        </p>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
  highlight,
}: {
  label: string;
  value: number;
  color: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`card-hard p-4 ${highlight ? "bg-[color:var(--mustard)]/30" : "bg-white"}`}
      style={{ borderColor: color }}
    >
      <div className="text-[10px] font-mono uppercase tracking-widest text-black/60">
        {label}
      </div>
      <div className="font-stencil text-4xl mt-1" style={{ color }}>
        {value}
      </div>
    </div>
  );
}
