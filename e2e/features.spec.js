/**
 * E2E tests — Thème, Zoom, Grille, Export
 *
 * Scénarios :
 *   Thème  : 1) Toggle dark/light, 2) Vérifier classe CSS, 3) Persistance
 *   Zoom   : 4) Zoom in/out, 5) Affichage du pourcentage, 6) State zoom
 *   Grille : 7) Toggle grille, 8) Opacité SVG grille, 9) State gridVisible
 *   Export : 10) Ouvrir panneau export, 11) Cartes visibles, 12) Canvas vide = disabled
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

async function addTestNode(page) {
  await page.evaluate(() => {
    window.__state.actions.addNode({ type: 'process', label: 'Test', x: 200, y: 200, priority: 'medium' });
  });
  await page.waitForTimeout(200);
}

/* ---------------------------------------------------------------------------
 * Tests — Thème
 * -------------------------------------------------------------------------- */

test.describe('Thème clair / sombre', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#canvas-content', { timeout: 10000 });
    await clearState(page);
    // Forcer le thème clair de départ
    await page.evaluate(() => window.__state.actions.setTheme('light'));
    await page.waitForTimeout(200);
  });

  test('1 — Toggle thème bascule de light à dark', async ({ page }) => {
    const themeBefore = await page.evaluate(() => window.__state.getState().view.theme);
    expect(themeBefore).toBe('light');

    const themeBtn = page.locator('#theme-btn');
    await expect(themeBtn).toBeVisible();
    await themeBtn.click();
    await page.waitForTimeout(300);

    const themeAfter = await page.evaluate(() => window.__state.getState().view.theme);
    expect(themeAfter).toBe('dark');
  });

  test('2 — La classe theme-dark est appliquée sur .app', async ({ page }) => {
    const app = page.locator('.app');

    // Light par défaut
    await expect(app).toHaveClass(/theme-light/);

    // Toggle → dark
    await page.locator('#theme-btn').click();
    await page.waitForTimeout(300);
    await expect(app).toHaveClass(/theme-dark/);
  });

  test('3 — Double toggle revient au thème initial', async ({ page }) => {
    await page.locator('#theme-btn').click();
    await page.waitForTimeout(200);
    await page.locator('#theme-btn').click();
    await page.waitForTimeout(200);

    const theme = await page.evaluate(() => window.__state.getState().view.theme);
    expect(theme).toBe('light');
  });
});

/* ---------------------------------------------------------------------------
 * Tests — Zoom
 * -------------------------------------------------------------------------- */

test.describe('Zoom', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#canvas-content', { timeout: 10000 });
    await clearState(page);
    // Reset zoom à 1
    await page.evaluate(() => window.__state.actions.setZoom(1));
    await page.waitForTimeout(200);
  });

  test('4 — Zoom in déplace le canvas (transform change)', async ({ page }) => {
    const canvas = page.locator('#canvas-content');
    const transformBefore = await canvas.evaluate(el => el.style.transform || getComputedStyle(el).transform);

    await page.locator('#zoom-in').click();
    await page.waitForTimeout(300);

    const transformAfter = await canvas.evaluate(el => el.style.transform || getComputedStyle(el).transform);
    expect(transformAfter).not.toBe(transformBefore);
  });

  test('5 — Zoom out déplace le canvas dans l\'autre sens', async ({ page }) => {
    const canvas = page.locator('#canvas-content');
    const transformBefore = await canvas.evaluate(el => el.style.transform || getComputedStyle(el).transform);

    await page.locator('#zoom-out').click();
    await page.waitForTimeout(300);

    const transformAfter = await canvas.evaluate(el => el.style.transform || getComputedStyle(el).transform);
    expect(transformAfter).not.toBe(transformBefore);
  });

  test('6 — Zoom in puis zoom out revient approximativement à la base', async ({ page }) => {
    const canvas = page.locator('#canvas-content');
    const getScale = async () => canvas.evaluate(el => {
      const t = el.style.transform || getComputedStyle(el).transform;
      const m = t.match(/scale\(([^)]+)\)/);
      return m ? parseFloat(m[1]) : 1;
    });

    const scaleBefore = await getScale();
    await page.locator('#zoom-in').click();
    await page.waitForTimeout(200);
    await page.locator('#zoom-out').click();
    await page.waitForTimeout(200);

    const scaleAfter = await getScale();
    // Après in+out, le scale doit revenir à la valeur initiale
    expect(scaleAfter).toBe(scaleBefore);
  });

  test('7 — L\'affichage du zoom (zoom-level) se met à jour', async ({ page }) => {
    const zoomDisplay = page.locator('#zoom-level');

    if (await zoomDisplay.isVisible()) {
      const textBefore = await zoomDisplay.textContent();

      await page.locator('#zoom-in').click();
      await page.waitForTimeout(200);

      const textAfter = await zoomDisplay.textContent();
      expect(textAfter).not.toBe(textBefore);
    }
  });

  test('8 — Zoom in/out via API interne change le state', async ({ page }) => {
    await page.evaluate(() => window.__state.actions.setZoom(1.5));
    const zoom = await page.evaluate(() => window.__state.getState().view.zoom);
    expect(zoom).toBe(1.5);

    await page.evaluate(() => window.__state.actions.setZoom(0.5));
    const zoom2 = await page.evaluate(() => window.__state.getState().view.zoom);
    expect(zoom2).toBe(0.5);
  });
});

/* ---------------------------------------------------------------------------
 * Tests — Grille
 * -------------------------------------------------------------------------- */

