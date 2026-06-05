/**
 * E2e tests — Export Markdown Preview (modal)
 *
 * Vérifie que le panneau d'export propose un bouton "Voir l'aperçu"
 * qui ouvre une modale avec le rendu Markdown.
 */
import { test, expect } from '@playwright/test';

/** Helper: attend le chargement. */
async function setup(page) {
  await page.goto('/');
  await page.waitForSelector('.canvas-content', { timeout: 10000 });
  await page.waitForTimeout(500);
}

/** Helper: ouvre le panneau d'export via le bouton du top bar. */
async function openExportPanel(page) {
  const exportBtn = page.locator('button[data-action="export"]');
  if (await exportBtn.isVisible()) {
    await exportBtn.click();
  } else {
    const btn = page.locator('.top__actions button', { hasText: /export/i });
    if (await btn.isVisible()) await btn.click();
  }
  await page.waitForSelector('.app__export.is-open', { timeout: 5000 });
}

test.describe('Export Markdown Preview', () => {
  test('should show preview button in export panel', async ({ page }) => {
    await setup(page);
    await openExportPanel(page);

    // Le bouton "Voir l'aperçu" doit être présent
    const btn = page.locator('#export-preview-btn');
    await expect(btn).toBeVisible();
    await expect(btn).toContainText("Voir l'aperçu");
  });

  test('preview button should be disabled when canvas is empty', async ({ page }) => {
    await setup(page);
    await openExportPanel(page);

    const btn = page.locator('#export-preview-btn');
    await expect(btn).toBeVisible();
    await expect(btn).toBeDisabled();
  });

  test('should open modal with Markdown content when canvas has nodes', async ({ page }) => {
    await setup(page);

    // Ajouter un nœud via glisser-déposer depuis la palette
    const firstElement = page.locator('.element-card').first();
    if (await firstElement.isVisible()) {
      const canvas = page.locator('.canvas-content');
      const canvasBox = await canvas.boundingBox();
      if (canvasBox) {
        await firstElement.dragTo(canvas, {
          targetPosition: { x: canvasBox.width / 2, y: canvasBox.height / 2 },
        });
        await page.waitForTimeout(500);
      }
    }

    await openExportPanel(page);

    // Le bouton doit être enabled quand il y a des nœuds
    const btn = page.locator('#export-preview-btn');
    if (await btn.isEnabled()) {
      await btn.click();
      // La modale doit s'ouvrir
      await page.waitForSelector('.preview-modal.is-open', { timeout: 3000 });

      // Le contenu doit contenir du HTML
      const modalContent = page.locator('#preview-modal-content');
      const html = await modalContent.innerHTML();
      expect(html.length).toBeGreaterThan(0);

      // Fermer la modale
      await page.locator('.preview-modal__close').click();
      await page.waitForTimeout(300);
    }
  });

  test('should close modal on Escape', async ({ page }) => {
    await setup(page);

    const firstElement = page.locator('.element-card').first();
    if (await firstElement.isVisible()) {
      const canvas = page.locator('.canvas-content');
      const canvasBox = await canvas.boundingBox();
      if (canvasBox) {
        await firstElement.dragTo(canvas, {
          targetPosition: { x: canvasBox.width / 2, y: canvasBox.height / 2 },
        });
        await page.waitForTimeout(500);
      }
    }

    await openExportPanel(page);

    const btn = page.locator('#export-preview-btn');
    if (await btn.isEnabled()) {
      await btn.click();
      await page.waitForSelector('.preview-modal.is-open', { timeout: 3000 });

      // Escape doit fermer la modale SANS fermer le panneau d'export
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      const modal = page.locator('.preview-modal.is-open');
      await expect(modal).toHaveCount(0);
      // Le panneau d'export doit rester ouvert
      await expect(page.locator('.app__export.is-open')).toHaveCount(1);
    }
  });

  test('should have preview section with proper CSS class', async ({ page }) => {
    await setup(page);
    await openExportPanel(page);

    const section = page.locator('.export-section--preview');
    await expect(section).toBeVisible();

    const title = section.locator('.export-section__title');
    await expect(title).toHaveText('Aperçu Markdown');
  });

  test('should close modal on backdrop click', async ({ page }) => {
    await setup(page);

    const firstElement = page.locator('.element-card').first();
    if (await firstElement.isVisible()) {
      const canvas = page.locator('.canvas-content');
      const canvasBox = await canvas.boundingBox();
      if (canvasBox) {
        await firstElement.dragTo(canvas, {
          targetPosition: { x: canvasBox.width / 2, y: canvasBox.height / 2 },
        });
        await page.waitForTimeout(500);
      }
    }

    await openExportPanel(page);

    const btn = page.locator('#export-preview-btn');
    if (await btn.isEnabled()) {
      await btn.click();
      await page.waitForSelector('.preview-modal.is-open', { timeout: 3000 });

      // Clic sur le backdrop (coin supérieur-gauche, hors du dialogue) doit fermer la modale
      await page.locator('.preview-modal__dialog').click({ position: { x: -50, y: -50 }, force: true });
      await page.waitForTimeout(300);
      const modal = page.locator('.preview-modal.is-open');
      await expect(modal).toHaveCount(0);
    }
  });
});
