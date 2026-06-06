/**
 * Tests E2E — FIM (Fill-in-the-Middle) inline completion
 *
 * Tests de la completion de code FIM :
 *
 *   1) Le bouton flottant FIM n apparait pas sans selection
 *   2) Ctrl+Shift+C ne fait rien sans selection dans le textarea
 *   3) Le bouton flottant apparait avec selection + provider Mistral
 *   4) Le bouton flottant n apparait pas avec un provider non-Mistral
 *   5) L onglet Code affiche le textarea #code-preview
 *   6) L action rapide "Completer code" est presente dans le chat
 *   7) Le bouton flottant masque son status apres un delai
 */

import { test, expect } from '@playwright/test';

/* ---------------------------------------------------------------------------
 * Helpers
 * -------------------------------------------------------------------------- */

async function clearState(page) {
  await page.evaluate(() => {
    localStorage.clear();
    window.__state.actions.clear();
    window.__state.actions.clearChatHistory();
  });
}

async function setProvider(page, providerId) {
  await page.evaluate((id) => {
    window.__state.actions.setProvider(id);
  }, providerId);
  await page.waitForTimeout(200);
}

async function setMistralProvider(page) {
  await page.evaluate(() => {
    window.__state.actions.setProvider('mistral');
    window.__state.actions.updateProvider({ apiKey: 'test-fake-key' });
  });
  await page.waitForTimeout(200);
}

async function switchToCodeTab(page) {
  await page.locator('.main__tab[data-center-tab="code"]').click();
  await page.waitForTimeout(300);
}

async function isChatPanelOpen(page) {
  return page.evaluate(() => {
    return document.getElementById('app-chat')?.classList.contains('is-open') ?? false;
  });
}

/* ---------------------------------------------------------------------------
 * Tests — FIM Floating Button visibility
 * -------------------------------------------------------------------------- */

test.describe('FIM - Bouton flottant', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.canvas-content', { timeout: 10000 });
    await clearState(page);
  });

  test('1 - Le textarea #code-preview existe dans l onglet Code', async ({ page }) => {
    await switchToCodeTab(page);

    const ta = page.locator('#code-preview');
    await expect(ta).toBeAttached();
  });

  test('2 - Le bouton flottant n apparait pas sans selection', async ({ page }) => {
    await setMistralProvider(page);
    await switchToCodeTab(page);

    // S assurer qu il n y a pas de selection
    await page.evaluate(() => {
      const ta = document.getElementById('code-preview');
      if (ta) {
        ta.value = 'graph TD;\n    A-->B;';
        ta.selectionStart = 0;
        ta.selectionEnd = 0;
        ta.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    await page.waitForTimeout(300);

    const btn = page.locator('.fim-floating-btn');
    await expect(btn).toBeHidden();
  });

  test('3 - Le bouton flottant apparait avec selection et provider Mistral', async ({ page }) => {
    await setMistralProvider(page);
    await switchToCodeTab(page);

    // Mettre du texte et selectionner une partie
    await page.evaluate(() => {
      const ta = document.getElementById('code-preview');
      if (ta) {
        ta.value = 'graph TD;\n    A-->B;\n    B-->C;';
        ta.selectionStart = 11;
        ta.selectionEnd = 12; // selectionne "A"
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        ta.dispatchEvent(new Event('select', { bubbles: true }));
        ta.focus();
      }
    });
    await page.waitForTimeout(500);

    const btn = page.locator('.fim-floating-btn');
    await expect(btn).toBeVisible();
  });

  test('4 - Le bouton flottant n apparait pas avec un provider non-Mistral', async ({ page }) => {
    await setProvider(page, 'ollama');
    await switchToCodeTab(page);

    // Mettre du texte et selectionner
    await page.evaluate(() => {
      const ta = document.getElementById('code-preview');
      if (ta) {
        ta.value = 'graph TD;\n    A-->B;';
        ta.selectionStart = 0;
        ta.selectionEnd = 5;
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        ta.dispatchEvent(new Event('select', { bubbles: true }));
        ta.focus();
      }
    });
    await page.waitForTimeout(500);

    const btn = page.locator('.fim-floating-btn');
    await expect(btn).toBeHidden();
  });

  test('5 - Le bouton flottant disparait quand la selection est effacee', async ({ page }) => {
    await setMistralProvider(page);
    await switchToCodeTab(page);

    // Selectionner du texte
    await page.evaluate(() => {
      const ta = document.getElementById('code-preview');
      if (ta) {
        ta.value = 'graph TD;\n    A-->B;';
        ta.selectionStart = 0;
        ta.selectionEnd = 5;
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        ta.dispatchEvent(new Event('select', { bubbles: true }));
        ta.focus();
      }
    });
    await page.waitForTimeout(500);

    const btn = page.locator('.fim-floating-btn');
    await expect(btn).toBeVisible();

    // Effacer la selection
    await page.evaluate(() => {
      const ta = document.getElementById('code-preview');
      if (ta) {
        ta.selectionStart = 0;
        ta.selectionEnd = 0;
        ta.dispatchEvent(new Event('select', { bubbles: true }));
      }
    });
    await page.waitForTimeout(300);

    await expect(btn).toBeHidden();
  });

  test('6 - Le bouton flottant a le bon titre et contenu', async ({ page }) => {
    await setMistralProvider(page);
    await switchToCodeTab(page);

    await page.evaluate(() => {
      const ta = document.getElementById('code-preview');
      if (ta) {
        ta.value = 'graph TD;\n    A-->B;';
        ta.selectionStart = 0;
        ta.selectionEnd = 5;
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        ta.dispatchEvent(new Event('select', { bubbles: true }));
        ta.focus();
      }
    });
    await page.waitForTimeout(500);

    const btn = page.locator('.fim-floating-btn');
    await expect(btn).toBeVisible();
    await expect(btn).toHaveAttribute('title');
  });

  test('7 - Le bouton flottant disparait en quittant l onglet Code', async ({ page }) => {
    await setMistralProvider(page);
    await switchToCodeTab(page);

    // Selectionner du texte
    await page.evaluate(() => {
      const ta = document.getElementById('code-preview');
      if (ta) {
        ta.value = 'graph TD;\n    A-->B;';
        ta.selectionStart = 0;
        ta.selectionEnd = 5;
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        ta.dispatchEvent(new Event('select', { bubbles: true }));
      }
    });
    await page.waitForTimeout(500);
    await expect(page.locator('.fim-floating-btn')).toBeVisible();

    // Basculer vers l onglet Editeur
    await page.locator('.main__tab[data-center-tab="editor"]').click();
    await page.waitForTimeout(300);

    await expect(page.locator('.fim-floating-btn')).toBeHidden();
  });
});

/* ---------------------------------------------------------------------------
 * Tests — Ctrl+Shift+C (FIM keyboard shortcut)
 * -------------------------------------------------------------------------- */

test.describe('FIM - Ctrl+Shift+C raccourci clavier', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.canvas-content', { timeout: 10000 });
    await clearState(page);
  });

  test('8 - Ctrl+Shift+C sans selection ne fait rien sans erreur', async ({ page }) => {
    await setMistralProvider(page);
    await switchToCodeTab(page);

    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));

    // Focus le textarea sans selection
    await page.evaluate(() => {
      const ta = document.getElementById('code-preview');
      if (ta) {
        ta.value = 'graph TD;\n    A-->B;';
        ta.selectionStart = 0;
        ta.selectionEnd = 0;
        ta.focus();
      }
    });
    await page.waitForTimeout(100);

    await page.keyboard.press('Control+Shift+c');
    await page.waitForTimeout(500);

    // Pas d erreur
    expect(errors).toHaveLength(0);

    // Le chat ne s ouvre pas
    expect(await isChatPanelOpen(page)).toBe(false);
  });

  test('9 - Ctrl+Shift+C avec selection et provider non-Mistral ne crash pas', async ({ page }) => {
    await setProvider(page, 'ollama');
    await switchToCodeTab(page);

    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.evaluate(() => {
      const ta = document.getElementById('code-preview');
      if (ta) {
        ta.value = 'graph TD;\n    A-->B;';
        ta.selectionStart = 0;
        ta.selectionEnd = 5;
        ta.focus();
      }
    });
    await page.waitForTimeout(100);

    await page.keyboard.press('Control+Shift+c');
    await page.waitForTimeout(500);

    // Pas de crash
    expect(errors).toHaveLength(0);
  });

  test('10 - Ctrl+Shift+C sans textarea focus ne fait rien', async ({ page }) => {
    await setMistralProvider(page);
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));

    // Focus sur le body (pas le textarea)
    await page.evaluate(() => document.activeElement.blur());
    await page.waitForTimeout(100);

    await page.keyboard.press('Control+Shift+c');
    await page.waitForTimeout(500);

    expect(errors).toHaveLength(0);
  });
});

