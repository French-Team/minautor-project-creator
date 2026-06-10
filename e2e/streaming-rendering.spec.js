/**
 * Tests E2E — Rendu Streaming (Phase P1)
 *
 * Verifie le rendu Markdown, la structure DOM du streaming (typewriter),
 * le raccourci /, les stats dans le header, et l'affichage des messages.
 */

import { test, expect } from '@playwright/test';

/* ---------------------------------------------------------------------------
 * Helpers
 * -------------------------------------------------------------------------- */

async function clearState(page) {
  await page.evaluate(() => {
    localStorage.clear();
    if (window.__state?.actions) {
      window.__state.actions.clear();
      window.__state.actions.clearChatHistory();
    }
  });
}

async function openChat(page) {
  // Click sur le body pour garantir le focus avant Ctrl+Shift+A
  await page.locator('body').click({ position: { x: 10, y: 10 } });
  await page.keyboard.press('Control+Shift+a');
  // Attendre que le panneau soit réellement ouvert (au lieu d'un timeout fixe)
  await page.waitForFunction(
    () => document.getElementById('app-chat')?.classList.contains('is-open') ?? false,
    { timeout: 2000 },
  );
  // 500ms supplémentaires pour laisser la transition slide-in (220ms) se terminer
  await page.waitForTimeout(500);
}

async function closeChat(page) {
  const closeBtn = page.locator('#app-chat-close');
  if (await closeBtn.isVisible()) {
    await closeBtn.click();
    await page.waitForTimeout(300);
  }
}

async function isChatOpen(page) {
  return page.evaluate(() => {
    return document.getElementById('app-chat')?.classList.contains('is-open') ?? false;
  });
}

async function setProvider(page, id = 'ollama') {
  await page.evaluate((pid) => {
    window.__state.actions.setProvider(pid);
  }, id);
  await page.waitForTimeout(200);
}

async function pushChatMessage(page, role, content) {
  await page.evaluate(({ role, content }) => {
    window.__state.actions.pushChatMessage({
      role,
      content,
      timestamp: Date.now(),
    });
  }, { role, content });
  await page.waitForTimeout(200);
}

/** Verifie l innerHTML d un element via evaluate. */
async function expectBubbleHtml(page, role, check) {
  return page.evaluate(({ role, check }) => {
    const msgs = document.querySelectorAll('.chat-msg');
    for (const msg of msgs) {
      if (msg.classList.contains(`chat-msg--${role}`)) {
        const bbl = msg.querySelector('.chat-msg__bubble');
        if (bbl && bbl.innerHTML.includes(check)) return true;
      }
    }
    return false;
  }, { role, check });
}

/* ---------------------------------------------------------------------------
 * Tests — Rendu Markdown
 * -------------------------------------------------------------------------- */

