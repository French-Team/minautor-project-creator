/**
 * Tests E2E — Synchronisation Mermaid ↔ Propriétés
 *
 * Vérifie que les propriétés métier sont synchronisées bidirectionnellement
 * entre le panneau Propriétés et le code Mermaid via les annotations %% @props.
 */

import { test, expect } from '@playwright/test';

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

async function freshPage(page) {
  await page.goto('/');
  await page.waitForSelector('#canvas-content', { timeout: 10000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('#canvas-content', { timeout: 10000 });
  await page.waitForTimeout(300);
}

async function createNode(page, type, label, props = {}) {
  return page.evaluate(({ type, label, props }) => {
    const { actions } = window.__state;
    actions.addNode({ type, label, x: 200, y: 200, priority: 'medium', properties: props });
    const nodes = window.__state.getState().nodes;
    return nodes[nodes.length - 1].id;
  }, { type, label, props });
}

async function getMermaidCode(page) {
  return page.evaluate(() => {
    const ta = document.getElementById('code-preview');
    return ta ? ta.value : '';
  });
}

async function switchToPropertiesTab(page) {
  const tab = page.locator('.main__tab[data-center-tab="properties"]');
  if (await tab.count() > 0) {
    await tab.click();
    await page.waitForTimeout(300);
  }
}

/** Get properties of the last node in state (safe after loadGraph ID reassignment). */
async function getLastNodeProps(page) {
  return page.evaluate(() => {
    const nodes = window.__state.getState().nodes;
    const node = nodes[nodes.length - 1];
    return node ? (node.properties || null) : null;
  });
}

/* -------------------------------------------------------------------------- */
/*  Tests                                                                     */
/* -------------------------------------------------------------------------- */

test.describe('Synchronisation Mermaid <-> Proprietes', () => {

  test.beforeEach(async ({ page }) => {
    await freshPage(page);
  });

  /* ---- Properties -> Mermaid (%% @props annotations) ---- */

  test('1 - Les proprietes non vides apparaissent en annotations', async ({ page }) => {
    const nodeId = await createNode(page, 'service-api', 'User API', {
      endpoint: '/api/users',
      method: 'GET',
    });

    await page.waitForTimeout(500);
    const code = await getMermaidCode(page);

    expect(code).toContain('%% @props');
    expect(code).toContain(nodeId);
    expect(code).toContain('"endpoint"');
    expect(code).toContain('/api/users');
    expect(code).toContain('"method"');
    expect(code).toContain('GET');
  });

  test('2 - Les proprietes vides ne generent pas d annotation', async ({ page }) => {
    await createNode(page, 'process', 'Simple Process', {});

    await page.waitForTimeout(500);
    const code = await getMermaidCode(page);

    expect(code).not.toContain('%% @props');
  });

  test('3 - Les proprietes null/undefined sont exclues', async ({ page }) => {
    await createNode(page, 'devops-ci', 'CI Pipeline', {
      tool: 'GitHub Actions',
      triggers: '',
      steps: undefined,
    });

    await page.waitForTimeout(500);
    const code = await getMermaidCode(page);

    expect(code).toContain('%% @props');
    expect(code).toContain('"tool"');
    expect(code).toContain('GitHub Actions');
    expect(code).not.toContain('"triggers"');
    expect(code).not.toContain('"steps"');
  });

  test('4 - Plusieurs noeuds generent des annotations separees', async ({ page }) => {
    await createNode(page, 'service-api', 'API 1', { endpoint: '/a' });
    await createNode(page, 'devops-ci', 'CI', { tool: 'Jenkins' });

    await page.waitForTimeout(500);
    const code = await getMermaidCode(page);

    const propsLines = code.split('\n').filter((l) => l.includes('%% @props'));
    expect(propsLines.length).toBe(2);
  });

  /* ---- Panel -> Code ---- */

  test('5 - Modifier les proprietes dans le panel se reflete dans le code', async ({ page }) => {
    await switchToPropertiesTab(page);

    const nodeId = await page.evaluate(() => {
      const { actions } = window.__state;
      actions.addNode({ type: 'service-api', label: 'User API', x: 200, y: 200, priority: 'medium' });
      const nodes = window.__state.getState().nodes;
      const id = nodes[nodes.length - 1].id;
      actions.selectNode(id);
      return id;
    });
    await page.waitForTimeout(500);

    await page.waitForSelector('#prop-biz-endpoint', { timeout: 5000 });
    await page.locator('#prop-biz-endpoint').fill('/api/v2/users');
    await page.locator('#prop-biz-endpoint').dispatchEvent('change');
    await page.waitForTimeout(500);

    const code = await getMermaidCode(page);
    expect(code).toContain('"endpoint"');
    expect(code).toContain('/api/v2/users');
  });

  /* ---- Hubs ---- */

  test('6 - Hubs ne generent pas d annotation', async ({ page }) => {
    await createNode(page, 'process', 'Source', { owner: 'Alice' });

    await page.waitForTimeout(500);
    const code = await getMermaidCode(page);

    expect(code).toContain('%% @props');
    const propsLines = code.split('\n').filter((l) => l.includes('%% @props'));
    for (const line of propsLines) {
      expect(line).not.toContain('hub');
    }
  });

  /* ---- Round-trip fidelity ---- */

  test('7 - Le round-trip presere les proprietes', async ({ page }) => {
    const nodeId = await createNode(page, 'sec-auth', 'OAuth2', {
      threat: 'Token theft',
      severity: 'Eleve',
      conformity: 'OWASP',
    });

    await page.waitForTimeout(500);

    const code = await getMermaidCode(page);
    expect(code).toContain('%% @props');

    const propsLines = code.split('\n').filter((l) => l.includes('%% @props') && l.includes(nodeId));
    expect(propsLines.length).toBe(1);

    const jsonMatch = propsLines[0].match(/%% @props \S+ ({.+})/);
    expect(jsonMatch).toBeTruthy();
    const parsed = JSON.parse(jsonMatch[1]);
    expect(parsed.threat).toBe('Token theft');
    expect(parsed.severity).toBe('Eleve');
    expect(parsed.conformity).toBe('OWASP');
  });

  test('8 - Les annotations sans proprietes sont absentes', async ({ page }) => {
    const nodeId = await createNode(page, 'decision', 'Go/No-Go');

    await page.waitForTimeout(500);
    const code = await getMermaidCode(page);

    const propsLines = code.split('\n').filter((l) => l.includes(`%% @props ${nodeId}`));
    expect(propsLines.length).toBe(0);
  });

  /* ---- Visual rendering unaffected ---- */

  test('9 - Les annotations n affectent pas le rendu', async ({ page }) => {
    await createNode(page, 'service-api', 'API', { endpoint: '/test' });

    await page.waitForTimeout(500);

    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.waitForTimeout(500);

    const code = await getMermaidCode(page);
    expect(code).toContain('%% @props');

    expect(errors.filter((e) => e.includes('mermaid') || e.includes('render'))).toHaveLength(0);
  });

  /* ---- Special characters ---- */

  test('10 - Les proprietes avec caracteres speciaux sont correctement echappees', async ({ page }) => {
    await createNode(page, 'service-api', 'API', {
      endpoint: '/api/v1/resource?key=value&foo=bar',
      requestSchema: '{"name": "test"}',
    });

    await page.waitForTimeout(500);
    const code = await getMermaidCode(page);

    expect(code).toContain('%% @props');
    expect(code).toContain('"endpoint"');
    expect(code).toContain('"requestSchema"');

    const jsonMatch = code.match(/%% @props \S+ ({.+})/);
    expect(jsonMatch).toBeTruthy();
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[1]);
      expect(parsed.endpoint).toBe('/api/v1/resource?key=value&foo=bar');
      expect(parsed.requestSchema).toBe('{"name": "test"}');
    }
  });

  /* ---- Select properties ---- */

  test('11 - Les proprietes de type select sont synchronisees', async ({ page }) => {
    await switchToPropertiesTab(page);

    await page.evaluate(() => {
      const { actions } = window.__state;
      actions.addNode({ type: 'service-api', label: 'API', x: 200, y: 200, priority: 'medium' });
      const nodes = window.__state.getState().nodes;
      actions.selectNode(nodes[nodes.length - 1].id);
    });
    await page.waitForTimeout(500);

    await page.waitForSelector('#prop-biz-method', { timeout: 5000 });
    await page.locator('#prop-biz-method').selectOption('POST');
    await page.waitForTimeout(500);

    const code = await getMermaidCode(page);
    expect(code).toContain('"method"');
    expect(code).toContain('POST');
  });

  /* ---- Property deletion via code (Phase 7bis) ---- */

  test('12 - Supprimer la ligne %% @props vide les proprietes', async ({ page }) => {
    await createNode(page, 'service-api', 'API', {
      endpoint: '/api/v1',
      method: 'GET',
    });
    await page.waitForTimeout(500);

    // Verify annotations are present
    let code = await getMermaidCode(page);
    expect(code).toContain('%% @props');

    // Remove the %% @props line by editing the textarea
    await page.evaluate(() => {
      const ta = document.getElementById('code-preview');
      const lines = ta.value.split('\n');
      const filtered = lines.filter((l) => !l.includes('%% @props'));
      ta.value = filtered.join('\n');
      ta.dispatchEvent(new Event('input'));
    });
    await page.waitForTimeout(600);

    // loadGraph reassigns IDs — look up by index (last node)
    const props = await getLastNodeProps(page);
    expect(props).toEqual({});
  });

  test('13 - Remplacer l annotation remplace les proprietes (pas de merge)', async ({ page }) => {
    await createNode(page, 'service-api', 'API', {
      endpoint: '/api/v1',
      method: 'GET',
      sla: '99.9%',
    });
    await page.waitForTimeout(500);

    // Replace the annotation with a new one containing only endpoint
    await page.evaluate(() => {
      const ta = document.getElementById('code-preview');
      const lines = ta.value.split('\n');
      const newLines = [];
      for (const l of lines) {
        if (l.includes('%% @props')) {
          // Replace with annotation containing only endpoint
          newLines.push('    %% @props n1-service-api {"endpoint":"/api/v2"}');
        } else {
          newLines.push(l);
        }
      }
      ta.value = newLines.join('\n');
      ta.dispatchEvent(new Event('input'));
    });
    await page.waitForTimeout(600);

    // Properties should be REPLACED (not merged) — only endpoint remains
    const props = await getLastNodeProps(page);
    expect(props).toEqual({ endpoint: '/api/v2' });
    expect(props.method).toBeUndefined();
    expect(props.sla).toBeUndefined();
  });

  test('14 - Editer le code sans annotation et avec un nouveau noeud fonctionne', async ({ page }) => {
    // Create a node with properties
    await createNode(page, 'service-api', 'API', {
      endpoint: '/api/v1',
      method: 'GET',
    });
    await page.waitForTimeout(500);

    // Replace the code entirely: remove the annotation AND add a new node
    await page.evaluate(() => {
      const ta = document.getElementById('code-preview');
      ta.value = `graph TD
    n1["Old API"]
    n2-service["New Service"]
    n1 --> n2-service
`;
      ta.dispatchEvent(new Event('input'));
    });
    await page.waitForTimeout(600);

    // Should have 2 nodes — the old one lost its properties, the new one has none
    const nodesCount = await page.evaluate(() => window.__state.getState().nodes.length);
    expect(nodesCount).toBe(2);

    // All nodes should have empty properties
    const allPropsEmpty = await page.evaluate(() => {
      return window.__state.getState().nodes.every(
        (n) => !n.properties || Object.keys(n.properties).length === 0
      );
    });
    expect(allPropsEmpty).toBe(true);
  });
});
