import { renderAgent } from "@/components/AgentPage";

export default async function LuciaPage() {
  return renderAgent("lucia", [
    "Redacta un correo agradeciendo a un cliente nuevo",
    "Resúmeme la semana en 3 prioridades",
    "Ayúdame a redactar una respuesta a una queja",
  ], "Pídele algo a Lucía…");
}
