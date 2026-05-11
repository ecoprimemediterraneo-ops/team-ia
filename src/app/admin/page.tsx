/**
 * Página admin (super sencilla) para ver waitlist + bookings + evals.
 * Protegida por: el email del founder en la sesión.
 */
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
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
  const s = await getSession();
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
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="card-hard p-5"><div className="text-xs uppercase font-mono text-black/60">Waitlist</div><div className="font-stencil text-5xl mt-1">{waitlist.length}</div></div>
          <div className="card-hard p-5"><div className="text-xs uppercase font-mono text-black/60">Bookings (Cal.com)</div><div className="font-stencil text-5xl mt-1">{bookings.length}</div></div>
          <div className="card-hard p-5"><div className="text-xs uppercase font-mono text-black/60">Evals 7d</div><div className="font-stencil text-5xl mt-1">{last7.length}</div></div>
          <div className="card-hard p-5 bg-[color:var(--mustard)]"><div className="text-xs uppercase font-mono">Score medio 7d</div><div className="font-stencil text-5xl mt-1">{avgScore}/10</div></div>
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
