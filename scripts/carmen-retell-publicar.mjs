// Aplica a CARMEN en Retell la configuración del repo (scripts/carmen-retell-config.mjs)
// PARTIENDO SIEMPRE DE LA VERSIÓN PUBLICADA (nunca de copias viejas: así no se
// pierde nada que se haya cambiado en el panel, como la transferencia).
//
//   node scripts/carmen-retell-publicar.mjs            # enseña qué cambiaría (no toca nada)
//   node scripts/carmen-retell-publicar.mjs --publicar # copia, cambia el borrador y publica
//
// Qué cambia:
//   · prompt de salón (datos del negocio por variables, sin textos fijos);
//   · frases de espera en todas las funciones (speak_during_execution);
//   · frase de la transferencia ("… que ha llamado al salón");
//   · variables por defecto sacadas de la FICHA del negocio (--slug, por defecto "demo").
// Qué NO cambia: destino y modo de la transferencia, URLs y secretos de las
// funciones, voz, número. Necesita RETELL_API_KEY (no se imprime nunca).
import fs from "node:fs";
import path from "node:path";
import { PROMPT, FRASES_ESPERA, FRASE_TRANSFERENCIA, PALABRAS_URGENCIA, descripcionEspera } from "./carmen-retell-config.mjs";

const AGENTE = process.env.CARMEN_AGENT_ID || "agent_fcb25abf8b0347ad1cff69146e";
const SITIO = process.env.PUBLIC_URL || "https://aiteam.marketing";
const arg = (n, d) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const SLUG = arg("slug", "demo");
const PUBLICAR = process.argv.includes("--publicar");
const KEY = process.env.RETELL_API_KEY;
if (!KEY) { console.error("Falta RETELL_API_KEY"); process.exit(1); }

