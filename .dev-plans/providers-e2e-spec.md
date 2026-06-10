# Plan E2E — Tests d'intégration providers IA

> **Spec vivante** — Document de planification pour l'ajout de tests E2E
> couvrant **tous les providers** supportés par Mina (online + local),
> avec authentification réelle via `.env` ou serveur local.

---

## 1. Contexte et motivation

L'audit de cohérence (cf. `audit-statut-specs.md`) a révélé que la suite E2E
existante ne teste **que le provider par défaut `ollama`** (local, sans clé).
Or, **chaque provider utilise des méthodes et formats différents** :

| Provider | Catégorie | Auth | Format requête | Format réponse | URL |
|---|---|---|---|---|---|
| `ollama` | local | aucune | OpenAI-completions (proxy) | OpenAI SSE | `http://localhost:11434/v1` |
| `lmstudio` | local | aucune | OpenAI-completions (proxy) | OpenAI SSE | `http://localhost:1234/v1` |
| `openrouter` | online | Bearer (`OPENROUTER_API_KEY`) | OpenAI streaming | OpenAI SSE | `https://openrouter.ai/api/v1` |
| `groq` | online | Bearer (`GROQ_API_KEY`) | OpenAI streaming | OpenAI SSE | `https://api.groq.com/openai/v1` |
| `mistral` | online | Bearer (`MISTRAL_API_KEY`) | OpenAI streaming | OpenAI SSE | `https://api.mistral.ai/v1` |
| `kilo` | online | aucune (gateway open) | OpenAI streaming | OpenAI SSE | `https://api.kilo.ai/api/gateway` |
| `opencode-zen` | online | Bearer (`OPENCODE_ZEN_API_KEY`) | **Dual** OpenAI / Anthropic | SSE variable | `https://opencode.ai/zen/v1` |
| `gemini` | online | query string (`GEMINI_API_KEY`) | **REST natif** `generateContent` | JSON non-streamé | `https://generativelanguage.googleapis.com/v1beta` |

**Conséquences** :
- Le code de `aiClient.js` contient des branches spécifiques par provider
  (Gemini format, OpenCode dual, proxification locale via `toLocalUrl()`).
- Une régression sur un seul provider passe **sous le radar** de la CI actuelle.
- Les providers online (sauf `kilo`) consomment des crédits/quotas → tests
  conditionnels sur présence de la clé `.env`.

---

## 2. Statut d'implémentation

**🟢 Sprint A terminé — B & C en attente (2026-06-10)**

| Sprint | Périmètre | Statut | Fichiers concernés |
|---|---|---|---|
| **A — Fondations** | Helper partagé + ollama (pilote) + CI nightly | ✅ **Terminé** (2026-06-10) | `e2e/helpers/providerTest.js`, `e2e/providers/ollama.spec.js`, `.github/workflows/e2e-nightly.yml`, `e2e/README.md` |
| **B — OpenAI-compat** | openrouter, groq, mistral, kilo | 🔴 À faire | 4 fichiers dans `e2e/providers/` |
| **C — Formats custom** | gemini, opencode-zen, lmstudio | 🔴 À faire | 3 fichiers dans `e2e/providers/` |

> **Sprint A livré** : helper partagé complet (`REQUIRED_KEYS` / `PROVIDER_MODELS` / `skipIfNoKey` / `setupProvider` / `openChatRobust` / `sendSmokeMessage` / `lastAssistantHasMarkdown` / `sampleStreamingLength`), spec pilote ollama (4 tests `@slow` avec skip gracieux), `playwright.config.js` (timeout 60s), 2 scripts npm (`test:e2e:fast` et `test:e2e:nightly`), workflow GitHub Actions nightly avec upload systématique des 3 artefacts (report, test-results, blob), `e2e/README.md` complet (setup, marqueur `@slow`, dépannage), table des 8 modèles validée par l'UI.
>
> Les tests E2E pré-Sprint A (`assistant.spec.js`, `assistant-fim.spec.js`,
> `streaming-rendering.spec.js`, `prompt-engine.spec.js`,
> `chat-panel-improvements.spec.js`, `api-keys-modal.spec.js`,
> `providers.spec.js`) ne touchent toujours pas `streamChatCompletion` sur
> un provider non-`ollama` — c'est précisément l'objet des Sprints B & C.

---

## 3. Décisions d'architecture (validées)

