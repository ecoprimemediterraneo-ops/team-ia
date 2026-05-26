"use client";
import { useState } from "react";

type Form = {
  nombre: string;
  email: string;
  whatsapp: string;
  negocio: string;
  sector: "dental" | "estetica" | "otro" | "";
  ciudad: string;
  web: string;
  instagram: string;
  googleBusiness: string;
  respuestaWhatsapp: string;
  gestionSoftware: string;
  reseñasMes: string;
  publicacionesMes: string;
  emailMkt: string;
  cuelloBotella: string;
};

const empty: Form = {
  nombre: "",
  email: "",
  whatsapp: "",
  negocio: "",
  sector: "",
  ciudad: "",
  web: "",
  instagram: "",
  googleBusiness: "",
  respuestaWhatsapp: "",
  gestionSoftware: "",
  reseñasMes: "",
  publicacionesMes: "",
  emailMkt: "",
  cuelloBotella: "",
};

export default function DiagnosticoForm() {
  const [form, setForm] = useState<Form>(empty);
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "err">("idle");
  const [report, setReport] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState("");

  function set<K extends keyof Form>(k: K, v: Form[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "loading") return;
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/diagnostico", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error generando informe");
      setReport(data.informe);
      setStatus("ok");
    } catch (err) {
      setStatus("err");
      setErrorMsg(err instanceof Error ? err.message : "Error");
    }
  }

  if (status === "ok") {
    return (
      <div className="card-hard p-8 bg-white">
        <div className="text-center mb-6">
          <div className="inline-block bg-[#14B8A6] text-white px-3 py-1 text-xs font-mono font-bold tracking-widest mb-3">
            INFORME · HOTEL-D8
          </div>
          <h2 className="font-stencil text-3xl mb-2">Diagnóstico de {form.negocio}</h2>
          <p className="text-sm text-black/60">Diana ha analizado tu negocio. También te lo hemos enviado a {form.email}.</p>
        </div>
        <div className="prose-custom whitespace-pre-wrap text-sm leading-relaxed border-t-2 border-black pt-6">
          {report}
        </div>
        <div className="mt-8 pt-6 border-t-2 border-black text-center">
          <p className="font-stencil text-xl mb-4">¿Listo para empezar?</p>
          <a href="/reclutar" className="btn-mustard inline-block">
            ACTIVAR MI EQUIPO IA →
          </a>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card-hard p-6 md:p-8 bg-white space-y-6">
      <div>
        <h3 className="font-stencil text-2xl mb-1">Cuéntame de tu negocio</h3>
        <p className="text-sm text-black/60">2 minutos. 12 preguntas. Sin tarjeta.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Field label="Tu nombre" required value={form.nombre} onChange={(v) => set("nombre", v)} />
        <Field label="Email" type="email" required value={form.email} onChange={(v) => set("email", v)} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Field label="WhatsApp" placeholder="+34..." value={form.whatsapp} onChange={(v) => set("whatsapp", v)} />
        <Field label="Nombre del negocio" required value={form.negocio} onChange={(v) => set("negocio", v)} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-widest mb-1">Sector *</label>
          <select
            required
            value={form.sector}
            onChange={(e) => set("sector", e.target.value as Form["sector"])}
            className="w-full border-2 border-black px-3 py-2 bg-white"
          >
            <option value="">Elige...</option>
            <option value="dental">Clínica dental</option>
            <option value="estetica">Clínica estética</option>
            <option value="peluqueria">Peluquería / salón</option>
            <option value="restaurante">Restaurante / bar</option>
            <option value="fisio">Fisioterapia</option>
            <option value="abogado">Bufete de abogados</option>
            <option value="asesoria">Asesoría</option>
            <option value="gimnasio">Gimnasio</option>
            <option value="podologo">Podología</option>
            <option value="inmobiliaria">Inmobiliaria</option>
            <option value="otro">Otro</option>
          </select>
        </div>
        <Field label="Ciudad" required value={form.ciudad} onChange={(v) => set("ciudad", v)} />
      </div>

      <Field label="Tu web (URL)" placeholder="https://..." value={form.web} onChange={(v) => set("web", v)} />
      <Field label="Instagram (@usuario)" value={form.instagram} onChange={(v) => set("instagram", v)} />
      <Field label="Google Business (nombre tal cual aparece)" value={form.googleBusiness} onChange={(v) => set("googleBusiness", v)} />

      <div>
        <label className="block text-xs font-bold uppercase tracking-widest mb-1">¿En cuánto tiempo respondéis WhatsApp normalmente?</label>
        <select
          value={form.respuestaWhatsapp}
          onChange={(e) => set("respuestaWhatsapp", e.target.value)}
          className="w-full border-2 border-black px-3 py-2 bg-white"
        >
          <option value="">Elige...</option>
          <option>Menos de 5 minutos</option>
          <option>5-30 minutos</option>
          <option>1-3 horas</option>
          <option>Más de 3 horas / al día siguiente</option>
          <option>No usamos WhatsApp</option>
        </select>
      </div>

      <Field label="¿Qué software de gestión usáis?" placeholder="Tu software de gestión..." value={form.gestionSoftware} onChange={(v) => set("gestionSoftware", v)} />

      <div className="grid md:grid-cols-2 gap-4">
        <Field label="Reseñas Google nuevas al mes" placeholder="0, 1-3, 4-10, +10" value={form.reseñasMes} onChange={(v) => set("reseñasMes", v)} />
        <Field label="Publicaciones IG al mes" placeholder="0, 1-4, 5-10, +10" value={form.publicacionesMes} onChange={(v) => set("publicacionesMes", v)} />
      </div>

      <div>
        <label className="block text-xs font-bold uppercase tracking-widest mb-1">¿Hacéis email marketing?</label>
        <select
          value={form.emailMkt}
          onChange={(e) => set("emailMkt", e.target.value)}
          className="w-full border-2 border-black px-3 py-2 bg-white"
        >
          <option value="">Elige...</option>
          <option>No</option>
          <option>Sí, ocasionalmente</option>
          <option>Sí, newsletter mensual</option>
          <option>Sí, secuencias automáticas</option>
        </select>
      </div>

      <div>
        <label className="block text-xs font-bold uppercase tracking-widest mb-1">¿Cuál crees que es tu mayor cuello de botella?</label>
        <textarea
          rows={3}
          value={form.cuelloBotella}
          onChange={(e) => set("cuelloBotella", e.target.value)}
          className="w-full border-2 border-black px-3 py-2 bg-white"
          placeholder="Ej: no contestamos a tiempo, no tenemos tiempo de publicar..."
        />
      </div>

      {errorMsg && <p className="text-sm text-[color:var(--red)] font-bold">{errorMsg}</p>}

      <button
        type="submit"
        disabled={status === "loading"}
        className="btn-mustard w-full text-base py-4 disabled:opacity-60"
      >
        {status === "loading" ? "DIANA ESTÁ ANALIZANDO..." : "GENERAR MI DIAGNÓSTICO →"}
      </button>

      <p className="text-[10px] font-mono text-black/40 tracking-widest uppercase text-center">
        Diana usa tu información solo para generar tu informe. No la compartimos.
      </p>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder = "",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-bold uppercase tracking-widest mb-1">
        {label} {required && "*"}
      </label>
      <input
        type={type}
        required={required}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border-2 border-black px-3 py-2 bg-white"
      />
    </div>
  );
}
