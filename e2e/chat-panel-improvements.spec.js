/**
 * Tests E2E — Améliorations du panneau chat (Sprint 1 rattrapage-spec)
 *
 * Couvre les 3 items P2 de chat-panel-improvements-spec :
 *   1) Bouton « Modifier » apparaît au hover sur les messages user
 *   2) Clic sur « Modifier » tronque l'historique + DOM (cascade)
 *   3) Transitions slide-in / slide-out du panneau chat
 *
 * Conformément à rattrapage-spec.md (Sprint 1).
 */

import { test, expect } from '@playwright/test';

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------ */

async function clearState(page) {
  await page.evaluate(() => {
    localStorage.clear();
    if (window.__state?.actions) {
      window.__state.actions.clear();
      window.__state.actions.clearChatHistory();
    }
  });
}

async function setProvider(page, id = 'ollama') {
  await page.evaluate((pid) => {
    window.__state.actions.setProvider(pid);
  }, id);
  await page.waitForTimeout(200);
}

async function pushChatMessage(page, role, content, timestamp) {
  await page.evaluate(({ role, content, timestamp }) => {
    window.__state.actions.pushChatMessage({
      role,
      content,
      timestamp: timestamp ?? Date.now(),
    });
  }, { role, content, timestamp });
  await page.waitForTimeout(150);
}

async function openChat(page) {
  // Click sur le body pour s'assurer qu'un élément a le focus (sinon Ctrl+Shift+A peut être ignoré)
  await page.locator('body').click({ position: { x: 10, y: 10 } });
  await page.keyboard.press('Control+Shift+a');
  // Attendre que le panneau soit réellement ouvert (jusqu'à 2s)
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

async function seedChatHistory(page, messages) {
  // Vide puis repeuple avec un set connu
  await page.evaluate(() => {
    window.__state.actions.clearChatHistory();
  });
  for (const m of messages) {
    await pushChatMessage(page, m.role, m.content, m.timestamp);
  }
}

/* ---------------------------------------------------------------------------
 * Tests — Bouton Modifier : apparition au hover
 * ------------------------------------------------------------------------ */

test.describe('Bouton Modifier — apparition au hover (Item 2.1)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.canvas-content', { timeout: 10000 });
    await clearState(page);
    await setProvider(page, 'ollama');
    await seedChatHistory(page, [
      { role: 'user', content: 'msg1', timestamp: 1000 },
      { role: 'assistant', content: 'rep1', timestamp: 1100 },
    ]);
    await openChat(page);
  });

  test('1 - un bouton edit-btn est rendu pour chaque message user', async ({ page }) => {
    const editBtns = page.locator('.chat-msg--user .chat-msg__edit-btn');
    await expect(editBtns).toHaveCount(1);
    // aria-label présent
    await expect(editBtns.first()).toHaveAttribute('aria-label', 'Modifier ce message');
    // data-action présent
    await expect(editBtns.first()).toHaveAttribute('data-action', 'edit-message');
  });

  test('2 - un message assistant n a PAS de bouton edit-btn', async ({ page }) => {
    const assistantEdits = page.locator('.chat-msg--assistant .chat-msg__edit-btn');
    await expect(assistantEdits).toHaveCount(0);
  });

  test('3 - le bouton edit-btn contient une icone SVG', async ({ page }) => {
    const editBtn = page.locator('.chat-msg--user .chat-msg__edit-btn').first();
    const svg = editBtn.locator('svg');
    await expect(svg).toBeVisible();
  });

  test('4 - par defaut le conteneur d actions est invisible (opacity 0)', async ({ page }) => {
    // Déplacer la souris hors de la zone des messages pour éviter tout hover résiduel
    await page.mouse.move(0, 0);
    await page.waitForTimeout(100);

    const opacity = await page.evaluate(() => {
      const actionsDiv = document.querySelector('.chat-msg--user .chat-msg__actions');
      if (!actionsDiv) return null;
      return getComputedStyle(actionsDiv).opacity;
    });
    expect(opacity).toBe('0');
  });

  test('5 - le hover rend le conteneur d actions visible (opacity 1)', async ({ page }) => {
    const userMsg = page.locator('.chat-msg--user').first();
    await userMsg.hover();
    await page.waitForTimeout(200); // laisse la transition (150ms) se terminer

    const opacity = await page.evaluate(() => {
      const actionsDiv = document.querySelector('.chat-msg--user .chat-msg__actions');
      if (!actionsDiv) return null;
      return getComputedStyle(actionsDiv).opacity;
    });
    expect(opacity).toBe('1');
  });

  test('6 - le focus clavier (focus-within) rend aussi les actions visibles', async ({ page }) => {
    // Focus le bouton edit-btn (tabindex/click simule focus-within)
    const editBtn = page.locator('.chat-msg--user .chat-msg__edit-btn').first();
    await editBtn.focus();
    await page.waitForTimeout(200);

    const opacity = await page.evaluate(() => {
      const actionsDiv = document.querySelector('.chat-msg--user .chat-msg__actions');
      if (!actionsDiv) return null;
      return getComputedStyle(actionsDiv).opacity;
    });
    expect(opacity).toBe('1');
  });
});