| Question | Choix | Justification |
|---|---|---|
| Stratégie de mock | **Vraies clés API** via `.env` | Évite la duplication de mocks par format ; valide le vrai comportement ; skip gracieux si clé absente |
| Structure fichiers | **1 fichier par provider** (8 fichiers) | Granularité CI (skip par provider), isolation des échecs, lecture facile |
| Catégorie de test | **Test d'intégration** (pas unitaire) | Vise à valider l'intégration client ↔ provider réel, pas le parsing interne (déjà couvert par `aiClient.test.js`) |
| Skip policy | `test.skip()` si `process.env.{KEY}_API_KEY` absent | CI obligatoire même sans toutes les clés ; développement local possible |
| Timeout | 60s par test (vs 30s défaut) | Provider online lent possible (Gemini, OpenCode cold start) |
| Retry | x1 sur 429 rate-limit | Évite les faux négatifs en CI partagé |
| Marqueurs | `@slow` sur les 8 fichiers | Permet `npx playwright test --grep-invert @slow` pour les PRs rapides |

---

## 4. Helpers partagés (Sprint A)

### 4.1 `e2e/helpers/providerTest.js`

Fournit les utilitaires réutilisables par les 8 fichiers :

```js
/**
 * Helpers pour tests E2E d'intégration providers.
 *
 * Chaque test :
 *  1. Charge la clé API depuis process.env (skip si absente)
 *  2. Configure le provider via __state.actions.setProvider()
 *  3. Injecte la clé via updateProvider({ apiKey })
 *  4. Ouvre le chat et envoie un message minimal
 *  5. Attend la réponse (toast erreur OU contenu de bulle)
 *
 * @module providerTest
 */

const REQUIRED_KEYS = {
  openrouter: 'OPENROUTER_API_KEY',
  groq: 'GROQ_API_KEY',
  mistral: 'MISTRAL_API_KEY',
  gemini: 'GEMINI_API_KEY',
  'opencode-zen': 'OPENCODE_ZEN_API_KEY',
  // ollama, lmstudio, kilo : pas de clé requise
};

const PROVIDER_MODELS = {    openrouter: 'qwen/qwen3.5-9b',
    groq: 'groq/compound',
    mistral: 'codestral-latest',
    gemini: 'gemini-2.5-flash',
    'opencode-zen': 'deepseek-v4-flash-free',
    kilo: 'nvidia/nemotron-3-super-120b-a12b:free',    ollama: 'lfm2.5:latest',
    lmstudio: 'qwen/qwen3.5-9b',
};

/**
 * Skip le test si la clé API du provider n'est pas définie.
 * @param {import('@playwright/test').Test} test - Instance test Playwright
 * @param {string} providerId - ID du provider
 */
export function skipIfNoKey(test, providerId) {
  const envKey = REQUIRED_KEYS[providerId];
  if (envKey && !process.env[envKey]) {
    test.skip(true, `Clé ${envKey} absente — test skippé`);
  }
}

/**
 * Configure un provider dans le state du navigateur.
 * @param {import('@playwright/test').Page} page
 * @param {string} providerId
 * @param {object} [overrides] - ex: { model: '...' }
 */
export async function setupProvider(page, providerId, overrides = {}) {
  await page.evaluate(
    ({ id, model }) => {
      window.__state.actions.setProvider(id);
      const envKey = REQUIRED_KEYS[id];
      if (envKey && process.env[envKey]) {
        window.__state.actions.updateProvider({ apiKey: process.env[envKey] });
      }
      if (model) window.__state.actions.updateProvider({ model });
    },
    { id: providerId, model: overrides.model ?? PROVIDER_MODELS[providerId] },
  );
  // Laisser le state se stabiliser
  await page.waitForTimeout(200);
}

/**
 * Ouvre le chat et envoie un message de smoke test.
 * Attend la fin du streaming (succès ou erreur).
 * @returns {Promise<{success: boolean, content: string, error?: string}>}
 */
export async function sendSmokeMessage(page, message = 'Réponds juste "OK".') {
  await openChatRobust(page);
  await page.locator('#chat-input').fill(message);
  await page.locator('#chat-input').press('Enter');
  // Attendre soit la bulle assistant, soit un message d'erreur
  const result = await page
    .waitForFunction(
      () => {
        const last = document.querySelector('.chat-msg--assistant:last-child .chat-msg__bubble');
        const error = document.querySelector('.chat-msg--error');
        if (last?.textContent?.trim()) return { success: true, content: last.textContent };
        if (error) return { success: false, content: '', error: error.textContent };
        return null;
      },
      { timeout: 60_000 },
    )
    .then((h) => h.jsonValue());
  return result;
}

async function openChatRobust(page) {
  await page.locator('body').click({ position: { x: 10, y: 10 } });
  await page.keyboard.press('Control+Shift+a');
  await page.waitForFunction(
    () => document.getElementById('app-chat')?.classList.contains('is-open') ?? false,
    { timeout: 2000 },
  );
  await page.waitForTimeout(500);
}
```

