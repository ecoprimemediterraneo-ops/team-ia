// El tipo y el valor de partida del envío, FUERA del fichero "use server".
//
// POR QUÉ ESTÁ AQUÍ Y NO EN `actions.ts`
// --------------------------------------
// Un fichero con "use server" solo puede exportar funciones async. Cada export
// se convierte en un punto de entrada invocable desde el navegador, y una
// constante no puede serlo. `ENVIO_QUIETO` vivía ahí y era un objeto, así que
// Next tiraba el módulo ENTERO al evaluarlo:
//
//   Error: A "use server" file can only export async functions, found object.
//
// Y no reventaba al importarlo: reventaba al ejecutar CUALQUIER server action de
// /dashboard/marta, incluida la de confirmar la cuenta de Instagram, que no
// tiene nada que ver con la bandeja. Por eso el síntoma era una página en blanco
// al pulsar "Usar esta cuenta" y el error no mencionaba ni a la bandeja ni a la
// confirmación.
//
// `npm run build` NO lo detecta: es un fallo de evaluación del módulo en tiempo
// de ejecución. Solo sale cuando alguien envía un formulario.

import type { CodigoFallo } from "@/lib/marta-inbox";

/**
 * El resultado que ve la pantalla. Lleva `codigo` además de `motivo` para que la
 * bandeja pueda decir lo mismo en inglés sin comparar cadenas.
 */
export type EstadoEnvio = {
  estado: "quieto" | "ok" | "error";
  motivo?: string;
  codigo?: CodigoFallo | "sesion" | "sin_destino";
};

export const ENVIO_QUIETO: EstadoEnvio = { estado: "quieto" };
