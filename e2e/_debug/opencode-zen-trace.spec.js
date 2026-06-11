/**
 * SPEC DEBUG TEMPORAIRE — OpenCode Zen network/console trace
 *
 * ⚠️ Ce fichier est dans e2e/_debug/ et peut être supprimé quand le diagnostic
 * est terminé. Préfixe `_` → skip du runner Playwright par défaut.
 *
 * Objectif : capturer TOUT ce qui se passe entre l'envoi du message smoke et
 * le timeout, pour identifier :
 *   1. Le throw "output vide" remonte-t-il au chatPanel ?
 *   2. Le fetch hang sans réponse ?
 *   3. Quelle réponse exacte renvoie l'API ?
 *   4. Quel code de retour / message d'erreur ?
 *
 * Stratégie de capture :
 *   - page.on('console') → tous les console.log/warn/error du navigateur
 *   - page.on('request')  → toutes les requêtes sortantes (URL, méthode)
 *   - page.on('response') → toutes les réponses (status, body tronqué)
 *   - page.on('requestfailed') → erreurs réseau
 *   - page.on('pageerror') → exceptions JS non catchées
 *
 * Run : `npx playwright test e2e/_debug/opencode-zen-trace.spec.js --reporter=list`
 */
import { test } from '@playwright/test';
import { setupProvider, openChatRobust, skipIfNoKey } from '../helpers/providerTest.js';

