# Tests E2E Playwright

> Suite de tests d'intégration navigateur pour `code-city` (canvas Mermaid
> + assistant IA multi-providers). Couvre l'UI complète, le state, et —
> pour les providers IA — les **vraies intégrations** contre les API
> externes (cf. [`providers-e2e-spec.md`](../.dev-plans/providers-e2e-spec.md)).

---

## 📂 Structure

```
e2e/
├── README.md                          # ce fichier
├── helpers/
│   └── providerTest.js                # helper partagé : skipIfNoKey, setupProvider, sendSmokeMessage, …
├── providers/                         # tests d'intégration par provider IA (Sprint A+)
│   ├── ollama.spec.js                 # pilote (Sprint A) — local, pas de clé
│   ├── openrouter.spec.js             # Sprint B
│   ├── groq.spec.js                   # Sprint B
│   ├── mistral.spec.js                # Sprint B
│   ├── kilo.spec.js                   # Sprint B
│   ├── gemini.spec.js                 # Sprint C
│   ├── opencode-zen.spec.js           # Sprint C
│   └── lmstudio.spec.js               # Sprint C
├── assistant.spec.js                  # state chat history
├── assistant-context.spec.js          # raccourcis clavier, menu nœud
├── assistant-fim.spec.js              # FIM inline completion (provider Mistral)
├── streaming-rendering.spec.js        # rendu Markdown + structure streaming
├── prompt-engine.spec.js              # section prompt DOM
├── chat-panel-improvements.spec.js    # hover edit-btn, troncature, slide-in
├── api-keys-modal.spec.js             # modal clés API + auto-validation
├── providers.spec.js                  # panneau providers UI
├── export.spec.js                     # export multi-formats
├── export-preview.spec.js             # preview Markdown
├── features.spec.js                   # theme, zoom, grid
├── hub-workflow.spec.js               # hubs (groupement nœuds)
├── palette-dragdrop.spec.js           # drag-and-drop palette → canvas
├── properties.spec.js                 # propriétés nœuds
├── undo-redo.spec.js                  # historique undo/redo
├── mermaid-properties-sync.spec.js    # sync propriétés ↔ code Mermaid
└── prompt-engine.spec.js              # voir ci-dessus
```

---

## ⚡ Démarrage rapide

### 1. Installer les dépendances

```bash
npm install
```

### 2. (Optionnel) Configurer les clés API pour les tests providers

Créez un fichier `.env` à la racine (déjà gitignoré) :

```bash
# Copier le template (si vous l'avez)
cp .env.example .env

# Ou éditer directement
nano .env
```

Variables reconnues par les tests d'intégration providers :

| Variable | Provider | Obligatoire ? |
|---|---|---|
| `OPENROUTER_API_KEY` | OpenRouter | ✅ pour `openrouter.spec.js` |
| `GROQ_API_KEY` | Groq | ✅ pour `groq.spec.js` |
| `MISTRAL_API_KEY` | Mistral | ✅ pour `mistral.spec.js` |
| `GEMINI_API_KEY` | Gemini | ✅ pour `gemini.spec.js` |
| `OPENCODE_ZEN_API_KEY` | OpenCode Zen | ✅ pour `opencode-zen.spec.js` |
| _(aucune)_ | Kilo, Ollama, LM Studio | ❌ pas de clé requise |

> **Sans clé** : les tests `skipIfNoKey()` se skip silencieusement, le reste de la suite passe.

### 3. Démarrer le serveur de dev

```bash
node scripts/dev.mjs
# → http://localhost:8081
```

Le `playwright.config.js` détecte ce serveur (`webServer.reuseExistingServer: true`).

### 4. Lancer les tests

```bash
# Tous les tests (PR complet, ~3-5 min sans les @slow)
npx playwright test

# Avec UI (debug)
npx playwright test --ui

# Un fichier spécifique
npx playwright test e2e/assistant.spec.js

# Un test par nom
npx playwright test -g "1 - Ctrl+Shift+A"
```

---

## 🏷️ Marqueurs `test.describe` & grep

Les tests longs d'intégration providers sont marqués `@slow` :

```js
test.describe('Provider ollama @slow', () => { … });
```

### Mode PR rapide (par défaut)

Skip les `@slow` pour des PRs rapides (< 5 min) :

```bash
npx playwright test --grep-invert @slow
```

### Mode nightly (CI scheduled)

Inclut TOUT, y compris les vrais appels API providers :

```bash
npx playwright test --grep @slow
# ou
npx playwright test
```

### Combiner filtres

```bash
# Tous les tests Sprint B (openai-compat) uniquement
npx playwright test --grep "Provider (openrouter|groq|mistral|kilo)"

# Un seul test dans un fichier
npx playwright test e2e/providers/openrouter.spec.js -g "2 - chat"
```

---

## 🤖 Tests d'intégration providers (Sprint A+)

### Helper `e2e/helpers/providerTest.js`

```js
import {
  REQUIRED_KEYS,        // mapping provider → var env
  PROVIDER_MODELS,      // mapping provider → modèle (validé UI)
  skipIfNoKey,          // skip si clé absente
  setupProvider,        // setProvider + updateProvider({apiKey, model})
  openChatRobust,       // body.click + Ctrl+Shift+A + waitForFunction
  sendSmokeMessage,     // envoie msg + attend bulle ou erreur
  lastAssistantHasMarkdown,
  sampleStreamingLength,
} from '../helpers/providerTest.js';
```

