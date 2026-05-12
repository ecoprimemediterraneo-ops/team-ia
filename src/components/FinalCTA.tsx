"use client";
import { useState } from "react";

const SECTORS = [
  "Clínica dental",
  "Peluquería / estética",
  "Fisio / nutrición",
  "Restaurante / hostelería",
  "Inmobiliaria",
  "Gestoría / asesoría",
  "Coach / consultor",
  "E-commerce",
  "Otro",
];

export default function FinalCTA() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [sector, setSector] = useState("");
  const [city, setCity] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, sector, city }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setStatus("ok");
      setMessage("¡Estás dentro! Te avisamos en cuanto abramos tu plaza fundadora.");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Algo falló. Inténtalo de nuevo.");
    }
  }

  return (
    <section id="waitlist" className="py-24 border-t-[3px] border-black bg-black text-[color:var(--cream)]">
      <div className="max-w-3xl mx-auto px-5 text-center">
        <div className="flex flex-wrap justify-center items-center gap-2 text-[10px] font-mono mb-8 tracking-[0.2em]">
          <span className="border border-[color:var(--mustard)]/40 text-[color:var(--mustard)] px-3 py-1">ACCESO FUNDADOR</span>
          <span className="border border-white/20 text-white/40 px-3 py-1">100 PLAZAS</span>
        </div>
        <h2 className="font-stencil text-5xl md:text-7xl mb-6 leading-tight">
          Empieza hoy.<br />Precio fijo<br />para siempre.
        </h2>
        <p className="text-base md:text-lg mb-10 text-white/50 max-w-md mx-auto">
          Precio fundador congelado de por vida desde <span className="text-white font-semibold">39 €/mes</span>. 14 días gratis, sin tarjeta.
        </p>

        {status === "ok" ? (
          <div className="card-hard text-black p-8">
            <div className="text-5xl mb-4">🎉</div>
            <p className="font-display text-3xl">{message}</p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-3 max-w-lg mx-auto text-left">
            <input
              type="text"
              placeholder="Tu nombre (opcional)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="card-hard text-black px-4 py-3 text-base font-semibold focus:outline-none"
            />
            <input
              required
              type="email"
              placeholder="tu@correo.com *"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="card-hard text-black px-4 py-3 text-base font-semibold focus:outline-none"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <select
                required
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                className="card-hard text-black px-4 py-3 text-base font-semibold focus:outline-none bg-white"
              >
                <option value="">Tu tipo de negocio *</option>
                {SECTORS.map((s) => (<option key={s} value={s}>{s}</option>))}
              </select>
              <input
                required
                type="text"
                placeholder="Ciudad *"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="card-hard text-black px-4 py-3 text-base font-semibold focus:outline-none"
              />
            </div>
            <button type="submit" disabled={status === "loading"} className="btn-mustard text-base mt-2">
              {status === "loading" ? "Enviando..." : "Reservar plaza fundadora →"}
            </button>
            {status === "error" && <p className="text-red-300 text-center">{message}</p>}
          </form>
        )}

        <p className="text-xs text-white/50 mt-6">
          Sin spam. Solo te escribimos cuando abramos tu plaza.
        </p>
      </div>
    </section>
  );
}
