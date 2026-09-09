"use client";

// El botón de cerrar sesión, que se lleva puesta la pantalla en la que estabas.
//
// POR QUÉ ES DE CLIENTE: se pinta desde `dashboard/layout.tsx`, y en el App
// Router un layout no recibe `searchParams` — no hay forma de saber desde el
// servidor en qué pantalla está el usuario. Es la misma razón por la que
// `EnlaceCuenta` también lo es.
//
// QUÉ ARREGLA: al cerrar sesión y volver a entrar acababas siempre en
// `/dashboard` pelado y en castellano. Grabando el vídeo del App Review de Meta
// eso obliga a rehacer toda la navegación en cámara, y el panel se ve en
// español por el camino. Ahora la dirección actual entera viaja con el envío y
// el login devuelve a ella.

import { usePathname, useSearchParams } from "next/navigation";
import { traductor, idiomaDe } from "@/lib/idioma";
import { PARAM_VOLVER } from "@/lib/volver";

export default function BotonSalir() {
  const pathname = usePathname() || "/dashboard";
  const sp = useSearchParams();
  const query = sp?.toString() ?? "";
  const aqui = query ? `${pathname}?${query}` : pathname;
  const idioma = idiomaDe(sp?.get("lang"));
  const t = traductor(idioma);

  return (
    <form action="/api/auth/logout" method="post">
      <input type="hidden" name={PARAM_VOLVER} value={aqui} />
      {/* El idioma va aparte del destino: la pantalla de login tiene que salir
          en inglés aunque se vuelva a una dirección que no lo llevara. */}
      <input type="hidden" name="lang" value={idioma} />
      <button className="text-xs uppercase tracking-widest font-bold border-2 border-black px-2 py-1 hover:bg-black hover:text-white">
        {t("lat_salir")}
      </button>
    </form>
  );
}