### Pattern par fichier (template)

```js
import { test, expect } from '@playwright/test';
import { setupProvider, sendSmokeMessage, skipIfNoKey } from '../helpers/providerTest.js';

test.describe('Provider {NAME} @slow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.canvas-content', { timeout: 10000 });
    await page.evaluate(() => { localStorage.clear(); window.__state.actions.clear(); });
  });

  test('1 - setProvider charge la clé API depuis process.env', async ({ page }) => {
    skipIfNoKey(test, '{ID}');
    await setupProvider(page, '{ID}');
    const apiKey = await page.evaluate(() => window.__state.getState().assistant.provider.apiKey);
    expect(apiKey).toBe(process.env.{ENV_KEY});
  });

  test('2 - chat completion renvoie une réponse', async ({ page }) => {
    skipIfNoKey(test, '{ID}');
    await setupProvider(page, '{ID}');
    const r = await sendSmokeMessage(page);
    expect(r.success).toBe(true);
  });

  // test 3 : streaming progressif (cf. sampleStreamingLength)
  // test 4 : format markdown rendu (cf. lastAssistantHasMarkdown)
});
```

### Modèles par défaut (juin 2026 — table validée UI)

Voir `PROVIDER_MODELS` dans le helper. Si un provider change de modèle, mettre à jour la **table unique** et toutes les specs s'alignent.

| Provider | Modèle |
|---|---|
| openrouter | `qwen/qwen3.5-9b` |
| groq | `groq/compound` |
| mistral | `codestral-latest` |
| gemini | `gemini-2.5-flash` |
| opencode-zen | `deepseek-v4-flash-free` |
| kilo | `nvidia/nemotron-3-super-120b-a12b:free` |
| ollama | `lfm2.5:latest` |
| lmstudio | `qwen/qwen3.5-9b` |

---

## ➕ Ajouter un nouveau test provider (Sprint B+)

1. Créer `e2e/providers/{id}.spec.js` à partir du template ci-dessus
2. Marquer `test.describe(..., () => { ... })` avec `@slow`
3. Utiliser `skipIfNoKey(test, '{id}')` au début de chaque test qui consomme des crédits
4. Vérifier que `PROVIDER_MODELS[id]` est défini dans le helper (sinon l'ajouter)
5. Ajouter la variable d'env correspondante dans ce README
6. Documenter toute spécificité (Gemini REST, OpenCode dual) dans le test

---

## 🔧 Dépannage

### `TimeoutError: page.waitForSelector: .canvas-content`

→ Le serveur dev n'est pas démarré. Lancer `node scripts/dev.mjs` dans un terminal séparé, ou laisser Playwright le démarrer automatiquement (webServer config).

### `Clé X_API_KEY absente — test skippé`

→ C'est **normal** : `skipIfNoKey()` skip proprement les tests sans clé. Configurer `.env` pour activer.

### Tests `@slow` lents (> 60s) ou timeout

→ Augmenter le timeout dans `playwright.config.js` (`timeout: 60_000` actuellement). Pour un test isolé :
```js
test.setTimeout(120_000);
```

### `Ollama non accessible`

→ Démarrer ollama localement (`ollama serve` + `ollama pull lfm2.5`). Sans ollama, `ollama.spec.js` skip les tests 2/3/4 automatiquement (catch de l'erreur de connexion).

### Le mock `addInitScript` interfère avec les vrais tests providers

→ Les specs `e2e/providers/*.spec.js` **n'utilisent pas** le mock `addInitScript` (qui était dans `chat-panel-improvements.spec.js`). Elles font de vrais appels via le proxy `/local-api/{id}/...` du dev server.

### Faux positifs (flaky)

→ Les tests sont conçus pour être robustes (`openChatRobust` avec `waitForFunction` 2s). Si un test devient flaky :
1. Identifier le timing (screenshot via `await page.screenshot({ path: 'debug.png' })`)
2. Augmenter le timeout du test (`test.setTimeout()`)
3. Remplacer `waitForTimeout` fixe par `waitForFunction` (plus robuste)

---

## 📊 Métriques attendues (cf. spec §6)

| Métrique | Objectif | Sprint cible |
|---|---|---|
| Providers couverts | 8/8 | Fin Sprint C |
| Tests par provider | ≥ 4 | Sprint A (ollama OK) |
| Durée suite rapide (`--grep-invert @slow`) | < 5 min | Sprint A |
| Durée suite nightly (`--grep @slow`) | < 10 min | Sprint C |
| Taux de skip acceptable | 0-2 providers | dépend de `.env` |

---

## 📚 Références

- [`playwright.config.js`](../playwright.config.js) : timeout 60s, expect 10s, metadata
- [`e2e/helpers/providerTest.js`](helpers/providerTest.js) : helper partagé
- [`.dev-plans/providers-e2e-spec.md`](../.dev-plans/providers-e2e-spec.md) : spec de planification complète (3 sprints, ~3.5j)
- [`.dev-plans/chat-panel-improvements-spec.md`](../.dev-plans/chat-panel-improvements-spec.md) : spec des tests panneau chat
- [`src/code-city/ai/aiClient.js`](../src/code-city/ai/aiClient.js) : implémentation `streamChatCompletion()` (mockée par les tests unitaires Vitest)
- [Documentation Playwright](https://playwright.dev/docs/intro) : référence officielle
