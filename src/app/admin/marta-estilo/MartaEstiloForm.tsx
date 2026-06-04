"use client";

import { useActionState, useState } from "react";
import { saveStyleAction, type SaveState } from "./actions";
import {
  STYLE_PRESETS,
  AI_STYLES,
  type StylePreset,
  type AIStyle,
} from "@/lib/image-style-presets";

const initial: SaveState = { ts: 0, ok: false, message: "" };

export default function MartaEstiloForm({
  initialPreset,
  initialLogo,
  initialAI,
}: {
  initialPreset: StylePreset;
  initialLogo?: string;
  initialAI?: AIStyle;
}) {
  const [state, action, pending] = useActionState(saveStyleAction, initial);
  const [preset, setPreset] = useState<StylePreset>(initialPreset);
  const [aiStyle, setAiStyle] = useState<AIStyle | "">(initialAI || "");
  const [logoUrl, setLogoUrl] = useState<string>(initialLogo || "");

  const presetUrl = (p: StylePreset) =>
    `/admin/marta-estilo/preview?preset=${p}${logoUrl ? `&logo=${encodeURIComponent(logoUrl)}` : ""}&ts=${state.ts}`;

  const aiUrl = (a: AIStyle) =>
    `/admin/marta-estilo/preview?ai=${a}&preset=${preset}${logoUrl ? `&logo=${encodeURIComponent(logoUrl)}` : ""}&ts=${state.ts}`;

  const finalUrl = aiStyle ? aiUrl(aiStyle as AIStyle) : presetUrl(preset);

  return (
    <form action={action} className="space-y-10">
      <section>
        <div className="text-[10px] font-mono tracking-[0.25em] text-black/60 mb-3">
          1 · FILTRO DE COLOR (instantáneo, gratis)
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {STYLE_PRESETS.map((p) => {
            const selected = preset === p.id;
            return (
              <label
                key={p.id}
                className={`block cursor-pointer card-hard p-2 transition ${
                  selected ? "ring-4 ring-black bg-white" : "bg-white/70 hover:bg-white"
                }`}
              >
                <input
                  type="radio"
                  name="preset"
                  value={p.id}
                  checked={selected}
                  onChange={() => setPreset(p.id)}
                  className="sr-only"
                />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={presetUrl(p.id)}
                  alt={p.label}
                  className="w-full aspect-square object-cover bg-black/5"
                />
                <div className="mt-2">
                  <div className="font-stencil text-sm">{p.label}</div>
                  <div className="text-[10px] text-black/60">{p.description}</div>
                </div>
              </label>
            );
          })}
        </div>
      </section>

      <section>
        <div className="text-[10px] font-mono tracking-[0.25em] text-black/60 mb-3">
          2 · ESTILO IA (Gemini Nano Banana · tarda unos segundos · cuesta por foto)
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label
            className={`block cursor-pointer card-hard p-2 transition ${
              aiStyle === "" ? "ring-4 ring-black bg-white" : "bg-white/70 hover:bg-white"
            }`}
          >
            <input
              type="radio"
              name="aiStyle"
              value=""
              checked={aiStyle === ""}
              onChange={() => setAiStyle("")}
              className="sr-only"
            />
            <div className="w-full aspect-square bg-black/5 flex items-center justify-center text-black/50 text-sm font-mono">
              sin IA
            </div>
            <div className="mt-2">
              <div className="font-stencil text-sm">Sin IA</div>
              <div className="text-[10px] text-black/60">Solo filtro de color</div>
            </div>
          </label>
          {AI_STYLES.map((a) => {
            const selected = aiStyle === a.id;
            return (
              <label
                key={a.id}
                className={`block cursor-pointer card-hard p-2 transition relative ${
                  selected ? "ring-4 ring-black bg-white" : "bg-white/70 hover:bg-white"
                }`}
              >
                <input
                  type="radio"
                  name="aiStyle"
                  value={a.id}
                  checked={selected}
                  onChange={() => setAiStyle(a.id)}
                  className="sr-only"
                />
                <div className="absolute top-3 left-3 z-10 bg-yellow-300 text-black text-[9px] font-mono px-2 py-0.5 border-2 border-black">
                  IA · tarda unos seg
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={aiUrl(a.id)}
                  alt={a.label}
                  className="w-full aspect-square object-cover bg-black/5"
                  loading="lazy"
                />
                <div className="mt-2">
                  <div className="font-stencil text-sm">{a.label}</div>
                  <div className="text-[10px] text-black/60">{a.description}</div>
                </div>
              </label>
            );
          })}
        </div>
        <p className="text-[11px] text-black/55 mt-2">
          Si eliges un estilo IA, la foto pasa primero por Gemini y después por el filtro de
          color de arriba.
        </p>
      </section>

      <section className="space-y-2">
        <div className="text-[10px] font-mono tracking-[0.25em] text-black/60">
          3 · LOGO OPCIONAL (URL pública)
        </div>
        <input
          type="url"
          name="logoUrl"
          value={logoUrl}
          onChange={(e) => setLogoUrl(e.target.value)}
          placeholder="https://… (png con transparencia recomendado)"
          className="w-full bg-white border-2 border-black px-3 py-2 text-sm font-mono"
        />
        <p className="text-[11px] text-black/55">
          Se compone en la esquina inferior derecha (~15% del ancho, opacidad 0.8).
        </p>
      </section>

      <section>
        <div className="text-[10px] font-mono tracking-[0.25em] text-black/60 mb-3">
          4 · PREVIEW DE LO SELECCIONADO
        </div>
        <div className="card-hard bg-white p-3 inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={finalUrl}
            alt={`Preview ${preset}${aiStyle ? ` + ${aiStyle}` : ""}`}
            className="w-[480px] max-w-full aspect-square object-cover bg-black/5"
          />
          <div className="font-stencil text-lg mt-2">
            {aiStyle ? `${aiStyle} + ${preset}` : preset}
          </div>
        </div>
      </section>

      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="submit"
          disabled={pending}
          className="px-6 py-3 bg-black text-white font-stencil text-lg disabled:opacity-50"
        >
          {pending ? "Guardando…" : "Guardar estilo"}
        </button>
        {state.ts > 0 && (
          <span className={`text-sm font-mono ${state.ok ? "text-green-700" : "text-red-700"}`}>
            {state.message}
          </span>
        )}
      </div>

      <div className="text-[11px] font-mono text-black/50 border-2 border-dashed border-black/30 p-3 bg-yellow-50 space-y-1">
        <div>⚠ PENDIENTE: este estilo se guarda en memoria (src/lib/style-config-temp.ts).</div>
        <div>Hay que conectarlo con la ficha del tenant cuando la otra sesión termine tenants.ts.</div>
        <div>📌 Env var: <code className="bg-black/10 px-1">GEMINI_API_KEY</code> en .env.local (local) y Vercel (prod).</div>
      </div>
    </form>
  );
}
