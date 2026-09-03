"use client";

// Un destino del selector de cuenta, que se lleva puesta la pantalla en la que
// estabas.
//
// EL FALLO QUE VIENE A ARREGLAR
// -----------------------------
// Cambiar de cuenta te devolvía SIEMPRE a `/dashboard` pelado. Dos cosas se
// perdían por el camino y las dos importan para grabar el vídeo del App Review:
//
//   1. `?lang=en`. A mitad de grabación el panel volvía al castellano, y una de
//      las exigencias de Meta es que la interfaz salga en inglés de principio a
//      fin. El envío del 4 de agosto ya se rechazó una vez.
//   2. `?tab=…`. Aterrizabas en la portada en vez de en la pestaña que estabas
//      enseñando, así que había que volver a navegar hasta ella en cámara.
//
// CÓMO SE ARREGLA: el enlace se lleva la dirección actual entera —ruta y todos
// sus parámetros, no solo esos dos— en `?volver=`, y el route handler que pone
// la cookie redirige ahí en vez de a `/dashboard`.
//
// ES DE CLIENTE POR LA MISMA RAZÓN QUE EL LATERAL: el selector se pinta desde
// `layout.tsx`, y en el App Router un layout NO recibe `searchParams`. Sin esto
// no hay forma de saber desde el servidor en qué pantalla estás.
//
// Y sigue siendo un `<a>` nativo, no un `<Link>`: `ver-panel` es un route
// handler que deja una cookie y redirige, así que necesita navegación completa
// del navegador.

import { usePathname, useSearchParams } from "next/navigation";

export default function EnlaceCuenta({
  tenantId,
  className,
  ariaActual,
  children,
}: {
  /** El tenant al que se cambia, o "propio" para volver al tuyo. */
  tenantId: string;
  className?: string;
  ariaActual?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname() || "/dashboard";
  const sp = useSearchParams();
  const query = sp?.toString() ?? "";
  const aqui = query ? `${pathname}?${query}` : pathname;

  return (
    <a
      href={`/admin/ver-panel/${tenantId}?volver=${encodeURIComponent(aqui)}`}
      aria-current={ariaActual ? "true" : undefined}
      className={className}
    >
      {children}
    </a>
  );
}
