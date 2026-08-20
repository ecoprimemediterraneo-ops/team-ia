"use client";

// Un enlace del menú lateral del panel, que SABE si es el que estás mirando.
//
// POR QUÉ EXISTE: el menú era una lista de <a> pintados todos igual. Estando en
// Facturas, la tarjeta de Facturas se veía exactamente como la de Expedientes,
// así que no había forma de saber dónde estabas sin leer la URL. En un panel de
// cinco pestañas eso es perderse cada vez que vuelves.
//
// El layout es un componente de servidor y ahí no existe la ruta actual, por eso
// esta pieza es de cliente: es lo único que necesita saberlo.

import { usePathname } from "next/navigation";

/**
 * ¿Es esta la pantalla que se está mirando?
 *
 * Con prefijo, no con igualdad: `/dashboard/facturas/conciliacion` tiene que
 * dejar encendida la pestaña de Facturas. `/dashboard` a secas se compara
 * entera, o si no se encendería con todo.
 */
export function esRutaActiva(pathname: string, href: string): boolean {
  const limpio = href.split("?")[0];
  if (limpio === "/dashboard") return pathname === "/dashboard";
  return pathname === limpio || pathname.startsWith(`${limpio}/`);
}

export default function EnlaceLateral({
  href,
  emoji,
  titulo,
  subtitulo,
  fondo,
}: {
  href: string;
  emoji: string;
  titulo: string;
  subtitulo: string;
  /** Color propio de la tarjeta cuando NO está activa. */
  fondo?: string;
}) {
  const pathname = usePathname() || "";
  const activa = esRutaActiva(pathname, href);

  return (
    <a
      href={href}
      aria-current={activa ? "page" : undefined}
      className={[
        "card-hard flex items-center gap-3 p-3 mb-3 transition relative",
        // Activa: fondo negro, texto en blanco y una barra mostaza a la
        // izquierda. Tres señales a la vez y no una, porque el panel se mira de
        // reojo. Y NO se levanta al pasar por encima: ya estás en ella.
        activa
          ? "bg-black text-white border-l-[10px] border-l-[color:var(--mustard)] pl-2"
          : "hover:-translate-y-0.5",
      ].join(" ")}
      style={activa ? undefined : fondo ? { background: fondo } : undefined}
    >
      <span className="text-2xl">{emoji}</span>
      <span className="flex-1 min-w-0">
        <span className="block font-stencil text-xl leading-none">{titulo}</span>
        <span className={`block text-[10px] uppercase tracking-widest ${activa ? "text-white/70" : "text-black/70"}`}>
          {subtitulo}
        </span>
      </span>
    </a>
  );
}
