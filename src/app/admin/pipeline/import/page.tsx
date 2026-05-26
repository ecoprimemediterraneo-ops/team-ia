import { redirect } from "next/navigation";
import { getSession, isFounder } from "@/lib/auth";
import PipelineImporter from "@/components/admin/PipelineImporter";


export default async function ImportPage() {
  const s = await getSession();
  if (!s) redirect("/login");
  if (!isFounder(s.email)) {
    return <div className="p-8 text-center">🔒 Solo founder</div>;
  }

  return (
    <div className="min-h-screen bg-[color:var(--cream)] p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <a href="/admin/pipeline" className="text-xs font-mono border-2 border-black px-3 py-2 hover:bg-black hover:text-white">← VOLVER</a>
          <h1 className="font-stencil text-3xl">Importar leads CSV</h1>
        </div>

        <div className="card-hard p-5 mb-4 bg-[color:var(--mustard)]/20">
          <h2 className="font-bold mb-2">Formato esperado del CSV:</h2>
          <pre className="text-xs font-mono bg-white p-3 border-2 border-black/20 overflow-x-auto">{`Nombre Negocio,Contacto,Email,Teléfono,Ciudad,Website,Rating,Reseñas
Negocio Sonrisa,Dra. García,info@sonrisa.es,+34 952 123 456,Málaga,https://sonrisa.es,4.6,87
Dental Plus,Dr. López,contacto@dentalplus.es,+34 952 654 321,Marbella,https://dentalplus.es,4.4,142`}</pre>
          <p className="text-xs text-black/60 mt-2">
            ✓ Separador: coma, punto y coma o tab. Acepta cualquier orden — detecta columnas automáticamente.<br/>
            ✓ Sin duplicar: si el negocio ya existe (mismo email o nombre), se salta.<br/>
            ✓ Mínimo necesario: nombre del negocio. El resto es opcional.
          </p>
        </div>

        <PipelineImporter />
      </div>
    </div>
  );
}
