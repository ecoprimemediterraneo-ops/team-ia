// VÍDEOS DE MARTA (30/09/2026): plantillas Remotion, mismo flujo que las
// imágenes. El servicio de render y el Graph de Meta son FALSOS (servidores
// locales): la prueba no renderiza de verdad ni sale a internet.
import http from "node:http";
const R = new URL("../../src/lib/", import.meta.url).href;
let ok = 0, total = 0;
const assert = (c: boolean, m: string) => { total++; if (c) { ok++; console.log(`OK   ${m}`); } else console.log(`FAIL ${m}`); };
delete process.env.VERCEL; delete process.env.ANTHROPIC_API_KEY; delete process.env.BLOB_READ_WRITE_TOKEN;

// ─── Render falso ───────────────────────────────────────────────────────────
type Pedido = { props: Record<string, any>; auth?: string };
const pedidos: Pedido[] = [];
let respuestas: number[] = []; // códigos a devolver en orden (vacío = 200)
let urlPublicaMock = ""; // cabecera x-video-url (copia pública del VPS)
let esperaMs = 0;        // para simular un render que tarda demasiado
const render = http.createServer((req, res) => {
  let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => {
    const code = respuestas.shift() ?? 200;
    pedidos.push({ props: JSON.parse(b), auth: req.headers.authorization });
    if (code !== 200) { res.writeHead(code, { "content-type": "application/json" }); res.end('{"ok":false}'); return; }
    const mp4 = Buffer.from(`MP4FALSO-${pedidos.length}-${"x".repeat(2000)}`);
    const enviar = () => { res.writeHead(200, { "content-type": "video/mp4", "x-render-ms": "31000", "x-duracion-s": "12.05", ...(urlPublicaMock ? { "x-video-url": urlPublicaMock } : {}) }); res.end(mp4); };
    if (esperaMs) setTimeout(enviar, esperaMs); else enviar();
  });
});
await new Promise<void>((r) => render.listen(0, r));
process.env.MARTA_RENDER_URL = `http://127.0.0.1:${(render.address() as any).port}`;
process.env.MARTA_RENDER_SECRET = "secreto-de-prueba";

// ─── Graph falso (publicar Reels) ───────────────────────────────────────────
const graph: { metodo: string; ruta: string; cuerpo: string }[] = [];
let estados: string[] = [];
let publishFallos = 0;
const g = http.createServer((req, res) => {
  let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => {
    graph.push({ metodo: req.method!, ruta: req.url!, cuerpo: b });
    const j = (o: unknown, c = 200) => { res.writeHead(c, { "content-type": "application/json" }); res.end(JSON.stringify(o)); };
    if (req.url!.includes("/media_publish")) {
      if (publishFallos-- > 0) return j({ error: { code: 9007, message: "Media ID is not available" } }, 400);
      return j({ id: "ig_media_1" });
    }
    if (req.url!.includes("/media")) return j({ id: "contenedor_1" });
    if (req.url!.includes("status_code")) return j({ status_code: estados.shift() || "FINISHED" });
    return j({ permalink: "https://instagram.com/reel/x" });
  });
});
await new Promise<void>((r) => g.listen(0, r));

const B = await import(R + "booking.ts");
const D = await import(R + "sectores-demo.ts");
const V = await import(R + "marta-video.ts");
const EV = await import(R + "event-log.ts");
const IS = await import(R + "marta-image-store.ts");
const P = await import(R + "marta-proposals.ts");
const RG = await import(R + "marta-regen.ts");
const PUB = await import(R + "marta-publish.ts");
const CAL = await import(R + "marta-calendar.ts");

