"use client";

// Crear un VÍDEO (Reel o historia) con una de las tres plantillas de Marta.
// Paso 1: elegir plantilla, servicio y fotos del banco → Marta escribe los
// textos y lo renderiza. Paso 2: vista previa + texto del post → el MISMO flujo
// que las imágenes: revisar en la app, WhatsApp o programarlo en el calendario.

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generarVideoAction, enviarVideoAction, type VideoPreview } from "./actions";

export type NegocioVideo = {
  slug: string;
  nombre: string;
  servicios: { id: string; nombre: string; precio?: number }[];
  fotos: string[];
};

const PLANTILLAS = [
  { id: "oferta", nombre: "Oferta", hint: "Servicio, precio y fecha límite" },
  { id: "antes_despues", nombre: "Antes y después", hint: "Cortinilla entre dos fotos" },
  { id: "hueco_libre", nombre: "Hueco libre hoy", hint: "La primera hora libre de la agenda" },
] as const;
type PlantillaId = (typeof PLANTILLAS)[number]["id"];

const lbl = "block text-[11px] font-mono uppercase tracking-widest text-black/50 mb-1";

export default function VideoNuevo({
  negocios,
  habilitado,
  usados,
  limite,
  hoy = 0,
  limiteDia = 3,
  defaultFecha,
  defaultHora,
}: {
  negocios: NegocioVideo[];
  habilitado: boolean;
  usados: number;
  limite: number;
  hoy?: number;
  limiteDia?: number;
  defaultFecha: string;
  defaultHora: string;
}) {
  const router = useRouter();
  const [slug, setSlug] = useState(negocios[0]?.slug || "");
  const negocio = useMemo(() => negocios.find((n) => n.slug === slug), [negocios, slug]);
  const [plantilla, setPlantilla] = useState<PlantillaId>("oferta");
  const [formato, setFormato] = useState<"reel" | "historia">("reel");
  const [servicioId, setServicioId] = useState("");
  const [precio, setPrecio] = useState("");
  const [hasta, setHasta] = useState("");
  const [fotos, setFotos] = useState<string[]>([]);
  const [indicaciones, setIndicaciones] = useState("");
  const [preview, setPreview] = useState<Extract<VideoPreview, { ok: true }> | null>(null);
  const [caption, setCaption] = useState("");
  const [recipient, setRecipient] = useState("");
  const [fecha, setFecha] = useState(defaultFecha);
  const [hora, setHora] = useState(defaultHora);
  const [msg, setMsg] = useState<{ ok: boolean; s: string } | null>(null);
  const [generando, startGenerar] = useTransition();
  const [enviando, startEnviar] = useTransition();
  const maxFotos = plantilla === "antes_despues" ? 2 : plantilla === "oferta" ? 3 : 2;

  function toggleFoto(u: string) {
    setFotos((f) => (f.includes(u) ? f.filter((x) => x !== u) : f.length >= maxFotos ? [...f.slice(1), u] : [...f, u]));
  }

  function generar() {
    setMsg(null);
    setPreview(null);
    startGenerar(async () => {
      const r = await generarVideoAction({
        plantilla, formato, slug: slug || undefined, servicioId: servicioId || undefined,
        precioOferta: precio ? Number(precio.replace(",", ".")) : undefined, hasta: hasta || undefined,
        fotos, indicaciones,
      });
      if (!r.ok) { setMsg({ ok: false, s: r.error }); return; }
      setPreview(r);
      setCaption(r.caption);
      router.refresh();
    });
  }

  function enviar(destino: "app" | "whatsapp" | "calendario") {
    if (!preview) return;
    setMsg(null);
    startEnviar(async () => {
      const r = await enviarVideoAction({ url: preview.url, caption, spec: preview.spec, destino, recipient, fecha, hora });
      setMsg({ ok: r.ok, s: r.mensaje });
      if (r.ok) { setPreview(null); router.refresh(); }
    });
  }

  if (!habilitado) {
    return (
      <div className="card-hard bg-white p-5 text-sm text-black/60 space-y-1">
        <p><strong>Los vídeos están apagados.</strong> Se encienden con <code>MARTA_VIDEO_ENABLED=true</code>.</p>
        <p className="text-xs">Límite previsto: {limiteDia} vídeos al día y {limite} al mes por negocio.</p>
      </div>
    );
  }

  return (
    <div className="card-hard bg-white p-5 space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-black/70 max-w-xl">
          Texto animado a ritmo de música sobre <strong>tus fotos</strong>. Nada de caras hechas con IA: Marta solo
          escribe los textos y monta el vídeo.
        </p>
        <span className="text-[10px] font-mono uppercase tracking-widest border-2 border-black px-2 py-1 font-bold">
          hoy {hoy}/{limiteDia} · mes {usados}/{limite}
        </span>
      </div>

      {negocios.length > 1 && (
        <label className="block">
          <span className={lbl}>Negocio</span>
          <select value={slug} onChange={(e) => { setSlug(e.target.value); setFotos([]); setServicioId(""); }} className="border-2 border-black px-2 py-1.5 text-sm bg-white">
            {negocios.map((n) => <option key={n.slug} value={n.slug}>{n.nombre}</option>)}
          </select>
        </label>
      )}

      <div>
        <span className={lbl}>Plantilla</span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {PLANTILLAS.map((p) => (
            <button key={p.id} type="button" onClick={() => { setPlantilla(p.id); setFotos((f) => f.slice(0, p.id === "oferta" ? 3 : 2)); }}
              className={`border-[3px] border-black px-3 py-2 text-left ${plantilla === p.id ? "bg-black text-white" : "bg-white hover:bg-[color:var(--cream)]"}`}>
              <span className="block text-sm font-bold uppercase tracking-widest">{p.nombre}</span>
              <span className={`block text-[11px] ${plantilla === p.id ? "text-white/70" : "text-black/50"}`}>{p.hint}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <span className={lbl}>Formato</span>
          <div className="flex">
            {(["reel", "historia"] as const).map((f) => (
              <button key={f} type="button" onClick={() => setFormato(f)}
                className={`border-2 border-black px-3 py-1.5 text-xs font-bold uppercase tracking-widest -ml-[2px] first:ml-0 ${formato === f ? "bg-[color:var(--mustard)]" : "bg-white"}`}>
                {f === "reel" ? "Reel" : "Historia"}
              </button>
            ))}
          </div>
        </div>
        <label>
          <span className={lbl}>Servicio</span>
          <select value={servicioId} onChange={(e) => setServicioId(e.target.value)} className="border-2 border-black px-2 py-1.5 text-sm bg-white max-w-[260px]">
            <option value="">{plantilla === "hueco_libre" ? "El primero que tenga hueco" : "Que elija Marta"}</option>
            {(negocio?.servicios || []).map((s) => <option key={s.id} value={s.id}>{s.nombre}{s.precio !== undefined ? ` · ${s.precio} €` : ""}</option>)}
          </select>
        </label>
        {plantilla === "oferta" && (
          <>
            <label>
              <span className={lbl}>Precio oferta (€)</span>
              <input value={precio} onChange={(e) => setPrecio(e.target.value)} inputMode="decimal" placeholder="19" className="border-2 border-black px-2 py-1.5 text-sm w-24" />
            </label>
            <label>
              <span className={lbl}>Válida hasta</span>
              <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="border-2 border-black px-2 py-1.5 text-sm" />
            </label>
          </>
        )}
      </div>
      {plantilla === "oferta" && (
        <p className="text-[11px] text-black/50 -mt-3">
          Sin precio se usa el de la agenda. El precio tachado solo sale si la oferta es más barata que el precio normal.
        </p>
      )}
      {plantilla === "hueco_libre" && (
        <p className="text-[11px] text-black/50 -mt-3">
          La hora sale de la agenda real en el momento de generar. Si hoy no queda hueco, no se hace el vídeo.
        </p>
      )}

      <div>
        <span className={lbl}>
          Fotos del banco {plantilla === "antes_despues" ? "(1.ª = ANTES, 2.ª = DESPUÉS)" : `(hasta ${maxFotos}; sin elegir, las elige Marta)`}
        </span>
        {negocio?.fotos.length ? (
          <div className="flex gap-2 flex-wrap">
            {negocio.fotos.map((u) => {
              const i = fotos.indexOf(u);
              return (
                <button key={u} type="button" onClick={() => toggleFoto(u)} className={`relative w-[72px] h-[128px] border-[3px] ${i >= 0 ? "border-black" : "border-black/15"} overflow-hidden`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={u} alt="" className="w-full h-full object-cover" />
                  {i >= 0 && <span className="absolute top-1 left-1 bg-black text-white text-[10px] font-bold px-1.5">{plantilla === "antes_despues" ? (i === 0 ? "ANTES" : "DESPUÉS") : i + 1}</span>}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-black/50">No hay fotos en el banco: sube la portada y la galería en la mini-web de reservas.</p>
        )}
      </div>

      <label className="block">
        <span className={lbl}>Indicaciones para Marta (opcional)</span>
        <input value={indicaciones} onChange={(e) => setIndicaciones(e.target.value)} maxLength={300} placeholder="Ej.: tono cercano, que se note que es para la vuelta al cole" className="border-2 border-black px-2 py-1.5 text-sm w-full max-w-xl" />
      </label>

      <button type="button" onClick={generar} disabled={generando} className="border-[3px] border-black bg-black text-white px-4 py-2 text-sm font-bold uppercase tracking-widest disabled:opacity-50">
        {generando ? "Montando el vídeo… (1-2 min)" : preview ? "Hacer otro" : "Generar vídeo"}
      </button>

      {preview && (
        <div className="border-t-2 border-black/10 pt-4 grid grid-cols-1 md:grid-cols-[240px_1fr] gap-5">
          <video src={preview.url} controls autoPlay muted playsInline loop className="w-[240px] aspect-[9/16] border-[3px] border-black bg-black" />
          <div className="space-y-3">
            <p className="text-[11px] font-mono text-black/50">
              {preview.duracionS.toFixed(1)} s · render {preview.renderS} s · coste ≈ {(preview.costeUSD * 100).toFixed(2)} céntimos de $
            </p>
            {preview.nota && <p className="text-xs text-[color:var(--red)]">{preview.nota}</p>}
            <label className="block">
              <span className={lbl}>Texto del post</span>
              <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={6} className="border-2 border-black px-3 py-2 text-sm w-full leading-relaxed" />
            </label>
            <div className="flex flex-wrap gap-2 items-end">
              <button type="button" disabled={enviando} onClick={() => enviar("app")} className="border-2 border-black px-3 py-1.5 text-xs font-bold uppercase tracking-widest bg-[color:var(--mustard)] disabled:opacity-50">
                Revisar en la app
              </button>
              <span className="flex items-end gap-1">
                <input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="34600111222" className="border-2 border-black px-2 py-1.5 text-xs w-32" />
                <button type="button" disabled={enviando} onClick={() => enviar("whatsapp")} className="border-2 border-black px-3 py-1.5 text-xs font-bold uppercase tracking-widest bg-[#25D366] text-white disabled:opacity-50">
                  A mi WhatsApp
                </button>
              </span>
              <span className="flex items-end gap-1">
                <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="border-2 border-black px-2 py-1.5 text-xs" />
                <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className="border-2 border-black px-2 py-1.5 text-xs" />
                <button type="button" disabled={enviando} onClick={() => enviar("calendario")} className="border-2 border-black px-3 py-1.5 text-xs font-bold uppercase tracking-widest bg-white disabled:opacity-50">
                  Programar
                </button>
              </span>
            </div>
          </div>
        </div>
      )}

      {msg && <p className={`text-sm ${msg.ok ? "text-green-700" : "text-[color:var(--red)]"} break-words`}>{msg.s}</p>}
    </div>
  );
}
