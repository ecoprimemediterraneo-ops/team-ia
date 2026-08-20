"use client";

// Mandarle un documento al cliente, desde su ficha.
//
// Va en la pantalla de facturas del cliente porque es donde el gestor ya está
// cuando el cliente le escribe "mándame el 303". No hay que ir a otro sitio ni
// buscar el chat: el botón está donde está el cliente.

import { useState } from "react";

type Resultado = {
  enviado: boolean; modo: string; mensaje: string; motivo?: string; detalle?: string;
  cliente: string; telefono: string; envioEncendido: boolean; modoSugerido: string;
};

export default function EnviarDocumento({ clienteId, clienteNombre }: { clienteId: string; clienteNombre: string }) {
  const [abierto, setAbierto] = useState(false);
  const [descripcion, setDescripcion] = useState("");
  const [modo, setModo] = useState<"" | "fichero" | "enlace">("");
  const [fichero, setFichero] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [r, setR] = useState<Resultado | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function enviar() {
    if (!fichero) return;
    setEnviando(true); setError(null); setR(null);
    try {
      const form = new FormData();
      form.append("clienteId", clienteId);
      form.append("documento", fichero);
      if (descripcion) form.append("descripcion", descripcion);
      if (modo) form.append("modo", modo);
      const res = await fetch("/api/gestoria/enviar-doc", { method: "POST", body: form });
      const j = await res.json();
      if (!res.ok) { setError(j.error || "no se ha podido enviar"); return; }
      setR(j);
    } finally { setEnviando(false); }
  }

  if (!abierto) {
    return (
      <button onClick={() => setAbierto(true)} className="text-xs font-mono uppercase tracking-widest border-2 border-black px-3 py-2 hover:bg-black hover:text-white">
        📤 Mandarle un documento
      </button>
    );
  }

  const campo = "w-full border-2 border-black px-2 py-1.5 text-sm bg-white";

  return (
    <div className="card-hard bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-stencil text-xl leading-none">Mandarle un documento a {clienteNombre}</h3>
        <button onClick={() => setAbierto(false)} className="text-xs font-mono underline text-black/50">cerrar</button>
      </div>
      <p className="text-xs text-black/60">
        Le llega al mismo chat de WhatsApp donde te manda las facturas. No tiene que entrar a ningún sitio.
      </p>

      <div className="grid sm:grid-cols-2 gap-3">
        <label className="text-xs font-mono uppercase tracking-wide text-black/60">
          Documento
          <input type="file" className={`${campo} mt-1`} accept=".pdf,.png,.jpg,.jpeg,.xlsx,.csv"
            onChange={(e) => { setFichero(e.target.files?.[0] ?? null); setR(null); }} />
        </label>
        <label className="text-xs font-mono uppercase tracking-wide text-black/60">
          Qué le dices que es
          <input className={`${campo} mt-1`} value={descripcion} placeholder="el modelo 303 del 1T"
            onChange={(e) => setDescripcion(e.target.value)} />
        </label>
      </div>

      <div className="flex items-center gap-3 flex-wrap text-sm">
        <span className="text-xs font-mono uppercase tracking-wide text-black/60">Cómo se lo mando</span>
        <label className="flex items-center gap-1"><input type="radio" name="modo" checked={modo === ""} onChange={() => setModo("")} /> como decida</label>
        <label className="flex items-center gap-1"><input type="radio" name="modo" checked={modo === "fichero"} onChange={() => setModo("fichero")} /> el fichero</label>
        <label className="flex items-center gap-1"><input type="radio" name="modo" checked={modo === "enlace"} onChange={() => setModo("enlace")} /> enlace que caduca</label>
      </div>
      <p className="text-[11px] text-black/50">
        Los modelos de impuestos y las nóminas van por enlace que caduca: si alguien lo reenvía mañana, no abre nada.
        Lo demás va como fichero.
      </p>

      <button onClick={enviar} disabled={!fichero || enviando} className="btn-mustard text-xs px-4 py-2 disabled:opacity-50">
        {enviando ? "MANDANDO…" : "MANDAR POR WHATSAPP"}
      </button>

      {error && <p className="text-sm text-[color:var(--red)] font-bold">{error}</p>}

      {r && (
        <div className={`border-2 border-black p-3 ${r.enviado ? "bg-green-700 text-white" : "bg-[color:var(--mustard)]"}`}>
          <p className="font-bold text-sm">
            {r.enviado
              ? `Enviado a ${r.cliente} (${r.telefono}) como ${r.modo === "enlace" ? "enlace que caduca" : "fichero"}.`
              : `NO se ha enviado — ${r.motivo}`}
          </p>
          {r.detalle && <p className="text-xs mt-1">{r.detalle}</p>}
          {/* El mensaje se enseña siempre, se haya enviado o no: es lo que le
              llega al cliente y el gestor tiene que poder verlo antes. */}
          <p className="text-[10px] font-mono uppercase tracking-widest mt-2 opacity-80">Esto es lo que le llega:</p>
          <pre className="text-xs whitespace-pre-wrap bg-white text-black border-2 border-black p-2 mt-1">{r.mensaje}</pre>
        </div>
      )}
    </div>
  );
}
