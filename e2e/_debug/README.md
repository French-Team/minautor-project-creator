# e2e/_debug/ — Specs de diagnostic one-shot

Ce répertoire contient des **specs de diagnostic transitoires** utilisés pour
investiguer des problèmes ponctuels. Ils sont **exclus** de la suite E2E
standard via `testIgnore: ['e2e/_debug/**']` dans `playwright.config.js`.

## Pourquoi `_debug/` ?

Quand un test E2E principal échoue de manière cryptique (timeout, buffer
vide, état incohérent), on crée un spec `_debug/<problem>-diagnose.spec.js`
qui :

1. Capture **toutes** les erreurs JS via `page.on('pageerror')`
2. Capture **tous** les messages console via `page.on('console')`
3. Capture les requêtes réseau échouées via `page.on('requestfailed')`
4. Dump l'état du DOM, du state, du buffer de trace à chaque étape
5. Log le tout dans `console.log` (visible dans le rapport Playwright)

Le test **passe toujours** (assertion `expect(true).toBe(true)`) — c'est
un instrument d'investigation, pas une assertion.

## Découvertes documentées (à préserver)

### 1. Dépendance env-server (port 3001)

L'app **ne s'initialise pas correctement** si `env-server:3001` n'est pas
démarré. Toujours lancer `node scripts/dev.mjs` (qui démarre à la fois
env-server:3001 et vite:8081) avant `npx playwright test`.

Vérification rapide : `curl http://127.0.0.1:3001/api/env` doit retourner
200 avec un JSON contenant les variables d'environnement.

### 2. `keyEvents` réduit aux événements pré-API

Les événements `[AI-CLIENT] chatCompletion` et `[OPTIMIZER]
optimizeLastResponse CALL` ne fire **que si l'appel API LLM est lancé**.
Sans LLM joignable, ces events hang pendant 30s (timeout) puis le test
échoue sans avoir atteint le nombre d'entrées attendu.

**Solution** : pour les tests qui doivent passer sans LLM, ne chercher
que les événements qui fire AVANT l'appel API :

- `[CHAT] sendMessage ENTRY`
- `[CHAT] user message pushed`
- `[SYSTEM-PROMPT] buildSystemMessages` (ENTRY/SUCCESS)
- `[PROMPT-ENGINE] preparePrompt` (COMPLETE)

Pour valider la couverture complète (y compris `[AI-CLIENT]` et
`[OPTIMIZER]`), utiliser un test séparé gated par `E2E_WITH_LLM=true`.

### 3. Chat panel — interaction

- Le bouton `#assistant-btn` (top bar) est plus fiable que le raccourci
  clavier `Control+Shift+a` en environnement Playwright
- Le bouton `#chat-send-btn` est plus fiable que `Enter` dans `#chat-input`
- Toujours attendre `page.waitForFunction(() => app-chat.classList.contains('is-open'))`
  après l'ouverture, puis `page.waitForSelector('#chat-input', { state: 'visible' })`

## Template : recréer un spec de diagnostic

```js
import { test, expect } from '@playwright/test';

test('Diagnostic — <problème>', async ({ page }) => {
  const consoleMessages = [];
  const pageErrors = [];
  const failedRequests = [];

  page.on('console', (msg) => consoleMessages.push({ type: msg.type(), text: msg.text() }));
  page.on('pageerror', (err) => pageErrors.push({ name: err.name, message: err.message }));
  page.on('requestfailed', (req) => failedRequests.push({ url: req.url(), failure: req.failure()?.errorText }));

  await page.goto('/');
  // ... votre scénario ...

  console.log('=== DIAGNOSTIC DUMP ===');
  console.log('Console:', JSON.stringify(consoleMessages.slice(0, 20), null, 2));
  console.log('Errors:', JSON.stringify(pageErrors, null, 2));
  console.log('Failed:', JSON.stringify(failedRequests, null, 2));
  console.log('=== END ===');

  expect(true).toBe(true); // Diagnostic, pas assertion
});
```

## Specs historiques (non exécutés par défaut)

- `opencode-zen-trace.spec.js` — investigation du timeout opencode-zen
  (cf. Sprint C opencode-zen — résolu via fallback non-streaming)
- `openrouter-test4-trace.spec.js` — investigation test 4 openrouter
  timeout (cf. Sprint C openrouter — résolu via assouplissement assertions)

Ces specs sont **désactivés** par `testIgnore` mais conservés pour
référence future. Les supprimer définitivement une fois le projet stable.
