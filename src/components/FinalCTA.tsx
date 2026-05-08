"use client";
import { useState } from "react";

export default function FinalCTA() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setStatus("ok");
      setMessage("¡Estás dentro! Te avisamos en cuanto abramos.");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Algo falló. Inténtalo de nuevo.");
    }
  }

  return (
    <section id="waitlist" className="py-24 border-t-[3px] border-black bg-black text-[color:var(--cream)]">
      <div className="max-w-3xl mx-auto px-5 text-center">
        <div className="flex flex-wrap justify-center items-center gap-3 text-xs font-mono mb-6">
          <span className="bg-[color:var(--mustard)] text-black px-2 py-1 font-bold tracking-widest">RECLUTAMIENTO ABIERTO</span>
          <span className="border-2 border-[color:var(--red)] text-[color:var(--red)] px-2 py-1 font-bold tracking-widest">PLAZAS LIMITADAS</span>
        </div>
        <h2 className="font-display text-5xl md:text-8xl mb-6">
          Recluta tu<br />unidad
        </h2>
        <p className="text-lg md:text-xl mb-10 text-white/80">
          500 plazas fundadoras con <span className="font-bold text-[color:var(--mustard)]">precio para siempre</span>.
          Pack Local desde <span className="font-bold text-[color:var(--mustard)]">29 €/mes</span>.
          Cuando se llenen, los precios suben.
          <span className="block mt-2 text-white/60 text-sm">14 días de prueba sin tarjeta. Cancelas cuando quieras.</span>
        </p>

        {status === "ok" ? (
          <div className="card-hard text-black p-8">
            <div className="text-5xl mb-4">🎉</div>
            <p className="font-display text-3xl">{message}</p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-4 max-w-lg mx-auto">
            <input
              required
              type="text"
              placeholder="Tu nombre (opcional)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="card-hard text-black px-4 py-3 text-base font-semibold focus:outline-none"
            />
            <input
              required
              type="email"
              placeholder="tu@correo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="card-hard text-black px-4 py-3 text-base font-semibold focus:outline-none"
            />
            <button type="submit" disabled={status === "loading"} className="btn-mustard text-lg">
              {status === "loading" ? "RECLUTANDO..." : "ALÍSTAME"}
            </button>
            {status === "error" && <p className="text-red-300">{message}</p>}
          </form>
        )}

        <p className="text-xs text-white/50 mt-6">
          Sin spam. Solo te escribimos cuando abramos plazas.
        </p>
      </div>
    </section>
  );
}
