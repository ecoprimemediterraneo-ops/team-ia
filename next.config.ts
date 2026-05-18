import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Incluir los .md de assets/ en el bundle de funciones para que el importador los lea en producción
  outputFileTracingIncludes: {
    "/api/redes/importar": ["./assets/**/*.md"],
  },
};

export default nextConfig;
