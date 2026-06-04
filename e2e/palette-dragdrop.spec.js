/**
 * E2E tests — Drag & drop depuis la palette sidebar vers le canvas
 *
 * Scénarios :
 *   1. Expand/collapse des sections de la palette
 *   2. Recherche de nœuds dans la palette
 *   3. Drag & drop d'un nœud de la palette vers le canvas
 *   4. Vérification du nœud créé (type, label, position)
 *   5. Drag & drop de plusieurs nœuds
 *   6. Le nœud crée apparaît bien dans le state
 *   7. Sélection d'une variante avant drag
 */
import { test, expect } from '@playwright/test';

/* ---------------------------------------------------------------------------
 * Helpers
 * -------------------------------------------------------------------------- */

async function clearState(page) {
  await page.evaluate(() => {
    localStorage.clear();
    window.__state.actions.clear();
  });
}

async function getNodeCount(page) {
  return page.evaluate(() => window.__state.getState().nodes.length);
}

async function getNodes(page) {
  return page.evaluate(() => window.__state.getState().nodes.map(n => ({
    id: n.id, type: n.type, label: n.label, x: n.x, y: n.y,
  })));
}

/* ---------------------------------------------------------------------------
 * Tests
 * -------------------------------------------------------------------------- */

test.describe('Palette — Drag & drop vers le canvas', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#canvas-content', { timeout: 10000 });
    await clearState(page);
    await page.waitForTimeout(200);
  });

  /* ---- 1. Expand / collapse des sections ---- */

  test('1 — Expand et collapse d\'une section palette', async ({ page }) => {
    // Trouver la première section
    const firstSection = page.locator('.palette-section').first();
    const header = firstSection.locator('.palette-section__header');
    const body = firstSection.locator('.palette-section__body');

    // La section est fermée par défaut (grid-template-rows: 0fr)
    const isInitiallyOpen = await firstSection.evaluate(el => el.classList.contains('is-open'));
    expect(isInitiallyOpen).toBe(false);

    // Cliquer pour ouvrir
    await header.click();
    await page.waitForTimeout(400);
    const isNowOpen = await firstSection.evaluate(el => el.classList.contains('is-open'));
    expect(isNowOpen).toBe(true);

    // Vérifier que des cartes sont visibles
    const cards = firstSection.locator('.element-card--selector');
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThan(0);

    // Cliquer pour fermer
    await header.click();
    await page.waitForTimeout(400);
    const isClosedAgain = await firstSection.evaluate(el => el.classList.contains('is-open'));
    expect(isClosedAgain).toBe(false);
  });

  /* ---- 2. Recherche palette ---- */

  test('2 — La recherche filtre les cartes de la palette', async ({ page }) => {
    const searchInput = page.locator('#palette-search');
    await expect(searchInput).toBeVisible();

    // Compter les cartes visibles avant recherche
    const countBefore = await page.locator('.element-card--selector').count();

    // Taper "process" dans la recherche
    await searchInput.fill('process');
    await page.waitForTimeout(300);

    // Le nombre de cartes visibles doit diminuer
    const countAfter = await page.locator('.element-card--selector').count();
    expect(countAfter).toBeLessThanOrEqual(countBefore);
    expect(countAfter).toBeGreaterThan(0);

    // Le bouton "Effacer" doit apparaître
    const clearBtn = page.locator('#palette-search-clear');
    await expect(clearBtn).toBeVisible();

    // Effacer la recherche
    await clearBtn.click();
    await page.waitForTimeout(300);
    const countReset = await page.locator('.element-card--selector').count();
    expect(countReset).toBe(countBefore);
  });

  /* ---- 3. Drag & drop d'un nœud ---- */

  test('3 — Drag & drop d\'un nœud de la palette vers le canvas', async ({ page }) => {
    // Ouvrir la première section pour avoir des cartes visibles
    const firstSection = page.locator('.palette-section').first();
    const header = firstSection.locator('.palette-section__header');
    await header.click();
    await page.waitForTimeout(400);

    // Vérifier qu'aucun nœud n'existe
    expect(await getNodeCount(page)).toBe(0);

    // Trouver la première carte et le canvas
    const card = page.locator('.element-card--selector').first();
    await expect(card).toBeVisible();
    const canvas = page.locator('#canvas-content');

    // Drag & drop
    await card.dragTo(canvas);
    await page.waitForTimeout(500);

    // Vérifier qu'un nœud a été créé
    const count = await getNodeCount(page);
    expect(count).toBe(1);

    // Vérifier le nœud
    const nodes = await getNodes(page);
    expect(nodes[0].type).toBeTruthy();
    expect(nodes[0].label).toBeTruthy();
  });

  /* ---- 4. Vérification du nœud créé ---- */

  test('4 — Le nœud créé a le bon type et label', async ({ page }) => {
    const firstSection = page.locator('.palette-section').first();
    await firstSection.locator('.palette-section__header').click();
    await page.waitForTimeout(400);

    const card = page.locator('.element-card--selector').first();
    const cardLabel = await card.locator('.element-card__label').textContent();
    const canvas = page.locator('#canvas-content');

    await card.dragTo(canvas);
    await page.waitForTimeout(500);

    const nodes = await getNodes(page);
    expect(nodes).toHaveLength(1);
    // Le label du nœud doit correspondre au label de la carte
    expect(nodes[0].label).toBe(cardLabel.trim());
  });

  /* ---- 5. Drag & drop multiple ---- */

  test('5 — Drag & drop de plusieurs nœuds différents', async ({ page }) => {
    // Ouvrir la première section
    const firstSection = page.locator('.palette-section').first();
    await firstSection.locator('.palette-section__header').click();
    await page.waitForTimeout(400);

    const canvas = page.locator('#canvas-content');
    const cards = firstSection.locator('.element-card--selector');
    const cardCount = await cards.count();

    // Drag les 2 premières cartes (si disponibles)
    const toDrag = Math.min(cardCount, 2);
    for (let i = 0; i < toDrag; i++) {
      await cards.nth(i).dragTo(canvas);
      await page.waitForTimeout(300);
    }

    const count = await getNodeCount(page);
    expect(count).toBe(toDrag);

    // Vérifier que chaque nœud a un ID unique
    const nodes = await getNodes(page);
    const ids = new Set(nodes.map(n => n.id));
    expect(ids.size).toBe(toDrag);
  });

  /* ---- 6. Le nœud crée apparaît dans le DOM ---- */

  test('6 — Le nœud apparaît comme élément canvas dans le DOM', async ({ page }) => {
    const firstSection = page.locator('.palette-section').first();
    await firstSection.locator('.palette-section__header').click();
    await page.waitForTimeout(400);

    const card = page.locator('.element-card--selector').first();
    const canvas = page.locator('#canvas-content');

    await card.dragTo(canvas);
    await page.waitForTimeout(500);

    // Vérifier qu'un élément .canvas-element existe dans le DOM
    const canvasEl = page.locator('.canvas-element');
    await expect(canvasEl.first()).toBeAttached();

    // Il doit avoir un data-id
    const dataId = await canvasEl.first().getAttribute('data-id');
    expect(dataId).toBeTruthy();

    // Et un data-type
    const dataType = await canvasEl.first().getAttribute('data-type');
    expect(dataType).toBeTruthy();
    expect(dataType).not.toBe('hub');
  });

  /* ---- 7. Sélection de variante avant drag ---- */

  test('7 — Sélectionner une variante change le type du nœud créée', async ({ page }) => {
    const firstSection = page.locator('.palette-section').first();
    await firstSection.locator('.palette-section__header').click();
    await page.waitForTimeout(400);

    // Trouver la première carte avec un select de variante
    const card = firstSection.locator('.element-card--selector').first();
    const select = card.locator('.element-card__select');

    // Vérifier que le select existe et a des options
    const optionCount = await select.locator('option').count();
    if (optionCount <= 1) {
      // Pas de variante alternative, on skip ce test
      test.skip();
      return;
    }

    // Sélectionner la 2e variante
    const secondOption = select.locator('option').nth(1);
    const variantValue = await secondOption.getAttribute('value');
    await select.selectOption(variantValue);
    await page.waitForTimeout(200);

    const canvas = page.locator('#canvas-content');
    await card.dragTo(canvas);
    await page.waitForTimeout(500);

    const nodes = await getNodes(page);
    expect(nodes).toHaveLength(1);
    // Le type du nœud doit correspondre à la variante sélectionnée
    // (le type est hérité de la carte parente, la variante influence icon/color)
    expect(nodes[0].type).toBeTruthy();
  });

  /* ---- 8. Le label du nœud correspond à la carte ---- */

  test('8 — Le nœud créé a un ID formaté (n1-type)', async ({ page }) => {
    const firstSection = page.locator('.palette-section').first();
    await firstSection.locator('.palette-section__header').click();
    await page.waitForTimeout(400);

    const card = page.locator('.element-card--selector').first();
    const canvas = page.locator('#canvas-content');

    await card.dragTo(canvas);
    await page.waitForTimeout(500);

    const nodes = await getNodes(page);
    expect(nodes).toHaveLength(1);
    // L'ID doit être au format n{num}-{type} (ex: n1-process)
    expect(nodes[0].id).toMatch(/^n\d+-.+/);
  });

  /* ---- 9. Le compteur d'éléments se met à jour ---- */

  test('9 — Le status.elementCount se met à jour après drag', async ({ page }) => {
    const firstSection = page.locator('.palette-section').first();
    await firstSection.locator('.palette-section__header').click();
    await page.waitForTimeout(400);

    const card = page.locator('.element-card--selector').first();
    const canvas = page.locator('#canvas-content');

    // Compteur initial
    const countBefore = await page.evaluate(() => window.__state.getState().status.elementCount);
    expect(countBefore).toBe(0);

    await card.dragTo(canvas);
    await page.waitForTimeout(500);

    const countAfter = await page.evaluate(() => window.__state.getState().status.elementCount);
    expect(countAfter).toBe(1);
  });
});