const TEN = "tenant_demo_salon";
await D.sembrarDemoConservando(TEN);
const neg = await B.getBusinessByTenant(TEN);
const FOTOS = [1, 2, 3].map((i) => `https://images.unsplash.com/photo-${i}?w=640&h=440&fit=crop`);
await B.saveBusiness({ ...neg, galeria: FOTOS, logoUrl: "/img/logo.svg", marca: { acento: "#8A5A64", tipografia: "elegante" } });
const slug = neg.slug;
const BASE = "http://localhost:3000";
const eventos = async () => (await EV.getMonthEvents(TEN, EV.monthKey(new Date().toISOString()))).filter((e: any) => e.type === "video_rendered");
const sumar = (f: string, n: number) => new Date(Date.parse(`${f}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Madrid" });
const proximo = (dow: number) => { let d = sumar(hoy, 2); while (new Date(`${d}T12:00:00Z`).getUTCDay() !== dow) d = sumar(d, 1); return d; };

console.log("\n--- Freno: apagado por defecto ---");
delete process.env.MARTA_VIDEO_ENABLED;
const off = await V.generarVideo({ tenantId: TEN, plantilla: "oferta", baseUrl: BASE });
assert(!off.ok && off.kind === "disabled", "sin MARTA_VIDEO_ENABLED no se renderiza nada");
assert(pedidos.length === 0 && (await eventos()).length === 0, "ni llamada al render ni evento");
process.env.MARTA_VIDEO_ENABLED = "true";

console.log("\n--- Oferta: marca, fotos y precios honestos ---");
const o1 = await V.generarVideo({ tenantId: TEN, plantilla: "oferta", servicioId: "sv_corte", precioOferta: 19, hasta: sumar(hoy, 10), baseUrl: BASE });
assert(o1.ok, `oferta generada (${o1.ok ? "" : o1.detail})`);
const p1 = pedidos.at(-1)!.props;
assert(pedidos.at(-1)!.auth === "Bearer secreto-de-prueba", "el render va con el secreto");
assert(p1.marca.acento === "#8A5A64" && p1.marca.tipografia === "elegante", "colores y letra propios del negocio");
assert(p1.marca.logoUrl === `${BASE}/img/logo.svg`, "el logo va con URL absoluta");
assert(p1.fotos.length === 3 && p1.fotos.every((u: string) => u.includes("h=1920")), "3 fotos del banco, en vertical");
assert(p1.textos.precio === "19 €" && p1.textos.precioAntes === "25 €", "precio de oferta y el normal tachado");
assert(/^Hasta el \d+ de /.test(p1.textos.hasta), `fecha límite legible («${p1.textos.hasta}»)`);
assert(p1.textos.cta === "Reserva por WhatsApp", "CTA de WhatsApp");
const o2 = await V.prepararVideo({ tenantId: TEN, plantilla: "oferta", servicioId: "sv_corte", precioOferta: 30, baseUrl: BASE });
assert(o2.ok && !(o2.props.textos as any).precioAntes, "si la «oferta» es más cara, NO se tacha ningún precio");
assert(o2.ok && /^Hasta el \d+ de /.test((o2.props.textos as any).hasta), "sin fecha: hasta fin de mes");

console.log("\n--- Evento y coste ---");
const ev = await eventos();
assert(ev.length === 1, "un evento video_rendered por render");
assert(typeof ev[0].meta.costeUSD === "number" && ev[0].meta.desglose?.renderUSD === 0 && ev[0].meta.renderMs === 31000 && ev[0].meta.plantilla === "oferta", `con coste y tiempo (${ev[0].meta.costeUSD} $)`);
assert(o1.ok && o1.url.includes("/api/admin/marta-image/"), "sin Blob, el MP4 va al almacén propio");
const guardado = await IS.getStoredImage(o1.ok ? o1.url.split("/").pop() : "");
assert(guardado?.mimeType === "video/mp4", "guardado como video/mp4");

console.log("\n--- Hueco libre: de la agenda real ---");
const martes = proximo(2);
const h1 = await V.prepararVideo({ tenantId: TEN, plantilla: "hueco_libre", servicioId: "sv_manicura", baseUrl: BASE, ahora: new Date(`${martes}T07:00:00Z`) });
const sel = B.resolverServicio(neg.servicios.find((s: any) => s.id === "sv_manicura"), {});
const reales = new Set<string>();
for (const e of B.empleadosDeServicio(neg, "sv_manicura")) { const r = await B.computeFreeSlots(neg, sel, martes, `${BASE}/api/lucia/callback`, undefined, e.id); if (r.ok) r.slots.forEach((x: string) => reales.add(x.slice(11, 16))); }
assert(h1.ok && reales.has((h1.props.textos as any).hora), `la hora (${h1.ok ? (h1.props.textos as any).hora : h1.detail}) es un hueco real de la agenda`);
assert(h1.ok && /^Hoy · martes \d+$/.test((h1.props.textos as any).dia), "dice qué día");
const domingo = proximo(0);
const h2 = await V.prepararVideo({ tenantId: TEN, plantilla: "hueco_libre", baseUrl: BASE, ahora: new Date(`${domingo}T08:00:00Z`) });
assert(!h2.ok && /ningún hueco/.test(h2.detail), "sin hueco (domingo cerrado) no se inventa uno");

console.log("\n--- Antes y después ---");
const ad = await V.prepararVideo({ tenantId: TEN, plantilla: "antes_despues", fotos: [FOTOS[2], FOTOS[0]], baseUrl: BASE });
assert(ad.ok && ad.props.fotos[0] === FOTOS[2] && ad.props.fotos[1] === FOTOS[0], "respeta el orden ANTES/DESPUÉS elegido");
await B.saveBusiness({ ...(await B.getBusinessBySlug(slug)), galeria: [FOTOS[0]] });
const ad2 = await V.prepararVideo({ tenantId: TEN, plantilla: "antes_despues", baseUrl: BASE });
assert(!ad2.ok && /dos fotos/.test(ad2.detail), "con una sola foto no hay antes y después");
await B.saveBusiness({ ...(await B.getBusinessBySlug(slug)), galeria: FOTOS });

console.log("\n--- Reintentos del render ---");
respuestas = [503];
const re = await V.renderizar(p1 as any);
assert(re.ok, "un 503 (cola llena) se reintenta");
respuestas = [400];
const n0 = pedidos.length;
const re2 = await V.renderizar(p1 as any);
assert(!re2.ok && pedidos.length === n0 + 1, "un 400 no se reintenta");

console.log("\n--- Pedir cambios sobre un vídeo ---");
if (o1.ok) {
  const prop = await P.createProposal({ tenantId: TEN, recipientWhatsapp: "", imageUrl: o1.url, caption: o1.caption, mediaType: "REELS", imageSource: "video_plantilla", video: o1.spec, regenCount: 0 });
  const rg = await RG.regenerateProposal({ proposal: prop, changeFoto: true, changeCaption: false, feedback: "otra foto", baseUrl: BASE });
  assert(rg.kind === "ok" && rg.imageUrl !== o1.url && rg.proposal.video?.plantilla === "oferta" && rg.proposal.mediaType === "REELS", "«otra foto» rehace el vídeo, no pide subir uno");
  assert(rg.kind === "ok" && (rg.proposal.video?.props.textos as any).precio === "19 €", "y conserva el precio de la oferta");
}

console.log("\n--- Registro roto: falla cerrado ---");
{
  const fs = await import("node:fs");
  const f = "data/events.json";
  const bueno = fs.readFileSync(f, "utf-8");
  fs.writeFileSync(f, bueno + '"basura"');
  const roto = await V.generarVideo({ tenantId: TEN, plantilla: "oferta", baseUrl: BASE });
  assert(!roto.ok && /registro/.test(roto.detail), "si el vídeo no se puede apuntar (y contar), no se entrega");
  fs.writeFileSync(f, bueno);
}

console.log("\n--- Límite por día (3 por defecto) ---");
assert(V.limiteVideosDia() === 3, "por defecto, 3 vídeos al día por negocio");
process.env.MARTA_VIDEO_MAX_DIA = String(await V.videosDeHoy(TEN));
const dia = await V.generarVideo({ tenantId: TEN, plantilla: "oferta", baseUrl: BASE });
assert(!dia.ok && dia.kind === "limite" && /hoy/.test(dia.detail), `al llegar al límite del día se para y lo dice (${dia.ok ? "" : dia.detail})`);
delete process.env.MARTA_VIDEO_MAX_DIA;

console.log("\n--- Copia pública del VPS (el Blob es privado) ---");
urlPublicaMock = "https://api.aiteam.marketing:8790/v/abc.mp4";
const pub1 = await V.generarVideo({ tenantId: TEN, plantilla: "oferta", servicioId: "sv_corte", baseUrl: BASE });
assert(pub1.ok && pub1.url === urlPublicaMock, `sin Blob, el MP4 es la copia pública HTTPS del render (${pub1.ok ? pub1.url : pub1.detail})`);
urlPublicaMock = "";

console.log("\n--- Render que tarda demasiado: no se queda colgada ---");
esperaMs = 6_000;
const t0r = Date.now();
const lento = await V.renderizar(p1 as any, 2_000);
assert(!lento.ok && /tardado/.test(lento.detail) && Date.now() - t0r < 5_000, `corta a su plazo y lo dice (${lento.ok ? "" : lento.detail}, ${Date.now() - t0r} ms)`);
esperaMs = 0;

console.log("\n--- Recursos locales con el render en el VPS ---");
const antesUrl = process.env.MARTA_RENDER_URL;
process.env.MARTA_RENDER_URL = "https://api.aiteam.marketing:8790";
const marcaVps = await V.marcaDelVideo(TEN, await B.getBusinessBySlug(slug), BASE);
assert(marcaVps.logoUrl === "https://aiteam.marketing/img/logo.svg", `el logo de localhost se pide a la web publicada (${marcaVps.logoUrl})`);
process.env.MARTA_RENDER_URL = antesUrl;

console.log("\n--- Límite por mes ---");
process.env.MARTA_VIDEO_MAX_MES = String((await eventos()).length);
const lim = await V.generarVideo({ tenantId: TEN, plantilla: "oferta", baseUrl: BASE });
assert(!lim.ok && lim.kind === "limite", `al llegar al límite se para (${lim.ok ? "" : lim.detail})`);
delete process.env.MARTA_VIDEO_MAX_MES;

console.log("\n--- Calendario ---");
if (o1.ok) {
  const [e] = await CAL.scheduleAtDates(TEN, [{ caption: "x", imageUrl: o1.url, mediaType: "REELS", scheduledAt: new Date(Date.now() + 86_400_000).toISOString(), tema: "Vídeo · oferta", video: o1.spec }]);
  assert(e.mediaType === "REELS" && e.video?.plantilla === "oferta", "se programa como REELS con su vídeo");
}

console.log("\n--- Publicar un Reel (Graph falso) ---");
process.env.META_GRAPH_URL = `http://127.0.0.1:${(g.address() as any).port}`;
process.env.MARTA_PUBLISH_ENABLED = "true"; process.env.INSTAGRAM_ACCESS_TOKEN = "t"; process.env.INSTAGRAM_USER_ID = "ig_1";
estados = ["IN_PROGRESS"]; publishFallos = 1;
const t0 = Date.now();
const pub = await PUB.publishToInstagram({ mediaType: "REELS", mediaUrl: "https://x/v.mp4", caption: "hola" });
assert("ok" in pub && pub.ok, `publicado tras esperar a Meta (${Math.round((Date.now() - t0) / 1000)} s)`);
const cont = graph.find((x) => x.metodo === "POST" && x.ruta.endsWith("/media"));
assert(!!cont && /media_type=REELS/.test(cont.cuerpo) && /video_url=/.test(cont.cuerpo), "contenedor tipo REELS con video_url");
assert(graph.filter((x) => x.ruta.includes("media_publish")).length === 2, "un 9007 al publicar se reintenta");
graph.length = 0;
await PUB.publishToInstagram({ mediaType: "STORIES_VIDEO", mediaUrl: "https://x/v.mp4" });
assert(/media_type=STORIES/.test(graph.find((x) => x.ruta.endsWith("/media"))?.cuerpo || ""), "historia de vídeo = media_type STORIES");

render.close(); g.close();
console.log(`\n=== ${ok}/${total} ===`);
process.exit(0);
