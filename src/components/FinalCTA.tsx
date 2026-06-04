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

const nextSteps = [
  { step: "01", text: "Recibes acceso a tu panel en menos de 2 minutos." },
  { step: "02", text: "Videollamada de setup de 15 min. Los agentes aprenden tu negocio." },
  { step: "03", text: "Operativo. Tu equipo IA trabaja desde esa noche." },
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
      setMessage("Plaza reservada. Recibirás acceso en las próximas horas.");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Algo falló. Inténtalo de nuevo.");
    }
  }

  return (
    <section id="waitlist" className="border-t-[3px] border-black bg-black text-[color:var(--cream)]">

      {/* Franja superior: lo que pasa después */}
      <div className="border-b border-white/10">
        <div className="max-w-5xl mx-auto px-6 py-12">
          <div className="text-[10px] font-mono tracking-[0.2em] text-white/30 mb-8 uppercase">
            Qué pasa cuando te registras
          </div>
          <div className="grid md:grid-cols-3 gap-px bg-white/10">
            {nextSteps.map((s) => (
              <div key={s.step} className="bg-black p-6">
                <div className="font-stencil text-4xl text-white/10 mb-4">{s.step}</div>
                <p className="text-sm text-white/60 leading-relaxed">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bloque CTA principal */}
      <div className="max-w-3xl mx-auto px-5 py-24 text-center">
        <div className="flex flex-wrap justify-center items-center gap-2 text-[10px] font-mono mb-8 tracking-[0.2em]">
          <span className="border border-[color:var(--mustard)]/40 text-[color:var(--mustard)] px-3 py-1">ACCESO FUNDADOR</span>
          <span className="border border-white/20 text-white/40 px-3 py-1">20 PLAZAS · PRECIO CONGELADO</span>
        </div>

        <h2 className="font-stencil text-5xl md:text-7xl mb-6 leading-tight">
          Tu operación IA.<br />Esta noche.
        </h2>

        <p className="text-base md:text-lg mb-4 text-white/50 max-w-md mx-auto">
          Desde <span className="text-white font-semibold">89 €/mes</span>, precio fundador congelado de por vida.
        </p>
        <p className="text-sm mb-10 text-white/30 max-w-sm mx-auto">
          6 meses gratis, sin tarjeta. Si no ves el valor, te vas en un click. Sin penalización.
        </p>

        {status === "ok" ? (
          <div className="border-[3px] border-[color:var(--mustard)] bg-[color:var(--mustard)]/5 p-10 text-left max-w-lg mx-auto">
            <div className="text-[10px] font-mono text-[color:var(--mustard)] tracking-widest mb-4">PLAZA RESERVADA ✓</div>
            <p className="font-stencil text-2xl text-white mb-3">{message}</p>
            <p className="text-sm text-white/40">Revisa tu correo. Te enviamos el acceso en breve.</p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-3 max-w-lg mx-auto text-left">
            <input
              type="text"
              placeholder="Tu nombre (opcional)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-white/5 border-[2px] border-white/10 text-white px-4 py-3 text-base placeholder:text-white/20 focus:outline-none focus:border-white/30"
            />
            <input
              required
              type="email"
              placeholder="tu@correo.com *"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-white/5 border-[2px] border-white/10 text-white px-4 py-3 text-base placeholder:text-white/20 focus:outline-none focus:border-white/30"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <select
                required
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                className="bg-white/5 border-[2px] border-white/10 text-white px-4 py-3 text-base focus:outline-none focus:border-white/30 appearance-none"
              >
                <option value="" className="bg-black">Tu tipo de negocio *</option>
                {SECTORS.map((s) => (<option key={s} value={s} className="bg-black">{s}</option>))}
              </select>
              <input
                required
                type="text"
                placeholder="Ciudad *"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="bg-white/5 border-[2px] border-white/10 text-white px-4 py-3 text-base placeholder:text-white/20 focus:outline-none focus:border-white/30"
              />
            </div>
            <button
              type="submit"
              disabled={status === "loading"}
              className="bg-[color:var(--mustard)] text-black font-bold text-base py-4 px-6 border-[3px] border-[color:var(--mustard)] hover:bg-transparent hover:text-[color:var(--mustard)] transition-colors mt-2 tracking-wide"
            >
              {status === "loading" ? "Procesando..." : "Activar mi equipo IA →"}
            </button>
            {status === "error" && <p className="text-red-400 text-center text-sm">{message}</p>}
          </form>
        )}

        <div className="flex flex-wrap justify-center gap-4 mt-8 text-[10px] font-mono text-white/20 tracking-widest">
          <span>SIN TARJETA · 6 MESES GRATIS</span>
          <span>·</span>
          <span>CANCELA CUANDO QUIERAS</span>
          <span>·</span>
          <span>DATOS EN LA UE · RGPD</span>
        </div>
      </div>
    </section>
  );
}
