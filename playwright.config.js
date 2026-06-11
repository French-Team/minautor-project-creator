import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  // Ignorer les specs de diagnostic one-shot stockés dans e2e/_debug/
  // (cf. .dev-plans/chat-trace-spec.md §7.2 — utiliser `git restore` ou
  // re-créer le spec si besoin de re-diagnostiquer)
  testIgnore: ['e2e/_debug/**'],
  // Timeout étendu à 60s pour les tests d'intégration providers (cf. .dev-plans/providers-e2e-spec.md)
  timeout: 60_000,
  // Timeout par expect() un peu plus long pour les providers lents (Gemini, OpenCode cold start)
  expect: { timeout: 10_000 },
  retries: 0,
  use: {
    baseURL: 'http://localhost:8081',
    headless: true,
    viewport: { width: 1280, height: 800 },
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'node scripts/dev.mjs',
    port: 8081,
    reuseExistingServer: true,
    timeout: 15_000,
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
  // Metadata pour les rapports (aide à filtrer les tests @slow dans la CI rapide)
  metadata: {
    purpose: 'E2E integration tests for code-city',
    slowMarker: '@slow',
    providerE2ESpec: '.dev-plans/providers-e2e-spec.md',
  },
});
