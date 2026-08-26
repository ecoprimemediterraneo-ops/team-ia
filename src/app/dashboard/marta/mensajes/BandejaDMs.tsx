"use client";

// La bandeja de DMs de Instagram. Lo mínimo que se puede usar y grabar: una
// lista, una conversación, un cuadro de texto y un botón.
//
// Deliberadamente NO tiene búsqueda, adjuntos, paginación, marcar como leído ni
// plantillas. Cada una de esas cosas es una pantalla nueva que mantener, y
// ninguna hace falta ni para contestar a un cliente ni para el vídeo de Meta.
//
// LA CUENTA CONECTADA SE VE SIEMPRE. No es decoración: el revisor exige ver el
// activo seleccionado EN EL MOMENTO DEL ENVÍO ("asset selection... a live send
// action from your app"), así que la cabecera con el @usuario acompaña a la
// conversación y no se queda solo en la pestaña de conectar.

import { useActionState, useEffect, useRef, useState } from "react";
import { enviarDmAction } from "./actions";
import { ENVIO_QUIETO, type EstadoEnvio } from "./estado";
import type { ConversacionDm } from "@/lib/marta-inbox";
import { traductor, localeDe, type Idioma, type T, type ClaveTexto } from "@/lib/idioma";

type ConversacionVista = ConversacionDm & {
  ventanaAbierta: boolean;
  horasQueQuedan: number;
};

