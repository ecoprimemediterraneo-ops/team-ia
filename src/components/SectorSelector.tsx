"use client";

import { useState } from "react";
import { SECTOR_OPTIONS, type SectorKey } from "@/lib/sector-prompts";

export default function SectorSelector({ initial }: { initial: SectorKey }) {
  const [sector, setSector] = useState<SectorKey>(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "ok" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function change(next: SectorKey) {
    setSector(next);
    setStatus("saving");
    setMsg("");
    try {
      const res = await fetch("/api/perfil/sector", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sector: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setStatus("ok");
      setMsg("Sector actualizado ✓ Tu agente ya usa este prompt.");
    } catch (e) {
      setStatus("error");
      setMsg(e instanceof Error ? e.message : "Error");
    }
  }

  const current = SECTOR_OPTIONS.find((o) => o.value === sector);

  return (
    <div className="card-hard p-5 max-w-2xl">
      <div className="flex items-center gap-2 mb-2 text-[10px] font-mono">
        <span className="bg-black text-[color:var(--mustard)] px-2 py-0.5 font-bold tracking-widest">
          PERSONALIDAD DEL AGENTE
        </span>
      </div>
      <h2 className="font-stencil text-2xl mb-1">Sector de tu agente</h2>
      <p className="text-sm text-black/60 mb-4 leading-snug">
        Define cómo atiende tu agente conversacional (WhatsApp). Cada sector carga un
        prompt distinto. Las clínicas atienden pacientes y agendan citas; el vendedor
        capta clientes para AI-Team.
      </p>

      <div className="grid gap-2">
        {SECTOR_OPTIONS.map((o) => {
          const selected = o.value === sector;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => change(o.value)}
              className={`text-left border-2 border-black px-3 py-2 transition ${
                selected ? "bg-[color:var(--mustard)]" : "bg-white hover:bg-[color:var(--mustard)]/30"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`w-3 h-3 border-2 border-black shrink-0 ${selected ? "bg-black" : "bg-white"}`}
                />
                <span className="font-bold text-sm">{o.label}</span>
              </div>
              <p className="text-xs text-black/60 mt-0.5 ml-5 leading-snug">{o.descripcion}</p>
            </button>
          );
        })}
      </div>

      {current && (
        <p className="text-[11px] font-mono text-black/50 mt-3">
          Actual: <strong className="text-black">{current.label}</strong>
          {current.value === "vendedor"
            ? " · no agenda citas de pacientes"
            : " · agenda citas con la agenda central (Google Calendar)"}
        </p>
      )}

      {status !== "idle" && (
        <div
          className={`mt-3 text-sm px-3 py-2 border-2 border-black ${
            status === "ok" ? "bg-green-200" : status === "error" ? "bg-red-200" : "bg-[color:var(--cream)]"
          }`}
        >
          {status === "saving" ? "Guardando…" : msg}
        </div>
      )}
    </div>
  );
}