test.describe('DEBUG opencode-zen trace @debug @slow', () => {
  test('trace complet d\'un chat opencode-zen', async ({ page }) => {
    skipIfNoKey(test, 'opencode-zen');
    test.setTimeout(120_000);

    // --- Setup capture early ---
    const consoleMessages = [];
    const requests = [];
    const responses = [];
    const requestFailures = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text().slice(0, 500),
        ts: Date.now(),
      });
    });

    page.on('pageerror', (err) => {
      pageErrors.push({
        message: err.message.slice(0, 500),
        stack: err.stack?.slice(0, 800) || '',
        ts: Date.now(),
      });
    });

    page.on('request', (req) => {
      requests.push({
        method: req.method(),
        url: req.url(),
        ts: Date.now(),
        postData: req.postData()?.slice(0, 300) || null,
      });
    });

    page.on('response', async (resp) => {
      const url = resp.url();
      // Filtrer pour ne garder que ce qui est lié à opencode-zen / chat
      const isRelevant =
        url.includes('opencode-zen') ||
        url.includes('opencode.ai') ||
        url.includes('chat') ||
        url.includes('/local-api/');

      if (!isRelevant) return;

      let body = '';
      try {
        const text = await resp.text();
        body = text.slice(0, 1000);
      } catch (e) {
        body = `<body read error: ${e.message}>`;
      }

      responses.push({
        status: resp.status(),
        url,
        headers: resp.headers(),
        bodyPreview: body,
        ts: Date.now(),
      });
    });

    page.on('requestfailed', (req) => {
      requestFailures.push({
        url: req.url(),
        failure: req.failure()?.errorText || 'unknown',
        method: req.method(),
        ts: Date.now(),
      });
    });

    // --- 1) Goto + setup state ---
    await page.goto('/');
    await page.waitForSelector('.canvas-content', { timeout: 10000 });
    await page.evaluate(() => {
      // Activer le trace flag AVANT l'init du chatPanel pour qu'il soit pris
      // en compte dès le premier appel. Important : le module chatPanel lit
      // window.__TRACE_OPENCODE_ZEN à chaque sendMessage.
      window.__TRACE_OPENCODE_ZEN = true;
      // Trace flag pour le chunking opencode-zen dans aiClient.js
      // (cf. instrumentation [TRACE-OCZ-CHUNK] dans streamChatCompletion)
      window.__TRACE_OCZ_CHUNK = true;
      localStorage.clear();
      if (window.__state?.actions) {
        window.__state.actions.clear();
        window.__state.actions.clearChatHistory();
      }
    });

    await setupProvider(page, 'opencode-zen');

    // Force openai format
    await page.evaluate(() => {
      const s = window.__state.getState();
      const meta = s.assistant.provider.modelMeta || {};
      window.__state.actions.updateProvider({
        modelMeta: { ...meta, requestFormat: 'openai' },
      });
    });

    console.log('\n========================================');
    console.log('   DEBUG TRACE OPENCODE-ZEN — START');
    console.log('========================================\n');

    // --- 2) Open chat ---
    await openChatRobust(page);

    // --- 3) Envoi message ---
    const start = Date.now();
    console.log(`[${start}] [TEST] Envoi message: "Écris une phrase de 5 mots sur les chats."`);

    // Attacher un observer DOM pour voir quand les bulles apparaissent
    await page.evaluate(() => {
      const body = document.getElementById('app-chat-body');
      if (!body) return;
      window.__domSnapshots = [];
      const observer = new MutationObserver(() => {
        const assistants = document.querySelectorAll('.chat-msg--assistant:not(.chat-msg--streaming)');
        const errors = document.querySelectorAll('.chat-msg--error');
        const streaming = document.querySelectorAll('.chat-msg--streaming');
        window.__domSnapshots.push({
          ts: Date.now(),
          elapsed: Date.now() - window.__testStart,
          assistantCount: assistants.length,
          assistantLastContent: assistants[assistants.length - 1]?.querySelector('.chat-msg__bubble')?.textContent?.slice(0, 200) || null,
          errorCount: errors.length,
          errorLastText: errors[errors.length - 1]?.textContent?.slice(0, 200) || null,
          streamingCount: streaming.length,
          streamingContent: streaming[0]?.querySelector('.chat-msg__bubble')?.textContent?.slice(0, 200) || null,
        });
      });
      observer.observe(body, { childList: true, subtree: true, characterData: true });
      window.__testStart = Date.now();
    });

    await page.locator('#chat-input').fill('Écris une phrase de 5 mots sur les chats.');
    await page.locator('#chat-input').press('Enter');

    // --- 4) Attendre 40s et capturer l'état ---
    await page.waitForTimeout(40_000);

    // Snapshot DOM final
    const finalState = await page.evaluate(() => {
      const body = document.getElementById('app-chat-body');
      const assistants = document.querySelectorAll('.chat-msg--assistant:not(.chat-msg--streaming)');
      const errors = document.querySelectorAll('.chat-msg--error');
      const streaming = document.querySelectorAll('.chat-msg--streaming');
      return {
        bodyHTML: body?.innerHTML?.slice(0, 2000) || '(no body)',
        assistantCount: assistants.length,
        assistantLastContent: assistants[assistants.length - 1]?.querySelector('.chat-msg__bubble')?.textContent?.slice(0, 300) || null,
        errorCount: errors.length,
        errorLastText: errors[errors.length - 1]?.textContent?.slice(0, 300) || null,
        streamingCount: streaming.length,
        streamingContent: streaming[0]?.querySelector('.chat-msg__bubble')?.textContent?.slice(0, 300) || null,
        domSnapshots: window.__domSnapshots || [],
      };
    });

    // --- 5) Rapport final ---
    const elapsed = Date.now() - start;
    console.log(`\n========================================`);
    console.log(`   DEBUG TRACE — END (${elapsed}ms)`);
    console.log(`========================================\n`);

    console.log(`\n--- CONSOLE MESSAGES (${consoleMessages.length}) ---`);
    consoleMessages.forEach((m, i) => {
      console.log(`  [${i}] [${m.type}] @${m.ts - start}ms : ${m.text}`);
    });

    console.log(`\n--- PAGE ERRORS (${pageErrors.length}) ---`);
    pageErrors.forEach((e, i) => {
      console.log(`  [${i}] @${e.ts - start}ms : ${e.message}`);
      console.log(`       stack: ${e.stack.split('\n').slice(0, 3).join(' | ')}`);
    });

    console.log(`\n--- REQUESTS (${requests.length}) ---`);
    requests.forEach((r, i) => {
      console.log(`  [${i}] ${r.method} ${r.url}`);
      if (r.postData) console.log(`       body: ${r.postData.slice(0, 200)}`);
    });

    console.log(`\n--- RESPONSES (${responses.length}) ---`);
    responses.forEach((r, i) => {
      console.log(`  [${i}] HTTP ${r.status} ${r.url}`);
      console.log(`       body: ${r.bodyPreview.slice(0, 400)}`);
    });

    console.log(`\n--- REQUEST FAILURES (${requestFailures.length}) ---`);
    requestFailures.forEach((f, i) => {
      console.log(`  [${i}] ${f.method} ${f.url} → ${f.failure}`);
    });

    console.log(`\n--- DOM SNAPSHOTS (${finalState.domSnapshots.length}) ---`);
    // Garder seulement les snapshots avec changement significatif
    let lastSig = '';
    finalState.domSnapshots.forEach((s) => {
      const sig = `${s.assistantCount}|${s.errorCount}|${s.streamingCount}|${s.assistantLastContent || ''}|${s.errorLastText || ''}|${s.streamingContent || ''}`;
      if (sig !== lastSig) {
        lastSig = sig;
        console.log(`  +${s.elapsed}ms : assistant=${s.assistantCount} err=${s.errorCount} stream=${s.streamingCount}`);
        if (s.assistantLastContent) console.log(`    assistant: "${s.assistantLastContent}"`);
        if (s.errorLastText) console.log(`    error: "${s.errorLastText}"`);
        if (s.streamingContent) console.log(`    streaming: "${s.streamingContent}"`);
      }
    });

    console.log(`\n--- FINAL STATE ---`);
    console.log(`  assistantCount: ${finalState.assistantCount}`);
    console.log(`  assistantLastContent: ${finalState.assistantLastContent || '(null)'}`);
    console.log(`  errorCount: ${finalState.errorCount}`);
    console.log(`  errorLastText: ${finalState.errorLastText || '(null)'}`);
    console.log(`  streamingCount: ${finalState.streamingCount}`);
    console.log(`  streamingContent: ${finalState.streamingContent || '(null)'}`);

    console.log(`\n--- BODY HTML (first 2000 chars) ---`);
    console.log(finalState.bodyHTML);

    console.log(`\n========================================\n`);
  });
});
