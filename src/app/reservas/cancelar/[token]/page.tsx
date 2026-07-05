import CancelFlow from "@/components/booking/CancelFlow";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cancelar cita", robots: { index: false } };

export default async function CancelarPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <main className="min-h-screen bg-[color:var(--cream)] flex items-center justify-center px-4">
      <CancelFlow token={token} />
    </main>
  );
}
