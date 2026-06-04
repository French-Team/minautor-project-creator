/**
 * E2E tests — Workflow complet du Hub (connecteur multiple)
 *
 * Scénarios :
 *   1. Création d'un hub via le menu port (multilink → picker)
 *   2. Vérification visuelle du hub (body, branches, ports)
 *   3. Connexion hub → nœud cible
 *   4. Redimensionnement du hub (resize 6→8→4)
 *   5. Drag du hub body
 *   6. Persistance localStorage (reload → restauration)
 *   7. Suppression du hub
 *   8. Filtre Mermaid : les hubs sont exclus du code généré
 */
import { test, expect } from '@playwright/test';
import { buildMermaidCode } from '../src/code-city/mermaid/build.js';

/* ---------------------------------------------------------------------------
 * Helpers
 * -------------------------------------------------------------------------- */

/** Crée des nœuds de test via l'API interne. */
async function createTestNodes(page) {
  await page.evaluate(() => {
    const { actions } = window.__state;
    actions.addNode({ type: 'process', label: 'Source', x: 100, y: 200, priority: 'medium' });
    actions.addNode({ type: 'process', label: 'Target A', x: 500, y: 100, priority: 'medium' });
    actions.addNode({ type: 'process', label: 'Target B', x: 500, y: 250, priority: 'medium' });
    actions.addNode({ type: 'decision', label: 'Condition', x: 500, y: 400, priority: 'medium' });
  });
}

/** Renvoie le nombre de nœuds de type hub dans le state. */
async function hubCount(page) {
  return page.evaluate(() => window.__state.getState().nodes.filter(n => n.type === 'hub').length);
}

/** Renvoie le hub (premier trouvé) ou null. */
async function getHub(page) {
  return page.evaluate(() => window.__state.getState().nodes.find(n => n.type === 'hub') || null);
}

/** Attend qu'un élément .canvas-element--hub apparaisse dans le DOM. */
async function waitForHubElement(page, timeout = 5000) {
  await page.locator('.canvas-element--hub').first().waitFor({ state: 'attached', timeout });
}

/** Compte les ports hub visibles dans le DOM. */
async function countHubPorts(page) {
  return page.locator('.canvas-element--hub .hub-port').count();
}

/** Compte les branches SVG (lignes) dans le hub. */
async function countHubBranches(page) {
  return page.locator('.canvas-element--hub .hub-branch-line').count();
}

/** Attend le debounce d'auto-save (500ms) + un petit tampon. */
async function waitForAutoSave(page) {
  await page.waitForTimeout(800);
}

/* ---------------------------------------------------------------------------
 * Tests
 * -------------------------------------------------------------------------- */