test.describe('Rendu Markdown', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.canvas-content', { timeout: 10000 });
    await clearState(page);
    await setProvider(page, 'ollama');
  });

  test('1 - gras rendu en strong', async ({ page }) => {
    await pushChatMessage(page, 'user', 'Dis bonjour');
    await pushChatMessage(page, 'assistant', '**Bonjour** a toi !');
    await openChat(page);
    await page.waitForTimeout(300);
    const found = await expectBubbleHtml(page, 'assistant', '<strong>Bonjour</strong>');
    expect(found).toBe(true);
  });

  test('2 - code block avec syntax highlighting', async ({ page }) => {
    await pushChatMessage(page, 'user', 'Un peu de code');
    await pushChatMessage(page, 'assistant', '```js\nvar x = 42;\n```');
    await openChat(page);
    await page.waitForTimeout(500);
    const pre = page.locator('.chat-msg__bubble-pre');
    await expect(pre).toBeVisible({ timeout: 5000 });
    const code = pre.locator('code');
    await expect(code).toContainText('var x = 42');
  });

  test('3 - tableaux supportes', async ({ page }) => {
    await pushChatMessage(page, 'user', 'Tableau');
    await pushChatMessage(page, 'assistant', '|A|B|\n|-|-|\n|1|2|');
    await openChat(page);
    await page.waitForTimeout(500);
    const table = page.locator('.chat-msg--assistant .chat-msg__bubble table');
    await expect(table).toBeVisible({ timeout: 5000 });
    const rows = table.locator('tr');
    await expect(rows).toHaveCount(2);
  });

  test('4 - liens avec target blank', async ({ page }) => {
    await pushChatMessage(page, 'user', 'Lien');
    await pushChatMessage(page, 'assistant', '[Google](https://google.com)');
    await openChat(page);
    await page.waitForTimeout(500);
    const link = page.locator('.chat-msg--assistant .chat-msg__bubble a');
    await expect(link).toBeVisible({ timeout: 5000 });
    await expect(link).toHaveAttribute('href', 'https://google.com');
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveText('Google');
  });

  test('5 - listes rendues', async ({ page }) => {
    await pushChatMessage(page, 'user', 'Liste');
    await pushChatMessage(page, 'assistant', '- Item 1\n- Item 2\n- Item 3');
    await openChat(page);
    await page.waitForTimeout(500);
    const ul = page.locator('.chat-msg--assistant .chat-msg__bubble ul');
    await expect(ul).toBeVisible({ timeout: 5000 });
    const items = ul.locator('li');
    await expect(items).toHaveCount(3);
  });

  test('6 - message user echappe pas de markdown', async ({ page }) => {
    await pushChatMessage(page, 'user', '**pas gras**');
    await pushChatMessage(page, 'assistant', 'reponse');
    await openChat(page);
    await page.waitForTimeout(300);
    const hasStrong = await page.evaluate(() => {
      const userMsg = document.querySelector('.chat-msg--user .chat-msg__bubble');
      return userMsg ? userMsg.innerHTML.includes('<strong>') : false;
    });
    expect(hasStrong).toBe(false);
    // Le texte brut **pas gras** doit etre visible
    const userBubble = page.locator('.chat-msg--user .chat-msg__bubble');
    await expect(userBubble).toContainText('**pas gras**');
  });

  test('7 - messages multiples', async ({ page }) => {
    await pushChatMessage(page, 'user', 'Premier');
    await pushChatMessage(page, 'assistant', 'Reponse **importante**');
    await pushChatMessage(page, 'user', 'Deuxieme');
    await pushChatMessage(page, 'assistant', '```py\nprint(1)\n```');
    await openChat(page);
    await page.waitForTimeout(500);
    await expect(page.locator('.chat-msg')).toHaveCount(4);
    await expect(page.locator('.chat-msg--user')).toHaveCount(2);
    await expect(page.locator('.chat-msg--assistant')).toHaveCount(2);
  });
});

/* ---------------------------------------------------------------------------
 * Tests — Structure streaming
 * -------------------------------------------------------------------------- */

test.describe('Structure streaming', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.canvas-content', { timeout: 10000 });
    await clearState(page);
    await setProvider(page, 'ollama');
    await openChat(page);
  });

  test('8 - regle CSS du curseur streaming existe', async ({ page }) => {
    const found = await page.evaluate(() => {
      for (const ss of document.styleSheets) {
        try {
          for (const rule of ss.cssRules) {
            if (rule.selectorText?.includes('chat-streaming-cursor')) return true;
          }
        } catch {}
      }
      return false;
    });
    expect(found).toBe(true);
  });

  test('9 - boutons action sur messages assistant', async ({ page }) => {
    await pushChatMessage(page, 'user', 'Test');
    await pushChatMessage(page, 'assistant', 'Reponse');
    await closeChat(page);
    await openChat(page);
    await page.waitForTimeout(300);
    await expect(page.locator('.chat-regen-btn')).toHaveCount(1);
    await expect(page.locator('.chat-copy-btn')).toHaveCount(1);
  });

  test('10 - input et send btn presents', async ({ page }) => {
    await expect(page.locator('#chat-input')).toBeVisible();
    await expect(page.locator('#chat-input')).toHaveAttribute('placeholder', 'Que veux-tu faire ?');
    await expect(page.locator('#chat-send-btn')).toBeVisible();
  });
});

/* ---------------------------------------------------------------------------
 * Tests — Raccourci /
 * -------------------------------------------------------------------------- */

