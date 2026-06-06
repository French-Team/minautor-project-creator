/**
 * Tests E2E — Providers IA
 *
 * Vérifie le bouton "Providers" dans le header, le panneau slide-in,
 * la sélection de provider, la configuration, et la persistance.
 */

import { test, expect } from '@playwright/test';

test.describe('Providers IA', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.canvas-content', { timeout: 10000 });
    await page.waitForTimeout(500);
  });

  test('Le bouton "Providers" est visible dans le header', async ({ page }) => {
    const btn = page.locator('#providers-btn');
    await expect(btn).toBeVisible();
  });

  test('Le clic ouvre le panneau providers', async ({ page }) => {
    const btn = page.locator('#providers-btn');
    await btn.click();
    const panel = page.locator('#app-providers');
    await expect(panel).toHaveClass(/is-open/);
  });

  test('Les 8 providers preset sont affichés', async ({ page }) => {
    const btn = page.locator('#providers-btn');
    await btn.click();
    const items = page.locator('.provider-panel__item');
    await expect(items).toHaveCount(8);
  });

  test('Sélectionner Ollama affiche la config locale (pas de champ API Key)', async ({ page }) => {
    const btn = page.locator('#providers-btn');
    await btn.click();
    // Cliquer sur Ollama
    const ollamaItem = page.locator('.provider-panel__item', { hasText: 'Ollama' });
    await ollamaItem.click();
    await page.waitForTimeout(200);
    // Le champ API Key ne devrait pas exister pour les providers locaux
    const apiKeyField = page.locator('#provider-api-key');
    await expect(apiKeyField).not.toBeVisible();
  });

  test('Sélectionner OpenRouter affiche le champ API Key', async ({ page }) => {
    const btn = page.locator('#providers-btn');
    await btn.click();
    const orItem = page.locator('.provider-panel__item', { hasText: 'OpenRouter' });
    await orItem.click();
    await page.waitForTimeout(200);
    const apiKeyField = page.locator('#provider-api-key');
    await expect(apiKeyField).toBeVisible();
  });

  test('La clé API est masquée dans l\'UI (type password)', async ({ page }) => {
    const btn = page.locator('#providers-btn');
    await btn.click();
    const orItem = page.locator('.provider-panel__item', { hasText: 'OpenRouter' });
    await orItem.click();
    await page.waitForTimeout(200);
    const apiKeyField = page.locator('#provider-api-key');
    await expect(apiKeyField).toHaveAttribute('type', 'password');
  });

  test('Changer le modèle met à jour le state', async ({ page }) => {
    const btn = page.locator('#providers-btn');
    await btn.click();
    // Sélectionner Groq
    const groqItem = page.locator('.provider-panel__item', { hasText: 'Groq' });
    await groqItem.click();
    await page.waitForTimeout(200);
    // Changer le modèle
    const modelSelect = page.locator('#provider-model');
    await modelSelect.selectOption('llama-3.1-8b-instant');
    await page.waitForTimeout(200);
    // Vérifier le state
    const model = await page.evaluate(() => window.__state.getState().assistant.provider.model);
    expect(model).toBe('llama-3.1-8b-instant');
  });

  test('Fermer le panneau via le bouton X', async ({ page }) => {
    const btn = page.locator('#providers-btn');
    await btn.click();
    const panel = page.locator('#app-providers');
    await expect(panel).toHaveClass(/is-open/);
    const closeBtn = page.locator('#app-providers-close');
    await closeBtn.click();
    await page.waitForTimeout(300);
    await expect(panel).not.toHaveClass(/is-open/);
  });

  test('Fermer le panneau via Escape', async ({ page }) => {
    const btn = page.locator('#providers-btn');
    await btn.click();
    const panel = page.locator('#app-providers');
    await expect(panel).toHaveClass(/is-open/);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await expect(panel).not.toHaveClass(/is-open/);
  });

  test('La persistance localStorage fonctionne', async ({ page }) => {
    const btn = page.locator('#providers-btn');
    await btn.click();
    // Sélectionner Groq
    const groqItem = page.locator('.provider-panel__item', { hasText: 'Groq' });
    await groqItem.click();
    await page.waitForTimeout(200);
    // Vérifier localStorage
    const stored = await page.evaluate(() => {
      const raw = localStorage.getItem('code-city-assistant');
      return raw ? JSON.parse(raw) : null;
    });
    expect(stored).not.toBeNull();
    expect(stored.provider.id).toBe('groq');
  });
});
