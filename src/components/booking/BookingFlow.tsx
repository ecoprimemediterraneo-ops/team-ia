"use client";

// =============================================================================
// AI-Team Booking — flujo público estilo Booksy (consumidor final).
// Mobile-first. Landing (marca + galería + servicios por categoría) →
// servicio → variante/add-ons (si tiene) → huecos reales → datos → confirmado.
// "Reservar otra vez": pre-rellena datos del cliente guardados en el dispositivo.
// =============================================================================

import { useEffect, useMemo, useState } from "react";

type Variante = { id: string; nombre: string; durationMin: number; precioEUR: number };
type AddOn = { id: string; nombre: string; durationMin: number; precioEUR: number };
type Servicio = {
  id: string; nombre: string; descripcion?: string; fotoUrl?: string; categoriaId?: string;
  durationMin: number; precioEUR?: number; variantes: Variante[]; addons: AddOn[];
};
type Categoria = { id: string; nombre: string };
type EmpleadoPub = { id: string; nombre: string; color?: string; serviceIds: string[] };
type Negocio = { slug: string; nombre: string; descripcion?: string; galeria: string[]; timezone: string; categorias: Categoria[]; servicios: Servicio[]; empleados?: EmpleadoPub[] };

const DIAS_C = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MESES_C = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MESES_L = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const STORE_KEY = "aiteam-booking-cliente";

function ymd(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function proximosDias(n: number) {
  const base = new Date(), out: { value: string; wd: string; d: number; mes: string }[] = [];
  for (let i = 0; i < n; i++) { const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i); out.push({ value: ymd(d), wd: DIAS_C[d.getDay()], d: d.getDate(), mes: MESES_C[d.getMonth()] }); }
  return out;
}
function horaDe(iso: string) { return iso.slice(11, 16); }
function agrupaFranjas(slots: string[]): Record<"Mañana" | "Mediodía" | "Tarde", string[]> {
  const g: Record<"Mañana" | "Mediodía" | "Tarde", string[]> = { "Mañana": [], "Mediodía": [], "Tarde": [] };
  for (const s of slots) { const h = Number(s.slice(11, 13)); (h < 12 ? g["Mañana"] : h < 17 ? g["Mediodía"] : g["Tarde"]).push(s); }
  return g;
}
function fechaLarga(dateStr: string) { const [, m, d] = dateStr.split("-").map(Number); const wd = new Date(`${dateStr}T12:00:00Z`).getUTCDay(); return `${DIAS_C[wd]}. ${d} de ${MESES_L[m - 1]}`; }
function dur(min: number) { if (min >= 60) { const h = Math.floor(min / 60), r = min % 60; return r ? `${h} h ${r} min` : `${h} h`; } return `${min} min`; }
function precioServicio(s: Servicio): string {
  if (s.variantes.length) { const min = Math.min(...s.variantes.map((v) => v.precioEUR)); return `desde ${min} €`; }
  return typeof s.precioEUR === "number" ? `${s.precioEUR} €` : "";
}

