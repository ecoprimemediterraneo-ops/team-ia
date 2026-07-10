// Ruta antigua: redirige de forma permanente (308) a los términos canónicos /legal/terminos.
import { permanentRedirect } from "next/navigation";

export default function Page() {
  permanentRedirect("/legal/terminos");
}
