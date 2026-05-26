"use client";
import { useEffect, useState } from "react";

type Metrics = {
  total_reviews: number;
  avg_rating: number;
  pending_count: number;
  responded_count: number;
  five_star_count: number;
  one_two_star_count: number;
  requests_30d: number;
};

type Review = {
  id: string;
  reviewer_name: string | null;
  rating: number;
  text: string | null;
  status: string;
  imported_at: string;
};

type Pending = {
  id: string;
  review_id: string;
  proposed_response: string;
  intent: string | null;
  created_at: string;
  review: Review | null;
};

type Data = {
  pending: Pending[];
  metrics: Metrics;
  modo: "ruedines" | "auto";
  aprobaciones: number;
  rechazos: number;
  porcentaje_aprobacion: number;
  sugerencia_auto: boolean;
};

type Location = {
  id: string;
  name: string;
  google_review_link: string | null;
  city: string | null;
};

type Profile = {
  nombre_negocio: string;
  tono_marca: string;
  firma_respuesta: string;
  reglas_custom: string;
  modo_activacion: "ruedines" | "auto";
};

export default function RocioDashboard() {
  const [data, setData] = useState<Data | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(true);

  // Editor profile
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSavedAt, setProfileSavedAt] = useState<string | null>(null);

  // Pending
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  // Locations
  const [newLoc, setNewLoc] = useState({ name: "", google_review_link: "", city: "" });
  const [showAddLoc, setShowAddLoc] = useState(false);

  // Manual review entry
  const [manualReview, setManualReview] = useState({ reviewer_name: "", rating: 5, text: "", location_id: "" });
  const [showManual, setShowManual] = useState(false);

  // Request link
  const [reqForm, setReqForm] = useState({ location_id: "", channel: "whatsapp" as "whatsapp" | "sms" | "email", customer_name: "", customer_phone: "" });
  const [showReq, setShowReq] = useState(false);
  const [reqResult, setReqResult] = useState<{ message: string; actionUrl: string | null } | null>(null);

  async function load() {
    try {
      const [p, l, pr] = await Promise.all([
        fetch("/api/rocio/pending").then((r) => r.json()),
        fetch("/api/rocio/locations").then((r) => r.json()),
        fetch("/api/rocio/profile").then((r) => r.json()),
      ]);
      if (p.error === "Unauthorized" || !p) {
        setAvailable(false);
        return;
      }
      setData(p);
      setLocations(l.locations || []);
      setProfile(pr.profile);
    } catch {
      setAvailable(false);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const i = setInterval(load, 30_000);
    return () => clearInterval(i);
  }, []);

  async function saveProfile() {
    if (!profile) return;
    setProfileSaving(true);
    try {
      const res = await fetch("/api/rocio/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      if (res.ok) setProfileSavedAt(new Date().toLocaleTimeString("es-ES"));
    } finally {
      setProfileSaving(false);
    }
  }

  async function approve(id: string) {
    setBusyId(id);
    try {
      const customText = editing[id]?.trim();
      const res = await fetch("/api/rocio/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, customText: customText || undefined }),
      });
      const json = await res.json();
      if (res.ok && json.pasteText) {
        // Copiar al portapapeles para pegar en Google
        await navigator.clipboard.writeText(json.pasteText).catch(() => {});
        alert(`✓ Respuesta aprobada y copiada al portapapeles.\n\nVe a Google Maps y pégala en la reseña.\n\n(Cuando esté la integración Google Profile, esto se publicará solo).`);
      }
    } finally {
      setBusyId(null);
      setEditing((e) => {
        const c = { ...e };
        delete c[id];
        return c;
      });
      load();
    }
  }

  async function reject(id: string) {
    if (!confirm("¿Marcar esta reseña como ignorada (no responder)?")) return;
    setBusyId(id);
    try {
      await fetch("/api/rocio/reject", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    } finally {
      setBusyId(null);
      load();
    }
  }

  async function addLocation(e: React.FormEvent) {
    e.preventDefault();
    if (!newLoc.name.trim()) return;
    const res = await fetch("/api/rocio/locations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newLoc),
    });
    if (res.ok) {
      setNewLoc({ name: "", google_review_link: "", city: "" });
      setShowAddLoc(false);
      load();
    } else {
      const j = await res.json();
      alert(j.error || "Error");
    }
  }

  async function deleteLocation(id: string) {
    if (!confirm("¿Borrar este local?")) return;
    await fetch("/api/rocio/locations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
    load();
  }

  async function addManualReview(e: React.FormEvent) {
    e.preventDefault();
    if (!manualReview.text.trim()) return;
    const res = await fetch("/api/rocio/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...manualReview,
        location_id: manualReview.location_id || undefined,
        reviewer_name: manualReview.reviewer_name || undefined,
      }),
    });
    if (res.ok) {
      setManualReview({ reviewer_name: "", rating: 5, text: "", location_id: "" });
      setShowManual(false);
      load();
    } else {
      const j = await res.json();
      alert(j.error || "Error");
    }
  }

  async function generateRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!reqForm.location_id) {
      alert("Elige un local primero");
      return;
    }
    const res = await fetch("/api/rocio/request-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reqForm),
    });
    const j = await res.json();
    if (res.ok) setReqResult({ message: j.message, actionUrl: j.actionUrl });
    else alert(j.error || "Error");
  }

  if (!available) {
    return (
      <div className="mt-8 card-hard p-6 bg-[color:var(--mustard)]/30">
        <h3 className="font-stencil text-xl mb-2">⚙️ Rocío pendiente de configurar</h3>
        <p className="text-sm text-black/70">
          Falta correr la migración SQL en Supabase. Ver{" "}
          <code className="bg-white px-1">scripts/migrations/006_rocio.sql</code>.
        </p>
      </div>
    );
  }

  if (loading || !data || !profile) {
    return <div className="mt-8 text-sm text-black/50">Cargando Rocío…</div>;
  }

  return (
    <div className="mt-8 space-y-6">
      {/* Stats row */}
      <div>
        <h2 className="font-stencil text-3xl mb-1">⭐ Reseñas Google</h2>
        <p className="text-xs font-mono text-black/60 mb-3">
          Modo:{" "}
          <span className="px-2 py-0.5 ml-1 font-bold uppercase tracking-widest border-2 border-black" style={{ background: data.modo === "ruedines" ? "var(--mustard)" : "#14B8A6", color: data.modo === "ruedines" ? "#000" : "#fff" }}>
            {data.modo === "ruedines" ? "🛡 Ruedines" : "⚡ Auto"}
          </span>
          {data.aprobaciones + data.rechazos > 0 && (
            <span className="ml-3">Histórico: {data.aprobaciones}/{data.aprobaciones + data.rechazos} aprobadas ({data.porcentaje_aprobacion}%)</span>
          )}
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Rating actual" value={data.metrics.avg_rating.toFixed(2) + "★"} color="#FBBF24" highlight />
          <Stat label="Total reseñas" value={data.metrics.total_reviews} color="#3B82F6" />
          <Stat label="Sin responder" value={data.metrics.pending_count} color="#EF4444" />
          <Stat label="Solicitudes 30d" value={data.metrics.requests_30d} color="#14B8A6" />
        </div>
      </div>

      {/* Sugerencia upgrade */}
      {data.sugerencia_auto && (
        <div className="card-hard p-4 bg-[color:var(--mustard)]/30 border-[#14B8A6]">
          <div className="font-stencil text-lg mb-1">🎉 Rocío está lista para Auto</div>
          <p className="text-sm mb-3">
            Has aprobado el <b>{data.porcentaje_aprobacion}%</b> de las {data.aprobaciones + data.rechazos} respuestas. Cuando llegue la conexión con Google, podrá responder sola.
          </p>
          <button
            onClick={async () => {
              await fetch("/api/rocio/profile", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ modo_activacion: "auto" }),
              });
              load();
            }}
            className="btn-mustard text-sm"
          >
            Pasar a modo Auto
          </button>
        </div>
      )}

      {/* Locales */}
      <div className="card-hard p-5 bg-white">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="font-stencil text-2xl">📍 Mis locales</h3>
          <button onClick={() => setShowAddLoc((s) => !s)} className="btn-mustard text-xs">
            {showAddLoc ? "Cerrar" : "+ Añadir local"}
          </button>
        </div>

        {showAddLoc && (
          <form onSubmit={addLocation} className="card-hard p-4 bg-[color:var(--cream)] mb-3 space-y-3">
            <input value={newLoc.name} onChange={(e) => setNewLoc({ ...newLoc, name: e.target.value })} placeholder="Nombre del local *" required className="w-full border-[3px] border-black px-3 py-2 text-sm shadow-[3px_3px_0_#000]" />
            <input value={newLoc.google_review_link} onChange={(e) => setNewLoc({ ...newLoc, google_review_link: e.target.value })} placeholder="Link Google review (g.page/xxx)" className="w-full border-[3px] border-black px-3 py-2 text-sm shadow-[3px_3px_0_#000]" />
            <input value={newLoc.city} onChange={(e) => setNewLoc({ ...newLoc, city: e.target.value })} placeholder="Ciudad" className="w-full border-[3px] border-black px-3 py-2 text-sm shadow-[3px_3px_0_#000]" />
            <button type="submit" className="btn-mustard text-xs">Guardar local</button>
          </form>
        )}

        {locations.length === 0 ? (
          <p className="text-sm text-black/50">Aún no tienes locales. Añade el primero para empezar.</p>
        ) : (
          <div className="space-y-2">
            {locations.map((l) => (
              <div key={l.id} className="border-2 border-black p-3 flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <div className="font-bold text-sm">{l.name} {l.city && <span className="text-xs font-mono text-black/50">· {l.city}</span>}</div>
                  {l.google_review_link ? (
                    <a href={l.google_review_link} target="_blank" rel="noopener noreferrer" className="text-xs underline text-black/60">{l.google_review_link.slice(0, 60)}…</a>
                  ) : (
                    <span className="text-xs text-[color:var(--red)]">Sin link Google — añade uno para pedir reseñas</span>
                  )}
                </div>
                <button onClick={() => deleteLocation(l.id)} className="text-[10px] font-bold uppercase tracking-widest border-2 border-[color:var(--red)] text-[color:var(--red)] px-2 py-1 hover:bg-[color:var(--red)] hover:text-white">Borrar</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Solicitar reseña */}
      <div className="card-hard p-5 bg-white">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="font-stencil text-2xl">📤 Pedir reseña a un cliente</h3>
          <button onClick={() => { setShowReq((s) => !s); setReqResult(null); }} className="btn-mustard text-xs">
            {showReq ? "Cerrar" : "Generar mensaje"}
          </button>
        </div>

        {showReq && (
          <form onSubmit={generateRequest} className="space-y-3">
            <select value={reqForm.location_id} onChange={(e) => setReqForm({ ...reqForm, location_id: e.target.value })} required className="w-full border-[3px] border-black px-3 py-2 text-sm bg-white shadow-[3px_3px_0_#000]">
              <option value="">Elige local…</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            <div className="grid sm:grid-cols-2 gap-3">
              <select value={reqForm.channel} onChange={(e) => setReqForm({ ...reqForm, channel: e.target.value as "whatsapp" | "sms" | "email" })} className="border-[3px] border-black px-3 py-2 text-sm bg-white shadow-[3px_3px_0_#000]">
                <option value="whatsapp">WhatsApp</option>
                <option value="sms">SMS</option>
                <option value="email">Email</option>
              </select>
              <input value={reqForm.customer_name} onChange={(e) => setReqForm({ ...reqForm, customer_name: e.target.value })} placeholder="Nombre cliente (opcional)" className="border-[3px] border-black px-3 py-2 text-sm shadow-[3px_3px_0_#000]" />
            </div>
            {reqForm.channel === "whatsapp" && (
              <input value={reqForm.customer_phone} onChange={(e) => setReqForm({ ...reqForm, customer_phone: e.target.value })} placeholder="Teléfono +34..." className="w-full border-[3px] border-black px-3 py-2 text-sm shadow-[3px_3px_0_#000]" />
            )}
            <button type="submit" className="btn-mustard text-xs">Generar</button>

            {reqResult && (
              <div className="card-hard p-3 bg-[color:var(--cream)] mt-3">
                <div className="text-[10px] font-mono uppercase tracking-widest text-black/40 mb-1">Mensaje listo</div>
                <pre className="text-xs whitespace-pre-wrap font-mono mb-2">{reqResult.message}</pre>
                {reqResult.actionUrl ? (
                  <a href={reqResult.actionUrl} target="_blank" rel="noopener noreferrer" className="btn-mustard text-xs inline-block">Abrir WhatsApp →</a>
                ) : (
                  <button
                    onClick={() => navigator.clipboard.writeText(reqResult.message)}
                    className="border-2 border-black px-3 py-2 text-xs font-bold uppercase tracking-widest hover:bg-black hover:text-white"
                  >
                    Copiar mensaje
                  </button>
                )}
              </div>
            )}
          </form>
        )}
      </div>

      {/* Editor de personalidad */}
      <div className="card-hard p-5 bg-white">
        <h3 className="font-stencil text-2xl mb-3">⚙️ Personaliza Rocío</h3>
        <div className="space-y-3">
          <Field label="Nombre del negocio" value={profile.nombre_negocio} onChange={(v) => setProfile({ ...profile, nombre_negocio: v })} placeholder="Clínica Dental Sonrisa" />
          <Field label="Firma de respuesta" value={profile.firma_respuesta} onChange={(v) => setProfile({ ...profile, firma_respuesta: v })} placeholder="El equipo de Sonrisa" />
          <label className="block">
            <span className="block text-xs font-mono uppercase tracking-widest mb-1">Tono de marca</span>
            <select value={profile.tono_marca} onChange={(e) => setProfile({ ...profile, tono_marca: e.target.value })} className="w-full border-[3px] border-black px-3 py-2 text-sm bg-white shadow-[3px_3px_0_#000]">
              <option value="cordial y profesional">Cordial y profesional</option>
              <option value="muy cercano y cálido">Muy cercano y cálido</option>
              <option value="formal y serio">Formal y serio</option>
              <option value="divertido y desenfadado">Divertido y desenfadado</option>
            </select>
          </label>
          <Textarea label="Reglas custom" value={profile.reglas_custom} onChange={(v) => setProfile({ ...profile, reglas_custom: v })} placeholder="Ej: nunca menciones nuestro precio · siempre 'doctor' antes del apellido · etc." />
          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={saveProfile} disabled={profileSaving} className="btn-mustard text-sm disabled:opacity-50">
              {profileSaving ? "Guardando…" : "Guardar"}
            </button>
            {profileSavedAt && <span className="text-[10px] font-mono text-[#14B8A6]">✓ Guardado a las {profileSavedAt}</span>}
          </div>
        </div>
      </div>

      {/* Añadir reseña manual + Cola pending */}
      <div className="card-hard p-5 bg-white border-[color:var(--mustard)]">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="font-stencil text-2xl">🛡️ Cola de aprobación · {data.pending.length} pendiente{data.pending.length !== 1 ? "s" : ""}</h3>
          <button onClick={() => setShowManual((s) => !s)} className="btn-mustard text-xs">
            {showManual ? "Cerrar" : "+ Pegar reseña manual"}
          </button>
        </div>

        {showManual && (
          <form onSubmit={addManualReview} className="card-hard p-4 bg-[color:var(--cream)] mb-3 space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <input value={manualReview.reviewer_name} onChange={(e) => setManualReview({ ...manualReview, reviewer_name: e.target.value })} placeholder="Nombre del que reseñó" className="border-[3px] border-black px-3 py-2 text-sm shadow-[3px_3px_0_#000]" />
              <select value={manualReview.rating} onChange={(e) => setManualReview({ ...manualReview, rating: parseInt(e.target.value) })} className="border-[3px] border-black px-3 py-2 text-sm bg-white shadow-[3px_3px_0_#000]">
                {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n}★</option>)}
              </select>
            </div>
            <textarea value={manualReview.text} onChange={(e) => setManualReview({ ...manualReview, text: e.target.value })} placeholder="Pega aquí el texto de la reseña Google" rows={3} required className="w-full border-[3px] border-black p-3 text-sm shadow-[3px_3px_0_#000]" />
            {locations.length > 0 && (
              <select value={manualReview.location_id} onChange={(e) => setManualReview({ ...manualReview, location_id: e.target.value })} className="w-full border-[3px] border-black px-3 py-2 text-sm bg-white shadow-[3px_3px_0_#000]">
                <option value="">Sin local específico</option>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            )}
            <button type="submit" className="btn-mustard text-xs">Generar respuesta con Rocío</button>
          </form>
        )}

        {data.pending.length === 0 ? (
          <p className="text-sm text-black/50">No hay reseñas pendientes. Pega una arriba para que Rocío te proponga respuesta.</p>
        ) : (
          <div className="space-y-3">
            {data.pending.map((p) => (
              <div key={p.id} className="border-2 border-black bg-white p-3">
                <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {p.review && (
                      <>
                        <span className="font-bold text-sm">{p.review.reviewer_name || "Anónimo"}</span>
                        <span className="px-2 py-0.5 text-[10px] font-bold border-2 border-black" style={{ backgroundColor: p.review.rating >= 4 ? "#14B8A6" : p.review.rating === 3 ? "#FBBF24" : "#EF4444", color: "#fff" }}>
                          {p.review.rating}★
                        </span>
                      </>
                    )}
                    {p.intent && <span className="text-[10px] font-mono text-black/50">{p.intent}</span>}
                  </div>
                  <span className="text-[10px] font-mono text-black/40">{new Date(p.created_at).toLocaleString("es-ES")}</span>
                </div>

                {p.review?.text && (
                  <div className="mb-2">
                    <div className="text-[10px] font-mono text-black/40 mb-1">Reseña original</div>
                    <div className="border-l-4 border-black pl-3 text-sm text-black/80">{p.review.text}</div>
                  </div>
                )}

                <div className="mb-2">
                  <div className="text-[10px] font-mono text-black/40 mb-1">Rocío propone (editable)</div>
                  <textarea
                    value={editing[p.id] ?? p.proposed_response}
                    onChange={(e) => setEditing({ ...editing, [p.id]: e.target.value })}
                    rows={4}
                    className="w-full border-2 border-black p-2 text-sm font-mono shadow-[2px_2px_0_#000]"
                  />
                </div>

                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => approve(p.id)} disabled={busyId === p.id} className="btn-mustard text-xs disabled:opacity-50">
                    {busyId === p.id ? "…" : "✓ Aprobar y copiar"}
                  </button>
                  <button onClick={() => reject(p.id)} disabled={busyId === p.id} className="border-[3px] border-[color:var(--red)] text-[color:var(--red)] px-3 py-2 text-xs font-bold uppercase tracking-widest hover:bg-[color:var(--red)] hover:text-white disabled:opacity-50">
                    Ignorar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, color, highlight }: { label: string; value: string | number; color: string; highlight?: boolean }) {
  return (
    <div className={`card-hard p-4 ${highlight ? "bg-[color:var(--mustard)]/30" : "bg-white"}`} style={{ borderColor: color }}>
      <div className="text-[10px] font-mono uppercase tracking-widest text-black/60">{label}</div>
      <div className="font-stencil text-3xl mt-1" style={{ color }}>{value}</div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="block text-xs font-mono uppercase tracking-widest mb-1">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full border-[3px] border-black px-3 py-2 text-sm shadow-[3px_3px_0_#000]" />
    </label>
  );
}

function Textarea({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="block text-xs font-mono uppercase tracking-widest mb-1">{label}</span>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={3} className="w-full border-[3px] border-black p-3 font-mono text-sm shadow-[3px_3px_0_#000]" />
    </label>
  );
}
