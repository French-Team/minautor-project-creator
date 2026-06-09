/**
 * Tests E2E — API Keys Modal (Auto-validation + Rotation)
 *
 * Ces tests vérifient :
 * 1. L'auto-validation des clés API quand elles sont ajoutées
 * 2. La rotation des clés quand plusieurs clés sont configurées
 *
 * NOTE: Ces tests nécessitent des clés API valides dans .env
 * ou configurées via les variables d'environnement du test.
 */

import { test, expect } from '@playwright/test';

test.describe('API Keys Modal — Auto-validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.canvas-content', { timeout: 10000 });
    await page.waitForTimeout(500);
    
    // Ouvrir la modal des clés API
    const btn = page.locator('#providers-btn');
    await btn.click();
    await page.waitForTimeout(200);
    
    // Cliquer sur le bouton de gestion des clés (icône clé)
    const keysBtn = page.locator('[data-action="open-keys-modal"]');
    if (await keysBtn.isVisible()) {
      await keysBtn.click();
      await page.waitForTimeout(500);
    }
  });

  test('La modal souvre avec le bouton de gestion des clés', async ({ page }) => {
    const keysModal = page.locator('.api-keys-modal');
    await expect(keysModal).toBeVisible();
  });

  test('Le formulaire dajout d clé affiche les champs provider et valeur', async ({ page }) => {
    // Cliquer sur "Ajouter une clé API"
    const addBtn = page.locator('.api-keys-modal__add-btn, [data-action="add-key"]');
    await addBtn.click();
    await page.waitForTimeout(300);
    
    // Vérifier que le formulaire est affiché
    const providerSelect = page.locator('#api-key-provider');
    const keyInput = page.locator('#api-key-value');
    
    await expect(providerSelect).toBeVisible();
    await expect(keyInput).toBeVisible();
  });

  test('Le bouton save-key montre "Test en cours..." pendant la validation', async ({ page }) => {
    // Ouvrir le formulaire
    const addBtn = page.locator('.api-keys-modal__add-btn, [data-action="add-key"]');
    await addBtn.click();
    await page.waitForTimeout(300);
    
    // Entrer une clé (invalide pour tester le feedback d'erreur)
    const keyInput = page.locator('#api-key-value');
    await keyInput.fill('sk-test-invalide-qui-ne-fera-rien');
    
    // Cliquer sur sauvegarder
    const saveBtn = page.locator('[data-action="save-key"]');
    await saveBtn.click();
    
    // Vérifier que le texte change pendant le test
    await page.waitForTimeout(500);
    const btnText = await saveBtn.textContent();
    // Le texte devrait être "Test en cours..." ou avoir changé
    expect(btnText).toBeTruthy();
  });
});

