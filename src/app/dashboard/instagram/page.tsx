import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

type Post = {
  n: number;
  semana: number;
  dia: string;
  pilar: "DOLOR" | "EDUCATIVO" | "PRODUCTO" | "DETRÁS";
  formato: "Post" | "Reel" | "Carrusel";
  personaje: string;
  titulo: string;
  estado: "pendiente" | "generado" | "programado" | "publicado";
};

const calendario: Post[] = [
  // Semana 1
  { n: 1, semana: 1, dia: "Lun", pilar: "DOLOR", formato: "Post", personaje: "Diana", titulo: "67% llamadas perdidas", estado: "pendiente" },
  { n: 2, semana: 1, dia: "Mar", pilar: "EDUCATIVO", formato: "Reel", personaje: "Pablo", titulo: "WhatsApp un sábado 23:00", estado: "pendiente" },
  { n: 3, semana: 1, dia: "Mié", pilar: "EDUCATIVO", formato: "Carrusel", personaje: "Diana", titulo: "Las 7 áreas que pierden dinero", estado: "pendiente" },
  { n: 4, semana: 1, dia: "Jue", pilar: "PRODUCTO", formato: "Post", personaje: "Rocío", titulo: "Antes vs después reseñas", estado: "pendiente" },
  { n: 5, semana: 1, dia: "Vie", pilar: "PRODUCTO", formato: "Reel", personaje: "Marta", titulo: "Instagram que se publica solo", estado: "pendiente" },
  { n: 6, semana: 1, dia: "Sáb", pilar: "DETRÁS", formato: "Post", personaje: "Equipo", titulo: "Bienvenida Diana", estado: "pendiente" },
  // Semana 2
  { n: 7, semana: 2, dia: "Lun", pilar: "DOLOR", formato: "Post", personaje: "Pablo", titulo: "23:47 un sábado", estado: "pendiente" },
  { n: 8, semana: 2, dia: "Mar", pilar: "EDUCATIVO", formato: "Reel", personaje: "Carmen", titulo: "Llamada perdida más cara", estado: "pendiente" },
  { n: 9, semana: 2, dia: "Mié", pilar: "EDUCATIVO", formato: "Carrusel", personaje: "Sergio", titulo: "Cómo Sergio analiza competencia", estado: "pendiente" },
  { n: 10, semana: 2, dia: "Jue", pilar: "PRODUCTO", formato: "Post", personaje: "Eva", titulo: "Caso piloto recuperando ingresos", estado: "pendiente" },
  { n: 11, semana: 2, dia: "Vie", pilar: "PRODUCTO", formato: "Reel", personaje: "Marta", titulo: "Calendario editorial visual", estado: "pendiente" },
  { n: 12, semana: 2, dia: "Sáb", pilar: "DETRÁS", formato: "Post", personaje: "Fundador", titulo: "Por qué montamos AI-Team", estado: "pendiente" },
  // Semana 3
  { n: 13, semana: 3, dia: "Lun", pilar: "DOLOR", formato: "Post", personaje: "Sergio", titulo: "Tu competidor de la misma calle", estado: "pendiente" },
  { n: 14, semana: 3, dia: "Mar", pilar: "EDUCATIVO", formato: "Reel", personaje: "Diana", titulo: "Diagnóstico en 2 min", estado: "pendiente" },
  { n: 15, semana: 3, dia: "Mié", pilar: "EDUCATIVO", formato: "Carrusel", personaje: "Lucía", titulo: "47 emails en 30 seg", estado: "pendiente" },
  { n: 16, semana: 3, dia: "Jue", pilar: "PRODUCTO", formato: "Post", personaje: "Carmen", titulo: "Llamada cerrada 8:47 AM", estado: "pendiente" },
  { n: 17, semana: 3, dia: "Vie", pilar: "PRODUCTO", formato: "Reel", personaje: "Marta", titulo: "Antes/después IG", estado: "pendiente" },
  { n: 18, semana: 3, dia: "Sáb", pilar: "DETRÁS", formato: "Post", personaje: "Equipo", titulo: "Detrás de cada post de Marta", estado: "pendiente" },
  // Semana 4
  { n: 19, semana: 4, dia: "Lun", pilar: "DOLOR", formato: "Post", personaje: "Lucía", titulo: "47 emails un lunes", estado: "pendiente" },
  { n: 20, semana: 4, dia: "Mar", pilar: "EDUCATIVO", formato: "Reel", personaje: "Pablo", titulo: "24/7 comparativa", estado: "pendiente" },
  { n: 21, semana: 4, dia: "Mié", pilar: "EDUCATIVO", formato: "Carrusel", personaje: "Eva", titulo: "SPF DKIM DMARC explicado", estado: "pendiente" },
  { n: 22, semana: 4, dia: "Jue", pilar: "PRODUCTO", formato: "Post", personaje: "Diana", titulo: "Auditoría paciente cero", estado: "pendiente" },
  { n: 23, semana: 4, dia: "Vie", pilar: "PRODUCTO", formato: "Reel", personaje: "Marta", titulo: "Antes/después IG cliente", estado: "pendiente" },
  { n: 24, semana: 4, dia: "Sáb", pilar: "DETRÁS", formato: "Post", personaje: "Equipo", titulo: "Por qué los agentes son 80s", estado: "pendiente" },
  // Semana 5 extras
  { n: 25, semana: 5, dia: "Lun", pilar: "DOLOR", formato: "Post", personaje: "Marta", titulo: "IG abandonado 18 días", estado: "pendiente" },
  { n: 26, semana: 5, dia: "Mar", pilar: "EDUCATIVO", formato: "Post", personaje: "Sergio", titulo: "3 datos competencia", estado: "pendiente" },
  { n: 27, semana: 5, dia: "Mié", pilar: "PRODUCTO", formato: "Post", personaje: "Equipo", titulo: "Plan Completo explicado", estado: "pendiente" },
  { n: 28, semana: 5, dia: "Jue", pilar: "DOLOR", formato: "Post", personaje: "Diana", titulo: "1.500-4.200€ perdidos/mes", estado: "pendiente" },
  { n: 29, semana: 5, dia: "Vie", pilar: "DETRÁS", formato: "Post", personaje: "Equipo", titulo: "Cómo entras en AI-Team", estado: "pendiente" },
  { n: 30, semana: 5, dia: "Sáb", pilar: "DETRÁS", formato: "Post", personaje: "Equipo", titulo: "Mes 1 recap", estado: "pendiente" },
];

