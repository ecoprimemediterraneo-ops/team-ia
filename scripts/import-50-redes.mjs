// Importador masivo: parsea assets/{instagram,linkedin}/posts.md y los inyecta en data/queue.json
// Ejecutar: node scripts/import-50-redes.mjs
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = process.cwd();
const FILE = path.join(ROOT, "data", "queue.json");

function extraerCaptionIG(bloque) {
  const m = bloque.match(/\*\*CAPTION:\*\*\s*\n([\s\S]*?)(\n---|\n\*\*PROMPT|\n##|$)/);
  if (!m) return "";
  return m[1].split("\n").map((l) => l.replace(/^\s*>\s?/, "")).join("\n").trim();
}
function extraerContenidoLI(bloque) {
  const m = bloque.match(/```\s*\n([\s\S]*?)\n```/);
  return m ? m[1].trim() : "";
}

async function parsearIG() {
  const md = await fs.readFile(path.join(ROOT, "assets/instagram/posts.md"), "utf-8");
  const out = [];
  for (const b of md.split(/(?=### POST \d{2})/g)) {
    const m = b.match(/### POST (\d{2})/);
    if (!m) continue;
    const c = extraerCaptionIG(b);
    if (c) out.push({ numero: +m[1], contenido: c, red: "instagram" });
  }
  return out;
}
async function parsearLI() {
  const md = await fs.readFile(path.join(ROOT, "assets/linkedin/posts.md"), "utf-8");
  const out = [];
  for (const b of md.split(/(?=## POST \d{2})/g)) {
    const m = b.match(/## POST (\d{2})/);
    if (!m) continue;
    const c = extraerContenidoLI(b);
    if (c) out.push({ numero: +m[1], contenido: c, red: "linkedin" });
  }
  return out;
}

function fechaIG(i, start) {
  const dias = [1, 2, 4, 5];
  const sem = Math.floor(i / 4);
  const dia = dias[i % 4];
  const d = new Date(start);
  while (d.getDay() !== 1) d.setDate(d.getDate() + 1);
  d.setDate(d.getDate() + sem * 7 + (dia - 1));
  d.setHours(18, 30, 0, 0);
  return d;
}
function fechaLI(i, start) {
  const dias = [2, 4, 6];
  const sem = Math.floor(i / 3);
  const dia = dias[i % 3];
  const d = new Date(start);
  while (d.getDay() !== 1) d.setDate(d.getDate() + 1);
  d.setDate(d.getDate() + sem * 7 + (dia - 1));
  d.setHours(9, 0, 0, 0);
  return d;
}

const ig = await parsearIG();
const li = await parsearLI();

let existentes = [];
try { existentes = JSON.parse(await fs.readFile(FILE, "utf-8")); } catch {}
const set = new Set(existentes.map((p) => `${p.red}::${p.contenido.slice(0, 60)}`));

const ahora = new Date(); ahora.setDate(ahora.getDate() + 1); ahora.setHours(0, 0, 0, 0);
let nuevos = 0, sk = 0;

for (let i = 0; i < ig.length; i++) {
  const p = ig[i];
  const key = `${p.red}::${p.contenido.slice(0, 60)}`;
  if (set.has(key)) { sk++; continue; }
  const ts = new Date().toISOString();
  existentes.push({
    id: `pub_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`,
    red: p.red,
    contenido: p.contenido,
    fechaProgramada: fechaIG(i, ahora).toISOString(),
    estado: "borrador",
    metadata: { autor: "Marta", campaña: `IG-Mes1-Post${String(p.numero).padStart(2, "0")}` },
    creadaEn: ts, actualizadaEn: ts,
  });
  nuevos++;
}
for (let i = 0; i < li.length; i++) {
  const p = li[i];
  const key = `${p.red}::${p.contenido.slice(0, 60)}`;
  if (set.has(key)) { sk++; continue; }
  const ts = new Date().toISOString();
  existentes.push({
    id: `pub_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`,
    red: p.red,
    contenido: p.contenido,
    fechaProgramada: fechaLI(i, ahora).toISOString(),
    estado: "borrador",
    metadata: { autor: "Marta", campaña: `LI-Mes1-Post${String(p.numero).padStart(2, "0")}` },
    creadaEn: ts, actualizadaEn: ts,
  });
  nuevos++;
}

await fs.mkdir(path.dirname(FILE), { recursive: true });
await fs.writeFile(FILE, JSON.stringify(existentes, null, 2));

console.log(`✅ Importados: ${nuevos} (IG: ${ig.length}, LI: ${li.length}). Saltados: ${sk}. Total cola: ${existentes.length}`);
