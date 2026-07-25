// El calendario del mes vive ahora DENTRO del panel de Marta, en la pestaña
// "Calendario" (/dashboard/marta). Esta ruta suelta se conserva por si alguien
// tiene el enlace guardado, pero redirige al panel con esa pestaña abierta,
// para que haya una sola fuente de verdad y ninguna URL huérfana.
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function MartaCalendarioMesPage() {
  redirect("/dashboard/marta?tab=calendario");
}