const api = async (ruta, init = {}) => {
  const r = await fetch(`https://api.retellai.com${ruta}`, { ...init, headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", ...(init.headers || {}) } });
  const t = await r.text();
  if (!r.ok) throw new Error(`${ruta} → ${r.status} ${t.slice(0, 300)}`);
  return t ? JSON.parse(t) : null;
};

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
function horarioHablado(h) {
  if (!h) return "";
  const txt = (d) => (h[d]?.abierto && h[d].franjas?.length ? h[d].franjas.map((f) => `de ${f.desde} a ${f.hasta}`).join(" y ") : "cerrado");
  const grupos = [];
  for (const d of [1, 2, 3, 4, 5, 6, 0]) {
    const t = txt(d), u = grupos[grupos.length - 1];
    if (u && u.t === t) u.hasta = d; else grupos.push({ desde: d, hasta: d, t });
  }
  return grupos.map((g) => `${g.desde === g.hasta ? DIAS[g.desde] : `${DIAS[g.desde]} a ${DIAS[g.hasta]}`} ${g.t}`).join("; ");
}
const serviciosHablados = (b) => (b.servicios || []).filter((x) => x.activo !== false).map((x) => {
  const d = [x.precioEUR ? `${x.precioEUR} €` : "", x.durationMin ? `${x.durationMin} min` : ""].filter(Boolean).join(", ");
  return d ? `${x.nombre} (${d})` : x.nombre;
}).join("; ");

// 1) La versión PUBLICADA es el punto de partida.
const versiones = await api(`/get-agent-versions/${AGENTE}`);
const pub = versiones.filter((v) => v.is_published).sort((a, b) => b.version - a.version)[0];
if (!pub) throw new Error("El agente no tiene ninguna versión publicada.");
const llmId = pub.response_engine.llm_id;
const llmPub = await api(`/get-retell-llm/${llmId}?version=${pub.response_engine.version}`);
console.log(`Punto de partida: agente v${pub.version} publicada, LLM v${llmPub.version}.`);

// 2) Variables por defecto desde la FICHA del negocio.
const ficha = (await (await fetch(`${SITIO}/api/booking/${SLUG}`)).json()).negocio;
if (!ficha?.nombre) throw new Error(`No hay ficha pública del negocio "${SLUG}".`);
const vars = {
  ...(llmPub.default_dynamic_variables || {}),
  negocio: ficha.nombre,
  saludo: `Hola, soy Carmen, la asistente virtual de ${ficha.nombre}. ¿En qué te puedo ayudar?`,
  saludo_en: `Hi, I'm Carmen, the virtual assistant at ${ficha.nombre}. How can I help you?`,
  direccion: ficha.direccion || "",
  horario: horarioHablado(ficha.horario),
  servicios: serviciosHablados(ficha),
  telefono_negocio: ficha.telefono || "",
  palabras_urgencia: PALABRAS_URGENCIA,
};

// 3) Funciones: frases de espera, frase de la transferencia y textos de salón
// (nada de "paciente" ni ejemplos de clínica); URLs, destinos y lo demás, tal cual.
const deSalon = (t) => {
  const { url, ...resto } = t;
  const limpio = JSON.parse(JSON.stringify(resto).replace(/del paciente/g, "del cliente").replace(/paciente/g, "cliente"));
  const motivo = limpio.parameters?.properties?.motivo;
  if (motivo) motivo.description = "Servicio que quiere el cliente (uno de los servicios del salón, con sus palabras)";
  return url === undefined ? limpio : { ...limpio, url };
};
const tools = llmPub.general_tools.map(deSalon).map((t) => {
  if (t.type === "custom" && FRASES_ESPERA[t.name]) {
    return { ...t, speak_during_execution: true, execution_message_description: descripcionEspera(FRASES_ESPERA[t.name]) };
  }
  if (t.type === "transfer_call") {
    const opt = { ...t.transfer_option };
    if (opt.type === "warm_transfer") opt.private_handoff_option = { type: "static_message", message: FRASE_TRANSFERENCIA };
    return { ...t, transfer_option: opt };
  }
  return t;
});
const sinEspera = llmPub.general_tools.filter((t) => t.type === "custom" && !FRASES_ESPERA[t.name]).map((t) => t.name);
if (sinEspera.length) throw new Error(`Funciones sin frases de espera: ${sinEspera.join(", ")}. Añádelas en carmen-retell-config.mjs.`);

const cambios = { general_prompt: PROMPT, general_tools: tools, default_dynamic_variables: vars };
const transfer = tools.find((t) => t.type === "transfer_call");
console.log(`Negocio: ${ficha.nombre} · ${vars.horario}`);
console.log(`Funciones con frase de espera: ${tools.filter((t) => t.speak_during_execution).map((t) => t.name).join(", ")}`);
console.log(`Transferencia: ${transfer?.name} · ${transfer?.transfer_option?.type} · destino ${transfer?.transfer_destination?.number} (móvil …${String(vars.movil_dueno || "").slice(-3)})`);
if (!PUBLICAR) { console.log("\n(Sin --publicar: no se ha tocado nada.)"); process.exit(0); }

// 4) Copia de seguridad de lo publicado y del borrador.
const dir = path.join(process.env.HOME, "EQUIPO DE AGENTES IA", "tropa-copias-retell", `${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}-antes-publicar-v${pub.version}`);
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, `agente-v${pub.version}-publicado.json`), JSON.stringify(pub, null, 2));
fs.writeFileSync(path.join(dir, `llm-v${llmPub.version}-publicado.json`), JSON.stringify(llmPub, null, 2));
fs.writeFileSync(path.join(dir, "llm-borrador.json"), JSON.stringify(await api(`/get-retell-llm/${llmId}`), null, 2));
console.log(`Copia: ${dir}`);

// 5) Borrador = publicado + cambios, y se publica.
await api(`/update-retell-llm/${llmId}`, { method: "PATCH", body: JSON.stringify(cambios) });
await api(`/publish-agent/${AGENTE}`, { method: "POST" });

// 6) Comprobación leyendo la versión publicada nueva.
const tras = (await api(`/get-agent-versions/${AGENTE}`)).filter((v) => v.is_published).sort((a, b) => b.version - a.version)[0];
const llmTras = await api(`/get-retell-llm/${llmId}?version=${tras.response_engine.version}`);
const tr = llmTras.general_tools.find((t) => t.type === "transfer_call");
const ok = {
  version: tras.version,
  transferencia: tr?.transfer_option?.type,
  destino: tr?.transfer_destination?.number,
  movil: `…${String(llmTras.default_dynamic_variables?.movil_dueno || "").slice(-3)}`,
  persona: /hablar con una persona/.test(llmTras.general_prompt),
  urgencias: /urgente=true, usa pasar_al_responsable/.test(llmTras.general_prompt),
  frase: tr?.transfer_option?.private_handoff_option?.message,
  espera: llmTras.general_tools.filter((t) => t.speak_during_execution).map((t) => t.name),
};
console.log("Publicada:", JSON.stringify(ok));
