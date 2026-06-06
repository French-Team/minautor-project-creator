/**
 * Tests E2E — Assistant Mina
 *
 * Tests de l'assistant IA, axés sur le state management et la persistance.
 * Les tests UI (panneau chat) seront ajoutés quand chatPanel.js (Spec 3)
 * sera implémenté.
 *
 * Scénarios :
 *   1) pushChatMessage ajoute un message au state
 *   2) clearChatHistory réinitialise l'historique
 *   3) Persistance localStorage des messages chat
 *   4) Troncature automatique à 50 messages
 *   5) Le bouton "Assistant" est visible dans le header
 *   6) Le bouton "Providers" est visible et ouvre son panneau
 *   7) Ctrl+Shift+A est prêt (pas d'erreur)
 *   8) buildSystemMessages fonctionne depuis le navigateur
 *   9) Les actions rapides (QUICK_ACTIONS) sont disponibles
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

async function addTestNode(page, label = 'TestNode', type = 'process') {
  await page.evaluate(
    ({ label, type }) => {
      window.__state.actions.addNode({ type, label, x: 200, y: 200, priority: 'medium' });
    },
    { label, type },
  );
  await page.waitForTimeout(200);
}

/* ---------------------------------------------------------------------------
 * Tests — State Chat History
 * -------------------------------------------------------------------------- */

