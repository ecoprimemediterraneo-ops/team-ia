"use client";

// La lista de hoy. Una sola columna, ordenada, sin filtros que esconder nada.
//
// EL AVISO DE ARRIBA NO SE PUEDE QUITAR. Un aviso con una X se cierra sin leer:
// el gestor le da a la cruz por reflejo y sigue. Este solo desaparece cuando lo
// que vence hoy o mañana está marcado como hecho, que es cuando de verdad se
// puede dejar de mirar.

import { useState, useTransition } from "react";
import { apuntar, hecho as marcarHecho, urgente as marcarUrgente, borrar } from "@/app/dashboard/hoy/actions";

export type TareaVista = {
  id: string;
  titulo: string;
  detalle?: string;
  clienteNombre?: string | null;
  vence?: string | null;
  origen: string;
  urgente?: boolean;
  hecho?: boolean;
  dias: number | null;
  rojo: boolean;
};

const ORIGEN: Record<string, { icono: string; texto: string }> = {
  expediente: { icono: "📁", texto: "Expediente" },
  factura_sin_asignar: { icono: "🧾", texto: "Factura sin asignar" },
  cargo_sin_justificar: { icono: "🏦", texto: "Cargo del banco" },
  correo: { icono: "✉️", texto: "Correo" },
  whatsapp: { icono: "💬", texto: "WhatsApp" },
  manual: { icono: "✍️", texto: "Apuntado por ti" },
};

function plazo(dias: number | null): string {
  if (dias === null) return "sin plazo";
  if (dias < 0) return `VENCIÓ hace ${-dias} día${dias === -1 ? "" : "s"}`;
  if (dias === 0) return "VENCE HOY";
  if (dias === 1) return "vence mañana";
  if (dias <= 7) return `faltan ${dias} días`;
  return `faltan ${dias} días`;
}

