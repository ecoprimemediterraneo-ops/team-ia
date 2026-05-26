import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

type Competidor = {
  slug: string;
  nombre: string;
  emoji: string;
  precio: string;
  posicionamiento: string;
  hook: string;
  ventajasEllos: string[];
  desventajasEllos: string[];
  nuestrasVentajas: string[];
  cuandoElegirlos: string;
  cuandoElegirNos: string;
  comparativa: { area: string; ellos: string; nosotros: string }[];
};

const COMPETIDORES: Record<string, Competidor> = {
  doctoralia: {
    slug: "doctoralia",
    nombre: "Doctoralia",
    emoji: "🏥",
    precio: "80-200€/mes",
    posicionamiento: "Marketplace de pacientes con SEO masivo en el sector sanitario.",
    hook: "Doctoralia es brutal para captar pacientes nuevos. Pero te atrapa la BBDD y no automatiza nada del resto de tu marketing.",
    ventajasEllos: [
      "SEO masivo: aparece en las primeras posiciones de Google",
      "Marca conocida — los pacientes confían",
      "Reservas online integradas",
      "Acceso a millones de búsquedas de pacientes",
    ],
    desventajasEllos: [
      "Solo capta — no contesta WhatsApp ni llamadas",
      "No gestiona reseñas en Google Business",
      "No publica en redes sociales",
      "No hace email marketing",
      "Los pacientes son de Doctoralia, no tuyos (no puedes exportar BBDD fácilmente)",
      "Cada paciente nuevo te cobra comisión adicional en muchos planes",
    ],
    nuestrasVentajas: [
      "Cubre los 6 canales digitales, no solo captación",
      "Tu BBDD es tuya, exportable cuando quieras",
      "Sin comisión por cliente captado",
      "Diagnóstico gratis + onboarding 24h",
      "Precio fijo: 79-449€/mes",
    ],
    cuandoElegirlos: "Si tu único cuello de botella es 'no me llegan pacientes nuevos' y ya tienes recepcionista que atiende WhatsApp + llamadas perfectamente.",
    cuandoElegirNos: "Si te entran pacientes pero pierdes ventas por canales mal atendidos (WhatsApp lento, reseñas sin gestionar, redes abandonadas).",
    comparativa: [
      { area: "Captación SEO", ellos: "✅ Top 1", nosotros: "⚠️ SEO local básico" },
      { area: "WhatsApp 24/7", ellos: "❌", nosotros: "✅ Pablo (Pack Local)" },
      { area: "Reseñas Google", ellos: "❌", nosotros: "✅ Rocío" },
      { area: "Llamadas entrantes", ellos: "❌", nosotros: "✅ Carmen incluida" },
      { area: "Redes sociales", ellos: "❌", nosotros: "✅ Marta" },
      { area: "Email marketing", ellos: "❌", nosotros: "✅ Eva" },
      { area: "Inteligencia competitiva", ellos: "❌", nosotros: "✅ Sergio (Pro)" },
      { area: "BBDD exportable", ellos: "⚠️ Limitado", nosotros: "✅ Tuya 100%" },
      { area: "Precio mensual", ellos: "80-200€", nosotros: "79-449€" },
    ],
  },
  klinik: {
    slug: "klinik",
    nombre: "Klinik / Dentalink",
    emoji: "🦷",
    precio: "100-300€/mes",
    posicionamiento: "Software de gestión integral de negocio: agenda, historial, facturación.",
    hook: "Klinik es el ERP de tu negocio. AI-Team es el marketing y atención al paciente automatizado. Lo más probable: necesitas los dos.",
    ventajasEllos: [
      "Gestión interna profunda (agenda, historial clínico, facturación)",
      "Cumplimiento normativo sanitario integrado",
      "Recordatorios de cita básicos",
      "Integraciones con seguros médicos",
    ],
    desventajasEllos: [
      "Curva de aprendizaje alta",
      "Setup inicial de 2-4 semanas",
      "Los recordatorios son básicos (no son agentes IA conversacionales)",
      "No publica en redes ni hace email marketing",
      "No responde reseñas Google",
    ],
    nuestrasVentajas: [
      "Onboarding self-service en 15 minutos",
      "Agentes IA que conversan, no solo recordatorios",
      "Cubre marketing externo, no solo gestión interna",
      "Se integra encima de tu software actual",
      "Precio menor para más funciones de marketing",
    ],
    cuandoElegirlos: "Si necesitas software de gestión negocio con cumplimiento normativo. No es comparable a AI-Team, son complementarios.",
    cuandoElegirNos: "Como complemento a tu software de gestión: AI-Team se encarga de captar, retener y comunicar; Klinik se encarga de operar.",
    comparativa: [
      { area: "Agenda + historial", ellos: "✅ Profundo", nosotros: "⚠️ Solo lectura via integración" },
      { area: "Facturación", ellos: "✅", nosotros: "❌" },
      { area: "WhatsApp conversacional", ellos: "❌", nosotros: "✅ Pablo" },
      { area: "Reseñas Google", ellos: "❌", nosotros: "✅ Rocío" },
      { area: "Redes sociales", ellos: "❌", nosotros: "✅ Marta" },
      { area: "Email marketing", ellos: "⚠️ Básico", nosotros: "✅ Eva (secuencias)" },
      { area: "Inteligencia competitiva", ellos: "❌", nosotros: "✅ Sergio" },
      { area: "Tiempo setup", ellos: "2-4 semanas", nosotros: "15 min self-service" },
      { area: "Precio mensual", ellos: "100-300€", nosotros: "79-449€" },
    ],
  },
  agencia: {
    slug: "agencia",
    nombre: "Agencia de marketing tradicional",
    emoji: "🏢",
    precio: "600-2.500€/mes",
    posicionamiento: "Personas humanas que gestionan tu marketing por horas o paquetes.",
    hook: "Una agencia te da estrategia personalizada — y una factura de 600-2.500€/mes. AI-Team te da los 6 canales operativos por 79-449€/mes, con la misma supervisión humana (la tuya).",
    ventajasEllos: [
      "Estrategia 100% personalizada",
      "Reuniones presenciales o por videollamada",
      "Pueden hacer trabajos creativos complejos (vídeos, eventos)",
      "Contacto humano directo",
    ],
    desventajasEllos: [
      "Coste alto: 600-2.500€/mes mínimo",
      "Tiempos lentos: respuesta en horas o días",
      "Dependencia de personas (vacaciones, bajas, rotación)",
      "Suelen cubrir 2-3 canales (no 6)",
      "Sin garantía de continuidad si cambia el account manager",
    ],
    nuestrasVentajas: [
      "Operativo 24/7 sin horarios humanos",
      "Coste 5-10× menor",
      "Cubre 6 canales simultáneos",
      "Sin dependencia de personas (no hay vacaciones)",
      "Respuestas en segundos, no en horas",
    ],
    cuandoElegirlos: "Si tu negocio factura >100k€/mes y necesitas estrategia personalizada profunda con vídeo, eventos o branding complejo.",
    cuandoElegirNos: "Si quieres operación marketing eficiente 24/7 sin pagar 600-2.500€/mes — perfecto para PYMES y negocios locales.",
    comparativa: [
      { area: "Tiempo de respuesta", ellos: "Horas/días", nosotros: "Segundos" },
      { area: "WhatsApp 24/7", ellos: "❌", nosotros: "✅ Pablo" },
      { area: "Llamadas entrantes", ellos: "❌", nosotros: "✅ Carmen incluida" },
      { area: "Reseñas Google", ellos: "⚠️ Manual", nosotros: "✅ Rocío automática" },
      { area: "Redes sociales", ellos: "✅ Manual", nosotros: "✅ Marta IA" },
      { area: "Email marketing", ellos: "✅", nosotros: "✅ Eva" },
      { area: "Inteligencia competitiva", ellos: "⚠️ Manual", nosotros: "✅ Sergio 24/7" },
      { area: "Coste mensual", ellos: "600-2.500€", nosotros: "79-449€" },
      { area: "Vacaciones/bajas", ellos: "Sí", nosotros: "No" },
    ],
  },
  mailchimp: {
    slug: "mailchimp",
    nombre: "Mailchimp + CM + Recepcionista",
    emoji: "🧩",
    precio: "1.500-3.500€/mes (sumado)",
    posicionamiento: "Stack tradicional: cada herramienta + persona para cada canal.",
    hook: "Stack tradicional: Mailchimp (89€) + Community Manager (600€) + Recepcionista part-time (1.200€) = +1.890€/mes. AI-Team Élite hace lo mismo por 249€.",
    ventajasEllos: [
      "Cada herramienta es especialista en su categoría",
      "Recepcionista humana atiende casos complejos",
      "Mailchimp tiene segmentación avanzada",
      "Community manager humano para casos creativos",
    ],
    desventajasEllos: [
      "Coste sumado: 1.500-3.500€/mes",
      "3-5 logins distintos, 3-5 facturas",
      "Sin coordinación entre canales",
      "Curva de aprendizaje en cada herramienta",
      "Mailchimp cobra por contactos a partir de 500",
    ],
    nuestrasVentajas: [
      "1 panel, 1 factura, 6 canales coordinados",
      "Coste mensual 5-10× menor",
      "Eva genera + envía con tu BBDD (sin cobro por contactos)",
      "Pablo + Carmen cubren WhatsApp y llamadas 24/7",
      "Marta + Eva + Lucía coordinados, no descoordinados",
    ],
    cuandoElegirlos: "Si tienes presupuesto >2.000€/mes y prefieres equipo humano dedicado.",
    cuandoElegirNos: "Si quieres el mismo resultado funcional con coste 80% menor y sin gestión de 3 herramientas distintas.",
    comparativa: [
      { area: "Email marketing", ellos: "Mailchimp 89€", nosotros: "Eva (incluida)" },
      { area: "Redes sociales", ellos: "CM 600€", nosotros: "Marta (incluida)" },
      { area: "Recepcionista", ellos: "1.200€ media jornada", nosotros: "Carmen incluida" },
      { area: "WhatsApp 24/7", ellos: "❌ (la rece libra)", nosotros: "✅ Pablo" },
      { area: "Reseñas Google", ellos: "Manual", nosotros: "✅ Rocío" },
      { area: "Inteligencia competitiva", ellos: "❌", nosotros: "✅ Sergio (Pro)" },
      { area: "Total mensual", ellos: "1.889€", nosotros: "249€ (Élite)" },
      { area: "Ahorro anual", ellos: "—", nosotros: "+19.680€" },
    ],
  },
};

