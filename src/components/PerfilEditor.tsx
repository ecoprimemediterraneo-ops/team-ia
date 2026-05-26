"use client";
import { useState } from "react";
import type { BusinessProfile } from "@/lib/claude";

export default function PerfilEditor({ initial }: { initial: BusinessProfile }) {
  const [b, setB] = useState<BusinessProfile>(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "ok" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setMsg("");
    try {
      const res = await fetch("/api/perfil", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(b),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setStatus("ok");
      setMsg("Perfil actualizado ✓ Tus agentes ya usan este nuevo contexto.");
    } catch (e) {
      setStatus("error");
      setMsg(e instanceof Error ? e.message : "Error");
    }
  }

  function update<K extends keyof BusinessProfile>(k: K, v: BusinessProfile[K]) {
    setB({ ...b, [k]: v });
    setStatus("idle");
  }

  return (
    <form onSubmit={save} className="card-hard p-5 space-y-4 max-w-2xl">
      <div>
        <label className="block text-xs font-mono uppercase tracking-widest text-black/60 mb-1">
          Nombre del negocio
        </label>
        <input
          required
          value={b.nombre}
          onChange={(e) => update("nombre", e.target.value)}
          className="w-full border-2 border-black px-3 py-2 text-sm focus:outline-none focus:bg-[color:var(--mustard)]/20"
        />
      </div>

      <div>
        <label className="block text-xs font-mono uppercase tracking-widest text-black/60 mb-1">
          Sector
        </label>
        <input
          required
          value={b.sector}
          onChange={(e) => update("sector", e.target.value)}
          placeholder="Clínica dental en el centro"
          className="w-full border-2 border-black px-3 py-2 text-sm focus:outline-none focus:bg-[color:var(--mustard)]/20"
        />
        <p className="text-[10px] text-black/50 mt-1">Importante: si pones &quot;dental&quot; o &quot;dentista&quot;, los agentes activan skills específicas dentales.</p>
      </div>

      <div>
        <label className="block text-xs font-mono uppercase tracking-widest text-black/60 mb-1">
          Qué ofreces
        </label>
        <textarea
          required
          value={b.ofrece}
          onChange={(e) => update("ofrece", e.target.value)}
          rows={4}
          placeholder="Limpieza dental, ortodoncia invisible, implantes, blanqueamiento, ortodoncia infantil, urgencias 24/7…"
          className="w-full border-2 border-black px-3 py-2 text-sm focus:outline-none focus:bg-[color:var(--mustard)]/20"
        />
        <p className="text-[10px] text-black/50 mt-1">Lista todos tus servicios. Cuanto más concreto, mejor responde a preguntas de pacientes.</p>
      </div>

      <div>
        <label className="block text-xs font-mono uppercase tracking-widest text-black/60 mb-1">
          Tono de marca
        </label>
        <textarea
          required
          value={b.tono}
          onChange={(e) => update("tono", e.target.value)}
          rows={3}
          placeholder="Cercano y familiar pero profesional. Tutea siempre. Evita tecnicismos. Da confianza."
          className="w-full border-2 border-black px-3 py-2 text-sm focus:outline-none focus:bg-[color:var(--mustard)]/20"
        />
        <p className="text-[10px] text-black/50 mt-1">Cómo hablan tus agentes. Si quieres &quot;serio formal&quot; o &quot;divertido&quot;, dilo.</p>
      </div>

      <div>
        <label className="block text-xs font-mono uppercase tracking-widest text-black/60 mb-1">
          Público objetivo
        </label>
        <textarea
          required
          value={b.publico}
          onChange={(e) => update("publico", e.target.value)}
          rows={3}
          placeholder="Familias del barrio (30-55 años), jubilados, expats británicos. Clase media. No clientes premium."
          className="w-full border-2 border-black px-3 py-2 text-sm focus:outline-none focus:bg-[color:var(--mustard)]/20"
        />
      </div>

      {msg && (
        <div className={`px-3 py-2 border-2 border-black text-sm font-bold ${status === "ok" ? "bg-green-200" : "bg-red-200"}`}>
          {msg}
        </div>
      )}

      <button type="submit" disabled={status === "saving"} className="btn-mustard">
        {status === "saving" ? "GUARDANDO…" : "💾 GUARDAR PERFIL"}
      </button>
    </form>
  );
}
