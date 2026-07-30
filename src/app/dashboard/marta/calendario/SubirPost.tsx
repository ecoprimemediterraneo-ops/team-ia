"use client";

// Crear un post para el calendario. Fusiona la antigua pestaña "Nuevo post" con
// "Subir un post propio":
//   · SIMPLE (visible): subir imagen + texto + "Mejorar con IA" + fecha/hora.
//   · OPCIONES AVANZADAS (plegado): tipo de publicación (post/reel/story),
//     URL de imagen o vídeo externa, tema, detalles del texto y describe la foto
//     a generar. Con esto NO se pierde nada de lo que hacía "Nuevo post".
// Todo acaba como una CalendarEntry "scheduled" (mismo store, mismo flujo de
// publicación) vía crearEntradaManualAction. La imagen subida se sube antes al
// endpoint durable /api/admin/marta-upload. "Mejorar con IA" es opcional.

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { crearEntradaManualAction, mejorarCaptionAction } from "./actions";
import { MARTA_TOPICS } from "@/lib/marta-topics";

async function redimensionarAJpeg(file: File, maxW = 1080, quality = 0.82): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const escala = Math.min(1, maxW / bitmap.width);
  const w = Math.round(bitmap.width * escala);
  const h = Math.round(bitmap.height * escala);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo procesar la imagen.");
  ctx.drawImage(bitmap, 0, 0, w, h);
  return new Promise<Blob>((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error("No se pudo convertir la imagen."))), "image/jpeg", quality),
  );
}

