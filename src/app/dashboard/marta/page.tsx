import { renderAgent } from "@/components/AgentPage";

export default async function MartaPage() {
  return renderAgent("marta", [
    "Genera 3 posts para esta semana en Instagram",
    "Hazme un carrusel de 5 slides sobre nuestros servicios",
    "Redacta un post para LinkedIn con mi tono",
  ], "Pídele algo a Marta…");
}
