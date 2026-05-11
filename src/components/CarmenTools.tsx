"use client";
import { useState } from "react";

type Scenario = "saludo" | "agendar" | "cancelar" | "informacion" | "queja" | "ausencia" | "personalizado";

const SCENARIOS: { value: Scenario; label: string; emoji: string }[] = [
  { value: "saludo", label: "Saludo inicial", emoji: "👋" },
  { value: "agendar", label: "Agendar cita", emoji: "📅" },
  { value: "cancelar", label: "Cancelación", emoji: "❌" },
  { value: "informacion", label: "Pedir info", emoji: "ℹ️" },
  { value: "queja", label: "Queja", emoji: "😤" },
  { value: "ausencia", label: "Buzón de voz", emoji: "📞" },
  { value: "personalizado", label: "Otro", emoji: "✏️" },
];

export default function CarmenTools() {
  const [scenario, setScenario] = useState<Scenario>("saludo");
  const [customNote, setCustomNote] = useState("");
  const [language, setLanguage] = useState<"es" | "en">("es");
  const [script, setScript] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [flash, setFlash] = useState<{ ok: boolean; msg: string } | null>(null);
  const [voice, setVoice] = useState<"nova" | "shimmer" | "alloy" | "echo" | "fable" | "onyx">("nova");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [voiceLoading, setVoiceLoading] = useState(false);

  async function generate() {
    if (scenario === "personalizado" && !customNote.trim()) {
      setFlash({ ok: false, msg: "Describe el escenario en 'Otro'" });
      return;
    }
    setLoading(true);
    setScript("");
    setCopied(false);
    try {
      const res = await fetch("/api/carmen/script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario, customNote: customNote.trim() || undefined, language }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setScript(data.script);
    } catch (e) {
      setFlash({ ok: false, msg: e instanceof Error ? e.message : "Error" });
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(script);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function speak() {
    if (!script.trim()) {
      setFlash({ ok: false, msg: "Genera primero el guion" });
      return;
    }
    setVoiceLoading(true);
    setAudioUrl(null);
    try {
      const res = await fetch("/api/carmen/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: script, voice }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Error" }));
        throw new Error(err.error || "Error generando audio");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
    } catch (e) {
      setFlash({ ok: false, msg: e instanceof Error ? e.message : "Error" });
    } finally {
      setVoiceLoading(false);
    }
  }

  return (
    <div className="mt-8">
      {flash && (
        <div className={`mb-4 px-3 py-2 border-2 border-black text-sm font-bold ${flash.ok ? "bg-green-200" : "bg-red-200"}`}>
          {flash.ok ? "✓" : "⚠"} {flash.msg}
          <button onClick={() => setFlash(null)} className="ml-2 text-xs">×</button>
        </div>
      )}

      <div className="card-hard p-5">
        <div className="mb-4">
          <h3 className="font-stencil text-2xl">Guiones de llamada listos para usar</h3>
          <p className="text-sm text-black/60 mt-1">
            Carmen te genera el guion para cualquier escenario telefónico. Lo imprimes o lo lees al descolgar — nunca más te quedas en blanco.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-mono uppercase tracking-widest text-black/60 mb-1">Escenario</label>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {SCENARIOS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setScenario(s.value)}
                  className={`border-2 border-black px-2 py-2 text-[11px] font-bold tracking-widest text-left ${scenario === s.value ? "bg-black text-white" : "bg-white hover:bg-[color:var(--mustard)]/30"}`}
                >
                  {s.emoji} {s.label.toUpperCase()}
                </button>
              ))}
            </div>

            <label className="block text-xs font-mono uppercase tracking-widest text-black/60 mb-1">
              Nota adicional {scenario === "personalizado" ? "(obligatoria)" : "(opcional)"}
            </label>
            <textarea
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              rows={3}
              placeholder={
                scenario === "personalizado"
                  ? 'Ej: "Cliente que lleva 3 meses sin venir y queremos que vuelva"'
                  : 'Ej: "Estamos cerrados los lunes" o "Solo aceptamos efectivo"'
              }
              className="w-full border-2 border-black p-2 text-sm focus:outline-none focus:bg-[color:var(--mustard)]/10"
            />

            <div className="mt-3">
              <label className="block text-xs font-mono uppercase tracking-widest text-black/60 mb-1">Idioma</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setLanguage("es")}
                  className={`border-2 border-black px-3 py-1.5 text-xs font-bold tracking-widest ${language === "es" ? "bg-black text-white" : "bg-white"}`}
                >🇪🇸 ESPAÑOL</button>
                <button
                  onClick={() => setLanguage("en")}
                  className={`border-2 border-black px-3 py-1.5 text-xs font-bold tracking-widest ${language === "en" ? "bg-black text-white" : "bg-white"}`}
                >🇬🇧 ENGLISH</button>
              </div>
            </div>

            <button onClick={generate} disabled={loading} className="btn-mustard text-sm mt-4 w-full">
              {loading ? "GENERANDO…" : "✨ GENERAR GUION"}
            </button>
          </div>

          <div>
            <label className="block text-xs font-mono uppercase tracking-widest text-black/60 mb-1">Guion de Carmen</label>
            <textarea
              value={script}
              onChange={(e) => setScript(e.target.value)}
              rows={14}
              placeholder="Aquí aparecerá el guion estructurado para que lo uses al teléfono…"
              className="w-full border-2 border-black p-3 text-sm bg-[color:var(--cream)] focus:outline-none focus:bg-white whitespace-pre-wrap"
            />
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <button onClick={copy} disabled={!script} className="btn-mustard text-sm">
                {copied ? "✓ COPIADO" : "📋 COPIAR"}
              </button>
              <button onClick={generate} disabled={loading} className="text-xs font-mono border-2 border-black px-3 py-2 hover:bg-black hover:text-white disabled:opacity-40">
                🔄 REGENERAR
              </button>
              <button onClick={() => window.print()} disabled={!script} className="text-xs font-mono border-2 border-black px-3 py-2 hover:bg-black hover:text-white disabled:opacity-40 ml-auto">
                🖨 IMPRIMIR
              </button>
            </div>
            <p className="text-xs text-black/50 mt-3 font-mono">
              ★ Llamadas automáticas con voz IA: en alta de Vapi (de pago). Mientras, usa los guiones manualmente.
            </p>
          </div>
        </div>

        {/* Sintetizador de voz */}
        <div className="mt-6 pt-6 border-t-[3px] border-black/10">
          <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
            <div>
              <h4 className="font-stencil text-xl">🎤 Escucha cómo sonaría Carmen</h4>
              <p className="text-xs text-black/60 mt-1">Carmen lee el guion en voz alta. Útil para ensayar o como buzón de voz real.</p>
            </div>
            <select
              value={voice}
              onChange={(e) => setVoice(e.target.value as typeof voice)}
              className="border-2 border-black px-2 py-1 text-xs font-bold bg-white"
            >
              <option value="nova">Nova (mujer · cálida)</option>
              <option value="shimmer">Shimmer (mujer · suave)</option>
              <option value="alloy">Alloy (neutra)</option>
              <option value="fable">Fable (mujer · UK)</option>
              <option value="echo">Echo (hombre · grave)</option>
              <option value="onyx">Onyx (hombre · profundo)</option>
            </select>
          </div>

          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <button onClick={speak} disabled={voiceLoading || !script.trim()} className="btn-mustard text-sm">
              {voiceLoading ? "GENERANDO VOZ…" : "🔊 ESCUCHAR GUION"}
            </button>
            <span className="text-xs text-black/50 font-mono">~5 segundos · Cuesta ~$0.015 por minuto</span>
          </div>

          {audioUrl && (
            <div className="border-[3px] border-black bg-black p-3">
              <audio src={audioUrl} controls autoPlay className="w-full" />
              <a
                href={audioUrl}
                download="carmen-guion.mp3"
                className="inline-block mt-2 text-xs font-bold tracking-widest text-white border-2 border-white px-3 py-1 hover:bg-white hover:text-black"
              >
                ⬇ DESCARGAR MP3
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
