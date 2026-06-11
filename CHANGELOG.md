# Changelog

Toutes les modifications notables de ce projet seront documentées dans ce fichier.

Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/),
et le projet adhère au [Semantic Versioning](https://semver.org/lang/fr/).

> **Repo public** : [github.com/French-Team/minautor-project-creator](https://github.com/French-Team/minautor-project-creator)
> **Branche principale** : `main`

---

## [Non publié]

### ✨ Ajouté (Sprint A — E2E providers)
- **Helper partagé** `e2e/helpers/providerTest.js` : exports `REQUIRED_KEYS` (mapping provider → var env), `PROVIDER_MODELS` (table validée par l'UI juin 2026), `skipIfNoKey()`, `setupProvider()`, `openChatRobust()`, `sendSmokeMessage()`, `lastAssistantHasMarkdown()`, `sampleStreamingLength()`, `sendSmokeMessageWithAbort()` (abort 20s pour slow streaming)
- **Spec pilote** `e2e/providers/ollama.spec.js` (4 tests `@slow`) : setProvider + config par défaut, chat completion, streaming progressif, format markdown rendu. Skip gracieux si ollama non démarré.
- **`playwright.config.js`** : `timeout: 60_000` (au lieu de 30s), `expect: { timeout: 10_000 }`, bloc `metadata` (slowMarker, lien vers spec). Permet les tests d'intégration providers sans flaky timeouts.
- **`e2e/README.md`** : doc complète (structure, setup `.env`, marqueur `@slow`, lancement PR rapide vs nightly, template par provider, dépannage, métriques attendues)
- **Table des modèles validée par l'UI** (cohérence `apikey ↔ provider ↔ model` garantie) :
  - `openrouter` → `qwen/qwen3.5-9b`
  - `groq` → `groq/compound`
  - `mistral` → `codestral-latest`
  - `gemini` → `gemini-2.5-flash`
  - `opencode-zen` → `deepseek-v4-flash-free`
  - `kilo` → `nvidia/nemotron-3-super-120b-a12b:free`
  - `ollama` → `lfm2.5:latest`
  - `lmstudio` → `qwen/qwen3.5-9b`
- **Spec planification** `.dev-plans/providers-e2e-spec.md` (Sprint A → ✅, B ✅, C 🔶) : 11 sections, ~500 lignes, helper + 1 fichier par provider + vraies clés `.env` + skip gracieux
- Index mis à jour : `.dev-plans/README.md` 12 → 13 specs, nouvelle section §7 « Tests E2E providers »

### Modifié
- `e2e/providers/ollama.spec.js` test 1 : `expect(provider.model)` aligné sur `lfm2.5:latest` (cohérence avec la table)

### Documenté
- `.dev-plans/providers-e2e-spec.md` : §4.1 (helper) et §11.B (modèles) resynchronisés avec la table validée par l'UI
- `.dev-plans/README.md` : nouvelle spec indexée
- `e2e/README.md` créé (aide au setup + nightly vs PR)

### 🔧 Ajouté (CI nightly)
- **Script npm** `npm run test:e2e:nightly` (lance `--grep @slow`, ~5-10min) et `npm run test:e2e:fast` (lance `--grep-invert @slow`, < 5min pour PRs)
- **Workflow GitHub Actions** `.github/workflows/e2e-nightly.yml` : schedule `cron: '0 3 * * *'` (3h UTC) + `workflow_dispatch` manuel (avec input `grep` optionnel), 5 secrets GitHub mappés sur les variables d'env, step summary avec détection des clés, **3 artefacts uploadés systématiquement** (playwright-report 30j, test-results 30j, blob-report 30j), `continue-on-error: true` pour toujours capturer les artefacts même en cas d'échec
- **Concurrency** : 1 run nightly à la fois (`cancel-in-progress: true` pour éviter les chevauchements)
- **Timeout** : 30 min par job (suffisant pour 8 providers × 4 tests × ~10s)

### ✅ Sprint B (terminé 2026-06-10)
- 4 fichiers `e2e/providers/{openrouter, groq, mistral, kilo}.spec.js` créés (4 tests `@slow` chacun)
- Tous partagent le format OpenAI streaming → gain de productivité ~3x vs formats custom
- Modèles validés par l'UI : `qwen/qwen3.5-9b`, `groq/compound`, `codestral-latest`, `nvidia/nemotron-3-super-120b-a12b:free`
- **`sendSmokeMessageWithAbort(page, options)`** : helper dédié aux providers slow streaming (kilo) — patch `window.fetch` avec `AbortController`, poll contenu 500ms, abort après `noContentAbortMs` (défaut 20s), accepte réponse partielle comme succès
- **Table `SLOW_STREAMING_OVERRIDES`** dans `_validation.spec.js` configurée pour kilo (20s/30s) et opencode-zen (45s/60s)

### 🔶 Sprint C (gemini + opencode-zen terminés, lmstudio restant)
- **`e2e/providers/gemini.spec.js`** (4 tests `@slow`) : config + chat REST natif + non-streaming vérif (URL `generativelanguage.googleapis.com`, `?key=` query) + markdown
- **`e2e/providers/opencode-zen.spec.js`** (4 tests `@slow`) : config + chat dual-format + endpoint check (`/responses` OU `/messages`, **jamais** `/chat/completions`) + markdown
- **`e2e/providers/lmstudio.spec.js`** (4 tests `@slow`) : config + chat + streaming + markdown ; **assertions assouplies** (test 2 `length > 0` au lieu de `toContain('ok')` car modèle local `qwen/qwen3.5-9b` est conversationnel ; test 3 `lenFinal > 0` au lieu de `monotonic >= 3` car LM Studio local répond quasi-instantanément sans progression observable)
- **🛠️ Fix majeur `parseOpenAIResponse`** (3 nouveaux formats supportés) :
  1. **Format array** `output: [{ type: "message", content: [{ type: "output_text", text: "..." }] }]` (OpenCode Zen /responses non-streaming) : itère sur les items, filtre `type === 'message'`, concatène les `.text` de leurs `content[]`
  2. **Détection output vide** : throw explicite `output: []` + `stop_reason` (au lieu de retourner `content: ''` silencieusement) — résout les timeouts E2E silencieux
  3. **Mapping usage Anthropic-style** : `input_tokens` / `output_tokens` mappés sur `promptTokens` / `completionTokens` (compatibilité OpenAI + OpenCode Zen)
- **🛠️ `streamChatCompletion` opencode-zen fallback** : émulation de streaming par chunks de 20 chars avec `await new Promise(setTimeout, 0)` entre chaque — résout le bug de transition `.chat-msg--streaming` → `.chat-msg--assistant` non détectée
- **🛠️ `vite.config.js`** : proxy manquant `/api/prompts` ajouté (corrige `ERR_ABORTED` sur PromptEngine)
- **🧪 Tests unitaires ajoutés** dans `aiClient.test.js` (5 nouveaux) : array format basique, concaténation multi-messages, ignore non-message, deepseek reasoning style avec `input_tokens`/`output_tokens`, content hétérogène (text + refusal + image)
- **🔧 Helper local `forceOpenAIFormat(page)`** dans opencode-zen spec : pré-set `requestFormat: 'openai'` dans `modelMeta` pour skip le format-retry (sinon latence ×2)
- **Validation** : `npx vitest run` → 392/392 tests passent (0 régression), `e2e/providers/opencode-zen.spec.js` → 4/4 ✅ en 37.6s, `e2e/providers/lmstudio.spec.js` → 4/4 ✅ en 23s
- **Suite complète Sprint A/B/C** : 42 ✅ / 6 ⏭️ / 1 ❌ (openrouter test 4 markdown, prompt à rendre plus directif) — **7/8 providers testés en E2E** (ollama, lmstudio, openrouter, groq, mistral, kilo, gemini, opencode-zen)

### 🔧 Instrumentation temporaire (debug, à nettoyer)
- `console.log('[TRACE-OCZ-CHUNK]')` gated par `window.__TRACE_OCZ_CHUNK` dans `aiClient.js` (log de chaque chunk de streaming + moment de `onDone`)
- `console.log('[TRACE-OPENCODE]')` gated par `window.__TRACE_OPENCODE_ZEN` dans `chatPanel.js` (log de chaque étape `sendMessage`)
- Gated par flags `window.__TRACE_*` donc inoffensifs en production, à retirer quand le bug est entièrement résolu

### 📐 Spec — chat-trace-spec v1.2 (traçabilité end-to-end)
- **Spec planification** `.dev-plans/chat-trace-spec.md` v1.0 → v1.2 : traçabilité de bout en bout du flot utilisateur (saisie → rendu DOM) directement dans la console DevTools
- **5 fichiers ciblés** (au lieu de 3 initialement) : `chatPanel.js`, `promptEngine.js`, `optimizeResponse.js`, **`aiClient.js`**, **`systemPrompt.js`**
- **5 helpers de traçage** centralisés dans `src/code-city/ai/traceLogger.js` (à créer) : `traceChat`, `tracePromptEngine`, `traceOptimizer`, `traceAiClient`, `traceSystemPrompt` — préfixes `[CHAT]`, `[PROMPT-ENGINE]`, `[OPTIMIZER]`, `[AI-CLIENT]`, `[SYSTEM-PROMPT]`
- **Activation build-time** via `VITE_CHAT_DEBUG=true` (dev) / `false` (prod) → dead-code-eliminated en prod par Vite/Rollup, **aucune fuite de logs en production**
- **Format mixte** : `console.log` court (ligne d'événement) + `console.groupCollapsed()` collapsibles avec détails (event, data, time)
- **Ring buffer** `window.__CHAT_LOG_BUFFER` (500 entrées max FIFO) accessible depuis DevTools (`copy(window.__CHAT_LOG_BUFFER)`)
- **Timestamps relatifs** `[+${elapsed}ms]` depuis `t0` (chargement du module)
- **Sections ajoutées en v1.2** :
  - **§4.4** (28+ événements `aiClient.js`) : `buildEndpointUrl`, `chatCompletion` ENTRY/URL/bodyBuilt/fetch CALL/OK/4xx/5xx/429/formatRetry/keyRotation/keyExhausted/SUCCESS/THROW, `parseOpenAIResponse` (détection format OpenAI vs OpenCode Zen string/array/object/empty), `parseGeminiResponse`, `streamChatCompletion` ENTRY/fallback/chunk throttlé 1/5/DONE/ERROR, `fimCompletion` ENTRY/SUCCESS/FAILED
  - **§4.5** (5 événements `systemPrompt.js`) : `buildSystemMessages` ENTRY/REPLACE/ENRICH/DEFAULT/SUCCESS
  - **§5.4** + **§5.5** : diffs de code détaillés pour l'instrumentation `aiClient.js` et `systemPrompt.js` (avec détection de format `opencode-zen-empty/string/array/object` et calcul de longueurs de messages)
  - **Phases CT-3.5 + CT-3.6** ajoutées au plan d'implémentation (~5h en plus, total ~15.75h)
- **Tests E2E mis à jour** : capture étendue aux 5 préfixes (`[AI-CLIENT]`, `[SYSTEM-PROMPT]` ajoutés aux regex)
- **Total instrumenté** : 75+ événements répartis sur 5 modules (15+ chatPanel, 25+ promptEngine, 16+ optimiseur, 28+ aiClient, 5+ systemPrompt)
- **Flot end-to-end tracé** : `sendMessage()` → `buildSystemMessages()` → `chatCompletion()` → `parseOpenAIResponse()` → `streamChatCompletion()` → `optimizeResponse()` → DOM rendering

### ✅ Sprint CT-4 (implémentation terminée, validation E2E 5/5)
- **`src/code-city/ai/traceLogger.js`** créé : 5 helpers préfixés (`traceChat`, `tracePromptEngine`, `traceOptimizer`, `traceAiClient`, `traceSystemPrompt`), ring buffer `window.__CHAT_LOG_BUFFER` (500 max FIFO), format mixte `console.log` + `console.groupCollapsed()`, timestamps relatifs `Date.now()`, activation build-time `VITE_CHAT_DEBUG=true` (dev) / `false` (prod) → dead-code-eliminated
- **`.env.development`** + **`.env.production`** créés : `VITE_CHAT_DEBUG=true|false` commited (le `.env` utilisateur reste gitignored)
- **5 fichiers instrumentés** (75+ événements) : `chatPanel.js` (16), `promptEngine.js` (25+), `chatPanel.js optimizeLastResponse` (5), `aiClient.js` (28+), `systemPrompt.js` (5)
- **Tests unitaires** : `src/code-city/ai/traceLogger.test.js` (12 tests, jsdom env) → 12/12 ✅
- **E2E spec** `e2e/chat-trace.spec.js` : 5 tests avec double-gating
  1. **Test 1** : `__CHAT_LOG_BUFFER` initialisé au chargement
  2. **Test 2** : 5 helpers `trace*()` importables depuis `traceLogger.js`
  3. **Test 3** : Envoi d'un message → ≥ 10 entrées couvrant 4 préfixes obligatoires (`[CHAT]`, `[PROMPT-ENGINE]`, `[AI-CLIENT]`, `[SYSTEM-PROMPT]`) + 4 événements clés (`sendMessage ENTRY`, `user message pushed`, `buildSystemMessages`, `preparePrompt`)
  4. **Test 4** : Timestamps `elapsedMs` en ordre chronologique monotone
  5. **Test 5** `@slow` gated `E2E_WITH_LLM=true` : valide la couverture `[AI-CLIENT]` + optimiser en condition réelle — attend `[CHAT] onDone` + un événement d'optimisation (`[PROMPT-ENGINE] optimizeResponse*` OU `[CHAT] optimizeLastResponse BADGE*`)
- **Robustesse du test 5** : `test.beforeAll` skip avec message clair si env-server:3001 absent, `waitForFunction` déterministe (pas de `waitForTimeout` arbitraire), `setOptimizationThreshold(100)` via `window.__state.actions` pour forcer le déclenchement de l'optimiseur, prompt long directif pour réponse > 100 tokens
- **Cleanup** : suppression de `e2e/_debug/chat-trace-diagnose.spec.js` (one-shot diagnostic) + ajout de `e2e/_debug/README.md` documentant les 3 landmines (env-server:3001, keyEvents pré-API-only, chat panel interaction tips)
- **`playwright.config.js`** : `testIgnore: ['e2e/_debug/**']` ajouté (exclut aussi `opencode-zen-trace.spec.js` et `openrouter-test4-trace.spec.js` historiques)
- **Validation finale** :
  - `npx vitest run` → **404/404** ✅ en 1.7s (0 régression)
  - `npx playwright test e2e/chat-trace.spec.js --grep-invert @slow` → **4/4** ✅ en 6.6s (CI rapide)
  - **`E2E_WITH_LLM=true npx playwright test e2e/chat-trace.spec.js` → 5/5 ✅ en 33.7s** (test 5 ✅ en 28.7s, provider openrouter + qwen/qwen3.5-9b + 4 clés API, réponse LLM réelle avec optimisation déclenchée)
- **Divergence spec/code résolue** : `promptEngine.optimizeResponse` utilise maintenant le helper `traceOptimizer` (import ajouté en parallèle de `tracePromptEngine`), et ses **8 événements** internes émettent désormais le préfixe `[OPTIMIZER]` conformément à la spec `chat-trace-spec.md §4.6 + §5.0` (ENTRY / SKIP ×2 / NO_PROVIDER / API_CALL / **ENRICH** / SUCCESS / EMPTY / FAILED). Le test 5 n'accepte plus que `[OPTIMIZER] optimizeResponse*` ou `[CHAT] optimizeLastResponse BADGE*`
- **🆕 Mode `enrich` pour `optimizeResponse`** : nouveau paramètre `options.mode = 'replace' | 'enrich'` (défaut `'replace'`). Si `'enrich'`, le system prompt de l'optimisation concatène `OPTIMIZATION_SYSTEM_PROMPT` avec le contenu du prompt préparé (`preparedPrompt.prompt`) pour donner au LLM d'optimisation le contexte complet du projet. Émet l'événement `[OPTIMIZER] optimizeResponse ENRICH` avec `customPromptLen` + `systemPromptLen` + `enrichedLen`. Mode utile pour conserver la terminologie métier lors de la condensation. Le mode apparaît aussi dans les traces `optimizeResponse ENTRY` (champ `mode`) et `optimizeResponse API_CALL` (champ `mode`). Implémentation : `src/code-city/ai/promptEngine.js` (méthode `optimizeResponse`, ~10 lignes ajoutées). Aucune modif du site d'appel (`chatPanel.optimizeLastResponse`) — le mode par défaut `'replace'` préserve le comportement existant
- **Spec bumped v1.2 → v1.3** : `.dev-plans/chat-trace-spec.md` enrichi avec
  - **§4.6 (nouveau, puis précision v1.3.1, puis mode enrich v1.3.2)** : tableau détaillé des **8 événements** `[OPTIMIZER]` émis par `promptEngine.optimizeResponse` (ENTRY / SKIP ×2 / NO_PROVIDER / API_CALL / **ENRICH** / SUCCESS / EMPTY / FAILED — la ligne ENRICH a été ajoutée après implémentation du mode `enrich` ; elle avait été initialement listée puis retirée pour éviter de réserver un événement non implémenté), justification du préfixe dédié (séparation prompt prep vs post-optimisation), note sur le double préfixe `[OPTIMIZER]` (fonction métier) vs `[CHAT]` (wrapper d'orchestration `optimizeLastResponse`)
  - **§5.0 (étendu)** : table d'alignement `helper ↔ fichier ↔ préfixe ↔ événements typiques` + note historique de l'alignement Sprint CT-4
  - **§10 (étendu)** : 2 nouvelles cases à cocher pour l'alignement helper/fichier + validation E2E_WITH_LLM=true 5/5
  - **En-tête** : version bumpée 1.2 → 1.3, date 2026-06-10 → 2026-06-11, mention `traceOptimizer` dans le champ `Fichiers cibles`

---

## [Non publié]

### En cours
- Refonte des documentations (`README.md`, `src/code-city/README.md`, `CHANGELOG.md`)
- Support OpenCode Zen avec auto-détection de format OpenAI / Anthropic
- Amélioration du `state.js` : chargement des clés API depuis `.env` au démarrage
- **Tests E2E d'intégration providers** (Sprint A du plan `providers-e2e-spec.md`)

---

## [1.0.0] — 2026-06-09

### ✨ Ajouté
- **Mina — Assistant IA complet**
  - Chat latéral avec streaming SSE, typewriter (10ms) et synchronisation Markdown (500ms)
  - Stats streaming (tokens / secondes) dans le header du chat
  - Post-optimisation automatique des réponses > seuil configurable (défaut 500 tokens)
  - Quick Actions catégorisées (Analyse, Suggestion, Documentation, Enrichissement)
  - Régénération et re-préparation de prompt (force-refresh, ignore cache)
  - Boutons copier (feedback ✓ 1.5s) et régénérer par message
  - Noms grecs par provider (Mina, Athéna, Atlas, Éole, Héphaïstos, Dédale, Prométhée)
  - Section prompt repliable par message (cache-hit, tokens, badge « ✨ amélioré »)

- **Système de providers refondu**
  - 8 providers : OpenRouter, Gemini, Mistral, Groq, OpenCode Zen, Kilo Code, Ollama, LM Studio
  - Configs découplées de la logique (JSON : `provider-configs.json` + `providers-grid.json`)
  - Panneau Providers 3 zones : Status sticky (provider + modèle + latence + clé `.env` + barre 6 étapes), grille des providers, workflow guidé
  - Workflow 6 étapes : URL → Clé → Modèles → Sélection → Test → OK
  - Persistance dans fichiers serveur (`/api/providers/{id}.json`) — bouton « 💾 Enregistrer » comme seul point de persistance
  - Persistance provider actif (`/api/active-provider` — ID uniquement)
  - Endpoint serveur `/.env` → `/api/env` (lecture seule, mémoire uniquement)
  - Multi-clés avec rotation LRU : `FOO`, `FOO_1`, …, `FOO_20` sur 429/401/timeout
  - Provider custom via `actions.addCustomProvider()`
  - API Keys Modal pour gérer visuellement les clés disponibles

- **Prompt Engine**
  - Détection automatique du type d'action (analysis / suggestion / documentation / enrichment / architecture / conversation)
  - Sérialisation du contexte graphe → texte (troncature selon `contextWindow`)
  - Templates de prompt spécialisés par type
  - Cache par clé `type-contextHash` avec invalidation sur événements canvas
  - Modèle de préparation distinct (optionnel) — différent du modèle de chat
  - Seuil d'optimisation configurable (slider 100–2000 tokens)
  - Statistiques cumulées d'optimisation (nombre, tokens économisés, taux de compression)

- **FIM (Fill-in-the-Middle) inline**
  - Provider Mistral : endpoint `/fim/completions`
  - Déclencheur : `Ctrl+Shift+C` dans le textarea `#code-preview` (avec sélection)
  - Toast de progression et insertion au curseur

- **AI Client unifié (`aiClient.js`)**
  - `chatCompletion`, `streamChatCompletion`, `fimCompletion`
  - `testConnection`, `fetchModels`, `testModel`
  - Détection auto OpenAI / Anthropic (essai `data.choices` puis `data.output`)
  - Auto-fallback de format pour OpenCode Zen (OpenAI → Anthropic sur 400)
  - Timeout 30s + rotation sur timeout réseau
  - `toLocalUrl()` : proxy CORS Vite pour Ollama, LM Studio, Kilo, OpenCode Zen

- **Export « Livre de Développement »**
  - ZIP structuré en 5 sprints par priorité : `critical` → `high` → `medium` → `low` → `backlog`
  - README roadmap généré (timeline ASCII, checklists par sprint, statistiques)
  - `_sprint.md` + `_index.md` par sprint + fichiers numérotés
  - Tri topologique (Kahn) au sein de chaque sprint pour respecter les dépendances
  - 3 modes : `full`, `subtree` (BFS), `selected` (1 nœud)
  - Hubs exclus du tri et de l'export
  - Templates Markdown spécialisés par catégorie (process, arch, sec, data, proj, test, uiux, pattern, devops, component, dep, …)
  - Schémas JSON inline pour `service.requestSchema` / `responseSchema` / `data.schema`

- **Export PNG / SVG / MMD**
  - MMD brut, SVG via `mermaid.render()`, PNG via canvas × scale (Retina ×2 par défaut)
  - Dimensions extraites du `viewBox` ou `width/height`
  - Fond blanc par défaut sur PNG

- **Raccourcis clavier étendus**
  - `Ctrl+Shift+A` : ouvrir le chat
  - `Ctrl+Shift+C` : FIM inline
  - `/` (hors champ) : ouvrir le chat et focuser l'input
  - `F2` / `Enter` : ouvrir les propriétés du nœud sélectionné
  - `Ctrl+C/V/D` : copier / coller / dupliquer (avec translation grille × 2)
  - `Ctrl+A` : tout sélectionner
  - `Ctrl++/-/0` : zoom in / out / reset
  - `↑↓←→` / `Shift+↑↓←→` : nudge 20px / 100px

- **Données & validation**
  - `data/validation-models.json` : modèle par défaut par provider
  - `data/provider-configs.json` : source de vérité des providers (enabled, baseUrl, envKey, icon, description)
  - `data/providers-grid.json` : layout de la grille de présentation

- **Tests étendus**
  - 16 fichiers E2E Playwright : `assistant`, `assistant-fim`, `assistant-context`, `api-keys-modal`, `export`, `export-preview`, `features`, `hub-workflow`, `mermaid-properties-sync`, `palette-dragdrop`, `prompt-engine`, `properties`, `providers`, `streaming-rendering`, `undo-redo`
  - 13 fichiers de tests unitaires Vitest

- **Documentation**
  - Refonte `README.md` racine (Mina, providers, export sprints, démarrage rapide)
  - Refonte `src/code-city/README.md` (architecture technique détaillée, 12 sections)
  - Création du présent `CHANGELOG.md`

### 🔧 Modifié
- **`state.js`**
  - Bloc `assistant.*` enrichi (provider, configs, chatHistory, currentPrompt, promptHistory, promptCache, contextWindow, preparationModel, optimizationThreshold, optimizationStats)
  - Migration d'IDs systématique dans `loadGraph()` (`n1, n2, …` / `e1, e2, …`)
  - Ré-étalonnage automatique des compteurs internes sur chargement
  - `setProvider(id)` restauré depuis cache in-memory + clé `.env`
  - `setProviderConfig` exclu `apiKey` / `envKey` / `modelMeta` avant écriture disque
  - `popLastChatMessage(role)` ajouté (utilisé par la régénération, évite de vider l'historique en cas d'échec)
  - `validateProviderConfigsOnInit()` : réinitialise les providers qui n'ont plus de clé `.env`

- **`mermaid/build.js`**
  - `buildMermaidCode()` : hubs résolus en arêtes directes `source → target` (commentaire invisible)
  - `parseMermaidCode()` : parser best-effort, déduit le type depuis la forme Mermaid
  - `renderMermaidToSvg()` : wrapper `mermaid.render()`
  - Mapping `SHAPE_BY_TYPE` étendu (~200 types : process, decision, arch, sec, data, devops, proj, test, uiux, pattern, component, dep, msg, env, init, git, service, hub)
  - Annotations `%% @props` pour le round-trip des propriétés
  - Échappement safe pour `htmlLabels:true` (chevrons, guillemets, sauts de ligne)

- **`persistence.js`**
  - Debounce 400ms sur les notifications
  - Vérification quota via `navigator.storage.estimate()` (avertissement > 80%)

- **`keyboard.js`** : refonte pour intégrer FIM et raccourcis chat
- **`code-city.js`** : structure HTML documentée en tête de fichier
- **Vite proxy** : `/local-api/{id}/*` pour Ollama / LM Studio / Kilo / OpenCode Zen

### 🐛 Corrigé
- CORS sur providers locaux via proxy Vite
- Boucle infinie pipeline Mermaid ↔ state (drapeau `isApplyingFromState`)
- Auto-loop interdit sur `completeConnection()`
- Réconciliation des arêtes par triplet `from/to/label` dans `pipeline.applyUserEdit()`
- Suppression des sections `providerConfig` qui n'ont plus de clé `.env` au boot
- Sauvegarde atomique : `popLastChatMessage` + `pushChatMessage` au lieu de `clearChatHistory + re-add`

---

## [0.9.0] — 2026-06-05

### ✨ Ajouté
- **Système de propriétés par catégorie**
  - `propertySchemas.js` : 17 schémas (process, decision, service, devops, arch, sec, data, proj, test, uiux, pattern, env, component, git, msg, init, dep)
  - Champs typés : `text`, `textarea`, `select`, `date`
  - Formulaire dynamique dans l'onglet Propriétés
  - Catégorie auto-déduite du préfixe du `type` (`getCategory()`)
- **Onglet Code** avec binding bidirectionnel Mermaid
- **Onglet Propriétés** avec formulaire spécifique à la catégorie
- **Export complet** : MMD, SVG, PNG, ZIP par catégories (`architecture/`, `devops/`, `security/`, `testing/`, `components/`, `project/`)
- **Project name input** dans le panneau d'export
- **Screenshots démo** dans `assets/` (`editeur.png`, `proprietes.png`)

### 🔧 Modifié
- Palette sidebar : 6 catégories accordéon, recherche, compteur
- Toolbar : undo/redo, zoom, grid toggle, fit-to-screen
- Status bar : compteur nœuds, zoom %, thème, message
- Thème clair/sombre persisté (`code-city-theme`)

---

## [0.8.0] — 2026-06-04

### 🔧 Modifié
- **Refonte complète du branding MINAUTOR**
  - Logo SVG avec badge « M » shimmer + reveal du texte
  - Top bar : actions Effacer / Exporter / Thème (palette dédiée)
  - README orienté marketing avec emojis et badges
- **Restructuration du code en « quartiers »**
  - `quartierTop/`, `quartierLeft/`, `quartierCenter/`, `quartierRight/`, `quartierBottom/`
  - `code-city.js` comme orchestrateur d'init
  - Source unique de vérité HTML dans `createBaseStructure()`
- **Refactor `mermaid/`**
  - `build.js` : génération + parsing + rendu SVG (avant : `parse.js` séparé)
  - `pipeline.js` : sync bidirectionnelle state ↔ textarea
  - `export.js` : téléchargement multi-formats
  - `docGenerator.js` : templates Markdown par catégorie
  - `zipExporter.js` : assemblage JSZip

### 🗑️ Supprimé
- `utils.js` (helpers dépréciés)
- `fonctionsCanvasCenter/` (rôle repris par `render/canvasRenderer.js`)
- `menuActionsCenter/` (rôle repris par `quartierRight/`)

---

## [0.5.0] — 2026-06-02

### ✨ Ajouté
- Refonte complète par modèle M3 (« Excelent »)
- Architecture 5 quartiers (Top / Left / Center / Right / Bottom)
- Canvas SVG avec grid, drag, pan, zoom molette
- Connexion par ports (in / out / top / bottom)
- Hubs (connecteurs multiples 4/6/8/10 branches)
- Undo / Redo (50 états, `snapshot()`)
- Persistance localStorage (`code-city-graph`)
- Raccourcis : Ctrl+Z/Y/S/A, flèches, F2
- Mapping des types vers formes Mermaid
- Pipeline Mermaid bidirectionnel avec debounce 350ms
- Export MMD / SVG / PNG basique
- Templates de doc Markdown par catégorie

---

## [0.1.0] — 2025-10-11

### ✨ Ajouté
- Structure HTML initiale pour Mermaid Canvas Generator
- Configuration de tests fonctionnels
- Setup Vite + Mermaid de base

---

## Types de changements

* **Ajouté** pour les nouvelles fonctionnalités.
* **Modifié** pour les changements aux fonctionnalités existantes.
* **Déprécié** pour les fonctionnalités qui seront bientôt supprimées.
* **Supprimé** pour les fonctionnalités supprimées.
* **Corrigé** pour les corrections de bogues.
* **Sécurité** pour les vulnérabilités.

[1.0.0]: #100--2026-06-09
[0.9.0]: #090--2026-06-05
[0.8.0]: #080--2026-06-04
[0.5.0]: #050--2026-06-02
[0.1.0]: #010--2025-10-11
[Non publié]: #non-publé
