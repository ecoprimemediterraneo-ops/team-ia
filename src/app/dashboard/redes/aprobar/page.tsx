import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listar, type Publicacion } from "@/lib/redes";
import AprobarClient from "./AprobarClient";

export default async function AprobarPage() {
  const s = await getSession();
  if (!s) redirect("/login");

  const borradores = await listar({ estado: "borrador" });
  const aprobadas = await listar({ estado: "aprobada" });
  const programadas = await listar({ estado: "programada" });
  const asistidas = await listar({ estado: "asistida" });
  const publicadas = (await listar({ estado: "publicada" })).slice(-20);

  return (
    <div className="min-h-screen bg-[color:var(--cream)] p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div>
            <span className="inline-block bg-black text-[color:var(--mustard)] px-2 py-1 text-xs font-mono font-bold tracking-widest mb-2">
              DELTA-M5 · COLA DE PUBLICACIÓN
            </span>
            <h1 className="font-stencil text-4xl">Aprobar publicaciones</h1>
            <p className="text-xs font-mono text-black/60 mt-1">Marta propone · tú apruebas · el sistema publica</p>
          </div>
          <a href="/dashboard/redes" className="border-2 border-black px-3 py-2 text-xs font-bold uppercase tracking-widest hover:bg-black hover:text-[color:var(--mustard)]">
            ← Redes
          </a>
        </div>

        <AprobarClient
          borradoresIniciales={borradores}
          aprobadasIniciales={aprobadas as Publicacion[]}
          programadasIniciales={programadas as Publicacion[]}
          asistidasIniciales={asistidas as Publicacion[]}
          publicadasIniciales={publicadas as Publicacion[]}
        />
      </div>
    </div>
  );
}
