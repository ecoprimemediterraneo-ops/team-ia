"use client";

// Bandeja de conversaciones de Pablo: lista a la izquierda, hilo a la derecha.
//
// Solo lectura en esta iteración. El vocabulario ("clientas", "pacientes",
// "clientes del despacho") llega ya resuelto desde el servidor con el perfil de
// sector, para no repetir la lógica aquí.
//
// Estilo: el del panel (card-hard, cream, mostaza). No se inventa nada nuevo.

import { useState } from "react";
import type { Conversacion } from "@/lib/conversaciones";

type Vocab = { cliente: string; clientePlural: string };

function hora(ts: string): string {
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

function cuando(ts: string): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  const hoy = new Date();
  const mismoDia = d.toDateString() === hoy.toDateString();
  if (mismoDia) return hora(ts);
  const ayer = new Date(hoy);
  ayer.setDate(ayer.getDate() - 1);
  if (d.toDateString() === ayer.toDateString()) return "ayer";
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

function diaLargo(ts: string): string {
  const d = new Date(ts);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
}

/** Teléfono legible sin dar el número entero en la lista. */
function etiqueta(c: Conversacion): string {
  if (c.nombre) return c.nombre;
  const t = c.senderId;
  return t.length > 4 ? `··· ${t.slice(-4)}` : t;
}

export default function BandejaPablo({
  conversaciones,
  vocab,
}: {
  conversaciones: Conversacion[];
  vocab: Vocab;
}) {
  const [abierta, setAbierta] = useState<string | null>(conversaciones[0]?.senderId ?? null);
  const actual = conversaciones.find((c) => c.senderId === abierta) ?? null;

  // ---- Estado vacío: se dice lo que pasa, sin números inventados ----------
  if (conversaciones.length === 0) {
    return (
      <div className="card-hard bg-white p-6">
        <h3 className="font-stencil text-2xl mb-2">Todavía no hay conversaciones</h3>
        <p className="text-sm text-black/70 max-w-xl leading-relaxed">
          Aquí verás lo que hablan tus {vocab.clientePlural} con Pablo por WhatsApp, con el hilo
          completo de cada una. Aparecerán en cuanto alguien escriba a tu número.
        </p>
        <p className="text-xs text-black/50 mt-3">
          Se muestran las conversaciones de este mes y del anterior.
        </p>
      </div>
    );
  }

  return (
    <div className="card-hard bg-white overflow-hidden">
      <div className="grid md:grid-cols-[260px_1fr]">
        {/* ---------- Lista ---------- */}
        <div className="border-b-2 md:border-b-0 md:border-r-2 border-black max-h-[520px] overflow-y-auto">
          <div className="px-3 py-2 border-b-2 border-black bg-[color:var(--cream)] sticky top-0">
            <span className="text-[10px] font-mono uppercase tracking-widest text-black/60">
              {conversaciones.length} {conversaciones.length === 1 ? "conversación" : "conversaciones"}
            </span>
          </div>
          <ul>
            {conversaciones.map((c) => (
              <li key={c.senderId}>
                <button
                  type="button"
                  onClick={() => setAbierta(c.senderId)}
                  className={`w-full text-left px-3 py-2.5 border-b border-black/10 hover:bg-[color:var(--mustard)]/20 ${
                    c.senderId === abierta ? "bg-[color:var(--mustard)]/40" : ""
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-bold text-sm truncate">{etiqueta(c)}</span>
                    <span className="text-[10px] font-mono text-black/50 shrink-0">{cuando(c.ultimoTs)}</span>
                  </div>
                  <div className="text-xs text-black/60 truncate mt-0.5">
                    {c.ultimoDe === "agente" && <span className="text-black/40">Pablo: </span>}
                    {c.ultimoTexto || <span className="italic text-black/40">mensaje sin texto guardado</span>}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* ---------- Hilo ---------- */}
        <div className="max-h-[520px] overflow-y-auto bg-[color:var(--cream)]">
          {!actual ? (
            <p className="p-6 text-sm text-black/60">Elige una conversación de la lista.</p>
          ) : (
            <>
              <div className="px-4 py-2.5 border-b-2 border-black bg-white sticky top-0 flex items-baseline justify-between gap-2 flex-wrap">
                <span className="font-stencil text-lg leading-none">{etiqueta(actual)}</span>
                <span className="text-[10px] font-mono text-black/50">
                  {actual.mensajes.length} mensajes · {actual.entrantes} de la {vocab.cliente}
                </span>
              </div>

              <div className="p-4 space-y-3">
                {actual.mensajes.map((m, i) => {
                  // Separador de día cuando cambia la fecha.
                  const anterior = actual.mensajes[i - 1];
                  const nuevoDia =
                    !anterior || new Date(anterior.ts).toDateString() !== new Date(m.ts).toDateString();
                  return (
                    <div key={m.id}>
                      {nuevoDia && (
                        <div className="text-center my-3">
                          <span className="text-[10px] font-mono uppercase tracking-widest bg-black/5 px-2 py-1">
                            {diaLargo(m.ts)}
                          </span>
                        </div>
                      )}
                      <div className={`flex ${m.de === "agente" ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[85%] border-2 border-black px-3 py-2 ${
                            m.de === "agente" ? "bg-[color:var(--mustard)]" : "bg-white"
                          }`}
                        >
                          <div className="text-[10px] font-mono uppercase tracking-widest text-black/50 mb-0.5">
                            {m.de === "agente" ? "Pablo" : etiqueta(actual)} · {hora(m.ts)}
                            {m.tardoSeg !== undefined && ` · ${m.tardoSeg}s`}
                          </div>
                          {m.sinTexto ? (
                            <p className="text-sm italic text-black/50">
                              Mensaje anterior a que se guardara el texto. Se sabe que hubo mensaje, no cuál.
                            </p>
                          ) : (
                            <p className="text-sm whitespace-pre-wrap leading-relaxed">{m.texto}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Solo lectura en esta iteración: se dice, no se deja un campo que no envía. */}
              <div className="px-4 py-3 border-t-2 border-black bg-white text-xs text-black/55">
                De momento la bandeja es solo de lectura: para contestar, usa WhatsApp.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
