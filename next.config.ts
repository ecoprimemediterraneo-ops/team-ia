import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
