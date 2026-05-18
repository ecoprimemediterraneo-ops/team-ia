"use client";
import { useState } from "react";
import type { Publicacion, Red } from "@/lib/redes";

const REDES: { v: Red; label: string; emoji: string; color: string }[] = [
  { v: "instagram", label: "Instagram", emoji: "📷", color: "#E1306C" },
  { v: "facebook", label: "Facebook", emoji: "📘", color: "#1877F2" },
  { v: "linkedin", label: "LinkedIn", emoji: "💼", color: "#0A66C2" },
  { v: "tiktok", label: "TikTok", emoji: "🎵", color: "#000000" },
];

type Props = {
  borradoresIniciales: Publicacion[];
  aprobadasIniciales: Publicacion[];
  programadasIniciales: Publicacion[];
  asistidasIniciales: Publicacion[];
  publicadasIniciales: Publicacion[];
};

export default function AprobarClient({
  borradoresIniciales,
  aprobadasIniciales,
  programadasIniciales,
  asistidasIniciales,
  publicadasIniciales,
}: Props) {
  const [borradores, setBorradores] = useState(borradoresIniciales);
  const [aprobadas, setAprobadas] = useState(aprobadasIniciales);
  const [programadas, setProgramadas] = useState(programadasIniciales);
  const [asistidas] = useState(asistidasIniciales);
  const [publicadas] = useState(publicadasIniciales);

  const [crearForm, setCrearForm] = useState({
    red: "instagram" as Red,
    contenido: "",
    imagenUrl: "",
    fechaProgramada: new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16),
  });
  const [creando, setCreando] = useState(false);

  async function actualizarEstado(id: string, estado: Publicacion["estado"]) {
    const res = await fetch("/api/redes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, estado }),
    });
    const data = await res.json();
    if (!data.ok) return alert(data.error || "Error");
    // Refresh state (move between lists)
    setBorradores((l) => l.filter((p) => p.id !== id));
    setAprobadas((l) => l.filter((p) => p.id !== id));
    setProgramadas((l) => l.filter((p) => p.id !== id));
    const pub = data.publicacion as Publicacion;
    if (estado === "aprobada") setAprobadas((l) => [...l, pub]);
    if (estado === "programada") setProgramadas((l) => [...l, pub]);
  }

  async function eliminar(id: string) {
    if (!confirm("¿Eliminar esta publicación?")) return;
    await fetch(`/api/redes?id=${id}`, { method: "DELETE" });
    setBorradores((l) => l.filter((p) => p.id !== id));
    setAprobadas((l) => l.filter((p) => p.id !== id));
    setProgramadas((l) => l.filter((p) => p.id !== id));
  }

  async function crearPub(e: React.FormEvent) {
    e.preventDefault();
    setCreando(true);
    try {
      const fechaISO = new Date(crearForm.fechaProgramada).toISOString();
      const body: Record<string, unknown> = {
        red: crearForm.red,
        contenido: crearForm.contenido,
        fechaProgramada: fechaISO,
      };
      if (crearForm.imagenUrl) body.imagenUrl = crearForm.imagenUrl;

      const res = await fetch("/api/redes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.ok) return alert(data.error || "Error");
      setBorradores((l) => [...l, data.publicacion]);
      setCrearForm({ ...crearForm, contenido: "", imagenUrl: "" });
    } finally {
      setCreando(false);
    }
  }

  function copiar(texto: string) {
    navigator.clipboard.writeText(texto);
    alert("Copiado al portapapeles ✓ Pega en la red");
  }

  function abrirRed(red: Red) {
    const urls = {
      instagram: "https://www.instagram.com/",
      facebook: "https://www.facebook.com/",
      linkedin: "https://www.linkedin.com/feed/?shareActive=true",
      tiktok: "https://www.tiktok.com/upload",
    };
    window.open(urls[red], "_blank");
  }

  return (
    <div className="space-y-6">
      {/* Importar masivo del banco */}
      <ImportarBancoBoton onImportado={(nuevos) => setBorradores((l) => [...l, ...nuevos])} />

      {/* Crear nuevo borrador */}
      <details className="card-hard p-5 bg-white">
        <summary className="cursor-pointer font-stencil text-xl">➕ Nuevo borrador</summary>
        <form onSubmit={crearPub} className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest mb-1">Red</label>
              <select
                value={crearForm.red}
                onChange={(e) => setCrearForm({ ...crearForm, red: e.target.value as Red })}
                className="w-full border-2 border-black px-3 py-2 bg-white"
              >
                {REDES.map((r) => (
                  <option key={r.v} value={r.v}>{r.emoji} {r.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest mb-1">Fecha y hora</label>
              <input
                type="datetime-local"
                value={crearForm.fechaProgramada}
                onChange={(e) => setCrearForm({ ...crearForm, fechaProgramada: e.target.value })}
                className="w-full border-2 border-black px-3 py-2 bg-white"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest mb-1">Contenido (caption)</label>
            <textarea
              rows={4}
              value={crearForm.contenido}
              onChange={(e) => setCrearForm({ ...crearForm, contenido: e.target.value })}
              className="w-full border-2 border-black px-3 py-2 bg-white"
              placeholder="Texto del post..."
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest mb-1">URL imagen (opcional)</label>
            <input
              type="url"
              value={crearForm.imagenUrl}
              onChange={(e) => setCrearForm({ ...crearForm, imagenUrl: e.target.value })}
              className="w-full border-2 border-black px-3 py-2 bg-white"
              placeholder="https://..."
            />
          </div>
          <button type="submit" disabled={creando} className="btn-mustard">
            {creando ? "CREANDO..." : "CREAR BORRADOR"}
          </button>
        </form>
      </details>

      {/* Borradores pendientes aprobación */}
      <Seccion titulo="📝 Borradores" subtitulo="Generados por Marta. Aprueba o descarta." color="#000">
        {borradores.length === 0 ? (
          <Vacio mensaje="Sin borradores pendientes" />
        ) : (
          <div className="space-y-3">
            {borradores.map((p) => (
              <PubCard key={p.id} pub={p} acciones={[
                { label: "✅ Aprobar", onClick: () => actualizarEstado(p.id, "aprobada"), variant: "primary" },
                { label: "📅 Programar ya", onClick: () => actualizarEstado(p.id, "programada"), variant: "secondary" },
                { label: "🗑️", onClick: () => eliminar(p.id), variant: "danger" },
              ]} />
            ))}
          </div>
        )}
      </Seccion>

      {/* Aprobadas (esperan programación) */}
      <Seccion titulo="✅ Aprobadas" subtitulo="Listas. Programa para publicar a la hora indicada." color="#22C55E">
        {aprobadas.length === 0 ? (
          <Vacio mensaje="Sin aprobadas" />
        ) : (
          <div className="space-y-3">
            {aprobadas.map((p) => (
              <PubCard key={p.id} pub={p} acciones={[
                { label: "📅 Programar", onClick: () => actualizarEstado(p.id, "programada"), variant: "primary" },
                { label: "🗑️", onClick: () => eliminar(p.id), variant: "danger" },
              ]} />
            ))}
          </div>
        )}
      </Seccion>

      {/* Programadas (esperan al cron) */}
      <Seccion titulo="⏰ Programadas" subtitulo="El cron las publica automáticamente cuando llega la fecha." color="#F5C518">
        {programadas.length === 0 ? (
          <Vacio mensaje="Sin programadas" />
        ) : (
          <div className="space-y-3">
            {programadas.map((p) => (
              <PubCard key={p.id} pub={p} acciones={[
                { label: "↩️ Devolver a borrador", onClick: () => actualizarEstado(p.id, "borrador"), variant: "secondary" },
              ]} />
            ))}
          </div>
        )}
      </Seccion>

      {/* Asistidas (modo manual, esperan tu acción) */}
      <Seccion titulo="✋ Asistidas — requieren tu mano" subtitulo="API no configurada. Copia caption y publica manualmente." color="#FF7A59">
        {asistidas.length === 0 ? (
          <Vacio mensaje="Ninguna esperando acción manual" />
        ) : (
          <div className="space-y-3">
            {asistidas.map((p) => (
              <PubCard key={p.id} pub={p} acciones={[
                { label: "📋 Copiar caption", onClick: () => copiar(p.contenido), variant: "primary" },
                { label: "🚀 Abrir red", onClick: () => abrirRed(p.red), variant: "secondary" },
              ]} />
            ))}
          </div>
        )}
      </Seccion>

      {/* Publicadas (últimas 20) */}
      <Seccion titulo="🎉 Publicadas (últimas 20)" subtitulo="" color="#0A66C2">
        {publicadas.length === 0 ? (
          <Vacio mensaje="Sin publicaciones aún" />
        ) : (
          <div className="space-y-2">
            {publicadas.map((p) => (
              <div key={p.id} className="border-2 border-black p-3 bg-white text-sm flex justify-between items-center">
                <div>
                  <span className="text-xs font-mono uppercase tracking-widest text-black/60">{p.red}</span>
                  <span className="ml-2">{p.contenido.slice(0, 80)}{p.contenido.length > 80 && "..."}</span>
                </div>
                <span className="text-xs font-mono text-black/40">{new Date(p.actualizadaEn).toLocaleDateString("es-ES")}</span>
              </div>
            ))}
          </div>
        )}
      </Seccion>
    </div>
  );
}

function ImportarBancoBoton({ onImportado }: { onImportado: (pubs: Publicacion[]) => void }) {
  const [cargando, setCargando] = useState(false);
  async function importar() {
    if (!confirm("Esto creará ~50 borradores (30 IG + 20 LinkedIn) con fechas distribuidas desde mañana. ¿Continuar?")) return;
    setCargando(true);
    try {
      const r = await fetch("/api/redes/importar", { method: "POST" });
      const data = await r.json();
      if (!data.ok) return alert(data.error || "Error");
      alert(`✅ Importados ${data.importados} (IG: ${data.ig}, LI: ${data.li}). Saltados: ${data.saltados}.`);
      // Recargar página para mostrar nuevos borradores
      window.location.reload();
      onImportado([]);
    } finally {
      setCargando(false);
    }
  }
  return (
    <div className="card-hard p-5 bg-[#14B8A6]/10 border-[#14B8A6] flex items-center gap-4 flex-wrap">
      <span className="text-3xl">📦</span>
      <div className="flex-1 min-w-[200px]">
        <div className="font-bold">Importar banco de 50 publicaciones</div>
        <div className="text-xs text-black/60">30 posts de Instagram + 20 de LinkedIn del banco preparado. Fechas distribuidas desde mañana.</div>
      </div>
      <button onClick={importar} disabled={cargando} className="btn-mustard text-xs">
        {cargando ? "IMPORTANDO..." : "IMPORTAR LOS 50 →"}
      </button>
    </div>
  );
}

function Seccion({ titulo, subtitulo, color, children }: { titulo: string; subtitulo: string; color: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-baseline gap-3 mb-3">
        <h2 className="font-stencil text-2xl" style={{ color }}>{titulo}</h2>
        {subtitulo && <span className="text-xs text-black/50">{subtitulo}</span>}
      </div>
      {children}
    </section>
  );
}

function Vacio({ mensaje }: { mensaje: string }) {
  return <div className="border-2 border-dashed border-black/20 p-4 text-center text-sm text-black/40">{mensaje}</div>;
}

function PubCard({ pub, acciones }: { pub: Publicacion; acciones: { label: string; onClick: () => void; variant: "primary" | "secondary" | "danger" }[] }) {
  const red = REDES.find((r) => r.v === pub.red)!;
  return (
    <article className="card-hard p-4 bg-white">
      <div className="flex items-start gap-3">
        <span className="text-2xl shrink-0">{red.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-mono uppercase tracking-widest font-bold" style={{ color: red.color }}>{red.label}</span>
            <span className="text-xs font-mono text-black/40">·</span>
            <span className="text-xs font-mono text-black/60">{new Date(pub.fechaProgramada).toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
          </div>
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{pub.contenido}</p>
          {pub.imagenUrl && (
            <div className="mt-2 text-xs font-mono text-black/40">🖼️ {pub.imagenUrl}</div>
          )}
          {pub.resultado?.mensaje && (
            <div className="mt-2 text-xs font-mono italic text-black/50">{pub.resultado.mensaje}</div>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-black/10">
        {acciones.map((a, i) => (
          <button
            key={i}
            onClick={a.onClick}
            className={`text-xs font-bold uppercase tracking-widest px-3 py-2 border-2 border-black ${
              a.variant === "primary" ? "bg-[color:var(--mustard)] hover:bg-black hover:text-[color:var(--mustard)]" :
              a.variant === "danger" ? "bg-white text-[color:var(--red)] hover:bg-[color:var(--red)] hover:text-white" :
              "bg-white hover:bg-black hover:text-white"
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>
    </article>
  );
}
