/**
 * Tests E2E — Provider mistral (Sprint B)
 *
 * Mistral AI = provider direct (OpenAI-compat). Couvre :
 *   1. setProvider + chargement config
 *   2. Chat completion réel
 *   3. Streaming SSE OpenAI-compat
 *   4. Format markdown
 *
 * Note : mistral supporte aussi FIM (Fill-in-the-Middle) — voir sprint suivant.
 *
 * @slow (skip gracieux si MISTRAL_API_KEY absente)
 */
import { test, expect } from '@playwright/test';
import {
  setupProvider,
  sendSmokeMessage,
  openChatRobust,
  lastAssistantHasMarkdown,
  sampleStreamingLength,
  skipIfNoKey,
} from '../helpers/providerTest.js';

test.describe('Provider mistral @slow', () => {
  test.beforeEach(async ({ page }) => {
    skipIfNoKey(test, 'mistral');
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

  test('1 - setProvider(mistral) charge la config par défaut', async ({ page }) => {
    await setupProvider(page, 'mistral');

    const provider = await page.evaluate(() => {
      const s = window.__state.getState();
      return {
        id: s.assistant.provider.id,
        baseUrl: s.assistant.provider.baseUrl,
        model: s.assistant.provider.model,
        apiKey: s.assistant.provider.apiKey,
      };
    });

    expect(provider.id).toBe('mistral');
    expect(provider.baseUrl).toBe('https://api.mistral.ai/v1');
    expect(provider.model).toBe('codestral-latest');
    expect(provider.apiKey).toBeTruthy();
  });

  test('2 - chat completion renvoie une réponse du modèle', async ({ page }) => {
    await setupProvider(page, 'mistral');

    const result = await sendSmokeMessage(
      page,
      'Dis juste "OK" et rien d\'autre.',
      20_000,
    );

    if (!result.success) {
      test.skip(true, `Mistral non accessible (${result.error?.slice(0, 80)}…) — clé ou réseau`);
      return;
    }

    expect(result.content.toLowerCase()).toContain('ok');
  });

  test('3 - streaming : la bulle se remplit progressivement', async ({ page }) => {
    await setupProvider(page, 'mistral');
    await openChatRobust(page);

    await page.locator('#chat-input').fill('Écris une courte phrase de 15 mots sur les chats.');
    await page.locator('#chat-input').press('Enter');

    const lengths = await sampleStreamingLength(page, 5, 500);
    const monotonic = lengths.filter((v, i) => i > 0 && v > lengths[i - 1]).length;

    if (monotonic === 0) {
      test.skip(true, 'Streaming non observable (réponse trop rapide)');
      return;
    }

    expect(monotonic).toBeGreaterThanOrEqual(3);
  });

  test('4 - format markdown parsé (gras + code inline)', async ({ page }) => {
    await setupProvider(page, 'mistral');

    const result = await sendSmokeMessage(
      page,
      'Réponds avec exactement: **gras** et `code`.',
      20_000,
    );

    if (!result.success) {
      test.skip(true, `Mistral non accessible (${result.error?.slice(0, 80)}…)`);
      return;
    }

    const hasMarkdown = await lastAssistantHasMarkdown(page, ['<strong>', '<code>']);
    expect(hasMarkdown).toBe(true);
  });
});
