// Ruta antigua: redirige de forma permanente (308) a la política de privacidad canónica /privacy.
import { permanentRedirect } from "next/navigation";

export default function Page() {
  permanentRedirect("/privacy");
}
