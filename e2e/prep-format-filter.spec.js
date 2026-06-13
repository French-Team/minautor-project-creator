/**
 * Tests E2E — Filtre format du provider de prep (Zone 4)
 *
 * Vérifie le scénario end-to-end demandé par l'utilisateur :
 *  1. Configurer 2 providers (openrouter + gemini) avec modèles
 *  2. Changer le chat vers openrouter
 *  3. Vérifier que gemini n'apparaît PAS dans le dropdown prep (exclu par format)
 *
 * Les tests seed l'état via `page.evaluate` (pas de vrais appels API) pour
 * rester déterministes. Pour une couverture "vrai flux utilisateur", il
 * faudrait déclencher testModel() sur chaque provider, ce qui multiplie le
 * temps de test par 10+ et introduit des flakes (timeout API). Le seed
 * direct est le compromis pragmatique pour e2e.
 *
 * On NE SEED PAS via `actions.setProvider` (qui pollue providerConfigs via le
 * switch) — on manipule directement `state.assistant` pour avoir un état
 * déterministe.
 */

import { test, expect } from '@playwright/test';

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

/** Reset complet : efface localStorage + recharge la page + attend le canvas. */
async function freshPage(page) {
  await page.goto('/');
  await page.waitForSelector('.canvas-content', { timeout: 10000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.canvas-content', { timeout: 10000 });
  // Petit délai pour laisser initAssistant finir ses fetch
  await page.waitForTimeout(500);
}

/**
 * Ouvre le panneau providers et attend que la zone 4 soit rendue.
 * Remplace le fragile `waitForTimeout(500)` par un waitForSelector déterministe.
 */
async function openProvidersPanel(page) {
  const btn = page.locator('#providers-btn');
  await btn.click();
  await page.waitForSelector('.pp-prep-optimizer', { timeout: 5000 });
  await page.waitForSelector('#pp-prep-provider', { state: 'visible', timeout: 5000 });
}

/**
 * Seed déterministe de l'état. Force providerConfigs à l'objet fourni
 * (pas de merge avec l'existant), force le chat provider, et force
 * preparationProviderId. Bypasses `actions.setProvider` pour éviter la
 * pollution des configs via le switch.
 */
async function seedState(page, { chat, providerConfigs, preparationProviderId = null }) {
  await page.evaluate(({ chat, providerConfigs, preparationProviderId }) => {
    const { getState } = window.__state;
    const s = getState();
    // Force le chat provider (avec modelMeta pour le filtre)
    s.assistant.provider = {
      id: chat.id,
      baseUrl: chat.baseUrl || '',
      model: chat.model,
      temperature: 0.7,
      maxTokens: 4096,
      isConnected: true,
      lastTestedAt: Date.now(),
      modelMeta: chat.modelMeta,
    };
    // Force providerConfigs (override complet, pas de merge)
    s.assistant.providerConfigs = providerConfigs;
    s.assistant.preparationProviderId = preparationProviderId;
  }, { chat, providerConfigs, preparationProviderId });
  await page.waitForTimeout(150);
}

/** Helper pour les options du dropdown prep. */
async function getPrepOptions(page) {
  return page.locator('#pp-prep-provider option').allTextContents();
}

/* -------------------------------------------------------------------------- */
/*  Tests                                                                     */
/* -------------------------------------------------------------------------- */

test.describe('Filtre format prep (Zone 4)', () => {

  // -----------------------------------------------------------------------
  // Scénario principal demandé par l'utilisateur
  // -----------------------------------------------------------------------

  test('Scénario complet : (1) 2 providers + (2) chat=openrouter + (3) gemini EXCLU', async ({ page }) => {
    await freshPage(page);

    // 1. Configure 2 providers : openrouter (chat, openai) + gemini (prep, gemini)
    await seedState(page, {
      chat: {
        id: 'openrouter',
        model: 'gpt-4',
        modelMeta: { format: 'openai', contextWindow: 128000, latency: 100, capabilities: ['chat'] },
      },
      providerConfigs: {
        gemini: {
          model: 'gemini-2.5-flash',
          contextWindow: 200000,
          format: 'gemini',
        },
      },
    });

    // 2. Ouvre le panneau
    await openProvidersPanel(page);

    // 3. Vérifie le dropdown
    const options = await getPrepOptions(page);
    // Sanity : il y a au moins 1 option (le défaut "Même provider")
    expect(options.length).toBeGreaterThanOrEqual(1);
    // Le défaut est toujours présent
    expect(options[0]).toContain('Même provider que le chat');
    // gemini est EXCLU (assertion principale)
    const hasGemini = options.some((opt) => opt.toLowerCase().includes('gemini'));
    expect(hasGemini).toBe(false);
    // Aucun provider eligible (gemini est le seul configuré et il est filtré)
    expect(options.length).toBe(1);
  });

  // -----------------------------------------------------------------------
  // Scénario "change chat" — exerce l'auto-reset + warning toast
  // -----------------------------------------------------------------------

  test('Change chat ollama→openrouter : prep=gemini → auto-reset + warning', async ({ page }) => {
    await freshPage(page);

    // Setup initial : chat=ollama (openai, 4k), prep=gemini (gemini, 200k) — INCOMPATIBLE format
    await seedState(page, {
      chat: {
        id: 'ollama',
        model: 'llama3.2',
        modelMeta: { format: 'openai', contextWindow: 4096, latency: 50, capabilities: ['chat'] },
      },
      providerConfigs: {
        gemini: { model: 'gemini-2.5-flash', contextWindow: 200000, format: 'gemini' },
      },
      preparationProviderId: 'gemini',
    });

    // Ouvre le panneau pour initialiser le subscriber (l'auto-reset a besoin d'isOpen)
    await openProvidersPanel(page);

    // Vérifie l'état initial : prep=gemini (mais exclu du dropdown car format non supporté)
    let prepId = await page.evaluate(() => window.__state.getState().assistant.preparationProviderId);
    expect(prepId).toBe('gemini');
    let options = await getPrepOptions(page);
    expect(options.some((o) => o.toLowerCase().includes('gemini'))).toBe(false);

    // (2) Change le chat vers openrouter en 2 temps :
    //   a) setProvider pour switcher + fire l'event assistant:provider (mais modelMeta est null à ce moment)
    //   b) updateProvider pour setter le modelMeta + re-fire l'event (c'est lui qui déclenchera l'auto-reset)
    // Sans cette séquence, le subscriber ne peut pas comparer les CW (inconnues au moment du switch).
    await page.evaluate(() => {
      window.__state.actions.setProvider('openrouter');
    });
    await page.waitForTimeout(100);
    await page.evaluate(() => {
      window.__state.actions.updateProvider({
        model: 'gpt-4',
        modelMeta: { format: 'openai', contextWindow: 128000, latency: 100, capabilities: ['chat'] },
        isConnected: true,
        lastTestedAt: Date.now(),
      });
    });
    await page.waitForTimeout(500);

    // (3) Vérifie l'auto-reset : le prep actuel (gemini) est incompatible avec
    // le nouveau chat (format 'gemini' non supporté) → preparationProviderId = null
    prepId = await page.evaluate(() => window.__state.getState().assistant.preparationProviderId);
    expect(prepId).toBeNull();

    // Vérifie que le dropdown est mis à jour
    options = await getPrepOptions(page);
    expect(options.some((o) => o.toLowerCase().includes('gemini'))).toBe(false);
  });

  // -----------------------------------------------------------------------
  // Sanity checks : openai et anthropic sont éligibles (régression)
  // -----------------------------------------------------------------------

  test('Sanity check : prep avec format openai EST visible (non-régression)', async ({ page }) => {
    await freshPage(page);
    // chat=ollama (4k, openai), prep=openrouter (128k, openai) → CW OK + format OK
    await seedState(page, {
      chat: {
        id: 'ollama',
        model: 'llama3.2',
        modelMeta: { format: 'openai', contextWindow: 4096, latency: 50, capabilities: ['chat'] },
      },
      providerConfigs: {
        openrouter: { model: 'gpt-4', contextWindow: 128000, format: 'openai' },
      },
    });
    await openProvidersPanel(page);
    const options = await getPrepOptions(page);
    expect(options.length).toBe(2);
    expect(options[0]).toContain('Même provider que le chat');
    // Note : le nom du preset est 'OpenRouter' (avec capitales), pas 'openrouter'
    expect(options[1]).toMatch(/openrouter/i);
  });

  test('Sanity check : prep avec format anthropic EST visible (non-régression)', async ({ page }) => {
    await freshPage(page);
    // chat=ollama (4k, openai), prep=anthropic (200k, anthropic) → CW OK + format OK
    await seedState(page, {
      chat: {
        id: 'ollama',
        model: 'llama3.2',
        modelMeta: { format: 'openai', contextWindow: 4096, latency: 50, capabilities: ['chat'] },
      },
      providerConfigs: {
        anthropic: { model: 'claude-3.5-sonnet', contextWindow: 200000, format: 'anthropic' },
      },
    });
    await openProvidersPanel(page);
    const options = await getPrepOptions(page);
    expect(options.length).toBe(2);
    expect(options[0]).toContain('Même provider que le chat');
    expect(options[1]).toMatch(/claude|anthropic/i);
  });

  // -----------------------------------------------------------------------
  // Filtre CW : complémentaire au filtre format
  // -----------------------------------------------------------------------

  test('Filtre CW : prep avec CW insuffisante est EXCLU (4k < 128k)', async ({ page }) => {
    await freshPage(page);
    // chat=openrouter (128k, openai), prep=ollama (4k, openai) → CW exclut, format OK
    await seedState(page, {
      chat: {
        id: 'openrouter',
        model: 'gpt-4',
        modelMeta: { format: 'openai', contextWindow: 128000, latency: 100, capabilities: ['chat'] },
      },
      providerConfigs: {
        ollama: { model: 'llama3.2', contextWindow: 4096, format: 'openai' },
      },
    });
    await openProvidersPanel(page);
    const options = await getPrepOptions(page);
    expect(options.length).toBe(1);
    expect(options[0]).toContain('Même provider que le chat');
    expect(options.some((o) => o.toLowerCase().includes('ollama'))).toBe(false);
  });
});
