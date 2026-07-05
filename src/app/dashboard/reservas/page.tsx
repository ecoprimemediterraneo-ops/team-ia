// Panel del dueño — configuración de AI-Team Booking (servicios + horario).
// Auth: el layout de /dashboard ya redirige a /login si no hay sesión (en prod).
// En desarrollo local, getSessionLocal() entra con el dueño por defecto.
import { getSessionLocal } from "@/lib/auth";
import { getBusinessesForOwner } from "@/lib/booking";
import ReservasPanel from "@/components/booking/ReservasPanel";

export const dynamic = "force-dynamic";

export default async function DashboardReservasPage() {
  const session = await getSessionLocal();
  const email = session?.email || "";
  const negocios = email ? await getBusinessesForOwner(email) : [];

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-6">
        <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-black/40">AI-Team Booking</div>
        <h1 className="font-stencil text-3xl sm:text-4xl leading-none mt-1">Reservas online</h1>
        <p className="text-sm text-black/60 mt-2">Configura tus servicios y tu horario. Las reservas entran solas en tu agenda de Google.</p>
      </div>

      {negocios.length === 0 ? (
        <div className="card-hard bg-white p-6">
          <div className="font-bold mb-1">Aún no tienes reservas configuradas</div>
          <p className="text-sm text-black/60">Tu cuenta ({email || "sin sesión"}) todavía no tiene un negocio de reservas asociado. Contacta con AI-Team para activarlo.</p>
        </div>
      ) : (
        <ReservasPanel negocios={negocios} />
      )}
    </div>
  );
}