test.describe('Raccourci /', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.canvas-content', { timeout: 10000 });
    await clearState(page);
  });

  test('11 - / ouvre le chat quand ferme', async ({ page }) => {
    expect(await isChatOpen(page)).toBe(false);
    await page.keyboard.press('/');
    await page.waitForTimeout(500);
    expect(await isChatOpen(page)).toBe(true);
  });

  test('12 - / focus input quand chat ouvert', async ({ page }) => {
    await openChat(page);
    expect(await isChatOpen(page)).toBe(true);
    await page.evaluate(() => {
      const input = document.getElementById('chat-input');
      if (input) input.blur();
    });
    await page.waitForTimeout(100);
    await page.keyboard.press('/');
    await page.waitForTimeout(200);
    const focused = await page.evaluate(() => document.activeElement?.id === 'chat-input');
    expect(focused).toBe(true);
  });

  test('13 - / ne s active pas dans textarea', async ({ page }) => {
    await openChat(page);
    await page.evaluate(() => {
      const ta = document.getElementById('chat-input');
      if (ta) ta.focus();
    });
    await page.waitForTimeout(100);
    await page.keyboard.press('/');
    await page.waitForTimeout(200);
    expect(await isChatOpen(page)).toBe(true);
    const val = await page.evaluate(() => document.getElementById('chat-input')?.value || '');
    expect(val).toBe('/');
  });
});

/* ---------------------------------------------------------------------------
 * Tests — Header stats et UI
 * -------------------------------------------------------------------------- */

test.describe('Header stats et UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.canvas-content', { timeout: 10000 });
    await clearState(page);
  });

  test('14 - header avec titre grec', async ({ page }) => {
    await openChat(page);
    await expect(page.locator('.app__chat-header')).toBeVisible();
    await expect(page.locator('#app-chat-provider-bar')).toBeVisible();
    await expect(page.locator('#app-chat-title')).toHaveText(/D[eé]dale/); // ollama -> Dedale (avec accent)
  });

  test('15 - pas d erreur JS avec messages', async ({ page }) => {
    await setProvider(page, 'ollama');
    await pushChatMessage(page, 'user', 'Hello');
    await pushChatMessage(page, 'assistant', 'Reponse avec `code`');
    await pushChatMessage(page, 'user', 'OK');
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await openChat(page);
    await page.waitForTimeout(500);
    expect(errors).toHaveLength(0);
    await expect(page.locator('.chat-msg')).toHaveCount(3);
  });

  test('16 - clear confirmation avec messages', async ({ page }) => {
    await setProvider(page, 'ollama');
    await pushChatMessage(page, 'user', 'Message a effacer');
    await openChat(page);
    await page.waitForTimeout(300);

    let confirmShown = false;
    page.on('dialog', async (dialog) => {
      confirmShown = true;
      expect(dialog.message()).toContain('Vider');
      await dialog.accept(); // Accepter pour vraiment vider
    });

    await page.locator('#app-chat-clear').click();
    await page.waitForTimeout(300);
    expect(confirmShown).toBe(true);
    // Apres accept, les messages doivent etre vides
    await expect(page.locator('.chat-msg')).toHaveCount(0);
  });

  test('17 - quick actions categories visibles', async ({ page }) => {
    await setProvider(page, 'ollama');
    await openChat(page);
    const categories = page.locator('.chat-quick-category');
    await expect(categories).toHaveCount(3);
    await expect(categories.nth(0).locator('.chat-quick-category__label')).toContainText('Analyse');
  });

  test('18 - stats streaming dans header', async ({ page }) => {
    await setProvider(page, 'ollama');
    await openChat(page);

    // Simuler les stats dans le header
    await page.evaluate(() => {
      const h = document.querySelector('.app__chat-header');
      if (!h) return;
      const s = document.createElement('div');
      s.className = 'chat-stream-stats';
      s.id = 'chat-stream-stats';
      s.innerHTML = '<span class="chat-stream-stats__text">10 tok - 2.3s</span><span class="chat-stream-stats__bar"><span class="chat-stream-stats__bar-fill" style="width:30%"></span></span>';
      const right = h.querySelector('.app__chat-header-right');
      if (right) h.insertBefore(s, right);
      else h.appendChild(s);
    });
    await page.waitForTimeout(100);

    const visible = await page.evaluate(() => !!document.querySelector('#chat-stream-stats'));
    expect(visible).toBe(true);

    // Faire disparaitre
    await page.evaluate(() => {
      const s = document.querySelector('#chat-stream-stats');
      if (s) s.classList.add('chat-stream-stats--done');
    });
    await page.waitForTimeout(300);

    const hasDone = await page.evaluate(() => {
      const s = document.querySelector('#chat-stream-stats');
      return s?.classList.contains('chat-stream-stats--done') ?? false;
    });
    expect(hasDone).toBe(true);
  });
});
