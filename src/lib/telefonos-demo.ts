// Teléfonos y correos FICTICIOS de las demostraciones, y el freno que impide que
// reciban un mensaje de verdad.
//
// Un móvil español válido empieza por 6 o 7 y tiene 9 dígitos: "600110011" es un
// número que puede existir y sonar en el bolsillo de alguien. Por eso los datos
// de demostración usan el prefijo "099", que NO es un número español válido
// (ninguno empieza por 0) y que Meta rechazaría aunque se intentara.
//
// El freno de `whatsapp-sender.ts` mira esto ANTES de llamar a Meta, y también
// bloquea los números que la demo llevó antes (por si en producción ya se
// sembraron con la versión anterior de los datos y siguen ahí, porque la siembra
// no pisa lo que ya existe).

/** Los que la demostración llevó antes de pasar al prefijo 099. Siguen bloqueados. */
const DEMO_ANTIGUOS = new Set([
  "600110011", "600220022", "600330033", "600440044", "600550055", "600660066",
  "34655443322", "34677555444", "34600111222", "600111222", "34688111000", "34611999888",
]);

const soloDigitos = (t: string) => (t || "").replace(/\D/g, "");

/** true = ese número es de mentira y NO debe recibir nada. */
export function esTelefonoFicticio(numero: string): boolean {
  let d = soloDigitos(numero);
  if (!d) return false;
  if (d.startsWith("00")) d = d.slice(2);
  const nacional = d.length === 11 && d.startsWith("34") ? d.slice(2) : d;
  if (DEMO_ANTIGUOS.has(d) || DEMO_ANTIGUOS.has(nacional)) return true;
  // Prefijo 0 = no es un número español válido: es de demostración o está roto.
  if (nacional.startsWith("0")) return true;
  return false;
}

/** Dominios que la norma (RFC 2606/6761) reserva y donde no existe buzón. */
const DOMINIOS_RESERVADOS = [".example", ".invalid", ".test", ".local", ".localhost", "example.com", "example.org", "example.net"];

/** true = correo de mentira: no hay buzón detrás. */
export function esEmailFicticio(email: string): boolean {
  const e = (email || "").trim().toLowerCase();
  if (!e.includes("@")) return false;
  const dominio = e.split("@").pop() || "";
  return DOMINIOS_RESERVADOS.some((r) => (r.startsWith(".") ? dominio.endsWith(r) : dominio === r));
}
