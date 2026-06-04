"use client";

import { useActionState } from "react";
import type { Ficha } from "@/lib/ficha";
import { saveFichaAction } from "./actions";
import { IDLE_STATE, type SaveState } from "./types";

export default function FichaForm({
  tenantId,
  tenantName,
  initial,
}: {
  tenantId: string;
  tenantName: string;
  initial: Ficha;
}) {
  const [state, formAction, pending] = useActionState<SaveState, FormData>(
    saveFichaAction,
    IDLE_STATE,
  );

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="tenantId" value={tenantId} />

      {/* Cabecera con tenant */}
      <div className="card-hard bg-[color:var(--cream)] p-4 text-sm">
        <div className="text-[10px] font-mono uppercase tracking-widest text-black/55">
          Tenant
        </div>
        <div className="font-bold mt-0.5">
          {tenantName} <span className="text-black/40 font-normal">· {tenantId}</span>
        </div>
      </div>

      {/* Datos básicos */}
      <div className="card-hard bg-white p-6 space-y-4">
        <h2 className="font-stencil text-2xl">Datos básicos</h2>

        <Field label="Nombre del negocio *" name="nombreNegocio" defaultValue={initial.nombreNegocio} required />
        <Field
          label="Sector"
          name="sector"
          defaultValue={initial.sector}
          placeholder="clínica dental · peluquería · restaurante · estética…"
        />
        <Field label="Ciudad" name="ciudad" defaultValue={initial.ciudad} placeholder="Marbella" />
        <Field
          label="Tono de marca"
          name="tono"
          defaultValue={initial.tono}
          placeholder="cercano y profesional · divertido · elegante…"
        />
      </div>

      {/* Servicios y promos */}
      <div className="card-hard bg-white p-6 space-y-4">
        <h2 className="font-stencil text-2xl">Servicios y promociones</h2>

        <TextArea
          label="Servicios clave (uno por línea, 3-5 servicios)"
          name="serviciosClave"
          defaultValue={initial.serviciosClave.join("\n")}
          rows={6}
          placeholder={"Implante dental premium\nBlanqueamiento dental\nOrtodoncia invisible"}
        />

        <TextArea
          label="Promos actuales (uno por línea, opcional)"
          name="promosActuales"
          defaultValue={(initial.promosActuales ?? []).join("\n")}
          rows={4}
          placeholder={"Primera visita gratis hasta el 30 de junio\n20% en blanqueamiento esta semana"}
        />
      </div>

      {/* Estilo visual (motor de imagen) */}
      <div className="card-hard bg-white p-6 space-y-4">
        <h2 className="font-stencil text-2xl">Estilo visual</h2>
        <p className="text-xs text-black/55 -mt-2 leading-snug">
          Marta aplicará este estilo a TODAS las imágenes que genere para este cliente
          (coherencia visual). El motor de imagen lo lee desde aquí.
        </p>

        <div>
          <label className="block text-[10px] font-mono uppercase tracking-widest text-black/60 mb-1">
            Filtro Sharp (instantáneo, gratis)
          </label>
          <select
            name="estiloPreset"
            defaultValue={initial.estilo?.preset || "natural"}
            className="border-2 border-black px-3 py-2 text-sm w-full font-mono"
          >
            <option value="natural">natural — Sin ajustes, foto tal cual</option>
            <option value="calido">calido — Tonos cálidos, brillo suave</option>
            <option value="vivido">vivido — Saturación y contraste altos</option>
            <option value="luminoso">luminoso — Aireado, premium, fondos claros</option>
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-mono uppercase tracking-widest text-black/60 mb-1">
            Estilo IA Nano Banana (opcional, tarda unos segundos)
          </label>
          <select
            name="estiloAI"
            defaultValue={initial.estilo?.aiStyle || ""}
            className="border-2 border-black px-3 py-2 text-sm w-full font-mono"
          >
            <option value="">— Sin transformación IA —</option>
            <option value="comic">comic — Ilustración moderna, líneas limpias</option>
            <option value="editorial">editorial — Revista premium, realista</option>
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-mono uppercase tracking-widest text-black/60 mb-1">
            URL del logo (opcional, se compone en la esquina)
          </label>
          <input
            type="url"
            name="estiloLogoUrl"
            defaultValue={initial.estilo?.logoUrl || ""}
            placeholder="https://… logo PNG con transparencia"
            className="border-2 border-black px-3 py-2 text-sm w-full font-mono"
          />
        </div>
      </div>

      {/* Estilo redaccional y público */}
      <div className="card-hard bg-white p-6 space-y-4">
        <h2 className="font-stencil text-2xl">Estilo y público</h2>

        <TextArea
          label="Público objetivo (opcional)"
          name="publicoObjetivo"
          defaultValue={initial.publicoObjetivo ?? ""}
          rows={3}
          placeholder="Familias de 30-55 años de Marbella y alrededores que buscan tratamientos integrales"
        />

        <TextArea
          label="Notas de estilo (opcional)"
          name="notasEstilo"
          defaultValue={initial.notasEstilo ?? ""}
          rows={4}
          placeholder={"Evitar tecnicismos.\nNunca decir 'garantizado'.\nCerrar siempre invitando a pedir cita."}
        />
      </div>

      {/* Resultado */}
      {state.variant !== "idle" && (
        <div
          className={`card-hard p-4 ${
            state.variant === "ok"
              ? "bg-[#14B8A6] text-white"
              : "bg-[color:var(--red)] text-white"
          }`}
        >
          <div className="font-stencil text-xl">{state.title}</div>
          {state.detail && <p className="text-sm mt-1">{state.detail}</p>}
        </div>
      )}

      {/* Submit */}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="btn-mustard text-sm px-6 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pending ? "Guardando…" : "Guardar ficha"}
        </button>
        <span className="text-xs text-black/50">
          Los cambios se aplican inmediatamente a todos los agentes del tenant.
        </span>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  defaultValue,
  placeholder,
  required,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-[10px] font-mono uppercase tracking-widest text-black/60 mb-1">
        {label}
      </label>
      <input
        type="text"
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        className="border-2 border-black px-3 py-2 text-sm w-full font-medium"
      />
    </div>
  );
}

function TextArea({
  label,
  name,
  defaultValue,
  rows,
  placeholder,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  rows: number;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-[10px] font-mono uppercase tracking-widest text-black/60 mb-1">
        {label}
      </label>
      <textarea
        name={name}
        defaultValue={defaultValue}
        rows={rows}
        placeholder={placeholder}
        className="border-2 border-black px-3 py-2 text-sm w-full font-mono leading-relaxed"
      />
    </div>
  );
}
