import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import fs from "node:fs/promises";
import path from "node:path";

const FOUNDER_EMAILS = [
  process.env.FOUNDER_EMAIL || "ecoprimemediterraneo@gmail.com",
  "crisasky@gmail.com",
];
const DATA_DIR = process.env.VERCEL ? "/tmp/aiteam-data" : path.join(process.cwd(), "data");

async function readJson<T>(file: string, fallback: T): Promise<T> {
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

export default async function AdminLeadsPage() {
  const s = await getSession();
  if (!s) redirect("/login");
  if (!FOUNDER_EMAILS.includes(s.email)) {
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

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Stat label="Diagnósticos total" value={diagnosticos.length} accent="#14B8A6" />
          <Stat label="Diagnósticos últ. 7d" value={diag7.length} accent="#F5C518" />
          <Stat label="Diagnósticos últ. 30d" value={diag30.length} accent="#FF7A59" />
          <Stat label="Newsletter total" value={newsletter.length} accent="#3B82F6" />
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
