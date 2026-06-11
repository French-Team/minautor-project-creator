/**
 * Spec debug temporaire — Diagnostique le timeout de test 4 openrouter
 * Capture : console, pageerror, request, response, requestfailed, DOM mutations
 * À supprimer après diagnostic.
 */
import { test } from '@playwright/test';
import { setupProvider, openChatRobust, skipIfNoKey } from '../helpers/providerTest.js';

test('openrouter test 4 — trace timeout diagnostic', async ({ page }) => {
  skipIfNoKey(test, 'openrouter');

  const consoleMsgs = [];
  const requestFailed = [];
  const responses = [];
  const requestUrls = [];

  page.on('console', (msg) => {
    consoleMsgs.push({ type: msg.type(), text: msg.text().slice(0, 300) });
  });
  page.on('pageerror', (err) => {
    consoleMsgs.push({ type: 'pageerror', text: err.message.slice(0, 300) });
  });
  page.on('request', (req) => {
    const url = req.url();
    if (url.includes('openrouter') || url.includes('local-api')) {
      requestUrls.push({ method: req.method(), url: url.slice(0, 200) });
    }
  });
  page.on('response', async (resp) => {
    const url = resp.url();
    if (url.includes('openrouter') || url.includes('local-api')) {
      const status = resp.status();
      let body = '';
      try {
        const ct = resp.headers()['content-type'] || '';
        if (ct.includes('json') || ct.includes('text')) {
          body = (await resp.text()).slice(0, 400);
        }
      } catch { /* noop */ }
      responses.push({ status, url: url.slice(0, 200), bodyPreview: body });
    }
  });
  page.on('requestfailed', (req) => {
    requestFailed.push({ url: req.url().slice(0, 200), failure: req.failure()?.errorText });
  });

  await page.goto('/');
  await page.waitForSelector('.canvas-content', { timeout: 10000 });
  await page.evaluate(() => {
    localStorage.clear();
    if (window.__state?.actions) {
      window.__state.actions.clear();
      window.__state.actions.clearChatHistory();
    }
  });

  console.log('=== SETUP ===');
  await setupProvider(page, 'openrouter');
  await openChatRobust(page);

  // Test 3 streaming pre-clear : vider le chat APRÈS le test 3 pour isoler test 4
  // (mais ici on n'exécute que test 4 dans ce spec, donc pas de pollution)

  console.log('=== SEND MESSAGE ===');
  await page.locator('#chat-input').fill('Réponds avec exactement: **gras** et `code`.');
  const sendStart = Date.now();
  await page.locator('#chat-input').press('Enter');

  // Polling toutes les 1s pendant 60s max
  const pollStart = Date.now();
  let lastDomSnapshot = '';
  let bubbleFound = false;
  let errorFound = false;

  while (Date.now() - pollStart < 60_000) {
    await page.waitForTimeout(1000);
    const snap = await page.evaluate(() => {
      const assistants = document.querySelectorAll('.chat-msg--assistant:not(.chat-msg--streaming)');
      const lastA = assistants[assistants.length - 1];
      const errs = document.querySelectorAll('.chat-msg--error');
      const lastE = errs[errs.length - 1];
      const streaming = document.querySelectorAll('.chat-msg--streaming').length;
      return {
        elapsedMs: Date.now() - window.__diagStart,
        assistantCount: assistants.length,
        assistantText: lastA?.querySelector('.chat-msg__bubble')?.textContent?.trim() || '',
        errorCount: errs.length,
        errorText: lastE?.textContent?.trim() || '',
        streamingCount: streaming,
        bodyHtml: document.querySelector('#app-chat-body')?.innerHTML?.length || 0,
      };
    });
    snap.elapsedMs = Date.now() - pollStart;
    const snapStr = JSON.stringify(snap);
    if (snapStr !== lastDomSnapshot) {
      console.log(`[t+${snap.elapsedMs}ms] ${snapStr}`);
      lastDomSnapshot = snapStr;
    }
    if (snap.assistantText && snap.assistantText.length > 0) { bubbleFound = true; break; }
    if (snap.errorText && snap.errorText.length > 0) { errorFound = true; break; }
  }

  console.log('=== FINAL DOM ===');
  const finalDom = await page.evaluate(() => {
    const assistants = document.querySelectorAll('.chat-msg--assistant:not(.chat-msg--streaming)');
    const lastA = assistants[assistants.length - 1];
    return {
      assistantCount: assistants.length,
      assistantHtml: lastA?.querySelector('.chat-msg__bubble')?.innerHTML?.slice(0, 500) || '',
      assistantText: lastA?.querySelector('.chat-msg__bubble')?.textContent?.trim() || '',
    };
  });
  console.log(JSON.stringify(finalDom, null, 2));

  console.log('=== CONSOLE (last 10) ===');
  console.log(JSON.stringify(consoleMsgs.slice(-10), null, 2));

  console.log('=== REQUESTS ===');
  console.log(JSON.stringify(requestUrls, null, 2));

  console.log('=== RESPONSES ===');
  console.log(JSON.stringify(responses, null, 2));

  console.log('=== REQUEST FAILED ===');
  console.log(JSON.stringify(requestFailed, null, 2));

  console.log('=== TOTAL ELAPSED ===');
  console.log(`${Date.now() - sendStart}ms`);

  // Pas d'assertion, juste de l'observation
});
