"use client";
import { useState } from "react";
import { matchSector, SECTOR_FIT } from "@/lib/sector-fit";

const AGENTES = [
  { id: "pablo", label: "Pablo · WhatsApp", color: "#25D366" },
  { id: "rocio", label: "Rocío · Reseñas Google", color: "#FBBF24" },
  { id: "eva", label: "Eva · Email Marketing", color: "#60A5FA" },
  { id: "lucia", label: "Lucía · Asistente Gmail", color: "#F5C518" },
  { id: "marta", label: "Marta · Redes sociales", color: "#FF7A59" },
  { id: "carmen", label: "Carmen · Llamadas", color: "#A88BE8" },
  { id: "sergio", label: "Sergio · Competencia", color: "#3B82F6" },
  { id: "diana", label: "Diana · Auditoría", color: "#14B8A6" },
];

export default function BetaForm() {
  const [enviando, setEnviando] = useState(false);
  const [hecho, setHecho] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agentes, setAgentes] = useState<string[]>([]);
  const [sectorElegido, setSectorElegido] = useState<string>("");

  function toggleAgente(id: string) {
    setAgentes((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));
  }

  /** Cuando cambia el sector, pre-marca los agentes top del SECTOR_FIT */
  function onSectorChange(sector: string) {
    setSectorElegido(sector);
    if (!sector) return;
    const fit = SECTOR_FIT[matchSector(sector)];
    setAgentes(fit.top);
  }

  const fit = sectorElegido ? SECTOR_FIT[matchSector(sectorElegido)] : null;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const payload = {
      nombre: fd.get("nombre"),
      email: fd.get("email"),
      whatsapp: fd.get("whatsapp"),
      negocio: fd.get("negocio"),
      sector: fd.get("sector"),
      ciudad: fd.get("ciudad"),
      web: fd.get("web") || undefined,
      empleados: fd.get("empleados") || undefined,
      porQue: fd.get("porQue"),
      agentesInteres: agentes,
    };
    setEnviando(true);
    try {
      const res = await fetch("/api/beta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setHecho(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setEnviando(false);
    }
  }

  if (hecho) {
    return (
      <div className="card-hard p-8 bg-[color:var(--mustard)]/30 text-center">
        <h2 className="font-stencil text-3xl mb-3">Solicitud recibida</h2>
        <p className="text-lg mb-2">Te hemos mandado un email con los próximos pasos.</p>
        <p className="text-sm text-black/70">
          En menos de 48h te contactamos para una llamada de 30 min sin compromiso.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <Field label="Tu nombre" name="nombre" required placeholder="María García" />
        <Field label="Email" name="email" type="email" required placeholder="maria@miclinica.com" />
        <Field label="WhatsApp" name="whatsapp" required placeholder="+34 600 000 000" />
        <Field label="Ciudad" name="ciudad" required placeholder="Marbella" />
        <Field label="Nombre del negocio" name="negocio" required placeholder="Clínica Dental Sonrisa" />
        <label className="block">
          <span className="block text-xs font-mono uppercase tracking-widest mb-1">Sector *</span>
          <select
            name="sector"
            required
            value={sectorElegido}
            onChange={(e) => onSectorChange(e.target.value)}
            className="w-full border-[3px] border-black px-3 py-2 text-sm bg-white shadow-[3px_3px_0_#000] focus:outline-none"
          >
            <option value="">Elige…</option>
            <option value="Clínica dental">Clínica dental</option>
            <option value="Clínica estética">Clínica estética / belleza</option>
            <option value="Fisioterapia">Fisioterapia</option>
            <option value="Podología">Podología</option>
            <option value="Peluquería">Peluquería / barbería</option>
            <option value="Abogados">Despacho de abogados</option>
            <option value="Asesoría">Asesoría fiscal / laboral</option>
            <option value="Gimnasio">Gimnasio / boutique fitness</option>
            <option value="Restaurante">Restaurante</option>
            <option value="Otro">Otro</option>
          </select>
        </label>
        <Field label="Web (opcional)" name="web" placeholder="https://miclinica.com" />
        <SelectField
          label="Empleados"
          name="empleados"
          options={[
            { v: "", l: "Elige…" },
            { v: "1", l: "Solo yo" },
            { v: "2-5", l: "2-5 personas" },
            { v: "6-15", l: "6-15 personas" },
            { v: "16+", l: "Más de 15" },
          ]}
        />
      </div>

      <div>
        <label className="block text-xs font-mono uppercase tracking-widest mb-2">
          Agentes recomendados para tu sector
          {fit && (
            <span className="ml-2 text-[10px] font-bold text-[color:var(--red)] normal-case tracking-normal">
              ★ Top 3 pre-marcados — modifica si quieres
            </span>
          )}
        </label>
        <div className="grid sm:grid-cols-2 gap-2">
          {AGENTES.map((a) => {
            const isTop = fit?.top.includes(a.id as never);
            const isSkip = fit?.skip.includes(a.id as never);
            const isSelected = agentes.includes(a.id);
            return (
              <button
                type="button"
                key={a.id}
                onClick={() => toggleAgente(a.id)}
                className={`border-[3px] border-black px-3 py-2 text-left text-sm font-bold transition-all shadow-[3px_3px_0_#000] relative ${
                  isSelected ? "bg-black text-white" : "bg-white hover:bg-[color:var(--cream)]"
                } ${isSkip && !isSelected ? "opacity-50" : ""}`}
                style={isSelected ? { backgroundColor: a.color, color: "#000" } : undefined}
              >
                {isTop && (
                  <span className="absolute -top-2 -right-2 bg-[color:var(--red)] text-white text-[9px] px-1.5 py-0.5 font-bold tracking-widest border-2 border-black">
                    TOP
                  </span>
                )}
                {isSelected ? "✓ " : ""}{a.label}
              </button>
            );
          })}
        </div>
        {fit && (
          <p className="text-[11px] mt-3 text-black/60 italic">
            {fit.porQue}
          </p>
        )}
      </div>

      <div>
        <label className="block text-xs font-mono uppercase tracking-widest mb-2">
          Cuéntanos tu dolor operativo principal *
        </label>
        <textarea
          name="porQue"
          required
          minLength={10}
          rows={4}
          placeholder="Ej: pierdo llamadas fuera de horario, no tengo tiempo para Instagram, mis reseñas no crecen, mi bandeja Gmail es un caos…"
          className="w-full border-[3px] border-black p-3 font-mono text-sm shadow-[3px_3px_0_#000] focus:outline-none focus:bg-[color:var(--cream)]"
        />
      </div>

      <div className="border-2 border-black p-3 text-xs bg-[color:var(--cream)]">
        <strong>Protección de datos:</strong> tus datos no se venden ni se ceden. Al acabar la beta puedes exportar todo o pedir que lo borremos. Lee la{" "}
        <a href="/legal/privacidad" className="underline" target="_blank">política de privacidad</a>.
      </div>

      {error && (
        <div className="border-[3px] border-[color:var(--red)] bg-[color:var(--red)]/10 p-3 text-sm font-bold">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="btn-mustard w-full text-base disabled:opacity-50"
      >
        {enviando ? "Enviando…" : "Solicitar plaza beta →"}
      </button>

      <p className="text-[11px] text-center text-black/60 font-mono">
        Sin tarjeta. Sin permanencia. 6 meses gratis. 50 plazas.
      </p>
    </form>
  );
}

function Field({ label, name, type = "text", required, placeholder }: { label: string; name: string; type?: string; required?: boolean; placeholder?: string }) {
  return (
    <label className="block">
      <span className="block text-xs font-mono uppercase tracking-widest mb-1">{label}{required && " *"}</span>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="w-full border-[3px] border-black px-3 py-2 text-sm shadow-[3px_3px_0_#000] focus:outline-none focus:bg-[color:var(--cream)]"
      />
    </label>
  );
}

function SelectField({ label, name, required, options }: { label: string; name: string; required?: boolean; options: { v: string; l: string }[] }) {
  return (
    <label className="block">
      <span className="block text-xs font-mono uppercase tracking-widest mb-1">{label}{required && " *"}</span>
      <select
        name={name}
        required={required}
        className="w-full border-[3px] border-black px-3 py-2 text-sm bg-white shadow-[3px_3px_0_#000] focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.v} value={o.v}>{o.l}</option>
        ))}
      </select>
    </label>
  );
}
