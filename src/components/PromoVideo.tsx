"use client";
import { useRef, useState } from "react";

export default function PromoVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);

  function toggleSound() {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
    if (!v.muted) v.play().catch(() => {});
  }

  return (
    <section className="py-20 border-y-[3px] border-black bg-black">
      <div className="max-w-5xl mx-auto px-5">
        <div className="text-center mb-8">
          <span className="inline-block bg-[color:var(--mustard)] text-black px-3 py-1 text-xs font-mono font-bold tracking-widest mb-3">
            EN 25 SEGUNDOS
          </span>
          <h2 className="font-stencil text-3xl md:text-5xl text-white">
            Así trabaja tu AI-Team
          </h2>
        </div>

        <div className="relative card-hard overflow-hidden bg-black">
          <video
            ref={videoRef}
            src="/videos/aiteam-promo.mp4"
            autoPlay
            muted
            loop
            playsInline
            className="w-full aspect-video"
          />
          <button
            onClick={toggleSound}
            aria-label={muted ? "Activar sonido" : "Silenciar"}
            className="absolute bottom-4 right-4 bg-black/80 border-2 border-[color:var(--mustard)] text-[color:var(--mustard)] px-3 py-2 text-xs font-mono font-bold tracking-widest hover:bg-[color:var(--mustard)] hover:text-black transition-colors"
          >
            {muted ? "🔇 ACTIVAR SONIDO" : "🔊 SILENCIAR"}
          </button>
        </div>
      </div>
    </section>
  );
}
