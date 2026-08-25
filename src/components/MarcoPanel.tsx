"use client";

// El marco del panel: rejilla con menú lateral… salvo en la portada.
//
// POR QUÉ EXISTE: la portada de la gestoría es una pantalla deliberadamente
// vacía —un texto y un cuadro para escribir— y tenerla dentro de la rejilla con
// las cinco tarjetas del lateral la contradice entera. El menú que se quiere
// dejar de mirar no puede estar al lado de la pantalla que viene a sustituirlo.
//
// No se borra el lateral ni se toca ninguna otra pantalla: en la portada no se
// pinta, y en todo lo demás queda exactamente igual que antes. Es un componente
// de cliente porque el layout es de servidor y ahí no existe la ruta actual.

import { usePathname } from "next/navigation";

/**
 * Las rutas que se pintan solas, a lo ancho y sin menú.
 *
 * Está VACÍA a propósito. Aquí estaba `/dashboard/portada`: cuando la portada
 * era una ruta aparte se escondía el menú, porque tener las cinco tarjetas del
 * ERP al lado de la pantalla que venía a sustituirlas la contradecía.
 *
 * Ahora la portada ES `/dashboard` y el lateral se ha quedado en cuatro líneas
 * de texto, así que ya no estorba: al revés, es una de las dos formas de llegar
 * a las pantallas de trabajo —la otra son los accesos de abajo—. El componente
 * se mantiene porque el mecanismo sigue siendo útil el día que haga falta una
 * pantalla a pantalla completa.
 */
const SIN_LATERAL: string[] = [];

export default function MarcoPanel({
  lateral,
  children,
}: {
  lateral: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname() || "";
  const desnuda = SIN_LATERAL.some((r) => pathname === r || pathname.startsWith(`${r}/`));

  if (desnuda) {
    return <div className="max-w-7xl mx-auto px-5 py-10">{children}</div>;
  }

  return (
    // `items-start`: cada columna mide lo que mide su contenido.
    //
    // Por defecto una rejilla estira todas las columnas a la altura de la más
    // alta, así que el lateral —cuatro botones y dos desplegables cerrados— se
    // alargaba hasta el final de una pantalla de vencimientos con cien líneas y
    // dejaba un vacío enorme debajo de "Ajustes".
    <div className="max-w-7xl mx-auto grid md:grid-cols-[260px_1fr] items-start gap-6 px-5 py-6">
      {lateral}
      <div>{children}</div>
    </div>
  );
}
