"use client";

// Demo de venta y pruebas de Carmen en el panel:
//   · "Probar: que Carmen me llame" (mismas reglas que cualquier llamada saliente);
//   · "Enviar informe ahora" (el informe semanal que sale los lunes a las 9:00).
import { useEffect, useState } from "react";

type Estado = { proveedor: { proveedor: string; listo: boolean; numero?: string; falta: string[] }; testPhone: boolean };

export default function CarmenPruebas() {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [tel, setTel] = useState("");
  const [msg, setMsg] = useState<string>("");
  const [informe, setInforme] = useState<string>("");
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => { fetch("/api/carmen/llamar-prueba").then((r) => r.json()).then((j) => j.ok && setEstado(j)).catch(() => {}); }, []);

  async function llamar() {
    setOcupado(true); setMsg("");
    try {
      const j = await (await fetch("/api/carmen/llamar-prueba", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ telefono: tel }) })).json();
      setMsg(j.ok ? (j.modo === "real" ? "Carmen te está llamando." : j.detalle) : `No se llama: ${j.detalle}`);
    } finally { setOcupado(false); }
  }
  async function enviarInforme() {
    setOcupado(true); setInforme("");
    try {
      const j = await (await fetch("/api/carmen/informe", { method: "POST" })).json();
      setInforme(`${j.informe?.texto ?? ""}\n\nEnvío: ${j.envio?.modo ?? "?"}${j.envio?.detalle ? ` (${j.envio.detalle})` : ""}`);
    } finally { setOcupado(false); }
  }

  return (
    <div className="card-hard bg-white p-4 space-y-4">
      <div className="text-[11px] font-mono text-black/60">
        Voz: {estado?.proveedor.proveedor ?? "Retell"} · número {estado?.proveedor.numero ?? "sin configurar"} ·{" "}
        {estado?.proveedor.listo ? "llamadas salientes listas" : `MODO PRUEBA (falta ${estado?.proveedor.falta.join(", ") || "…"})`}
      </div>
      <div>
        <div className="font-stencil text-xl leading-none mb-2">Probar: que Carmen me llame</div>
        <div className="flex gap-2 flex-wrap">
          <input value={tel} onChange={(e) => setTel(e.target.value)} placeholder={estado?.testPhone ? "Vacío = tu móvil de prueba" : "+34 600 000 000"} className="card-hard px-3 py-2 bg-white text-sm flex-1 min-w-[180px]" />
          <button onClick={llamar} disabled={ocupado} className="btn-mustard text-sm px-4 py-2 disabled:opacity-50">Llamarme</button>
        </div>
        <p className="text-[11px] text-black/50 mt-1">Solo de 9:00 a 21:00 y solo a tu móvil de prueba o a quien ya haya contactado con el negocio.</p>
        {msg && <p className="text-sm mt-2">{msg}</p>}
      </div>
      <div>
        <div className="font-stencil text-xl leading-none mb-2">Informe semanal</div>
        <button onClick={enviarInforme} disabled={ocupado} className="border-2 border-black px-4 py-2 text-sm bg-white disabled:opacity-50">Enviar informe ahora</button>
        {informe && <pre className="text-xs whitespace-pre-wrap mt-2 bg-[color:var(--cream)] border-2 border-black p-2">{informe}</pre>}
      </div>
    </div>
  );
}