export default function SubirPost({
  tenantId,
  defaultFecha,
  defaultHora,
}: {
  tenantId: string;
  defaultFecha: string;
  defaultHora: string;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string>("");
  const [imageUrl, setImageUrl] = useState<string>("");
  const [caption, setCaption] = useState<string>("");
  const [fecha, setFecha] = useState<string>(defaultFecha);
  const [hora, setHora] = useState<string>(defaultHora);
  const [subiendo, setSubiendo] = useState(false);
  const [mejorando, setMejorando] = useState(false);
  const [drag, setDrag] = useState(false);
  const [msg, setMsg] = useState<{ t: "ok" | "err"; s: string } | null>(null);
  const [guardando, startGuardar] = useTransition();

  // --- Opciones avanzadas (fusión de "Nuevo post") ---
  const [avanzado, setAvanzado] = useState(false);
  const [mediaType, setMediaType] = useState<string>("IMAGE");
  const [urlExterna, setUrlExterna] = useState<string>("");
  const [tema, setTema] = useState<string>("auto");
  const [contextoTexto, setContextoTexto] = useState<string>("");
  const [fotoBrief, setFotoBrief] = useState<string>("");
  const esVideo = mediaType === "REELS" || mediaType === "STORIES_VIDEO";

  async function onFile(file: File | undefined) {
    if (!file) return;
    setMsg(null);
    if (!/^image\/(jpe?g|png|webp)$/i.test(file.type)) {
      setMsg({ t: "err", s: "Formato no válido (usa JPG, PNG o WEBP)." });
      return;
    }
    setSubiendo(true);
    setImageUrl("");
    try {
      const blob = await redimensionarAJpeg(file);
      setPreview(URL.createObjectURL(blob));
      const r = await fetch("/api/admin/marta-upload", {
        method: "POST",
        headers: { "Content-Type": "image/jpeg" },
        body: blob,
      });
      const j = (await r.json()) as { ok: boolean; url?: string; error?: string };
      if (!j.ok || !j.url) throw new Error(j.error || "No se pudo subir la imagen.");
      setImageUrl(j.url);
    } catch (e) {
      setMsg({ t: "err", s: e instanceof Error ? e.message : "Error subiendo la imagen." });
    } finally {
      setSubiendo(false);
    }
  }

  async function onMejorar() {
    if (!caption.trim()) {
      setMsg({ t: "err", s: "Escribe primero un texto para mejorar." });
      return;
    }
    setMejorando(true);
    setMsg(null);
    try {
      const res = await mejorarCaptionAction(caption, tenantId);
      if (!res.ok) setMsg({ t: "err", s: res.error });
      else {
        setCaption(res.texto); // SOLO al pulsar: sustituimos el texto por el pulido
        setMsg({ t: "ok", s: "Texto mejorado por Marta. Revísalo antes de guardar." });
      }
    } finally {
      setMejorando(false);
    }
  }

  function onGuardar() {
    setMsg(null);
    startGuardar(async () => {
      const fd = new FormData();
      fd.set("tenantId", tenantId);
      fd.set("imageUrl", imageUrl);          // imagen subida (durable) — o vacío
      fd.set("caption", caption);
      fd.set("fecha", fecha);
      fd.set("hora", hora);
      // avanzado
      fd.set("mediaType", mediaType);
      fd.set("imageUrlExterna", urlExterna);
      fd.set("tema", tema);
      fd.set("contextoTexto", contextoTexto);
      fd.set("fotoBrief", fotoBrief);
      const res = await crearEntradaManualAction(fd);
      if (!res.ok) {
        setMsg({ t: "err", s: res.error });
        return;
      }
      // Limpiamos y refrescamos para que aparezca en "Programado este mes".
      setPreview("");
      setImageUrl("");
      setCaption("");
      setUrlExterna("");
      setContextoTexto("");
      setFotoBrief("");
      if (fileRef.current) fileRef.current.value = "";
      setMsg({ t: "ok", s: "Post añadido al calendario (programado)." });
      router.refresh();
    });
  }

  const inp = "border-2 border-black px-2 py-1.5 text-sm bg-white";
  const lbl = "block text-[10px] font-mono uppercase tracking-widest text-black/50 mb-1";

  return (
    <section className="card-hard bg-white p-5 space-y-4">
      <div>
        <h2 className="font-stencil text-2xl uppercase leading-none">
          Subir un post propio{" "}
          <span className="text-[11px] font-mono lowercase tracking-widest text-black/45 align-middle">(manual)</span>
        </h2>
        <p className="text-[11px] text-black/55 mt-1">
          Tu imagen + tu texto + fecha. Queda programado igual que los de Marta y sale por el mismo canal.
          Para reels, stories, URL externa o generar con IA, abre <strong>Opciones avanzadas</strong>.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4">
        {/* Zona de subida: recuadro grande, clicable y con arrastrar-soltar */}
        <div className="space-y-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => onFile(e.target.files?.[0])}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); onFile(e.dataTransfer.files?.[0]); }}
            aria-label="Subir imagen"
            className={`card-hard w-full aspect-square grid place-items-center overflow-hidden text-center border-[3px] border-dashed transition
              ${drag ? "border-black bg-[color:var(--mustard)]" : "border-black bg-[color:var(--cream)] hover:bg-[color:var(--mustard)]/25"}`}
          >
            {preview ? (
              <span className="relative block w-full h-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt="Vista previa" className="w-full h-full object-cover" />
                <span className="absolute inset-x-0 bottom-0 bg-black/70 text-white text-[10px] font-bold uppercase tracking-widest py-1">
                  Haz clic para cambiar
                </span>
              </span>
            ) : (
              <span className="px-4">
                <span className="block text-3xl leading-none mb-2">⬆️</span>
                <span className="block text-sm font-bold leading-tight">Arrastra tu imagen<br />o haz clic para subirla</span>
                <span className="block text-[10px] text-black/45 mt-2">JPG, PNG o WEBP · o genérala en Opciones avanzadas</span>
              </span>
            )}
          </button>
          {subiendo && <p className="text-[10px] text-black/50">Subiendo…</p>}
          {imageUrl && !subiendo && <p className="text-[10px] text-green-700 font-bold">✓ Imagen lista</p>}
        </div>

        {/* Texto + fecha */}
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
              <span className="text-[11px] font-mono uppercase tracking-widest text-black/50">Texto del post</span>
              <button
                type="button"
                onClick={onMejorar}
                disabled={mejorando}
                title="Marta pule el texto y le añade hashtags"
                className="text-[10px] font-bold uppercase tracking-widest border-2 border-black px-2 py-1 hover:bg-black hover:text-[color:var(--mustard)] disabled:opacity-40"
              >
                {mejorando ? "Mejorando…" : "✨ Mejorar con IA"}
              </button>
            </div>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={5}
              placeholder="Escribe tu caption. Los hashtags en la última línea. (Vacío + Opciones avanzadas = lo genera Marta)"
              className={`w-full ${inp} resize-y`}
            />
            <p className="text-[10px] text-black/40 mt-1">
              &quot;Mejorar con IA&quot; solo cambia el texto si lo pulsas. Si no, se guarda tal cual.
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <label className="block">
              <span className="block text-[10px] font-mono uppercase tracking-widest text-black/45">Fecha</span>
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inp} />
            </label>
            <label className="block">
              <span className="block text-[10px] font-mono uppercase tracking-widest text-black/45">Hora (Madrid)</span>
              <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className={inp} />
            </label>
            <button
              type="button"
              onClick={onGuardar}
              disabled={guardando || subiendo || (!imageUrl && !avanzado)}
              className="border-[3px] border-black bg-black text-white px-4 py-2 text-sm font-bold uppercase tracking-widest hover:bg-black/80 disabled:opacity-40"
            >
              {guardando ? "Guardando…" : "Añadir al calendario"}
            </button>
          </div>
        </div>
      </div>

      {/* --- Opciones avanzadas (plegado) --- */}
      <div className="border-t-2 border-black/10 pt-3">
        <button
          type="button"
          onClick={() => setAvanzado((a) => !a)}
          aria-expanded={avanzado}
          className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-widest font-bold hover:text-[color:var(--red)]"
        >
          <span className="grid place-items-center w-5 h-5 border-2 border-black bg-[color:var(--mustard)] text-xs leading-none">{avanzado ? "–" : "+"}</span>
          Opciones avanzadas
          <span className="text-black/40 normal-case font-normal tracking-normal">(reel/story · URL externa · tema · generar con IA)</span>
        </button>

        {avanzado && (
          <div className="mt-3 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <span className={lbl}>Tipo de publicación</span>
                <select value={mediaType} onChange={(e) => setMediaType(e.target.value)} className={`w-full ${inp} font-mono`}>
                  <option value="IMAGE">📷 Post estático (imagen al feed)</option>
                  <option value="REELS">🎬 Reel (vídeo vertical 9:16, ≤ 90 s)</option>
                  <option value="STORIES_IMAGE">📸 Story · imagen (24 h)</option>
                  <option value="STORIES_VIDEO">🎞 Story · vídeo (24 h)</option>
                </select>
              </div>
              <div>
                <span className={lbl}>Tema del post</span>
                <select value={tema} onChange={(e) => setTema(e.target.value)} className={`w-full ${inp}`}>
                  {MARTA_TOPICS.map((t) => (
                    <option key={t.key} value={t.key}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <span className={lbl}>URL de imagen o vídeo externa</span>
              <input
                type="url"
                value={urlExterna}
                onChange={(e) => setUrlExterna(e.target.value)}
                placeholder="https://… .jpg/.png/.mp4 — o déjalo vacío y Marta genera la imagen"
                className={`w-full ${inp} font-mono`}
              />
              <p className="text-[10px] text-black/45 mt-1">
                {esVideo
                  ? "Reels / stories de vídeo: la URL del MP4 (9:16) es OBLIGATORIA — el vídeo no se genera."
                  : "Foto: pega una URL pública (se le aplica tu estilo) o déjalo vacío y Marta la genera con IA."}
                {" "}Si subes una imagen arriba, esa tiene prioridad.
              </p>
            </div>

            <div>
              <span className={lbl}>Detalles del texto (opcional)</span>
              <textarea
                value={contextoTexto}
                onChange={(e) => setContextoTexto(e.target.value)}
                rows={2}
                placeholder="Para el CAPTION si lo genera Marta: oferta, fechas, precio, tono…"
                className={`w-full ${inp} font-mono resize-y`}
              />
            </div>

            <div>
              <span className={lbl}>Describe la foto a generar (opcional)</span>
              <textarea
                value={fotoBrief}
                onChange={(e) => setFotoBrief(e.target.value)}
                rows={2}
                placeholder="Para la IMAGEN si la genera Marta: «una pareja joven, ambiente navideño, luces cálidas»."
                className={`w-full ${inp} font-mono resize-y`}
              />
              <p className="text-[10px] text-black/45 mt-1">Solo aplica si no subes imagen ni pegas URL (campo de arriba vacío).</p>
            </div>
          </div>
        )}
      </div>

      {msg && (
        <p className={`text-xs font-bold ${msg.t === "err" ? "text-[color:var(--red)]" : "text-green-700"}`}>{msg.s}</p>
      )}
    </section>
  );
}
