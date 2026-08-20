// La agenda vive ahora en /dashboard/clientes (pestañas Agenda/Clientes/Informes/
// Servicios y horario). Esta ruta antigua redirige de forma permanente (308) para
// no dejar página muerta ni enlaces rotos.
import { permanentRedirect } from "next/navigation";

export default function DashboardAgendaRedirect(): never {
  permanentRedirect("/dashboard/clientes");
}
