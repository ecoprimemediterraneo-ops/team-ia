import { renderAgent } from "@/components/AgentPage";

export default async function CarmenPage() {
  return renderAgent("carmen", [
    "Hola, ¿podría pedir una cita para mañana?",
    "Llamo para preguntar precios",
    "Quería información sobre vuestros servicios",
  ], "Habla como un cliente al teléfono…");
}
