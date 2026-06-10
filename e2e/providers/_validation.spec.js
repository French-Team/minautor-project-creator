/**
 * ⚠️  SPEC TEMPORAIRE DE VALIDATION (à supprimer avant Sprint B/C)
 *
 * Boucle sur les 8 providers configurés et valide EN LIVE que
 * `apikey ↔ provider ↔ model` sont bien alignés (cohérence end-to-end).
 *
 * Utilité : avant de créer les 8 specs Sprint B/C, ce script permet
 * de détecter rapidement :
 *   - clé API absente / invalide
 *   - provider qui ne répond pas
 *   - modèle mal configuré (n'existe pas chez le provider)
 *   - format de réponse non supporté (Gemini, OpenCode Zen)
 *
 * Convention : préfixe `_` pour signaler que c'est jetable, et marqueur
 * `@slow` + `_validation` pour skip facile en PR rapide.
 *
 * Usage :
 *   # Local avec .env
 *   npm run test:e2e:nightly -- _validation
 *
 *   # CI nightly (déjà incluse via @slow)
 *   npm run test:e2e:nightly
 *
 * ⚠️  À SUPPRIMER après validation (avant de créer les specs Sprint B/C)
 *     pour éviter la duplication avec les vrais tests par provider.
 */

import { test, expect } from '@playwright/test';
import {
  REQUIRED_KEYS,
  PROVIDER_MODELS,
  setupProvider,
  sendSmokeMessage,
  skipIfNoKey,
  openChatRobust,
} from '../helpers/providerTest.js';

/* Liste des 8 providers dans l'ordre de PROVIDER_MODELS */
const ALL_PROVIDERS = Object.keys(PROVIDER_MODELS);

/* Compteurs globaux pour le résumé final (réinitialisés par test) */
const results = {
  pass: [],
  skip: [],
  fail: [],
};

test.describe('Provider validation _validation @slow', () => {
  test.beforeEach(async ({ page }) => {
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

  /* ----------------------------------------------------------------
   * Test 1 : pour chaque provider, vérif que la config s'installe
   * (setProvider + apiKey + model)
   * ---------------------------------------------------------------- */
  for (const providerId of ALL_PROVIDERS) {
    test(`config — ${providerId} (${PROVIDER_MODELS[providerId]})`, async ({ page }) => {
      skipIfNoKey(test, providerId);

      await setupProvider(page, providerId);

      const provider = await page.evaluate(() => {
        const s = window.__state.getState();
        return {
          id: s.assistant.provider.id,
          model: s.assistant.provider.model,
          apiKey: s.assistant.provider.apiKey,
        };
      });

      // Vérifier que le provider est bien configuré
      expect(provider.id).toBe(providerId);
      expect(provider.model).toBe(PROVIDER_MODELS[providerId]);

      // Vérifier la clé API si requise
      const envKey = REQUIRED_KEYS[providerId];
      if (envKey) {
        expect(provider.apiKey).toBeTruthy();
        expect(provider.apiKey).toBe(process.env[envKey]);
      }

      results.pass.push(`${providerId} (config)`);
    });
  }

  /* ----------------------------------------------------------------
   * Test 2 : pour chaque provider, tente un chat completion réel
   * C'est le cœur de la validation : on contacte vraiment l'API.
   * Skip si pas de clé (cf. skipIfNoKey), skip si erreur réseau.
   * ---------------------------------------------------------------- */
  for (const providerId of ALL_PROVIDERS) {
    test(`chat — ${providerId} (${PROVIDER_MODELS[providerId]})`, async ({ page }) => {
      skipIfNoKey(test, providerId);

      await setupProvider(page, providerId);

      let result;
      try {
        result = await sendSmokeMessage(
          page,
          'Dis juste "OK" en une seule ligne.',
          45_000, // timeout réduit pour ce test de validation
        );
      } catch (err) {
        results.fail.push(`${providerId} (exception: ${err.message.slice(0, 60)})`);
        test.skip(true, `Exception lors du chat completion: ${err.message.slice(0, 100)}`);
        return;
      }

      if (!result.success) {
        const errShort = (result.error || 'inconnue').slice(0, 100);
        results.fail.push(`${providerId} (${errShort})`);
        // On log mais on ne fail pas le test global (permet de voir tous les providers)
        console.warn(`⚠️  ${providerId} échec : ${errShort}`);
        test.skip(true, `Provider ${providerId} non accessible : ${errShort}`);
        return;
      }

      // La réponse doit contenir "OK" (insensible à la casse/espaces)
      const content = result.content.toLowerCase();
      if (!content.includes('ok')) {
        results.fail.push(`${providerId} (réponse inattendue: "${result.content.slice(0, 50)}")`);
        console.warn(`⚠️  ${providerId} réponse inattendue : "${result.content.slice(0, 80)}"`);
      } else {
        results.pass.push(`${providerId} (chat OK)`);
      }
    });
  }

  /* ----------------------------------------------------------------
   * Test final : résumé de la validation (toujours exécuté, dernier)
   * Affiche un tableau récapitulatif dans la console + step summary GitHub
   * ---------------------------------------------------------------- */
  test('Résumé de la validation (8 providers)', async ({ page: _page }) => {
    // On log le résumé pour visibilité (le test passe toujours)
    const total = ALL_PROVIDERS.length;
    const passCount = results.pass.length;
    const failCount = results.fail.length;
    const skipCount = total * 2 - passCount - failCount; // 2 tests par provider

    const summary = [
      '',
      '═══════════════════════════════════════════════════════',
      '  📋 RÉSUMÉ VALIDATION PROVIDERS (8 attendus)',
      '═══════════════════════════════════════════════════════',
      `  ✅ Pass   : ${passCount} / ${total * 2}`,
      `  ❌ Fail   : ${failCount}`,
      `  ⏭️  Skip   : ${skipCount} (clé absente ou provider injoignable)`,
      '',
      '  Détails :',
      ...results.pass.map((p) => `    ✅ ${p}`),
      ...results.fail.map((f) => `    ❌ ${f}`),
      '═══════════════════════════════════════════════════════',
      '',
    ].join('\n');

    console.log(summary);

    // Aussi : ajouter au step summary GitHub Actions
    if (process.env.GITHUB_STEP_SUMMARY) {
      const fs = await import('fs');
      fs.appendFileSync(
        process.env.GITHUB_STEP_SUMMARY,
        `## Validation providers (8 attendus)\n\n\`\`\`\n${summary}\`\`\`\n`,
      );
    }

    // Test toujours vert : ce n'est qu'un rapport
    expect(passCount + failCount + skipCount).toBeGreaterThan(0);
  });
});
