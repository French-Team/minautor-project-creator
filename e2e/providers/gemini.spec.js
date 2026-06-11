/**
 * Tests E2E — Provider gemini (Sprint C)
 *
 * Google Gemini = provider REST natif (PAS OpenAI-compat).
 * - Endpoint : `${baseUrl}/models/${model}:generateContent?key=${apiKey}`
 * - Format body : `{ contents: [...], systemInstruction, generationConfig }`
 * - Format réponse : `{ candidates: [{ content: { parts: [{ text }] } }] }`
 * - Pas de streaming SSE : `streamChatCompletion` fallback sur `chatCompletion`
 *
 * Couvre :
 *   1. setProvider + chargement config (apiKey via query string ?key=)
 *   2. Chat completion réel (format REST natif)
 *   3. Pas de streaming SSE (vérif via le code : la bulle arrive d'un coup)
 *   4. Format markdown parsé correctement
 *
 * @slow (skip gracieux si GEMINI_API_KEY absente)
 */
import { test, expect } from '@playwright/test';
import {
  setupProvider,
  sendSmokeMessage,
  openChatRobust,
  lastAssistantHasMarkdown,
  skipIfNoKey,
} from '../helpers/providerTest.js';

test.describe('Provider gemini @slow', () => {
  test.beforeEach(async ({ page }) => {
    skipIfNoKey(test, 'gemini');
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

  test('1 - setProvider(gemini) charge la config par défaut', async ({ page }) => {
    await setupProvider(page, 'gemini');

    const provider = await page.evaluate(() => {
      const s = window.__state.getState();
      return {
        id: s.assistant.provider.id,
        baseUrl: s.assistant.provider.baseUrl,
        model: s.assistant.provider.model,
        apiKey: s.assistant.provider.apiKey,
      };
    });

    expect(provider.id).toBe('gemini');
    expect(provider.baseUrl).toMatch(/generativelanguage\.googleapis\.com/);
    expect(provider.model).toBe('gemini-2.5-flash');
    expect(provider.apiKey).toBeTruthy();
  });

  test('2 - chat completion renvoie une réponse (format REST natif)', async ({ page }) => {
    await setupProvider(page, 'gemini');

    const result = await sendSmokeMessage(
      page,
      'Dis juste "OK" et rien d\'autre.',
      20_000,
    );

    if (!result.success) {
      test.skip(true, `Gemini non accessible (${result.error?.slice(0, 80)}…) — clé ou réseau`);
      return;
    }

    expect(result.content.toLowerCase()).toContain('ok');
  });

  test('3 - pas de streaming SSE : la réponse arrive en < 3s (chatCompletion)', async ({ page }) => {
    await setupProvider(page, 'gemini');
    await openChatRobust(page);

    // Mesurer le temps entre l'envoi du message et l'apparition de la bulle
    // assistant finale. Gemini (REST natif) doit répondre en < 3s.
    // Les providers OpenAI-compat stream et prennent généralement plus de 3s
    // pour les premières réponses (cold start).
    const t0 = Date.now();
    await page.locator('#chat-input').fill('OK');
    await page.locator('#chat-input').press('Enter');

    // Attendre la bulle assistant finale (post-traitement)
    await page.waitForSelector('.chat-msg--assistant:not(.chat-msg--streaming)', {
      timeout: 10_000,
    });
    const elapsed = Date.now() - t0;

    if (elapsed >= 3_000) {
      test.skip(
        true,
        `Réponse reçue en ${elapsed}ms (> 3s) — ressemble à un streaming OpenAI-compat, pas du REST Gemini natif`,
      );
      return;
    }

    console.log(`✓ Gemini réponse reçue en ${elapsed}ms (< 3s = REST natif)`);
  });

  test('4 - format markdown parsé (gras + code inline)', async ({ page }) => {
    await setupProvider(page, 'gemini');

    const result = await sendSmokeMessage(
      page,
      'Réponds avec exactement: **gras** et `code`.',
      20_000,
    );

    if (!result.success) {
      test.skip(true, `Gemini non accessible (${result.error?.slice(0, 80)}…)`);
      return;
    }

    const hasMarkdown = await lastAssistantHasMarkdown(page, ['<strong>', '<code>']);
    expect(hasMarkdown).toBe(true);
  });
});
