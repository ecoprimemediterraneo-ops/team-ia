"use client";
import { useState } from "react";

export default function LeadForm({
  token,
  ctaLabel,
  successMessage,
}: {
  token: string;
  ctaLabel: string;
  successMessage: string;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [hp, setHp] = useState(""); // honeypot
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [err, setErr] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (hp) return; // bot
    setStatus("loading");
    setErr("");
    try {
      const res = await fetch(`/api/lead/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone, hp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setStatus("ok");
    } catch (e) {
      setStatus("error");
      setErr(e instanceof Error ? e.message : "Algo falló");
    }
  }

  if (status === "ok") {
    return (
      <div className="card-hard p-6 text-center">
        <div className="text-5xl mb-4">🎉</div>
        <p className="font-display text-2xl">{successMessage}</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="card-hard p-6 flex flex-col gap-3">
      <input
        type="text"
        placeholder="Tu nombre (opcional)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="border-2 border-black px-3 py-2 focus:outline-none focus:bg-[color:var(--mustard)]/20"
      />
      <input
        required
        type="email"
        placeholder="tu@correo.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="border-2 border-black px-3 py-2 focus:outline-none focus:bg-[color:var(--mustard)]/20"
      />
      <input
        type="tel"
        placeholder="Teléfono (opcional)"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        className="border-2 border-black px-3 py-2 focus:outline-none focus:bg-[color:var(--mustard)]/20"
      />
      {/* honeypot oculto para bots */}
      <input
        type="text"
        tabIndex={-1}
        autoComplete="off"
        value={hp}
        onChange={(e) => setHp(e.target.value)}
        style={{ position: "absolute", left: "-9999px", height: 0, width: 0 }}
        aria-hidden="true"
      />
      <button type="submit" disabled={status === "loading"} className="btn-mustard mt-2">
        {status === "loading" ? "ENVIANDO…" : ctaLabel.toUpperCase()}
      </button>
      {err && <p className="text-sm text-[color:var(--red)] font-bold">{err}</p>}
      <p className="text-[10px] text-black/50 text-center mt-1">
        Al enviar aceptas que te contactemos por estos medios. No spam, palabra.
      </p>
    </form>
  );
}