/* ---------------------------------------------------------------------------
 * Tests — Action rapide "Completer code"
 * -------------------------------------------------------------------------- */

test.describe('FIM - Action rapide Completer code', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.canvas-content', { timeout: 10000 });
    await clearState(page);
    await setMistralProvider(page);
  });

  test('11 - L action rapide Completer code est presente quand un provider est configure', async ({ page }) => {
    // Ouvrir le panneau chat
    await page.keyboard.press('Control+Shift+a');
    await page.waitForTimeout(400);
    expect(await isChatPanelOpen(page)).toBe(true);

    // Verifier que l action rapide Completer code existe
    const fimBtn = page.locator('[data-quick-action="fim"]');
    await expect(fimBtn).toBeAttached();
    // Just verify the fim action button is present and functional
    const fimText = await fimBtn.textContent();
    expect(fimText.toLowerCase()).toContain('code');
  });

  test('12 - Les quick actions incluent le bouton fim avec provider Mistral', async ({ page }) => {
    // Avec Mistral, le bouton fim est present
    await page.keyboard.press('Control+Shift+a');
    await page.waitForTimeout(400);

    const fimBtn = page.locator('[data-quick-action="fim"]');
    await expect(fimBtn).toBeAttached();
  });

  test('13 - Les 5 actions rapides sont presentes (4 originales + Completer code)', async ({ page }) => {
    await page.keyboard.press('Control+Shift+a');
    await page.waitForTimeout(400);

    const quickBtns = page.locator('[data-quick-action]');
    const count = await quickBtns.count();
    expect(count).toBe(5);

    // Verifier les IDs
    const ids = await quickBtns.evaluateAll((btns) =>
      btns.map((b) => b.getAttribute('data-quick-action')),
    );
    expect(ids).toContain('analyze');
    expect(ids).toContain('suggest');
    expect(ids).toContain('doc');
    expect(ids).toContain('enrich');
    expect(ids).toContain('fim');
  });
});
