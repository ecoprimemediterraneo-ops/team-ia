"use client";

// Sección "Comparte tu enlace y llena tu agenda" (pestaña Compartir del panel del
// dueño). Reúne en un solo sitio la URL pública de reservas con copiar, botones de
// compartir (WhatsApp, bio de Instagram, ficha de Google), un texto sugerido editable
// y un QR descargable generado 100% en el cliente (librería `qrcode`, sin llamadas
// externas). Sustituye al viejo bloque "URL pública" de OwnerConfig (no duplicar).

import { useEffect, useState } from "react";

export default function CompartirEnlace({ slug, nombre }: { slug: string; nombre: string }) {
  const publicUrl =
    typeof window !== "undefined" ? `${window.location.origin}/reservas/${slug}` : `https://aiteam.marketing/reservas/${slug}`;

  const textoSugeridoDefecto = `Reserva tu cita 24h, fácil y sin llamadas: ${publicUrl}`;
  const [sugerido, setSugerido] = useState(textoSugeridoDefecto);
  const [copiado, setCopiado] = useState<string | null>(null); // clave del botón copiado
  const [qr, setQr] = useState<string>(""); // data URL PNG del QR

  // Al cambiar de negocio (slug), regenerar el texto por defecto y el QR.
  useEffect(() => {
    setSugerido(`Reserva tu cita 24h, fácil y sin llamadas: ${publicUrl}`);
  }, [publicUrl]);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const QR = (await import("qrcode")).default;
        const dataUrl = await QR.toDataURL(publicUrl, {
          width: 1024, // grande para imprimir con nitidez
          margin: 2,
          errorCorrectionLevel: "M",
          color: { dark: "#111111", light: "#ffffff" },
        });
        if (vivo) setQr(dataUrl);
      } catch {
        if (vivo) setQr("");
      }
    })();
    return () => {
      vivo = false;
    };
  }, [publicUrl]);

  function copiar(texto: string, clave: string) {
    navigator.clipboard?.writeText(texto);
    setCopiado(clave);
    setTimeout(() => setCopiado((c) => (c === clave ? null : c)), 1800);
  }

  const waHref = `https://wa.me/?text=${encodeURIComponent(`¡Reserva tu cita online aquí! ${publicUrl}`)}`;
  const okCopia = (clave: string, txt = "✓ Copiado") => (copiado === clave ? txt : null);

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div>
        <h2 className="font-stencil text-2xl sm:text-3xl uppercase leading-none">Comparte tu enlace y llena tu agenda</h2>
        <p className="text-sm text-black/60 mt-1">
          Este es tu enlace de reservas para <strong>{nombre}</strong>. Cuélgalo donde te vean tus clientas: WhatsApp,
          la bio de Instagram, tu ficha de Google o impreso en recepción.
        </p>
      </div>

      {/* URL pública + copiar + abrir */}
      <div className="card-hard bg-black text-[color:var(--cream)] p-4">
        <div className="text-[11px] font-mono uppercase tracking-widest text-white/50 mb-2">Tu enlace público de reservas</div>
        <div className="flex items-center gap-2 flex-wrap">
          <code className="text-[color:var(--mustard)] text-sm sm:text-base break-all flex-1 min-w-[180px]">{publicUrl}</code>
          <button
            onClick={() => copiar(publicUrl, "url")}
            className="text-xs font-bold border-2 border-[color:var(--mustard)] bg-[color:var(--mustard)] text-black px-3 py-1.5 hover:brightness-95 whitespace-nowrap"
          >
            {okCopia("url") || "Copiar enlace"}
          </button>
          <a
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-bold border-2 border-white/40 text-white px-3 py-1.5 hover:bg-white/10 whitespace-nowrap"
          >
            Abrir ↗
          </a>
        </div>
      </div>

      {/* Botones de compartir directo */}
      <section className="space-y-2">
        <div className="text-[11px] font-mono uppercase tracking-widest text-black/45">Compartir en un toque</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* WhatsApp */}
          <a
            href={waHref}
            target="_blank"
            rel="noreferrer"
            className="card-hard bg-[#25D366] text-black p-3 flex items-center gap-3 hover:translate-x-[2px] hover:translate-y-[2px] transition-transform"
          >
            <span className="text-2xl leading-none">💬</span>
            <span className="text-left">
              <span className="block font-bold text-sm leading-tight">WhatsApp</span>
              <span className="block text-[11px] text-black/70 leading-tight">Envíalo a tus clientas</span>
            </span>
          </a>

          {/* Instagram bio */}
          <button
            onClick={() => copiar(publicUrl, "ig")}
            className="card-hard bg-white text-black p-3 flex items-center gap-3 hover:translate-x-[2px] hover:translate-y-[2px] transition-transform text-left"
          >
            <span className="text-2xl leading-none">📸</span>
            <span>
              <span className="block font-bold text-sm leading-tight">{okCopia("ig", "✓ Copiado") || "Bio de Instagram"}</span>
              <span className="block text-[11px] text-black/60 leading-tight">Copia el enlace y pégalo en tu bio</span>
            </span>
          </button>

          {/* Ficha de Google */}
          <button
            onClick={() => copiar(publicUrl, "google")}
            className="card-hard bg-white text-black p-3 flex items-center gap-3 hover:translate-x-[2px] hover:translate-y-[2px] transition-transform text-left"
          >
            <span className="text-2xl leading-none">🗺️</span>
            <span>
              <span className="block font-bold text-sm leading-tight">{okCopia("google", "✓ Copiado") || "Ficha de Google"}</span>
              <span className="block text-[11px] text-black/60 leading-tight">Ponlo como enlace de reservas</span>
            </span>
          </button>
        </div>
      </section>

      {/* Texto sugerido editable + QR (2 columnas en desktop) */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 items-start">
        {/* Texto sugerido */}
        <section className="card-hard bg-[color:var(--cream)] p-4 space-y-2">
          <div className="text-[11px] font-mono uppercase tracking-widest text-black/45">Texto sugerido (edítalo a tu gusto)</div>
          <textarea
            value={sugerido}
            onChange={(e) => setSugerido(e.target.value)}
            rows={3}
            className="w-full border-2 border-black bg-white px-3 py-2 text-sm resize-y"
          />
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => copiar(sugerido, "texto")}
              className="text-xs font-bold border-2 border-black bg-[color:var(--mustard)] px-3 py-1.5 hover:brightness-95"
            >
              {okCopia("texto") || "Copiar texto"}
            </button>
            <button
              onClick={() => setSugerido(textoSugeridoDefecto)}
              className="text-xs font-bold border-2 border-black bg-white px-3 py-1.5 hover:bg-[color:var(--cream)]"
            >
              Restaurar
            </button>
            <span className="text-[11px] text-black/45">Pégalo en tus publicaciones, historias o mensajes.</span>
          </div>
        </section>

        {/* QR descargable */}
        <section className="card-hard bg-white p-4 flex flex-col items-center gap-3 lg:w-[240px]">
          <div className="text-[11px] font-mono uppercase tracking-widest text-black/45 self-start">Código QR</div>
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt={`QR del enlace de reservas de ${nombre}`} width={180} height={180} className="w-[180px] h-[180px] border-2 border-black" />
          ) : (
            <div className="w-[180px] h-[180px] border-2 border-black grid place-items-center text-xs text-black/40">Generando…</div>
          )}
          <a
            href={qr || undefined}
            download={`qr-reservas-${slug}.png`}
            aria-disabled={!qr}
            className={`w-full text-center text-xs font-bold border-2 border-black px-3 py-1.5 ${qr ? "bg-black text-white hover:bg-black/80" : "bg-black/20 text-white/60 pointer-events-none"}`}
          >
            ⬇ Descargar QR
          </a>
          <p className="text-[11px] text-black/50 text-center leading-tight">Imprímelo para recepción, escaparate o tarjetas.</p>
        </section>
      </div>
    </div>
  );
}
