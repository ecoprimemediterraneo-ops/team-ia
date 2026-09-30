// Lo que pasa cuando una cita se cancela y el hueco queda libre: se avisa a la
// lista de espera de ese día. Vivía dentro de la ruta de la agenda; se saca aquí
// para que cancelar desde el chat del panel haga EXACTAMENTE lo mismo que
// cancelar desde el botón, sin una copia que se quede vieja.
//
// Nada de esto puede romper la cancelación: todo es best-effort y los envíos
// siguen gobernados por sus interruptores (email de la espera y
// WAITLIST_SEND_ENABLED para el WhatsApp, apagados por defecto).

import "server-only";
import { notificarEsperaSiLibre, type BookingRecord } from "./booking";
import { enviarAvisoEspera } from "./booking-email";
import { ofrecerALaLista } from "./booking-waitlist";

export async function avisarHuecoLiberado(record: BookingRecord, baseUrl: string, redirectUri: string): Promise<void> {
  try {
    await notificarEsperaSiLibre(record.slug, record.startIso.slice(0, 10), redirectUri, (entry, biz) => enviarAvisoEspera(entry, biz, baseUrl));
  } catch (e) {
    console.error("[cancelar] aviso lista de espera falló (no crítico):", e);
  }
  try {
    // A TODA la lista de ese servicio y franja, por orden; se lo queda la primera que diga sí.
    await ofrecerALaLista(record.slug, {
      startIso: record.startIso,
      serviceId: record.serviceId,
      servicioNombre: record.servicioNombre,
      empleadoId: record.empleadoId,
    }, redirectUri);
  } catch (e) {
    console.error("[cancelar] oferta lista de espera WhatsApp falló (no crítico):", e);
  }
}
