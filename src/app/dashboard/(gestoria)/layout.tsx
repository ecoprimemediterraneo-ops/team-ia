// El marco fijo de los paneles rediseñados: cabecera, pestañas y chat,
// montados UNA VEZ por este layout y compartidos por todas las pantallas de
// abajo. Solo `children` cambia al navegar entre ellas.
//
// EL NOMBRE DE LA CARPETA ES HISTÓRICO. Empezó siendo solo de gestoría — de
// ahí `(gestoria)` — y ahora también hospeda a dental. No se ha renombrado
// porque `/dashboard` (la portada) SOLO puede vivir en un sitio del disco: es
// una única URL, y de aquí sale para los cinco sectores (gestoría, dental, y
// `PanelClasico` para el resto). Si dental hubiera tenido su propio grupo de
// rutas aparte, `/dashboard` habría tenido que resolver a DOS `page.tsx`
// distintos a la vez, lo cual Next no permite. La alternativa —cada pantalla
// de dental con su propio `if` dentro de la página— habría roto la garantía
// que hace que el chat sobreviva a cambiar de pestaña: los layouts de Next NO
// se desmontan al navegar entre hermanos de la misma carpeta; una página sí.
//
// CADA SECTOR SOLO VE SU PROPIA RAMA. Gestoría sigue exactamente como estaba
// — ni una línea de su rama se ha tocado — y cualquier otro sector que no sea
// gestoría ni dental sigue sin pintar nada aquí, transparente como siempre.

import { contextoPanelODefecto } from "@/lib/panel-contexto";
import { listarClientes } from "@/lib/gestoria-clientes";
import { listarMovimientos, listarFacturas } from "@/lib/gestoria-facturas";
import { pagosSinFacturaPorCliente } from "@/lib/gestoria-conciliacion";
import PanelGestoriaShell from "@/components/gestoria/PanelGestoriaShell";
import PanelDentalShell from "@/components/dental/PanelDentalShell";

export default async function GestoriaLayout({ children }: { children: React.ReactNode }) {
  const ctx = await contextoPanelODefecto();

  if (ctx.perfil.id === "gestoria") {
    const clientes = await listarClientes(ctx.tenantId);

    // El número que lleva la pestaña de Facturas, calculado igual que antes en
    // `/dashboard`: pagos que cuadran con un albarán o un ticket, no con una
    // factura de verdad.
    const [movimientos, facturas] = await Promise.all([
      listarMovimientos(ctx.tenantId),
      listarFacturas(ctx.tenantId),
    ]);
    const pagadosSinFactura = pagosSinFacturaPorCliente(movimientos, facturas).reduce((n, g) => n + g.cuantos, 0);

    return (
      <PanelGestoriaShell
        tenantNombre={ctx.tenant?.name ?? "Gestoría"}
        tenantId={ctx.tenantId}
        clientes={clientes.map((c) => ({ id: c.id, nombre: c.nombre }))}
        pagadosSinFactura={pagadosSinFactura}
      >
        {children}
      </PanelGestoriaShell>
    );
  }

  if (ctx.perfil.id === "dental") {
    return (
      <PanelDentalShell tenantNombre={ctx.tenant?.name ?? "Clínica"} tenantId={ctx.tenantId}>
        {children}
      </PanelDentalShell>
    );
  }

  // Cualquier otro sector: transparente. La sesión y el redirect a /login ya
  // los resuelve `dashboard/layout.tsx` por encima; aquí no hace falta
  // repetirlos porque no se pinta nada propio.
  return <>{children}</>;
}
