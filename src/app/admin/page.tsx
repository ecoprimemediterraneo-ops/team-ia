/**
 * Página admin (super sencilla) para ver waitlist + bookings + evals.
 * Protegida por: el email del founder en la sesión.
 */
import { redirect } from "next/navigation";
import { getSessionLocal } from "@/lib/auth";
import { estadoToken as estadoTokenInstagram } from "@/lib/instagram-login";
import { listTenants } from "@/lib/tenants";
import { resolverSector } from "@/lib/sectores";
import { resumenCoste, PRECIOS } from "@/lib/gestoria-coste";
import { MODELO_LECTURA } from "@/lib/gestoria-lectura";
import fs from "node:fs/promises";
import path from "node:path";

const FOUNDER_EMAIL = process.env.FOUNDER_EMAIL || "ecoprimemediterraneo@gmail.com";
const DATA_DIR = process.env.VERCEL ? "/tmp/aiteam-data" : path.join(process.cwd(), "data");

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(path.join(DATA_DIR, file), "utf-8"));
  } catch {
    return fallback;
  }
}

export default async function AdminPage() {
  // getSessionLocal (no getSession): en producción es idéntico, y en local levanta
  // el bypass de desarrollo para poder entrar al panel sin magic link. Mismo
  // criterio que /admin/informe y el panel de Marta; el bypass tiene doble
  // candado (NODE_ENV + VERCEL), así que no abre nada en producción.
  const s = await getSessionLocal();
  if (!s) redirect("/login");
  if (s.email !== FOUNDER_EMAIL && s.email !== "crisasky@gmail.com") {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="card-hard p-8 max-w-md text-center">
          <h1 className="font-stencil text-3xl mb-2">🔒 Acceso restringido</h1>
          <p className="text-sm text-black/60">Esta zona es solo para el founder.</p>
        </div>
      </div>
    );
  }

  type WaitlistEntry = { email: string; name?: string; sector?: string; city?: string; createdAt: string };
  type Booking = { uid: string; trigger: string; receivedAt: string; payload: Record<string, unknown> };
  type EvalResult = { ts: string; email: string; agent: string; score: number; reasoning: string; userMessage: string; agentResponse: string };

  const waitlist = await readJson<WaitlistEntry[]>("waitlist.json", []);
  const bookings = await readJson<Booking[]>("calendar-bookings.json", []);
  const evals = await readJson<EvalResult[]>("evals.json", []);

  // Token de Instagram Business Login: caduca a los 60 días y si nadie mira la
  // fecha, se entera uno el día que Marta deja de publicar.
  const ig = await estadoTokenInstagram();

  // Lo que llevamos gastado leyendo documentos, por gestoría. Sin esto no hay
  // forma de saber si el precio mensual aguanta.
  const gestorias = (await listTenants().catch(() => [])).filter((t) => resolverSector(t) === "gestoria");
  const costes = await Promise.all(
    gestorias.map(async (t) => ({ id: t.id, nombre: t.name, ...(await resumenCoste(t.id)) })),
  );
  const costeTotal = costes.reduce((s, c) => s + c.dolares, 0);
  const docsTotal = costes.reduce((s, c) => s + c.documentos, 0);
  const precioLectura = PRECIOS[MODELO_LECTURA];

  const last7 = evals.filter((e) => new Date(e.ts).getTime() > Date.now() - 7 * 86400000);
  const avgScore = last7.length > 0 ? (last7.reduce((s, r) => s + r.score, 0) / last7.length).toFixed(1) : "—";

  return (
    <div className="min-h-screen bg-[color:var(--cream)] p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="font-stencil text-5xl mb-2">Admin</h1>
        <p className="text-sm text-black/60 mb-4">Panel founder · {s.email}</p>

        <div className="flex gap-2 mb-8 flex-wrap">
          <a href="/admin/pipeline" className="btn-mustard text-xs">🎯 PIPELINE SDR</a>
          <a href="/admin/pipeline/import" className="text-xs font-mono border-2 border-black px-3 py-2 hover:bg-black hover:text-white">📤 IMPORTAR LEADS</a>
          <a href="/admin/sergio" className="text-xs font-mono border-2 border-black px-3 py-2 hover:bg-black hover:text-white">🕵️ SERGIO · INTELIGENCIA</a>
          <a href="/admin/metricas" className="text-xs font-mono border-2 border-[color:var(--mustard)] px-3 py-2 hover:bg-[color:var(--mustard)]">📊 MÉTRICAS AGENTES</a>
          <a href="/admin/dosier" className="text-xs font-mono border-2 border-black px-3 py-2 hover:bg-black hover:text-white">📖 DOSIER DEL SISTEMA</a>
          <a href="/admin/sectores" className="text-xs font-mono border-2 border-black px-3 py-2 hover:bg-black hover:text-white">🏷 PERFIL DE SECTOR</a>
          <a href="/admin/informe" className="text-xs font-mono border-2 border-black px-3 py-2 hover:bg-black hover:text-white">📊 INFORME MENSUAL</a>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="card-hard p-5"><div className="text-xs uppercase font-mono text-black/60">Waitlist</div><div className="font-stencil text-5xl mt-1">{waitlist.length}</div></div>
          <div className="card-hard p-5"><div className="text-xs uppercase font-mono text-black/60">Bookings (Cal.com)</div><div className="font-stencil text-5xl mt-1">{bookings.length}</div></div>
          <div className="card-hard p-5"><div className="text-xs uppercase font-mono text-black/60">Evals 7d</div><div className="font-stencil text-5xl mt-1">{last7.length}</div></div>
          <div className="card-hard p-5 bg-[color:var(--mustard)]"><div className="text-xs uppercase font-mono">Score medio 7d</div><div className="font-stencil text-5xl mt-1">{avgScore}/10</div></div>
        </div>

        {/* GASTO DE LECTURA DE DOCUMENTOS */}
        <div className="card-hard bg-white p-5 mb-6">
          <h2 className="font-stencil text-2xl mb-1">Lectura de documentos · lo que llevamos gastado</h2>
          <p className="text-xs text-black/60 mb-3">
            Cada documento que entra por WhatsApp, correo o a mano cuesta una llamada al modelo.
            Modelo actual: <b>{MODELO_LECTURA}</b>
            {precioLectura ? ` (${precioLectura.entrada} $/M entrada · ${precioLectura.salida} $/M salida)` : " (sin precio en la tabla)"}.
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-3">
            <div className="border-2 border-black p-3">
              <div className="text-[10px] font-mono uppercase tracking-widest text-black/50">Documentos leídos</div>
              <div className="font-stencil text-4xl leading-none mt-1">{docsTotal}</div>
            </div>
            <div className="border-2 border-black p-3">
              <div className="text-[10px] font-mono uppercase tracking-widest text-black/50">Gasto acumulado</div>
              <div className="font-stencil text-4xl leading-none mt-1">${costeTotal.toFixed(2)}</div>
            </div>
            <div className="border-2 border-black p-3">
              <div className="text-[10px] font-mono uppercase tracking-widest text-black/50">Por documento</div>
              <div className="font-stencil text-4xl leading-none mt-1">
                ${docsTotal ? (costeTotal / docsTotal).toFixed(4) : "0.0000"}
              </div>
            </div>
            {/* La cifra que decide si el precio aguanta: 500 documentos al mes es
                una gestoría de 50 clientes mandando 10 facturas cada uno. */}
            <div className="border-2 border-black p-3 bg-[color:var(--mustard)]">
              <div className="text-[10px] font-mono uppercase tracking-widest">Proyección 500 doc/mes</div>
              <div className="font-stencil text-4xl leading-none mt-1">
                ${docsTotal ? ((costeTotal / docsTotal) * 500).toFixed(2) : "—"}
              </div>
            </div>
          </div>
          {costes.length === 0 ? (
            <p className="text-sm text-black/60 italic">Todavía no hay ninguna gestoría.</p>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-black text-white">
                <tr><th className="p-2 text-left">Gestoría</th><th className="p-2 text-right">Documentos</th><th className="p-2 text-right">Gasto</th><th className="p-2 text-left">Modelos</th></tr>
              </thead>
              <tbody>
                {costes.map((c) => (
                  <tr key={c.id} className="border-b border-black/10">
                    <td className="p-2 font-bold">{c.nombre}</td>
                    <td className="p-2 text-right font-mono">{c.documentos}</td>
                    <td className="p-2 text-right font-mono">${c.dolares.toFixed(4)}</td>
                    <td className="p-2 font-mono text-[11px]">
                      {c.detalle.length === 0 ? "—" : c.detalle.map((d) =>
                        `${d.modelo}: ${d.documentos}${d.conPrecio ? "" : " (sin precio)"}`).join(" · ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="text-[11px] text-black/50 mt-2">
            Es gasto contado, no estimado: se suman los tokens que devuelve cada llamada.
          </p>
        </div>

        <div className={`card-hard p-5 mb-6 ${!ig.hay || ig.caducado ? "bg-[color:var(--red)] text-white" : (ig.diasQueQuedan ?? 99) <= 7 ? "bg-[color:var(--mustard)]" : ""}`}>
          <h2 className="font-stencil text-2xl mb-2">Token de Instagram (Business Login)</h2>
          <p className="text-sm mb-2">{ig.resumen}</p>
          {ig.hay && (
            <ul className="text-xs font-mono space-y-1 mb-3">
              <li>Cuenta: {ig.usuario ? `@${ig.usuario}` : ig.cuenta || "—"}</li>
              <li>Caduca: {ig.caduca ? new Date(ig.caduca).toLocaleString("es-ES") : "—"}</li>
              <li>Permisos: {ig.permisos?.length ? ig.permisos.join(", ") : "no los ha dicho"}</li>
              {ig.faltanPermisos?.length ? <li>FALTAN: {ig.faltanPermisos.join(", ")}</li> : null}
            </ul>
          )}
          <div className="flex gap-2 flex-wrap">
            <a href="/api/instagram/login" className="text-xs font-mono border-2 border-current px-3 py-2">
              {ig.hay ? "VOLVER A AUTORIZAR" : "AUTORIZAR EN INSTAGRAM"}
            </a>
            <a href="/api/admin/instagram-token" className="text-xs font-mono border-2 border-current px-3 py-2">VER ESTADO</a>
            <a href="/api/admin/instagram-token?refrescar=1" className="text-xs font-mono border-2 border-current px-3 py-2">RENOVAR 60 DIAS</a>
            <a href="/api/admin/instagram-app-review" className="text-xs font-mono border-2 border-current px-3 py-2">APP REVIEW</a>
          </div>
        </div>

        <div className="card-hard p-5 mb-6">
          <h2 className="font-stencil text-2xl mb-3">📋 Waitlist ({waitlist.length})</h2>
          {waitlist.length === 0 ? (
            <p className="text-sm text-black/60 italic">Aún no hay nadie en la lista.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-black text-white">
                  <tr><th className="p-2 text-left">Fecha</th><th className="p-2 text-left">Nombre</th><th className="p-2 text-left">Email</th><th className="p-2 text-left">Sector</th><th className="p-2 text-left">Ciudad</th></tr>
                </thead>
                <tbody>
                  {[...waitlist].reverse().map((w, i) => (
                    <tr key={i} className="border-b border-black/10">
                      <td className="p-2 font-mono">{new Date(w.createdAt).toLocaleString("es-ES")}</td>
                      <td className="p-2 font-bold">{w.name || "—"}</td>
                      <td className="p-2"><a href={`mailto:${w.email}`} className="underline">{w.email}</a></td>
                      <td className="p-2">{w.sector || "—"}</td>
                      <td className="p-2">{w.city || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card-hard p-5 mb-6">
          <h2 className="font-stencil text-2xl mb-3">📅 Cal.com bookings ({bookings.length})</h2>
          {bookings.length === 0 ? (
            <p className="text-sm text-black/60 italic">Sin webhooks de Cal.com aún. Configura webhook en Cal.com → /api/calendar/webhook</p>
          ) : (
            <ul className="text-xs space-y-1 max-h-64 overflow-y-auto font-mono">
              {[...bookings].reverse().slice(0, 50).map((b, i) => (
                <li key={i}>{new Date(b.receivedAt).toLocaleString("es-ES")} · {b.trigger}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="card-hard p-5">
          <h2 className="font-stencil text-2xl mb-3">📊 Últimos evals nocturnos</h2>
          {evals.length === 0 ? (
            <p className="text-sm text-black/60 italic">Sin evals aún. El cron corre cada noche a las 04:00 UTC.</p>
          ) : (
            <ul className="text-xs space-y-2 max-h-96 overflow-y-auto">
              {[...evals].reverse().slice(0, 30).map((e, i) => (
                <li key={i} className="border-b border-black/10 pb-1.5">
                  <span className={`font-bold ${e.score <= 4 ? "text-[color:var(--red)]" : e.score >= 8 ? "text-green-700" : "text-yellow-700"}`}>{e.score}/10</span>
                  {" · "}<span className="font-mono">{e.email}</span> · {e.agent} · {e.reasoning}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
