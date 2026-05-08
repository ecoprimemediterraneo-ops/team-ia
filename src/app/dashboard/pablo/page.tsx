import { renderAgent } from "@/components/AgentPage";

export default async function PabloPage() {
  return renderAgent("pablo", [
    "Hola, ¿qué precio tiene una limpieza?",
    "¿Puedo pedir cita para esta semana?",
    "¿Qué horarios tenéis los sábados?",
  ], "Escribe como un cliente por WhatsApp…");
}
