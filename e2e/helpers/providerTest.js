/**
 * Helpers pour tests E2E d'intégration providers.
 *
 * Chaque test :
 *  1. Charge la clé API depuis process.env (skip si absente)
 *  2. Configure le provider via __state.actions.setProvider()
 *  3. Injecte la clé via updateProvider({ apiKey })
 *  4. Ouvre le chat et envoie un message minimal
 *  5. Attend la réponse (toast erreur OU contenu de bulle)
 *
 * Référence : .dev-plans/providers-e2e-spec.md
 * @module providerTest
 */

import { test } from '@playwright/test';

/* ---------------------------------------------------------------------------
 * Constantes
 * ------------------------------------------------------------------------ */

/**
 * Mapping provider ID → variable d'environnement contenant la clé API.
 * Les providers locaux (ollama, lmstudio) et la gateway kilo (gratuite ouverte)
 * n'ont pas besoin de clé.
 * @type {Record<string, string|null>}
 */
export const REQUIRED_KEYS = {
  openrouter: 'OPENROUTER_API_KEY',
  groq: 'GROQ_API_KEY',
  mistral: 'MISTRAL_API_KEY',
  gemini: 'GEMINI_API_KEY',
  'opencode-zen': 'OPENCODE_ZEN_API_KEY',
  kilo: null,
  ollama: null,
  lmstudio: null,
};

/**
 * Modèle par défaut pour chaque provider. Tous choisis pour être gratuits
 * ou très peu chers. Cf. spec §11.B.
 * @type {Record<string, string>}
 */
export const PROVIDER_MODELS = {
  openrouter: 'qwen/qwen3.5-9b', //important TESTER & VALIDER PAR USER DANS UI
  groq: 'groq/compound', //important TESTER & VALIDER PAR USER DANS UI
  mistral: 'codestral-latest', //important TESTER & VALIDER PAR USER DANS UI
  gemini: 'gemini-2.5-flash', //important TESTER & VALIDER PAR USER DANS UI
  'opencode-zen': 'deepseek-v4-flash-free', //important TESTER & VALIDER PAR USER DANS UI
  kilo: 'nvidia/nemotron-3-super-120b-a12b:free', //important TESTER & VALIDER PAR USER DANS UI
  ollama: 'lfm2.5:latest', //important TESTER & VALIDER PAR USER DANS UI
  lmstudio: 'qwen/qwen3.5-9b', //important TESTER & VALIDER PAR USER DANS UI
};

/* ---------------------------------------------------------------------------
 * API publique
 * ------------------------------------------------------------------------ */

/**
 * Skip le test si la clé API du provider n'est pas définie dans process.env.
 * Doit être appelé à l'intérieur du corps d'un test Playwright.
 *
 * @param {import('@playwright/test').Test} test - Instance test Playwright
 * @param {string} providerId - ID du provider
 * @returns {void}
 *
 * @example
 *   test('chat completion', async ({ page }) => {
 *     skipIfNoKey(test, 'openrouter');
 *     // ... test body
 *   });
 */
export function skipIfNoKey(test, providerId) {
  const envKey = REQUIRED_KEYS[providerId];
  if (envKey && !process.env[envKey]) {
    test.skip(true, `Clé ${envKey} absente de process.env — test skippé`);
  }
}

/**
 * Configure un provider dans le state du navigateur.
 * - Appelle __state.actions.setProvider(id)
 * - Injecte la clé API depuis process.env si requise
 * - Set le modèle par défaut (ou override fourni)
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} providerId
 * @param {object} [overrides] - ex: { model: '...' }
 * @returns {Promise<void>}
 */
export async function setupProvider(page, providerId, overrides = {}) {
  const envKey = REQUIRED_KEYS[providerId];
  const apiKey = envKey ? process.env[envKey] || '' : '';
  const model = overrides.model ?? PROVIDER_MODELS[providerId] ?? '';

  await page.evaluate(
    ({ id, apiKey, model }) => {
      window.__state.actions.setProvider(id);
      if (apiKey) {
        window.__state.actions.updateProvider({ apiKey });
      }
      if (model) {
        window.__state.actions.updateProvider({ model });
      }
    },
    { id: providerId, apiKey, model },
  );
  // Laisser le state se stabiliser
  await page.waitForTimeout(200);
}

