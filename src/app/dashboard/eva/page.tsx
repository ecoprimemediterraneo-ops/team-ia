import { renderAgent } from "@/components/AgentPage";

export default async function EvaPage() {
  return renderAgent("eva", [
    "Diseña una secuencia de bienvenida para nuevos clientes",
    "Newsletter de esta semana con un consejo y una promo",
    "Email de reactivación para clientes que llevan 3 meses sin venir",
  ], "Pídele a Eva que escriba campañas de email…");
}
