"use client";
import { useState } from "react";

type Estado = "pendiente" | "contactado" | "activo" | "rechazado" | "cerrado";

const ESTADOS: { v: Estado; label: string; color: string }[] = [
  { v: "pendiente", label: "Pendiente", color: "bg-[color:var(--red)] text-white" },
  { v: "contactado", label: "Contactado", color: "bg-[color:var(--mustard)]" },
  { v: "activo", label: "Activo (en beta)", color: "bg-[#14B8A6] text-white" },
  { v: "rechazado", label: "Rechazado", color: "bg-black text-white" },
  { v: "cerrado", label: "Cerrado (paga)", color: "bg-[#3B82F6] text-white" },
];

export default function BetaStatusSelector({ email, current }: { email: string; current: string }) {
  const [estado, setEstado] = useState<string>(current);
  const [saving, setSaving] = useState(false);

  async function change(nuevo: Estado) {
    if (nuevo === estado) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/beta-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, estado: nuevo }),
      });
      if (!res.ok) throw new Error("Error");
      setEstado(nuevo);
    } catch {
      alert("Error al actualizar");
    } finally {
      setSaving(false);
    }
  }

  const current_meta = ESTADOS.find((e) => e.v === estado) || ESTADOS[0];

  return (
    <div className="relative inline-block">
      <select
        value={estado}
        onChange={(e) => change(e.target.value as Estado)}
        disabled={saving}
        className={`text-[10px] font-bold uppercase tracking-widest border-2 border-black px-2 py-1 cursor-pointer disabled:opacity-50 ${current_meta.color}`}
      >
        {ESTADOS.map((e) => (
          <option key={e.v} value={e.v} className="bg-white text-black">
            {e.label}
          </option>
        ))}
      </select>
    </div>
  );
}
