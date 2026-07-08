"use client";

import { useActionState, useState } from "react";
import { publishAction } from "./actions";
import { IDLE_STATE, type PublishActionState } from "./types";

// Convierte un JPEG/PNG (u otra imagen) a JPEG optimizado para Instagram:
// lado máximo 1080px, calidad 0.9, fondo blanco (aplana transparencia de PNG).
// Todo en el navegador con canvas — sin dependencias.
async function toInstagramJpeg(file: File): Promise<Blob> {
  const dataUrl: string = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(new Error("no se pudo leer el archivo"));
    r.readAsDataURL(file);
  });
  const img: HTMLImageElement = await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error("archivo de imagen no válido"));
    i.src = dataUrl;
  });
  const MAX = 1080;
  let w = img.naturalWidth || img.width;
  let h = img.naturalHeight || img.height;
  if (w > MAX || h > MAX) {
    const s = MAX / Math.max(w, h);
    w = Math.round(w * s);
    h = Math.round(h * s);
  }
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas no disponible");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return new Promise((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error("no se pudo convertir a JPEG"))), "image/jpeg", 0.9),
  );
}

function ImagenUploader({ onUploaded }: { onUploaded: (url: string) => void }) {
  const [estado, setEstado] = useState<"idle" | "procesando" | "ok" | "error">("idle");
  const [msg, setMsg] = useState("");
  const [preview, setPreview] = useState("");

  async function handleFile(file: File) {
    setEstado("procesando");
    setMsg(`Convirtiendo "${file.name}" a JPEG 1080…`);
    try {
      const jpeg = await toInstagramJpeg(file);
      setMsg(`Subiendo (${(jpeg.size / 1024).toFixed(0)} KB)…`);
      const r = await fetch("/api/admin/marta-upload", {
        method: "POST",
        headers: { "Content-Type": "image/jpeg" },
        body: jpeg,
      });
      const j = await r.json();
      if (r.ok && j.ok) {
        onUploaded(j.url);
        setPreview(URL.createObjectURL(jpeg));
        setEstado("ok");
        setMsg(
          `Subida OK · ${(j.bytes / 1024).toFixed(0)} KB · host: ${j.host}` +
            (j.localhost ? " · ⚠ URL localhost: Meta NO la alcanza (solo para probar el flujo; en prod será pública)" : ""),
        );
      } else {
        setEstado("error");
        setMsg(j.error === "too_large" ? "La imagen pesa demasiado (máx 8 MB)." : `No se pudo subir: ${j.error || r.status}`);
      }
    } catch (e) {
      setEstado("error");
      setMsg(e instanceof Error ? e.message : "Error al convertir/subir.");
    }
  }

  return (
    <div className="border-2 border-dashed border-black p-4 bg-[color:var(--cream)]">
      <div className="text-[10px] font-mono uppercase tracking-widest text-black/60 mb-1">
        Subir imagen diseñada (JPEG/PNG) — se convierte a JPEG 1080/q90 y se hostea
      </div>
      <input
        type="file"
        accept="image/*"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        className="block w-full text-sm file:mr-3 file:border-2 file:border-black file:bg-white file:px-3 file:py-1.5 file:font-bold file:text-xs file:uppercase file:cursor-pointer"
      />
      {estado !== "idle" && (
        <p className={`text-xs mt-2 leading-snug ${estado === "error" ? "text-[color:var(--red)] font-bold" : estado === "ok" ? "text-[color:var(--olive,#5A6B3F)] font-bold" : "text-black/60"}`}>
          {estado === "procesando" ? "⏳ " : estado === "ok" ? "✓ " : "⚠ "}{msg}
        </p>
      )}
      {preview && <img src={preview} alt="" className="mt-2 max-h-40 border-2 border-black" />}
      <p className="text-[11px] text-black/50 mt-2">
        Sin re-estilizar: se publica tu diseño tal cual. Al subir, se rellena sola la «URL del media» de abajo.
      </p>
    </div>
  );
}