/* ---------------------------------------------------------------------------
 * Tests — Bouton Modifier : clic qui tronque l historique
 * ------------------------------------------------------------------------ */

test.describe('Bouton Modifier — clic qui tronque l historique (Item 2.1)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.canvas-content', { timeout: 10000 });
    await clearState(page);
    await setProvider(page, 'ollama');
  });

  test('7 - clic sur edit du 1er message tronque tout l historique', async ({ page }) => {
    await seedChatHistory(page, [
      { role: 'user', content: 'A modifier', timestamp: 1000 },
      { role: 'assistant', content: 'réponse 1', timestamp: 1100 },
      { role: 'user', content: 'suivant', timestamp: 2000 },
      { role: 'assistant', content: 'réponse 2', timestamp: 2100 },
    ]);
    await openChat(page);

    // Avant : 4 messages
    await expect(page.locator('.chat-msg')).toHaveCount(4);
    let historyLength = await page.evaluate(
      () => window.__state.getState().assistant.chatHistory.length,
    );
    expect(historyLength).toBe(4);

    // Clic sur edit du 1er user
    await page.locator('.chat-msg--user .chat-msg__edit-btn').first().click();
    await page.waitForTimeout(200);

    // Après : 0 messages (tout tronqué)
    historyLength = await page.evaluate(
      () => window.__state.getState().assistant.chatHistory.length,
    );
    expect(historyLength).toBe(0);
  });

  test('8 - clic sur edit du 2e user tronque user + assistant suivant (cascade)', async ({ page }) => {
    await seedChatHistory(page, [
      { role: 'user', content: 'msg1', timestamp: 1000 },
      { role: 'assistant', content: 'rep1', timestamp: 1100 },
      { role: 'user', content: 'msg2 a editer', timestamp: 2000 },
      { role: 'assistant', content: 'rep2', timestamp: 2100 },
      { role: 'user', content: 'msg3', timestamp: 3000 },
    ]);
    await openChat(page);

    // Avant : 5 messages
    await expect(page.locator('.chat-msg')).toHaveCount(5);

    // Clic sur le 2e edit-btn (msg2)
    await page.locator('.chat-msg--user .chat-msg__edit-btn').nth(1).click();
    await page.waitForTimeout(200);

    // Après : 2 messages (msg1 + rep1)
    const history = await page.evaluate(
      () => window.__state.getState().assistant.chatHistory,
    );
    expect(history).toHaveLength(2);
    expect(history[0].content).toBe('msg1');
    expect(history[1].content).toBe('rep1');
  });

  test('9 - le textarea est rempli avec le contenu du message edite', async ({ page }) => {
    await seedChatHistory(page, [
      { role: 'user', content: 'Bonjour Mina, peux-tu m aider ?', timestamp: 1000 },
      { role: 'assistant', content: 'Bien sûr', timestamp: 1100 },
    ]);
    await openChat(page);

    await page.locator('.chat-msg--user .chat-msg__edit-btn').first().click();
    await page.waitForTimeout(200);

    const value = await page.locator('#chat-input').inputValue();
    expect(value).toBe('Bonjour Mina, peux-tu m aider ?');
  });

  test('10 - le textarea est focus apres edition', async ({ page }) => {
    await seedChatHistory(page, [
      { role: 'user', content: 'Test focus', timestamp: 1000 },
    ]);
    await openChat(page);

    // Blur le textarea d'abord
    await page.evaluate(() => {
      const ta = document.getElementById('chat-input');
      if (ta) ta.blur();
    });
    await page.waitForTimeout(100);

    await page.locator('.chat-msg--user .chat-msg__edit-btn').first().click();
    await page.waitForTimeout(200);

    const isFocused = await page.evaluate(
      () => document.activeElement?.id === 'chat-input',
    );
    expect(isFocused).toBe(true);
  });

  test('11 - les bulles du DOM apres le message edite sont retirees', async ({ page }) => {
    await seedChatHistory(page, [
      { role: 'user', content: 'msg1', timestamp: 1000 },
      { role: 'assistant', content: 'rep1', timestamp: 1100 },
      { role: 'user', content: 'msg2', timestamp: 2000 },
      { role: 'assistant', content: 'rep2', timestamp: 2100 },
    ]);
    await openChat(page);

    // Avant : 4 messages
    await expect(page.locator('.chat-msg')).toHaveCount(4);

    // Clic sur edit du 1er user → supprime 4 bulles du DOM
    await page.locator('.chat-msg--user .chat-msg__edit-btn').first().click();
    await page.waitForTimeout(200);

    // Après : 0 bulles
    await expect(page.locator('.chat-msg')).toHaveCount(0);
  });

  test('12 - le bouton edit est inaccessible si pas de messages user', async ({ page }) => {
    await seedChatHistory(page, [
      { role: 'assistant', content: 'seul assistant', timestamp: 1000 },
    ]);
    await openChat(page);

    const editBtns = page.locator('.chat-msg__edit-btn');
    await expect(editBtns).toHaveCount(0);
  });

  test('13 - re-render apres edition : le state est synchro', async ({ page }) => {
    await seedChatHistory(page, [
      { role: 'user', content: 'A', timestamp: 1000 },
      { role: 'assistant', content: 'a', timestamp: 1100 },
      { role: 'user', content: 'B', timestamp: 2000 },
    ]);
    await openChat(page);

    // Éditer B → doit rester A + a
    await page.locator('.chat-msg--user .chat-msg__edit-btn').nth(1).click();
    await page.waitForTimeout(200);

    // Vérifier l'état réel
    const state = await page.evaluate(() => {
      const s = window.__state.getState();
      return s.assistant.chatHistory.map((m) => ({ role: m.role, content: m.content }));
    });
    expect(state).toEqual([
      { role: 'user', content: 'A' },
      { role: 'assistant', content: 'a' },
    ]);

    // Vérifier que le textarea est bien rempli avec B
    const inputValue = await page.locator('#chat-input').inputValue();
    expect(inputValue).toBe('B');
  });
});