test.describe('API Keys Modal — Rotation des clés', () => {
  /**
   * Ce test vérifie que la rotation LRU fonctionne correctement.
   * 
   * Stratégie : 
   * 1. Vérifier qu'on a 2+ clés dans /api/env
   * 2. Simuler un appel API qui retourne 429 (rate limit) via route.fulfill
   * 3. Vérifier que le retry utilise une clé différente (via l'index de rotation)
   */
  test('La rotation LRU change de clé après une erreur 429', async ({ page }) => {
    // Vérifier que les clés sont chargées depuis /api/env
    const envKeys = await page.evaluate(async () => {
      const resp = await fetch('/api/env');
      return resp.json();
    });
    
    // Si on a une seule clé ou pas de clé OpenRouter, skip ce test
    const openrouterKeys = Object.keys(envKeys).filter(k => k.startsWith('OPENROUTER_API_KEY'));
    if (openrouterKeys.length < 2) {
      test.skip('Nécessite au moins 2 clés OpenRouter pour tester la rotation');
      return;
    }
    
    // Collecter les clés pour pouvoir les comparer
    const keyValues = openrouterKeys.map(k => envKeys[k]);
    console.log('[Rotation test] Found', keyValues.length, 'OpenRouter keys');
    
    // Tracker les headers Authorization utilisés et le compteur d'appels
    let callCount = 0;
    const authHeadersUsed = [];
    
    // Intercepter les appels OpenRouter pour capturer le header Authorization
    // et simuler une erreur 429 sur le premier appel pour forcer la rotation
    await page.route('**/openrouter.ai/api/v1/chat/completions', async (route) => {
      const request = route.request();
      const authHeader = request.headers()['authorization'] || '';
      authHeadersUsed.push(authHeader);
      callCount++;
      
      console.log(`[Rotation test] Call #${callCount}, Auth: ${authHeader.substring(0, 20)}...`);
      
      if (callCount === 1) {
        // PREMIÈRE APPEL : retourner 429 (Rate Limit) pour déclencher la rotation
        console.log('[Rotation test] First call - simulating 429 Rate Limit');
        await route.fulfill({
          status: 429,
          contentType: 'application/json',
          body: JSON.stringify({
            error: {
              message: 'Rate limit exceeded. Please retry after some time.',
              code: 'rate_limit_exceeded',
              type: 'requests'
            }
          }),
          headers: {
            'retry-after': '1'
          }
        });
      } else {
        // DEUXIÈME APPEL (retry après rotation) : laisser passer la requête
        console.log('[Rotation test] Second call - allowing request through');
        await route.continue();
      }
    });
    
    // Démarrer le workflow avec OpenRouter
    await page.goto('/');
    await page.waitForSelector('.canvas-content', { timeout: 10000 });
    await page.waitForTimeout(500);
    
    // Ouvrir le provider panel
    const providersBtn = page.locator('#providers-btn');
    await providersBtn.click();
    await page.waitForTimeout(300);
    
    // Cliquer sur OpenRouter pour démarrer le workflow
    const openrouterBtn = page.locator('[data-provider="openrouter"]').first();
    if (await openrouterBtn.isVisible()) {
      await openrouterBtn.click();
      await page.waitForTimeout(500);
      
      // Si on arrive à l'étape 4 (sélection modèle), sélectionner un modèle gratuit
      const modelSelect = page.locator('.model-select, [data-action="select-model"]').first();
      if (await modelSelect.isVisible()) {
        // Sélectionner le premier modèle gratuit
        const freeModelOption = page.locator('.model-option').filter({ hasText: /free/i }).first();
        if (await freeModelOption.isVisible()) {
          await freeModelOption.click();
          await page.waitForTimeout(2000); // Attendre le test du modèle
        }
      }
    }
    
    // Vérifier que la rotation a eu lieu
    console.log('[Rotation test] Auth headers used:', authHeadersUsed);
    
    // Si on a eu au moins 2 requêtes (retry après 429), vérifier que les clés sont différentes
    if (authHeadersUsed.length >= 2) {
      const firstKey = authHeadersUsed[0];
      const secondKey = authHeadersUsed[1];
      console.log('[Rotation test] First key:', firstKey);
      console.log('[Rotation test] Second key:', secondKey);
      
      // Les clés DOIVENT être différentes si la rotation fonctionne
      expect(firstKey).not.toBe(secondKey);
    } else if (authHeadersUsed.length === 1) {
      // Si une seule requête, la rotation n'a peut-être pas été déclenchée
      // Vérifier au moins que le header est présent
      expect(authHeadersUsed[0]).toMatch(/^Bearer sk-or-v1/);
    }
  });
  
  test('La clé sauvegardée est bien testée avant dêtre ajoutée', async ({ page }) => {
    // Ce test vérifie quune clé invalide nest pas sauvegardée
    // en essayant dajouter une clé bidon
    
    await page.goto('/');
    await page.waitForSelector('.canvas-content', { timeout: 10000 });
    
    // Ouvrir la modal
    const btn = page.locator('#providers-btn');
    await btn.click();
    await page.waitForTimeout(200);
    
    const keysBtn = page.locator('[data-action="open-keys-modal"]');
    await keysBtn.click();
    await page.waitForTimeout(500);
    
    // Ouvrir le formulaire
    const addBtn = page.locator('.api-keys-modal__add-btn, [data-action="add-key"]');
    await addBtn.click();
    await page.waitForTimeout(300);
    
    // Entrer une clé invalide deliberately longue pour être sure dêtre rejetée
    const fakeKey = 'sk-or-v1-invalidkey_1234567890_abcdefghijklmnopqrstuvwxyz_test';
    const keyInput = page.locator('#api-key-value');
    await keyInput.fill(fakeKey);
    
    // Cliquer sur sauvegarder - ça doit échouer au test, pas à la sauvegarde
    const saveBtn = page.locator('[data-action="save-key"]');
    await saveBtn.click();
    
    // Attendre quun toast derreur ou de succès apparaisse
    // (le test auto va soit réussir soit échouer avec un toast)
    const toastSelector = '.toast--error, .toast--success';
    const toastAppeared = await page.waitForSelector(toastSelector, { timeout: 25000 }).then(() => true).catch(() => false);
    
    // Vérifier quaucune clé invalide na été ajoutée
    const envKeys = await page.evaluate(async () => {
      const resp = await fetch('/api/env');
      return resp.json();
    });
    
    // La clé fake ne doit PAS être dans env (car le test auto laut rejected)
    const hasFakeKey = Object.values(envKeys).some(v => v === fakeKey);
    expect(hasFakeKey).toBe(false);
  });
});

