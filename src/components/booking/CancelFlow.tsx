"use client";

import { useEffect, useState } from "react";

type Cita = { slug: string; negocio: string; servicio: string; addons: string[]; cuando: string; estado: string; cancelable: boolean; antelacionMin: number };

export default function CancelFlow({ token }: { token: string }) {
  const [cita, setCita] = useState<Cita | null>(null);
  const [cargando, setCargando] = useState(true);
  const [estado, setEstado] = useState<"idle" | "trabajando" | "cancelada" | "error">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/booking/cancelar?token=${encodeURIComponent(token)}`);
        const j = await r.json();
        if (r.ok && j.ok) setCita(j.cita);
        else setError(j.error === "not_found" ? "No encontramos esta reserva." : "No se pudo cargar la reserva.");
      } catch { setError("Fallo de red."); }
      finally { setCargando(false); }
    })();
  }, [token]);

  async function cancelar(reprogramar: boolean) {
    setEstado("trabajando"); setError("");
    try {
      const r = await fetch(`/api/booking/cancelar`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
      const j = await r.json();
      if (r.ok && j.ok) {
        if (reprogramar && j.cita?.slug) { window.location.href = `/reservas/${j.cita.slug}`; return; }
        setEstado("cancelada");
      } else if (j.reason === "too_late") { setError(j.message || "Ya no se puede cancelar online tan cerca de la cita."); setEstado("error"); }
      else { setError(j.reason === "not_found" ? "No encontramos esta reserva (quizá ya se canceló)." : "No se pudo cancelar."); setEstado("error"); }
    } catch { setError("Fallo de red."); setEstado("error"); }
  }

  const box = "card-hard bg-white p-6 text-center max-w-sm w-full";
  if (cargando) return <div className={box}><div className="animate-pulse font-mono text-sm text-black/50">Cargando…</div></div>;
  if (!cita) return <div className={box}><div className="text-4xl mb-2">🔍</div><p className="font-bold">{error || "Reserva no encontrada."}</p></div>;

  if (estado === "cancelada" || cita.estado === "cancelada") {
    return (
      <div className={box}>
        <div className="text-5xl mb-2">👍</div>
        <h1 className="font-stencil text-2xl mb-2">Cita cancelada</h1>
        <p className="text-sm text-black/70">Tu cita de <b>{cita.servicio}</b> en <b>{cita.negocio}</b> ({cita.cuando}) está cancelada. El hueco queda libre.</p>
        <a href={`/reservas/${cita.slug}`} className="btn-mustard inline-block mt-4 text-sm">Reservar de nuevo</a>
      </div>
    );
  }

  return (
    <div className={box}>
      <div className="text-4xl mb-2">🗓️</div>
      <h1 className="font-stencil text-2xl mb-1">Tu cita</h1>
      <div className="text-sm text-black/70 mb-4">
        <b>{cita.servicio}</b>{cita.addons.length ? ` + ${cita.addons.join(", ")}` : ""}<br />{cita.cuando} · {cita.negocio}
      </div>
      {error && <p className="text-[color:var(--red)] text-sm font-bold mb-3">⚠ {error}</p>}
      {cita.cancelable ? (
        <div className="flex flex-col gap-2">
          <button onClick={() => cancelar(true)} disabled={estado === "trabajando"} className="btn-mustard disabled:opacity-60">Reprogramar (elegir otra hora)</button>
          <button onClick={() => cancelar(false)} disabled={estado === "trabajando"} className="border-[3px] border-black bg-white px-4 py-2 text-sm font-bold hover:bg-[color:var(--cream)] disabled:opacity-60">{estado === "trabajando" ? "…" : "Cancelar mi cita"}</button>
          <p className="text-[11px] text-black/45 mt-1">Gratis, sin comisiones.</p>
        </div>
      ) : (
        <div className="text-sm text-black/60">
          Ya no se puede cancelar/reprogramar online tan cerca de la cita{cita.antelacionMin ? ` (menos de ${Math.round(cita.antelacionMin / 60)} h antes)` : ""}. Contacta directamente con <b>{cita.negocio}</b>.
        </div>
      )}
    </div>
  );
}
