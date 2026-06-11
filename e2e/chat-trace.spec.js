/**
 * Tests E2E — Chat Trace Instrumentation
 *
 * Automatise la vérification visuelle manuelle de la traçabilité end-to-end
 * du flot chat panel → prompt engine → ai client → system prompt → optimizer.
 *
 * Le traceLogger émet des logs dans :
 *   1. La console DevTools (préfixes [CHAT], [PROMPT-ENGINE], [OPTIMIZER],
 *      [AI-CLIENT], [SYSTEM-PROMPT])
 *   2. Un ring buffer accessible via window.__CHAT_LOG_BUFFER (max 500, FIFO)
 *
 * Scénarios testés :
 *   1) Le buffer __CHAT_LOG_BUFFER est initialisé au chargement de l'app
 *   2) Les 5 helpers trace*() sont importables et appelables
 *   3) L'envoi d'un message chat ajoute 10+ entrées couvrant le flot end-to-end
 *   4) Les timestamps (elapsedMs) sont en ordre chronologique monotone
 *   5) [AI-CLIENT] + optimiser ([OPTIMIZER] optimizeResponse OU CHAT
 *      optimizeLastResponse BADGE) sont couverts si E2E_WITH_LLM=true (gated)
 *
 * Référence : .dev-plans/chat-trace-spec.md §7.2
 *
 * Pré-requis : `node scripts/dev.mjs` doit tourner (env-server:3001 + vite:8081).
 * Si l'env-server est absent, tous les tests sont skippés avec un message clair
 * (cf. beforeAll ci-dessous). Le test 5 nécessite en plus un LLM joignable
 * (OLLAMA local, OpenRouter avec clé, etc.) — gated par E2E_WITH_LLM=true.
 */

import { test, expect } from '@playwright/test';

/* ---------------------------------------------------------------------------
 * Helpers
 * -------------------------------------------------------------------------- */

/**
 * Ouvre le chat panel via le bouton #assistant-btn (plus fiable que le
 * raccourci clavier Control+Shift+a en environnement Playwright).
 * Attend que #chat-input soit visible et focusé.
 */
async function openChatPanel(page) {
  // Le bouton est dans la top bar, toujours présent
  await page.locator('#assistant-btn').click();
  await page.waitForFunction(
    () => document.getElementById('app-chat')?.classList.contains('is-open') ?? false,
    { timeout: 5_000 },
  );
  // Attendre que l'input soit visible (renderInputArea s'exécute après l'ouverture)
  await page.waitForSelector('#chat-input', { state: 'visible', timeout: 3_000 });
}

/**
 * Envoie un message via le bouton send (#chat-send-btn) — plus fiable
 * que le keydown Enter en environnement Playwright.
 *
 * Attend ensuite que le buffer atteigne `minEntries` entrées (ou timeout)
 * via `waitForFunction` (déterministe, plus rapide qu'un `waitForTimeout`
 * arbitraire). Retourne le buffer final.
 */
async function sendMessageAndCollectTraces(page, message, { minEntries = 10, timeoutMs = 10_000 } = {}) {
  await openChatPanel(page);
  const input = page.locator('#chat-input');
  await input.click();
  await input.fill(message);
  // Petite pause pour s'assurer que la valeur est commitée dans le DOM
  await page.waitForTimeout(100);
  // Cliquer le bouton send (handler click sur #chat-send-btn dans renderInputArea)
  await page.locator('#chat-send-btn').click();
  // Attendre que le buffer atteigne le seuil d'entrées (déterministe)
  await page.waitForFunction(
    (min) => (window.__CHAT_LOG_BUFFER?.length ?? 0) >= min,
    minEntries,
    { timeout: timeoutMs },
  );
  return page.evaluate(() => window.__CHAT_LOG_BUFFER || []);
}

/* ---------------------------------------------------------------------------
 * Tests
 * -------------------------------------------------------------------------- */

