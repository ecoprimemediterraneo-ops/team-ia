"use client";

// Panel del dueño (estilo Booksy) — marca, galería, categorías, servicios (con
// variantes, add-ons y padding), horario y ajustes. Guarda vía POST config.

import { useState } from "react";

type Variante = { id: string; nombre: string; durationMin: number; precioEUR: number };
type AddOn = { id: string; nombre: string; durationMin: number; precioEUR: number; activo: boolean };
type Categoria = { id: string; nombre: string };
type Servicio = {
  id: string; nombre: string; descripcion?: string; fotoUrl?: string; categoriaId?: string;
  durationMin: number; precioEUR?: number; paddingBeforeMin?: number; paddingAfterMin?: number;
  variantes?: Variante[]; addons?: AddOn[]; activo: boolean;
};
type Franja = { desde: string; hasta: string };
type DayHours = { abierto: boolean; franjas: Franja[] };
type Horario = Record<number, DayHours>;
type Empleado = { id: string; nombre: string; color?: string; activo: boolean; horario?: Horario; serviceIds?: string[] };
type Negocio = {
  slug: string; nombre: string; descripcion?: string; galeria?: string[]; timezone: string;
  slotStepMin: number; leadTimeMin: number; cancelAntelacionMin: number;
  categorias: Categoria[]; servicios: Servicio[]; empleados?: Empleado[]; horario: Horario;
};

const COLORES = ["#C8202A", "#5A6B3F", "#F5C518", "#2A6BC8", "#8E44AD", "#111111"];

