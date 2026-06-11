export default function MockupShowcase() {
  return (
    <section className="py-24 border-t-[3px] border-black bg-white overflow-hidden">
      <div className="max-w-5xl mx-auto px-6">

        {/* Label */}
        <div className="flex items-center gap-2 mb-8 text-[10px] font-mono tracking-[0.2em]">
          <span className="bg-black text-[color:var(--mustard)] px-3 py-1 font-bold">PLATAFORMA OPERATIVA</span>
          <span className="border border-black/20 px-3 py-1 text-black/40">EN PRODUCCIÓN HOY</span>
        </div>

        <h2 className="font-stencil text-5xl md:text-6xl mb-4 leading-tight">
          Tu operación.<br />Automatizada.
        </h2>
        <p className="text-base text-black/40 mb-16 max-w-xl">
          Un dashboard central. Seis agentes trabajando en paralelo. Tú solo revisas y apruebas.
        </p>

        {/* Grid de mockups */}
        <div className="grid md:grid-cols-2 gap-6">

          {/* Mockup 1: Dashboard métricas */}
          <div className="border-[3px] border-black overflow-hidden">
            {/* Barra superior */}
            <div className="bg-black px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-white/20" />
                <div className="w-2 h-2 rounded-full bg-white/20" />
                <div className="w-2 h-2 rounded-full bg-white/20" />
              </div>
              <span className="text-[10px] font-mono text-white/40 tracking-widest">AI-TEAM · DASHBOARD</span>
              <div className="text-[10px] font-mono text-green-400">● LIVE</div>
            </div>
            {/* Contenido */}
            <div className="bg-[#0a0a0a] p-5">
              <div className="text-[10px] font-mono text-white/30 tracking-widest mb-4">RESUMEN · HOY</div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "WhatsApps contestados", value: "24", delta: "+12%" },
                  { label: "Reseñas respondidas", value: "7", delta: "+3 nuevas" },
                  { label: "Emails enviados", value: "142", delta: "seq. activa" },
                  { label: "Posts generados", value: "3", delta: "listos ✓" },
                ].map((m) => (
                  <div key={m.label} className="border border-white/8 p-3 bg-white/3">
                    <div className="text-[10px] text-white/30 font-mono mb-2 leading-tight">{m.label}</div>
                    <div className="font-stencil text-2xl text-white">{m.value}</div>
                    <div className="text-[10px] text-green-400 font-mono mt-1">{m.delta}</div>
                  </div>
                ))}
              </div>
              {/* Barra de actividad */}
              <div className="mt-4 border border-white/8 p-3 bg-white/3">
                <div className="text-[10px] font-mono text-white/30 mb-3">ACTIVIDAD ÚLTIMAS 24H</div>
                <div className="flex items-end gap-1 h-8">
                  {[3,5,4,7,6,8,9,7,5,8,10,9,7,6,8,9,10,8,7,9,8,6,7,8].map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 bg-[color:var(--mustard)] opacity-70"
                      style={{ height: `${h * 10}%` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Mockup 2: Conversación agente */}
          <div className="border-[3px] border-black overflow-hidden">
            <div className="bg-black px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-white/20" />
                <div className="w-2 h-2 rounded-full bg-white/20" />
                <div className="w-2 h-2 rounded-full bg-white/20" />
              </div>
              <span className="text-[10px] font-mono text-white/40 tracking-widest">PABLO · WHATSAPP</span>
              <div className="text-[10px] font-mono text-green-400">● ACTIVO</div>
            </div>
            <div className="bg-[#0a0a0a] p-5 space-y-3 min-h-[280px]">
              {/* Mensaje cliente */}
              <div className="flex justify-end">
                <div className="bg-[#25D366]/20 border border-[#25D366]/30 rounded-sm px-3 py-2 max-w-[75%]">
                  <p className="text-xs text-white/80">Hola, ¿tenéis hueco esta semana para una limpieza?</p>
                  <div className="text-[9px] text-white/30 font-mono mt-1 text-right">23:14 ✓✓</div>
                </div>
              </div>
              {/* Respuesta Pablo */}
              <div className="flex justify-start gap-2">
                <div className="w-6 h-6 border border-white/20 overflow-hidden shrink-0 mt-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/agentes/pablo.webp" alt="Pablo" className="w-full h-full object-cover" />
                </div>
                <div className="bg-white/5 border border-white/10 rounded-sm px-3 py-2 max-w-[75%]">
                  <p className="text-[9px] text-[color:var(--mustard)] font-mono mb-1">PABLO · AI-TEAM</p>
                  <p className="text-xs text-white/80">¡Hola! Sí, tenemos disponibilidad el miércoles a las 10:00 o el jueves a las 16:30. ¿Cuál te va mejor?</p>
                  <div className="text-[9px] text-white/30 font-mono mt-1">23:14 ✓✓</div>
                </div>
              </div>
              {/* Cliente */}
              <div className="flex justify-end">
                <div className="bg-[#25D366]/20 border border-[#25D366]/30 rounded-sm px-3 py-2 max-w-[75%]">
                  <p className="text-xs text-white/80">El jueves perfecto 👍</p>
                  <div className="text-[9px] text-white/30 font-mono mt-1 text-right">23:15 ✓✓</div>
                </div>
              </div>
              {/* Pablo confirma */}
              <div className="flex justify-start gap-2">
                <div className="w-6 h-6 border border-white/20 overflow-hidden shrink-0 mt-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/agentes/pablo.webp" alt="Pablo" className="w-full h-full object-cover" />
                </div>
                <div className="bg-white/5 border border-white/10 rounded-sm px-3 py-2 max-w-[75%]">
                  <p className="text-[9px] text-[color:var(--mustard)] font-mono mb-1">PABLO · AI-TEAM</p>
                  <p className="text-xs text-white/80">Perfecto, te confirmo cita el jueves 16 a las 16:30. Te envío recordatorio el día antes. ¡Hasta entonces!</p>
                  <div className="text-[9px] text-white/30 font-mono mt-1">23:15 ✓✓</div>
                </div>
              </div>
              {/* Badge lead */}
              <div className="border border-[color:var(--mustard)]/30 bg-[color:var(--mustard)]/5 px-3 py-2 text-[10px] font-mono text-[color:var(--mustard)]">
                🎯 CITA AGENDADA · JUEVES 16:30 · NOTIFICADO AL EQUIPO
              </div>
            </div>
          </div>

          {/* Mockup 3: Flujo automatización */}
          <div className="border-[3px] border-black overflow-hidden md:col-span-2">
            <div className="bg-black px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-white/20" />
                <div className="w-2 h-2 rounded-full bg-white/20" />
                <div className="w-2 h-2 rounded-full bg-white/20" />
              </div>
              <span className="text-[10px] font-mono text-white/40 tracking-widest">FLUJO DE OPERACIONES · EN TIEMPO REAL</span>
              <div className="text-[10px] font-mono text-green-400">● 7 AGENTES ACTIVOS</div>
            </div>
            <div className="bg-[#0a0a0a] p-6 overflow-x-auto">
              <div className="flex items-center gap-0 min-w-[600px]">
                {[
                  { agent: "CLIENTE", action: "Escribe a las 23:00", color: "border-white/20", text: "white/40" },
                  { agent: "PABLO", action: "Responde en 8 seg.", color: "border-[#25D366]/40", text: "[#25D366]" },
                  { agent: "CARMEN", action: "Agenda la cita", color: "border-purple-400/40", text: "purple-400" },
                  { agent: "ROCÍO", action: "Pide reseña tras visita", color: "border-yellow-400/40", text: "yellow-400" },
                  { agent: "EVA", action: "Envía secuencia bienvenida", color: "border-blue-400/40", text: "blue-400" },
                ].map((n, i) => (
                  <div key={n.agent} className="flex items-center">
                    <div className={`border ${n.color} bg-white/3 px-4 py-3 min-w-[120px]`}>
                      <div className={`text-[9px] font-mono tracking-widest mb-1 text-white/30`}>{n.agent}</div>
                      <div className="text-xs text-white/70">{n.action}</div>
                    </div>
                    {i < 4 && (
                      <div className="flex items-center">
                        <div className="w-6 h-px bg-white/10" />
                        <div className="text-white/20 text-xs">→</div>
                        <div className="w-6 h-px bg-white/10" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>

        {/* Mockup 4: Sergio — Panel de coordinación */}
        <div className="mt-6 border-[3px] border-black overflow-hidden">
          <div className="bg-black px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full bg-white/20" />
                <div className="w-2 h-2 rounded-full bg-white/20" />
                <div className="w-2 h-2 rounded-full bg-white/20" />
              </div>
              <span className="text-[10px] font-mono text-white/40 tracking-widest">SERGIO · COORDINADOR IA · SUPERVISIÓN DEL SISTEMA</span>
            </div>
            <div className="text-[10px] font-mono text-[color:var(--mustard)]">⬡ COORDINANDO</div>
          </div>
          <div className="bg-[#0a0a0a] p-5">
            <div className="grid md:grid-cols-3 gap-4">

              {/* Estado de agentes */}
              <div className="md:col-span-1 border border-white/8 p-4 bg-white/3">
                <div className="text-[10px] font-mono text-white/30 tracking-widest mb-3">ESTADO DEL SISTEMA</div>
                <div className="space-y-2">
                  {[
                    { name: "Pablo", status: "Respondiendo WhatsApp", ok: true },
                    { name: "Carmen", status: "En llamada activa", ok: true },
                    { name: "Rocío", status: "Enviando 3 solicitudes", ok: true },
                    { name: "Lucía", status: "Procesando bandeja", ok: true },
                    { name: "Marta", status: "Post programado ✓", ok: true },
                    { name: "Eva", status: "Secuencia activa", ok: true },
                  ].map((a) => (
                    <div key={a.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${a.ok ? "bg-green-400" : "bg-red-400"}`} />
                        <span className="text-[10px] font-mono text-white/60">{a.name}</span>
                      </div>
                      <span className="text-[9px] font-mono text-white/25">{a.status}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Log de actividad */}
              <div className="md:col-span-1 border border-white/8 p-4 bg-white/3">
                <div className="text-[10px] font-mono text-white/30 tracking-widest mb-3">LOG DE ACTIVIDAD</div>
                <div className="space-y-2 text-[9px] font-mono">
                  {[
                    { time: "23:14", msg: "Pablo cerró cita: Clínica Moreno", color: "text-green-400" },
                    { time: "23:09", msg: "Eva: 3 aperturas en campaña", color: "text-blue-400" },
                    { time: "22:58", msg: "Rocío: reseña 5★ respondida", color: "text-yellow-400" },
                    { time: "22:41", msg: "Competidor actualizó precios", color: "text-[color:var(--mustard)]" },
                    { time: "22:30", msg: "Marta: post publicado Instagram", color: "text-orange-400" },
                    { time: "22:15", msg: "Carmen: llamada gestionada", color: "text-purple-400" },
                    { time: "21:58", msg: "Lucía: 12 correos procesados", color: "text-white/40" },
                  ].map((l, i) => (
                    <div key={i} className="flex gap-2">
                      <span className="text-white/20 shrink-0">{l.time}</span>
                      <span className={l.color}>{l.msg}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Alerta competidores */}
              <div className="md:col-span-1 border border-[color:var(--mustard)]/30 p-4 bg-[color:var(--mustard)]/3">
                <div className="text-[10px] font-mono text-[color:var(--mustard)] tracking-widest mb-3">⚠ ALERTA COMPETENCIA</div>
                <div className="space-y-3">
                  <div className="border border-white/8 p-2 bg-white/3">
                    <div className="text-[9px] text-white/30 font-mono mb-1">Clínica Dental López · hace 47 min</div>
                    <div className="text-[10px] text-white/70">Bajó precio limpieza dental de 60€ a 45€</div>
                  </div>
                  <div className="border border-white/8 p-2 bg-white/3">
                    <div className="text-[9px] text-white/30 font-mono mb-1">Centro Estética competencia · hace 2h</div>
                    <div className="text-[10px] text-white/70">Lanzó promo: «2x1 en depilación láser»</div>
                  </div>
                  <div className="text-[9px] font-mono text-white/20 mt-2">
                    Informe semanal: lunes 09:00 · próximo en 3 días
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
