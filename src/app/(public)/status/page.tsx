import StatusBoard from "@/components/StatusBoard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Estado del sistema · AI-Team",
  description: "Estado en tiempo real de los servicios que usa AI-Team.",
};

export default function StatusPage() {
  return (
    <section className="max-w-3xl mx-auto px-5 py-12">
      <div className="mb-6">
        <h1 className="font-stencil text-5xl mb-2">📡 Estado del sistema</h1>
        <p className="text-sm text-black/60">Actualizado cada 60 segundos. Si tienes problemas, mira primero aquí.</p>
      </div>
      <StatusBoard />
    </section>
  );
}
