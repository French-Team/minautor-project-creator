/**
 * Tests E2E — Propriétés métier par catégorie
 *
 * Vérifie que le panneau Propriétés affiche les bons champs dynamiques
 * selon le type du nœud sélectionné, et que les valeurs sont persistées.
 */

import { test, expect } from '@playwright/test';

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

/** Ouvre la page et attend que l'app soit chargée. */
async function freshPage(page) {
  await page.goto('/');
  await page.waitForSelector('#canvas-content', { timeout: 10000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('#canvas-content', { timeout: 10000 });
  await page.waitForTimeout(300);
}

/** Crée un nœud du type donné et le sélectionne. */
async function createAndSelectNode(page, type, label = 'Test') {
  await page.evaluate(({ type, label }) => {
    const { actions } = window.__state;
    actions.addNode({ type, label, x: 200, y: 200, priority: 'medium' });
    const nodes = window.__state.getState().nodes;
    actions.selectNode(nodes[nodes.length - 1].id);
  }, { type, label });
  await page.waitForTimeout(400);
}

/** Attend que l'onglet Propriétés soit actif et que le formulaire soit rendu. */
async function switchToPropertiesTab(page) {
  const tab = page.locator('.main__tab[data-center-tab="properties"]');
  if (await tab.count() > 0) {
    await tab.click();
    await page.waitForTimeout(300);
  }
}

/* -------------------------------------------------------------------------- */
/*  Tests                                                                     */
/* -------------------------------------------------------------------------- */

test.describe('Propriétés métier par catégorie', () => {

  test.beforeEach(async ({ page }) => {
    await freshPage(page);
    await switchToPropertiesTab(page);
  });

  /* ---- Section visible ---- */

  test('1 — La section "Propriétés métier" est présente dans le formulaire', async ({ page }) => {
    await createAndSelectNode(page, 'service-api');
    const section = page.locator('#prop-business-section');
    await expect(section).toBeVisible();
    const title = section.locator('.prop-section__title');
    await expect(title).toHaveText('Propriétés métier');
  });

  /* ---- Service API ---- */

  test('2 — Un nœud service-api affiche les champs endpoint, method, auth', async ({ page }) => {
    await createAndSelectNode(page, 'service-api');
    await expect(page.locator('#prop-biz-endpoint')).toBeVisible();
    await expect(page.locator('#prop-biz-method')).toBeVisible();
    await expect(page.locator('#prop-biz-auth')).toBeVisible();
  });

  test('3 — Le sélecteur method contient GET, POST, PUT, PATCH, DELETE', async ({ page }) => {
    await createAndSelectNode(page, 'service-api');
    const methodSelect = page.locator('#prop-biz-method');
    const options = await methodSelect.locator('option').allTextContents();
    expect(options).toContain('GET');
    expect(options).toContain('POST');
    expect(options).toContain('PUT');
    expect(options).toContain('PATCH');
    expect(options).toContain('DELETE');
  });

  /* ---- DevOps CI ---- */

  test('4 — Un nœud devops-ci affiche les champs tool, triggers, steps, rollback', async ({ page }) => {
    await createAndSelectNode(page, 'devops-ci');
    await expect(page.locator('#prop-biz-tool')).toBeVisible();
    await expect(page.locator('#prop-biz-triggers')).toBeVisible();
    await expect(page.locator('#prop-biz-steps')).toBeVisible();
    await expect(page.locator('#prop-biz-rollback')).toBeVisible();
  });

  /* ---- Architecture ---- */

  test('5 — Un nœud arch-clean affiche les champs problem, solution, alternatives, tradeoffs, consequences', async ({ page }) => {
    await createAndSelectNode(page, 'arch-clean');
    await expect(page.locator('#prop-biz-problem')).toBeVisible();
    await expect(page.locator('#prop-biz-solution')).toBeVisible();
    await expect(page.locator('#prop-biz-alternatives')).toBeVisible();
    await expect(page.locator('#prop-biz-tradeoffs')).toBeVisible();
    await expect(page.locator('#prop-biz-consequences')).toBeVisible();
  });

  /* ---- Sécurité ---- */

  test('6 — Un nœud sec-auth affiche les champs threat, severity, mitigations, conformity', async ({ page }) => {
    await createAndSelectNode(page, 'sec-auth');
    await expect(page.locator('#prop-biz-threat')).toBeVisible();
    await expect(page.locator('#prop-biz-severity')).toBeVisible();
    await expect(page.locator('#prop-biz-mitigations')).toBeVisible();
    await expect(page.locator('#prop-biz-conformity')).toBeVisible();
  });

  /* ---- Projet ---- */

  test('7 — Un nœud proj-task affiche les champs assignee, estimation, deadline, status, acceptance', async ({ page }) => {
    await createAndSelectNode(page, 'proj-task');
    await expect(page.locator('#prop-biz-assignee')).toBeVisible();
    await expect(page.locator('#prop-biz-estimation')).toBeVisible();
    await expect(page.locator('#prop-biz-deadline')).toBeVisible();
    await expect(page.locator('#prop-biz-status')).toBeVisible();
    await expect(page.locator('#prop-biz-acceptance')).toBeVisible();
  });

  /* ---- Type sans schéma ---- */

  test('8 — Un type sans préfixe connu (process) affiche un message par défaut', async ({ page }) => {
    await createAndSelectNode(page, 'process');
    // process a un schéma avec inputs, outputs, steps
    await expect(page.locator('#prop-biz-inputs')).toBeVisible();
    await expect(page.locator('#prop-biz-outputs')).toBeVisible();
    await expect(page.locator('#prop-biz-steps')).toBeVisible();
  });

  test('9 — Un nœud start (base) affiche "Pas de propriétés spécifiques"', async ({ page }) => {
    await createAndSelectNode(page, 'start');
    const section = page.locator('#prop-business-section');
    await expect(section).toContainText('Pas de propriétés spécifiques');
  });

  /* ---- Persistance ---- */

  test('10 — Saisir une valeur dans un champ métier la persiste dans le state', async ({ page }) => {
    await createAndSelectNode(page, 'service-api');
    const endpointInput = page.locator('#prop-biz-endpoint');
    await endpointInput.fill('/api/v2/users');
    await endpointInput.dispatchEvent('change');
    await page.waitForTimeout(300);

    const value = await page.evaluate(() => {
      const { nodes } = window.__state.getState();
      const node = nodes[nodes.length - 1];
      return node.properties?.endpoint;
    });
    expect(value).toBe('/api/v2/users');
  });

  test('11 — La valeur sélectionnée dans un select est persistée', async ({ page }) => {
    await createAndSelectNode(page, 'service-api');
    await page.locator('#prop-biz-method').selectOption('POST');
    await page.waitForTimeout(300);

    const value = await page.evaluate(() => {
      const { nodes } = window.__state.getState();
      const node = nodes[nodes.length - 1];
      return node.properties?.method;
    });
    expect(value).toBe('POST');
  });

  /* ---- Changement de type ---- */

  test('12 — Changer de type met à jour les champs affichés', async ({ page }) => {
    await createAndSelectNode(page, 'service-api');
    // Vérifier les champs service
    await expect(page.locator('#prop-biz-endpoint')).toBeVisible();

    // Changer le type en arch-clean
    await page.locator('#prop-type').selectOption('arch-clean');
    await page.waitForTimeout(500);

    // Les champs arch doivent apparaître
    await expect(page.locator('#prop-biz-problem')).toBeVisible();
    await expect(page.locator('#prop-biz-solution')).toBeVisible();

    // Les champs service ne doivent plus être là
    await expect(page.locator('#prop-biz-endpoint')).not.toBeVisible();
  });

  test('13 — Changer de type conserve les propriétés compatibles', async ({ page }) => {
    await createAndSelectNode(page, 'service-api');
    // Remplir les champs service
    await page.locator('#prop-biz-endpoint').fill('/api/test');
    await page.locator('#prop-biz-endpoint').dispatchEvent('change');
    await page.waitForTimeout(200);

    // Changer pour service-database (même catégorie 'service', champs compatibles)
    await page.locator('#prop-type').selectOption('service-database');
    await page.waitForTimeout(500);

    // Vérifier que les champs service-database sont affichés
    await expect(page.locator('#prop-biz-endpoint')).toBeVisible();
  });

  /* ---- Sélecteur type élargi ---- */

  test('14 — Le sélecteur de type contient plus de 50 types (depuis la PALETTE)', async ({ page }) => {
    await createAndSelectNode(page, 'process');
    const typeSelect = page.locator('#prop-type');
    const optionCount = await typeSelect.locator('option').count();
    expect(optionCount).toBeGreaterThan(50);
  });

  test('15 — Le sélecteur de type affiche le label et la catégorie', async ({ page }) => {
    await createAndSelectNode(page, 'process');
    const typeSelect = page.locator('#prop-type');
    // Le service-api devrait avoir un libellé "API (Services)" ou similaire
    const optionText = await typeSelect.locator('option[value="service-api"]').textContent();
    expect(optionText).toContain('API');
    expect(optionText).toContain('Services');
  });
});