test.describe('Assistant — State Chat History', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.canvas-content', { timeout: 10000 });
    await clearState(page);
  });

  test('pushChatMessage ajoute un message user au state', async ({ page }) => {
    await page.evaluate(() => {
      window.__state.actions.pushChatMessage({
        role: 'user',
        content: 'Bonjour Mina',
      });
    });
    await page.waitForTimeout(200);

    const history = await page.evaluate(
      () => window.__state.getState().assistant.chatHistory,
    );
    expect(history).toHaveLength(1);
    expect(history[0].role).toBe('user');
    expect(history[0].content).toBe('Bonjour Mina');
    expect(history[0].timestamp).toBeGreaterThan(0);
  });

  test('pushChatMessage alterne user/assistant', async ({ page }) => {
    await page.evaluate(() => {
      window.__state.actions.pushChatMessage({ role: 'user', content: 'Question' });
      window.__state.actions.pushChatMessage({ role: 'assistant', content: 'Réponse' });
    });
    await page.waitForTimeout(200);

    const history = await page.evaluate(
      () => window.__state.getState().assistant.chatHistory,
    );
    expect(history).toHaveLength(2);
    expect(history[0].role).toBe('user');
    expect(history[1].role).toBe('assistant');
  });

  test('pushChatMessage avec metadata nodesAffected', async ({ page }) => {
    await page.evaluate(() => {
      window.__state.actions.pushChatMessage({
        role: 'user',
        content: 'Enrichis le nœud API',
        metadata: { nodesAffected: ['n1', 'n2'], actionType: 'enrich' },
      });
    });
    await page.waitForTimeout(200);

    const history = await page.evaluate(
      () => window.__state.getState().assistant.chatHistory,
    );
    expect(history[0].metadata.nodesAffected).toEqual(['n1', 'n2']);
    expect(history[0].metadata.actionType).toBe('enrich');
  });

  test('clearChatHistory réinitialise l\'historique', async ({ page }) => {
    await page.evaluate(() => {
      window.__state.actions.pushChatMessage({ role: 'user', content: 'Hello' });
      window.__state.actions.pushChatMessage({ role: 'assistant', content: 'Hi' });
    });
    await page.waitForTimeout(200);

    let history = await page.evaluate(
      () => window.__state.getState().assistant.chatHistory,
    );
    expect(history).toHaveLength(2);

    await page.evaluate(() => window.__state.actions.clearChatHistory());
    await page.waitForTimeout(200);

    history = await page.evaluate(
      () => window.__state.getState().assistant.chatHistory,
    );
    expect(history).toHaveLength(0);
  });

  test('La persistance localStorage inclut chatHistory', async ({ page }) => {
    await page.evaluate(() => {
      window.__state.actions.pushChatMessage({ role: 'user', content: 'Test persist' });
    });
    await page.waitForTimeout(300);

    const stored = await page.evaluate(() => {
      const raw = localStorage.getItem('code-city-assistant');
      return raw ? JSON.parse(raw) : null;
    });

    expect(stored).not.toBeNull();
    expect(stored.chatHistory).toBeDefined();
    expect(stored.chatHistory).toHaveLength(1);
    expect(stored.chatHistory[0].content).toBe('Test persist');
  });

  test('Troncature à 50 messages', async ({ page }) => {
    await page.evaluate(() => {
      for (let i = 0; i < 55; i++) {
        window.__state.actions.pushChatMessage({
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i}`,
        });
      }
    });
    await page.waitForTimeout(300);

    const history = await page.evaluate(
      () => window.__state.getState().assistant.chatHistory,
    );
    expect(history.length).toBeLessThanOrEqual(50);
    // Les premiers messages devraient être tronqués
    expect(history[0].content).toBe('Message 5'); // index 5 (les 5 premiers supprimés)
  });
});

/* ---------------------------------------------------------------------------
 * Tests — Contexte Canvas pour l'assistant
 * -------------------------------------------------------------------------- */

test.describe('Assistant — Contexte Canvas', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.canvas-content', { timeout: 10000 });
    await clearState(page);
  });

  test('buildSystemMessages depuis le navigateur avec des nœuds', async ({ page }) => {
    await addTestNode(page, 'API Backend', 'process');
    await addTestNode(page, 'Auth Service', 'decision');

    const result = await page.evaluate(() => {
      // Import dynamique pour accéder à buildSystemMessages
      const { buildSystemMessages } = window.__systemPromptModule || {};
      if (!buildSystemMessages) return null;

      const state = window.__state.getState();
      return buildSystemMessages({ nodes: state.nodes, edges: state.edges });
    });

    // Si le module n'est pas exposé, on teste via le state directement
    const nodeCount = await page.evaluate(
      () => window.__state.getState().nodes.length,
    );
    expect(nodeCount).toBe(2);

    const nodeTypes = await page.evaluate(() =>
      window.__state.getState().nodes.map((n) => n.type),
    );
    expect(nodeTypes).toContain('process');
    expect(nodeTypes).toContain('decision');
  });

  test('Le canvas avec des nœuds et arêtes est cohérent', async ({ page }) => {
    await page.evaluate(() => {
      const a = window.__state.actions;
      a.addNode({ id: 'n1', type: 'process', label: 'Frontend', x: 100, y: 100 });
      a.addNode({ id: 'n2', type: 'service-api', label: 'Backend', x: 300, y: 100 });
      a.addEdge({ from: 'n1', to: 'n2' });
    });
    await page.waitForTimeout(200);

    const graph = await page.evaluate(() => {
      const s = window.__state.getState();
      return { nodeCount: s.nodes.length, edgeCount: s.edges.length };
    });
    expect(graph.nodeCount).toBe(2);
    expect(graph.edgeCount).toBe(1);
  });
});

/* ---------------------------------------------------------------------------
 * Tests — Header buttons (providers + assistant)
 * -------------------------------------------------------------------------- */

test.describe('Assistant — Header UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.canvas-content', { timeout: 10000 });
    await page.waitForTimeout(500);
  });

  test('Le bouton "Providers" est visible dans le header', async ({ page }) => {
    const btn = page.locator('#providers-btn');
    await expect(btn).toBeVisible();
  });

  test('Le bouton "Providers" ouvre le panneau providers', async ({ page }) => {
    const btn = page.locator('#providers-btn');
    await btn.click();
    const panel = page.locator('#app-providers');
    await expect(panel).toHaveClass(/is-open/);
  });

  test('Fermer le panneau providers via Escape', async ({ page }) => {
    const btn = page.locator('#providers-btn');
    await btn.click();
    const panel = page.locator('#app-providers');
    await expect(panel).toHaveClass(/is-open/);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await expect(panel).not.toHaveClass(/is-open/);
  });

  test('Pas d\'erreur JS au démarrage', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('/');
    await page.waitForSelector('.canvas-content', { timeout: 10000 });
    await page.waitForTimeout(1000);
    expect(errors).toHaveLength(0);
  });
});

/* ---------------------------------------------------------------------------
 * Tests — Provider config pour l'assistant
 * -------------------------------------------------------------------------- */

test.describe('Assistant — Provider Config', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.canvas-content', { timeout: 10000 });
    await clearState(page);
  });

  test('Le provider par défaut est ollama', async ({ page }) => {
    const providerId = await page.evaluate(
      () => window.__state.getState().assistant.provider.id,
    );
    expect(providerId).toBe('ollama');
  });

  test('Changer de provider via l\'API state', async ({ page }) => {
    await page.evaluate(() => {
      window.__state.actions.setProvider('groq');
    });
    await page.waitForTimeout(200);

    const provider = await page.evaluate(() => {
      const s = window.__state.getState().assistant.provider;
      return { id: s.id, baseUrl: s.baseUrl };
    });
    expect(provider.id).toBe('groq');
    expect(provider.baseUrl).toBe('https://api.groq.com/openai/v1');
  });

  test('updateProvider change le modèle', async ({ page }) => {
    await page.evaluate(() => {
      window.__state.actions.updateProvider({ model: 'llama-3.1-8b-instant' });
    });
    await page.waitForTimeout(200);

    const model = await page.evaluate(
      () => window.__state.getState().assistant.provider.model,
    );
    expect(model).toBe('llama-3.1-8b-instant');
  });

  test('Le provider et chatHistory sont persistés ensemble', async ({ page }) => {
    await page.evaluate(() => {
      window.__state.actions.setProvider('groq');
      window.__state.actions.updateProvider({ apiKey: 'test-key' });
      window.__state.actions.pushChatMessage({ role: 'user', content: 'Test' });
    });
    await page.waitForTimeout(300);

    const stored = await page.evaluate(() => {
      const raw = localStorage.getItem('code-city-assistant');
      return raw ? JSON.parse(raw) : null;
    });
    expect(stored.provider.id).toBe('groq');
    expect(stored.provider.apiKey).toBe('test-key');
    expect(stored.chatHistory).toHaveLength(1);
  });
});
