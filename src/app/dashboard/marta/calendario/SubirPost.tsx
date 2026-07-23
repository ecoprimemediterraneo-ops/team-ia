"use client";

// Subir un post PROPIO a mano: imagen del usuario + texto + fecha/hora.
// - La imagen se redimensiona en el cliente (canvas, mismo patrón que
//   OwnerConfig) y se sube al endpoint DURABLE existente /api/admin/marta-upload,
//   que devuelve una URL pública que sigue viva semanas.
// - "Mejorar con IA" es OPCIONAL: solo al pulsarlo se reescribe el texto
//   (reutiliza generarCaption); si no, se guarda el texto tal cual.
// - Al guardar crea una CalendarEntry idéntica en forma a las de Marta
//   (status "scheduled") → el mismo bucle de publicación la recoge.

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { crearEntradaManualAction, mejorarCaptionAction } from "./actions";

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
    if (!imageUrl) return setMsg({ t: "err", s: "Sube una imagen primero." });
    if (!caption.trim()) return setMsg({ t: "err", s: "Escribe el texto del post." });
    startGuardar(async () => {
      const fd = new FormData();
      fd.set("tenantId", tenantId);
      fd.set("imageUrl", imageUrl);
      fd.set("caption", caption);
      fd.set("fecha", fecha);
      fd.set("hora", hora);
      const res = await crearEntradaManualAction(fd);
      if (!res.ok) {
        setMsg({ t: "err", s: res.error });
        return;
      }
      // Limpiamos y refrescamos para que aparezca en "Programado este mes".
      setPreview("");
      setImageUrl("");
      setCaption("");
      if (fileRef.current) fileRef.current.value = "";
      setMsg({ t: "ok", s: "Post añadido al calendario (programado)." });
      router.refresh();
    });
  }

  const inp = "border-2 border-black px-2 py-1.5 text-sm bg-white";

  return (
    <section className="card-hard bg-white p-5 space-y-4">
      <div>
        <h2 className="font-stencil text-2xl uppercase leading-none">
          Subir un post propio{" "}
          <span className="text-[11px] font-mono lowercase tracking-widest text-black/45 align-middle">(manual)</span>
        </h2>
        <p className="text-[11px] text-black/55 mt-1">
          Tu imagen + tu texto + fecha. Queda programado igual que los de Marta y sale por el mismo canal.
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
                <span className="block text-[10px] text-black/45 mt-2">JPG, PNG o WEBP</span>
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
              placeholder="Escribe tu caption. Los hashtags en la última línea."
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
              disabled={guardando || subiendo || !imageUrl}
              className="border-[3px] border-black bg-black text-white px-4 py-2 text-sm font-bold uppercase tracking-widest hover:bg-black/80 disabled:opacity-40"
            >
              {guardando ? "Guardando…" : "Añadir al calendario"}
            </button>
          </div>
        </div>
      </div>

      {msg && (
        <p className={`text-xs font-bold ${msg.t === "err" ? "text-[color:var(--red)]" : "text-green-700"}`}>{msg.s}</p>
      )}
    </section>
  );
}
