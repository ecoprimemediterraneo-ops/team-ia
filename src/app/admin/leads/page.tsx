import { redirect } from "next/navigation";
import { getSession, isFounder } from "@/lib/auth";
import fs from "node:fs/promises";
import path from "node:path";
import { kvGet } from "@/lib/supabase";
import BetaStatusSelector from "@/components/admin/BetaStatusSelector";
const DATA_DIR = process.env.VERCEL ? "/tmp/aiteam-data" : path.join(process.cwd(), "data");
const USE_SUPABASE = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);

const KV_KEYS: Record<string, string> = {
  "diagnosticos.json": "diagnosticos:all",
  "newsletter.json": "newsletter:subscribers",
  "beta.json": "beta:all",
};

async function readJson<T>(file: string, fallback: T): Promise<T> {
  if (USE_SUPABASE && KV_KEYS[file]) {
    const data = await kvGet<T>(KV_KEYS[file]);
    return data ?? fallback;
  }
  try {
    return JSON.parse(await fs.readFile(path.join(DATA_DIR, file), "utf-8"));
  } catch {
    return fallback;
  }
}

type Diagnostico = {
  nombre: string;
  email: string;
  whatsapp?: string;
  negocio: string;
  sector: string;
  ciudad: string;
  fecha: string;
};
type Newsletter = { email: string; date: string };
type Beta = {
  nombre: string;
  email: string;
  whatsapp: string;
  negocio: string;
  sector: string;
  ciudad: string;
  web?: string;
  empleados?: string;
  porQue: string;
  agentesInteres?: string[];
  fecha: string;
  estado: "pendiente" | "activo" | "cerrado";
};

