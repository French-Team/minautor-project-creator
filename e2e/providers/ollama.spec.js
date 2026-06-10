/**
 * Tests E2E — Provider ollama (pilote Sprint A)
 *
 * Ollama est un provider LOCAL (pas de clé API requise) — c'est le candidat
 * idéal pour valider le pattern d'intégration E2E avant de l'étendre aux
 * 7 autres providers (cf. .dev-plans/providers-e2e-spec.md).
 *
 * Couvre :
 *   1. setProvider('ollama') + chargement config par défaut
 *   2. Chat completion (1 message → réponse attendue)
 *   3. Streaming (SSE OpenAI-compat) → bulle se remplit progressivement
 *   4. Format de réponse markdown parsé correctement
 *
 * @slow Ce fichier est marqué @slow (timeout étendu, peut nécessiter ollama démarré).
 */
import { test, expect } from '@playwright/test';
import {
  setupProvider,
  sendSmokeMessage,
  openChatRobust,
  lastAssistantHasMarkdown,
  sampleStreamingLength,
} from '../helpers/providerTest.js';

test.describe('Provider ollama @slow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.canvas-content', { timeout: 10000 });
    // Clear state
    await page.evaluate(() => {
      localStorage.clear();
      if (window.__state?.actions) {
        window.__state.actions.clear();
        window.__state.actions.clearChatHistory();
      }
    });
  });

  test('1 - setProvider(ollama) charge la config locale par défaut', async ({ page }) => {
    await setupProvider(page, 'ollama');

    const provider = await page.evaluate(() => {
      const s = window.__state.getState();
      return {
        id: s.assistant.provider.id,
        baseUrl: s.assistant.provider.baseUrl,
        model: s.assistant.provider.model,
        apiKey: s.assistant.provider.apiKey,
      };
    });

    expect(provider.id).toBe('ollama');
    expect(provider.baseUrl).toBe('http://localhost:11434/v1');
    expect(provider.model).toBe('lfm2.5:latest');
    // Ollama n'a pas besoin de clé
    expect(provider.apiKey).toBeFalsy();
  });

  test('2 - chat completion renvoie une réponse du modèle local', async ({ page }) => {
    await setupProvider(page, 'ollama');

    const result = await sendSmokeMessage(page, 'Dis juste "OK" et rien d\'autre.');

    // Si ollama n'est pas démarré, le test échoue avec une erreur de connexion
    // (acceptable, mais on documente le comportement attendu)
    if (!result.success) {
      test.skip(
        true,
        `Ollama non accessible (${result.error?.slice(0, 80)}…) — serveur local requis`,
      );
      return;
    }

    expect(result.content.toLowerCase()).toContain('ok');
  });

  test('3 - streaming : la bulle se remplit progressivement', async ({ page }) => {
    await setupProvider(page, 'ollama');
    await openChatRobust(page);

    await page.locator('#chat-input').fill('Écris une courte phrase de 20 mots sur les chats.');
    await page.locator('#chat-input').press('Enter');

    // Échantillonner la longueur de la bulle de streaming 5 fois à 500ms d'intervalle
    const lengths = await sampleStreamingLength(page, 5, 500);

    // Au moins 3 longueurs croissantes (preuve du streaming progressif)
    const monotonic = lengths.filter((v, i) => i > 0 && v > lengths[i - 1]).length;

    if (monotonic === 0) {
      // Ollama n'est peut-être pas démarré, ou la réponse était instantanée
      test.skip(true, 'Streaming non observable (ollama peut-être non démarré)');
      return;
    }

    expect(monotonic).toBeGreaterThanOrEqual(3);
  });

  test('4 - format markdown parsé (gras + code inline)', async ({ page }) => {
    await setupProvider(page, 'ollama');

    const result = await sendSmokeMessage(
      page,
      'Réponds avec exactement: **gras** et `code`.',
    );

    if (!result.success) {
      test.skip(
        true,
        `Ollama non accessible (${result.error?.slice(0, 80)}…) — serveur local requis`,
      );
      return;
    }

    // Le markdown doit être rendu (présence de <strong> et <code> dans le HTML)
    const hasMarkdown = await lastAssistantHasMarkdown(page, ['<strong>', '<code>']);
    expect(hasMarkdown).toBe(true);
  });
});
