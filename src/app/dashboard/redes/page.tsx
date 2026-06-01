import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

type Plan = {
  red: "Instagram" | "LinkedIn" | "TikTok";
  total: number;
  posts: number;
  reels: number;
  carruseles: number;
  archivo: string;
  emoji: string;
  color: string;
  bio?: string;
};

const planes: Plan[] = [
  {
    red: "Instagram",
    total: 45, // 30 posts + 10 reels + 5 carruseles
    posts: 30,
    reels: 10,
    carruseles: 5,
    archivo: "assets/instagram/",
    emoji: "📷",
    color: "#E1306C",
    bio: "🤖 6 agentes IA para PYMES",
  },
  {
    red: "LinkedIn",
    total: 20,
    posts: 18,
    reels: 1,
    carruseles: 1,
    archivo: "assets/linkedin/",
    emoji: "💼",
    color: "#0A66C2",
    bio: "Sistema operativo de 6 agentes IA para PYMES en España",
  },
  {
    red: "TikTok",
    total: 15,
    posts: 0,
    reels: 15,
    carruseles: 0,
    archivo: "assets/tiktok/",
    emoji: "🎵",
    color: "#000000",
    bio: "Automatiza tu negocio en 24h. 6 agentes IA.",
  },
];

export default async function RedesDashboardPage() {
  const s = await getSession();
  if (!s) redirect("/login");

  const totalPublicaciones = planes.reduce((acc, p) => acc + p.total, 0);

  return (
    <div className="min-h-screen bg-[color:var(--cream)] p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div>
            <span className="inline-block bg-black text-[color:var(--mustard)] px-2 py-1 text-xs font-mono font-bold tracking-widest mb-2">
              MARTA · REDES SOCIALES
            </span>
            <h1 className="font-stencil text-4xl">Redes Sociales</h1>
            <p className="text-xs font-mono text-black/60 mt-1">
              Mes 1 — {totalPublicaciones} publicaciones planificadas en 3 redes
            </p>
          </div>
          <div className="flex gap-2 text-xs flex-wrap">
            <a href="/dashboard" className="border-2 border-black px-3 py-2 hover:bg-black hover:text-[color:var(--mustard)] font-bold uppercase tracking-widest">Dashboard</a>
            <a href="/dashboard/redes/aprobar" className="border-2 border-black bg-[color:var(--mustard)] px-3 py-2 hover:bg-black hover:text-[color:var(--mustard)] font-bold uppercase tracking-widest">✅ Aprobar pubs</a>
            <a href="/dashboard/redes/conectar" className="border-2 border-black px-3 py-2 hover:bg-black hover:text-[color:var(--mustard)] font-bold uppercase tracking-widest">🔌 Conectar APIs</a>
            <a href="/dashboard/marta" className="border-2 border-black px-3 py-2 hover:bg-black hover:text-[color:var(--mustard)] font-bold uppercase tracking-widest">Marta</a>
          </div>
        </div>

        {/* Stats globales */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <Stat label="Total publicaciones" value={totalPublicaciones} accent="#000" />
          <Stat label="Posts estáticos" value={planes.reduce((a, p) => a + p.posts, 0)} accent="#F5C518" />
          <Stat label="Reels / Vídeos" value={planes.reduce((a, p) => a + p.reels, 0)} accent="#FF7A59" />
          <Stat label="Carruseles" value={planes.reduce((a, p) => a + p.carruseles, 0)} accent="#14B8A6" />
        </div>

        {/* Plan por red */}
        <div className="grid lg:grid-cols-3 gap-4 mb-6">
          {planes.map((p) => (
            <article key={p.red} className="card-hard p-5 bg-white flex flex-col">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-3xl">{p.emoji}</span>
                <div className="flex-1">
                  <div className="font-stencil text-2xl" style={{ color: p.color }}>{p.red}</div>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-black/50">@aiteam.marketing</div>
                </div>
              </div>

              {p.bio && (
                <div className="text-xs text-black/70 italic border-l-2 border-black/20 pl-3 mb-4">
                  &quot;{p.bio}&quot;
                </div>
              )}

              <div className="grid grid-cols-3 gap-2 mb-4">
                <Mini label="Posts" value={p.posts} />
                <Mini label="Vídeos" value={p.reels} />
                <Mini label="Carrus." value={p.carruseles} />
              </div>

              <div className="text-[11px] font-mono uppercase tracking-widest text-black/60 mb-2">📁 Recursos</div>
              <code className="bg-black/5 px-2 py-1 rounded text-[10px] font-mono mb-4 break-all">{p.archivo}</code>

              <div className="mt-auto">
                {p.red === "Instagram" && (
                  <a href="/dashboard/instagram" className="block text-center border-[3px] border-black bg-[color:var(--mustard)] py-2 text-xs font-bold uppercase tracking-widest hover:bg-black hover:text-[color:var(--mustard)] transition">
                    Calendario IG →
                  </a>
                )}
                {p.red !== "Instagram" && (
                  <div className="text-center text-[10px] text-black/50 font-mono uppercase tracking-widest">
                    Calendario en archivo .md
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>

        {/* Estrategia cross-channel */}
        <div className="card-hard p-5 bg-white mb-4">
          <h2 className="font-stencil text-2xl mb-3">🎯 Estrategia cross-channel</h2>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="font-bold mb-1">📷 Instagram</div>
              <p className="text-black/70 text-xs leading-relaxed">
                Lead magnet. DMs como canal de venta directo. Personajes 80s en visual.
              </p>
            </div>
            <div>
              <div className="font-bold mb-1">💼 LinkedIn</div>
              <p className="text-black/70 text-xs leading-relaxed">
                Tickets grandes (Élite/Pro). Tono pro + opiniones polémicas. Carruseles educativos = oro.
              </p>
            </div>
            <div>
              <div className="font-bold mb-1">🎵 TikTok</div>
              <p className="text-black/70 text-xs leading-relaxed">
                Volumen orgánico. Reels de IG reutilizados con audio trending. Diversión por encima de pulido.
              </p>
            </div>
          </div>
        </div>

        {/* Hack contenido */}
        <div className="card-hard p-5 bg-[color:var(--mustard)]">
          <h2 className="font-stencil text-2xl mb-3">⚡ Hack: 1 idea = 3 piezas</h2>
          <p className="text-sm mb-3">
            Cada vídeo que grabas SIRVE para 3 redes con mínima adaptación:
          </p>
          <ul className="space-y-2 text-sm">
            <li><strong>📷 Instagram Reel</strong> — sube tal cual</li>
            <li><strong>🎵 TikTok</strong> — mismo vídeo, cambia el audio por trending TikTok</li>
            <li><strong>💼 LinkedIn</strong> — sube el vídeo + caption larga con análisis</li>
          </ul>
          <p className="text-xs mt-3 italic">
            Esto te permite producir 1 vez y publicar 3 veces. Mes 1 con 4 vídeos/semana = 12 publicaciones por red sin esfuerzo extra.
          </p>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="card-hard p-4 bg-white text-center">
      <div className="font-stencil text-4xl" style={{ color: accent }}>{value}</div>
      <div className="text-[10px] font-mono uppercase tracking-widest text-black/60 mt-1">{label}</div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center border-2 border-black p-2">
      <div className="font-stencil text-xl">{value}</div>
      <div className="text-[9px] font-mono uppercase tracking-widest text-black/50">{label}</div>
    </div>
  );
}