export async function generateStaticParams() {
  return Object.keys(COMPETIDORES).map((slug) => ({ competidor: slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ competidor: string }> }): Promise<Metadata> {
  const { competidor } = await params;
  const c = COMPETIDORES[competidor];
  if (!c) return { title: "No encontrado" };
  return {
    title: `AI-Team vs ${c.nombre} — Comparativa honesta`,
    description: c.hook,
    alternates: { canonical: `https://aiteam.marketing/vs/${c.slug}` },
  };
}

export default async function VsPage({ params }: { params: Promise<{ competidor: string }> }) {
  const { competidor } = await params;
  const c = COMPETIDORES[competidor];
  if (!c) notFound();

  return (
    <>
      <Navbar />
      <main className="flex-1">
        <section className="py-16 border-b-[3px] border-black bg-[color:var(--cream)]">
          <div className="max-w-5xl mx-auto px-5 text-center">
            <div className="flex items-center justify-center gap-4 text-5xl mb-4">
              <span>🤖</span>
              <span className="font-stencil text-3xl">VS</span>
              <span>{c.emoji}</span>
            </div>
            <h1 className="font-stencil text-3xl md:text-5xl mb-4">
              AI-Team vs {c.nombre}
            </h1>
            <p className="text-lg text-black/70 max-w-3xl mx-auto">{c.hook}</p>
          </div>
        </section>

        <section className="py-12">
          <div className="max-w-5xl mx-auto px-5">
            <div className="overflow-x-auto card-hard bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-black text-[color:var(--mustard)]">
                    <th className="text-left px-4 py-3 font-mono text-xs tracking-widest">ÁREA</th>
                    <th className="text-left px-4 py-3 font-mono text-xs tracking-widest">{c.nombre.toUpperCase()}</th>
                    <th className="text-left px-4 py-3 font-mono text-xs tracking-widest bg-[color:var(--mustard)] text-black">AI-TEAM</th>
                  </tr>
                </thead>
                <tbody>
                  {c.comparativa.map((row, i) => (
                    <tr key={row.area} className={i % 2 === 0 ? "bg-[color:var(--cream)]/40" : "bg-white"}>
                      <td className="px-4 py-3 font-semibold">{row.area}</td>
                      <td className="px-4 py-3">{row.ellos}</td>
                      <td className="px-4 py-3 font-semibold">{row.nosotros}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="py-12 border-t-[3px] border-black bg-white">
          <div className="max-w-5xl mx-auto px-5 grid md:grid-cols-2 gap-6">
            <div className="card-hard p-5">
              <h2 className="font-stencil text-2xl mb-3">Cuándo elegir {c.nombre}</h2>
              <p className="text-sm text-black/70">{c.cuandoElegirlos}</p>
              <div className="mt-4 pt-4 border-t border-black/10">
                <div className="text-xs font-mono uppercase tracking-widest text-black/50 mb-2">Lo que hacen bien</div>
                <ul className="space-y-2 text-sm">
                  {c.ventajasEllos.map((v) => <li key={v} className="flex gap-2"><span className="text-green-700 font-bold">✓</span> {v}</li>)}
                </ul>
              </div>
              <div className="mt-4 pt-4 border-t border-black/10">
                <div className="text-xs font-mono uppercase tracking-widest text-black/50 mb-2">Donde se quedan cortos</div>
                <ul className="space-y-2 text-sm">
                  {c.desventajasEllos.map((v) => <li key={v} className="flex gap-2"><span className="text-[color:var(--red)] font-bold">✗</span> {v}</li>)}
                </ul>
              </div>
            </div>
            <div className="card-hard p-5 bg-[color:var(--mustard)]">
              <h2 className="font-stencil text-2xl mb-3">Cuándo elegir AI-Team</h2>
              <p className="text-sm">{c.cuandoElegirNos}</p>
              <div className="mt-4 pt-4 border-t border-black/30">
                <div className="text-xs font-mono uppercase tracking-widest mb-2">Nuestras ventajas</div>
                <ul className="space-y-2 text-sm">
                  {c.nuestrasVentajas.map((v) => <li key={v} className="flex gap-2"><span className="font-bold">▸</span> {v}</li>)}
                </ul>
              </div>
              <div className="mt-4 pt-4 border-t border-black/30">
                <strong>Precio:</strong> {c.precio} vs <strong>79-449€/mes AI-Team</strong>
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 border-t-[3px] border-black bg-black text-white">
          <div className="max-w-3xl mx-auto px-5 text-center">
            <h2 className="font-stencil text-3xl md:text-5xl mb-4">¿Tu caso concreto?</h2>
            <p className="text-lg mb-8 text-white/80">
              Diana hace un diagnóstico personalizado en 2 min y te dice si AI-Team te encaja o si te conviene más {c.nombre}.
            </p>
            <Link href="/diagnostico" className="btn-mustard inline-block">
              DIAGNÓSTICO GRATIS →
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
