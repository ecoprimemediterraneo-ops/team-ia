// Qué se le dice a quien pidió una cita cuando no se ha podido crear. Una sola
// redacción para el chat de dental y el de estética. Nunca sale texto técnico
// (tokens, invalid_grant…): lo lee un dueño de clínica, no un programador.

type Fallo =
  | { ok: false; reason: "slot_taken"; suggested?: string; motivo?: "fuera_de_horario" | "pasado" | "ocupado" | "no_calendar" }
  | { ok: false; reason: "locked" }
  | { ok: false; reason: "error"; detail: string };

const horaDe = (iso?: string) => (iso ? iso.slice(11, 16) : "");

export function textoFalloReserva(res: Fallo): string {
  if (res.reason === "locked") {
    return "Justo ahora se estaba reservando ese mismo hueco. Vuelve a intentarlo en unos segundos.";
  }
  if (res.reason === "slot_taken") {
    const otra = res.suggested ? ` El siguiente hueco libre es a las ${horaDe(res.suggested)}.` : " Prueba con otra hora.";
    switch (res.motivo) {
      case "fuera_de_horario":
        return "Esa hora cae fuera del horario de la clínica, no se ha creado la cita." + otra;
      case "pasado":
        return "Esa hora ya ha pasado o no da tiempo de prepararla, no se ha creado la cita." + otra;
      default:
        return "Ese hueco no está libre para ese tratamiento (hay otra cita o no cabe), no se ha creado la cita." + otra;
    }
  }
  if (/desconectad|token|invalid_grant|scope|unauthori[sz]ed|credential/i.test(res.detail)) {
    return "La agenda de Google de esta clínica está desconectada, así que no se ha podido crear la cita. Reconéctala en Agenda → «Reconectar Google Calendar».";
  }
  return "No se ha podido crear la cita ahora mismo. Inténtalo otra vez en un minuto.";
}