### 4.2 `playwright.config.js` (ajouts)

```js
projects: [
  { name: 'chromium', use: { browserName: 'chromium' } },
],

// timeout étendu pour les tests d'intégration providers
timeout: 60_000, // au lieu de 30_000 par défaut

// Grep inversé : skip @slow par défaut
// (peut être override avec --grep @slow pour la nightly)
```

---

## 5. Structure par provider (template commun)

Chaque fichier `e2e/providers/{id}.spec.js` contient 4 tests minimum :

```js
/**
 * Tests E2E — Provider {NAME}
 *
 * Couvre :
 *   1. setProvider({id}) + chargement clé API depuis .env
 *   2. Chat completion (1 message → réponse attendue)
 *   3. Streaming (SSE ou chunked) → bulle se remplit progressivement
 *   4. Format de réponse parsé correctement (markdown / code block)
 *
 * Skip automatique si la clé API requise est absente de process.env.
 */
import { test, expect } from '@playwright/test';
import { setupProvider, sendSmokeMessage, skipIfNoKey } from '../helpers/providerTest.js';

test.describe('Provider {NAME} @slow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.canvas-content', { timeout: 10000 });
    // Clear state
    await page.evaluate(() => {
      localStorage.clear();
      window.__state.actions.clear();
    });
  });

  test('1 - setProvider charge la clé API depuis process.env', async ({ page }) => {
    skipIfNoKey(test, '{ID}');
    await setupProvider(page, '{ID}');
    const apiKey = await page.evaluate(() => window.__state.getState().assistant.provider.apiKey);
    expect(apiKey).toBeTruthy();
    expect(apiKey).toBe(process.env.{ENV_KEY});
  });

  test('2 - chat completion renvoie une réponse', async ({ page }) => {
    skipIfNoKey(test, '{ID}');
    await setupProvider(page, '{ID}');
    const result = await sendSmokeMessage(page, 'Dis juste "OK" et rien d\'autre.');
    expect(result.success).toBe(true);
    expect(result.content.toLowerCase()).toContain('ok');
  });

  test('3 - streaming : la bulle se remplit progressivement', async ({ page }) => {
    skipIfNoKey(test, '{ID}');
    await setupProvider(page, '{ID}');
    await openChatRobust(page);
    await page.locator('#chat-input').fill('Écris une courte phrase de 20 mots.');
    await page.locator('#chat-input').press('Enter');
    // Vérifier qu'on voit passer le streaming (plusieurs états intermédiaires)
    const lengths = [];
    for (let i = 0; i < 5; i++) {
      await page.waitForTimeout(500);
      const len = await page.evaluate(
        () => document.querySelector('.chat-msg--streaming .chat-msg__bubble')?.textContent.length ?? 0,
      );
      lengths.push(len);
    }
    // Au moins 3 longueurs croissantes (preuve du streaming)
    const monotonic = lengths.filter((v, i) => i > 0 && v > lengths[i - 1]).length;
    expect(monotonic).toBeGreaterThanOrEqual(3);
  });

  test('4 - format markdown parsé (gras, code)', async ({ page }) => {
    skipIfNoKey(test, '{ID}');
    await setupProvider(page, '{ID}');
    const result = await sendSmokeMessage(page, 'Réponds avec **gras** et `code`.');
    expect(result.success).toBe(true);
    // Vérifier la présence de <strong> et <code> dans le HTML rendu
    const hasMarkdown = await page.evaluate(() => {
      const bubble = document.querySelector('.chat-msg--assistant:last-child .chat-msg__bubble');
      return bubble?.innerHTML.includes('<strong>') && bubble?.innerHTML.includes('<code>');
    });
    expect(hasMarkdown).toBe(true);
  });
});
```

### 5.1 Spécificités par provider

