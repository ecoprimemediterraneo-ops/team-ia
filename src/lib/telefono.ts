// UN SOLO FORMATO DE TELÉFONO: E.164 (+34…).
//
// Carmen (voz) recibe «+34656989373» y Pablo (WhatsApp) «34656989373»; la
// dueña escribe «656 98 93 73». Todo se guarda como «+34656989373» para que la
// agenda, la memoria, el olvido, la lista de espera y las reseñas vean a la
// misma persona venga por donde venga.

/** Normaliza a E.164. Sin prefijo y con 9 cifras → España (+34). Vacío o basura → tal cual. */
export function aE164(t: string | undefined | null): string {
  const raw = (t || "").trim();
  if (!raw) return "";
  let d = raw.replace(/\D/g, "");
  if (!d) return raw;
  if (d.startsWith("00")) d = d.slice(2);
  else if (!raw.startsWith("+") && d.length === 9) d = "34" + d;
  if (d.length < 8 || d.length > 15) return raw; // no parece un teléfono: no lo tocamos
  return "+" + d;
}

// -----------------------------------------------------------------------------
// Migración de lo ya guardado (una vez, desde /api/cron/migrar-telefonos)
// -----------------------------------------------------------------------------

type ConTel = { cliente?: { telefono?: string } };
const fijarCliente = <T extends ConTel>(v: T): T | null =>
  v?.cliente?.telefono && aE164(v.cliente.telefono) !== v.cliente.telefono ? { ...v, cliente: { ...v.cliente, telefono: aE164(v.cliente.telefono) } } : null;
const fijarOferta = <T extends { clienteTelefono?: string }>(v: T): T | null =>
  v?.clienteTelefono && aE164(v.clienteTelefono) !== v.clienteTelefono ? { ...v, clienteTelefono: aE164(v.clienteTelefono) } : null;
const fijarMapa = (m: Record<string, string>): Record<string, string> | null => {
  const out: Record<string, string> = {};
  for (const [k, iso] of Object.entries(m || {})) { const n = aE164(k); if (!out[n] || out[n] < iso) out[n] = iso; }
  return JSON.stringify(out) !== JSON.stringify(m) ? out : null;
};

/** Pasa a E.164 citas, lista de espera, ofertas de hueco y reseñas en Supabase. Sin `aplicar`, solo cuenta. */
export async function migrarTelefonosE164(aplicar: boolean): Promise<Record<string, number>> {
  const { kvListByPrefixEstricto, kvSet } = await import("./supabase");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reglas: [string, (v: any) => unknown][] = [
    ["booking:rec:", fijarCliente], ["booking:espera:", fijarCliente], ["booking:wloffer:", fijarOferta],
    ["resenas:pedidas:", fijarMapa], ["resenas:quejas:", fijarMapa],
  ];
  const cuenta: Record<string, number> = {};
  for (const [pref, fijar] of reglas) {
    cuenta[pref] = 0;
    for (const { key, value } of await kvListByPrefixEstricto<unknown>(pref)) {
      const nuevo = fijar(value);
      if (!nuevo) continue;
      cuenta[pref]++;
      if (aplicar) await kvSet(key, nuevo);
    }
  }
  return cuenta;
}
