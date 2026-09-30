// SERVICIO DE RENDER DE MARTA. Un proceso, una cola, un render a la vez (el
// VPS comparte 4 núcleos con n8n: dos renders en paralelo lo ahogan).
//
//   GET  /salud             → { ok, cola }
//   POST /render  (Bearer MARTA_RENDER_SECRET)  body: PropsVideo (src/tipos.ts)
//        → 200 video/mp4 (cabeceras X-Render-Ms, X-Duracion-S) · 4xx/5xx JSON
//
// Variables: PORT (3900), MARTA_RENDER_SECRET (obligatoria fuera de local),
// TLS_CERT/TLS_KEY (si están, sirve HTTPS y recarga el certificado cada día).
import http from "node:http";
import https from "node:https";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition, ensureBrowser } from "@remotion/renderer";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3900);
const SECRETO = process.env.MARTA_RENDER_SECRET || "";
const PLANTILLAS = new Set(["oferta", "antes_despues", "hueco_libre"]);
const MAX_BODY = 200_000;
const TIMEOUT_MS = 240_000;

if (!SECRETO && process.env.NODE_ENV === "production") { console.error("Falta MARTA_RENDER_SECRET"); process.exit(1); }

console.log("[render] preparando navegador y bundle…");
await ensureBrowser();
const serveUrl = await bundle({ entryPoint: path.join(DIR, "src/index.ts"), publicDir: path.join(DIR, "public") });
console.log("[render] listo");

let cola = Promise.resolve();
let pendientes = 0;

function validar(p) {
  if (!p || typeof p !== "object") return "cuerpo vacío";
  if (!PLANTILLAS.has(p.plantilla)) return "plantilla desconocida";
  if (!p.marca || typeof p.marca.fondo !== "string") return "falta marca";
  if (!Array.isArray(p.fotos) || p.fotos.some((u) => typeof u !== "string" || !/^https?:\/\//.test(u))) return "fotos: URLs http(s)";
  if (p.marca.logoUrl && !/^https?:\/\//.test(p.marca.logoUrl)) return "logo: URL http(s)";
  if (!p.textos || typeof p.textos !== "object") return "faltan textos";
  return null;
}

async function render(props) {
  const comp = await selectComposition({ serveUrl, id: "Video", inputProps: props });
  const out = path.join(os.tmpdir(), `marta-${crypto.randomUUID()}.mp4`);
  const t0 = Date.now();
  await renderMedia({
    composition: comp, serveUrl, codec: "h264", outputLocation: out, inputProps: props,
    crf: 20, pixelFormat: "yuv420p", colorSpace: "bt709", audioCodec: "aac",
    concurrency: Number(process.env.RENDER_CONCURRENCY || Math.max(1, Math.floor(os.cpus().length / 2))), timeoutInMilliseconds: 60_000,
    ...(process.env.RENDER_GL ? { chromiumOptions: { gl: process.env.RENDER_GL } } : {}),
  });
  const bytes = fs.readFileSync(out);
  fs.rmSync(out, { force: true });
  return { bytes, ms: Date.now() - t0, duracionS: comp.durationInFrames / comp.fps };
}

const json = (res, code, obj) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(obj)); };

async function manejar(req, res) {
  if (req.method === "GET" && req.url === "/salud") return json(res, 200, { ok: true, cola: pendientes });
  if (req.method !== "POST" || req.url !== "/render") return json(res, 404, { ok: false });
  const auth = req.headers.authorization || "";
  const esperado = `Bearer ${SECRETO}`;
  if (SECRETO && (auth.length !== esperado.length || !crypto.timingSafeEqual(Buffer.from(auth), Buffer.from(esperado)))) return json(res, 401, { ok: false, error: "no autorizado" });
  let raw = "";
  for await (const c of req) { raw += c; if (raw.length > MAX_BODY) return json(res, 413, { ok: false, error: "demasiado grande" }); }
  let props;
  try { props = JSON.parse(raw); } catch { return json(res, 400, { ok: false, error: "JSON inválido" }); }
  const err = validar(props);
  if (err) return json(res, 400, { ok: false, error: err });
  if (pendientes >= 5) return json(res, 503, { ok: false, error: "cola llena, reintenta en un minuto" });
  pendientes++;
  const trabajo = cola.then(() => Promise.race([render(props), new Promise((_, r) => setTimeout(() => r(new Error("render: tiempo agotado")), TIMEOUT_MS))]));
  cola = trabajo.catch(() => {});
  try {
    const r = await trabajo;
    console.log(`[render] ${props.plantilla} ${Math.round(r.bytes.length / 1024)} KB en ${r.ms} ms`);
    res.writeHead(200, { "content-type": "video/mp4", "content-length": r.bytes.length, "x-render-ms": String(r.ms), "x-duracion-s": r.duracionS.toFixed(2) });
    res.end(r.bytes);
  } catch (e) {
    console.error("[render] fallo:", e?.message || e);
    json(res, 500, { ok: false, error: String(e?.message || e).slice(0, 300) });
  } finally { pendientes--; }
}

const certs = () => ({ cert: fs.readFileSync(process.env.TLS_CERT), key: fs.readFileSync(process.env.TLS_KEY) });
let srv;
if (process.env.TLS_CERT && process.env.TLS_KEY) {
  srv = https.createServer(certs(), manejar);
  setInterval(() => { try { srv.setSecureContext(certs()); } catch (e) { console.error("[render] no recargo el certificado:", e.message); } }, 24 * 3600_000);
} else srv = http.createServer(manejar);
srv.requestTimeout = TIMEOUT_MS + 30_000;
srv.listen(PORT, () => console.log(`[render] escuchando en ${PORT} (${process.env.TLS_CERT ? "https" : "http"})`));