const pilarColor: Record<Post["pilar"], string> = {
  DOLOR: "#D32F2F",
  EDUCATIVO: "#F5C518",
  PRODUCTO: "#14B8A6",
  DETRÁS: "#9CA3AF",
};

const formatoIcon: Record<Post["formato"], string> = {
  Post: "📷",
  Reel: "🎬",
  Carrusel: "📚",
};

export default async function InstagramDashboardPage() {
  const s = await getSession();
  if (!s) redirect("/login");

  const stats = {
    total: calendario.length,
    posts: calendario.filter((c) => c.formato === "Post").length,
    reels: calendario.filter((c) => c.formato === "Reel").length,
    carruseles: calendario.filter((c) => c.formato === "Carrusel").length,
    pendientes: calendario.filter((c) => c.estado === "pendiente").length,
    publicados: calendario.filter((c) => c.estado === "publicado").length,
  };

  const semanas = [1, 2, 3, 4, 5];

  return (
    <div className="min-h-screen bg-[color:var(--cream)] p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div>
            <span className="inline-block bg-black text-[color:var(--mustard)] px-2 py-1 text-xs font-mono font-bold tracking-widest mb-2">
              MARTA · IG @aiteam.marketing
            </span>
            <h1 className="font-stencil text-4xl">Calendario Instagram</h1>
            <p className="text-xs font-mono text-black/60 mt-1">Mes 1 — 30 publicaciones planificadas</p>
          </div>
          <div className="flex gap-2 text-xs">
            <a href="/dashboard" className="border-2 border-black px-3 py-2 hover:bg-black hover:text-[color:var(--mustard)] font-bold uppercase tracking-widest">Dashboard</a>
            <a href="/dashboard/marta" className="border-2 border-black px-3 py-2 hover:bg-black hover:text-[color:var(--mustard)] font-bold uppercase tracking-widest">Marta</a>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-6">
          <Stat label="Total" value={stats.total} accent="#000" />
          <Stat label="Posts" value={stats.posts} accent="#F5C518" />
          <Stat label="Reels" value={stats.reels} accent="#FF7A59" />
          <Stat label="Carruseles" value={stats.carruseles} accent="#14B8A6" />
          <Stat label="Pendientes" value={stats.pendientes} accent="#D32F2F" />
          <Stat label="Publicados" value={stats.publicados} accent="#22C55E" />
        </div>

        {/* Calendario por semanas */}
        {semanas.map((sem) => {
          const items = calendario.filter((c) => c.semana === sem);
          return (
            <div key={sem} className="card-hard p-5 bg-white mb-4">
              <h2 className="font-stencil text-2xl mb-3">Semana {sem}</h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {items.map((p) => (
                  <div key={p.n} className="border-2 border-black p-3 bg-[color:var(--cream)]/40">
                    <div className="flex items-center gap-2 mb-2 text-[10px] font-mono uppercase tracking-widest">
                      <span className="bg-black text-white px-1.5 py-0.5">#{String(p.n).padStart(2, "0")}</span>
                      <span className="text-black/60">{p.dia}</span>
                      <span className="ml-auto" style={{ color: pilarColor[p.pilar] }}>● {p.pilar}</span>
                    </div>
                    <div className="flex items-start gap-2 mb-2">
                      <span className="text-2xl">{formatoIcon[p.formato]}</span>
                      <div className="flex-1">
                        <div className="font-bold text-sm leading-tight">{p.titulo}</div>
                        <div className="text-xs text-black/60">{p.personaje}</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-mono">
                      <span className={`px-2 py-0.5 ${p.estado === "publicado" ? "bg-green-100 text-green-800" : p.estado === "pendiente" ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800"}`}>
                        {p.estado.toUpperCase()}
                      </span>
                      <span className="text-black/40">{p.formato}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {/* Recursos */}
        <div className="card-hard p-5 bg-white mt-6">
          <h2 className="font-stencil text-2xl mb-3">📁 Recursos</h2>
          <ul className="space-y-2 text-sm">
            <li><code className="bg-black/5 px-2 py-1 rounded font-mono text-xs">assets/instagram/estrategia.md</code> — Estrategia + tono + KPIs</li>
            <li><code className="bg-black/5 px-2 py-1 rounded font-mono text-xs">assets/instagram/posts.md</code> — 30 posts con captions + prompts</li>
            <li><code className="bg-black/5 px-2 py-1 rounded font-mono text-xs">assets/instagram/reels.md</code> — 10 reels con guion</li>
            <li><code className="bg-black/5 px-2 py-1 rounded font-mono text-xs">assets/instagram/carruseles.md</code> — 5 carruseles educativos</li>
            <li><code className="bg-black/5 px-2 py-1 rounded font-mono text-xs">assets/instagram/bio-highlights.md</code> — Bio + 6 highlights</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="card-hard p-3 bg-white text-center">
      <div className="font-stencil text-3xl" style={{ color: accent }}>{value}</div>
      <div className="text-[10px] font-mono uppercase tracking-widest text-black/60 mt-1">{label}</div>
    </div>
  );
}
