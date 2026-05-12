"use client";
import { useState } from "react";

export default function EsteticaCTA() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [clinic, setClinic] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name: clinic ? `${name} (${clinic})` : name,
          sector: "Clínica estética",
          city,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setStatus("ok");
      setMsg("Plaza reservada. Te contactamos en 24-48h para la demo.");
    } catch (err) {
      setStatus("error");
      setMsg(err instanceof Error ? err.message : "Algo falló");
    }
  }

  return (
    <section id="waitlist-estetica" className="py-24 border-t-[3px] border-black bg-black text-[color:var(--cream)]">
      <div className="max-w-3xl mx-auto px-5 text-center">
        <div className="flex flex-wrap justify-center items-center gap-3 text-xs font-mono mb-6">
          <span className="border border-[color:var(--mustard)]/40 text-[color:var(--mustard)] px-3 py-1">ACCESO FUNDADOR</span>
          <span className="border border-white/20 text-white/40 px-3 py-1">100 PLAZAS · PRECIO CONGELADO</span>
        </div>
        <h2 className="font-stencil text-5xl md:text-7xl mb-6 leading-tight">
          Tu clínica.<br />Operativa<br />esta semana.
        </h2>
        <p className="text-base md:text-lg mb-4 text-white/50 max-w-md mx-auto">
          Desde <span className="text-white font-semibold">39 €/mes</span>, precio fundador congelado de por vida.
        </p>
        <p className="text-sm mb-10 text-white/30 max-w-sm mx-auto">
          14 días gratis, sin tarjeta. Setup en 15 minutos. Sin código.
        </p>

        {status === "ok" ? (
          <div className="border-[3px] border-[color:var(--mustard)] bg-[color:var(--mustard)]/5 p-10 text-left max-w-lg mx-auto">
            <div className="text-[10px] font-mono text-[color:var(--mustard)] tracking-widest mb-4">PLAZA RESERVADA ✓</div>
            <p className="font-stencil text-2xl text-white mb-3">{msg}</p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-3 max-w-lg mx-auto text-left">
            <input
              required type="text" placeholder="Tu nombre *" value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-white/5 border-[2px] border-white/10 text-white px-4 py-3 text-base placeholder:text-white/20 focus:outline-none focus:border-white/30"
            />
            <input
              type="text" placeholder="Nombre de tu centro (opcional)" value={clinic}
              onChange={(e) => setClinic(e.target.value)}
              className="bg-white/5 border-[2px] border-white/10 text-white px-4 py-3 text-base placeholder:text-white/20 focus:outline-none focus:border-white/30"
            />
            <input
              required type="email" placeholder="tu@correo.com *" value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-white/5 border-[2px] border-white/10 text-white px-4 py-3 text-base placeholder:text-white/20 focus:outline-none focus:border-white/30"
            />
            <input
              required type="text" placeholder="Ciudad *" value={city}
              onChange={(e) => setCity(e.target.value)}
              className="bg-white/5 border-[2px] border-white/10 text-white px-4 py-3 text-base placeholder:text-white/20 focus:outline-none focus:border-white/30"
            />
            <button type="submit" disabled={status === "loading"}
              className="bg-[color:var(--mustard)] text-black font-bold text-base py-4 px-6 border-[3px] border-[color:var(--mustard)] hover:bg-transparent hover:text-[color:var(--mustard)] transition-colors mt-2 tracking-wide">
              {status === "loading" ? "Procesando..." : "Activar mi equipo IA →"}
            </button>
            {status === "error" && <p className="text-red-400 text-center text-sm">{msg}</p>}
          </form>
        )}
        <div className="flex flex-wrap justify-center gap-4 mt-8 text-[10px] font-mono text-white/20 tracking-widest">
          <span>SIN TARJETA · 14 DÍAS FREE</span>
          <span>·</span>
          <span>CANCELA CUANDO QUIERAS</span>
          <span>·</span>
          <span>DATOS EN LA UE · RGPD</span>
        </div>
      </div>
    </section>
  );
}
