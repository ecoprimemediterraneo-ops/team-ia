"use client";
import { useEffect, useState } from "react";

type Available = { phone_number: string; friendly_name: string; locality?: string; region?: string };
type Operadora = { nombre: string; codigo: string; descripcion: string };

const AREAS = [
  { code: "", label: "Cualquier zona España" },
  { code: "91", label: "Madrid · 91X" },
  { code: "93", label: "Barcelona · 93X" },
  { code: "95", label: "Sevilla / Málaga · 95X" },
  { code: "96", label: "Valencia · 96X" },
  { code: "98", label: "Asturias · 98X" },
];

const OPERADORAS_KEYS = ["movistar", "vodafone", "orange", "yoigo", "digi", "otra"];

export default function CarmenWizard({ currentNumber }: { currentNumber: string | null }) {
  const [step, setStep] = useState<"intro" | "tipo" | "nuevo" | "desvio" | "done">(currentNumber ? "done" : "intro");
  const [modo, setModo] = useState<"nuevo" | "desvio" | null>(null);
  const [available, setAvailable] = useState<Available[]>([]);
  const [areaCode, setAreaCode] = useState("");
  const [numeroType, setNumeroType] = useState<"local" | "mobile" | "tollfree">("local");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [operadora, setOperadora] = useState("movistar");
  const [miMovil, setMiMovil] = useState("");
  const [operadorasData, setOperadorasData] = useState<Record<string, { nombre: string; codigo: string; descripcion: string }>>({});
  const [twilioOk, setTwilioOk] = useState(true);
  const [assigned, setAssigned] = useState<string | null>(currentNumber);

  async function loadOperadoras() {
    const r = await fetch("/api/carmen/provision");
    const j = await r.json();
    if (j.operadoras) {
      const mapped: Record<string, Operadora> = {};
      for (const k of OPERADORAS_KEYS) {
        const od = j.operadoras[k];
        if (od) mapped[k] = { nombre: od.nombre, codigo: typeof od.codigo === "function" ? "" : "", descripcion: od.descripcion };
      }
      setOperadorasData(mapped);
    }
    if (j.error?.includes("Twilio no configurado")) setTwilioOk(false);
  }
  useEffect(() => { loadOperadoras(); }, []);

  async function buscar() {
    setBusy(true); setError(""); setAvailable([]);
    try {
      const r = await fetch(`/api/carmen/provision?type=${numeroType}${areaCode ? `&area_code=${areaCode}` : ""}`);
      const j = await r.json();
      if (j.error) setError(j.error);
      else setAvailable(j.available || []);
    } finally { setBusy(false); }
  }

  async function comprar(phone: string) {
    if (!confirm(`¿Asignar este número Carmen?\n${phone}\n\nSe te cobrará ~€1-3/mes alquiler + uso.`)) return;
    setBusy(true); setError("");
    try {
      const r = await fetch("/api/carmen/provision", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone_number: phone }) });
      const j = await r.json();
      if (!r.ok) { setError(j.error); return; }
      setAssigned(j.phone_number);
      setStep("done");
    } finally { setBusy(false); }
  }

  async function testCall() {
    if (!miMovil) { alert("Pon tu móvil"); return; }
    setBusy(true);
    try {
      const r = await fetch("/api/carmen/provision", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "test_call", my_phone: miMovil }) });
      const j = await r.json();
      if (!r.ok) alert(j.error);
      else alert("📞 Test enviado. Te llamará Carmen en unos segundos.");
    } finally { setBusy(false); }
  }

  function codigoDesvio(numero: string) {
    return `**61*${numero.replace(/^\+/, "")}**30#`;
  }

  if (step === "done" && assigned) {
    return (
      <div className="card-hard p-5 bg-[#14B8A6]/10 border-[#14B8A6]">
        <h3 className="font-stencil text-2xl mb-2">✅ Carmen activada</h3>
        <p className="text-xs text-black/70 mb-3">Tu número Carmen: <b className="text-lg">{assigned}</b></p>

        <div className="card-hard p-3 bg-white mb-3">
          <div className="text-[10px] font-mono uppercase mb-2">¿Cómo usarlo?</div>
          <p className="text-sm mb-2"><b>Opción A · Mantener tu número actual:</b></p>
          <ol className="text-xs space-y-1 list-decimal pl-5">
            <li>Coge tu móvil del negocio</li>
            <li>Marca este código: <code className="bg-black text-[color:var(--mustard)] px-2 py-0.5 font-mono">{codigoDesvio(assigned)}</code></li>
            <li>Pulsa llamar. Verás "Servicio activado".</li>
            <li>Cuando no contestes en 30s, Carmen recogerá la llamada.</li>
          </ol>
          <p className="text-sm mt-3 mb-2"><b>Opción B · Publicar el número Carmen directamente:</b></p>
          <p className="text-xs">Usa <b>{assigned}</b> en tu Google Business, web y tarjetas. Todas las llamadas las recoge Carmen.</p>
        </div>

        <div className="card-hard p-3 bg-[color:var(--cream)]">
          <div className="text-[10px] font-mono uppercase mb-2">🧪 Probar ahora</div>
          <div className="flex gap-2 flex-wrap items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="text-[10px] font-mono block mb-1">Tu móvil para test (+34...)</label>
              <input value={miMovil} onChange={(e) => setMiMovil(e.target.value)} placeholder="+34600123456" className="w-full border-2 border-black px-2 py-1 text-sm" />
            </div>
            <button onClick={testCall} disabled={busy || !miMovil} className="btn-mustard text-xs disabled:opacity-50">📞 Recibir test</button>
          </div>
          <p className="text-[10px] text-black/60 mt-2">O marca <b>{assigned}</b> tú mismo desde otro teléfono para escuchar Carmen.</p>
        </div>

        <button onClick={() => { setAssigned(null); setStep("intro"); }} className="text-[10px] text-black/40 mt-3 underline">Cambiar de número</button>
      </div>
    );
  }

  if (!twilioOk) {
    return (
      <div className="card-hard p-5 bg-[color:var(--red)]/10 border-[color:var(--red)]">
        <h3 className="font-stencil text-2xl mb-2">⚠️ Carmen pendiente activación</h3>
        <p className="text-sm">El equipo AI-Team está terminando la configuración de Twilio. Carmen estará disponible en unas horas. Mientras tanto puedes probar el editor + sandbox abajo.</p>
      </div>
    );
  }

  return (
    <div className="card-hard p-5 bg-[#A88BE8]/10 border-[#A88BE8]">
      <h3 className="font-stencil text-2xl mb-2">🚀 Activar Carmen</h3>
      <p className="text-xs text-black/70 mb-3">En 2 minutos Carmen empieza a contestar tus llamadas perdidas.</p>

      {step === "intro" && (
        <div className="space-y-3">
          <p className="text-sm">Vamos a asignarte un número Carmen. Lo puedes:</p>
          <ul className="text-sm space-y-1 list-disc pl-5">
            <li><b>Publicar directamente</b> como nuevo número de contacto</li>
            <li><b>Desviar</b> tu número actual cuando no contestes (recomendado)</li>
          </ul>
          <button onClick={() => setStep("nuevo")} className="btn-mustard text-sm">Empezar →</button>
        </div>
      )}

      {step === "nuevo" && (
        <div className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-mono block mb-1">Tipo de número</label>
              <select value={numeroType} onChange={(e) => setNumeroType(e.target.value as "local" | "mobile" | "tollfree")} className="w-full border-2 border-black px-2 py-1 text-sm bg-white">
                <option value="local">Fijo geográfico (91, 93…)</option>
                <option value="mobile">Móvil (6XX, 7XX)</option>
                <option value="tollfree">Gratuito 900</option>
              </select>
            </div>
            {numeroType === "local" && (
              <div>
                <label className="text-[10px] font-mono block mb-1">Zona</label>
                <select value={areaCode} onChange={(e) => setAreaCode(e.target.value)} className="w-full border-2 border-black px-2 py-1 text-sm bg-white">
                  {AREAS.map((a) => (<option key={a.code} value={a.code}>{a.label}</option>))}
                </select>
              </div>
            )}
          </div>

          <button onClick={buscar} disabled={busy} className="btn-mustard text-xs disabled:opacity-50">{busy ? "Buscando…" : "🔍 Buscar números disponibles"}</button>

          {error && <div className="card-hard p-2 bg-[color:var(--red)]/10 text-xs text-[color:var(--red)]">{error}</div>}

          {available.length > 0 && (
            <div className="space-y-2 mt-3">
              <div className="text-[10px] font-mono uppercase">Disponibles ({available.length})</div>
              {available.map((n) => (
                <div key={n.phone_number} className="border-2 border-black bg-white p-2 flex justify-between items-center gap-2 flex-wrap">
                  <div>
                    <b className="text-sm">{n.phone_number}</b>
                    {n.locality && <span className="text-[10px] text-black/60 ml-2">{n.locality}{n.region ? `, ${n.region}` : ""}</span>}
                  </div>
                  <button onClick={() => comprar(n.phone_number)} disabled={busy} className="btn-mustard text-xs disabled:opacity-50">Asignar →</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {step === "desvio" && (
        <div className="space-y-3">
          <p className="text-sm">¿Qué operadora tienes en tu móvil actual?</p>
          <div className="grid sm:grid-cols-3 gap-2">
            {OPERADORAS_KEYS.map((k) => (
              <button key={k} onClick={() => setOperadora(k)} className={`border-2 border-black px-2 py-1 text-xs ${operadora === k ? "bg-black text-[color:var(--mustard)]" : "bg-white"}`}>
                {operadorasData[k]?.nombre || k}
              </button>
            ))}
          </div>
          {operadora && operadorasData[operadora] && (
            <div className="card-hard p-3 bg-white text-sm">
              <p className="font-bold mb-1">{operadorasData[operadora].nombre}</p>
              <p className="text-xs text-black/70">{operadorasData[operadora].descripcion}</p>
              <p className="text-[10px] mt-2 text-black/50">Te daremos el código exacto en cuanto asignemos tu número Carmen.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
