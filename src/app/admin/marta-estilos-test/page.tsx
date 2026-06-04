// Comparador visual de los 6 estilos disponibles para Marta.
// Aplica cada estilo (4 presets sharp + 2 IA Gemini) a una imagen base y
// los muestra en grid. Si un estilo IA falla (cuota, sin API key, etc.),
// la celda muestra el error y el resto sigue funcionando.

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

const FOUNDER_EMAIL = process.env.FOUNDER_EMAIL || "ecoprimemediterraneo@gmail.com";

export const dynamic = "force-dynamic";

type Tile = {
  id: string;
  label: string;
  kind: "preset" | "ai";
  description: string;
};

const TILES: Tile[] = [
  { id: "natural", label: "Natural", kind: "preset", description: "Foto tal cual, sin ajustes" },
  { id: "calido", label: "Cálido", kind: "preset", description: "Tonos cálidos, brillo suave" },
  { id: "vivido", label: "Vívido", kind: "preset", description: "Saturación y contraste altos" },
  { id: "luminoso", label: "Luminoso", kind: "preset", description: "Aireado, premium, claros" },
  { id: "comic", label: "Cómic (IA)", kind: "ai", description: "Ilustración moderna · Nano Banana" },
  { id: "editorial", label: "Editorial (IA)", kind: "ai", description: "Revista premium · Nano Banana" },
];

export default async function MartaEstilosTestPage() {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.email !== FOUNDER_EMAIL && s.email !== "crisasky@gmail.com") redirect("/admin");

  // Cache buster para forzar regeneración con un click.
  const cb = Date.now();

  return (
    <main className="min-h-screen bg-[color:var(--cream)] py-10 px-5">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-3 text-xs">
          <a href="/admin" className="font-mono uppercase tracking-widest text-black/60 hover:text-black underline">
            ← Admin
          </a>
          <span className="text-black/30">·</span>
          <span className="font-mono uppercase tracking-widest text-black/40">
            Marta · prueba de estilos
          </span>
        </div>

        <header>
          <div className="text-[10px] font-mono tracking-[0.25em] text-black/60 mb-2">
            MARTA · BLOQUE 4.5
          </div>
          <h1 className="font-stencil text-3xl md:text-5xl leading-tight">
            Comparador de estilos
          </h1>
          <p className="text-sm text-black/60 mt-3 max-w-2xl">
            Aplica cada uno de los 6 estilos a la misma imagen base y muéstralos juntos
            para elegir el de cada cliente. Los 4 presets sharp son instantáneos. Los 2
            estilos IA (Nano Banana) llaman a Gemini y tardan unos segundos por imagen.
            Si Gemini falla, la celda muestra el error sin romper las demás.
          </p>
        </header>

        <form className="card-hard bg-white p-4 flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-[10px] font-mono uppercase tracking-widest text-black/55 mb-1">
              Base URL (opcional)
            </label>
            <input
              type="url"
              name="base"
              placeholder="https://… (deja en blanco para usar la default)"
              className="border-2 border-black px-3 py-2 text-sm w-full font-mono"
            />
          </div>
          <button type="submit" formAction="?regen=1" className="btn-mustard text-sm px-4 py-2">
            Regenerar todo
          </button>
        </form>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
          {TILES.map((t) => (
            <article key={t.id} className="card-hard bg-white overflow-hidden">
              <div className="aspect-square bg-black/5 border-b-2 border-black/15 relative">
                {/* Si la API devuelve JSON de error, el <img> no carga y mostramos el alt.
                    Para distinguir, hacemos un <object> con fallback de fetch detrás (más
                    complejo). De momento basta: tile con cruz y el id si falla. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/admin/estilos-test?style=${t.id}&cb=${cb}`}
                  alt={t.label}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              </div>
              <div className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 ${
                      t.kind === "ai"
                        ? "bg-[color:var(--red)] text-white"
                        : "bg-[color:var(--mustard)] text-black"
                    }`}
                  >
                    {t.kind === "ai" ? "IA" : "SHARP"}
                  </span>
                  <span className="font-stencil text-lg">{t.label}</span>
                </div>
                <p className="text-xs text-black/55 leading-snug">{t.description}</p>
                <p className="text-[10px] font-mono text-black/40 mt-2">id: {t.id}</p>
              </div>
            </article>
          ))}
        </div>

        <div className="card-hard bg-white p-4 text-xs text-black/70 leading-relaxed">
          <p className="font-bold mb-1">Cómo verificar resultados:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Si una celda IA aparece rota (icono X) o vacía: abre la URL del &lt;img&gt; en otra pestaña; verás el JSON con el motivo (no_api_key / api_error con código Gemini / timeout / no_image).</li>
            <li>Para cambiar la imagen base por defecto, define <code className="bg-black/5 px-1">ESTILOS_TEST_BASE_URL</code> en .env.local.</li>
            <li>Los presets sharp deberían cargar &lt; 1 s. Los IA tardan 5-20 s.</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
