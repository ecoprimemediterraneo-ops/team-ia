// /reservas/<slug>/huecos — EL ENLACE DE HUECOS LIBRES.
//
// Solo huecos: días y horas libres de los próximos 7 días para un servicio. Ni
// un nombre, ni una cita de otra persona, ni quién está ocupado: lo que se ve
// aquí es exactamente lo que la página de reservas ofrecería. Cada hora lleva a
// la reserva con el servicio y la hora ya elegidos (solo faltan nombre y
// teléfono).
//
// Es el enlace que manda Pablo cuando, tras dos rondas, no encuentra una hora
// que le venga bien al cliente (ver `guion-huecos.ts`), y el que se puede
// compartir tal cual.
//
//   ?servicio=<id o nombre>   el servicio (por defecto, el primero)
//   ?profesional=<id>         solo los huecos de esa profesional

import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getBusinessBySlug, computeFreeSlots, resolverServicio, empleadosDeServicio, servicioParaTexto } from "@/lib/booking";
import { getRedirectUri } from "@/lib/gmail";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return { title: "Huecos libres", robots: { index: false } };
}

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
function sumarDias(f: string, n: number): string {
  const d = new Date(`${f}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export default async function HuecosPage({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ servicio?: string; profesional?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const negocio = await getBusinessBySlug(slug);
  if (!negocio) notFound();

  const activos = negocio.servicios.filter((s) => s.activo);
  const servicio =
    activos.find((s) => s.id === sp.servicio) ||
    (sp.servicio ? servicioParaTexto(negocio, sp.servicio) : undefined) ||
    activos[0];
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const redirectUri = getRedirectUri(host, proto);
  const tz = negocio.timezone || "Europe/Madrid";
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: tz });

  const dias: { fecha: string; slots: string[] }[] = [];
  let problema = "";
  if (servicio) {
    const sel = resolverServicio(servicio, {});
    const eleg = empleadosDeServicio(negocio, servicio.id);
    const quienes = eleg.length ? (sp.profesional ? eleg.filter((e) => e.id === sp.profesional) : eleg) : [undefined];
    for (let i = 0; i < 7; i++) {
      const fecha = sumarDias(hoy, i);
      const set = new Set<string>();
      for (const e of quienes) {
        const r = await computeFreeSlots(negocio, sel, fecha, redirectUri, undefined, e?.id);
        if (r.ok) r.slots.forEach((x) => set.add(x.slice(0, 19)));
        else problema = r.detail || "No se ha podido consultar la agenda.";
      }
      dias.push({ fecha, slots: [...set].sort() });
    }
  }
  const hayAlguno = dias.some((d) => d.slots.length);

  return (
    <main className="min-h-screen bg-[color:var(--cream)] px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-5">
        <div>
          <div className="text-xs font-mono uppercase tracking-widest text-black/50">{negocio.nombre}</div>
          <h1 className="font-stencil text-4xl leading-none mt-1">Huecos libres</h1>
          <p className="text-sm text-black/60 mt-2">Toca la hora que te venga bien y termina la reserva en un momento.</p>
        </div>

        {activos.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {activos.map((s) => (
              <a key={s.id} href={`/reservas/${slug}/huecos?servicio=${s.id}`}
                className={`text-xs border-2 border-black px-2 py-1 ${s.id === servicio?.id ? "bg-black text-white" : "bg-white"}`}>
                {s.nombre}
              </a>
            ))}
          </div>
        )}

        {problema && !hayAlguno ? (
          <div className="card-hard bg-white p-5 text-sm">{problema}</div>
        ) : !hayAlguno ? (
          <div className="card-hard bg-white p-5 text-sm">No quedan huecos libres esta semana para {servicio?.nombre.toLowerCase() ?? "este servicio"}. Escríbenos y te buscamos algo.</div>
        ) : (
          <div className="space-y-3">
            {dias.filter((d) => d.slots.length).map((d) => {
              const f = new Date(`${d.fecha}T12:00:00Z`);
              return (
                <div key={d.fecha} className="card-hard bg-white p-4">
                  <div className="font-stencil text-lg leading-none mb-2">
                    {d.fecha === hoy ? "Hoy" : d.fecha === sumarDias(hoy, 1) ? "Mañana" : DIAS[f.getUTCDay()]} {f.getUTCDate()} de {MESES[f.getUTCMonth()]}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {d.slots.map((s) => (
                      <a key={s} href={`/reservas/${slug}?servicio=${servicio!.id}&hora=${encodeURIComponent(s)}${sp.profesional ? `&profesional=${sp.profesional}` : ""}`}
                        className="text-sm font-mono border-2 border-black px-2 py-1 bg-[color:var(--cream)] hover:bg-[color:var(--mustard)]">
                        {s.slice(11, 16)}
                      </a>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <a href={`/reservas/${slug}`} className="text-sm underline">Ver todos los servicios</a>
      </div>
    </main>
  );
}
