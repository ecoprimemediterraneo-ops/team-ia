"use client";
import { useState } from "react";

export default function NewsletterSignup() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "err">("idle");
  const [msg, setMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setStatus("ok");
      setMsg("¡Apuntado! Te llegará el próximo número.");
      setEmail("");
    } catch (err) {
      setStatus("err");
      setMsg(err instanceof Error ? err.message : "Error");
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="tu@email.com"
        className="w-full border-2 border-black px-3 py-2 text-sm bg-white"
      />
      <button
        type="submit"
        disabled={status === "loading"}
        className="w-full bg-black text-[color:var(--mustard)] py-2 text-xs font-bold uppercase tracking-widest hover:bg-[color:var(--red)] hover:text-white transition-colors disabled:opacity-60"
      >
        {status === "loading" ? "ENVIANDO..." : "SUSCRIBIRME"}
      </button>
      {msg && (
        <p className={`text-xs ${status === "ok" ? "text-green-700" : "text-[color:var(--red)]"}`}>{msg}</p>
      )}
    </form>
  );
}
