"use client";
import { useState } from "react";

export default function DentalCTA() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("Málaga");
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
          sector: "Clínica dental",
          city,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setStatus("ok");
      setMsg("¡Tu plaza queda reservada! Te llamo en 24-48h para agendar la demo.");
    } catch (err) {
      setStatus("error");
      setMsg(err instanceof Error ? err.message : "Algo falló");
    }
  }

  return (
    <section id="waitlist-dental" className="py-24 border-t-[3px] border-black bg-black text-[color:var(--cream)]">
      <div className="max-w-3xl mx-auto px-5 text-center">
        <div className="flex flex-wrap justify-center items-center gap-3 text-xs font-mono mb-6">
          <span className="bg-[color:var(--mustard)] text-black px-2 py-1 font-bold tracking-widest">5 PLAZAS PILOTO</span>
          <span className="border-2 border-[color:var(--red)] text-[color:var(--red)] px-2 py-1 font-bold tracking-widest">MÁLAGA · 30 DÍAS GRATIS</span>
        </div>
        <h2 className="font-display text-5xl md:text-7xl mb-6">
          Reserva tu<br />plaza piloto
        </h2>
        <p className="text-lg md:text-xl mb-10 text-white/80">
          Regalo <span className="font-bold text-[color:var(--mustard)]">30 días gratis</span> a 5 clínicas dentales de Málaga a cambio de feedback honesto.
          <span className="block mt-2 text-white/60 text-sm">Sin tarjeta. Si no te aporta, te vas. Si te aporta, sigues con precio fundador 79€/mes para siempre.</span>
        </p>

        {status === "ok" ? (
          <div className="card-hard text-black p-8">
            <div className="text-5xl mb-4">🦷</div>
            <p className="font-display text-3xl">{msg}</p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-3 max-w-lg mx-auto text-left">
            <input
              required
              type="text"
              placeholder="Tu nombre *"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="card-hard text-black px-4 py-3 text-base font-semibold focus:outline-none"
            />
            <input
              required
              type="text"
              placeholder="Nombre de tu negocio *"
              value={clinic}
              onChange={(e) => setClinic(e.target.value)}
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
            <input
              required
              type="text"
              placeholder="Ciudad *"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="card-hard text-black px-4 py-3 text-base font-semibold focus:outline-none"
            />
            <button type="submit" disabled={status === "loading"} className="btn-mustard text-lg mt-2">
              {status === "loading" ? "RESERVANDO..." : "RESERVAR MI PLAZA"}
            </button>
            {status === "error" && <p className="text-red-300 text-center">{msg}</p>}
          </form>
        )}
        <p className="text-xs text-white/50 mt-6">
          Te llamo personalmente en 24-48h para agendar demo de 15 min.
        </p>
      </div>
    </section>
  );
}