test.describe('Chat Trace — Instrumentation end-to-end', () => {
  // ---- Fix #2 : test.beforeAll qui skip toute la suite si env-server:3001
  // n'est pas joignable, au lieu de laisser les tests hang pendant 30s.
  // Le webServer Playwright (playwright.config.js) lance `node scripts/dev.mjs`
  // qui démarre env-server:3001 + vite:8081, mais on double-check ici au
  // cas où reuseExistingServer=true prendrait un dev-server stale.
  test.beforeAll(async ({ request }) => {
    let envOk = false;
    let envStatus = -1;
    try {
      const res = await request.get('/api/env', { timeout: 3_000 });
      envStatus = res.status();
      envOk = res.ok();
    } catch (e) {
      envOk = false;
    }
    if (!envOk) {
      test.skip(
        true,
        `env-server (port 3001) indisponible (status=${envStatus}). ` +
          `Lancer \`node scripts/dev.mjs\` avant \`npx playwright test\`. ` +
          `Voir .dev-plans/chat-trace-spec.md §7 (pré-requis).`,
      );
    }
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.canvas-content', { timeout: 10_000 });
    // Reset le buffer pour isolation entre tests
    await page.evaluate(() => {
      window.__CHAT_LOG_BUFFER = [];
    });
  });

  test('Le ring buffer __CHAT_LOG_BUFFER est initialisé au chargement de l\'app', async ({ page }) => {
    // Recharger pour vérifier l'init par traceLogger.js (et pas le reset du beforeEach)
    await page.goto('/');
    await page.waitForSelector('.canvas-content', { timeout: 10_000 });
    await page.waitForTimeout(500);

    const info = await page.evaluate(() => {
      const buf = window.__CHAT_LOG_BUFFER;
      return {
        exists: typeof buf !== 'undefined' && buf !== null,
        isArray: Array.isArray(buf),
        length: buf?.length ?? 0,
      };
    });

    expect(info.exists).toBe(true);
    expect(info.isArray).toBe(true);
    expect(info.length).toBeGreaterThanOrEqual(0);
  });

  test('Les 5 helpers trace*() sont importables depuis traceLogger.js', async ({ page }) => {
    // Le webServer de Playwright sert les modules source Vite en dev,
    // donc on peut dynamic-import le module ESM directement.
    const helpers = await page.evaluate(async () => {
      const mod = await import('/src/code-city/ai/traceLogger.js');
      return Object.keys(mod)
        .filter((k) => k.startsWith('trace'))
        .sort();
    });

    // Les 5 helpers attendus (cf. spec §4.4, §4.5, §5.0)
    expect(helpers).toEqual([
      'traceAiClient',
      'traceChat',
      'traceOptimizer',
      'tracePromptEngine',
      'traceSystemPrompt',
    ]);

    // Vérifier que chaque helper est bien une fonction
    const types = await page.evaluate(async () => {
      const mod = await import('/src/code-city/ai/traceLogger.js');
      return {
        traceChat: typeof mod.traceChat,
        tracePromptEngine: typeof mod.tracePromptEngine,
        traceOptimizer: typeof mod.traceOptimizer,
        traceAiClient: typeof mod.traceAiClient,
        traceSystemPrompt: typeof mod.traceSystemPrompt,
      };
    });
    for (const [name, type] of Object.entries(types)) {
      expect(type, `Helper ${name} should be a function`).toBe('function');
    }
  });

  test('Envoi d\'un message chat ajoute >= 10 entrées au buffer couvrant le flot end-to-end', async ({ page }) => {
    const entries = await sendMessageAndCollectTraces(
      page,
      'Trace test — dis juste "ok" en 1 mot',
      { minEntries: 10, timeoutMs: 10_000 },
    );

    // Assez d'entrées pour couvrir un cycle complet d'envoi
    expect(entries.length).toBeGreaterThanOrEqual(10);

    // Les 4 préfixes obligatoires sont présents dans le buffer.
    // [OPTIMIZER] peut être skippé si l'optimisation n'est pas déclenchée
    // (réponse trop courte, seuil optimizationThreshold non atteint, ou
    // LLM timeout → optimizeLastResponse n'est pas appelé). C'est pourquoi
    // un test séparé (test 5) gated par E2E_WITH_LLM valide [OPTIMIZER]
    // quand un vrai LLM répond.
    const prefixes = new Set(entries.map((e) => e.prefix));
    const requiredPrefixes = ['[CHAT]', '[PROMPT-ENGINE]', '[AI-CLIENT]', '[SYSTEM-PROMPT]'];
    for (const prefix of requiredPrefixes) {
      expect(
        prefixes.has(prefix),
        `Préfixe ${prefix} manquant dans le buffer. Trouvés: ${[...prefixes].join(', ')}`,
      ).toBe(true);
    }

    // Vérifier la structure d'une entrée typique
    const sample = entries[0];
    expect(sample).toHaveProperty('ts');
    expect(sample).toHaveProperty('elapsedMs');
    expect(sample).toHaveProperty('prefix');
    expect(sample).toHaveProperty('event');
    expect(typeof sample.ts).toBe('number');
    expect(typeof sample.elapsedMs).toBe('number');
    expect(typeof sample.prefix).toBe('string');
    expect(typeof sample.event).toBe('string');

    // ---- Fix #5 : keyEvents réduit aux événements qui fire AVANT l'appel
    // API LLM, donc fiables même sans LLM. [AI-CLIENT] chatCompletion et
    // [OPTIMIZER] CALL ne fire que si l'appel API est lancé, ce qui hang
    // 30s (timeout) si aucun LLM n'est dispo. Voir test 5 pour la
    // couverture conditionnelle gated par E2E_WITH_LLM=true.
    const events = entries.map((e) => e.event);
    const keyEvents = [
      'sendMessage ENTRY',     // [CHAT] — toujours émis
      'user message pushed',   // [CHAT] — toujours émis
      'buildSystemMessages',   // [SYSTEM-PROMPT] — toujours émis (ENTRY/SUCCESS)
      'preparePrompt',         // [PROMPT-ENGINE] — toujours émis (COMPLETE)
    ];
    for (const key of keyEvents) {
      const hasMatch = events.some((ev) => ev.includes(key.split(' ')[0]));
      expect(hasMatch, `Aucun événement contenant "${key}" trouvé. Events: ${events.slice(0, 15).join(', ')}`).toBe(true);
    }
  });

  test('Les timestamps elapsedMs sont en ordre chronologique monotone', async ({ page }) => {
    const entries = await sendMessageAndCollectTraces(
      page,
      'Trace test 2 — ordre chronologique',
      { minEntries: 2, timeoutMs: 10_000 },
    );
    expect(entries.length).toBeGreaterThanOrEqual(2);

    // Les elapsedMs doivent être croissants (ou égaux si deux events dans la même ms)
    for (let i = 1; i < entries.length; i++) {
      const prev = entries[i - 1].elapsedMs;
      const curr = entries[i].elapsedMs;
      expect(
        curr,
        `elapsedMs non monotone à l'index ${i}: ${prev} → ${curr} (event: ${entries[i].event})`,
      ).toBeGreaterThanOrEqual(prev);
    }
  });

  // ---- Fix #1 : Test gated par E2E_WITH_LLM=true. Couvre les préfixes
  // [AI-CLIENT] (chatCompletion ENTRY/URL/bodyBuilt/SUCCESS/THROW) et
  // [OPTIMIZER] (optimizeLastResponse CALL) qui ne fire que si un vrai
  // LLM répond. Pour activer :
  //   E2E_WITH_LLM=true npx playwright test e2e/chat-trace.spec.js
  // (avec un LLM joignable : ollama local, OpenRouter avec clé, etc.)
  // Test à double gate : (1) `@slow` permet à `--grep-invert @slow` de
  // skipper ce test en CI rapide (pas de démarrage du runner) ; (2)
  // `test.skip(process.env.E2E_WITH_LLM !== 'true')` à l'intérieur du
  // test skippe proprement si l'env var n'est pas positionnée (nécessite
  // un LLM joignable : ollama local, OpenRouter avec clé, etc.).
  // Helper local : récupère le buffer (utilisé seulement par test 5
  // qui n'utilise pas sendMessageAndCollectTraces car il a besoin
  // d'attendre spécifiquement [CHAT] onDone).
  async function getTraceBuffer(page) {
    return page.evaluate(() => window.__CHAT_LOG_BUFFER || []);
  }

  test('[AI-CLIENT] et optimiser couverts si E2E_WITH_LLM=true (gated) @slow', async ({ page }) => {
    test.skip(
      process.env.E2E_WITH_LLM !== 'true',
      'Test gated par E2E_WITH_LLM=true — nécessite un LLM joignable pour déclencher ' +
        'les events [AI-CLIENT] (chatCompletion) et l\'optimisation post-streaming ' +
        '([OPTIMIZER] optimizeResponse ou [CHAT] optimizeLastResponse BADGE). ' +
        'Lancer avec : E2E_WITH_LLM=true npx playwright test e2e/chat-trace.spec.js',
    );

    // Forcer un seuil d'optimisation bas (100 tokens, le minimum accepté
    // par state.setOptimizationThreshold) pour maximiser les chances que
    // la réponse déclenche l'optimiseur — sans dépendre de la longueur
    // exacte de la réponse du LLM (variable selon le modèle).
    await page.evaluate(() => {
      window.__state?.actions?.setOptimizationThreshold?.(100);
    });

    // Demander une réponse détaillée pour s'assurer qu'elle dépasse le
    // seuil de 100 tokens (~400 chars). Prompt directif qui force un
    // output long.
    await openChatPanel(page);
    const input = page.locator('#chat-input');
    await input.click();
    await input.fill('Énumère en détail les 5 principaux avantages des diagrammes mermaid flowchart pour la documentation technique, avec un exemple concret pour chaque avantage.');
    await page.waitForTimeout(100);
    await page.locator('#chat-send-btn').click();

    // Attendre [CHAT] onDone (signal de fin de streaming). C'est le
    // dernier événement avant optimizeLastResponse CALL. 60s suffisent
    // largement pour un LLM cloud (openrouter, groq, etc.).
    await page.waitForFunction(
      () => (window.__CHAT_LOG_BUFFER || []).some(
        (e) => e.prefix === '[CHAT]' && e.event === 'onDone'
      ),
      { timeout: 60_000 },
    );
    // Attendre que optimizeLastResponse ait le temps de s'exécuter et
    // d'émettre soit [OPTIMIZER] events (si willOptimize=true) soit
    // [CHAT] BADGE no-change (si optimisation sans changement).
    await page.waitForFunction(
      () => (window.__CHAT_LOG_BUFFER || []).some(
        (e) => e.prefix === '[OPTIMIZER]' ||
               (e.prefix === '[CHAT]' && e.event.startsWith('optimizeLastResponse BADGE'))
      ),
      { timeout: 30_000 },
    ).catch(() => {
      // Pas grave si on timeout — on catch et on continue pour voir l'état du buffer
    });

    const entries = await getTraceBuffer(page);
    expect(entries.length).toBeGreaterThanOrEqual(25);

    // Assertion forte : un événement tardif doit être présent, ce qui ne
    // peut arriver QUE si l'appel API LLM a été lancé (pas de LLM →
    // waitForFunction timeout 60s → test fail).
    const events = entries.map((e) => e.event);
    const hasLateEvent = events.some((ev) =>
      ev.includes('chatCompletion') ||
      ev.includes('streamChatCompletion') ||
      ev.includes('parseOpenAIResponse')
    );
    expect(
      hasLateEvent,
      `Aucun événement [AI-CLIENT] tardif trouvé — le LLM n'a pas répondu. ` +
        `Events: ${events.slice(0, 20).join(', ')}`,
    ).toBe(true);

    // Vérifier que l'optimiseur a été appelé : [OPTIMIZER] optimizeResponse*
    // events (depuis promptEngine.optimizeResponse(), préfixe dédié
    // [OPTIMIZER] conformément à la spec §5.0) OU [CHAT] optimizeLastResponse
    // BADGE* events (badge de résultat dans chatPanel.js).
    const hasOptimizerTrace = entries.some(
      (e) => (e.prefix === '[OPTIMIZER]' && e.event.startsWith('optimizeResponse')) ||
             (e.prefix === '[CHAT]' && e.event.startsWith('optimizeLastResponse BADGE'))
    );
    expect(
      hasOptimizerTrace,
      `Aucun événement d'optimisation trouvé — la réponse LLM n'a pas déclenché le flot. ` +
        `Derniers events: ${entries.slice(-5).map((e) => `${e.prefix} ${e.event}`).join(' | ')}`,
    ).toBe(true);

    // [AI-CLIENT] doit être présent (chatCompletion ENTRY/URL/SUCCESS/THROW)
    const prefixes = new Set(entries.map((e) => e.prefix));
    expect(
      prefixes.has('[AI-CLIENT]'),
      `[AI-CLIENT] manquant — le LLM n'a peut-être pas répondu (events: ${entries.length}).`,
    ).toBe(true);
  });
});