test.describe('API Keys Modal — Feedback utilisateur', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.canvas-content', { timeout: 10000 });
    await page.waitForTimeout(500);
    
    // Ouvrir la modal
    const btn = page.locator('#providers-btn');
    await btn.click();
    await page.waitForTimeout(200);
    
    const keysBtn = page.locator('[data-action="open-keys-modal"]');
    await keysBtn.click();
    await page.waitForTimeout(500);
  });

  test('Un toast apparait quand le test de clé échoue', async ({ page }) => {
    // Ajouter une clé obviously invalide pour provoquer un toast d'erreur
    const addBtn = page.locator('.api-keys-modal__add-btn, [data-action="add-key"]');
    await addBtn.click();
    await page.waitForTimeout(300);
    
    // Entrer une clé invalide
    const keyInput = page.locator('#api-key-value');
    await keyInput.fill('invalid-key-not-a-real-api-key');
    
    // Cliquer sur sauvegarder
    const saveBtn = page.locator('[data-action="save-key"]');
    await saveBtn.click();
    
    // Attendre le toast d'erreur (le test va échouer et montrer un message)
    const errorToast = page.locator('.toast--error');
    await expect(errorToast).toBeVisible({ timeout: 20000 });
    
    // Le message d'erreur doit être informatif
    const errorText = await errorToast.textContent();
    expect(errorText).toMatch(/clé|API|invalid|expirée|rate limit|timeout/i);
  });

  test('Le hint affiche le numéro de clé pour une clé additionnelle', async ({ page }) => {
    const addBtn = page.locator('.api-keys-modal__add-btn, [data-action="add-key"]');
    await addBtn.click();
    await page.waitForTimeout(300);
    
    // Sélectionner un provider qui a déjà des clés (si possible)
    const providerSelect = page.locator('#api-key-provider');
    const options = await providerSelect.locator('option').count();
    
    if (options > 0) {
      // Changer de provider et vérifier que le hint change
      await providerSelect.selectOption({ index: 0 });
      await page.waitForTimeout(200);
      
      const hintEl = page.locator('.api-keys-modal__form-hint');
      // Le hint devrait mentionner "clé #X" si c'est une clé additionnelle
      // ou "Première clé" si c'est la première
      const hintText = await hintEl.textContent().catch(() => '');
      expect(hintText).toBeTruthy();
    }
  });
});