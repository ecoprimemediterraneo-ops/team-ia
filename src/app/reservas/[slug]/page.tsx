import BookingFlow from "@/components/booking/BookingFlow";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return {
    title: `Reserva tu cita online`,
    description: `Reserva tu cita en segundos. Elige servicio, día y hora. Cancelación gratis siempre.`,
    robots: { index: false }, // páginas de reserva por negocio: no indexar
    alternates: { canonical: `https://aiteam.marketing/reservas/${slug}` },
  };
}

export default async function ReservasPage({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ servicio?: string; hora?: string; profesional?: string }>;
}) {
  const { slug } = await params;
  // Desde el enlace de huecos libres llega con el servicio y la hora ya elegidos.
  const sp = await searchParams;
  return (
    <main className="min-h-screen bg-[color:var(--cream)]">
      <BookingFlow slug={slug} preServicio={sp.servicio} preHora={sp.hora} preProfesional={sp.profesional} />
    </main>
  );
}