export default function ListaDeHoy({ tareas, hoy }: { tareas: TareaVista[]; hoy: string }) {
  const [enviando, empezar] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const [f, setF] = useState({ titulo: "", detalle: "", vence: "", clienteNombre: "", urgente: false });

  const bloqueantes = tareas.filter((t) => t.rojo);
  const vivas = tareas.filter((t) => !t.hecho);
  const hechas = tareas.filter((t) => t.hecho);

  const campo = "border-2 border-black px-2 py-1.5 text-sm bg-white w-full";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-stencil text-3xl md:text-4xl leading-none">Hoy</h1>
        <p className="text-sm text-black/60 mt-1">
          {vivas.length === 0
            ? "No tienes nada pendiente."
            : `${vivas.length} cosa${vivas.length === 1 ? "" : "s"} por hacer. Lo de arriba es lo que antes vence.`}
        </p>
      </div>

      {/* EL AVISO QUE NO SE PUEDE QUITAR */}
      {bloqueantes.length > 0 && (
        <div className="card-hard bg-[color:var(--red)] text-white p-4">
          <h2 className="font-stencil text-2xl leading-none mb-1">
            {bloqueantes.length === 1 ? "Esto vence ya" : `${bloqueantes.length} cosas vencen ya`}
          </h2>
          <p className="text-xs opacity-90 mb-2">
            Hoy o mañana, y sin hacer. Este aviso no se puede cerrar: se va cuando lo marques hecho.
          </p>
          <ul className="text-sm space-y-1">
            {bloqueantes.map((t) => (
              <li key={t.id} className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => empezar(async () => { await marcarHecho(t.id, true); })}
                  disabled={enviando}
                  className="text-[10px] font-mono uppercase border-2 border-white px-2 py-1 hover:bg-white hover:text-[color:var(--red)]"
                >
                  hecho
                </button>
                <span className="font-bold">{t.titulo}</span>
                {t.clienteNombre && <span className="opacity-80">· {t.clienteNombre}</span>}
                <span className="font-mono text-xs">· {plazo(t.dias)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Apuntar algo a mano */}
      {abierto ? (
        <div className="card-hard bg-white p-4 space-y-2">
          <div className="grid sm:grid-cols-2 gap-2">
            <input className={campo} placeholder="Qué hay que hacer" value={f.titulo}
              onChange={(e) => setF({ ...f, titulo: e.target.value })} />
            <input className={campo} placeholder="De qué cliente (opcional)" value={f.clienteNombre}
              onChange={(e) => setF({ ...f, clienteNombre: e.target.value })} />
            <input className={campo} type="date" value={f.vence}
              onChange={(e) => setF({ ...f, vence: e.target.value })} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={f.urgente} onChange={(e) => setF({ ...f, urgente: e.target.checked })} />
              Urgente (sube arriba del todo)
            </label>
          </div>
          <div className="flex gap-2">
            <button disabled={enviando} className="btn-mustard text-xs px-3 py-2"
              onClick={() => empezar(async () => {
                const r = await apuntar(f);
                if (r.ok) { setF({ titulo: "", detalle: "", vence: "", clienteNombre: "", urgente: false }); setAbierto(false); }
              })}>
              {enviando ? "GUARDANDO…" : "APUNTAR"}
            </button>
            <button onClick={() => setAbierto(false)} className="text-xs font-mono underline text-black/50">cerrar</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAbierto(true)} className="btn-mustard text-xs px-3 py-2">＋ APUNTAR ALGO</button>
      )}

      {/* La lista */}
      <div className="space-y-2">
        {vivas.map((t) => {
          const o = ORIGEN[t.origen] ?? ORIGEN.manual;
          return (
            <div key={t.id}
              className={`card-hard p-3 flex items-start gap-3 flex-wrap ${t.rojo ? "bg-[color:var(--red)] text-white" : t.urgente ? "bg-[color:var(--mustard)]" : "bg-white"}`}>
              <button
                onClick={() => empezar(async () => { await marcarHecho(t.id, true); })}
                disabled={enviando}
                title="Marcar como hecho"
                className={`text-[10px] font-mono uppercase border-2 px-2 py-1 shrink-0 ${t.rojo ? "border-white hover:bg-white hover:text-[color:var(--red)]" : "border-black hover:bg-black hover:text-white"}`}
              >
                hecho
              </button>
              <div className="flex-1 min-w-[12rem]">
                <div className="font-bold text-sm">{t.titulo}</div>
                <div className={`text-[11px] font-mono mt-0.5 ${t.rojo ? "opacity-90" : "text-black/60"}`}>
                  {o.icono} {o.texto}
                  {t.clienteNombre ? ` · ${t.clienteNombre}` : ""}
                  {" · "}
                  <span className={t.dias !== null && t.dias <= 1 ? "font-bold" : ""}>{plazo(t.dias)}</span>
                  {t.vence ? ` (${t.vence})` : ""}
                </div>
                {t.detalle && <div className={`text-[11px] mt-0.5 ${t.rojo ? "opacity-90" : "text-black/60"}`}>{t.detalle}</div>}
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => empezar(async () => { await marcarUrgente(t.id, !t.urgente); })}
                  disabled={enviando}
                  title="Tu palabra manda sobre la fecha"
                  className={`text-[10px] font-mono uppercase border-2 px-2 py-1 ${t.rojo ? "border-white" : "border-black"} ${t.urgente ? "bg-black text-white" : ""}`}
                >
                  {t.urgente ? "quitar urgente" : "urgente"}
                </button>
                {t.origen === "manual" && (
                  <button onClick={() => empezar(async () => { await borrar(t.id); })} disabled={enviando}
                    className={`text-[10px] font-mono uppercase border-2 px-2 py-1 ${t.rojo ? "border-white" : "border-black"}`}>
                    borrar
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {vivas.length === 0 && (
          <p className="text-sm text-black/60 italic">Nada pendiente. Cuando entre algo por WhatsApp o por correo, aparece aquí solo.</p>
        )}
      </div>

      {hechas.length > 0 && (
        <details className="card-hard bg-white p-3">
          <summary className="text-xs font-mono uppercase tracking-widest cursor-pointer">
            Hecho hoy · {hechas.length}
          </summary>
          <ul className="mt-2 space-y-1">
            {hechas.map((t) => (
              <li key={t.id} className="text-xs flex items-center gap-2">
                <button onClick={() => empezar(async () => { await marcarHecho(t.id, false); })}
                  className="text-[10px] font-mono uppercase border-2 border-black px-1.5 py-0.5">deshacer</button>
                <span className="line-through text-black/50">{t.titulo}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <p className="text-[11px] font-mono text-black/40">Día de hoy: {hoy} (Europe/Madrid)</p>
    </div>
  );
}
