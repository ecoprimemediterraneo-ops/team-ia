"use client";
import { useEffect, useState } from "react";

type Pending = {
  id: string;
  ig_username: string | null;
  ig_user_id: string;
  incoming_text: string;
  proposed_response: string;
  intent: string | null;
  confidence: number | null;
  created_at: string;
};

type Data = {
  pending: Pending[];
  counts: { pending: number; approved: number; rejected: number };
  modo: "ruedines" | "auto";
  aprobaciones: number;
  rechazos: number;
  porcentaje_aprobacion: number;
  sugerencia_auto: boolean;
};

export default function MartaPendingQueue() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [available, setAvailable] = useState(true);

  async function load() {
    try {
      const res = await fetch("/api/marta/pending");
      if (!res.ok) {
        setAvailable(false);
        return;
      }
      const json = await res.json();
      setData(json);
    } catch {
      setAvailable(false);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 20_000);
    return () => clearInterval(t);
  }, []);

  async function approve(id: string) {
    setBusyId(id);
    try {
      const customText = editing[id]?.trim();
      const res = await fetch("/api/marta/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, customText: customText || undefined }),
      });
      const json = await res.json();
      if (!res.ok) alert(json.error || "Error");
      else if (!json.sent) {
        // Aprobada pero no enviada (sin token Meta) — está OK durante App Review
        console.log("[marta] aprobada pero sin envío:", json.sentReason);
      }
    } finally {
      setBusyId(null);
      setEditing((e) => {
        const copy = { ...e };
        delete copy[id];
        return copy;
      });
      load();
    }
  }

  async function reject(id: string) {
    if (!confirm("¿Rechazar esta respuesta? No se enviará nada a Instagram.")) return;
    setBusyId(id);
    try {
      const res = await fetch("/api/marta/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) alert("Error al rechazar");
    } finally {
      setBusyId(null);
      load();
    }
  }

  async function switchToAuto() {
    if (!confirm("¿Pasar Marta a modo AUTO? A partir de ahora responderá sola sin tu aprobación.")) return;
    await fetch("/api/marta/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modo_activacion: "auto" }),
    });
    load();
  }

  if (!available) return null;
  if (loading) {
    return <div className="mt-8 text-sm text-black/50">Cargando cola de aprobación…</div>;
  }
  if (!data) return null;

  return (
    <div className="mt-8 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-stencil text-3xl">
            🛡️ Cola de aprobación
            <span className="ml-3 text-base font-mono text-black/50">
              · {data.counts.pending} pendiente{data.counts.pending !== 1 ? "s" : ""}
            </span>
          </h2>
          <p className="text-xs font-mono text-black/60 mt-1">
            Modo actual:{" "}
            <span
              className="px-2 py-0.5 ml-1 font-bold uppercase tracking-widest border-2 border-black"
              style={{ background: data.modo === "ruedines" ? "var(--mustard)" : "#14B8A6", color: data.modo === "ruedines" ? "#000" : "#fff" }}
            >
              {data.modo === "ruedines" ? "🛡 Ruedines" : "⚡ Auto"}
            </span>
            {data.aprobaciones + data.rechazos > 0 && (
              <span className="ml-3">
                Histórico: {data.aprobaciones} aprob. / {data.rechazos} edit. ({data.porcentaje_aprobacion}% tasa de acierto)
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Sugerencia upgrade */}
      {data.sugerencia_auto && (
        <div className="card-hard p-4 bg-[color:var(--mustard)]/30 border-[#14B8A6]">
          <div className="font-stencil text-lg mb-1">🎉 Marta está lista para Auto</div>
          <p className="text-sm mb-3">
            Has aprobado el <b>{data.porcentaje_aprobacion}%</b> de las {data.aprobaciones + data.rechazos} respuestas. Si la pasas a modo Auto,
            responderá sola sin que tengas que validar cada DM. Puedes volver a Ruedines cuando quieras.
          </p>
          <button onClick={switchToAuto} className="btn-mustard text-sm">
            Pasar Marta a modo Auto →
          </button>
        </div>
      )}

      {/* Cola */}
      {data.pending.length === 0 ? (
        <div className="card-hard p-6 bg-white text-center">
          <p className="text-sm text-black/60">
            {data.modo === "ruedines"
              ? "No hay respuestas pendientes. Cuando llegue un DM nuevo aparecerá aquí."
              : "Marta está respondiendo en automático. Para volver a aprobar cada respuesta, cambia el modo a Ruedines arriba en el editor."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.pending.map((p) => (
            <div key={p.id} className="card-hard p-4 bg-white border-[color:var(--mustard)]">
              <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm">
                    @{p.ig_username || p.ig_user_id.slice(0, 10)}
                  </span>
                  {p.intent && (
                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest border-2 border-black bg-[#FF7A59] text-white">
                      {p.intent}
                    </span>
                  )}
                  {p.confidence !== null && (
                    <span className="text-[10px] font-mono text-black/50">
                      confianza {p.confidence.toFixed(2)}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-mono text-black/40">
                  {new Date(p.created_at).toLocaleString("es-ES")}
                </span>
              </div>

              {/* Mensaje del cliente */}
              <div className="mb-3">
                <div className="text-[10px] font-mono text-black/40 uppercase tracking-widest mb-1">Cliente escribió</div>
                <div className="border-l-4 border-black pl-3 text-sm text-black/80">
                  {p.incoming_text}
                </div>
              </div>

              {/* Respuesta propuesta editable */}
              <div className="mb-3">
                <div className="text-[10px] font-mono text-black/40 uppercase tracking-widest mb-1">
                  Marta propone (puedes editar antes de aprobar)
                </div>
                <textarea
                  value={editing[p.id] ?? p.proposed_response}
                  onChange={(e) => setEditing({ ...editing, [p.id]: e.target.value })}
                  rows={3}
                  className="w-full border-2 border-black p-2 text-sm font-mono shadow-[2px_2px_0_#000]"
                />
                <div className="text-[10px] font-mono text-black/40 mt-1">
                  {(editing[p.id] ?? p.proposed_response).length} / 280 caracteres
                </div>
              </div>

              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => approve(p.id)}
                  disabled={busyId === p.id}
                  className="btn-mustard text-xs disabled:opacity-50"
                >
                  {busyId === p.id
                    ? "Procesando…"
                    : editing[p.id] && editing[p.id] !== p.proposed_response
                      ? "✓ Aprobar (editado)"
                      : "✓ Aprobar y enviar"}
                </button>
                <button
                  onClick={() => reject(p.id)}
                  disabled={busyId === p.id}
                  className="border-[3px] border-[color:var(--red)] text-[color:var(--red)] px-3 py-2 text-xs font-bold uppercase tracking-widest hover:bg-[color:var(--red)] hover:text-white disabled:opacity-50"
                >
                  ✗ Rechazar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
