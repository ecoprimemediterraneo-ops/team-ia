// Migra TODOS los teléfonos guardados a E.164 (+34…): citas, lista de espera,
// ofertas de hueco y registros de reseñas pedidas/quejas.
// Sin argumentos solo cuenta (simulacro). Con --aplicar escribe.
//   node --env-file=.env.local scripts/migrar-telefonos-e164.mjs [--aplicar]
// Sin SUPABASE_URL trabaja sobre los ficheros de data/.
import fs from "node:fs/promises";
import path from "node:path";

const APLICAR = process.argv.includes("--aplicar");
function aE164(t) {
  const raw = (t || "").trim();
  if (!raw) return "";
  let d = raw.replace(/\D/g, "");
  if (!d) return raw;
  if (d.startsWith("00")) d = d.slice(2);
  else if (!raw.startsWith("+") && d.length === 9) d = "34" + d;
  if (d.length < 8 || d.length > 15) return raw;
  return "+" + d;
}
const fijarCliente = (v) => (v?.cliente?.telefono && aE164(v.cliente.telefono) !== v.cliente.telefono ? { ...v, cliente: { ...v.cliente, telefono: aE164(v.cliente.telefono) } } : null);
const fijarOferta = (v) => (v?.clienteTelefono && aE164(v.clienteTelefono) !== v.clienteTelefono ? { ...v, clienteTelefono: aE164(v.clienteTelefono) } : null);
const fijarMapa = (m) => {
  const out = {};
  for (const [k, iso] of Object.entries(m || {})) { const n = aE164(k); if (!out[n] || out[n] < iso) out[n] = iso; }
  return JSON.stringify(out) !== JSON.stringify(m) ? out : null;
};
const REGLAS = [["booking:rec:", fijarCliente], ["booking:espera:", fijarCliente], ["booking:wloffer:", fijarOferta], ["resenas:pedidas:", fijarMapa], ["resenas:quejas:", fijarMapa]];

let cambios = 0;
const URL_ = process.env.SUPABASE_URL, KEY = process.env.SUPABASE_SERVICE_KEY;
if (URL_ && KEY) {
  const h = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
  for (const [pref, fijar] of REGLAS) {
    let desde = 0;
    for (;;) {
      const r = await fetch(`${URL_}/rest/v1/kv_store?select=key,value&key=like.${encodeURIComponent(pref)}*&order=key&limit=1000&offset=${desde}`, { headers: h });
      if (!r.ok) throw new Error(`${pref}: ${r.status} ${await r.text()}`);
      const filas = await r.json();
      for (const { key, value } of filas) {
        const nuevo = fijar(value);
        if (!nuevo) continue;
        cambios++;
        console.log(`${APLICAR ? "migro" : "migraría"} ${key}`);
        if (APLICAR) {
          const w = await fetch(`${URL_}/rest/v1/kv_store?key=eq.${encodeURIComponent(key)}`, { method: "PATCH", headers: h, body: JSON.stringify({ value: nuevo, updated_at: new Date().toISOString() }) });
          if (!w.ok) throw new Error(`${key}: ${w.status} ${await w.text()}`);
        }
      }
      if (filas.length < 1000) break;
      desde += 1000;
    }
  }
} else {
  const D = path.join(process.cwd(), "data");
  const ficheros = [["booking-records.json", fijarCliente], ["booking-espera.json", fijarCliente], ["booking-waitlist-offers.json", fijarOferta], ["resenas-pedidas.json", fijarMapa], ["resenas-quejas.json", fijarMapa]];
  for (const [f, fijar] of ficheros) {
    const p = path.join(D, f);
    let m; try { m = JSON.parse(await fs.readFile(p, "utf-8")); } catch { continue; }
    let n = 0;
    for (const k of Object.keys(m)) { const v = fijar(m[k]); if (v) { m[k] = v; n++; } }
    if (!n) continue;
    cambios += n;
    console.log(`${f}: ${n} registro(s)`);
    if (APLICAR) { const tmp = `${p}.${process.pid}.tmp`; await fs.writeFile(tmp, JSON.stringify(m, null, 2)); await fs.rename(tmp, p); }
  }
}
console.log(`\n${cambios} registro(s) ${APLICAR ? "migrados" : "por migrar (simulacro; usa --aplicar)"}`);
