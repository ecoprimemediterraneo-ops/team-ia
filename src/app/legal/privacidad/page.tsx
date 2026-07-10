// Página de privacidad consolidada en /privacy (versión RGPD completa, ECOPRIME MEDITERRANEO SL).
// Esta ruta antigua redirige de forma permanente (308) para no duplicar contenido.
import { permanentRedirect } from "next/navigation";

export default function Page() {
  permanentRedirect("/privacy");
}
