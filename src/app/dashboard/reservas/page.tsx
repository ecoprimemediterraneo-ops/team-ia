// Panel del dueño — configuración de AI-Team Booking (servicios + horario).
// Auth: el layout de /dashboard ya redirige a /login si no hay sesión (en prod).
// En desarrollo local, getSessionLocal() entra con el dueño por defecto.
import { getBusinessesForTenant } from "@/lib/booking";
import { contextoPanelODefecto } from "@/lib/panel-contexto";
import ReservasPanel from "@/components/booking/ReservasPanel";

export const dynamic = "force-dynamic";

// ?negocio=<slug>&tab=informes&mes=YYYY-MM — deep link del botón del informe
// mensual por email: abre el panel ya colocado en ese negocio, esa pestaña y ese
// mes. Los tres son opcionales; sin ellos el panel arranca como siempre
// (Agenda + primer negocio + últimos 30 días).
export default async function DashboardReservasPage({
  searchParams,
}: {
  searchParams: Promise<{ negocio?: string; tab?: string; mes?: string }>;
}) {
  const sp = await searchParams;
  // Los negocios salen del TENANT del panel, no del email de la sesión. Antes se
  // resolvía por email de calendario y el panel de un cliente acababa enseñando
  // los negocios del fundador (el despacho de abogados mostraba los servicios de
  // un centro de belleza).
  const ctx = await contextoPanelODefecto();
  const negocios = await getBusinessesForTenant(ctx.tenantId);
  const v = ctx.vocabulario;
  const esLegal = ctx.perfil.id === "legal";

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-6">
        <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-black/40">AI-Team Booking</div>
        <h1 className="font-stencil text-3xl sm:text-4xl leading-none mt-1">
          {esLegal ? "Consultas y agenda" : "Reservas online"}
        </h1>
        <p className="text-sm text-black/60 mt-2">
          Configura tus {v.servicioPlural} y tu horario. Las {v.citaPlural} entran solas en tu agenda de Google.
        </p>
      </div>

      {negocios.length === 0 ? (
        <div className="card-hard bg-white p-6">
          <div className="font-bold mb-1">
            {esLegal ? "Aún no tienes materias configuradas" : "Aún no tienes reservas configuradas"}
          </div>
          <p className="text-sm text-black/60">
            {ctx.tenant?.name || ctx.tenantId} todavía no tiene {v.negocio} de {v.citaPlural} asociado.
            Contacta con AI-Team para activarlo.
          </p>
        </div>
      ) : (
        <ReservasPanel
          negocios={negocios}
          negocioInicial={sp.negocio}
          tabInicial={sp.tab}
          mesInicial={sp.mes}
          vocabulario={{
            clientePlural: v.clientePlural,
            servicioPlural: v.servicioPlural,
            citaPlural: v.citaPlural,
          }}
        />
      )}
    </div>
  );
}
