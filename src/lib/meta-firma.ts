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
// DOS CANDADOS, y el segundo se aprendió por las malas:
//
//   1. Sin `META_APP_SECRET` no se comprueba nada: se deja pasar y se avisa.
//   2. CON secreto, tampoco se rechaza hasta que alguien enciende
//      `META_FIRMA_ESTRICTA=true`. Solo se avisa por consola.
//
// El segundo parece de más y no lo es. En el despliegue de agosto de 2026 la
// variable `META_APP_SECRET` llevaba 79 días puesta —era la de la app ANTERIOR,
// creada antes de "AI-Team Publisher"— y en cuanto se desplegó la comprobación,
// el webhook empezó a devolver 401 a todo. Pablo se quedó mudo sin que nadie
// hubiera tocado Meta. Un secreto viejo y una comprobación nueva es una avería
// que te haces tú solo.
//
// Así que la comprobación entra andando: primero se mira y se avisa, y cuando el
// log confirma que las firmas cuadran, se enciende el rechazo. El día que
// alguien rote el App Secret, el aviso aparece ANTES de que Pablo se caiga.

import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

export type ResultadoFirma =
  | { ok: true; comprobada: boolean; motivo?: string }
  | { ok: false; motivo: string };

/** ¿Se RECHAZA lo que no cuadra, o solo se avisa? Fail-closed al revés: de
 *  fábrica solo avisa, para que una comprobación nueva no tire el webhook. */
export const firmaEstricta = (): boolean =>
  (process.env.META_FIRMA_ESTRICTA || "").toLowerCase() === "true";

/**
 * @param cuerpoCrudo el texto EXACTO recibido. Si se pasa un objeto ya parseado
 *   y vuelto a serializar, el HMAC no coincide nunca.
 */
export function comprobarFirmaMeta(cuerpoCrudo: string, cabecera: string | null): ResultadoFirma {
  const secreto = process.env.META_APP_SECRET;
  if (!secreto) {
    return { ok: true, comprobada: false, motivo: "sin META_APP_SECRET: no se comprueba la firma" };
  }

  const fallo = (motivo: string): ResultadoFirma =>
    firmaEstricta()
      ? { ok: false, motivo }
      : { ok: true, comprobada: false, motivo: `${motivo} — se deja pasar porque META_FIRMA_ESTRICTA no está encendida` };

  if (!cabecera) return fallo("falta la cabecera X-Hub-Signature-256");

  const recibido = cabecera.startsWith("sha256=") ? cabecera.slice(7) : cabecera;
  const esperado = createHmac("sha256", secreto).update(cuerpoCrudo, "utf8").digest("hex");

  const a = Buffer.from(recibido, "hex");
  const b = Buffer.from(esperado, "hex");
  // Comparación en tiempo constante: comparar con === filtra el secreto poco a
  // poco a base de medir cuánto tarda en fallar.
  if (a.length !== b.length || !timingSafeEqual(a, b)) return fallo("firma que no cuadra");

  return { ok: true, comprobada: true };
}
