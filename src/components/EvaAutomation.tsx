"use client";
import { useEffect, useState } from "react";
import type { WelcomeSeries, ScheduledEmail } from "@/lib/store";

export default function EvaAutomation() {
  const [series, setSeries] = useState<WelcomeSeries | null>(null);
  const [scheduled, setScheduled] = useState<ScheduledEmail[]>([]);
  const [savingSeries, setSavingSeries] = useState(false);
  const [flash, setFlash] = useState<{ ok: boolean; msg: string } | null>(null);

  // schedule new
  const [schedTo, setSchedTo] = useState<"all" | "specific">("all");
  const [schedEmail, setSchedEmail] = useState("");
  const [schedSubject, setSchedSubject] = useState("");
  const [schedBody, setSchedBody] = useState("");
  const [schedDate, setSchedDate] = useState("");
  const [schedTime, setSchedTime] = useState("09:00");

  // import
  const [csv, setCsv] = useState("");
  const [triggerWelcome, setTriggerWelcome] = useState(true);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    fetch("/api/eva/welcome").then((r) => r.json()).then((d) => setSeries(d.series || null));
    fetch("/api/eva/schedule").then((r) => r.json()).then((d) => setScheduled(d.scheduled || []));
  }, []);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 6000);
    return () => clearTimeout(t);
  }, [flash]);

  async function saveSeries() {
    if (!series) return;
    setSavingSeries(true);
    try {
      const res = await fetch("/api/eva/welcome", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(series),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setFlash({ ok: true, msg: "Welcome series guardada ✓" });
    } catch (e) {
      setFlash({ ok: false, msg: e instanceof Error ? e.message : "Error" });
    } finally { setSavingSeries(false); }
  }

  function updateEmail(idx: number, field: "delayHours" | "subject" | "body", v: string | number) {
    if (!series) return;
    const next = { ...series };
    next.emails = [...series.emails];
    next.emails[idx] = { ...next.emails[idx], [field]: v as never };
    setSeries(next);
  }

  function addStep() {
    if (!series) return;
    const last = series.emails[series.emails.length - 1];
    setSeries({
      ...series,
      emails: [
        ...series.emails,
        { delayHours: (last?.delayHours || 0) + 168, subject: "Asunto…", body: "Cuerpo…" },
      ],
    });
  }

  function removeStep(idx: number) {
    if (!series) return;
    setSeries({ ...series, emails: series.emails.filter((_, i) => i !== idx) });
  }

  async function schedule() {
    if (!schedSubject.trim() || !schedBody.trim() || !schedDate) {
      setFlash({ ok: false, msg: "Falta asunto, cuerpo o fecha" });
      return;
    }
    const isoDate = `${schedDate}T${schedTime}:00`;
    const res = await fetch("/api/eva/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: schedTo === "all" ? "all" : schedEmail,
        subject: schedSubject,
        body: schedBody,
        scheduledFor: new Date(isoDate).toISOString(),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setFlash({ ok: false, msg: data.error || "Error" });
      return;
    }
    setScheduled([...scheduled, data.scheduled]);
    setSchedSubject("");
    setSchedBody("");
    setSchedDate("");
    setFlash({ ok: true, msg: "Email programado ✓" });
  }

  async function cancelScheduled(id: string) {
    if (!confirm("¿Cancelar este envío programado?")) return;
    await fetch(`/api/eva/schedule?id=${id}`, { method: "DELETE" });
    setScheduled(scheduled.filter((s) => s.id !== id));
  }

  async function doImport() {
    if (!csv.trim()) {
      setFlash({ ok: false, msg: "Pega un CSV con los emails" });
      return;
    }
    setImporting(true);
    try {
      const res = await fetch("/api/eva/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv, triggerWelcome }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setFlash({ ok: true, msg: `${data.added} importados · ${data.skipped} duplicados` });
      setCsv("");
    } catch (e) {
      setFlash({ ok: false, msg: e instanceof Error ? e.message : "Error" });
    } finally { setImporting(false); }
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCsv(String(reader.result || ""));
    reader.readAsText(file);
  }

  return (
    <div className="mt-8 space-y-6">
      {flash && (
        <div className={`px-3 py-2 border-2 border-black text-sm font-bold ${flash.ok ? "bg-green-200" : "bg-red-200"}`}>
          {flash.ok ? "✓" : "⚠"} {flash.msg}
        </div>
      )}

      {/* WELCOME SERIES */}
      <div className="card-hard p-5">
        <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
          <div>
            <h3 className="font-stencil text-2xl">📥 Welcome series</h3>
            <p className="text-sm text-black/60 mt-1">Cada vez que añadas un contacto, Eva le manda esta secuencia automática.</p>
          </div>
          {series && (
            <label className="flex items-center gap-2 text-sm font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={series.enabled}
                onChange={(e) => setSeries({ ...series, enabled: e.target.checked })}
                className="w-5 h-5"
              />
              {series.enabled ? "✅ ACTIVA" : "⏸ DESACTIVADA"}
            </label>
          )}
        </div>

        {series ? (
          <>
            <ul className="space-y-3">
              {series.emails.map((e, i) => (
                <li key={i} className="border-2 border-black p-3 bg-[color:var(--cream)]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-stencil text-lg">Email {i + 1}</span>
                    <button onClick={() => removeStep(i)} className="text-xs text-[color:var(--red)]">× quitar</button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] gap-2 items-center mb-2">
                    <label className="text-xs font-mono">Retraso (h):</label>
                    <input type="number" min="0" max="720" value={e.delayHours} onChange={(ev) => updateEmail(i, "delayHours", Number(ev.target.value))} className="border-2 border-black px-2 py-1 text-sm" />
                  </div>
                  <input
                    value={e.subject}
                    onChange={(ev) => updateEmail(i, "subject", ev.target.value)}
                    placeholder="Asunto"
                    className="w-full border-2 border-black px-2 py-1.5 text-sm mb-2"
                  />
                  <textarea
                    value={e.body}
                    onChange={(ev) => updateEmail(i, "body", ev.target.value)}
                    rows={4}
                    placeholder="Cuerpo del email. Variables: {{negocio}} {{nombre}}"
                    className="w-full border-2 border-black px-2 py-1.5 text-sm font-mono"
                  />
                </li>
              ))}
            </ul>
            <div className="flex gap-2 mt-3 flex-wrap">
              <button onClick={addStep} className="text-xs font-mono border-2 border-black px-3 py-2 hover:bg-black hover:text-white">+ AÑADIR EMAIL</button>
              <button onClick={saveSeries} disabled={savingSeries} className="btn-mustard text-sm">{savingSeries ? "GUARDANDO…" : "💾 GUARDAR SECUENCIA"}</button>
            </div>
            <p className="text-[10px] text-black/40 mt-2">Variables disponibles: {`{{negocio}}`}, {`{{nombre}}`}. El cron Eva dispatcher procesa pendientes cada 15 min.</p>
          </>
        ) : (
          <p className="text-sm text-black/50 italic">Cargando…</p>
        )}
      </div>

      {/* SCHEDULE */}
      <div className="card-hard p-5">
        <h3 className="font-stencil text-2xl mb-3">⏰ Programar envío</h3>
        <p className="text-sm text-black/60 mb-3">Manda un email a fecha futura (ej: promo de Black Friday).</p>

        <div className="grid sm:grid-cols-2 gap-2 mb-2">
          <select value={schedTo} onChange={(e) => setSchedTo(e.target.value as "all" | "specific")} className="border-2 border-black px-2 py-2 text-sm bg-white">
            <option value="all">Toda la lista</option>
            <option value="specific">Email concreto</option>
          </select>
          {schedTo === "specific" && (
            <input type="email" placeholder="cliente@correo.com" value={schedEmail} onChange={(e) => setSchedEmail(e.target.value)} className="border-2 border-black px-2 py-2 text-sm" />
          )}
        </div>

        <input value={schedSubject} onChange={(e) => setSchedSubject(e.target.value)} placeholder="Asunto" className="w-full border-2 border-black px-3 py-2 text-sm mb-2" />
        <textarea rows={5} value={schedBody} onChange={(e) => setSchedBody(e.target.value)} placeholder="Cuerpo del email" className="w-full border-2 border-black px-3 py-2 text-sm font-mono mb-2" />
        <div className="grid sm:grid-cols-2 gap-2 mb-3">
          <input type="date" value={schedDate} onChange={(e) => setSchedDate(e.target.value)} className="border-2 border-black px-2 py-2 text-sm" />
          <input type="time" value={schedTime} onChange={(e) => setSchedTime(e.target.value)} className="border-2 border-black px-2 py-2 text-sm" />
        </div>
        <button onClick={schedule} className="btn-mustard text-sm">⏰ PROGRAMAR ENVÍO</button>

        {scheduled.length > 0 && (
          <div className="mt-4">
            <div className="text-xs font-bold tracking-widest mb-2">PROGRAMADOS</div>
            <ul className="space-y-1 text-sm">
              {scheduled.filter((s) => s.status === "pending").map((s) => (
                <li key={s.id} className="border-b border-black/10 pb-1 flex items-start gap-2">
                  <span className="font-mono text-xs text-black/60 shrink-0">{new Date(s.scheduledFor).toLocaleString("es-ES")}</span>
                  <span className="flex-1 truncate"><b>{s.subject}</b> → {s.to}</span>
                  <button onClick={() => cancelScheduled(s.id)} className="text-xs text-[color:var(--red)]">×</button>
                </li>
              ))}
              {scheduled.filter((s) => s.status === "sent").length > 0 && (
                <li className="text-xs text-black/40 italic pt-2">{scheduled.filter((s) => s.status === "sent").length} ya enviados</li>
              )}
            </ul>
          </div>
        )}
      </div>

      {/* BULK IMPORT */}
      <div className="card-hard p-5">
        <h3 className="font-stencil text-2xl mb-3">📤 Importar contactos CSV</h3>
        <p className="text-sm text-black/60 mb-3">Sube un archivo CSV o pega el contenido. Detecta automáticamente columnas &quot;email&quot; y &quot;nombre&quot;.</p>

        <input type="file" accept=".csv,.txt" onChange={handleFile} className="block mb-2 text-sm" />

        <textarea
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          rows={6}
          placeholder={"email,nombre\nmaria@ejemplo.com,María García\njuan@ejemplo.com,Juan Pérez"}
          className="w-full border-2 border-black px-3 py-2 text-sm font-mono mb-2"
        />

        <label className="flex items-center gap-2 text-sm mb-3">
          <input type="checkbox" checked={triggerWelcome} onChange={(e) => setTriggerWelcome(e.target.checked)} />
          Disparar welcome series a los nuevos contactos
        </label>

        <button onClick={doImport} disabled={importing} className="btn-mustard text-sm">
          {importing ? "IMPORTANDO…" : "📤 IMPORTAR CSV"}
        </button>
      </div>
    </div>
  );
}