export default function MartaPublishForm({ enabled }: { enabled: boolean }) {
  const [state, formAction, pending] = useActionState<PublishActionState, FormData>(
    publishAction,
    IDLE_STATE,
  );
  const [mediaUrl, setMediaUrl] = useState("");

  return (
    <div className="space-y-6">
      {/* Estado del flag */}
      <div
        className={`card-hard p-4 text-sm ${
          enabled ? "bg-[color:var(--mustard)]" : "bg-white border-[3px] border-[color:var(--red)]"
        }`}
      >
        <div className="font-mono uppercase tracking-widest text-[10px] mb-1">
          MARTA_PUBLISH_ENABLED
        </div>
        <div className="font-bold">
          {enabled ? "ACTIVO — publicaciones llegarán a Instagram" : "DESACTIVADO — pondré el flag a true para publicar"}
        </div>
        {!enabled && (
          <p className="text-xs text-black/70 mt-2 leading-snug">
            Pon <code className="bg-black/5 px-1">MARTA_PUBLISH_ENABLED=true</code> en
            <code className="bg-black/5 px-1 ml-1">.env.local</code> (local) o en Vercel
            (prod) y reinicia/redeploya. Si publicas con el flag desactivado, recibirás un
            aviso pero no llegará nada a Meta.
          </p>
        )}
      </div>

      {/* Form */}
      <form action={formAction} className="card-hard bg-white p-6 space-y-4">
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-widest text-black/60 mb-1">
            Tipo de media
          </label>
          <select
            name="mediaType"
            defaultValue="IMAGE"
            className="border-2 border-black px-3 py-2 font-mono text-sm w-full"
          >
            <option value="IMAGE">Imagen (post estático)</option>
            <option value="VIDEO">Vídeo (post de feed)</option>
            <option value="REELS">Reel</option>
          </select>
        </div>

        {/* Uploader de imagen diseñada (convierte a JPEG 1080/q90 y rellena la URL) */}
        <ImagenUploader onUploaded={setMediaUrl} />

        <div>
          <label className="block text-[10px] font-mono uppercase tracking-widest text-black/60 mb-1">
            URL del media (pública)
          </label>
          <input
            type="url"
            name="mediaUrl"
            required
            value={mediaUrl}
            onChange={(e) => setMediaUrl(e.target.value)}
            placeholder="https://… .jpg / .mp4  ·  o sube una imagen arriba"
            className="border-2 border-black px-3 py-2 font-mono text-sm w-full"
          />
          <p className="text-[11px] text-black/50 mt-1">
            Debe ser accesible públicamente por Meta (no localhost, no detrás de auth).
            Para Reel: vídeo vertical 9:16, ≤ 90 s. Para imagen, usa el subidor de arriba (JPEG).
          </p>
        </div>

        <div>
          <label className="block text-[10px] font-mono uppercase tracking-widest text-black/60 mb-1">
            Cover URL (opcional, solo Reel)
          </label>
          <input
            type="url"
            name="coverUrl"
            placeholder="https://…thumbnail.jpg"
            className="border-2 border-black px-3 py-2 font-mono text-sm w-full"
          />
        </div>

        <div>
          <label className="block text-[10px] font-mono uppercase tracking-widest text-black/60 mb-1">
            Caption
          </label>
          <textarea
            name="caption"
            rows={6}
            maxLength={2200}
            placeholder="Texto del post (máx. 2200 caracteres, ≤ 30 hashtags)…"
            className="border-2 border-black px-3 py-2 font-mono text-sm w-full leading-relaxed"
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="btn-mustard text-sm px-6 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pending ? "Publicando…" : "Publicar en Instagram →"}
        </button>
      </form>

      {/* Resultado */}
      {state.variant !== "idle" && (
        <div
          className={`card-hard p-5 ${
            state.variant === "ok"
              ? "bg-[#14B8A6] text-white"
              : state.variant === "skipped"
                ? "bg-white border-[3px] border-[color:var(--mustard)]"
                : "bg-[color:var(--red)] text-white"
          }`}
        >
          <div className="font-stencil text-xl mb-1">{state.title}</div>
          {state.detail && (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{state.detail}</p>
          )}
          {state.metaCode !== undefined && (
            <p className="text-xs font-mono mt-2 opacity-80">Código Meta: #{state.metaCode}</p>
          )}
          {state.permalink && (
            <p className="text-sm mt-3">
              <a
                href={state.permalink}
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-bold"
              >
                Ver post publicado →
              </a>
            </p>
          )}
          {state.igMediaId && !state.permalink && (
            <p className="text-xs font-mono mt-2 opacity-80">igMediaId: {state.igMediaId}</p>
          )}
        </div>
      )}
    </div>
  );
}