function hora(iso: string, idioma: Idioma): string {
  const d = new Date(iso);
  const hoy = new Date();
  const mismoDia = d.toDateString() === hoy.toDateString();
  const loc = localeDe(idioma);
  return mismoDia
    ? d.toLocaleTimeString(loc, { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleString(loc, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** El fallo del envío, dicho en el idioma de la pantalla. */
const MOTIVO: Record<string, ClaveTexto> = {
  vacio: "envio_vacio",
  sin_cuenta: "envio_sin_cuenta",
  fuera_ventana: "envio_fuera_ventana",
  token: "envio_token",
  config: "envio_config",
  generico: "envio_generico",
  sesion: "envio_sesion",
  sin_destino: "envio_sin_destino",
};

function motivoDe(estado: EstadoEnvio, t: T): string {
  // El `motivo` en castellano sigue viniendo del servidor y vale de red de
  // seguridad: si algún día aparece un código nuevo sin entrada, se ve el texto
  // en español antes que una pantalla en blanco.
  const clave = estado.codigo ? MOTIVO[estado.codigo] : undefined;
  return clave ? t(clave) : (estado.motivo ?? "");
}

export default function BandejaDMs({
  conversaciones,
  cuenta,
  idioma = "es",
}: {
  conversaciones: ConversacionVista[];
  cuenta: string;
  idioma?: Idioma;
}) {
  const t = traductor(idioma);
  const [abiertaId, setAbiertaId] = useState<string | null>(conversaciones[0]?.igsid ?? null);
  const abierta = conversaciones.find((c) => c.igsid === abiertaId) ?? null;

  return (
    <div className="space-y-4">
      {/* LA CUENTA, SIEMPRE VISIBLE. */}
      <div className="card-hard bg-white p-3 flex items-center gap-3 flex-wrap">
        <span
          className="w-9 h-9 border-2 border-black flex items-center justify-center text-lg shrink-0"
          style={{ background: "#E1306C" }}
          aria-hidden
        >
          📷
        </span>
        <div className="min-w-0">
          <div className="text-[10px] font-mono uppercase tracking-widest text-black/50">
            {t("band_enviando_desde")}
          </div>
          <div className="font-stencil text-xl leading-none break-all">@{cuenta}</div>
        </div>
        <span className="ml-auto text-[10px] font-mono uppercase tracking-widest bg-[#14B8A6] text-white border-2 border-black px-2 py-1">
          {t("ficha_conectada")}
        </span>
      </div>

      {conversaciones.length === 0 ? (
        <div className="card-hard bg-white p-5 text-sm text-black/60">
          <p className="font-bold text-black mb-1">{t("band_vacia_titulo")}</p>
          <p className="leading-snug">{t("band_vacia_texto", { cuenta: `@${cuenta}` })}</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-[260px_1fr] gap-4 items-start">
          {/* La lista */}
          <ul className="card-hard bg-white p-1 space-y-1 max-h-[28rem] overflow-y-auto">
            {conversaciones.map((c) => {
              const ultimo = c.mensajes[c.mensajes.length - 1];
              const on = c.igsid === abiertaId;
              return (
                <li key={c.igsid}>
                  <button
                    type="button"
                    onClick={() => setAbiertaId(c.igsid)}
                    className={`w-full text-left px-3 py-2 border-2 ${
                      on ? "bg-black text-white border-black" : "border-transparent hover:bg-black/5"
                    }`}
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="font-bold text-sm truncate">
                        {c.usuario ? `@${c.usuario}` : c.igsid}
                      </span>
                      {!c.ventanaAbierta && (
                        <span
                          className={`ml-auto text-[9px] font-mono uppercase shrink-0 ${on ? "text-white/60" : "text-black/40"}`}
                          title={t("band_cerrada_tip")}
                        >
                          {t("band_cerrada")}
                        </span>
                      )}
                    </div>
                    <div className={`text-xs truncate ${on ? "text-white/70" : "text-black/55"}`}>
                      {ultimo ? `${ultimo.de === "nosotros" ? t("band_tu_prefijo") : ""}${ultimo.texto}` : "—"}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>

          {/* La conversación */}
          {abierta ? (
            <Conversacion key={abierta.igsid} c={abierta} t={t} idioma={idioma} />
          ) : (
            <div className="card-hard bg-white p-5 text-sm text-black/60">
              {t("band_elige")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Conversacion({ c, t, idioma }: { c: ConversacionVista; t: T; idioma: Idioma }) {
  const [estado, formAction, pendiente] = useActionState(enviarDmAction, ENVIO_QUIETO);
  const form = useRef<HTMLFormElement>(null);
  const fondo = useRef<HTMLDivElement>(null);

  // Al enviar bien se limpia el cuadro. Dejar el texto escrito después de que
  // haya salido invita a mandarlo dos veces.
  useEffect(() => {
    if (estado.estado === "ok") form.current?.reset();
  }, [estado]);

  // Abajo del todo: lo último dicho es lo que importa.
  useEffect(() => {
    if (fondo.current) fondo.current.scrollTop = fondo.current.scrollHeight;
  }, [c.mensajes.length, estado]);

  return (
    <div className="card-hard bg-white p-4 space-y-3">
      <div className="flex items-baseline gap-2 flex-wrap border-b-2 border-black/10 pb-2">
        <span className="font-stencil text-xl leading-none">
          {c.usuario ? `@${c.usuario}` : t("band_conversacion")}
        </span>
        <span className="text-[10px] font-mono text-black/45">{c.igsid}</span>
      </div>

      <div ref={fondo} className="space-y-2 max-h-[20rem] overflow-y-auto">
        {c.mensajes.map((m) => (
          <div key={m.id} className={m.de === "nosotros" ? "text-right" : ""}>
            <div
              className={`inline-block border-2 border-black px-3 py-2 text-sm max-w-[85%] text-left ${
                m.de === "nosotros" ? "bg-black text-white" : "bg-[color:var(--cream)]"
              }`}
            >
              {m.texto}
            </div>
            <div className="text-[10px] font-mono text-black/40 mt-0.5">
              {m.de === "nosotros" ? t("band_tu") : c.usuario ? `@${c.usuario}` : t("band_cliente")} ·{" "}
              {hora(m.ts, idioma)}
              {m.via === "automatico" && ` · ${t("band_automatico")}`}
            </div>
          </div>
        ))}
      </div>

      {/* FUERA DE LA VENTANA: no se ofrece un botón que va a fallar. */}
      {c.ventanaAbierta ? (
        <form ref={form} action={formAction} className="space-y-2 border-t-2 border-black/10 pt-3">
          <input type="hidden" name="igsid" value={c.igsid} />
          <textarea
            name="texto"
            rows={2}
            required
            placeholder={t("band_escribe")}
            className="w-full border-2 border-black px-3 py-2 text-sm resize-none"
          />
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="submit"
              disabled={pendiente}
              title={t("band_enviar_tip")}
              className="btn-mustard text-sm px-6 py-2.5 font-bold disabled:opacity-50"
            >
              {pendiente ? t("band_enviando") : t("band_enviar")}
            </button>
            <span className="text-[11px] font-mono text-black/45">
              {t("band_quedan_horas", { n: c.horasQueQuedan })}
            </span>
          </div>
          {estado.estado === "error" && (
            <p className="text-sm bg-[color:var(--red)] text-white border-2 border-black px-3 py-2">
              {motivoDe(estado, t)}
            </p>
          )}
          {estado.estado === "ok" && (
            <p className="text-sm bg-[#14B8A6] text-white border-2 border-black px-3 py-2">
              {t("band_enviado")}
            </p>
          )}
        </form>
      ) : (
        <div className="border-t-2 border-black/10 pt-3">
          <textarea
            rows={2}
            disabled
            placeholder={t("band_no_escribir")}
            className="w-full border-2 border-black/30 bg-black/5 px-3 py-2 text-sm resize-none"
          />
          <p className="text-xs bg-[color:var(--mustard)] border-2 border-black px-3 py-2 mt-2 leading-snug">
            <strong>{t("band_fuera_negrita")}</strong>
            {t("band_fuera_texto")}
          </p>
        </div>
      )}
    </div>
  );
}
