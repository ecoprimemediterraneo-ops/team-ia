"use client";
import { useState } from "react";

export default function BetaForm({ sectores }: { sectores: string[] }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [sector, setSector] = useState("");
  const [city, setCity] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setMsg("");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, sector, city }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "No hemos podido reservar la plaza. Inténtalo de nuevo.");
      setStatus("ok");
      setMsg("¡Plaza reservada! Te contactamos en 24-48h.");
    } catch (err) {
      setStatus("error");
      setMsg(err instanceof Error ? err.message : "Algo falló. Inténtalo en unos minutos.");
    }
  }

  if (status === "ok") {
    return (
      <div className="card-hard p-8 bg-[color:var(--mustard)] text-center">
        <div className="text-4xl mb-3">✓</div>
        <p className="font-stencil text-2xl mb-2">Plaza reservada</p>
        <p className="text-sm text-black/70">{msg}</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="card-hard p-6 bg-white flex flex-col gap-3">
      <label className="text-xs font-mono tracking-widest text-black/60">
        NOMBRE *
        <input
          required
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tu nombre"
          className="mt-1 w-full border-2 border-black px-3 py-2 text-sm focus:outline-none focus:bg-[color:var(--mustard)]/20"
        />
      </label>
      <label className="text-xs font-mono tracking-widest text-black/60">
        EMAIL *
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu@correo.com"
          className="mt-1 w-full border-2 border-black px-3 py-2 text-sm focus:outline-none focus:bg-[color:var(--mustard)]/20"
        />
      </label>
      <label className="text-xs font-mono tracking-widest text-black/60">
        SECTOR *
        <select
          required
          value={sector}
          onChange={(e) => setSector(e.target.value)}
          className="mt-1 w-full border-2 border-black px-3 py-2 text-sm bg-white focus:outline-none focus:bg-[color:var(--mustard)]/20"
        >
          <option value="">Elige tu sector</option>
          {sectores.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs font-mono tracking-widest text-black/60">
        CIUDAD *
        <input
          required
          type="text"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="Ej. Madrid, Barcelona, CDMX…"
          className="mt-1 w-full border-2 border-black px-3 py-2 text-sm focus:outline-none focus:bg-[color:var(--mustard)]/20"
        />
      </label>

      <button
        type="submit"
        disabled={status === "loading"}
        className="mt-3 bg-black text-[color:var(--mustard)] font-bold text-sm tracking-widest uppercase py-3 px-4 border-2 border-black hover:bg-[color:var(--red)] hover:text-white transition-colors disabled:opacity-60"
      >
        {status === "loading" ? "Reservando…" : "Reservar plaza →"}
      </button>

      {status === "error" && (
        <p className="text-sm text-[color:var(--red)] text-center">{msg}</p>
      )}

      <p className="text-[10px] font-mono text-black/40 text-center tracking-widest mt-1">
        SIN TARJETA · 6 MESES GRATIS · SIN PERMANENCIA
      </p>
    </form>
  );
}
