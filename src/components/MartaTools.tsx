"use client";
import { useState } from "react";

type Platform = "instagram" | "linkedin" | "tiktok" | "facebook";
type Format = "post" | "carrusel" | "reel" | "story";
type Tone = "cercano" | "profesional" | "divertido" | "inspirador";

const PLATFORMS: { value: Platform; label: string; emoji: string }[] = [
  { value: "instagram", label: "Instagram", emoji: "📸" },
  { value: "linkedin", label: "LinkedIn", emoji: "💼" },
  { value: "tiktok", label: "TikTok", emoji: "🎵" },
  { value: "facebook", label: "Facebook", emoji: "👥" },
];

const FORMATS: Record<Platform, { value: Format; label: string }[]> = {
  instagram: [
    { value: "post", label: "Post" },
    { value: "carrusel", label: "Carrusel" },
    { value: "reel", label: "Reel (guion)" },
    { value: "story", label: "Stories" },
  ],
  linkedin: [
    { value: "post", label: "Post" },
    { value: "carrusel", label: "Carrusel" },
  ],
  tiktok: [
    { value: "reel", label: "Vídeo (guion)" },
    { value: "post", label: "Post" },
  ],
  facebook: [
    { value: "post", label: "Post" },
    { value: "story", label: "Stories" },
  ],
};

