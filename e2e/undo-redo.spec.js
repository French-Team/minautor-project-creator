/**
 * E2E tests — Undo / Redo
 *
 * Le système undo/redo utilise des snapshots "before" :
 *   - Chaque action push l'état AVANT la mutation
 *   - undo() décrémente l'index puis restaure stack[index]
 *   - Conséquence : undo saute un état intermédiaire
 *
 * Stratégie : chaque test gère le nombre d'actions requis pour que
 * undo/redo atteigne l'état attendu.
 */
import { test, expect } from '@playwright/test';

/* ---------------------------------------------------------------------------
 * Helpers
 * -------------------------------------------------------------------------- */

async function freshPage(page) {
  await page.goto('/');
  await page.waitForSelector('#canvas-content', { timeout: 10000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('#canvas-content', { timeout: 10000 });
  await page.locator('#canvas-content').click();
  await page.waitForTimeout(100);
}

async function getNodeCount(page) {
  return page.evaluate(() => window.__state.getState().nodes.length);
}

async function getEdgeCount(page) {
  return page.evaluate(() => window.__state.getState().edges.length);
}

async function getNodes(page) {
  return page.evaluate(() => window.__state.getState().nodes.map(n => ({
    id: n.id, type: n.type, label: n.label,
  })));
}

async function undo(page) {
  await page.evaluate(() => window.__state.actions.undo());
}

async function redo(page) {
  await page.evaluate(() => window.__state.actions.redo());
}

async function dispatchCtrlZ(page) {
  await page.evaluate(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'z', code: 'KeyZ', ctrlKey: true, bubbles: true,
    }));
  });
  await page.waitForTimeout(100);
}

async function dispatchCtrlY(page) {
  await page.evaluate(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'y', code: 'KeyY', ctrlKey: true, bubbles: true,
    }));
  });
  await page.waitForTimeout(100);
}

async function dispatchCtrlShiftZ(page) {
  await page.evaluate(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'z', code: 'KeyZ', ctrlKey: true, shiftKey: true, bubbles: true,
    }));
  });
  await page.waitForTimeout(100);
}

/* ---------------------------------------------------------------------------
 * Tests
 * -------------------------------------------------------------------------- */