/* ---------------------------------------------------------------------------
 * Tests — Transitions slide-in / slide-out du panneau (Item 2.2)
 * ------------------------------------------------------------------------ */

test.describe('Panneau chat — transitions slide-in / slide-out (Item 2.2)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.canvas-content', { timeout: 10000 });
    await clearState(page);
  });

  test('14 - le panneau est ferme au demarrage (is-open absent)', async ({ page }) => {
    const isOpen = await page.evaluate(() => {
      return document.getElementById('app-chat')?.classList.contains('is-open') ?? false;
    });
    expect(isOpen).toBe(false);
  });

  test('15 - la regle CSS .app__chat-panel a une transition sur transform', async ({ page }) => {
    const transition = await page.evaluate(() => {
      const panel = document.querySelector('.app__chat-panel');
      if (!panel) return null;
      return getComputedStyle(panel).transitionProperty;
    });
    // La transition doit inclure transform
    expect(transition).toContain('transform');
  });

  test('16 - le panneau a transform translateX(100%) quand ferme', async ({ page }) => {
    // Vérifier l'état initial avant ouverture
    const transform = await page.evaluate(() => {
      const panel = document.querySelector('.app__chat-panel');
      if (!panel) return null;
      return getComputedStyle(panel).transform;
    });
    // En jsdom/chromium, translateX(100%) = matrix(1, 0, 0, 1, X, 0)
    // On vérifie juste que la transformation n est PAS l identite
    // (le panneau est poussé hors écran à droite)
    expect(transform).not.toBe('none');
    expect(transform).not.toBe('matrix(1, 0, 0, 1, 0, 0)');
  });

  test('17 - ouverture : la classe is-open est ajoutee et le panneau se positionne a translateX(0)', async ({ page }) => {
    // Avant : pas is-open
    expect(await isChatOpen(page)).toBe(false);

    // Ouvre
    await openChat(page);

    // Apres : is-open present
    expect(await isChatOpen(page)).toBe(true);

    // Le transform doit être l'identité (translateX(0))
    const transform = await page.evaluate(() => {
      const panel = document.querySelector('.app__chat-panel');
      if (!panel) return null;
      return getComputedStyle(panel).transform;
    });
    expect(transform).toBe('matrix(1, 0, 0, 1, 0, 0)');
  });

  test('18 - fermeture : la classe is-open est retiree et le panneau se repositionne', async ({ page }) => {
    // Ouvre
    await openChat(page);
    expect(await isChatOpen(page)).toBe(true);

    // Ferme
    await closeChat(page);

    expect(await isChatOpen(page)).toBe(false);

    // Le transform doit être non-identité (panneau repoussé)
    const transform = await page.evaluate(() => {
      const panel = document.querySelector('.app__chat-panel');
      if (!panel) return null;
      return getComputedStyle(panel).transform;
    });
    expect(transform).not.toBe('matrix(1, 0, 0, 1, 0, 0)');
  });

  test('19 - la regle CSS .app__chat-backdrop a une transition sur opacity', async ({ page }) => {
    const transition = await page.evaluate(() => {
      const bd = document.querySelector('.app__chat-backdrop');
      if (!bd) return null;
      return getComputedStyle(bd).transitionProperty;
    });
    expect(transition).toContain('opacity');
  });

  test('20 - le backdrop est a opacity 0 quand ferme', async ({ page }) => {
    const opacity = await page.evaluate(() => {
      const bd = document.querySelector('.app__chat-backdrop');
      if (!bd) return null;
      return getComputedStyle(bd).opacity;
    });
    expect(opacity).toBe('0');
  });

  test('21 - le backdrop est a opacity 1 quand ouvert', async ({ page }) => {
    await openChat(page);
    await page.waitForTimeout(300); // transition 180ms

    const opacity = await page.evaluate(() => {
      const bd = document.querySelector('.app__chat-backdrop');
      if (!bd) return null;
      return getComputedStyle(bd).opacity;
    });
    expect(opacity).toBe('1');
  });

  test('22 - le backdrop est clickable quand ouvert (pointer-events: auto)', async ({ page }) => {
    await openChat(page);
    await page.waitForTimeout(300);

    const pointerEvents = await page.evaluate(() => {
      const bd = document.querySelector('.app__chat-backdrop');
      if (!bd) return null;
      return getComputedStyle(bd).pointerEvents;
    });
    expect(pointerEvents).toBe('auto');
  });

  test('23 - le backdrop est non-clickable quand ferme (pointer-events: none)', async ({ page }) => {
    const pointerEvents = await page.evaluate(() => {
      const bd = document.querySelector('.app__chat-backdrop');
      if (!bd) return null;
      return getComputedStyle(bd).pointerEvents;
    });
    expect(pointerEvents).toBe('none');
  });

  test('24 - clic sur le backdrop ferme le panneau', async ({ page }) => {
    await openChat(page);
    expect(await isChatOpen(page)).toBe(true);

    // Clic sur le backdrop
    await page.locator('#app-chat-backdrop').click({ position: { x: 100, y: 100 } });
    await page.waitForTimeout(400);

    expect(await isChatOpen(page)).toBe(false);
  });

  test('25 - le panneau a will-change: transform (optimisation GPU)', async ({ page }) => {
    const willChange = await page.evaluate(() => {
      const panel = document.querySelector('.app__chat-panel');
      if (!panel) return null;
      return getComputedStyle(panel).willChange;
    });
    expect(willChange).toBe('transform');
  });
});