test.describe('Hub — Workflow complet', () => {

  test.beforeEach(async ({ page }) => {
    // Naviguer vers l'app et attendre le rendu du canvas
    await page.goto('/');
    await page.waitForSelector('#canvas-content', { timeout: 10000 });

    // Réinitialiser l'état avant chaque test
    await page.evaluate(() => {
      localStorage.clear();
      window.__state.actions.clear();
    });

    // Créer les nœuds de test
    await createTestNodes(page);
    // Attendre que le renderer traite les ajouts
    await page.waitForTimeout(300);
  });

  /* ---- 1. Création du hub ---- */

  test('1 — Créer un hub via l\'API interne', async ({ page }) => {
    // Créer un hub rattaché au port "out" du nœud Source (n1-process)
    await page.evaluate(() => {
      const sourceId = window.__state.getState().nodes[0].id;
      window.__state.actions.createHub(sourceId, 'out', 6, 300, 200);
    });
    await page.waitForTimeout(300);

    // Vérifier le state
    const hubs = await hubCount(page);
    expect(hubs).toBe(1);

    const hub = await getHub(page);
    expect(hub).not.toBeNull();
    expect(hub.type).toBe('hub');
    expect(hub.hubBranches).toBe(6);
    expect(hub.hubBasePort).toBe('out');

    // Vérifier l'arête de base (source → hub)
    const baseEdge = await page.evaluate(() => {
      const hub = window.__state.getState().nodes.find(n => n.type === 'hub');
      return window.__state.getState().edges.find(
        e => e.to === hub.id && e.toPort === 'hub-base'
      );
    });
    expect(baseEdge).not.toBeNull();
    expect(baseEdge.fromPort).toBe('out');
  });

  test('2 — Créer un hub via l\'UI (menu port → multilink → picker)', async ({ page }) => {
    // Localiser le premier nœud source
    const sourceEl = page.locator('.canvas-element').first();
    await sourceEl.waitFor({ state: 'attached' });

    // Cliquer sur le port "out" (droite) pour ouvrir le menu port
    const outPort = sourceEl.locator('.port--out');
    await outPort.click();
    await page.waitForTimeout(200);

    // Le menu port devrait apparaître
    const portMenu = sourceEl.locator('.port-menu--out');
    await expect(portMenu).toBeVisible();

    // Cliquer sur le bouton "Multilink" (🔀)
    const multilinkBtn = portMenu.locator('[data-action="multilink"]');
    await multilinkBtn.click();
    await page.waitForTimeout(200);

    // Le picker de branches devrait apparaître
    const picker = page.locator('.hub-picker');
    await expect(picker).toBeVisible();

    // Vérifier les boutons (4, 6, 8, 10)
    const btns = picker.locator('.hub-picker__btn');
    await expect(btns).toHaveCount(4);

    // Sélectionner 6 branches
    await btns.nth(1).click(); // 6 est le 2e bouton
    await page.waitForTimeout(400);

    // Vérifier qu'un hub a été créé
    const hubs = await hubCount(page);
    expect(hubs).toBe(1);

    // Vérifier le DOM du hub
    await waitForHubElement(page);
  });

  /* ---- 2. Vérification visuelle du hub ---- */

  test('3 — Le hub affiche body, branches et ports', async ({ page }) => {
    await page.evaluate(() => {
      const sourceId = window.__state.getState().nodes[0].id;
      window.__state.actions.createHub(sourceId, 'out', 8, 300, 200);
    });
    await waitForHubElement(page);
    await page.waitForTimeout(500); // animations

    // Hub body (cercle central)
    const hubBody = page.locator('.canvas-element--hub .hub-body');
    await expect(hubBody).toBeVisible();

    // Branches SVG (8 lignes)
    const branches = await countHubBranches(page);
    expect(branches).toBe(8);

    // Ports (8 ports hub)
    const hubPorts = await countHubPorts(page);
    expect(hubPorts).toBe(8);

    // Chaque port a un data-port correct
    for (let i = 0; i < 8; i++) {
      const port = page.locator(`.hub-port[data-port="hub-${i}"]`);
      await expect(port).toBeAttached();
    }
  });

  /* ---- 3. Connexion hub → nœud cible ---- */

  test('4 — Connecter une branche hub à un nœud cible', async ({ page }) => {
    // Créer hub + connecter branch 0 → Target A
    await page.evaluate(() => {
      const { getState, actions } = window.__state;
      const sourceId = getState().nodes[0].id;
      const targetA = getState().nodes[1].id;
      const hub = actions.createHub(sourceId, 'out', 6, 300, 200);
      actions.addEdge({ from: hub.id, to: targetA, fromPort: 'hub-0', toPort: 'in' });
    });
    await page.waitForTimeout(300);

    // Vérifier l'arête hub-0 → Target A
    const edge = await page.evaluate(() => {
      const { getState } = window.__state;
      return getState().edges.find(
        e => e.fromPort === 'hub-0' && e.toPort === 'in' && e.to !== e.from
      );
    });
    expect(edge).not.toBeNull();

    // Vérifier le nombre total d'arêtes (base + 1 branch)
    const edgeCount = await page.evaluate(() => window.__state.getState().edges.length);
    expect(edgeCount).toBe(2); // base edge + branch edge

    // Vérifier que la classe "connected" est sur le port hub-0
    const connectedPort = page.locator('.hub-port[data-port="hub-0"]');
    await expect(connectedPort).toHaveClass(/connected/);
  });

  /* ---- 4. Redimensionnement du hub ---- */

  test('5 — Redimensionner le hub (6 → 8 → 4)', async ({ page }) => {
    await page.evaluate(() => {
      const sourceId = window.__state.getState().nodes[0].id;
      window.__state.actions.createHub(sourceId, 'out', 6, 300, 200);
    });
    await waitForHubElement(page);

    // Vérifier 6 branches initiales
    let branches = await countHubBranches(page);
    expect(branches).toBe(6);
    let ports = await countHubPorts(page);
    expect(ports).toBe(6);

    // Redimensionner à 8
    await page.evaluate(() => {
      const hub = window.__state.getState().nodes.find(n => n.type === 'hub');
      window.__state.actions.updateHubBranches(hub.id, 8);
    });
    await page.waitForTimeout(300);

    branches = await countHubBranches(page);
    expect(branches).toBe(8);
    ports = await countHubPorts(page);
    expect(ports).toBe(8);

    // Redimensionner à 4
    await page.evaluate(() => {
      const hub = window.__state.getState().nodes.find(n => n.type === 'hub');
      window.__state.actions.updateHubBranches(hub.id, 4);
    });
    await page.waitForTimeout(300);

    branches = await countHubBranches(page);
    expect(branches).toBe(4);
    ports = await countHubPorts(page);
    expect(ports).toBe(4);
  });

  test('6 — Réduire le hub supprime les arêtes excédentaires', async ({ page }) => {
    // Créer hub 6 branches, connecter 4 branches à des cibles
    await page.evaluate(() => {
      const { getState, actions } = window.__state;
      const sourceId = getState().nodes[0].id;
      const targets = getState().nodes.slice(1);
      const hub = actions.createHub(sourceId, 'out', 6, 300, 200);
      // Connecter hub-0 → Target A, hub-1 → Target B, hub-2 → Condition, hub-3 → Target A
      actions.addEdge({ from: hub.id, to: targets[0].id, fromPort: 'hub-0', toPort: 'in' });
      actions.addEdge({ from: hub.id, to: targets[1].id, fromPort: 'hub-1', toPort: 'in' });
      actions.addEdge({ from: hub.id, to: targets[2].id, fromPort: 'hub-2', toPort: 'in' });
      actions.addEdge({ from: hub.id, to: targets[0].id, fromPort: 'hub-3', toPort: 'in' });
    });

    // 5 arêtes : 1 base + 4 branches
    let edgeCount = await page.evaluate(() => window.__state.getState().edges.length);
    expect(edgeCount).toBe(5);

    // Réduire à 3 : hub-3 (la 4e) doit être supprimée
    await page.evaluate(() => {
      const hub = window.__state.getState().nodes.find(n => n.type === 'hub');
      window.__state.actions.updateHubBranches(hub.id, 3);
    });

    // 4 arêtes : 1 base + 3 branches (hub-3 supprimée)
    edgeCount = await page.evaluate(() => window.__state.getState().edges.length);
    expect(edgeCount).toBe(4);

    // Vérifier que hub-3 n'existe plus
    const hasHub3 = await page.evaluate(() => {
      return window.__state.getState().edges.some(
        e => e.fromPort === 'hub-3' || e.toPort === 'hub-3'
      );
    });
    expect(hasHub3).toBe(false);
  });

  /* ---- 5. Drag du hub ---- */

  test('7 — Déplacer le hub via le hub-body', async ({ page }) => {
    await page.evaluate(() => {
      const sourceId = window.__state.getState().nodes[0].id;
      window.__state.actions.createHub(sourceId, 'out', 6, 300, 200);
    });
    await waitForHubElement(page);

    const hubBody = page.locator('.canvas-element--hub .hub-body');
    await expect(hubBody).toBeVisible();

    // Position initiale du hub
    const initialPos = await page.evaluate(() => {
      const hub = window.__state.getState().nodes.find(n => n.type === 'hub');
      return { x: hub.x, y: hub.y };
    });

    // Drag le hub body de +50px en X et +30px en Y
    const box = await hubBody.boundingBox();
    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    // Déplacer progressivement (le drag handler écoute mousemove sur document)
    for (let i = 1; i <= 5; i++) {
      await page.mouse.move(startX + i * 10, startY + i * 6);
      await page.waitForTimeout(30);
    }
    await page.mouse.up();
    await page.waitForTimeout(200);

    // Vérifier la nouvelle position
    const newPos = await page.evaluate(() => {
      const hub = window.__state.getState().nodes.find(n => n.type === 'hub');
      return { x: hub.x, y: hub.y };
    });

    // Le hub a bougé (tolérance de snap-to-grid)
    const moved = Math.abs(newPos.x - initialPos.x) > 5 || Math.abs(newPos.y - initialPos.y) > 5;
    expect(moved).toBe(true);
  });

  /* ---- 6. Persistance localStorage ---- */

  test('8 — Persister et restaurer le hub après reload', async ({ page }) => {
    // Créer un graphe complet avec hub
    await page.evaluate(() => {
      const { getState, actions } = window.__state;
      const sourceId = getState().nodes[0].id;
      const targetA = getState().nodes[1].id;
      const hub = actions.createHub(sourceId, 'out', 6, 300, 200);
      actions.addEdge({ from: hub.id, to: targetA, fromPort: 'hub-0', toPort: 'in' });
    });

    // Attendre l'auto-save (debounce 400ms + marge)
    await waitForAutoSave(page);

    // Vérifier que localStorage contient les données
    const hasData = await page.evaluate(() => {
      return localStorage.getItem('code-city-graph') !== null;
    });
    expect(hasData).toBe(true);

    // Recharger la page
    await page.reload();
    await page.waitForSelector('#canvas-content', { timeout: 10000 });
    await page.waitForTimeout(500);

    // Vérifier que le hub a été restauré
    const hubsAfterReload = await hubCount(page);
    expect(hubsAfterReload).toBe(1);

    const hubAfterReload = await getHub(page);
    expect(hubAfterReload).not.toBeNull();
    expect(hubAfterReload.type).toBe('hub');
    expect(hubAfterReload.hubBranches).toBe(6);

    // Vérifier que l'arête de base est restaurée
    const baseEdgeAfter = await page.evaluate(() => {
      const hub = window.__state.getState().nodes.find(n => n.type === 'hub');
      return window.__state.getState().edges.find(
        e => e.to === hub.id && e.toPort === 'hub-base'
      );
    });
    expect(baseEdgeAfter).not.toBeNull();

    // Vérifier que l'arête hub-0 → Target A est restaurée
    const branchEdgeAfter = await page.evaluate(() => {
      const hub = window.__state.getState().nodes.find(n => n.type === 'hub');
      return window.__state.getState().edges.find(
        e => e.from === hub.id && e.fromPort === 'hub-0'
      );
    });
    expect(branchEdgeAfter).not.toBeNull();
  });

  /* ---- 7. Suppression du hub ---- */

  test('9 — Supprimer le hub supprime les arêtes associées', async ({ page }) => {
    await page.evaluate(() => {
      const { getState, actions } = window.__state;
      const sourceId = getState().nodes[0].id;
      const targetA = getState().nodes[1].id;
      const hub = actions.createHub(sourceId, 'out', 6, 300, 200);
      actions.addEdge({ from: hub.id, to: targetA, fromPort: 'hub-0', toPort: 'in' });
    });

    // 3 arêtes : base + hub-0 + (source → targetA potentielle)
    const edgeCountBefore = await page.evaluate(() => window.__state.getState().edges.length);
    expect(edgeCountBefore).toBe(2); // 1 base + 1 branch

    // Supprimer le hub
    await page.evaluate(() => {
      const hub = window.__state.getState().nodes.find(n => n.type === 'hub');
      window.__state.actions.removeNode(hub.id);
    });

    // Plus de hubs
    expect(await hubCount(page)).toBe(0);

    // Plus d'arêtes liées au hub
    const edgesWithHub = await page.evaluate(() => {
      const hubId = 'hub'; // on ne peut plus le trouver
      // Vérifier qu'aucune arête ne référence un hub
      return window.__state.getState().edges.filter(
        e => e.fromPort?.startsWith('hub-') || e.toPort === 'hub-base' || e.fromPort === 'hub-base'
      ).length;
    });
    expect(edgesWithHub).toBe(0);
  });

  /* ---- 8. Filtre Mermaid ---- */

  test('10 — Le code Mermaid exclut les hubs et résout les connexions', async ({ page }) => {
    // Créer : Source → hub → [Target A, Target B]
    await page.evaluate(() => {
      const { getState, actions } = window.__state;
      const sourceId = getState().nodes[0].id;
      const targetA = getState().nodes[1].id;
      const targetB = getState().nodes[2].id;
      const hub = actions.createHub(sourceId, 'out', 6, 300, 200);
      actions.addEdge({ from: hub.id, to: targetA, fromPort: 'hub-0', toPort: 'in' });
      actions.addEdge({ from: hub.id, to: targetB, fromPort: 'hub-1', toPort: 'in' });
    });

    // Récupérer les IDs des nœuds pour vérifier les arêtes par ID
    const nodeIds = await page.evaluate(() => {
      const nodes = window.__state.getState().nodes;
      return nodes.map(n => ({ id: n.id, label: n.label, type: n.type }));
    });
    const sourceNode = nodeIds.find(n => n.label === 'Source' && n.type !== 'hub');
    const targetA = nodeIds.find(n => n.label === 'Target A');
    const targetB = nodeIds.find(n => n.label === 'Target B');

    // Générer le code Mermaid (côté Node.js)
    const state = await page.evaluate(() => window.__state.getState());
    const mermaidCode = buildMermaidCode({ nodes: state.nodes, edges: state.edges });

    // Le code Mermaid ne doit PAS contenir de hub ni de ports hub
    expect(mermaidCode).not.toContain('hub-base');
    expect(mermaidCode).not.toContain('hub-0');
    expect(mermaidCode).not.toContain('hub-1');

    // Il doit contenir Source, Target A et Target B dans les déclarations
    expect(mermaidCode).toContain('Source');
    expect(mermaidCode).toContain('Target A');
    expect(mermaidCode).toContain('Target B');

    // Les arêtes doivent être résolues : Source → Target A et Source → Target B
    // (les lignes d'arête contiennent les IDs mermaid, pas les labels)
    const edgeLines = mermaidCode.split('\n').filter(l => l.includes('-->'));
    const sourceId = sourceNode.id;
    const sourceToA = edgeLines.some(l =>
      l.includes(sourceId) && l.includes(targetA.id)
    );
    const sourceToB = edgeLines.some(l =>
      l.includes(sourceId) && l.includes(targetB.id)
    );
    expect(sourceToA).toBe(true);
    expect(sourceToB).toBe(true);

    // Aucune arête ne doit mentionner le hub
    const hubNode = nodeIds.find(n => n.type === 'hub');
    if (hubNode) {
      const hubMentioned = edgeLines.some(l => l.includes(hubNode.id));
      expect(hubMentioned).toBe(false);
    }
  });
});