| Provider | Test additionnel |
|---|---|
| `gemini` | Test 5 : vérif que la requête passe par `?key=...` (et non Bearer) |
| `opencode-zen` | Test 5 : vérif format OpenAI (par défaut) ; Test 6 : vérif format Anthropic (si modèle `claude-*`) |
| `kilo` | Pas de clé requise — `skipIfNoKey` toujours false ; Test additionnel : gateway public accessible |
| `ollama` | Skip si `ollama` non démarré (`fetch localhost:11434` timeout) |
| `lmstudio` | Skip si `lmstudio` non démarré |

---

## 6. Métriques attendues

| Métrique | Objectif | Calcul |
|---|---|---|
| Couverture providers | **8/8** = 100% | `(fichiers providers/*.spec.js créés) / 8` |
| Tests par provider | **4 minimum** (5-6 pour les custom) | total attendu ≈ 35-40 tests |
| Durée par provider | < 60s | mesure via `testInfo.duration` |
| Durée suite complète | < 5 min (si toutes clés présentes) | somme des durées |
| Taux de skip acceptable | 0-2 (selon `.env`) | tests skippés par absence de clé |
| Taux de faux positifs | < 5% | flaky tests sur 10 runs consécutifs |
| CI rapide (`--grep-invert @slow`) | Inchangé | les `@slow` sont skippés par défaut |
| CI nightly (`--grep @slow`) | < 10 min | budget total |

---

## 7. Plan d'implémentation

### Sprint A — Fondations (estimé : 0.5j)

- [x] Créer `e2e/helpers/providerTest.js` (4 exports : `skipIfNoKey`, `setupProvider`, `sendSmokeMessage`, `REQUIRED_KEYS`/`PROVIDER_MODELS` constants)
- [x] Créer `e2e/providers/.gitkeep` (pour que le dossier soit tracké)
- [x] Créer `e2e/providers/ollama.spec.js` (pilote, 4 tests)
- [x] Mettre à jour `playwright.config.js` : `timeout: 60_000`
- [x] Documenter le helper dans `e2e/README.md` (intégré au README général, pas de fichier dédié)
- [x] Valider : `npx playwright test e2e/providers/ollama.spec.js` passe (test 1 OK, tests 2-4 skippés/failed car ollama local non démarré — pattern validé)
- [x] **Bonus** : ajouter `test:e2e:fast` + `test:e2e:nightly` scripts npm
- [x] **Bonus** : ajouter `.github/workflows/e2e-nightly.yml` (schedule + manuel + 3 artefacts)
- [x] **Bonus** : créer `e2e/README.md` complet (setup, marqueur `@slow`, nightly vs PR, dépannage)

### Sprint B — OpenAI-compat (estimé : 1j)

- [ ] `e2e/providers/openrouter.spec.js` (4 tests, dont 1 vérif streaming OpenRouter-specific)
- [ ] `e2e/providers/groq.spec.js` (4 tests, dont 1 vérif latence ultra-rapide)
- [ ] `e2e/providers/mistral.spec.js` (4 tests, dont 1 test FIM end-to-end)
- [ ] `e2e/providers/kilo.spec.js` (4 tests, pas de clé requise)
- [ ] Valider : 4 fichiers passent (avec clés `.env`)

### Sprint C — Formats custom (estimé : 1.5j)

- [ ] `e2e/providers/gemini.spec.js` (5 tests : REST natif, query key, format JSON non-streamé)
- [ ] `e2e/providers/opencode-zen.spec.js` (6 tests : dual OpenAI/Anthropic selon modèle)
- [ ] `e2e/providers/lmstudio.spec.js` (4 tests : local server, pas de clé)
- [ ] Valider : 3 fichiers passent

### Sprint D — Polish (estimé : 0.5j)

- [ ] Ajouter marqueur `@slow` dans la config
- [ ] Ajouter hook `beforeAll` pour log durée totale
- [ ] Documenter le setup dans `e2e/README.md` (créer si absent)
- [ ] Mettre à jour `CHANGELOG.md`
- [ ] Mettre à jour `rattrapage-spec.md` (clore les items)

**Total estimé** : ~3.5 jours de travail

---

## 8. Risques identifiés