/* ---------------------------------------------------------------------------
 * Tests — Sanity : pas de regression sur les fonctionnalités existantes
 * ------------------------------------------------------------------------ */

test.describe('Panneau chat — sanity (pas de regression)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.canvas-content', { timeout: 10000 });
    await clearState(page);
    await setProvider(page, 'ollama');
  });

  test('26 - editer puis envoyer ne cree pas d erreur JS', async ({ page }) => {
    await seedChatHistory(page, [
      { role: 'user', content: 'premier', timestamp: 1000 },
      { role: 'assistant', content: 'reponse', timestamp: 1100 },
    ]);
    await openChat(page);

    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));

    // Éditer le 1er user
    await page.locator('.chat-msg--user .chat-msg__edit-btn').first().click();
    await page.waitForTimeout(200);

    // Modifier le texte
    await page.locator('#chat-input').fill('deuxieme version');

    // Envoyer (Enter)
    await page.locator('#chat-input').press('Enter');
    await page.waitForTimeout(300);

    expect(errors).toHaveLength(0);
  });

  test('27 - editer n affecte pas l etat de l assistant provider', async ({ page }) => {
    await seedChatHistory(page, [
      { role: 'user', content: 'test', timestamp: 1000 },
    ]);
    await openChat(page);

    const providerBefore = await page.evaluate(
      () => window.__state.getState().assistant.provider.id,
    );

    await page.locator('.chat-msg--user .chat-msg__edit-btn').first().click();
    await page.waitForTimeout(200);

    const providerAfter = await page.evaluate(
      () => window.__state.getState().assistant.provider.id,
    );
    expect(providerAfter).toBe(providerBefore);
  });

  test('28 - les boutons regenerate / copy sur les messages assistant fonctionnent toujours', async ({ page }) => {
    await seedChatHistory(page, [
      { role: 'user', content: 'Test', timestamp: 1000 },
      { role: 'assistant', content: 'Réponse', timestamp: 1100 },
    ]);
    await openChat(page);

    await expect(page.locator('.chat-regen-btn')).toHaveCount(1);
    await expect(page.locator('.chat-copy-btn')).toHaveCount(1);
  });
});

