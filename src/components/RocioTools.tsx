"use client";
import { useState } from "react";

type Tone = "cordial" | "disculpa" | "profesional" | "cercano";

const TONE_LABEL: Record<Tone, string> = {
  cordial: "Cordial",
  disculpa: "Disculpa sincera",
  profesional: "Profesional",
  cercano: "Cercano / vecino",
};

export default function RocioTools() {
  const [review, setReview] = useState("");
  const [rating, setRating] = useState(5);
  const [tone, setTone] = useState<Tone>("cordial");
  const [customerName, setCustomerName] = useState("");
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(false);
  const [flash, setFlash] = useState<{ ok: boolean; msg: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Sugerir tono automáticamente según rating
  function setRatingAuto(n: number) {
    setRating(n);
    if (n <= 2) setTone("disculpa");
    else if (n === 3) setTone("profesional");
    else setTone("cordial");
  }

  async function generate() {
    if (!review.trim()) {
      setFlash({ ok: false, msg: "Pega primero el texto de la reseña" });
      return;
    }
    setLoading(true);
    setReply("");
    setCopied(false);
    try {
      const res = await fetch("/api/rocio/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ review, rating, tone, customerName: customerName.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setReply(data.reply);
    } catch (e) {
      setFlash({ ok: false, msg: e instanceof Error ? e.message : "Error" });
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(reply);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mt-0">
      {flash && (
        <div className={`mb-4 px-3 py-2 border-2 border-black text-sm font-bold ${flash.ok ? "bg-green-200" : "bg-red-200"}`}>
          {flash.ok ? "✓" : "⚠"} {flash.msg}
          <button onClick={() => setFlash(null)} className="ml-2 text-xs">×</button>
        </div>
      )}

      <div className="card-hard p-4">
        <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
          <div>
            <h3 className="font-stencil text-xl">Responde reseñas en 30 segundos</h3>
            <p className="text-sm text-black/60 mt-1">
              Pega la reseña que recibiste, Rocío te genera la respuesta en tu tono. Tú la copias y la pegas en tu panel de Google Business.
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          {/* Input */}
          <div className="min-w-0">
            <label className="block text-[10px] font-mono uppercase tracking-wider text-black/60 mb-1">
              Reseña recibida
            </label>
            <textarea
              value={review}
              onChange={(e) => setReview(e.target.value)}
              rows={5}
              placeholder='Ej: "Vine a hacerme una limpieza, trato impecable, repetiré."'
              className="w-full border-2 border-black p-2 text-sm focus:outline-none focus:bg-[color:var(--mustard)]/10"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <div className="min-w-0">
                <label className="block text-[10px] font-mono uppercase tracking-wider text-black/60 mb-1">Estrellas</label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRatingAuto(n)}
                      className={`w-8 h-8 border-2 border-black text-base ${rating >= n ? "bg-[color:var(--mustard)]" : "bg-white hover:bg-[color:var(--mustard)]/30"}`}
                    >★</button>
                  ))}
                </div>
              </div>
              <div className="min-w-0">
                <label className="block text-[10px] font-mono uppercase tracking-wider text-black/60 mb-1">Tono</label>
                <select
                  value={tone}
                  onChange={(e) => setTone(e.target.value as Tone)}
                  className="w-full border-2 border-black px-2 py-1.5 text-sm font-bold bg-white focus:outline-none focus:bg-[color:var(--mustard)]/20 truncate"
                >
                  {(Object.keys(TONE_LABEL) as Tone[]).map((t) => (
                    <option key={t} value={t}>{TONE_LABEL[t]}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-3">
              <label className="block text-[10px] font-mono uppercase tracking-wider text-black/60 mb-1">
                Nombre del cliente (opcional)
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="María, José, etc."
                className="w-full border-2 border-black px-3 py-2 text-sm focus:outline-none focus:bg-[color:var(--mustard)]/20"
              />
            </div>

            <button
              onClick={generate}
              disabled={loading}
              className="btn-mustard text-sm mt-4 w-full"
            >
              {loading ? "GENERANDO…" : "✨ GENERAR RESPUESTA"}
            </button>
          </div>

          {/* Output */}
          <div>
            <label className="block text-xs font-mono uppercase tracking-widest text-black/60 mb-1">
              Respuesta de Rocío
            </label>
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              rows={5}
              placeholder="Aquí aparecerá la respuesta lista para copiar y pegar en Google Business…"
              className="w-full border-2 border-black p-3 text-sm bg-[color:var(--cream)] focus:outline-none focus:bg-white"
            />
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <button
                onClick={copy}
                disabled={!reply}
                className="btn-mustard text-sm"
              >
                {copied ? "✓ COPIADO" : "📋 COPIAR"}
              </button>
              <button
                onClick={generate}
                disabled={loading || !review.trim()}
                className="text-xs font-mono border-2 border-black px-3 py-2 hover:bg-black hover:text-white disabled:opacity-40"
              >
                🔄 REGENERAR
              </button>
              <a
                href="https://business.google.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-bold underline ml-auto"
              >
                Abrir Google Business →
              </a>
            </div>
            <p className="text-xs text-black/60 mt-3 font-mono">
              Rocío prepara la respuesta. La publicación automática en Google estará disponible próximamente. Por ahora copias y publicas tú.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