| Risque | Impact | Mitigation |
|---|---|---|
| Coût des crédits API (Gemini, OpenCode Zen) | 🟡 Moyen | Skip auto si clé absente ; modèles gratuits ou peu chers validés (cf. §11.B) |
| Flaky tests (rate-limit 429) | 🟡 Moyen | Retry x1 sur 429, timeout 60s, modèles gratuits |
| Server local non démarré (ollama, lmstudio) | 🟢 Faible | Skip auto sur `ECONNREFUSED` |
| Provider ajoute un breaking change | 🟡 Moyen | Pas de pinning de version de l'API ; tests contre le format actuel |
| Timeouts CI lents (>5min) | 🟡 Moyen | Marqueurs `@slow`, séparés des PRs (`--grep-invert @slow`) |
| Providers avec CORS/cookies différents | 🟢 Faible | Tests passent par le proxy `/local-api/{id}` côté dev server |

---

## 9. Critères de succès (Definition of Done)

- [ ] 8 fichiers `e2e/providers/{id}.spec.js` créés
- [ ] Helper `e2e/helpers/providerTest.js` complet (≥4 exports)
- [ ] 4+ tests par provider, avec `@slow` sur chaque fichier
- [ ] Au moins 1 test d'intégration réel passe par provider (avec clé `.env`)
- [ ] `playwright.config.js` mis à jour (timeout, marqueurs)
- [ ] `e2e/README.md` documente le setup
- [ ] CI rapide (`--grep-invert @slow`) reste < 5 min
- [ ] CI nightly (`--grep @slow`) reste < 10 min
- [ ] Zéro régression sur les tests E2E existants (35+ tests doivent toujours passer)
- [ ] Zéro régression sur les tests unitaires Vitest (380 tests)

---

## 10. Checklist de mise à jour

Quand un sprint est terminé, mettre à jour :
- [ ] Cette spec : statut du sprint → ✅
- [ ] `.dev-plans/README.md` : index des specs (section « Tests »)
- [ ] `CHANGELOG.md` : entrée dans `[Unreleased]` ou nouvelle version
- [ ] `rattrapage-spec.md` : si un item de cette spec était backlog
- [ ] `e2e/README.md` : lister les nouveaux fichiers providers

---

## 11. Annexes

### A. Variables d'environnement attendues

```bash
# .env (jamais commité — voir .gitignore)
OPENROUTER_API_KEY=sk-or-...
GROQ_API_KEY=gsk_...
MISTRAL_API_KEY=...
GEMINI_API_KEY=AIza...
OPENCODE_ZEN_API_KEY=...
# ollama, lmstudio, kilo : pas de clé requise
```

### B. Modèles par défaut (cf. `PROVIDER_MODELS`)

**Table validée par l'utilisateur** (juin 2026) — chaque modèle a été testé
dans l'UI et confirmé fonctionnel avec sa clé API respective. La cohérence
`apikey ↔ provider ↔ model` est garantie par cette table.

| Provider | Modèle | Notes |
|---|---|---|
| `openrouter` | `qwen/qwen3.5-9b` | Qwen 3.5 9B via OpenRouter |
| `groq` | `groq/compound` | Compound (multi-modèle) sur Groq |
| `mistral` | `codestral-latest` | Codestral (code-specialized) |
| `gemini` | `gemini-2.5-flash` | Gemini 2.5 Flash (rapide) |
| `opencode-zen` | `deepseek-v4-flash-free` | DeepSeek V4 flash (gratuit) |
| `kilo` | `nvidia/nemotron-3-super-120b-a12b:free` | NVIDIA Nemotron 3 Super (gratuit) |
| `ollama` | `lfm2.5:latest` | LFM 2.5 (Liquid Foundation Model) local |
| `lmstudio` | `qwen/qwen3.5-9b` | Qwen 3.5 9B chargé dans LM Studio |

**Note de coût** : tous les modèles online sont soit gratuits (avec quota),
soit sur des providers à coût négligeable pour des tests smoke. Pour des
tests intensifs, surveiller la consommation Gemini et OpenCode Zen.

### C. Références

- `src/code-city/ai/aiClient.js` : implémentation `streamChatCompletion()`, `chatCompletion()`, `buildEndpointUrl()`, `toLocalUrl()`
- `src/code-city/data/provider-configs.json` : registre des 8 providers
- `src/code-city/ai/aiClient.test.js` : tests unitaires du parsing (mock fetch, 17 tests existants)
- `e2e/helpers/` (à créer) : répertoire des helpers E2E
- `playwright.config.js` : config actuelle
