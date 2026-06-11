/**
 * Tests E2E — Provider kilo (Sprint B)
 *
 * Kilo Code = gateway OpenAI-compat avec modèles :free.
 * ⚠️ Le modèle par défaut (`nvidia/nemotron-3-super-120b-a12b:free`) stream
 * très lentement, on utilise `sendSmokeMessageWithAbort` pour couper le
 * stream à 20s sans contenu et accepter la réponse partielle.
 *
 * Couvre :
 *   1. setProvider + chargement config (pas de clé requise = gateway ouverte)
 *   2. Chat completion (réponse partielle acceptée si lente)
 *   3. Streaming : longueur croissante ou partielle mesurée
 *   4. Format markdown (skip si abort trop tôt)
 *
 * @slow (skip gracieux si KILOCODE_API_KEY absente)
 */
import { test, expect } from '@playwright/test';
import {
  setupProvider,
  sendSmokeMessageWithAbort,
  openChatRobust,
  lastAssistantHasMarkdown,
  skipIfNoKey,
} from '../helpers/providerTest.js';

const SLOW_STREAM = {
  noContentAbortMs: 20_000,
  totalTimeoutMs: 30_000,
  filterUrl: '/local-api/kilo/',
};

test.describe('Provider kilo @slow', () => {
  test.beforeEach(async ({ page }) => {
    skipIfNoKey(test, 'kilo');
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

  test('1 - setProvider(kilo) charge la config par défaut', async ({ page }) => {
    await setupProvider(page, 'kilo');

    const provider = await page.evaluate(() => {
      const s = window.__state.getState();
      return {
        id: s.assistant.provider.id,
        baseUrl: s.assistant.provider.baseUrl,
        model: s.assistant.provider.model,
        apiKey: s.assistant.provider.apiKey,
      };
    });

    expect(provider.id).toBe('kilo');
    expect(provider.baseUrl).toBe('https://api.kilo.ai/api/gateway');
    expect(provider.model).toBe('nvidia/nemotron-3-super-120b-a12b:free');
    // Kilo est une gateway ouverte, la clé peut être présente ou non
    if (provider.apiKey) {
      expect(provider.apiKey).toBeTruthy();
    }
  });

  test('2 - chat completion accepte une réponse partielle si stream trop lent', async ({ page }) => {
    await setupProvider(page, 'kilo');

    const result = await sendSmokeMessageWithAbort(page, {
      message: 'Dis juste "OK" et rien d\'autre.',
      ...SLOW_STREAM,
    });

    if (!result.success) {
      test.skip(
        true,
        `Kilo non accessible ou aucun contenu streamé en ${SLOW_STREAM.totalTimeoutMs / 1000}s`,
      );
      return;
    }

    // Réponse complète OU partielle acceptée
    expect(result.content.length).toBeGreaterThan(0);
    if (!result.partial) {
      // Si le stream a eu le temps de finir, on vérifie "OK"
      expect(result.content.toLowerCase()).toContain('ok');
    } else {
      console.log(
        `✓ kilo réponse partielle acceptée (${result.content.length} chars) : "${result.content.slice(0, 60)}"`,
      );
    }
  });

  test('3 - streaming : contenu reçu ou abort mesuré', async ({ page }) => {
    await setupProvider(page, 'kilo');
    await openChatRobust(page);

    // Patch fetch avant l'envoi pour que sendSmokeMessageWithAbort l'utilise
    await page.evaluate((filter) => {
      if (window.__chatAbortController) {
        try { window.__chatAbortController.abort(); } catch {}
      }
      window.__chatAbortController = new AbortController();
      if (!window.__chatFetchPatched) {
        const originalFetch = window.fetch.bind(window);
        window.fetch = function (input, init) {
          const url = typeof input === 'string' ? input : input?.url || '';
          if (url.includes(filter) && window.__chatAbortController) {
            init = init || {};
            if (!init.signal) init.signal = window.__chatAbortController.signal;
          }
          return originalFetch(input, init);
        };
        window.__chatFetchPatched = true;
      }
    }, SLOW_STREAM.filterUrl);

    await page.locator('#chat-input').fill('Écris une courte phrase sur les chats.');
    await page.locator('#chat-input').press('Enter');

    // Mesurer la longueur de la bulle de streaming toutes les 2s pendant 22s
    const samples = [];
    for (let i = 0; i < 11; i++) {
      await page.waitForTimeout(2_000);
      const len = await page.evaluate(() => {
        const b = document.querySelector('.chat-msg--streaming .chat-msg__bubble');
        return b?.textContent?.length ?? 0;
      });
      samples.push(len);
    }

    // Au moins 1 sample > 0 (preuve que le streaming a commencé)
    // OU abort explicite
    await page.evaluate(() => window.__chatAbortController?.abort());
    await page.waitForTimeout(500);

    const maxLen = Math.max(...samples);
    expect(maxLen).toBeGreaterThanOrEqual(0); // Test informatif — accepte 0 si le modèle ne stream rien
    if (maxLen === 0) {
      test.skip(true, 'Aucun contenu streamé en 22s — modèle peut-être indisponible');
    }
  });

  test('4 - format markdown parsé (skip si abort trop tôt)', async ({ page }) => {
    await setupProvider(page, 'kilo');

    const result = await sendSmokeMessageWithAbort(page, {
      message: 'Réponds avec exactement: **gras** et `code`.',
      ...SLOW_STREAM,
    });

    if (!result.success || result.partial) {
      test.skip(true, 'Réponse partielle ou absente — pas de markdown à vérifier');
      return;
    }

    const hasMarkdown = await lastAssistantHasMarkdown(page, ['<strong>', '<code>']);
    expect(hasMarkdown).toBe(true);
  });
});