export default function MartaTools() {
  const [platform, setPlatform] = useState<Platform>("instagram");
  const [format, setFormat] = useState<Format>("post");
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState<Tone>("cercano");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [flash, setFlash] = useState<{ ok: boolean; msg: string } | null>(null);
  const [imgStyle, setImgStyle] = useState<"foto" | "ilustracion" | "minimal" | "retro">("foto");
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [imgLoading, setImgLoading] = useState(false);

  function changePlatform(p: Platform) {
    setPlatform(p);
    if (!FORMATS[p].some((f) => f.value === format)) {
      setFormat(FORMATS[p][0].value);
    }
  }

  async function generate() {
    if (!topic.trim()) {
      setFlash({ ok: false, msg: "Escribe primero sobre qué quieres el contenido" });
      return;
    }
    setLoading(true);
    setOutput("");
    setCopied(false);
    try {
      const res = await fetch("/api/marta/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, format, topic, tone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setOutput(data.content);
    } catch (e) {
      setFlash({ ok: false, msg: e instanceof Error ? e.message : "Error" });
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function generateImage() {
    if (!topic.trim()) {
      setFlash({ ok: false, msg: "Pon un tema primero" });
      return;
    }
    setImgLoading(true);
    setImgUrl(null);
    try {
      const res = await fetch("/api/marta/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, platform, style: imgStyle }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setImgUrl(data.url);
    } catch (e) {
      setFlash({ ok: false, msg: e instanceof Error ? e.message : "Error" });
    } finally {
      setImgLoading(false);
    }
  }

  const ideas = [
    "Presenta una novedad de esta semana",
    "Comparte un consejo útil para el público",
    "Cuenta un caso de éxito sin nombres reales",
    "Detrás de cámara: cómo trabajamos",
    "Resuelve una duda frecuente del cliente",
  ];

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
          <h3 className="font-stencil text-2xl">Genera publicaciones en 1 minuto</h3>
          <p className="text-sm text-black/60 mt-1">
            Elige plataforma + formato, dile el tema, Marta te lo escribe. Tú lo copias y publicas.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-5">
          {/* Input */}
          <div>
            <label className="block text-xs font-mono uppercase tracking-widest text-black/60 mb-1">Plataforma</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
              {PLATFORMS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => changePlatform(p.value)}
                  className={`border-2 border-black px-2 py-2 text-xs font-bold tracking-widest ${platform === p.value ? "bg-black text-white" : "bg-white hover:bg-[color:var(--mustard)]/30"}`}
                >
                  {p.emoji} {p.label.toUpperCase()}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-mono uppercase tracking-widest text-black/60 mb-1">Formato</label>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value as Format)}
                  className="w-full border-2 border-black px-2 py-2 text-sm font-bold bg-white focus:outline-none focus:bg-[color:var(--mustard)]/20"
                >
                  {FORMATS[platform].map((f) => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-mono uppercase tracking-widest text-black/60 mb-1">Tono</label>
                <select
                  value={tone}
                  onChange={(e) => setTone(e.target.value as Tone)}
                  className="w-full border-2 border-black px-2 py-2 text-sm font-bold bg-white focus:outline-none focus:bg-[color:var(--mustard)]/20"
                >
                  <option value="cercano">Cercano</option>
                  <option value="profesional">Profesional</option>
                  <option value="divertido">Divertido</option>
                  <option value="inspirador">Inspirador</option>
                </select>
              </div>
            </div>

            <label className="block text-xs font-mono uppercase tracking-widest text-black/60 mb-1">Tema / idea</label>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              rows={4}
              placeholder='Ej: "Promo de blanqueamiento dental por 199€ esta semana"'
              className="w-full border-2 border-black p-3 text-sm focus:outline-none focus:bg-[color:var(--mustard)]/10"
            />

            <div className="mt-2 flex flex-wrap gap-1">
              {ideas.map((idea) => (
                <button
                  key={idea}
                  onClick={() => setTopic(idea)}
                  className="text-[10px] font-mono border border-black/40 px-2 py-0.5 hover:bg-[color:var(--mustard)]"
                >{idea}</button>
              ))}
            </div>

            <button onClick={generate} disabled={loading} className="btn-mustard text-sm mt-4 w-full">
              {loading ? "ESCRIBIENDO…" : "✨ GENERAR CONTENIDO"}
            </button>
          </div>

          {/* Output */}
          <div>
            <label className="block text-xs font-mono uppercase tracking-widest text-black/60 mb-1">
              Contenido de Marta
            </label>
            <textarea
              value={output}
              onChange={(e) => setOutput(e.target.value)}
              rows={16}
              placeholder="Aquí aparecerá el post listo para copiar y publicar…"
              className="w-full border-2 border-black p-3 text-sm bg-[color:var(--cream)] focus:outline-none focus:bg-white whitespace-pre-wrap"
            />
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <button onClick={copy} disabled={!output} className="btn-mustard text-sm">
                {copied ? "✓ COPIADO" : "📋 COPIAR"}
              </button>
              <button onClick={generate} disabled={loading || !topic.trim()} className="text-xs font-mono border-2 border-black px-3 py-2 hover:bg-black hover:text-white disabled:opacity-40">
                🔄 REGENERAR
              </button>
              <a
                href={
                  platform === "instagram" ? "https://instagram.com" :
                  platform === "linkedin" ? "https://linkedin.com" :
                  platform === "tiktok" ? "https://tiktok.com" :
                  "https://facebook.com"
                }
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-bold underline ml-auto"
              >
                Abrir {platform} →
              </a>
            </div>
            <p className="text-xs text-black/50 mt-3 font-mono">
              ★ Publicación automática vía API: en aprobación de Meta/LinkedIn. Mientras, copia/pega manual.
            </p>
          </div>
        </div>

        {/* Generador de imagen */}
        <div className="mt-6 pt-6 border-t-[3px] border-black/10">
          <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
            <div>
              <h4 className="font-stencil text-xl">🖼 Imagen para el post</h4>
              <p className="text-xs text-black/60 mt-1">Marta te genera una imagen con DALL-E lista para subir junto al texto.</p>
            </div>
            <select
              value={imgStyle}
              onChange={(e) => setImgStyle(e.target.value as typeof imgStyle)}
              className="border-2 border-black px-2 py-1 text-xs font-bold bg-white"
            >
              <option value="foto">📷 Foto realista</option>
              <option value="ilustracion">🎨 Ilustración</option>
              <option value="minimal">⚪ Minimal</option>
              <option value="retro">📼 Retro 80s</option>
            </select>
          </div>

          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <button onClick={generateImage} disabled={imgLoading || !topic.trim()} className="btn-mustard text-sm">
              {imgLoading ? "GENERANDO IMAGEN…" : "✨ GENERAR IMAGEN"}
            </button>
            <span className="text-xs text-black/50 font-mono">~10-15 segundos · Cuesta ~$0.04</span>
          </div>

          {imgLoading && (
            <div className="border-2 border-dashed border-black/30 p-12 text-center text-sm text-black/50 font-mono animate-pulse">
              Marta está pintando tu imagen…
            </div>
          )}

          {imgUrl && !imgLoading && (
            <div className="border-[3px] border-black overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imgUrl} alt="Imagen generada" className="w-full" />
              <div className="bg-black text-white p-3 flex items-center gap-2 flex-wrap">
                <a
                  href={imgUrl}
                  download="marta-post.png"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-bold tracking-widest border-2 border-white px-3 py-1.5 hover:bg-white hover:text-black"
                >
                  ⬇ DESCARGAR
                </a>
                <button
                  onClick={generateImage}
                  className="text-xs font-bold tracking-widest border-2 border-white px-3 py-1.5 hover:bg-white hover:text-black"
                >
                  🔄 OTRA VERSIÓN
                </button>
                <span className="text-[10px] font-mono text-white/60 ml-auto">
                  La URL caduca en 1h, descárgala antes
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
