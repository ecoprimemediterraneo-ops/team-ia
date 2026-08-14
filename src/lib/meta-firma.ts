// Firma de los webhooks de Meta (WhatsApp e Instagram).
//
// Meta manda en cada POST una cabecera `X-Hub-Signature-256` con el HMAC-SHA256
// del cuerpo CRUDO usando el App Secret. Sin comprobarla, cualquiera que sepa la
// URL puede inventarse un mensaje entrante: hacer que Pablo conteste, gastar
// tokens de Claude, meter basura en el histórico o disparar una cita.
//
// Los webhooks de Carmen, Resend y Calendar ya validaban su firma; los dos de
// Meta no lo hacían.
//
// FAIL-OPEN A PROPÓSITO cuando no hay `META_APP_SECRET`: hoy esa variable está
// vacía en producción y rechazar de golpe dejaría a Pablo mudo sin avisar. Sin
// secreto se deja pasar y se avisa por consola; en cuanto se ponga el secreto,
// empieza a rechazar de verdad. Es un candado que se cierra solo el día que se
// le pone la llave.

import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

export type ResultadoFirma =
  | { ok: true; comprobada: boolean; motivo?: string }
  | { ok: false; motivo: string };

/**
 * @param cuerpoCrudo el texto EXACTO recibido. Si se pasa un objeto ya parseado
 *   y vuelto a serializar, el HMAC no coincide nunca.
 */
export function comprobarFirmaMeta(cuerpoCrudo: string, cabecera: string | null): ResultadoFirma {
  const secreto = process.env.META_APP_SECRET;
  if (!secreto) {
    return { ok: true, comprobada: false, motivo: "sin META_APP_SECRET: no se comprueba la firma" };
  }
  if (!cabecera) return { ok: false, motivo: "falta la cabecera X-Hub-Signature-256" };

  const recibido = cabecera.startsWith("sha256=") ? cabecera.slice(7) : cabecera;
  const esperado = createHmac("sha256", secreto).update(cuerpoCrudo, "utf8").digest("hex");

  const a = Buffer.from(recibido, "hex");
  const b = Buffer.from(esperado, "hex");
  // Comparación en tiempo constante: comparar con === filtra el secreto poco a
  // poco a base de medir cuánto tarda en fallar.
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, motivo: "firma que no cuadra" };

  return { ok: true, comprobada: true };
}