export default function BookingFlow({ slug }: { slug: string }) {
  const [negocio, setNegocio] = useState<Negocio | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errNegocio, setErrNegocio] = useState("");

  const [paso, setPaso] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [catActiva, setCatActiva] = useState<string>("todos");
  const [servicio, setServicio] = useState<Servicio | null>(null);
  const [variante, setVariante] = useState<Variante | null>(null);
  const [addonsSel, setAddonsSel] = useState<Record<string, boolean>>({});

  const [empleadoSel, setEmpleadoSel] = useState<string>(""); // "" = cualquiera
  const [fecha, setFecha] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsReason, setSlotsReason] = useState("");
  const [cargandoSlots, setCargandoSlots] = useState(false);
  const [slot, setSlot] = useState("");
  const [espera, setEspera] = useState<"idle" | "form" | "hecho">("idle");

  const [form, setForm] = useState({ nombre: "", telefono: "", email: "" });
  const [conocido, setConocido] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [hecho, setHecho] = useState<{ cancelUrl: string; startIso: string; precioEUR?: number; empleado?: string } | null>(null);

  const dias = useMemo(() => proximosDias(21), []);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const r = await fetch(`/api/booking/${slug}`);
        const j = await r.json();
        if (!vivo) return;
        if (!r.ok || !j.ok) setErrNegocio("No encontramos este negocio.");
        else setNegocio(j.negocio);
      } catch { if (vivo) setErrNegocio("No se pudo cargar. Inténtalo de nuevo."); }
      finally { if (vivo) setCargando(false); }
    })();
    // Pre-rellenar datos del cliente si ya reservó antes en este dispositivo.
    try { const s = JSON.parse(localStorage.getItem(STORE_KEY) || "null"); if (s?.nombre) { setForm(s); setConocido(true); } } catch { /* */ }
    return () => { vivo = false; };
  }, [slug]);

  // Duración y precio total según variante + add-ons elegidos.
  const total = useMemo(() => {
    if (!servicio) return { durationMin: 0, precioEUR: 0 };
    const base = variante ? variante : { durationMin: servicio.durationMin, precioEUR: servicio.precioEUR ?? 0 };
    const extras = servicio.addons.filter((a) => addonsSel[a.id]);
    return {
      durationMin: base.durationMin + extras.reduce((s, a) => s + a.durationMin, 0),
      precioEUR: base.precioEUR + extras.reduce((s, a) => s + a.precioEUR, 0),
    };
  }, [servicio, variante, addonsSel]);

  async function cargarSlots(f: string, empId: string = empleadoSel) {
    if (!servicio) return;
    setCargandoSlots(true); setSlots([]); setSlotsReason(""); setSlot(""); setEspera("idle");
    const addons = servicio.addons.filter((a) => addonsSel[a.id]).map((a) => a.id).join(",");
    const qs = new URLSearchParams({ serviceId: servicio.id, date: f });
    if (variante) qs.set("variantId", variante.id);
    if (addons) qs.set("addons", addons);
    if (empId) qs.set("empleadoId", empId);
    try {
      const r = await fetch(`/api/booking/${slug}/slots?${qs}`);
      const j = await r.json();
      if (j.ok) setSlots(j.slots); else setSlotsReason(j.reason || "error");
    } catch { setSlotsReason("error"); }
    finally { setCargandoSlots(false); }
  }

  function elegirServicio(s: Servicio) {
    setServicio(s); setVariante(null); setAddonsSel({}); setEmpleadoSel(""); setError("");
    if (s.variantes.length || s.addons.length) { setPaso(2); }
    else { setPaso(3); const hoy = dias[0].value; setFecha(hoy); setTimeout(() => cargarSlots(hoy, ""), 0); }
  }
  function irAFecha() {
    if (servicio?.variantes.length && !variante) { setError("Elige una opción."); return; }
    setError(""); setPaso(3); const hoy = dias[0].value; setFecha(hoy); cargarSlots(hoy, empleadoSel);
  }
  function elegirEmpleado(id: string) { setEmpleadoSel(id); if (fecha) cargarSlots(fecha, id); }
  function elegirFecha(f: string) { setFecha(f); cargarSlots(f); }
  function elegirSlot(sl: string) { setSlot(sl); setError(""); setPaso(4); }

  async function confirmar(e: React.FormEvent) {
    e.preventDefault(); setError("");
    if (!form.nombre.trim() || form.telefono.trim().length < 6) { setError("Necesitamos tu nombre y un teléfono válido."); return; }
    if (!servicio || !slot) return;
    setEnviando(true);
    try {
      const addonIds = servicio.addons.filter((a) => addonsSel[a.id]).map((a) => a.id);
      const r = await fetch(`/api/booking/${slug}/reservar`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId: servicio.id, variantId: variante?.id, addonIds, empleadoId: empleadoSel || undefined, startIso: slot, nombre: form.nombre.trim(), telefono: form.telefono.trim(), email: form.email.trim() || undefined }),
      });
      const j = await r.json();
      if (r.ok && j.ok) {
        try { localStorage.setItem(STORE_KEY, JSON.stringify({ nombre: form.nombre.trim(), telefono: form.telefono.trim(), email: form.email.trim() })); } catch { /* */ }
        setHecho({ cancelUrl: j.cancelUrl, startIso: j.cita.startIso, precioEUR: j.cita.precioEUR, empleado: j.cita.empleado }); setPaso(5);
      } else if (j.reason === "slot_taken") { setError("Ese hueco acaba de ocuparse. Elige otro."); setPaso(3); cargarSlots(fecha); }
      else setError(j.message || "No se pudo completar la reserva.");
    } catch { setError("Fallo de red. Inténtalo de nuevo."); }
    finally { setEnviando(false); }
  }

  async function apuntarseEspera() {
    if (!servicio) return;
    if (!form.nombre.trim() || form.telefono.trim().length < 6) { setError("Necesitamos tu nombre y un teléfono válido."); return; }
    setEnviando(true); setError("");
    try {
      const r = await fetch(`/api/booking/${slug}/espera`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId: servicio.id, variantId: variante?.id, empleadoId: empleadoSel || undefined, fecha, nombre: form.nombre.trim(), telefono: form.telefono.trim(), email: form.email.trim() || undefined }),
      });
      if (r.ok) { setEspera("hecho"); try { localStorage.setItem(STORE_KEY, JSON.stringify({ nombre: form.nombre.trim(), telefono: form.telefono.trim(), email: form.email.trim() })); } catch { /* */ } }
      else setError("No se pudo apuntar. Inténtalo de nuevo.");
    } catch { setError("Fallo de red."); }
    finally { setEnviando(false); }
  }

  if (cargando) return <Centro><div className="animate-pulse text-black/50 font-mono text-sm">Cargando…</div></Centro>;
  if (errNegocio || !negocio) return <Centro><div className="card-hard p-6 bg-white text-center max-w-sm"><div className="text-4xl mb-2">🔍</div><p className="font-bold">{errNegocio || "Negocio no disponible."}</p></div></Centro>;

  const cats = negocio.categorias;
  const serviciosFiltrados = catActiva === "todos" ? negocio.servicios : negocio.servicios.filter((s) => s.categoriaId === catActiva);
  const nombreCat = (id?: string) => cats.find((c) => c.id === id)?.nombre;
  const empleadosElegibles = servicio ? (negocio.empleados || []).filter((e) => !e.serviceIds?.length || e.serviceIds.includes(servicio.id)) : [];

  return (
    <div className="max-w-lg mx-auto px-4 py-6 sm:py-8">
      {/* Cabecera del negocio (mini-web) */}
      <header className="mb-5">
        <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-black/40">Reserva tu cita</div>
        <h1 className="font-stencil text-3xl sm:text-4xl leading-none mt-1">{negocio.nombre}</h1>
        {negocio.descripcion && paso === 1 && <p className="text-sm text-black/60 mt-2">{negocio.descripcion}</p>}
      </header>

      {/* Galería (solo en la landing) */}
      {paso === 1 && negocio.galeria.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-3 -mx-1 px-1 mb-4">
          {negocio.galeria.map((src, i) => (
            <img key={i} src={src} alt="" className="h-28 w-40 object-cover border-[3px] border-black shrink-0" onError={(e) => ((e.currentTarget.style.display = "none"))} />
          ))}
        </div>
      )}

      {paso > 1 && paso < 5 && <Pasos paso={paso} tieneOpciones={!!(servicio?.variantes.length || servicio?.addons.length)} />}

      {error && paso !== 5 ? <div className="mb-4 border-[3px] border-[color:var(--red)] bg-white text-[color:var(--red)] text-sm font-bold px-3 py-2">⚠ {error}</div> : null}

      {/* PASO 1 — Servicios por categoría */}
      {paso === 1 && (
        <section>
          {conocido && (
            <div className="card-hard bg-[color:var(--mustard)] p-3 mb-4 text-sm">👋 Hola de nuevo, <b>{form.nombre}</b>. Tus datos ya están guardados: reserva otra vez en 2 toques.</div>
          )}
          {cats.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 mb-3">
              {[{ id: "todos", nombre: "Todos" }, ...cats].map((c) => (
                <button key={c.id} onClick={() => setCatActiva(c.id)} className={`shrink-0 px-3 py-1.5 text-xs font-bold border-2 border-black ${catActiva === c.id ? "bg-black text-[color:var(--mustard)]" : "bg-white"}`}>{c.nombre}</button>
              ))}
            </div>
          )}
          <div className="space-y-3">
            {serviciosFiltrados.map((s) => (
              <button key={s.id} onClick={() => elegirServicio(s)} className="w-full text-left card-hard bg-white overflow-hidden hover:translate-x-[1px] hover:translate-y-[1px] transition-transform flex">
                {s.fotoUrl ? <img src={s.fotoUrl} alt="" className="w-24 h-auto object-cover border-r-[3px] border-black shrink-0" onError={(e) => (e.currentTarget.style.display = "none")} /> : null}
                <div className="p-4 flex items-center justify-between gap-3 flex-1 min-w-0">
                  <div className="min-w-0">
                    {cats.length > 1 && nombreCat(s.categoriaId) && <div className="text-[10px] font-mono uppercase tracking-wider text-black/35">{nombreCat(s.categoriaId)}</div>}
                    <div className="font-bold leading-snug">{s.nombre}</div>
                    {s.descripcion && <div className="text-xs text-black/55 mt-0.5 line-clamp-2">{s.descripcion}</div>}
                    <div className="text-xs text-black/50 mt-1">{s.variantes.length ? "varias opciones" : dur(s.durationMin)}{s.addons.length ? " · + extras" : ""}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {precioServicio(s) && <span className="font-stencil text-lg whitespace-nowrap">{precioServicio(s)}</span>}
                    <span className="text-[color:var(--red)] font-bold text-xl">›</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* PASO 2 — Variante + add-ons */}
      {paso === 2 && servicio && (
        <section>
          <Encabezado titulo={servicio.nombre} onBack={() => setPaso(1)} back="cambiar servicio" />
          {servicio.variantes.length > 0 && (
            <div className="mb-5">
              <h3 className="font-bold text-sm mb-2">Elige una opción</h3>
              <div className="space-y-2">
                {servicio.variantes.map((v) => (
                  <button key={v.id} onClick={() => setVariante(v)} className={`w-full text-left card-hard p-3 flex items-center justify-between ${variante?.id === v.id ? "bg-[color:var(--mustard)]" : "bg-white"}`}>
                    <div><div className="font-bold">{v.nombre}</div><div className="text-xs text-black/55">{dur(v.durationMin)}</div></div>
                    <div className="font-stencil text-lg">{v.precioEUR} €</div>
                  </button>
                ))}
              </div>
            </div>
          )}
          {servicio.addons.length > 0 && (
            <div className="mb-5">
              <h3 className="font-bold text-sm mb-2">¿Añadir algún extra? <span className="font-normal text-black/40">(opcional)</span></h3>
              <div className="space-y-2">
                {servicio.addons.map((a) => (
                  <label key={a.id} className={`card-hard p-3 flex items-center justify-between cursor-pointer ${addonsSel[a.id] ? "bg-[color:var(--mustard)]" : "bg-white"}`}>
                    <div className="flex items-center gap-3">
                      <input type="checkbox" checked={!!addonsSel[a.id]} onChange={(e) => setAddonsSel({ ...addonsSel, [a.id]: e.target.checked })} className="w-4 h-4 accent-black" />
                      <div><div className="font-bold">{a.nombre}</div><div className="text-xs text-black/55">+{dur(a.durationMin)}</div></div>
                    </div>
                    <div className="font-stencil text-lg">+{a.precioEUR} €</div>
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="card-hard bg-black text-[color:var(--cream)] p-3 mb-4 flex items-center justify-between">
            <span className="text-sm">Total: {dur(total.durationMin)}</span>
            <span className="font-stencil text-2xl text-[color:var(--mustard)]">{total.precioEUR} €</span>
          </div>
          <button onClick={irAFecha} className="btn-mustard w-full text-center">Ver horarios →</button>
        </section>
      )}

      {/* PASO 3 — Día y hora */}
      {paso === 3 && servicio && (
        <section>
          <Encabezado titulo="Elige día y hora" onBack={() => setPaso(servicio.variantes.length || servicio.addons.length ? 2 : 1)} back="atrás" />
          <div className="text-sm text-black/60 mb-4">
            <b>{[servicio.nombre, variante?.nombre].filter(Boolean).join(" · ")}</b> · {dur(total.durationMin)} · {total.precioEUR} €
          </div>
          {empleadosElegibles.length >= 2 && (
            <div className="mb-4">
              <h3 className="font-bold text-sm mb-2">¿Con quién?</h3>
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => elegirEmpleado("")} className={`px-3 py-1.5 text-sm font-bold border-2 border-black ${empleadoSel === "" ? "bg-black text-[color:var(--mustard)]" : "bg-white hover:bg-[color:var(--cream)]"}`}>Cualquiera</button>
                {empleadosElegibles.map((e) => (
                  <button key={e.id} onClick={() => elegirEmpleado(e.id)} className={`px-3 py-1.5 text-sm font-bold border-2 border-black flex items-center gap-1.5 ${empleadoSel === e.id ? "bg-black text-[color:var(--mustard)]" : "bg-white hover:bg-[color:var(--cream)]"}`}>
                    <span className="w-3 h-3 border border-black shrink-0" style={{ background: e.color || "#eee" }} />{e.nombre}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
            {dias.map((d) => (
              <button key={d.value} onClick={() => elegirFecha(d.value)} className={`shrink-0 w-14 py-2 border-[3px] border-black text-center ${d.value === fecha ? "bg-black text-[color:var(--mustard)]" : "bg-white hover:bg-[color:var(--cream)]"}`}>
                <div className="text-[10px] font-mono uppercase">{d.wd}</div>
                <div className="font-stencil text-lg leading-none">{d.d}</div>
                <div className="text-[10px] font-mono">{d.mes}</div>
              </button>
            ))}
          </div>
          <div className="mt-4">
            {cargandoSlots ? <div className="text-sm text-black/40 font-mono py-6 text-center animate-pulse">Buscando huecos libres…</div>
              : slotsReason === "no_calendar" ? <Vacio emoji="🔌" t="Agenda no conectada" x="Este negocio aún no ha conectado su agenda. Prueba más tarde." />
              : slotsReason ? <Vacio emoji="😕" t="No pudimos cargar los huecos" x="Inténtalo de nuevo." />
              : slots.length === 0 ? (
                <div className="card-hard bg-white p-6 text-center">
                  <div className="text-4xl mb-2">🌙</div>
                  <div className="font-bold">Sin huecos ese día</div>
                  <p className="text-sm text-black/55 mt-1">Prueba con otro día{empleadoSel ? " o con otro profesional" : ""}.</p>
                  {espera === "hecho" ? (
                    <div className="mt-4 border-2 border-black bg-[color:var(--mustard)] p-3 text-sm font-bold">🔔 ¡Hecho! Te avisamos por email en cuanto se libere un hueco ese día.</div>
                  ) : espera === "form" ? (
                    <div className="mt-4 text-left space-y-2">
                      <p className="text-xs text-black/50">Te avisamos si alguien cancela. Sin compromiso.</p>
                      <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Tu nombre" className="w-full border-[3px] border-black px-3 py-2.5 bg-white" />
                      <div className="grid grid-cols-2 gap-2">
                        <input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} placeholder="Teléfono" type="tel" className="border-[3px] border-black px-3 py-2.5 bg-white" />
                        <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" type="email" className="border-[3px] border-black px-3 py-2.5 bg-white" />
                      </div>
                      <button onClick={apuntarseEspera} disabled={enviando} className="btn-mustard w-full disabled:opacity-60">{enviando ? "Apuntando…" : "Apuntarme a la lista de espera"}</button>
                    </div>
                  ) : (
                    <button onClick={() => setEspera("form")} className="btn-mustard mt-4 text-sm">🔔 Avísame si se libera</button>
                  )}
                </div>
              )
              : (() => { const g = agrupaFranjas(slots); return (
                <div className="space-y-4">
                  {(["Mañana", "Mediodía", "Tarde"] as const).map((f) => g[f].length ? (
                    <div key={f}>
                      <div className="text-xs font-mono uppercase tracking-widest text-black/40 mb-1.5">{f} ({g[f].length})</div>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">{g[f].map((sl) => <button key={sl} onClick={() => elegirSlot(sl)} className="py-2.5 border-[3px] border-black bg-white font-bold text-sm hover:bg-[color:var(--mustard)]">{horaDe(sl)}</button>)}</div>
                    </div>
                  ) : null)}
                </div>
              ); })()}
          </div>
        </section>
      )}

      {/* PASO 4 — Datos */}
      {paso === 4 && servicio && slot && (
        <section>
          <Encabezado titulo="Tus datos" onBack={() => setPaso(3)} back="cambiar hora" />
          <div className="card-hard bg-[color:var(--mustard)] p-4 mb-5">
            <div className="font-bold">{[servicio.nombre, variante?.nombre].filter(Boolean).join(" · ")}</div>
            {servicio.addons.filter((a) => addonsSel[a.id]).length > 0 && <div className="text-sm">+ {servicio.addons.filter((a) => addonsSel[a.id]).map((a) => a.nombre).join(", ")}</div>}
            {empleadoSel && <div className="text-sm">Con {empleadosElegibles.find((e) => e.id === empleadoSel)?.nombre}</div>}
            <div className="text-sm mt-0.5">{fechaLarga(fecha)} · {horaDe(slot)} · {dur(total.durationMin)} · <b>{total.precioEUR} €</b></div>
          </div>
          {conocido && <button onClick={() => { setForm({ nombre: "", telefono: "", email: "" }); setConocido(false); }} className="text-xs font-mono underline text-black/50 mb-2">No soy {form.nombre}, cambiar datos</button>}
          <form onSubmit={confirmar} className="space-y-3">
            <Campo label="Tu nombre" value={form.nombre} onChange={(v) => setForm({ ...form, nombre: v })} placeholder="Nombre y apellido" />
            <Campo label="Teléfono" value={form.telefono} onChange={(v) => setForm({ ...form, telefono: v })} placeholder="+34 600 000 000" type="tel" />
            <Campo label="Email (para recordatorio)" value={form.email} onChange={(v) => setForm({ ...form, email: v })} placeholder="tucorreo@email.com" type="email" opcional />
            <button type="submit" disabled={enviando} className="btn-mustard w-full text-center text-base disabled:opacity-60 disabled:cursor-wait mt-2">{enviando ? "Reservando…" : "Confirmar cita →"}</button>
            <p className="text-[11px] text-center text-black/45 mt-1">Cancelación gratis siempre, sin comisiones.</p>
          </form>
        </section>
      )}

      {/* PASO 5 — Confirmado */}
      {paso === 5 && hecho && servicio && (
        <section className="text-center py-4">
          <div className="text-6xl mb-3">✅</div>
          <h2 className="font-stencil text-3xl mb-2">¡Cita confirmada!</h2>
          <div className="card-hard bg-white p-5 text-left w-full mt-2">
            <div className="font-bold text-lg">{[servicio.nombre, variante?.nombre].filter(Boolean).join(" · ")}</div>
            <div className="text-sm text-black/70 mt-1">{fechaLarga(hecho.startIso.slice(0, 10))} · {horaDe(hecho.startIso)}{typeof hecho.precioEUR === "number" ? ` · ${hecho.precioEUR} €` : ""}</div>
            {hecho.empleado && <div className="text-sm text-black/70">Con {hecho.empleado}</div>}
            <div className="text-sm text-black/70">{negocio.nombre}</div>
          </div>
          <p className="text-sm text-black/60 mt-5">{form.email ? "Te hemos enviado la confirmación por email." : "Guarda esta pantalla como confirmación."}</p>
          <div className="mt-3 flex flex-col items-center gap-2">
            <a href={hecho.cancelUrl} className="text-sm font-bold underline text-[color:var(--red)]">Cancelar o reprogramar (gratis)</a>
            <button onClick={() => { setPaso(1); setServicio(null); setVariante(null); setAddonsSel({}); setEmpleadoSel(""); setSlot(""); setHecho(null); }} className="text-xs font-mono underline text-black/45">Reservar otro servicio</button>
          </div>
        </section>
      )}

      <footer className="mt-10 text-center text-[10px] font-mono uppercase tracking-widest text-black/30">Reservas con AI-Team · sin comisiones</footer>
    </div>
  );
}

function Pasos({ paso, tieneOpciones }: { paso: number; tieneOpciones: boolean }) {
  const items = tieneOpciones ? ["Servicio", "Opciones", "Día y hora", "Datos"] : ["Servicio", "Día y hora", "Datos"];
  // paso: 1 servicio · 2 opciones · 3 fecha · 4 datos. Sin opciones el flujo salta el 2.
  const idx = tieneOpciones ? paso - 1 : paso <= 1 ? 0 : paso - 2;
  return (
    <div className="flex items-center gap-2 mb-5">
      {items.map((t, i) => {
        const activo = i === idx, done = i < idx;
        return (
          <div key={t} className="flex items-center gap-2 flex-1">
            <div className={`w-6 h-6 shrink-0 border-2 border-black flex items-center justify-center text-xs font-bold ${activo ? "bg-black text-[color:var(--mustard)]" : done ? "bg-[color:var(--mustard)]" : "bg-white text-black/40"}`}>{done ? "✓" : i + 1}</div>
            <span className={`text-[11px] font-mono uppercase tracking-wider ${activo ? "text-black" : "text-black/40"} hidden sm:inline`}>{t}</span>
            {i < items.length - 1 && <div className="flex-1 h-0.5 bg-black/15" />}
          </div>
        );
      })}
    </div>
  );
}

function Encabezado({ titulo, onBack, back }: { titulo: string; onBack: () => void; back: string }) {
  return <div className="flex items-center justify-between mb-3"><h2 className="font-bold text-lg">{titulo}</h2><button onClick={onBack} className="text-xs font-mono underline text-black/50">{back}</button></div>;
}
function Vacio({ emoji, t, x }: { emoji: string; t: string; x: string }) {
  return <div className="card-hard bg-white p-6 text-center"><div className="text-4xl mb-2">{emoji}</div><div className="font-bold">{t}</div><p className="text-sm text-black/55 mt-1">{x}</p></div>;
}
function Campo({ label, value, onChange, placeholder, type = "text", opcional }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; opcional?: boolean }) {
  return (
    <label className="block">
      <span className="block text-sm font-bold mb-1">{label} {opcional && <span className="text-black/40 font-normal">(opcional)</span>}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full border-[3px] border-black px-3 py-2.5 text-base bg-white focus:outline-none focus:shadow-[3px_3px_0_var(--red)]" />
    </label>
  );
}
function Centro({ children }: { children: React.ReactNode }) { return <div className="min-h-screen flex items-center justify-center px-4">{children}</div>; }
