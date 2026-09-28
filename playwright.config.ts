// Pruebas de punta a punta contra el servidor LOCAL (npm run dev en :3000).
//
//   npx playwright test            → los recorridos, uno detrás de otro
//   npx playwright test --reporter=list
//
// Nunca tocan producción ni mandan nada a nadie: los webhooks de WhatsApp,
// Instagram y Retell se simulan, y lo que "sale" hacia Meta lo recoge un Graph
// de mentira en 127.0.0.1:4545 (el mismo `META_GRAPH_URL` de
// `.env.development.local`). Todo ocurre en un tenant de pruebas
// (`tenant_e2e`) que se monta al empezar y se borra al acabar.
import { defineConfig } from "@playwright/test";
import { loadEnvConfig } from "@next/env";

// Las mismas variables que ve `next dev`: el secreto de Carmen, el de Meta para
// firmar los webhooks simulados, ADMIN_DEV_TOKEN para la ruta de preparación.
loadEnvConfig(process.cwd(), true, { info: () => {}, error: console.error });

export default defineConfig({
  testDir: "./tests/e2e",
  // Un tenant compartido y una agenda compartida: en serie, nunca en paralelo.
  workers: 1,
  fullyParallel: false,
  timeout: 180_000,
  expect: { timeout: 20_000 },
  retries: 0,
  reporter: [["list"], ["json", { outputFile: "e2e-resultados/resultado.json" }]],
  outputDir: "e2e-resultados/artefactos",
  globalSetup: "./tests/e2e/preparar.ts",
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
