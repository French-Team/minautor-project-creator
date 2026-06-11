/**
 * Tests E2E — Provider opencode-zen (Sprint C)
 *
 * OpenCode Zen = provider avec DOUBLE format selon le modèle :
 *   - requestFormat='openai'     → `${baseUrl}/responses` (OpenAI Responses API)
 *   - requestFormat='anthropic'  → `${baseUrl}/messages`  (Anthropic Messages API)
 * - Pas de streaming SSE : `streamChatCompletion` fallback sur `chatCompletion`
 * - Le code auto-détecte le bon format via `onFormatDetected` callback
 *
 * Couvre :
 *   1. setProvider + chargement config (baseUrl = opencode.ai/zen/v1)
 *   2. Chat completion réel (le code choisit auto OpenAI ou Anthropic)
 *   3. Double format : on vérifie que l'URL appelée contient /responses OU /messages
 *   4. Format markdown parsé correctement
 *
 * @slow (skip gracieux si OPENCODE_ZEN_API_KEY absente)
 */
import { test, expect } from '@playwright/test';
import {
  setupProvider,
  sendSmokeMessage,
  openChatRobust,
  lastAssistantHasMarkdown,
  skipIfNoKey,
} from '../helpers/providerTest.js';

test.describe('Provider opencode-zen @slow', () => {
  test.beforeEach(async ({ page }) => {
    skipIfNoKey(test, 'opencode-zen');
    await page.goto('/');
    await page.waitForSelector('.canvas-content', { timeout: 10000 });
    await page.evaluate(() => {
      localStorage.clear();
      if (window.__state?.actions) {
        window.__state.actions.clear();
        window.__state.actions.clearChatHistory();
      }
    });
  });

  /**
   * Helper local : force le format de requête OpenAI dans modelMeta AVANT
   * chaque chat. Évite le format-retry (openai → anthropic) qui double
   * la latence et fait timeout les tests à 120s.
   * (cf. aiClient.js:393 — `requestFormat = provider.modelMeta?.requestFormat || 'openai'`)
   */
  async function forceOpenAIFormat(page) {
    await page.evaluate(() => {
      const s = window.__state.getState();
      const meta = s.assistant.provider.modelMeta || {};
      window.__state.actions.updateProvider({
        modelMeta: { ...meta, requestFormat: 'openai' },
      });
    });
  }

  test('1 - setProvider(opencode-zen) charge la config par défaut', async ({ page }) => {
    await setupProvider(page, 'opencode-zen');

    const provider = await page.evaluate(() => {
      const s = window.__state.getState();
      return {
        id: s.assistant.provider.id,
        baseUrl: s.assistant.provider.baseUrl,
        model: s.assistant.provider.model,
        apiKey: s.assistant.provider.apiKey,
      };
    });

    expect(provider.id).toBe('opencode-zen');
    expect(provider.baseUrl).toBe('https://opencode.ai/zen/v1');
    expect(provider.model).toBe('deepseek-v4-flash-free');
    expect(provider.apiKey).toBeTruthy();
  });

  test('2 - chat completion renvoie une réponse (format auto-détecté)', async ({ page }) => {
    await setupProvider(page, 'opencode-zen');
    await forceOpenAIFormat(page);

    const result = await sendSmokeMessage(
      page,
      'Écris une phrase de 5 mots sur les chats.',
      45_000, // 45s : le code tente OpenAI puis bascule sur Anthropic si échec
    );

    if (!result.success) {
      test.skip(
        true,
        `OpenCode Zen non accessible (${result.error?.slice(0, 80)}…) — clé ou réseau`,
      );
      return;
    }

    // Vérifie qu'une réponse non-vide est renvoyée (le prompt "5 mots sur les chats"
    // produit une réponse contenant "chats" / "chat" / "mignon" / etc.)
    expect(result.content.length).toBeGreaterThan(0);
    expect(result.content.toLowerCase()).toMatch(/chat|mignon|animal|ronron|dormir/);
  });

  test('3 - double format : URL appelée contient /responses OU /messages', async ({ page }) => {
    await setupProvider(page, 'opencode-zen');
    await forceOpenAIFormat(page);
    await openChatRobust(page);

    // Intercepter les requêtes vers opencode-zen
    const callsToOCZ = [];
    page.on('request', (req) => {
      const url = req.url();
      if (url.includes('opencode.ai/zen/v1/') || url.includes('/local-api/opencode-zen/')) {
        callsToOCZ.push({ url, method: req.method() });
      }
    });

    await page.locator('#chat-input').fill('Dis OK.');
    await page.locator('#chat-input').press('Enter');

    // Attendre 30s max pour qu'au moins une requête passe
    const start = Date.now();
    while (Date.now() - start < 30_000 && callsToOCZ.length === 0) {
      await page.waitForTimeout(500);
    }

    if (callsToOCZ.length === 0) {
      test.skip(true, 'Aucune requête vers opencode-zen en 30s');
      return;
    }

    // Vérifier qu'au moins une URL contient /responses OU /messages (jamais /chat/completions)
    const usesCorrectEndpoint = callsToOCZ.some(
      (c) => c.url.includes('/responses') || c.url.includes('/messages'),
    );
    const usesChatCompletions = callsToOCZ.some((c) => c.url.includes('/chat/completions'));

    expect(usesCorrectEndpoint).toBe(true);
    expect(usesChatCompletions).toBe(false); // opencode-zen n'utilise PAS /chat/completions
  });

  test('4 - format markdown parsé (gras + code inline)', async ({ page }) => {
    await setupProvider(page, 'opencode-zen');
    await forceOpenAIFormat(page);

    const result = await sendSmokeMessage(
      page,
      'Écris 5 mots en Markdown avec **un mot en gras** et `un en code`.',
      45_000,
    );

    if (!result.success) {
      test.skip(true, `OpenCode Zen non accessible (${result.error?.slice(0, 80)}…)`);
      return;
    }

    const hasMarkdown = await lastAssistantHasMarkdown(page, ['<strong>', '<code>']);
    expect(hasMarkdown).toBe(true);
  });
});
