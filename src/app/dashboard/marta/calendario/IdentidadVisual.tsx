"use client";

// IDENTIDAD VISUAL (marca del negocio): colores (fondo/acento/texto) + logo, con
// preview en vivo de un post. Reutiliza el patrón de dropzone del bloque manual y
// el pipeline durable (subirLogoAction → storeImageDurable). "Sacar colores de una
// captura" es solo una AYUDA: propone colores con visión de Anthropic y el usuario
// los ajusta a mano; si falla, no rompe nada.

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { guardarMarcaAction, subirLogoAction, extraerColoresAction } from "./actions";
import { MARCA_STATE_INICIAL, type MarcaState } from "./types";

async function fileADataUrl(file: File, maxW: number, mime: "image/png" | "image/jpeg", quality?: number): Promise<string> {
  const bmp = await createImageBitmap(file);
  const escala = Math.min(1, maxW / bmp.width);
  const w = Math.round(bmp.width * escala);
  const h = Math.round(bmp.height * escala);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo procesar la imagen.");
  ctx.drawImage(bmp, 0, 0, w, h);
  return canvas.toDataURL(mime, quality);
}

export default function IdentidadVisual({
  tenantId,
  nombre,
  fondo: fondoIni,
  acento: acentoIni,
  texto: textoIni,
  logoUrl: logoIni,
  plantilla: plantillaIni,
  cta: ctaIni,
}: {
  tenantId: string;
  nombre: string;
  fondo: string;
  acento: string;
  texto: string;
  logoUrl?: string;
  plantilla: "marcada" | "suave";
  cta: string;
}) {
  const router = useRouter();
  const logoRef = useRef<HTMLInputElement>(null);
  const capturaRef = useRef<HTMLInputElement>(null);
  const [fondo, setFondo] = useState(fondoIni);
  const [acento, setAcento] = useState(acentoIni);
  const [texto, setTexto] = useState(textoIni);
  const [logoUrl, setLogoUrl] = useState<string>(logoIni || "");
  const [plantilla, setPlantilla] = useState<"marcada" | "suave">(plantillaIni);
  const [cta, setCta] = useState<string>(ctaIni);
  const [subiendoLogo, setSubiendoLogo] = useState(false);
  const [analizando, setAnalizando] = useState(false);
  const [drag, setDrag] = useState(false);
  const [msg, setMsg] = useState<{ t: "ok" | "err"; s: string } | null>(null);
  const [state, setState] = useState<MarcaState>(MARCA_STATE_INICIAL);
  const [guardando, startGuardar] = useTransition();

  async function onLogo(file: File | undefined) {
    if (!file) return;
    setMsg(null);
    if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) return setMsg({ t: "err", s: "Logo no válido (PNG, JPG o WEBP)." });
    setSubiendoLogo(true);
    try {
      // PNG para conservar transparencia; máx 400px (el logo va pequeño en la imagen).
      const dataUrl = await fileADataUrl(file, 400, "image/png");
      const res = await subirLogoAction(dataUrl);
      if (!res.ok) setMsg({ t: "err", s: res.error });
      else setLogoUrl(res.url);
    } catch (e) {
      setMsg({ t: "err", s: e instanceof Error ? e.message : "Error subiendo el logo." });
    } finally {
      setSubiendoLogo(false);
    }
  }

  async function onCaptura(file: File | undefined) {
    if (!file) return;
    setMsg(null);
    setAnalizando(true);
    try {
      const dataUrl = await fileADataUrl(file, 900, "image/jpeg", 0.72);
      const res = await extraerColoresAction(dataUrl);
      if (!res.ok) {
        setMsg({ t: "err", s: res.error });
        return;
      }
      setFondo(res.fondo);
      setAcento(res.acento);
      setTexto(res.texto);
      setMsg({ t: "ok", s: "Colores propuestos desde la captura. Ajústalos si quieres antes de guardar." });
    } finally {
      setAnalizando(false);
      if (capturaRef.current) capturaRef.current.value = "";
    }
  }

  function onGuardar() {
    setMsg(null);
    startGuardar(async () => {
      const res = await guardarMarcaAction(tenantId, { fondo, acento, texto, plantilla, cta, logoUrl: logoUrl || undefined });
      setState(res);
      if (res.variant === "ok") router.refresh();
    });
  }

  // Preview en vivo: el MISMO renderizador, con los valores actuales del formulario.
  const previewSrc =
    `/api/og/post?frase=${encodeURIComponent("Tu agenda llena sin llamadas")}` +
    `&bg=${encodeURIComponent(fondo)}&acento=${encodeURIComponent(acento)}&texto=${encodeURIComponent(texto)}` +
    `&marca=${encodeURIComponent(nombre.toUpperCase().slice(0, 22))}&handle=${encodeURIComponent(nombre.toUpperCase().slice(0, 26))}` +
    `&codename=${encodeURIComponent(nombre.toUpperCase().slice(0, 22))}` +
    `&plantilla=${plantilla}&cta=${encodeURIComponent(cta)}` +
    (logoUrl ? `&logo=${encodeURIComponent(logoUrl)}` : "") +
    `&rol=INSTAGRAM`;

  const ColorRow = ({ label, value, set }: { label: string; value: string; set: (v: string) => void }) => (
    <label className="flex items-center gap-3">
      <span className="w-24 text-sm font-bold">{label}</span>
      <input type="color" value={value} onChange={(e) => set(e.target.value)} className="w-10 h-9 border-2 border-black bg-white p-0.5 cursor-pointer" />
      <input
        type="text"
        value={value}
        onChange={(e) => set(e.target.value)}
        className="border-2 border-black px-2 py-1 text-sm bg-white w-28 font-mono uppercase"
      />
    </label>
  );

  return (
    <section className="card-hard bg-white p-5 space-y-4">
      <div>
        <h2 className="font-stencil text-2xl uppercase leading-none">
          Identidad visual{" "}
          <span className="text-[11px] font-mono lowercase tracking-widest text-black/45 align-middle">(marca del negocio)</span>
        </h2>
        <p className="text-[11px] text-black/55 mt-1">
          Colores y logo con los que Marta pinta los posts de <strong>{nombre}</strong>. Si no cambias nada, se usan los de AI-Team.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
        {/* Controles */}
        <div className="space-y-4">
          <div className="space-y-2">
            <ColorRow label="Fondo" value={fondo} set={setFondo} />
            <ColorRow label="Acento" value={acento} set={setAcento} />
            <ColorRow label="Texto" value={texto} set={setTexto} />
          </div>

          {/* Plantilla */}
          <div>
            <span className="block text-[11px] font-mono uppercase tracking-widest text-black/50 mb-1">Plantilla</span>
            <div className="flex gap-2">
              {([
                ["suave", "Suave", "Redondeada, tipo Instagram"],
                ["marcada", "Marcada", "Estilo AI-Team (barras, borde)"],
              ] as const).map(([val, label, hint]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setPlantilla(val)}
                  className={`border-[3px] border-black px-3 py-2 text-left ${plantilla === val ? "bg-black text-white" : "bg-white hover:bg-[color:var(--cream)]"}`}
                >
                  <span className="block text-sm font-bold uppercase tracking-widest">{label}</span>
                  <span className={`block text-[10px] ${plantilla === val ? "text-white/70" : "text-black/50"}`}>{hint}</span>
                </button>
              ))}
            </div>
          </div>

          {/* CTA */}
          <label className="block">
            <span className="block text-[11px] font-mono uppercase tracking-widest text-black/50 mb-1">
              Llamada a la acción (cinta inferior)
            </span>
            <input
              type="text"
              value={cta}
              onChange={(e) => setCta(e.target.value)}
              maxLength={60}
              placeholder="Ej: Reserva tu cita  ·  vacío = sin CTA"
              className="border-2 border-black px-2 py-1.5 text-sm bg-white w-full max-w-md"
            />
          </label>

          {/* Logo */}
          <div>
            <span className="block text-[11px] font-mono uppercase tracking-widest text-black/50 mb-1">Logo del negocio</span>
            <input ref={logoRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => onLogo(e.target.files?.[0])} className="hidden" />
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => logoRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => { e.preventDefault(); setDrag(false); onLogo(e.dataTransfer.files?.[0]); }}
                className={`card-hard w-28 h-28 grid place-items-center overflow-hidden text-center border-[3px] border-dashed shrink-0 transition
                  ${drag ? "border-black bg-[color:var(--mustard)]" : "border-black bg-[color:var(--cream)] hover:bg-[color:var(--mustard)]/25"}`}
              >
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
                ) : (
                  <span className="text-[10px] text-black/50 px-2 leading-tight">Arrastra o<br />haz clic<br />(PNG mejor)</span>
                )}
              </button>
              <div className="text-[11px] text-black/55 space-y-1">
                {subiendoLogo && <p>Subiendo…</p>}
                {logoUrl && !subiendoLogo && (
                  <>
                    <p className="text-green-700 font-bold">✓ Logo listo</p>
                    <button type="button" onClick={() => setLogoUrl("")} className="underline hover:text-black">Quitar logo</button>
                  </>
                )}
                {!logoUrl && !subiendoLogo && <p>Si no pones logo, sale el nombre del negocio.</p>}
              </div>
            </div>
          </div>

          {/* Sacar colores de una captura */}
          <div className="border-t-2 border-black/10 pt-3">
            <span className="block text-[11px] font-mono uppercase tracking-widest text-black/50 mb-1">
              ¿No sabes los colores? Súbelos de una captura
            </span>
            <input ref={capturaRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => onCaptura(e.target.files?.[0])} className="hidden" />
            <button
              type="button"
              onClick={() => capturaRef.current?.click()}
              disabled={analizando}
              className="text-xs font-bold uppercase tracking-widest border-2 border-black px-3 py-1.5 hover:bg-black hover:text-[color:var(--mustard)] disabled:opacity-40"
            >
              {analizando ? "Analizando captura…" : "📷 Subir captura de su Instagram"}
            </button>
            <p className="text-[10px] text-black/40 mt-1">Marta propone 3 colores; tú los ajustas. Es solo una ayuda.</p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={onGuardar}
              disabled={guardando}
              className="border-[3px] border-black bg-black text-white px-4 py-2 text-sm font-bold uppercase tracking-widest hover:bg-black/80 disabled:opacity-40"
            >
              {guardando ? "Guardando…" : "Guardar identidad"}
            </button>
            {state.ts > 0 && state.mensaje && (
              <span className={`text-xs font-bold ${state.variant === "error" ? "text-[color:var(--red)]" : "text-green-700"}`}>{state.mensaje}</span>
            )}
          </div>

          {msg && <p className={`text-xs font-bold ${msg.t === "err" ? "text-[color:var(--red)]" : "text-green-700"}`}>{msg.s}</p>}
        </div>

        {/* Preview en vivo */}
        <div>
          <span className="block text-[11px] font-mono uppercase tracking-widest text-black/50 mb-1">Vista previa</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewSrc} alt="Previsualización del post" width={320} height={320} className="w-full aspect-square border-[3px] border-black object-cover" />
          <p className="text-[10px] text-black/40 mt-1">Se actualiza al cambiar los colores o el logo.</p>
        </div>
      </div>
    </section>
  );
}
