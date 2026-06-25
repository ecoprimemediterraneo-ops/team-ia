"use client";
import { useState } from "react";

export default function BetaForm({ sectores }: { sectores: string[] }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [sector, setSector] = useState("");
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!consent) {
      setStatus("error");
      setMsg("Marca la casilla de consentimiento para continuar.");
      return;
    }
    setStatus("loading");
    setMsg("");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone, sector }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "No hemos podido registrar tu demo. Inténtalo de nuevo.");
      setStatus("ok");
      setMsg("¡Recibido! Te contactamos en menos de 24h.");
    } catch (err) {
      setStatus("error");
      setMsg(err instanceof Error ? err.message : "Algo falló. Inténtalo en unos minutos.");
    }
  }

  if (status === "ok") {
    return (
      <div className="card-hard p-8 bg-[color:var(--mustard)] text-center" role="status" aria-live="polite">
        <div className="text-4xl mb-3" aria-hidden="true">✓</div>
        <p className="font-stencil text-2xl mb-2">Demo solicitada</p>
        <p className="text-sm text-black/70">{msg}</p>
        <p className="text-xs text-black/60 mt-3">
          Te escribimos a tu email para agendar una demo de 15 min, sin compromiso.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="card-hard p-6 bg-white flex flex-col gap-4" noValidate>
      <div>
        <label htmlFor="bf-name" className="block text-xs font-mono tracking-widest text-black/60 mb-1">
          NOMBRE *
        </label>
        <input
          id="bf-name"
          name="name"
          required
          type="text"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tu nombre"
          className="w-full border-2 border-black px-3 py-2.5 text-sm focus:outline-none focus:bg-[color:var(--mustard)]/20"
        />
      </div>

      <div>
        <label htmlFor="bf-email" className="block text-xs font-mono tracking-widest text-black/60 mb-1">
          EMAIL *
        </label>
        <input
          id="bf-email"
          name="email"
          required
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu@correo.com"
          className="w-full border-2 border-black px-3 py-2.5 text-sm focus:outline-none focus:bg-[color:var(--mustard)]/20"
        />
      </div>

      <div>
        <label htmlFor="bf-phone" className="block text-xs font-mono tracking-widest text-black/60 mb-1">
          TELÉFONO <span className="text-black/35">(opcional)</span>
        </label>
        <input
          id="bf-phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Para llamarte si lo prefieres"
          className="w-full border-2 border-black px-3 py-2.5 text-sm focus:outline-none focus:bg-[color:var(--mustard)]/20"
        />
      </div>

      <div>
        <label htmlFor="bf-sector" className="block text-xs font-mono tracking-widest text-black/60 mb-1">
          TIPO DE NEGOCIO <span className="text-black/35">(opcional)</span>
        </label>
        <select
          id="bf-sector"
          name="sector"
          value={sector}
          onChange={(e) => setSector(e.target.value)}
          className="w-full border-2 border-black px-3 py-2.5 text-sm bg-white focus:outline-none focus:bg-[color:var(--mustard)]/20"
        >
          <option value="">Elige tu tipo de negocio</option>
          {sectores.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Consentimiento RGPD */}
      <div className="flex items-start gap-2.5">
        <input
          id="bf-consent"
          name="consent"
          type="checkbox"
          required
          aria-required="true"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 w-5 h-5 shrink-0 accent-black border-2 border-black"
        />
        <label htmlFor="bf-consent" className="text-xs text-black/65 leading-snug">
          Acepto que AI-Team trate mis datos para contactarme sobre la demo. Sin spam. Consulta la{" "}
          <a href="/legal/privacidad" className="underline font-bold hover:text-[color:var(--red)]">
            política de privacidad
          </a>.
        </label>
      </div>

      <button
        type="submit"
        disabled={status === "loading"}
        className="mt-1 bg-black text-[color:var(--mustard)] font-bold text-sm tracking-widest uppercase py-3.5 px-4 border-2 border-black hover:bg-[color:var(--red)] hover:text-white transition-colors disabled:opacity-60"
      >
        {status === "loading" ? "Enviando…" : "Pide tu demo →"}
      </button>

      {/* Qué pasa tras enviar */}
      <p className="text-xs text-black/60 text-center leading-snug">
        Te contactamos en <strong>menos de 24h</strong> para enseñarte el sistema en una demo de
        15 min, <strong>sin compromiso</strong>.
      </p>

      {/* Región de estado persistente: anuncia carga y error a lectores de pantalla */}
      <div aria-live="assertive" role="status" className="text-center empty:hidden">
        {status === "loading" && (
          <p className="text-sm text-black/60">Enviando tu solicitud…</p>
        )}
        {status === "error" && (
          <p className="text-sm text-[color:var(--red)] font-bold">{msg}</p>
        )}
      </div>

      <p className="text-[10px] font-mono text-black/40 text-center tracking-widest mt-1">
        SIN TARJETA · 6 MESES GRATIS · SIN PERMANENCIA · CANCELA CUANDO QUIERAS
      </p>
    </form>
  );
}
