import { renderAgent } from "@/components/AgentPage";

export default async function RocioPage() {
  return renderAgent("rocio", [
    "Redacta un mensaje para pedir reseña tras una cita",
    "Responde a esta reseña 5★: «Trato excelente, repetiré»",
    "Responde a esta reseña 1★: «Llegué a la hora y me hicieron esperar 30 min»",
  ], "Pídele a Rocío que pida o responda reseñas…");
}