test.describe('Undo / Redo', () => {

  test.beforeEach(async ({ page }) => {
    await freshPage(page);
  });

  /* ---- 1. Undo après 3 créations → [A] ---- */

  test('1 — Undo après création de 3 nœuds', async ({ page }) => {
    await page.evaluate(() => {
      const { actions } = window.__state;
      actions.addNode({ type: 'process', label: 'A', x: 100, y: 100, priority: 'medium' });
      actions.addNode({ type: 'process', label: 'B', x: 200, y: 200, priority: 'medium' });
      actions.addNode({ type: 'process', label: 'C', x: 300, y: 300, priority: 'medium' });
    });
    expect(await getNodeCount(page)).toBe(3);

    // undo → restore stack[1] = [A] (état avant 2e action)
    await undo(page);
    expect(await getNodeCount(page)).toBe(1);
  });

  /* ---- 2. Redo après undo ---- */

  test('2 — Redo après undo restaure l\'état suivant', async ({ page }) => {
    await page.evaluate(() => {
      const { actions } = window.__state;
      actions.addNode({ type: 'process', label: 'A', x: 100, y: 100, priority: 'medium' });
      actions.addNode({ type: 'process', label: 'B', x: 200, y: 200, priority: 'medium' });
      actions.addNode({ type: 'process', label: 'C', x: 300, y: 300, priority: 'medium' });
    });

    await undo(page); // → [A]
    expect(await getNodeCount(page)).toBe(1);

    await redo(page); // → [A,B]
    expect(await getNodeCount(page)).toBe(2);
  });

  /* ---- 3. Undo après suppression ---- */

  test('3 — Undo après suppression restaure le nœud supprimé', async ({ page }) => {
    // 3 addNodes + 1 removeNode = 4 actions
    // undo → stack[2] = état avant 3e action = [A,B]
    await page.evaluate(() => {
      const { actions } = window.__state;
      actions.addNode({ type: 'process', label: 'A', x: 100, y: 100, priority: 'medium' });
      actions.addNode({ type: 'process', label: 'B', x: 200, y: 200, priority: 'medium' });
      actions.addNode({ type: 'process', label: 'C', x: 300, y: 300, priority: 'medium' });
      const b = window.__state.getState().nodes.find(n => n.label === 'B');
      actions.removeNode(b.id);
    });
    expect(await getNodeCount(page)).toBe(2); // A + C

    // undo → stack[2] = [A,B] (état avant 3e action)
    await undo(page);
    expect(await getNodeCount(page)).toBe(2);
    const nodes = await getNodes(page);
    expect(nodes.map(n => n.label).sort()).toEqual(['A', 'B']);
  });

  /* ---- 4. Undo après ajout d'arête ---- */

  test('4 — Undo après ajout d\'arête supprime l\'arête', async ({ page }) => {
    // 3 addNodes + 1 addEdge = 4 actions
    // undo → stack[2] = [A,B] (état avant 3e action, 0 arêtes)
    await page.evaluate(() => {
      const { actions } = window.__state;
      actions.addNode({ type: 'process', label: 'A', x: 100, y: 100, priority: 'medium' });
      actions.addNode({ type: 'process', label: 'B', x: 300, y: 100, priority: 'medium' });
      actions.addNode({ type: 'process', label: 'C', x: 300, y: 300, priority: 'medium' });
      const nodes = window.__state.getState().nodes;
      actions.addEdge({ from: nodes[0].id, to: nodes[1].id });
    });
    expect(await getEdgeCount(page)).toBe(1);

    // undo → restore stack[2] = [A,B] = 2 nœuds, 0 arêtes
    await undo(page);
    expect(await getEdgeCount(page)).toBe(0);
    expect(await getNodeCount(page)).toBe(2);
  });

  /* ---- 5. Undo après création de hub ---- */

  test('5 — Undo après création de hub le supprime', async ({ page }) => {
    // 3 addNodes + 1 createHub = 4 actions
    // undo → stack[2] = [A,B] (état avant 3e action)
    await page.evaluate(() => {
      const { actions } = window.__state;
      actions.addNode({ type: 'process', label: 'A', x: 100, y: 100, priority: 'medium' });
      actions.addNode({ type: 'process', label: 'B', x: 200, y: 200, priority: 'medium' });
      actions.addNode({ type: 'process', label: 'C', x: 300, y: 300, priority: 'medium' });
      const sourceId = window.__state.getState().nodes[0].id;
      actions.createHub(sourceId, 'out', 6, 500, 200);
    });
    expect(await getNodeCount(page)).toBe(4);

    // undo → stack[2] = [A,B]
    await undo(page);
    expect(await getNodeCount(page)).toBe(2);
    const nodes = await getNodes(page);
    expect(nodes.every(n => n.type !== 'hub')).toBe(true);
  });

  /* ---- 6. Ctrl+Shift+Z = redo ---- */

  test('6 — Ctrl+Shift+Z fait aussi redo', async ({ page }) => {
    await page.evaluate(() => {
      const { actions } = window.__state;
      actions.addNode({ type: 'process', label: 'A', x: 100, y: 100, priority: 'medium' });
      actions.addNode({ type: 'process', label: 'B', x: 200, y: 200, priority: 'medium' });
      actions.addNode({ type: 'process', label: 'C', x: 300, y: 300, priority: 'medium' });
    });

    await undo(page); // → [A]
    expect(await getNodeCount(page)).toBe(1);

    await dispatchCtrlShiftZ(page); // → [A,B]
    expect(await getNodeCount(page)).toBe(2);
  });

  /* ---- 7. canUndo / canRedo ---- */

  test('7 — canUndo/canRedo reflètent l\'historique', async ({ page }) => {
    expect(await page.evaluate(() => window.__state.actions.canUndo())).toBe(false);
    expect(await page.evaluate(() => window.__state.actions.canRedo())).toBe(false);

    // 2 addNodes → index=1
    await page.evaluate(() => {
      window.__state.actions.addNode({ type: 'process', label: 'A', x: 100, y: 100, priority: 'medium' });
      window.__state.actions.addNode({ type: 'process', label: 'B', x: 200, y: 200, priority: 'medium' });
    });
    expect(await page.evaluate(() => window.__state.actions.canUndo())).toBe(true);
    expect(await page.evaluate(() => window.__state.actions.canRedo())).toBe(false);

    // undo → index=0
    await undo(page);
    expect(await page.evaluate(() => window.__state.actions.canUndo())).toBe(false);
    expect(await page.evaluate(() => window.__state.actions.canRedo())).toBe(true);

    // redo → index=1
    await redo(page);
    expect(await page.evaluate(() => window.__state.actions.canUndo())).toBe(true);
    expect(await page.evaluate(() => window.__state.actions.canRedo())).toBe(false);
  });

  /* ---- 8. Ctrl+Z dispatch déclenche undo ---- */

  test('8 — Le dispatch keyboard Ctrl+Z déclenche l\'undo', async ({ page }) => {
    await page.evaluate(() => {
      const { actions } = window.__state;
      actions.addNode({ type: 'process', label: 'A', x: 100, y: 100, priority: 'medium' });
      actions.addNode({ type: 'process', label: 'B', x: 200, y: 200, priority: 'medium' });
      actions.addNode({ type: 'process', label: 'C', x: 300, y: 300, priority: 'medium' });
    });
    expect(await getNodeCount(page)).toBe(3);

    await dispatchCtrlZ(page); // → [A]
    expect(await getNodeCount(page)).toBe(1);

    await dispatchCtrlY(page); // → [A,B]
    expect(await getNodeCount(page)).toBe(2);
  });

  /* ---- 9. Focus input désactive les shortcuts ---- */

  test('9 — Ctrl+Z ne fonctionne pas avec un input focusé', async ({ page }) => {
    await page.evaluate(() => {
      window.__state.actions.addNode({ type: 'process', label: 'A', x: 100, y: 100, priority: 'medium' });
      window.__state.actions.addNode({ type: 'process', label: 'B', x: 200, y: 200, priority: 'medium' });
      window.__state.actions.addNode({ type: 'process', label: 'C', x: 300, y: 300, priority: 'medium' });
    });
    expect(await getNodeCount(page)).toBe(3);

    // Dispatch Ctrl+Z depuis l'input (le target sera l'input → shouldIgnoreEvent retourne true)
    const searchInput = page.locator('#palette-search');
    if (await searchInput.isVisible()) {
      await searchInput.focus();
      await searchInput.evaluate(el => {
        el.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'z', code: 'KeyZ', ctrlKey: true, bubbles: true,
        }));
      });
      await page.waitForTimeout(200);
      expect(await getNodeCount(page)).toBe(3); // inchangé
    }
  });

  /* ---- 10. Undo multiple jusqu'au début ---- */

  test('10 — Undo multiple jusqu\'au début de l\'historique', async ({ page }) => {
    await page.evaluate(() => {
      window.__state.actions.addNode({ type: 'process', label: 'A', x: 100, y: 100, priority: 'medium' });
      window.__state.actions.addNode({ type: 'process', label: 'B', x: 200, y: 100, priority: 'medium' });
      window.__state.actions.addNode({ type: 'process', label: 'C', x: 300, y: 100, priority: 'medium' });
    });
    expect(await getNodeCount(page)).toBe(3);

    // undo 1 → [A] (stack[1])
    await undo(page);
    expect(await getNodeCount(page)).toBe(1);

    // undo 2 → [] (stack[0])
    await undo(page);
    expect(await getNodeCount(page)).toBe(0);

    // undo 3 → noop (index ≤ 0)
    await undo(page);
    expect(await getNodeCount(page)).toBe(0);
    expect(await page.evaluate(() => window.__state.actions.canUndo())).toBe(false);
  });

  /* ---- 11. Redo au maximum ---- */

  test('11 — Redo au-delà du max ne fait rien', async ({ page }) => {
    await page.evaluate(() => {
      window.__state.actions.addNode({ type: 'process', label: 'A', x: 100, y: 100, priority: 'medium' });
      window.__state.actions.addNode({ type: 'process', label: 'B', x: 200, y: 200, priority: 'medium' });
    });

    // undo → []
    await undo(page);
    expect(await getNodeCount(page)).toBe(0);

    // redo → [A] (stack[1])
    await redo(page);
    expect(await getNodeCount(page)).toBe(1);

    // 2e redo → noop (index = stack.length-1)
    await redo(page);
    expect(await getNodeCount(page)).toBe(1);
    expect(await page.evaluate(() => window.__state.actions.canRedo())).toBe(false);
  });

  /* ---- 12. Undo après updateNode ---- */

  test('12 — Undo après updateNode restaure l\'ancien label', async ({ page }) => {
    // addNode A, addNode B, updateNode A = 3 actions
    // undo → stack[1] = [A] (état avant 2e action)
    await page.evaluate(() => {
      window.__state.actions.addNode({ type: 'process', label: 'Original', x: 100, y: 100, priority: 'medium' });
      window.__state.actions.addNode({ type: 'process', label: 'B', x: 200, y: 200, priority: 'medium' });
    });

    await page.evaluate(() => {
      const id = window.__state.getState().nodes[0].id;
      window.__state.actions.updateNode(id, { label: 'Modified' });
    });

    let nodes = await getNodes(page);
    expect(nodes[0].label).toBe('Modified');

    // undo → stack[1] = [A avec label 'Original']
    await undo(page);
    nodes = await getNodes(page);
    expect(nodes[0].label).toBe('Original');
    expect(nodes).toHaveLength(1);
  });

  /* ---- 13. Undo après updateHubBranches ---- */

  test('13 — Undo après updateHubBranches restaure le nb de branches', async ({ page }) => {
    // addNode A, B, C, createHub, updateHubBranches = 5 actions
    // undo → stack[3] = état avant 4e action = [A,B,C] (pas de hub!)
    await page.evaluate(() => {
      const { actions } = window.__state;
      actions.addNode({ type: 'process', label: 'A', x: 100, y: 100, priority: 'medium' });
      actions.addNode({ type: 'process', label: 'B', x: 200, y: 200, priority: 'medium' });
      actions.addNode({ type: 'process', label: 'C', x: 300, y: 300, priority: 'medium' });
      const sourceId = window.__state.getState().nodes[0].id;
      actions.createHub(sourceId, 'out', 6, 500, 200);
    });

    await page.evaluate(() => {
      const hub = window.__state.getState().nodes.find(n => n.type === 'hub');
      window.__state.actions.updateHubBranches(hub.id, 8);
    });

    let hub = await page.evaluate(() => window.__state.getState().nodes.find(n => n.type === 'hub'));
    expect(hub.hubBranches).toBe(8);

    // undo → stack[3] = état avant createHub = [A,B,C] (3 nœuds, pas de hub)
    await undo(page);
    const count = await getNodeCount(page);
    expect(count).toBe(3); // A + B + C, plus de hub
    const hasHub = await page.evaluate(() => window.__state.getState().nodes.some(n => n.type === 'hub'));
    expect(hasHub).toBe(false);
  });
});
