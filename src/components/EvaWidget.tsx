"use client";
import { useState } from "react";
import type { LeadWidget } from "@/lib/store";

export default function EvaWidget({ initial, baseUrl }: { initial: LeadWidget; baseUrl: string }) {
  const [w, setW] = useState<LeadWidget>(initial);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  const publicUrl = `${baseUrl}/lead/${w.token}`;
  const iframeSnippet = `<iframe src="${publicUrl}" width="100%" height="640" style="border:0;max-width:520px"></iframe>`;

  async function save() {
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/eva/widget", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: w.enabled,
          title: w.title,
          subtitle: w.subtitle,
          ctaLabel: w.ctaLabel,
          successMessage: w.successMessage,
          welcomeEmailEnabled: w.welcomeEmailEnabled,
          welcomeSubject: w.welcomeSubject,
          welcomeBody: w.welcomeBody,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setFeedback({ ok: true, msg: "Guardado" });
    } catch (e) {
      setFeedback({ ok: false, msg: e instanceof Error ? e.message : "Error" });
    } finally {
      setSaving(false);
    }
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text);
    setFeedback({ ok: true, msg: "Copiado al portapapeles" });
    setTimeout(() => setFeedback(null), 2500);
  }

  return (
    <div className="mt-3 card-hard p-4">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h3 className="font-stencil text-xl">Captura de leads</h3>
          <p className="text-xs text-black/60">Comparte tu URL o pégala en cualquier web. Cada lead entra solo en la lista de Eva.</p>
        </div>
        <label className="flex items-center gap-2 text-sm font-bold cursor-pointer">
          <input
            type="checkbox"
            checked={w.enabled}
            onChange={(e) => setW({ ...w, enabled: e.target.checked })}
            className="w-5 h-5"
          />
          {w.enabled ? "ACTIVO" : "PAUSADO"}
        </label>
      </div>

      {/* URL pública + iframe snippet */}
      <div className="grid sm:grid-cols-2 gap-3 mb-5">
        <div>
          <div className="text-xs font-mono uppercase tracking-widest text-black/60 mb-1">URL pública</div>
          <div className="flex gap-2">
            <input readOnly value={publicUrl} className="flex-1 border-2 border-black px-2 py-1.5 text-xs font-mono" />
            <button onClick={() => copy(publicUrl)} className="border-2 border-black px-2 text-xs font-bold hover:bg-[color:var(--mustard)]">COPIAR</button>
            <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="border-2 border-black px-2 text-xs font-bold hover:bg-[color:var(--mustard)] flex items-center">VER</a>
          </div>
        </div>
        <div>
          <div className="text-xs font-mono uppercase tracking-widest text-black/60 mb-1">Pega esto en cualquier web</div>
          <div className="flex gap-2">
            <input readOnly value={iframeSnippet} className="flex-1 border-2 border-black px-2 py-1.5 text-xs font-mono" />
            <button onClick={() => copy(iframeSnippet)} className="border-2 border-black px-2 text-xs font-bold hover:bg-[color:var(--mustard)]">COPIAR</button>
          </div>
        </div>
      </div>

      <details className="mb-4">
        <summary className="cursor-pointer text-sm font-bold uppercase tracking-widest border-b-2 border-black pb-1 mb-3">Personalizar texto del formulario</summary>
        <div className="grid sm:grid-cols-2 gap-3 mt-3">
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-bold">Título</span>
            <input value={w.title} onChange={(e) => setW({ ...w, title: e.target.value })} className="border-2 border-black px-2 py-1.5 text-sm" />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-bold">Texto del botón</span>
            <input value={w.ctaLabel} onChange={(e) => setW({ ...w, ctaLabel: e.target.value })} className="border-2 border-black px-2 py-1.5 text-sm" />
          </label>
          <label className="flex flex-col gap-1 text-xs sm:col-span-2">
            <span className="font-bold">Subtítulo</span>
            <input value={w.subtitle} onChange={(e) => setW({ ...w, subtitle: e.target.value })} className="border-2 border-black px-2 py-1.5 text-sm" />
          </label>
          <label className="flex flex-col gap-1 text-xs sm:col-span-2">
            <span className="font-bold">Mensaje tras envío</span>
            <input value={w.successMessage} onChange={(e) => setW({ ...w, successMessage: e.target.value })} className="border-2 border-black px-2 py-1.5 text-sm" />
          </label>
        </div>
      </details>

      <details>
        <summary className="cursor-pointer text-sm font-bold uppercase tracking-widest border-b-2 border-black pb-1 mb-3">Email de bienvenida automático</summary>
        <label className="flex items-center gap-2 text-sm font-bold cursor-pointer mb-3">
          <input
            type="checkbox"
            checked={w.welcomeEmailEnabled}
            onChange={(e) => setW({ ...w, welcomeEmailEnabled: e.target.checked })}
            className="w-5 h-5"
          />
          Eva manda email de bienvenida automático cuando entra un lead
        </label>
        {w.welcomeEmailEnabled && (
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-xs">
              <span className="font-bold">Asunto</span>
              <input value={w.welcomeSubject} onChange={(e) => setW({ ...w, welcomeSubject: e.target.value })} className="border-2 border-black px-2 py-1.5 text-sm" />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="font-bold">Cuerpo (texto plano, dobles saltos = párrafos)</span>
              <textarea
                rows={4}
                value={w.welcomeBody}
                onChange={(e) => setW({ ...w, welcomeBody: e.target.value })}
                className="border-2 border-black px-2 py-1.5 text-sm font-mono"
              />
            </label>
            <p className="text-[10px] text-black/50">
              Tip: pídele a Eva en el chat «redacta un correo de bienvenida con mi tono» y pega aquí su salida.
            </p>
          </div>
        )}
      </details>

      <div className="flex items-center gap-3 mt-4 flex-wrap">
        <button onClick={save} disabled={saving} className="btn-mustard text-sm">
          {saving ? "GUARDANDO…" : "GUARDAR CAMBIOS"}
        </button>
        {feedback && (
          <span className={`text-sm font-bold ${feedback.ok ? "text-green-700" : "text-[color:var(--red)]"}`}>
            {feedback.ok ? "✓" : "⚠"} {feedback.msg}
          </span>
        )}
      </div>
    </div>
  );
}
