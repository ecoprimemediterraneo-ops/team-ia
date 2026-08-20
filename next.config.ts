import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // La pantalla del panel se llamaba /dashboard/reservas. En una gestoría eso no
  // significa nada: la pestaña se llama CLIENTES y la dirección decía "reservas".
  // Se renombró a /dashboard/clientes y la vieja redirige AQUÍ y no con una
  // página, porque una redirección de next.config conserva la query string
  // (?negocio=&tab=&mes=), que es justo lo que llevan los enlaces del informe
  // mensual que ya se han mandado por email.
  async redirects() {
    return [
      { source: "/dashboard/reservas", destination: "/dashboard/clientes", permanent: true },
      { source: "/dashboard/reservas/:ruta*", destination: "/dashboard/clientes/:ruta*", permanent: true },
    ];
  },
  // Ficheros .md que tienen que viajar DENTRO de la función serverless: se leen
  // con fs en tiempo de ejecución, no se importan, así que Next no los detecta solo.
  outputFileTracingIncludes: {
    // Importador de estrategia de redes
    "/api/redes/importar": ["./assets/**/*.md"],
    // Visor del dosier: lee docs/dosier/*.md del disco en cada petición.
    "/admin/dosier": ["./docs/dosier/**/*.md", "./docs/dosier-cliente/**/*.md"],
    "/admin/dosier/imprimir": ["./docs/dosier/**/*.md", "./docs/dosier-cliente/**/*.md"],
  },
};

export default nextConfig;