/* ---------------------------------------------------------------------------
 * Tests — Streaming en cours bloque l édition
 *
 * Couvre l'item manquant des unitaires : « annulation si streaming ».
 * isThinking est une variable module-level privée dans chatPanel.js,
 * donc on ne peut pas la mocker depuis l'extérieur. On l'observe ici
 * via l'indicateur DOM #chat-typing (qui passe à display:flex quand
 * isThinking=true) et via le comportement fonctionnel (history préservée).
 * ------------------------------------------------------------------------ */

test.describe('Bouton Modifier — bloque pendant un streaming en cours', () => {
  test.beforeEach(async ({ page }) => {
    // Mock global fetch AVANT que la page ne charge : pour le endpoint de streaming,
    // retourner une Promise qui ne se résout JAMAIS (= simule un streaming infini).
    // Quand le test se termine, la page est fermée et la promise est GC-ée proprement.
    await page.addInitScript(() => {
      const originalFetch = window.fetch.bind(window);
      window.fetch = function (url, options) {
        const urlStr = typeof url === 'string' ? url : url.url;
        // Cibler UNIQUEMENT l'endpoint chat completions (pas /models ni autres)
        if (urlStr && urlStr.includes('/local-api/ollama') && urlStr.includes('chat/completions')) {
          // Ne jamais résoudre, mais respecter l'AbortController pour le test 33
          return new Promise((resolve, reject) => {
            if (options && options.signal) {
              if (options.signal.aborted) {
                const err = new Error('aborted');
                err.name = 'AbortError';
                reject(err);
                return;
              }
              options.signal.addEventListener('abort', () => {
                const err = new Error('aborted');
                err.name = 'AbortError';
                reject(err);
              });
            }
            // Pas de resolve : le streaming reste indéfini
          });
        }
        return originalFetch(url, options);
      };
    });

    await page.goto('/');
    await page.waitForSelector('.canvas-content', { timeout: 10000 });
    await clearState(page);
    await setProvider(page, 'ollama');
    await seedChatHistory(page, [
      { role: 'user', content: 'premier message', timestamp: 1000 },
      { role: 'assistant', content: 'réponse 1', timestamp: 1100 },
      { role: 'user', content: 'deuxième message', timestamp: 2000 },
      { role: 'assistant', content: 'réponse 2', timestamp: 2100 },
    ]);
  });

  test('29 - clic sur edit pendant streaming ne tronque PAS l historique', async ({ page }) => {
    await openChat(page);

    // État initial : 4 messages
    const before = await page.evaluate(
      () => window.__state.getState().assistant.chatHistory.length,
    );
    expect(before).toBe(4);

    // Déclencher un streaming en envoyant un nouveau message
    await page.locator('#chat-input').fill('question en cours de streaming');
    await page.locator('#chat-input').press('Enter');

    // Attendre que l'indicateur « Mina réfléchit... » apparaisse (= isThinking=true)
    await page.waitForFunction(
      () => {
        const el = document.getElementById('chat-typing');
        return el && getComputedStyle(el).display !== 'none';
      },
      { timeout: 3000 },
    );

    // Vérifier que l'historique a maintenant 5 messages (le user vient d'être push)
    const afterStreamStart = await page.evaluate(
      () => window.__state.getState().assistant.chatHistory.length,
    );
    expect(afterStreamStart).toBe(5);

    // Cliquer sur l'edit-btn du 1er user (« premier message »)
    await page.locator('.chat-msg--user .chat-msg__edit-btn').first().click();
    await page.waitForTimeout(400);

    // L'historique NE DOIT PAS avoir été tronqué (toujours 5 messages)
    const afterEdit = await page.evaluate(
      () => window.__state.getState().assistant.chatHistory.length,
    );
    expect(afterEdit).toBe(5);

    // Le contenu du 1er message n'a pas changé
    const firstMsg = await page.evaluate(
      () => window.__state.getState().assistant.chatHistory[0],
    );
    expect(firstMsg.content).toBe('premier message');
  });

  test('30 - clic sur edit pendant streaming ne remplit PAS le textarea', async ({ page }) => {
    await openChat(page);

    // Déclencher le streaming
    await page.locator('#chat-input').fill('streaming');
    await page.locator('#chat-input').press('Enter');
    await page.waitForFunction(
      () => {
        const el = document.getElementById('chat-typing');
        return el && getComputedStyle(el).display !== 'none';
      },
      { timeout: 3000 },
    );

    // Le textarea a été vidé après l'envoi du message
    const beforeClick = await page.locator('#chat-input').inputValue();
    expect(beforeClick).toBe('');

    // Cliquer sur edit du 1er user
    await page.locator('.chat-msg--user .chat-msg__edit-btn').first().click();
    await page.waitForTimeout(400);

    // Le textarea doit TOUJOURS être vide (pas rempli avec 'premier message')
    const afterClick = await page.locator('#chat-input').inputValue();
    expect(afterClick).toBe('');
  });

  test('31 - un toast warning est affiche quand on essaie d editer pendant streaming', async ({ page }) => {
    await openChat(page);

    // Déclencher le streaming
    await page.locator('#chat-input').fill('streaming');
    await page.locator('#chat-input').press('Enter');
    await page.waitForFunction(
      () => {
        const el = document.getElementById('chat-typing');
        return el && getComputedStyle(el).display !== 'none';
      },
      { timeout: 3000 },
    );

    // Cliquer sur edit
    await page.locator('.chat-msg--user .chat-msg__edit-btn').first().click();
    await page.waitForTimeout(500);

    // Vérifier qu'un toast warning a été ajouté au DOM
    const toastInfo = await page.evaluate(() => {
      const container = document.querySelector('.toast-container');
      if (!container) return null;
      const toasts = container.querySelectorAll('.toast--warning');
      if (toasts.length === 0) return null;
      const last = toasts[toasts.length - 1];
      return {
        text: last.textContent || '',
        classes: last.className,
      };
    });

    expect(toastInfo).not.toBeNull();
    expect(toastInfo.classes).toContain('toast--warning');
    // Le message doit indiquer qu'une réponse est en cours
    expect(toastInfo.text.toLowerCase()).toContain('en cours');
  });

  test('32 - le DOM des messages n est pas modifie par un edit bloque', async ({ page }) => {
    await openChat(page);

    // État DOM initial : 4 bulles
    await expect(page.locator('.chat-msg')).toHaveCount(4);

    // Déclencher streaming
    await page.locator('#chat-input').fill('streaming');
    await page.locator('#chat-input').press('Enter');
    await page.waitForFunction(
      () => {
        const el = document.getElementById('chat-typing');
        return el && getComputedStyle(el).display !== 'none';
      },
      { timeout: 3000 },
    );

    // DOM après envoi : 5 bulles (4 + le nouveau user)
    await expect(page.locator('.chat-msg')).toHaveCount(5);

    // Cliquer sur edit du 1er user
    await page.locator('.chat-msg--user .chat-msg__edit-btn').first().click();
    await page.waitForTimeout(400);

    // Le DOM doit toujours avoir 5 bulles (aucune supprimée)
    await expect(page.locator('.chat-msg')).toHaveCount(5);

    // La 1ère bulle doit toujours contenir « premier message »
    const firstBubble = await page.locator('.chat-msg--user .chat-msg__bubble').first().textContent();
    expect(firstBubble).toBe('premier message');
  });

  test('33 - apres arret du streaming, l edition redevient possible', async ({ page }) => {
    await openChat(page);

    // Déclencher streaming
    await page.locator('#chat-input').fill('streaming');
    await page.locator('#chat-input').press('Enter');
    await page.waitForFunction(
      () => {
        const el = document.getElementById('chat-typing');
        return el && getComputedStyle(el).display !== 'none';
      },
      { timeout: 3000 },
    );

    // Cliquer sur le bouton Stop (qui appelle streamAbortController.abort())
    const stopBtn = page.locator('#chat-stop-btn');
    if (await stopBtn.isVisible()) {
      await stopBtn.click();
    }
    // Attendre que l'indicateur disparaisse
    await page.waitForFunction(
      () => {
        const el = document.getElementById('chat-typing');
        return !el || getComputedStyle(el).display === 'none';
      },
      { timeout: 3000 },
    );

    // Maintenant isThinking=false. Cliquer sur edit doit fonctionner.
    await page.locator('.chat-msg--user .chat-msg__edit-btn').first().click();
    await page.waitForTimeout(400);

    // Le textarea doit être rempli avec « premier message »
    const inputValue = await page.locator('#chat-input').inputValue();
    expect(inputValue).toBe('premier message');
  });
});
