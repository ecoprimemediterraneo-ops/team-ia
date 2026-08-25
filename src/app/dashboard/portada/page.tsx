// La portada vive ahora en /dashboard.
//
// Esta ruta se queda como redirección permanente y no como una segunda copia:
// existían enlaces a ella —el lateral, los botones del chat, lo que el gestor
// tuviera guardado— y romperlos para ganar limpieza sería un mal cambio. Pero
// dos pantallas de inicio con el mismo contenido acaban divergiendo, así que
// aquí ya no se pinta nada.
//
// Sin bucle: `/dashboard` PINTA la portada, no redirige a ningún sitio.

import { permanentRedirect } from "next/navigation";

export default function PortadaRedirect(): never {
  permanentRedirect("/dashboard");
}
