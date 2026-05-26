/**
 * Onboarding · detecta el estado de configuración de cada agente del cliente.
 * Devuelve estructura para pintar el hub centralizado.
 */
import { getClientContext } from "./tomas-context";

export type AgentOnboardingStep = {
  slug: string;
  name: string;
  emoji: string;
  color: string;
  status: "ready" | "config" | "needs_oauth" | "needs_provision" | "needs_dns" | "ok";
  description: string;
  cta: { label: string; href: string };
  blockers: string[];
};

export async function getOnboardingState(owner_email: string): Promise<AgentOnboardingStep[]> {
  const ctx = await getClientContext(owner_email);

  function step(slug: string, name: string, emoji: string, color: string, ctaLabel: string, ctaHref: string): AgentOnboardingStep {
    const a = ctx.agents_status[slug];
    if (!a) return { slug, name, emoji, color, status: "ready", description: "Listo", cta: { label: "Ver", href: ctaHref }, blockers: [] };
    let status: AgentOnboardingStep["status"] = "ok";
    let description = "Configurado y funcionando";
    if (!a.configured) {
      status = "config";
      description = "Necesita configuración inicial";
    }
    if (a.issues.length > 0) {
      description = a.issues[0];
      if (a.issues[0].includes("Twilio") || a.issues[0].includes("número")) status = "needs_provision";
      else if (a.issues[0].includes("OAuth") || a.issues[0].includes("token")) status = "needs_oauth";
      else if (a.issues[0].includes("DNS") || a.issues[0].includes("dominio")) status = "needs_dns";
      else status = "config";
    }
    return { slug, name, emoji, color, status, description, cta: { label: ctaLabel, href: ctaHref }, blockers: a.issues };
  }

  return [
    step("sergio", "Sergio · Competencia", "🕵️", "#3B82F6", "Añadir competidores", "/dashboard/sergio"),
    step("diana", "Diana · Auditora", "🔍", "#14B8A6", "Ver diagnóstico", "/dashboard/diana"),
    step("tomas", "Tomás · Soporte 24/7", "💬", "#06B6D4", "Probar widget", "/dashboard"),
    step("eva", "Eva · Email marketing", "✉️", "#60A5FA", "Configurar dominio", "/dashboard/eva"),
    step("lucia", "Lucía · Asistente Gmail", "📬", "#F5C518", "Conectar Gmail", "/dashboard/lucia"),
    step("marta", "Marta · Community manager", "📱", "#FF7A59", "Conectar Instagram", "/dashboard/marta"),
    step("rocio", "Rocío · Reseñas Google", "⭐", "#FBBF24", "Conectar Google Business", "/dashboard/rocio"),
    step("pablo", "Pablo · WhatsApp", "💬", "#25D366", "Activar WhatsApp", "/dashboard/pablo"),
    step("carmen", "Carmen · Recepcionista voz", "📞", "#A88BE8", "Asignar número Twilio", "/dashboard/carmen"),
  ];
}