/**
 * Ouvre le panneau chat de manière robuste (helper interne exporté pour
 * réutilisation dans les specs).
 * - Click sur le body pour garantir le focus avant Ctrl+Shift+A
 * - waitForFunction avec timeout 2s
 * - 500ms pour la transition slide-in
 *
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<void>}
 */
export async function openChatRobust(page) {
  await page.locator('body').click({ position: { x: 10, y: 10 } });
  await page.keyboard.press('Control+Shift+a');
  await page.waitForFunction(
    () => document.getElementById('app-chat')?.classList.contains('is-open') ?? false,
    { timeout: 2000 },
  );
  await page.waitForTimeout(500);
}

/**
 * Ouvre le chat et envoie un message de smoke test.
 * Attend la fin du streaming (succès = contenu de bulle, échec = message erreur).
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} [message='Réponds juste "OK".'] - Message à envoyer
 * @param {number} [timeoutMs=60_000] - Timeout d'attente
 * @returns {Promise<{success: boolean, content: string, error?: string}>}
 *
 * @example
 *   const r = await sendSmokeMessage(page);
 *   expect(r.success).toBe(true);
 *   expect(r.content).toContain('OK');
 */
export async function sendSmokeMessage(page, message = 'Réponds juste "OK".', timeoutMs = 60_000) {
  await openChatRobust(page);
  await page.locator('#chat-input').fill(message);
  await page.locator('#chat-input').press('Enter');

  // Attendre soit une bulle assistant non-vide, soit un message d'erreur.
  // Le streaming crée des .chat-msg--streaming qui passent en .chat-msg--assistant.
  const result = await page
    .waitForFunction(
      () => {
        // Chercher la dernière bulle assistant (post-streaming)
        const assistants = document.querySelectorAll('.chat-msg--assistant:not(.chat-msg--streaming)');
        const last = assistants[assistants.length - 1];
        const content = last?.querySelector('.chat-msg__bubble')?.textContent?.trim() || '';
        // Chercher un éventuel message d'erreur
        const errorEl = document.querySelector('.chat-msg--error:last-child');
        if (content && content.length > 0) {
          return { success: true, content };
        }
        if (errorEl) {
          return { success: false, content: '', error: errorEl.textContent || '' };
        }
        return null;
      },
      { timeout: timeoutMs },
    )
    .then((handle) => handle.jsonValue());

  return result;
}

/* ---------------------------------------------------------------------------
 * Bonus : helper de test de format markdown rendu
 * ------------------------------------------------------------------------ */

/**
 * Vérifie que la dernière bulle assistant contient du HTML markdown rendu
 * (gras, code inline, etc.).
 *
 * @param {import('@playwright/test').Page} page
 * @param {string[]} tags - Liste de balises attendues, ex: ['<strong>', '<code>']
 * @returns {Promise<boolean>}
 */
export async function lastAssistantHasMarkdown(page, tags = ['<strong>', '<code>']) {
  return page.evaluate((tags) => {
    const assistants = document.querySelectorAll('.chat-msg--assistant:not(.chat-msg--streaming)');
    const last = assistants[assistants.length - 1];
    const html = last?.querySelector('.chat-msg__bubble')?.innerHTML || '';
    return tags.every((tag) => html.includes(tag));
  }, tags);
}

/**
 * Mesure la longueur du contenu de la bulle de streaming actuelle à
 * intervalles réguliers pour prouver que le streaming fonctionne.
 *
 * @param {import('@playwright/test').Page} page
 * @param {number} samples - Nombre de mesures
 * @param {number} intervalMs - Intervalle entre mesures (ms)
 * @returns {Promise<number[]>} - Tableau de longueurs observées
 */
export async function sampleStreamingLength(page, samples = 5, intervalMs = 500) {
  const lengths = [];
  for (let i = 0; i < samples; i++) {
    await page.waitForTimeout(intervalMs);
    const len = await page.evaluate(() => {
      const b = document.querySelector('.chat-msg--streaming .chat-msg__bubble');
      return b?.textContent?.length ?? 0;
    });
    lengths.push(len);
  }
  return lengths;
}
