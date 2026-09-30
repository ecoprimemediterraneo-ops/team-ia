// Música SIN DERECHOS DE NADIE: se sintetiza aquí, nota a nota, así que es
// nuestra. Tres pistas con el tempo fijo para que los cortes caigan en el pulso.
//   node musica/generar.mjs  → public/musica/<id>.wav
import fs from "node:fs";
import path from "node:path";

const SR = 44100;
export const PISTAS = {
  ritmo: { bpm: 120, raiz: 57, grados: [[0, 3, 7], [-4, 0, 3], [-9, -5, -2], [-2, 2, 5]], brillo: 0.5 }, // la menor: vi-IV-I-V
  brillo: { bpm: 124, raiz: 60, grados: [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]], brillo: 0.8 }, // do mayor: I-V-vi-IV
  calma: { bpm: 104, raiz: 62, grados: [[0, 4, 7, 11], [5, 9, 12, 16], [-3, 0, 4, 7], [7, 11, 14, 17]], brillo: 0.3 }, // re mayor 7ª
};
const DUR = 16; // s (las plantillas duran 10-15 s)
const hz = (m) => 440 * 2 ** ((m - 69) / 12);

function pista({ bpm, raiz, grados, brillo }) {
  const n = DUR * SR, L = new Float32Array(n), R = new Float32Array(n);
  const pulso = 60 / bpm, compas = pulso * 4;
  let semilla = 7;
  const ruido = () => ((semilla = (semilla * 1103515245 + 12345) & 0x7fffffff) / 0x3fffffff) - 1;
  const add = (i, v, pan = 0) => { if (i >= 0 && i < n) { L[i] += v * (1 - pan); R[i] += v * (1 + pan); } };

  for (let t0 = 0; t0 < DUR; t0 += pulso) {
    const b = Math.round(t0 / pulso) % 4, s = Math.floor(t0 * SR);
    // Bombo en cada pulso
    for (let k = 0; k < SR * 0.35; k++) { const t = k / SR; add(s + k, 0.9 * Math.sin(2 * Math.PI * (45 * t + (105 / 18) * (1 - Math.exp(-18 * t)))) * Math.exp(-7 * t)); }
    // Palmada en 2 y 4
    if (b === 1 || b === 3) { let prev = 0; for (let k = 0; k < SR * 0.18; k++) { const r = ruido(), hp = r - prev; prev = r; add(s + k, 0.28 * hp * Math.exp(-k / (SR * 0.045)), 0.1); } }
    // Charles a contratiempo (corcheas)
    for (const off of [0.5]) { const sh = s + Math.floor(off * pulso * SR); let prev = 0; for (let k = 0; k < SR * 0.05; k++) { const r = ruido(), hp = r - prev; prev = r; add(sh + k, 0.12 * hp * Math.exp(-k / (SR * 0.012)), -0.3); } }
  }
  // Bajo en corcheas + acordes (pad) por compás
  for (let c = 0; c * compas < DUR; c++) {
    const acorde = grados[c % grados.length], s = Math.floor(c * compas * SR), largo = Math.floor(compas * SR);
    const fb = hz(raiz - 24 + acorde[0]);
    for (let e = 0; e < 8; e++) {
      const se = s + Math.floor((e * pulso / 2) * SR), le = Math.floor(pulso / 2 * SR * 0.85);
      for (let k = 0; k < le; k++) { const t = k / SR, ph = fb * t; const saw = 2 * (ph - Math.floor(ph + 0.5)); add(se + k, 0.16 * (0.6 * Math.sin(2 * Math.PI * ph) + 0.4 * saw * 0.5) * Math.min(1, k / 200) * Math.exp(-3 * t)); }
    }
    for (const g of acorde) {
      const f = hz(raiz + g);
      for (let k = 0; k < largo; k++) {
        const t = k / SR, env = Math.min(1, t / 0.08) * Math.min(1, (largo - k) / (SR * 0.1));
        const v = Math.sin(2 * Math.PI * f * t) + 0.5 * Math.sin(2 * Math.PI * f * 1.003 * t) + brillo * 0.25 * Math.sin(2 * Math.PI * f * 2 * t);
        // "pumping" suave con el bombo
        const bomb = 0.55 + 0.45 * Math.min(1, ((t % pulso) / pulso) * 3);
        add(s + k, 0.035 * v * env * bomb, g % 2 ? 0.25 : -0.25);
      }
    }
    // Arpegio brillante en semicorcheas en la segunda mitad
    if (c % 2 === 1) for (let q = 0; q < 16; q++) {
      const f = hz(raiz + 12 + acorde[q % acorde.length]), sq = s + Math.floor(q * pulso / 4 * SR);
      for (let k = 0; k < SR * 0.12; k++) { const t = k / SR; add(sq + k, 0.05 * brillo * Math.sin(2 * Math.PI * f * t) * Math.exp(-22 * t), q % 2 ? 0.4 : -0.4); }
    }
  }
  // Fundido final y limitador suave
  const buf = Buffer.alloc(44 + n * 4);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write("WAVEfmt ", 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write("data", 36); buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    const t = i / SR, f = Math.min(1, t / 0.05) * Math.min(1, (DUR - t) / 1.2);
    buf.writeInt16LE(Math.round(Math.tanh(L[i] * 0.9) * f * 30000), 44 + i * 4);
    buf.writeInt16LE(Math.round(Math.tanh(R[i] * 0.9) * f * 30000), 46 + i * 4);
  }
  return buf;
}
import { fileURLToPath } from "node:url";
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "musica");
fs.mkdirSync(dir, { recursive: true });
for (const [id, p] of Object.entries(PISTAS)) { fs.writeFileSync(path.join(dir, `${id}.wav`), pista(p)); console.log(`${id}.wav ${p.bpm} bpm`); }
