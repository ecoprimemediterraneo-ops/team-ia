"use client";
import { useState, useMemo } from "react";

export default function ROICalc() {
  const [pacientesMes, setPacientesMes] = useState(80);
  const [valorCita, setValorCita] = useState(60);
  const [noShowRate, setNoShowRate] = useState(20);
  const [presupuestosMes, setPresupuestosMes] = useState(15);
  const [valorPresupuesto, setValorPresupuesto] = useState(800);
  const [pacientesInactivos, setPacientesInactivos] = useState(150);

  const calc = useMemo(() => {
    // Pérdidas actuales
    const noShowsMes = Math.round(pacientesMes * (noShowRate / 100));
    const perdidaNoShows = noShowsMes * valorCita;
    const perdidaPresupuestos = Math.round(presupuestosMes * 0.4 * valorPresupuesto); // 40% no se cierran
    const perdidaInactivos = Math.round(pacientesInactivos * 0.05 * valorCita); // 5% recuperables/mes

    const perdidaTotalMes = perdidaNoShows + perdidaPresupuestos + perdidaInactivos;

    // Recuperación con AI-Team (estimación conservadora)
    const recuperaNoShows = Math.round(perdidaNoShows * 0.5); // 50% reducción con recordatorios
    const recuperaPresupuestos = Math.round(perdidaPresupuestos * 0.35); // 35% más cierre con seguimiento
    const recuperaInactivos = Math.round(perdidaInactivos * 0.7); // 70% del potencial

    const recuperacionTotal = recuperaNoShows + recuperaPresupuestos + recuperaInactivos;
    const costeAITeam = 149; // pack Crecimiento dental
    const beneficioNeto = recuperacionTotal - costeAITeam;
    const roi = costeAITeam > 0 ? Math.round((beneficioNeto / costeAITeam) * 100) : 0;

    return {
      perdidaTotalMes,
      perdidaNoShows,
      perdidaPresupuestos,
      perdidaInactivos,
      recuperacionTotal,
      recuperaNoShows,
      recuperaPresupuestos,
      recuperaInactivos,
      costeAITeam,
      beneficioNeto,
      roi,
    };
  }, [pacientesMes, valorCita, noShowRate, presupuestosMes, valorPresupuesto, pacientesInactivos]);

  return (
    <section className="py-24 border-t-[3px] border-black bg-white">
      <div className="max-w-5xl mx-auto px-5">
        <div className="flex items-center gap-3 mb-6 text-xs font-mono">
          <span className="bg-black text-[color:var(--mustard)] px-2 py-1 font-bold tracking-widest">CALCULADORA ROI</span>
          <span className="border-2 border-[color:var(--red)] text-[color:var(--red)] px-2 py-1 font-bold tracking-widest">PARA TU CLÍNICA</span>
        </div>
        <h2 className="font-stencil text-5xl md:text-7xl mb-4">¿Cuánto pierdes hoy?</h2>
        <p className="text-lg max-w-2xl mb-12 text-black/70">
          Pon los números de tu clínica. Te decimos lo que estás dejando sobre la mesa al mes (y lo que recuperarías con AI-Team).
        </p>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Inputs */}
          <div className="card-hard p-6 bg-[color:var(--cream)] space-y-5">
            <h3 className="font-stencil text-2xl">Tus números actuales</h3>

            <div>
              <label className="block text-sm font-bold mb-1">Pacientes que vienen al mes</label>
              <input type="range" min="20" max="300" value={pacientesMes} onChange={(e) => setPacientesMes(Number(e.target.value))} className="w-full" />
              <div className="text-2xl font-stencil">{pacientesMes}</div>
            </div>

            <div>
              <label className="block text-sm font-bold mb-1">Valor medio por cita (€)</label>
              <input type="range" min="20" max="200" step="5" value={valorCita} onChange={(e) => setValorCita(Number(e.target.value))} className="w-full" />
              <div className="text-2xl font-stencil">{valorCita} €</div>
            </div>

            <div>
              <label className="block text-sm font-bold mb-1">% de no-shows / cancelaciones tarde</label>
              <input type="range" min="0" max="50" value={noShowRate} onChange={(e) => setNoShowRate(Number(e.target.value))} className="w-full" />
              <div className="text-2xl font-stencil">{noShowRate}%</div>
            </div>

            <div>
              <label className="block text-sm font-bold mb-1">Presupuestos que das al mes (implantes, ortodoncia…)</label>
              <input type="range" min="0" max="50" value={presupuestosMes} onChange={(e) => setPresupuestosMes(Number(e.target.value))} className="w-full" />
              <div className="text-2xl font-stencil">{presupuestosMes}</div>
            </div>

            <div>
              <label className="block text-sm font-bold mb-1">Valor medio presupuesto (€)</label>
              <input type="range" min="200" max="3000" step="50" value={valorPresupuesto} onChange={(e) => setValorPresupuesto(Number(e.target.value))} className="w-full" />
              <div className="text-2xl font-stencil">{valorPresupuesto} €</div>
            </div>

            <div>
              <label className="block text-sm font-bold mb-1">Pacientes inactivos en BD (sin venir +6m)</label>
              <input type="range" min="0" max="1000" step="10" value={pacientesInactivos} onChange={(e) => setPacientesInactivos(Number(e.target.value))} className="w-full" />
              <div className="text-2xl font-stencil">{pacientesInactivos}</div>
            </div>
          </div>

          {/* Resultados */}
          <div className="space-y-4">
            <div className="card-hard p-6 bg-[color:var(--red)] text-white">
              <h3 className="font-mono uppercase tracking-widest text-xs mb-1 opacity-80">Pérdida estimada al mes</h3>
              <div className="font-stencil text-6xl">{calc.perdidaTotalMes.toLocaleString("es-ES")} €</div>
              <ul className="mt-4 text-sm space-y-1 opacity-90">
                <li>· No-shows: {calc.perdidaNoShows.toLocaleString("es-ES")} €</li>
                <li>· Presupuestos no cerrados: {calc.perdidaPresupuestos.toLocaleString("es-ES")} €</li>
                <li>· Pacientes inactivos: {calc.perdidaInactivos.toLocaleString("es-ES")} €</li>
              </ul>
            </div>

            <div className="card-hard p-6 bg-[color:var(--mustard)]">
              <h3 className="font-mono uppercase tracking-widest text-xs mb-1">Recuperarías con AI-Team</h3>
              <div className="font-stencil text-5xl">+{calc.recuperacionTotal.toLocaleString("es-ES")} €/mes</div>
              <ul className="mt-3 text-sm space-y-1">
                <li>· Reducir no-shows 50%: +{calc.recuperaNoShows.toLocaleString("es-ES")} €</li>
                <li>· Cerrar más presupuestos: +{calc.recuperaPresupuestos.toLocaleString("es-ES")} €</li>
                <li>· Recuperar inactivos: +{calc.recuperaInactivos.toLocaleString("es-ES")} €</li>
              </ul>
            </div>

            <div className="card-hard p-6 bg-black text-[color:var(--cream)]">
              <h3 className="font-mono uppercase tracking-widest text-xs mb-1 opacity-60">Resultado neto</h3>
              <div className="text-sm mb-1">Coste AI-Team: <span className="text-[color:var(--mustard)] font-bold">{calc.costeAITeam} €/mes</span></div>
              <div className="text-sm mb-3">Beneficio neto: <span className="text-[color:var(--mustard)] font-bold text-2xl">+{calc.beneficioNeto.toLocaleString("es-ES")} €/mes</span></div>
              <div className="font-stencil text-3xl">ROI: {calc.roi}%</div>
              <a href="#waitlist-dental" className="btn-mustard mt-4 inline-block text-sm">Quiero recuperar este dinero →</a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
