// El marco fijo de gestoría: cabecera, pestañas, selector de cliente y chat,
// montados UNA VEZ por este layout y compartidos por todas las pantallas de
// abajo (portada, vencimientos, facturas —y su extracto y su conciliación—,
// correo importante, expedientes). Solo `children` cambia al navegar entre
// ellas: es la ruta que pide la tarea, "reestructura el layout para que chat,
// cabecera, pestañas y acciones rápidas queden fuera del área que se recarga".
//
// SOLO GESTORÍA. Para cualquier otro sector este layout es transparente — ni
// pinta nada ni cambia el árbol — así que ninguna otra vertical se entera de
// que existe. Es lo que permite mover aquí dentro rutas que hoy comparten
// carpeta con todos los sectores (`/dashboard`, la portada) sin tocarles el
// comportamiento: si no eres gestoría, ves exactamente lo mismo que veías
// antes de este cambio.
//
// Por qué un grupo de rutas y no un `if` dentro de cada página: los layouts de
// Next NO se desmontan al navegar entre hermanos de la misma carpeta — es la
// garantía que hace que el chat sobreviva a cambiar de pestaña. Metiendo el
// chat en una página, por completa que fuera, se habría vuelto a desmontar en
// cuanto esa página dejara de ser la que se está mirando.

import { contextoPanelODefecto } from "@/lib/panel-contexto";
import { listarClientes } from "@/lib/gestoria-clientes";
import { listarMovimientos, listarFacturas } from "@/lib/gestoria-facturas";
import { pagosSinFacturaPorCliente } from "@/lib/gestoria-conciliacion";
import PanelGestoriaShell from "@/components/gestoria/PanelGestoriaShell";

export default async function GestoriaLayout({ children }: { children: React.ReactNode }) {
  const ctx = await contextoPanelODefecto();

  // Cualquier otro sector: transparente. La sesión y el redirect a /login ya
  // los resuelve `dashboard/layout.tsx` por encima; aquí no hace falta
  // repetirlos porque no se pinta nada propio.
  if (ctx.perfil.id !== "gestoria") return <>{children}</>;

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
