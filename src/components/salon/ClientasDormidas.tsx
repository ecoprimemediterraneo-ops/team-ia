"use client";

// CLIENTAS DORMIDAS — las que venían con regularidad y llevan tiempo sin volver.
// El dato ya lo calculaba el motor de reservas (`listClientasDormidasCompleto`);
// esto es la pantalla. Por cada una: cuánto tiempo, cuántas veces vino, con quién
// y a qué venía, y el mensaje ya redactado para que lo mande la dueña.
//
// NADA SE ENVÍA SOLO. "Copiar mensaje" copia el texto; el único envío que hay es
// el botón "Reactivar por email", que es el de siempre (`/api/booking/<slug>/reactivar`,
// con su anti-spam de 30 días) y solo aparece si la clienta tiene email.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { textoReactivacion } from "@/lib/salon-textos";

export type DormidaFila = {
  key: string; nombre: string; email: string; telefono?: string;
  diasSinVenir: number; visitas: number; ultimaCitaIso: string;
  servicioHabitual?: string; profesionalHabitual?: string;
  puedeEnviar: boolean; diasDesdeAviso?: number;
};

const fechaCorta = (iso: string) => { const [y, m, d] = iso.slice(0, 10).split("-"); return `${d}/${m}/${y.slice(2)}`; };
const tiempo = (d: number) => (d >= 60 ? `${Math.round(d / 30)} meses` : `${d} días`);

export default function ClientasDormidas({ slug, negocioNombre, dormidas }: { slug: string; negocioNombre: string; dormidas: DormidaFila[] }) {
  const router = useRouter();
  const [abierta, setAbierta] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");
  const [enviando, setEnviando] = useState<string | null>(null);

  async function copiar(texto: string) {
    try { await navigator.clipboard.writeText(texto); setAviso("✓ Mensaje copiado."); } catch { setAviso("No se ha podido copiar: selecciónalo y cópialo a mano."); }
  }

  async function enviarEmail(d: DormidaFila) {
    if (enviando) return;
    setEnviando(d.key); setAviso("");
    try {
      const r = await fetch(`/api/booking/${slug}/reactivar`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ keys: [d.key] }) });
      const j = await r.json();
      setAviso(r.ok && j.ok ? (j.enviados ? `✓ Email enviado a ${d.nombre}.` : "No se ha enviado (ya se le avisó hace poco).") : "No se ha podido enviar.");
      router.refresh();
    } catch { setAviso("Fallo de red. Inténtalo otra vez."); } finally { setEnviando(null); }
  }

  if (dormidas.length === 0) {
    return (
      <div className="card-hard bg-white p-5 text-sm text-black/70">
        No hay ninguna clienta dormida ahora mismo. <span className="text-black/40">(Dormida = venía, lleva más de 60 días sin volver y no tiene cita.)</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {dormidas.map((d) => {
        const texto = textoReactivacion(d.nombre, negocioNombre, d.diasSinVenir, d.servicioHabitual, d.profesionalHabitual);
        const abierto = abierta === d.key;
        return (
          <div key={d.key} className="card-hard bg-white">
            <button type="button" onClick={() => setAbierta(abierto ? null : d.key)} aria-expanded={abierto} className="w-full text-left p-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="font-bold">{d.nombre}</div>
                <div className="text-xs text-black/60">
                  {d.visitas} visita{d.visitas === 1 ? "" : "s"} · última {fechaCorta(d.ultimaCitaIso)}
                  {d.servicioHabitual ? ` · ${d.servicioHabitual.toLowerCase()}` : ""}
                  {d.profesionalHabitual ? ` con ${d.profesionalHabitual}` : ""}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-stencil text-xl leading-none">{tiempo(d.diasSinVenir)}</div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-black/40">sin venir</div>
              </div>
            </button>
            {abierto && (
              <div className="border-t-2 border-black/10 p-3 space-y-2">
                <div className="text-[10px] font-mono uppercase tracking-widest text-black/50">Mensaje para {d.nombre.split(" ")[0]}</div>
                <p className="border-2 border-dashed border-black/30 p-2 text-sm leading-snug select-all">{texto}</p>
                <div className="flex gap-2 flex-wrap items-center">
                  <button type="button" onClick={() => copiar(texto)} className="text-[11px] font-mono uppercase tracking-widest border-2 border-black px-3 py-1.5 hover:bg-black hover:text-white">
                    Copiar mensaje
                  </button>
                  {d.telefono && <span className="text-xs font-mono text-black/60">{d.telefono}</span>}
                  {d.puedeEnviar ? (
                    <button type="button" disabled={enviando !== null} onClick={() => enviarEmail(d)} className="text-[11px] font-mono uppercase tracking-widest bg-black text-white px-3 py-1.5 disabled:opacity-50">
                      {enviando === d.key ? "Enviando…" : "Reactivar por email"}
                    </button>
                  ) : d.email ? (
                    <span className="text-[11px] text-black/40">✓ ya avisada por email hace {d.diasDesdeAviso} días</span>
                  ) : (
                    <span className="text-[11px] text-black/40">sin email: solo por WhatsApp</span>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
      {aviso && <p className="text-xs font-bold text-black/70">{aviso}</p>}
    </div>
  );
}
