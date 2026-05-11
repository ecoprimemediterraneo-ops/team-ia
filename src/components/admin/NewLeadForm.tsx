"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewLeadForm() {
  const router = useRouter();
  const [data, setData] = useState({
    businessName: "",
    contactName: "",
    email: "",
    phone: "",
    city: "",
    sector: "Clínica dental",
    website: "",
    rating: "",
    reviewCount: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload: Record<string, unknown> = { ...data };
      // limpiar opcionales vacíos
      for (const k of Object.keys(payload)) {
        if (payload[k] === "" || payload[k] === undefined) delete payload[k];
      }
      if (data.rating) payload.rating = parseFloat(data.rating);
      else delete payload.rating;
      if (data.reviewCount) payload.reviewCount = parseInt(data.reviewCount);
      else delete payload.reviewCount;

      const res = await fetch("/api/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const r = await res.json();
      if (!res.ok) throw new Error(r.error || "Error");
      router.push("/admin/pipeline");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setSaving(false);
    }
  }

  function f(key: keyof typeof data) {
    return {
      value: data[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
        setData({ ...data, [key]: e.target.value }),
    };
  }

  return (
    <form onSubmit={submit} className="card-hard p-5 space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-bold">Nombre del negocio *</span>
          <input required {...f("businessName")} placeholder="Clínica Dental Sonrisa" className="w-full border-2 border-black px-3 py-2 text-sm mt-1" />
        </label>
        <label className="block">
          <span className="text-xs font-bold">Nombre contacto</span>
          <input {...f("contactName")} placeholder="Dra. García" className="w-full border-2 border-black px-3 py-2 text-sm mt-1" />
        </label>
        <label className="block">
          <span className="text-xs font-bold">Email</span>
          <input type="email" {...f("email")} placeholder="info@…" className="w-full border-2 border-black px-3 py-2 text-sm mt-1" />
        </label>
        <label className="block">
          <span className="text-xs font-bold">Teléfono</span>
          <input {...f("phone")} placeholder="+34 952…" className="w-full border-2 border-black px-3 py-2 text-sm mt-1" />
        </label>
        <label className="block">
          <span className="text-xs font-bold">Ciudad</span>
          <input {...f("city")} placeholder="Málaga" className="w-full border-2 border-black px-3 py-2 text-sm mt-1" />
        </label>
        <label className="block">
          <span className="text-xs font-bold">Sector *</span>
          <select {...f("sector")} className="w-full border-2 border-black px-3 py-2 text-sm mt-1 bg-white">
            <option>Clínica dental</option>
            <option>Peluquería / estética</option>
            <option>Fisio / nutrición</option>
            <option>Restaurante / hostelería</option>
            <option>Inmobiliaria</option>
            <option>Gestoría / asesoría</option>
            <option>Coach / consultor</option>
            <option>E-commerce</option>
            <option>Otro</option>
          </select>
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs font-bold">Website</span>
          <input type="url" {...f("website")} placeholder="https://…" className="w-full border-2 border-black px-3 py-2 text-sm mt-1" />
        </label>
        <label className="block">
          <span className="text-xs font-bold">Rating Google (0-5)</span>
          <input type="number" step="0.1" min="0" max="5" {...f("rating")} className="w-full border-2 border-black px-3 py-2 text-sm mt-1" />
        </label>
        <label className="block">
          <span className="text-xs font-bold">Nº reseñas</span>
          <input type="number" min="0" {...f("reviewCount")} className="w-full border-2 border-black px-3 py-2 text-sm mt-1" />
        </label>
      </div>

      <label className="block">
        <span className="text-xs font-bold">Notas</span>
        <textarea rows={4} {...f("notes")} placeholder="Detalles del primer contacto, hueco, etc." className="w-full border-2 border-black px-3 py-2 text-sm mt-1 font-mono" />
      </label>

      {error && <div className="bg-red-200 border-2 border-black p-3 text-sm">⚠ {error}</div>}

      <button type="submit" disabled={saving} className="btn-mustard">
        {saving ? "GUARDANDO…" : "✓ AÑADIR LEAD AL PIPELINE"}
      </button>
    </form>
  );
}