const DIAS = [
  { n: 1, label: "Lunes" }, { n: 2, label: "Martes" }, { n: 3, label: "Miércoles" },
  { n: 4, label: "Jueves" }, { n: 5, label: "Viernes" }, { n: 6, label: "Sábado" }, { n: 0, label: "Domingo" },
];
const uid = (p: string) => `${p}_${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;

export default function OwnerConfig({ negocios }: { negocios: Negocio[] }) {
  const [slug, setSlug] = useState(negocios[0].slug);
  const base = negocios.find((n) => n.slug === slug) || negocios[0];

  const [nombre, setNombre] = useState(base.nombre);
  const [descripcion, setDescripcion] = useState(base.descripcion || "");
  const [galeria, setGaleria] = useState<string[]>(base.galeria || []);
  const [categorias, setCategorias] = useState<Categoria[]>(base.categorias);
  const [servicios, setServicios] = useState<Servicio[]>(base.servicios);
  const [empleados, setEmpleados] = useState<Empleado[]>(base.empleados || []);
  const [horario, setHorario] = useState<Horario>(normHorario(base.horario));
  const [slotStepMin, setSlotStepMin] = useState(base.slotStepMin);
  const [leadTimeMin, setLeadTimeMin] = useState(base.leadTimeMin);
  const [cancelAntelacionMin, setCancelAntelacionMin] = useState(base.cancelAntelacionMin ?? 120);
  const [abiertos, setAbiertos] = useState<Record<string, boolean>>({});

  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState("");
  const [copiado, setCopiado] = useState(false);

  const publicUrl = typeof window !== "undefined" ? `${window.location.origin}/reservas/${slug}` : `/reservas/${slug}`;

  function cambiarNegocio(s: string) {
    const n = negocios.find((x) => x.slug === s)!;
    setSlug(s); setNombre(n.nombre); setDescripcion(n.descripcion || ""); setGaleria(n.galeria || []);
    setCategorias(n.categorias); setServicios(n.servicios); setEmpleados(n.empleados || []); setHorario(normHorario(n.horario));
    setSlotStepMin(n.slotStepMin); setLeadTimeMin(n.leadTimeMin); setCancelAntelacionMin(n.cancelAntelacionMin ?? 120); setMsg("");
  }

  // ── categorías ──
  const setCat = (i: number, nombre: string) => setCategorias((p) => p.map((c, idx) => (idx === i ? { ...c, nombre } : c)));
  const addCat = () => setCategorias((p) => [...p, { id: uid("cat"), nombre: "" }]);
  const delCat = (i: number) => setCategorias((p) => p.filter((_, idx) => idx !== i));

  // ── servicios ──
  const setSvc = (i: number, patch: Partial<Servicio>) => setServicios((p) => p.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  const addSvc = () => setServicios((p) => [...p, { id: uid("svc"), nombre: "", durationMin: 30, precioEUR: undefined, activo: true, categoriaId: categorias[0]?.id }]);
  const delSvc = (i: number) => setServicios((p) => p.filter((_, idx) => idx !== i));
  const setVar = (si: number, vi: number, patch: Partial<Variante>) => setServicios((p) => p.map((s, i) => (i === si ? { ...s, variantes: (s.variantes || []).map((v, j) => (j === vi ? { ...v, ...patch } : v)) } : s)));
  const addVar = (si: number) => setServicios((p) => p.map((s, i) => (i === si ? { ...s, variantes: [...(s.variantes || []), { id: uid("v"), nombre: "", durationMin: s.durationMin, precioEUR: s.precioEUR ?? 0 }] } : s)));
  const delVar = (si: number, vi: number) => setServicios((p) => p.map((s, i) => (i === si ? { ...s, variantes: (s.variantes || []).filter((_, j) => j !== vi) } : s)));
  const setAdd = (si: number, ai: number, patch: Partial<AddOn>) => setServicios((p) => p.map((s, i) => (i === si ? { ...s, addons: (s.addons || []).map((a, j) => (j === ai ? { ...a, ...patch } : a)) } : s)));
  const addAdd = (si: number) => setServicios((p) => p.map((s, i) => (i === si ? { ...s, addons: [...(s.addons || []), { id: uid("a"), nombre: "", durationMin: 15, precioEUR: 0, activo: true }] } : s)));
  const delAdd = (si: number, ai: number) => setServicios((p) => p.map((s, i) => (i === si ? { ...s, addons: (s.addons || []).filter((_, j) => j !== ai) } : s)));

  // ── personal (empleados) ──
  const setEmp = (i: number, patch: Partial<Empleado>) => setEmpleados((p) => p.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  const addEmp = () => setEmpleados((p) => [...p, { id: uid("emp"), nombre: "", color: COLORES[p.length % COLORES.length], activo: true, serviceIds: [] }]);
  const delEmp = (i: number) => setEmpleados((p) => p.filter((_, idx) => idx !== i));
  const toggleEmpSvc = (i: number, svcId: string) => setEmpleados((p) => p.map((e, idx) => (idx === i ? { ...e, serviceIds: (e.serviceIds || []).includes(svcId) ? (e.serviceIds || []).filter((x) => x !== svcId) : [...(e.serviceIds || []), svcId] } : e)));

  // ── horario ──
  const setDay = (n: number, patch: Partial<DayHours>) => setHorario((p) => ({ ...p, [n]: { ...p[n], ...patch } }));
  const setFranja = (n: number, i: number, patch: Partial<Franja>) => setHorario((p) => ({ ...p, [n]: { ...p[n], franjas: p[n].franjas.map((f, idx) => (idx === i ? { ...f, ...patch } : f)) } }));
  const addFranja = (n: number) => setHorario((p) => ({ ...p, [n]: { ...p[n], franjas: [...p[n].franjas, { desde: "09:00", hasta: "14:00" }] } }));
  const delFranja = (n: number, i: number) => setHorario((p) => ({ ...p, [n]: { ...p[n], franjas: p[n].franjas.filter((_, idx) => idx !== i) } }));

  async function guardar() {
    setGuardando(true); setMsg("");
    try {
      const r = await fetch(`/api/booking/${slug}/config`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombre.trim(), descripcion: descripcion.trim(), galeria: galeria.filter((g) => g.trim()),
          slotStepMin, leadTimeMin, cancelAntelacionMin,
          categorias: categorias.filter((c) => c.nombre.trim()),
          servicios: servicios.filter((s) => s.nombre.trim()).map((s) => ({
            ...s,
            precioEUR: s.precioEUR === undefined || Number.isNaN(s.precioEUR) ? undefined : Number(s.precioEUR),
            fotoUrl: s.fotoUrl?.trim() || undefined,
            variantes: (s.variantes || []).filter((v) => v.nombre.trim()),
            addons: (s.addons || []).filter((a) => a.nombre.trim()),
          })),
          empleados: empleados.filter((e) => e.nombre.trim()).map((e) => ({ ...e, serviceIds: e.serviceIds || [] })),
          horario,
        }),
      });
      const j = await r.json();
      setMsg(r.ok && j.ok ? "✓ Guardado" : `⚠ ${j.error || "No se pudo guardar"}`);
    } catch { setMsg("⚠ Fallo de red"); }
    finally { setGuardando(false); }
  }

  const inp = "border-2 border-black px-2 py-1.5 text-sm bg-white";

  return (
    <div className="space-y-6">
      {negocios.length > 1 && (
        <select value={slug} onChange={(e) => cambiarNegocio(e.target.value)} className="border-[3px] border-black px-3 py-2 text-sm bg-white">
          {negocios.map((n) => <option key={n.slug} value={n.slug}>{n.nombre}</option>)}
        </select>
      )}

      {/* URL pública */}
      <div className="card-hard bg-black text-[color:var(--cream)] p-4">
        <div className="text-[11px] font-mono uppercase tracking-widest text-white/50 mb-1">Tu URL pública de reservas</div>
        <div className="flex items-center gap-2 flex-wrap">
          <code className="text-[color:var(--mustard)] text-sm break-all">{publicUrl}</code>
          <button onClick={() => { navigator.clipboard?.writeText(publicUrl); setCopiado(true); setTimeout(() => setCopiado(false), 1500); }} className="text-xs border-2 border-white/40 px-2 py-1 hover:bg-white/10">{copiado ? "¡copiado!" : "copiar"}</button>
          <a href={publicUrl} target="_blank" rel="noreferrer" className="text-xs border-2 border-[color:var(--mustard)] text-[color:var(--mustard)] px-2 py-1 hover:bg-[color:var(--mustard)] hover:text-black">abrir</a>
        </div>
      </div>

      {/* Marca */}
      <section className="space-y-3">
        <label className="block"><span className="block text-sm font-bold mb-1">Nombre del negocio</span>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={`w-full ${inp}`} /></label>
        <label className="block"><span className="block text-sm font-bold mb-1">Descripción (mini-web)</span>
          <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={2} className={`w-full ${inp}`} placeholder="Centro de estética y belleza…" /></label>
        <div>
          <div className="flex items-center justify-between mb-1"><span className="text-sm font-bold">Galería (URLs de fotos)</span><button onClick={() => setGaleria((g) => [...g, ""])} className="text-xs font-mono underline text-black/50">+ foto</button></div>
          <div className="space-y-1">
            {galeria.map((g, i) => (
              <div key={i} className="flex gap-2">
                <input value={g} onChange={(e) => setGaleria((prev) => prev.map((x, idx) => (idx === i ? e.target.value : x)))} placeholder="https://…" className={`flex-1 ${inp}`} />
                <button onClick={() => setGaleria((prev) => prev.filter((_, idx) => idx !== i))} className="text-xs text-[color:var(--red)] border-2 border-[color:var(--red)] px-2">✕</button>
              </div>
            ))}
            {galeria.length === 0 && <p className="text-xs text-black/40">Sin fotos. Pega URLs de imágenes (subida de archivos: próximamente).</p>}
          </div>
        </div>
      </section>

      {/* Categorías */}
      <section>
        <div className="flex items-center justify-between mb-2"><h2 className="font-stencil text-2xl">Categorías</h2><button onClick={addCat} className="btn-mustard text-xs px-3 py-2">+ Añadir</button></div>
        <div className="grid sm:grid-cols-2 gap-2">
          {categorias.map((c, i) => (
            <div key={c.id} className="flex gap-2">
              <input value={c.nombre} onChange={(e) => setCat(i, e.target.value)} placeholder="Nombre de categoría" className={`flex-1 ${inp}`} />
              <button onClick={() => delCat(i)} className="text-xs text-[color:var(--red)] border-2 border-[color:var(--red)] px-2">✕</button>
            </div>
          ))}
        </div>
      </section>

      {/* Servicios */}
      <section>
        <div className="flex items-center justify-between mb-2"><h2 className="font-stencil text-2xl">Servicios</h2><button onClick={addSvc} className="btn-mustard text-xs px-3 py-2">+ Añadir</button></div>
        <div className="space-y-3">
          {servicios.map((s, i) => {
            const open = abiertos[s.id];
            return (
              <div key={s.id} className={`card-hard bg-white p-3 ${s.activo ? "" : "opacity-50"}`}>
                <div className="grid grid-cols-12 gap-2 items-end">
                  <label className="col-span-12 sm:col-span-5 text-xs"><span className="block text-black/50 mb-0.5">Nombre</span>
                    <input value={s.nombre} onChange={(e) => setSvc(i, { nombre: e.target.value })} placeholder="Servicio" className={`w-full ${inp}`} /></label>
                  <label className="col-span-6 sm:col-span-3 text-xs"><span className="block text-black/50 mb-0.5">Categoría</span>
                    <select value={s.categoriaId || ""} onChange={(e) => setSvc(i, { categoriaId: e.target.value || undefined })} className={`w-full ${inp}`}>
                      <option value="">—</option>{categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select></label>
                  <label className="col-span-3 sm:col-span-2 text-xs"><span className="block text-black/50 mb-0.5">Min</span>
                    <input type="number" min={5} step={5} value={s.durationMin} onChange={(e) => setSvc(i, { durationMin: Number(e.target.value) })} className={`w-full ${inp}`} /></label>
                  <label className="col-span-3 sm:col-span-2 text-xs"><span className="block text-black/50 mb-0.5">€</span>
                    <input type="number" min={0} value={s.precioEUR ?? ""} onChange={(e) => setSvc(i, { precioEUR: e.target.value === "" ? undefined : Number(e.target.value) })} className={`w-full ${inp}`} /></label>
                </div>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <button onClick={() => setAbiertos((a) => ({ ...a, [s.id]: !open }))} className="text-xs font-mono underline text-black/60">{open ? "▾ menos opciones" : "▸ descripción, foto, padding, variantes, extras"}</button>
                  <div className="ml-auto flex gap-1">
                    <button onClick={() => setSvc(i, { activo: !s.activo })} className={`text-xs border-2 border-black px-2 py-1 ${s.activo ? "bg-[color:var(--mustard)]" : "bg-white"}`}>{s.activo ? "Activo" : "Oculto"}</button>
                    <button onClick={() => delSvc(i)} className="text-xs border-2 border-[color:var(--red)] text-[color:var(--red)] px-2 py-1">✕</button>
                  </div>
                </div>

                {open && (
                  <div className="mt-3 pt-3 border-t border-black/10 space-y-3">
                    <label className="block text-xs"><span className="block text-black/50 mb-0.5">Descripción</span>
                      <textarea value={s.descripcion || ""} onChange={(e) => setSvc(i, { descripcion: e.target.value })} rows={2} className={`w-full ${inp}`} /></label>
                    <label className="block text-xs"><span className="block text-black/50 mb-0.5">Foto (URL, opcional)</span>
                      <input value={s.fotoUrl || ""} onChange={(e) => setSvc(i, { fotoUrl: e.target.value })} placeholder="https://…" className={`w-full ${inp}`} /></label>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <label><span className="block text-black/50 mb-0.5">Padding antes (min)</span>
                        <input type="number" min={0} step={5} value={s.paddingBeforeMin ?? 0} onChange={(e) => setSvc(i, { paddingBeforeMin: Number(e.target.value) })} className={`w-full ${inp}`} /></label>
                      <label><span className="block text-black/50 mb-0.5">Padding después (min)</span>
                        <input type="number" min={0} step={5} value={s.paddingAfterMin ?? 0} onChange={(e) => setSvc(i, { paddingAfterMin: Number(e.target.value) })} className={`w-full ${inp}`} /></label>
                    </div>

                    {/* Variantes */}
                    <div>
                      <div className="flex items-center justify-between mb-1"><span className="text-xs font-bold">Variantes (opciones de duración/precio)</span><button onClick={() => addVar(i)} className="text-xs font-mono underline text-black/50">+ variante</button></div>
                      <div className="space-y-1">
                        {(s.variantes || []).map((v, vi) => (
                          <div key={v.id} className="flex gap-1 items-center">
                            <input value={v.nombre} onChange={(e) => setVar(i, vi, { nombre: e.target.value })} placeholder="Ej. Piernas" className={`flex-1 ${inp}`} />
                            <input type="number" min={5} step={5} value={v.durationMin} onChange={(e) => setVar(i, vi, { durationMin: Number(e.target.value) })} className={`w-16 ${inp}`} title="min" />
                            <input type="number" min={0} value={v.precioEUR} onChange={(e) => setVar(i, vi, { precioEUR: Number(e.target.value) })} className={`w-16 ${inp}`} title="€" />
                            <button onClick={() => delVar(i, vi)} className="text-xs text-[color:var(--red)] border-2 border-[color:var(--red)] px-1.5">✕</button>
                          </div>
                        ))}
                        {(s.variantes || []).length === 0 && <p className="text-[11px] text-black/40">Sin variantes: se usa la duración/precio de arriba.</p>}
                      </div>
                    </div>

                    {/* Add-ons */}
                    <div>
                      <div className="flex items-center justify-between mb-1"><span className="text-xs font-bold">Extras (add-ons)</span><button onClick={() => addAdd(i)} className="text-xs font-mono underline text-black/50">+ extra</button></div>
                      <div className="space-y-1">
                        {(s.addons || []).map((a, ai) => (
                          <div key={a.id} className={`flex gap-1 items-center ${a.activo ? "" : "opacity-50"}`}>
                            <input value={a.nombre} onChange={(e) => setAdd(i, ai, { nombre: e.target.value })} placeholder="Ej. Máscara LED" className={`flex-1 ${inp}`} />
                            <input type="number" min={0} step={5} value={a.durationMin} onChange={(e) => setAdd(i, ai, { durationMin: Number(e.target.value) })} className={`w-16 ${inp}`} title="+min" />
                            <input type="number" min={0} value={a.precioEUR} onChange={(e) => setAdd(i, ai, { precioEUR: Number(e.target.value) })} className={`w-16 ${inp}`} title="+€" />
                            <button onClick={() => setAdd(i, ai, { activo: !a.activo })} className={`text-xs border-2 border-black px-1.5 py-1 ${a.activo ? "bg-[color:var(--mustard)]" : "bg-white"}`}>{a.activo ? "On" : "Off"}</button>
                            <button onClick={() => delAdd(i, ai)} className="text-xs text-[color:var(--red)] border-2 border-[color:var(--red)] px-1.5">✕</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Personal */}
      <section>
        <div className="flex items-center justify-between mb-2"><h2 className="font-stencil text-2xl">Personal</h2><button onClick={addEmp} className="btn-mustard text-xs px-3 py-2">+ Añadir</button></div>
        <p className="text-xs text-black/50 mb-2">Cada profesional y qué servicios realiza. Si no marcas ninguno, hace todos. La disponibilidad y elección por empleado en la web llega en la próxima entrega (Fase 2b).</p>
        <div className="space-y-3">
          {empleados.map((e, i) => (
            <div key={e.id} className={`card-hard bg-white p-3 ${e.activo ? "" : "opacity-50"}`}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="w-4 h-4 border-2 border-black shrink-0" style={{ background: e.color || "#eee" }} />
                <input value={e.nombre} onChange={(ev) => setEmp(i, { nombre: ev.target.value })} placeholder="Nombre" className={`flex-1 min-w-[110px] ${inp}`} />
                <div className="flex gap-1">
                  {COLORES.map((c) => (
                    <button key={c} onClick={() => setEmp(i, { color: c })} className={`w-6 h-6 border-2 ${e.color === c ? "border-black" : "border-black/20"}`} style={{ background: c }} aria-label={`color ${c}`} />
                  ))}
                </div>
                <button onClick={() => setEmp(i, { activo: !e.activo })} className={`text-xs border-2 border-black px-2 py-1 ${e.activo ? "bg-[color:var(--mustard)]" : "bg-white"}`}>{e.activo ? "Activo" : "Oculto"}</button>
                <button onClick={() => delEmp(i)} className="text-xs border-2 border-[color:var(--red)] text-[color:var(--red)] px-2 py-1">✕</button>
              </div>
              <div className="mt-2">
                <div className="text-[11px] text-black/50 mb-1">Servicios que realiza {(!e.serviceIds || e.serviceIds.length === 0) && <span className="text-black/40">· (todos)</span>}</div>
                <div className="flex flex-wrap gap-1">
                  {servicios.filter((s) => s.nombre.trim()).map((s) => {
                    const on = (e.serviceIds || []).includes(s.id);
                    return (
                      <button key={s.id} onClick={() => toggleEmpSvc(i, s.id)} className={`text-[11px] border-2 border-black px-2 py-0.5 ${on ? "bg-black text-white" : "bg-white hover:bg-[color:var(--cream)]"}`}>{s.nombre || "—"}</button>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
          {empleados.length === 0 && <p className="text-xs text-black/40">Sin personal. Con 0 profesionales el negocio funciona como agenda única (como hasta ahora).</p>}
        </div>
      </section>

      {/* Horario */}
      <section>
        <h2 className="font-stencil text-2xl mb-2">Horario de atención</h2>
        <div className="space-y-2">
          {DIAS.map(({ n, label }) => {
            const d = horario[n];
            return (
              <div key={n} className="card-hard bg-white p-3">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 font-bold text-sm"><input type="checkbox" checked={d.abierto} onChange={(e) => setDay(n, { abierto: e.target.checked })} className="w-4 h-4 accent-black" />{label}</label>
                  {d.abierto && <button onClick={() => addFranja(n)} className="text-xs font-mono underline text-black/50">+ franja</button>}
                </div>
                {d.abierto && (
                  <div className="mt-2 space-y-2">
                    {d.franjas.length === 0 && <p className="text-xs text-black/40">Sin franjas — añade una.</p>}
                    {d.franjas.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <input type="time" value={f.desde} onChange={(e) => setFranja(n, i, { desde: e.target.value })} className="border-2 border-black px-2 py-1" />
                        <span className="text-black/40">a</span>
                        <input type="time" value={f.hasta} onChange={(e) => setFranja(n, i, { hasta: e.target.value })} className="border-2 border-black px-2 py-1" />
                        <button onClick={() => delFranja(n, i)} className="text-xs text-[color:var(--red)] border-2 border-[color:var(--red)] px-1.5 py-1">✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Ajustes */}
      <section className="grid grid-cols-3 gap-3">
        <label className="block text-sm"><span className="block font-bold mb-1 text-xs">Hueco cada (min)</span><input type="number" min={5} max={60} step={5} value={slotStepMin} onChange={(e) => setSlotStepMin(Number(e.target.value))} className={`w-full ${inp}`} /></label>
        <label className="block text-sm"><span className="block font-bold mb-1 text-xs">Antelación reserva (min)</span><input type="number" min={0} max={1440} step={15} value={leadTimeMin} onChange={(e) => setLeadTimeMin(Number(e.target.value))} className={`w-full ${inp}`} /></label>
        <label className="block text-sm"><span className="block font-bold mb-1 text-xs">Antelación cancelar (min)</span><input type="number" min={0} max={10080} step={30} value={cancelAntelacionMin} onChange={(e) => setCancelAntelacionMin(Number(e.target.value))} className={`w-full ${inp}`} /></label>
      </section>

      {/* Guardar */}
      <div className="flex items-center gap-3 sticky bottom-0 bg-[color:var(--cream)] py-3 border-t-2 border-black/10">
        <button onClick={guardar} disabled={guardando} className="btn-mustard disabled:opacity-60 disabled:cursor-wait">{guardando ? "Guardando…" : "Guardar cambios"}</button>
        {msg && <span className={`text-sm font-bold ${msg.startsWith("✓") ? "text-[color:var(--olive)]" : "text-[color:var(--red)]"}`}>{msg}</span>}
      </div>
    </div>
  );
}

function normHorario(h: Horario): Horario {
  const out: Horario = {} as Horario;
  for (let n = 0; n < 7; n++) out[n] = h[n] ? { abierto: h[n].abierto, franjas: [...(h[n].franjas || [])] } : { abierto: false, franjas: [] };
  return out;
}