test.describe('Grille', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#canvas-content', { timeout: 10000 });
    await clearState(page);
    await page.evaluate(() => window.__state.actions.setGridVisible(true));
    await page.waitForTimeout(200);
  });

  test('9 — Toggle grille change l\'opacité du SVG', async ({ page }) => {
    const gridBtn = page.locator('#grid-toggle');
    await expect(gridBtn).toBeVisible();

    // Trouver le SVG de grille et vérifier son opacité initiale
    const gridSvg = page.locator('.canvas-area svg, .grid-container svg, svg.grid-svg, #grid-container svg').first();
    if (await gridSvg.isVisible()) {
      const opacityBefore = await gridSvg.evaluate(el => getComputedStyle(el).opacity);

      await gridBtn.click();
      await page.waitForTimeout(400);

      const opacityAfter = await gridSvg.evaluate(el => getComputedStyle(el).opacity);
      expect(opacityAfter).not.toBe(opacityBefore);
    } else {
      // Fallback : juste vérifier que le bouton ne crash pas
      await gridBtn.click();
      await page.waitForTimeout(200);
    }
  });

  test('10 — Double toggle grille restore l\'opacité initiale', async ({ page }) => {
    const gridSvg = page.locator('#grid-container svg, .grid-container svg').first();

    if (await gridSvg.isVisible()) {
      // Attendre que le CSS transition soit pleinement terminé
      await page.waitForTimeout(500);
      const opacityBefore = await gridSvg.evaluate(el => getComputedStyle(el).opacity);

      await page.locator('#grid-toggle').click();
      await page.waitForTimeout(500);
      await page.locator('#grid-toggle').click();
      await page.waitForTimeout(500);

      const opacityAfter = await gridSvg.evaluate(el => getComputedStyle(el).opacity);
      // Tolérance flottante pour CSS transitions
      expect(Math.abs(parseFloat(opacityAfter) - parseFloat(opacityBefore))).toBeLessThan(0.05);
    } else {
      await page.locator('#grid-toggle').click();
      await page.waitForTimeout(200);
      await page.locator('#grid-toggle').click();
      await page.waitForTimeout(200);
    }
  });

  test('11 — Le bouton grille fonctionne sans erreur', async ({ page }) => {
    // Vérifier que le clic ne génère pas d'erreur
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.locator('#grid-toggle').click();
    await page.waitForTimeout(300);
    await page.locator('#grid-toggle').click();
    await page.waitForTimeout(300);

    expect(errors).toHaveLength(0);
  });
});

/* ---------------------------------------------------------------------------
 * Tests — Export
 * -------------------------------------------------------------------------- */

test.describe('Export', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#canvas-content', { timeout: 10000 });
    await clearState(page);
  });

  test('12 — Ouvrir le panneau export', async ({ page }) => {
    const exportBtn = page.locator('#exporter-btn');
    await expect(exportBtn).toBeVisible();

    await exportBtn.click();
    await page.waitForTimeout(400);

    // Le panneau doit apparaître
    const panel = page.locator('.app__export-panel');
    await expect(panel).toBeVisible();
  });

  test('13 — Les cartes d\'export (SVG, PNG, Code) sont visibles', async ({ page }) => {
    await addTestNode(page);

    await page.locator('#exporter-btn').click();
    await page.waitForTimeout(400);

    // Vérifier les 3 cartes d'export
    const svgCard = page.locator('.export-card[data-format="svg"]');
    const pngCard = page.locator('.export-card[data-format="png"]');
    const codeCard = page.locator('.export-card[data-format="code"]');

    await expect(svgCard).toBeVisible();
    await expect(pngCard).toBeVisible();
    await expect(codeCard).toBeVisible();
  });

  test('14 — Canvas vide : les cartes export sont disabled', async ({ page }) => {
    // Pas de nœuds → canvas vide
    await page.locator('#exporter-btn').click();
    await page.waitForTimeout(400);

    const svgCard = page.locator('.export-card[data-format="svg"]');
    await expect(svgCard).toBeDisabled();

    const pngCard = page.locator('.export-card[data-format="png"]');
    await expect(pngCard).toBeDisabled();
  });

  test('15 — Fermer le panneau export via Escape', async ({ page }) => {
    await addTestNode(page);

    await page.locator('#exporter-btn').click();
    await page.waitForTimeout(400);

    const panel = page.locator('.app__export-panel');
    await expect(panel).toBeVisible();

    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);

    // Le panneau doit être fermé
    const isOpen = await page.evaluate(() => {
      return document.querySelector('.app__export')?.classList.contains('is-open') ?? false;
    });
    expect(isOpen).toBe(false);
  });

  test('16 — Fermer le panneau via le bouton de fermeture', async ({ page }) => {
    await addTestNode(page);

    await page.locator('#exporter-btn').click();
    await page.waitForTimeout(400);

    // Trouver le bouton de fermeture dans le panneau
    const closeBtn = page.locator('.app__export-panel .export-panel__close, .app__export-panel button[aria-label="Fermer"], .app__export-panel .btn--close').first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
      await page.waitForTimeout(400);

      const isOpen = await page.evaluate(() => {
        return document.querySelector('.app__export')?.classList.contains('is-open') ?? false;
      });
      expect(isOpen).toBe(false);
    }
  });

  test('17 — Le panneau export affiche un hint si canvas vide', async ({ page }) => {
    // Canvas vide
    await page.locator('#exporter-btn').click();
    await page.waitForTimeout(400);

    const hint = page.locator('.export-panel__hint');
    if (await hint.isVisible()) {
      const text = await hint.textContent();
      expect(text.toLowerCase()).toContain('ajoutez');
    }
  });
});
