// Panel del dueño — configuración de AI-Team Booking (servicios + horario).
// Auth: el layout de /dashboard ya redirige a /login si no hay sesión (en prod).
// En desarrollo local, getSessionLocal() entra con el dueño por defecto.
import { getBusinessesForTenant } from "@/lib/booking";
import { contextoPanelODefecto } from "@/lib/panel-contexto";
import ReservasPanel from "@/components/booking/ReservasPanel";
import BarraGestoria from "@/components/gestoria/BarraGestoria";

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
  // los negocios del fundador (la gestoría mostraba los servicios de
  // un centro de belleza).
  const ctx = await contextoPanelODefecto();
  const negocios = await getBusinessesForTenant(ctx.tenantId);
  const v = ctx.vocabulario;
  const esGestoria = ctx.perfil.id === "gestoria";

  // MISMO envoltorio que Hoy, Expedientes, Facturas y Correo importante:
  // `space-y-4` a secas. Antes esta pantalla llevaba `max-w-3xl mx-auto px-4
  // py-8`, así que se centraba y quedaba más estrecha mientras las otras cuatro
  // salían pegadas a la izquierda: al cambiar de pestaña el panel entero daba un
  // salto. El ancho y el sitio del título los pone el layout, no la pantalla.
  return (
    <div className="space-y-4">
      {/* Lo que aprieta y el cuadro de preguntar, en todas las pantallas.
          Solo en gestoría: en el resto de sectores esta pantalla es el panel de
          reservas de siempre y no tiene ni vencimientos ni chat. */}
      {esGestoria && <BarraGestoria />}
      <div>
        <div className="text-xs font-mono uppercase tracking-widest text-black/50">{ctx.tenant?.name}</div>
        {/* El título tiene que decir LO MISMO que la pestaña del menú. En Hoy pone
            "Hoy", en Facturas pone "Facturas"; aquí ponía "Consultas y agenda"
            mientras la pestaña decía CLIENTES, y no había forma de saber que era
            la misma pantalla. Lo que la pestaña no cabe explicar baja a la línea
            gris de debajo. */}
        <h1 className="font-stencil text-3xl md:text-4xl leading-none">
          {esGestoria ? "Clientes" : "Reservas online"}
        </h1>
        <p className="text-sm text-black/60 mt-1">
          {esGestoria
            ? "Consultas y agenda."
            : `Configura tus ${v.servicioPlural} y tu horario. Las ${v.citaPlural} entran solas en tu agenda de Google.`}
        </p>
      </div>

      {negocios.length === 0 ? (
        <div className="card-hard bg-white p-6">
          <div className="font-bold mb-1">
            {esGestoria ? "Todavía no tienes clientes configurados" : "Aún no tienes reservas configuradas"}
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
          esGestoria={esGestoria}
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