export default async function AdminLeadsPage() {
  const s = await getSession();
  if (!s) redirect("/login");
  if (!isFounder(s.email)) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="card-hard p-8 max-w-md text-center">
          <h1 className="font-stencil text-3xl mb-2">🔒 Acceso restringido</h1>
        </div>
      </div>
    );
  }

  const diagnosticos = await readJson<Diagnostico[]>("diagnosticos.json", []);
  const newsletter = await readJson<Newsletter[]>("newsletter.json", []);
  const beta = await readJson<Beta[]>("beta.json", []);

  const today = Date.now();
  const last7 = (ts: string) => new Date(ts).getTime() > today - 7 * 86400000;
  const last30 = (ts: string) => new Date(ts).getTime() > today - 30 * 86400000;

  const diag7 = diagnosticos.filter((d) => last7(d.fecha));
  const diag30 = diagnosticos.filter((d) => last30(d.fecha));
  const news7 = newsletter.filter((n) => last7(n.date));

  const bySector = diagnosticos.reduce<Record<string, number>>((acc, d) => {
    acc[d.sector] = (acc[d.sector] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-[color:var(--cream)] p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-stencil text-4xl mb-1">Leads & Diagnósticos</h1>
            <p className="text-xs font-mono text-black/60">{s.email}</p>
          </div>
          <div className="flex gap-2 text-xs">
            <a href="/admin" className="border-2 border-black px-3 py-2 hover:bg-black hover:text-[color:var(--mustard)] font-bold uppercase tracking-widest">Admin</a>
            <a href="/admin/metricas" className="border-2 border-black px-3 py-2 hover:bg-black hover:text-[color:var(--mustard)] font-bold uppercase tracking-widest">Métricas</a>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <Stat label="Solicitudes Beta" value={beta.length} accent="#EF4444" />
          <Stat label="Diagnósticos total" value={diagnosticos.length} accent="#14B8A6" />
          <Stat label="Diagnósticos últ. 7d" value={diag7.length} accent="#F5C518" />
          <Stat label="Diagnósticos últ. 30d" value={diag30.length} accent="#FF7A59" />
          <Stat label="Newsletter total" value={newsletter.length} accent="#3B82F6" />
        </div>

        {/* Beta */}
        <div className="card-hard p-5 bg-white mb-6 border-[color:var(--red)]">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h2 className="font-stencil text-2xl">🔒 Beta privada · {beta.filter(b => b.estado === "pendiente").length} pendientes · {Math.max(0, 10 - beta.filter(b => b.estado === "activo").length)} plazas libres de 10</h2>
          </div>
          {beta.length === 0 ? (
            <p className="text-sm text-black/50">Aún no hay solicitudes. Comparte aiteam.marketing/beta.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="border-b-2 border-black">
                  <tr>
                    <th className="text-left p-2">Fecha</th>
                    <th className="text-left p-2">Negocio</th>
                    <th className="text-left p-2">Sector</th>
                    <th className="text-left p-2">Ciudad</th>
                    <th className="text-left p-2">Nombre</th>
                    <th className="text-left p-2">Contacto</th>
                    <th className="text-left p-2">Agentes</th>
                    <th className="text-left p-2">Dolor</th>
                    <th className="text-left p-2">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {beta.slice().reverse().map((b, i) => (
                    <tr key={i} className="border-b border-black/10 align-top">
                      <td className="p-2 font-mono">{new Date(b.fecha).toLocaleDateString("es-ES")}</td>
                      <td className="p-2 font-bold">{b.negocio}</td>
                      <td className="p-2">{b.sector}</td>
                      <td className="p-2">{b.ciudad}</td>
                      <td className="p-2">{b.nombre}</td>
                      <td className="p-2">
                        <a href={`mailto:${b.email}`} className="block underline">{b.email}</a>
                        <a href={`https://wa.me/${b.whatsapp.replace(/[^\d]/g, "")}`} target="_blank" className="block underline text-[#25D366]">{b.whatsapp}</a>
                      </td>
                      <td className="p-2 text-[10px]">{b.agentesInteres?.join(", ") || "—"}</td>
                      <td className="p-2 max-w-[260px] text-[11px]">{b.porQue}</td>
                      <td className="p-2">
                        <BetaStatusSelector email={b.email} current={b.estado} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card-hard p-5 bg-white mb-6">
          <h2 className="font-stencil text-2xl mb-3">Diagnósticos por sector</h2>
          <div className="flex flex-wrap gap-3">
            {Object.entries(bySector).map(([sector, count]) => (
              <div key={sector} className="border-2 border-black px-3 py-2 text-sm">
                <span className="font-bold capitalize">{sector}</span>: {count}
              </div>
            ))}
            {Object.keys(bySector).length === 0 && (
              <p className="text-sm text-black/50">Sin datos todavía</p>
            )}
          </div>
        </div>

        <div className="card-hard p-5 bg-white mb-6">
          <h2 className="font-stencil text-2xl mb-3">Diagnósticos recientes</h2>
          {diagnosticos.length === 0 ? (
            <p className="text-sm text-black/50">Sin diagnósticos aún. Cuando alguien complete /diagnostico aparecerán aquí.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-black text-[color:var(--mustard)]">
                    <th className="text-left px-3 py-2 font-mono text-xs tracking-widest">FECHA</th>
                    <th className="text-left px-3 py-2 font-mono text-xs tracking-widest">NOMBRE</th>
                    <th className="text-left px-3 py-2 font-mono text-xs tracking-widest">NEGOCIO</th>
                    <th className="text-left px-3 py-2 font-mono text-xs tracking-widest">SECTOR</th>
                    <th className="text-left px-3 py-2 font-mono text-xs tracking-widest">CIUDAD</th>
                    <th className="text-left px-3 py-2 font-mono text-xs tracking-widest">EMAIL</th>
                    <th className="text-left px-3 py-2 font-mono text-xs tracking-widest">WHATSAPP</th>
                  </tr>
                </thead>
                <tbody>
                  {diagnosticos.slice().reverse().map((d, i) => (
                    <tr key={i} className={i % 2 === 0 ? "bg-[color:var(--cream)]/40" : "bg-white"}>
                      <td className="px-3 py-2 text-xs font-mono">{new Date(d.fecha).toLocaleDateString("es-ES")}</td>
                      <td className="px-3 py-2">{d.nombre}</td>
                      <td className="px-3 py-2 font-bold">{d.negocio}</td>
                      <td className="px-3 py-2 capitalize">{d.sector}</td>
                      <td className="px-3 py-2">{d.ciudad}</td>
                      <td className="px-3 py-2 text-xs">{d.email}</td>
                      <td className="px-3 py-2 text-xs">{d.whatsapp || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card-hard p-5 bg-white">
          <h2 className="font-stencil text-2xl mb-3">Newsletter ({newsletter.length})</h2>
          <p className="text-xs text-black/50 mb-3">Últimos 7 días: {news7.length}</p>
          {newsletter.length === 0 ? (
            <p className="text-sm text-black/50">Sin suscriptores aún.</p>
          ) : (
            <div className="text-xs space-y-1 max-h-60 overflow-y-auto">
              {newsletter.slice().reverse().slice(0, 50).map((n, i) => (
                <div key={i} className="flex justify-between border-b border-black/10 py-1">
                  <span>{n.email}</span>
                  <span className="text-black/40 font-mono">{new Date(n.date).toLocaleDateString("es-ES")}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="card-hard p-4 bg-white">
      <div className="font-stencil text-4xl" style={{ color: accent }}>{value}</div>
      <div className="text-[10px] font-mono uppercase tracking-widest text-black/60 mt-1">{label}</div>
    </div>
  );
}
