# Code City — Architecture technique

> Éditeur visuel de diagrammes Mermaid avec assistant IA intégré, propriétés
> structurées par catégorie, et export ZIP « Livre de Développement » organisé
> en sprints de priorité.

Ce document décrit l'architecture **interne** de l'application (quartiers,
modules, flux de données, sous-système AI). Pour la documentation marketing
et le mode d'emploi, voir le [`README.md`](../../README.md) racine.

---

## 1. Vue d'ensemble

L'application est organisée en **5 quartiers** (top / left / center / right /
bottom), avec deux sous-systèmes transverses : **AI** (assistant + providers)
et **Mermaid** (build / pipeline / export).

```
┌──────────────────────────────────────────────────────────────────┐
│  QUARTIER TOP         logo + actions (theme, export, providers…)  │
├──────────┬───────────────────────────────────────────┬────────────┤
│          │  QUARTIER CENTER                          │            │
│  LEFT    │  ├── onglets : Éditeur / Aperçu /         │  RIGHT     │
│  palette │  │   Code / Propriétés                    │  Code +    │
│  +       │  ├── toolbar (undo/redo, zoom, grid)     │  Props     │
│  search  │  ├── canvas-grid / canvas-content / SVG   │  panel     │
│  +       │  └── preview Mermaid (rendu live)        │            │
│  config  │                                           │            │
├──────────┴───────────────────────────────────────────┴────────────┤
│  QUARTIER BOTTOM      status (compteur, zoom, message)            │
└──────────────────────────────────────────────────────────────────┘
            │
            ├── PANNEAUX LATÉRAUX (overlay, rétractables) ──┐
            │   • Providers (#app-providers)                │
            │   • Chat Mina (#app-chat)                     │
            │   • Export    (#app-export)                   │
            └────────────────────────────────────────────────┘
```

### Stack

| Couche        | Techno                                         |
|---------------|------------------------------------------------|
| Build         | Vite 5 (ESM, HMR, proxy `/local-api/*`)       |
| Rendu         | Mermaid 10 + Canvas SVG custom + JS DOM        |
| Stockage      | localStorage (graphe) + fichiers JSON serveur (providers) + `.env` (clés API) |
| Tests         | Vitest (unitaires) + Playwright (E2E)          |
| UI            | Aucun framework — CSS Grid + Custom Properties |

---

## 2. Point d'entrée et ordre d'initialisation

`code-city.js` est l'orchestrateur. La séquence est strictement ordonnée
(certaines étapes sont bloquantes) :

```text
initializeApp() — async
├── 1.  createBaseStructure()                 synchrone, pose le DOM
├── 1b. loadEnvKeys()                         GET /api/env → cache en mémoire
├── 1c. initAssistant()                       chat history + provider actif + .env
├── 1d. validateStoredProvider()              sanity check (provider encore valide)
├── 2.  initializeHistoryCanvasCenter()       boutons undo/redo
├── 2.  installKeyboardShortcuts()            raccourcis globaux
├── 3.  Promise.all([                         en parallèle
│        initializeQuartierTop(),
│        initializeQuartierLeft(),
│        initializeQuartierCenter(),
│        initializeCenterAuxPanels(),
│        initializeExportPanel(),
│        initializeProviderPanel(),
│        initializeChatPanel(),
│        initializeQuartierBottom()
│     ])
├── 3b. bouton « Tout ouvrir/fermer » palette
├── 4.  restoreFromStorage()                  localStorage → state
└── 4.  startAutoSave()                       subscribe + debounce 400ms
```

> Règle : `state.js` (et donc `initAssistant()`) doit être appelé **avant**
> les panneaux, car ces derniers lisent `getState().assistant.*` au montage.

---

## 3. Le store d'état — `state.js`

Cœur de l'application. Source unique de vérité, exposée via :

| API                      | Usage                                                |
|--------------------------|------------------------------------------------------|
| `getState()`             | Snapshot synchronique (mutations interdites)         |
| `subscribe(fn)`          | Notification `{ type, … }` à chaque mutation         |
| `actions.…`              | Seule façon de muter (mutation directe interdite)    |
| `snapshot()`             | Vue sérialisable (utilisée par undo/redo)            |
| `window.__state`         | Accès debug + tests E2E Playwright                   |

### Forme du state

```text
state
├── nodes              : Node[]        — éléments du graphe
├── edges              : Edge[]        — connexions orientées
├── selection          : { nodes: Set, edges: Set }
├── mode               : 'select' | 'connect'
├── connection         : { from, port } — pending connection
├── hover              : { node, edge }
├── view               : { theme, zoom, pan, gridVisible, snapToGrid }
├── status             : { elementCount, zoomPercent, theme, message, messageType }
└── assistant          : AssistantState — voir § 6
```

### Catégories d'actions

| Catégorie        | Actions principales                                                        |
|------------------|----------------------------------------------------------------------------|
| Graphe           | `addNode`, `updateNode`, `removeNode`, `addEdge`, `removeEdge`, `createHub`, `updateHubBranches`, `clear`, `loadGraph` |
| Sélection        | `setSelection`, `selectNode`, `deselectAll`                                 |
| Mode             | `setMode`, `startConnection`, `completeConnection`, `cancelConnection`      |
| Vue              | `setTheme`, `setZoom`, `setPan`, `setGridVisible`, `setSnapToGrid`          |
| Statut           | `setStatusMessage`                                                         |
| Assistant        | `setProvider`, `updateProvider`, `addCustomProvider`, `resetProvider`, `setProviderConfig` |
| Prompt engine    | `setCurrentPrompt`, `clearPromptCache`, `setContextWindow`, `setPreparationModel`, `setOptimizationThreshold`, `updateOptimizationStats` |
| Chat             | `pushChatMessage`, `clearChatHistory`, `popLastChatMessage`                |
| Historique       | `undo`, `redo`, `canUndo`, `canRedo`                                       |

### Migration d'IDs

`actions.loadGraph()` ré-attribue systématiquement des IDs propres
(`n1, n2, …` / `e1, e2, …`) et reconstruit la table `from/to` des arêtes.
Les anciens IDs `node-…` / `edge-…` ou tout autre format sont acceptés à
l'entrée et normalisés. Les compteurs internes (`nextNodeNum`,
`nextEdgeNum`) sont ré-étalonnés via `resyncCounters()` pour que les
nouveaux éléments ne collisionnent pas.

### Hubs

Les `hub` sont des nœuds **canvas-only** (pas d'équivalent Mermaid, pas
de doc dans l'export). Ils matérialisent un connecteur multiple (4, 6, 8
ou 10 branches) attaché à un port d'un nœud source. `build.js` les
résout en arêtes directes `source → target` au moment de la génération
Mermaid.

---

## 4. Persistance

Deux systèmes, **complémentaires** :

### 4.1 localStorage — `persistence.js`

- **Clé** : `code-city-graph`
- **Contenu** : `{ version, savedAt, nodes, edges, view }`
- **Mode** : debounce 400ms, déclenché par `subscribe()` (sauf `hover:*` et
  `selection:*` qui ne sont pas pertinents à persister)
- **Quota** : `navigator.storage.estimate()` est utilisé pour avertir
  l'utilisateur au-delà de 80% du quota
- **Charger** : `restoreFromStorage()` (appelé en fin d'init)

### 4.2 Serveur — `/api/state` + `/api/providers/{id}` + `/api/active-provider`

Implémenté dans `scripts/dev.mjs` (serveur Node intégré à Vite) :

| Endpoint                  | Méthode | Contenu                                       |
|---------------------------|---------|-----------------------------------------------|
| `/api/state`              | GET/POST| Chat history (`chatHistory[]`)                |
| `/api/providers/{id}`     | GET/POST/DELETE | Config d'un provider (modèle, threshold, …) |
| `/api/providers`          | GET     | Liste des providers avec config sauvegardée   |
| `/api/active-provider`    | GET/POST| ID du provider actif (pas la config complète) |
| `/api/env`                | GET     | Variables d'environnement du `.env` (clés API) |

**Règle d'or** : seul le bouton « 💾 Enregistrer » du panneau Providers
écrit sur le disque. Tout le workflow (test clé, sélection modèle,
validation) vit en mémoire. Les clés API ne sont **jamais** envoyées au
navigateur depuis le state — elles transitent par `.env` (côté serveur)
et le proxy `/api/env` (lecture seule, mémoire uniquement).

---

## 5. Mermaid — `mermaid/`

Sous-système qui transforme le graphe interne ↔ code Mermaid et gère
l'export multi-formats.

```
mermaid/
├── build.js          génération + parsing + rendu SVG
├── pipeline.js       sync bidirectionnelle state ↔ textarea
├── export.js         téléchargement .mmd / .svg / .png
├── docGenerator.js   génération Markdown par catégorie (process, arch, sec, …)
├── zipConstants.js   métadonnées des 5 sprints (PRIORITY_ORDER, SPRINT_META)
└── zipExporter.js    assemblage JSZip + README roadmap
```

### 5.1 `build.js`

| Fonction             | Rôle                                                    |
|----------------------|---------------------------------------------------------|
| `buildMermaidCode()` | `graph TD` + annotations `%% @props` pour les propriétés |
| `parseMermaidCode()` | Parser best-effort, déduit types depuis la forme Mermaid |
| `renderMermaidToSvg()`| `mermaid.render(id, code)` → SVG                       |
| `quoteLabel()` / `quotePlainLabel()` | Échappement safe pour htmlLabels:true |

**Mapping type → forme Mermaid** : voir `SHAPE_BY_TYPE` (process, decision,
hub, arch, sec, …) et `shapeFor()` (heuristiques de repli par préfixe
`component-*`, `service-*`, `pattern-*`, etc.).

**Round-trip propriétés** : les propriétés sérialisées sont injectées en
commentaire `%% @props {id} {json}` que le parser restaure. Une ligne
`%% @props` supprimée = propriétés vidées (sémantique explicite).

### 5.2 `pipeline.js`

Deux sens, protégés par un drapeau `isApplyingFromState` pour éviter la
boucle infinie :

```text
state (mutation) ──► subscribe ──► refreshFromState() ──► textarea.value = code
textarea (input)  ──► debounce 350ms ──► parseMermaidCode() ──► loadGraph()
```

### 5.3 `export.js`

| Format | Méthode   | Détail                                              |
|--------|-----------|-----------------------------------------------------|
| `.mmd` | `exportCode()` | Blob text/plain                               |
| `.svg` | `exportSvg()`  | `mermaid.render()` → SVG brut               |
| `.png` | `exportPng(scale=2)` | Canvas + `drawImage` du SVG (Retina)  |

### 5.4 `docGenerator.js` — templates par catégorie

Pour chaque catégorie (déduite du préfixe du `type` via `getCategory()`),
un template Markdown adapté est rendu :

- `process` : entrées / sorties / étapes
- `decision` : options / critères / choix retenu
- `service` : endpoint, méthode, auth, schémas JSON
- `devops` : outil, déclencheurs, étapes, rollback
- `arch` / `pattern` : ADR-like (problème / solution / alternatives / compromis / conséquences)
- `sec` : menace, sévérité, mitigations (checklist)
- `proj` : assignee, estimation, deadline, acceptance criteria
- `test` : couverture, framework, cas de test, résultat
- … (cf. `propertySchemas.js` pour la liste des champs par catégorie)

Fonctions transverses : `resolveSubtree(nodeId, edges)` (BFS successeurs,
max depth 50), `topologicalSort(nodes, edges)` (Kahn), et les templates
décrits ci-dessus.

### 5.5 `zipExporter.js` — export ZIP « Livre de Développement »

Structure du ZIP produit par `generateZip(graph, mode, nodeId, svgCode)` :

```text
export-{nom}/
├── README.md                       Roadmap complète (timeline + checklists + stats)
├── diagram.svg                     (optionnel, si svgCode fourni)
├── sprint-1-critical/              🔴 Bloque le projet
│   ├── _sprint.md                  Intro du sprint + tableau récap
│   ├── _index.md                   Table des matières
│   └── NN-{label}.md               Numérotés par ordre topologique
├── sprint-2-high/                  🟠 Prioritaire
├── sprint-3-medium/                🟡 Standard
├── sprint-4-low/                   🟢 À planifier
└── sprint-5-backlog/               ⚪ Non catégorisé (priority absente)
```

- **Modes** : `full` (tout), `subtree` (BFS depuis `nodeId`), `selected` (1 nœud)
- **Hubs exclus** (filtre dur dans `generateZip`)
- **Tri topologique dans chaque sprint** (Kahn) pour respecter l'ordre des dépendances
- **Sprint déduit de `node.priority`** via `getPriorityKey()` :
  `critical` → 1, `high` → 2, `medium` → 3, `low` → 4, `undefined` → 5

---

## 6. Sous-système AI — `ai/`

C'est la partie la plus dense du projet. Tous les modules tournent
autour de `state.assistant.*` et du client HTTP `aiClient.js`.

### 6.1 Architecture d'ensemble

```
                ┌──────────────────────────────────────────┐
                │           state.assistant                │
                │  provider, providerConfigs, chatHistory, │
                │  currentPrompt, promptHistory,           │
                │  contextWindow, preparationModel,        │
                │  optimizationThreshold, optimizationStats│
                └──────────────────────────────────────────┘
                       ▲            │            │
              setProvider│          │            │pushChatMessage
                       │            │            │
        ┌──────────────┴────┐  ┌────┴─────────┐ ┌┴──────────────┐
        │ providerPanel.js  │  │ chatPanel.js │ │ envLoader.js  │
        │ workflow 6 étapes │  │ streaming +  │ │ fetch /api/env│
        │ 1→2→3→4→5→6       │  │ typewriter + │ │ rotation LRU  │
        └───────────────────┘  │ markdown sync│ └───────────────┘
                               │ promptEngine │
                               └──────┬───────┘
                                      │ streamChatCompletion
                                      ▼
                            ┌────────────────────┐
                            │  aiClient.js       │
                            │ chatCompletion()   │
                            │ streamChatCompletion()│
                            │ fimCompletion()    │
                            │ testConnection()   │
                            │ fetchModels()      │
                            │ testModel()        │
                            └────────┬───────────┘
                                     │ fetch (proxy /local-api/* en dev)
                                     ▼
                            ┌────────────────────┐
                            │ Provider HTTP      │
                            │ OpenAI / OpenRouter│
                            │ Anthropic / Gemini │
                            │ Ollama / LMStudio  │
                            │ Kilo / OpenCodeZen │
                            └────────────────────┘
```

### 6.2 Modules

| Fichier                  | Rôle                                                                    |
|--------------------------|-------------------------------------------------------------------------|
| `aiClient.js`            | Client HTTP LLM : chat, streaming SSE, FIM, test, modèles. Détection auto du format (OpenAI / Anthropic). Rotation LRU. |
| `envLoader.js`           | Cache `/.env` via `GET /api/env`. Multi-clés (`FOO`, `FOO_1`, …) + rotation LRU sur 429. |
| `providerLoader.js`      | Lit `data/provider-configs.json` et `data/providers-grid.json`. Source de vérité des presets. |
| `providerStore.js`       | API client pour `/api/providers/{id}` et `/api/active-provider`. CRUD config persistée. |
| `providerPanel.js`       | Panneau latéral Providers (workflow 6 étapes + grille + status sticky). |
| `apiKeysModal.js`        | Modale de gestion des clés API (lecture seule depuis `/api/env`). |
| `chatPanel.js`           | Panneau latéral Chat. Streaming, typewriter + sync Markdown, post-optimisation, regenerate, quick actions. |
| `systemPrompt.js`        | Construction des messages système (canvas context, persona Mina, …). |
| `contextBuilder.js`      | Sérialisation du graphe → texte pour le prompt système. |
| `chatHistory.js`         | `trimHistory()`, `estimateTokens()`, constantes `MAX_HISTORY_MESSAGES`. |
| `markdownRenderer.js`    | Rendu Markdown des messages (avec support streaming incrémental). |
| `quickActions.js`        | Catalogue d'actions rapides classées par catégorie (Analyse, Suggestion, …). |
| `promptEngine.js`        | Préparation de prompts adaptés au type d'action + cache (clé `type-contextHash`). |
| `fimHandler.js`          | Complétion FIM inline (Mistral) pour le textarea `#code-preview`. Déclenché par `Ctrl+Shift+C`. |
| `workflowRunner.js`      | Machine à états 6 étapes du panneau Providers (URL → clé → modèles → sélection → test → OK). |
| `toast.js`               | Notifications transitoires (info / success / warning / error). |
| `validation-models.json` | Modèles par défaut (datasource `state.js` pour `validationModels[id]`). |

### 6.3 `aiClient.js` — client LLM unifié

**Fonctions publiques** :

```text
chatCompletion(provider, messages, { maxRetries, noRotation, onFormatDetected })
  → { content, usage, detectedFormat? }

streamChatCompletion(provider, messages, { onToken, onDone, onError }, signal)
  → { content, usage }                      // fallback non-streaming pour OpenCode Zen

fimCompletion(provider, prefix, suffix)     // Mistral uniquement
  → { content, usage }

testConnection(provider)                    // ping le provider
  → { ok, latency, models?, error? }

fetchModels(provider)                       // modèles disponibles
  → Array<{ id, name, contextWindow?, isFree? }>

testModel(provider, modelId)                // chat + détection capabilities (chat, fim)
  → { format, requestFormat, capabilities, contextWindow, latency }
```

**Détails clés** :

- **Détection auto OpenAI / Anthropic** : `parseOpenAIResponse()` essaie
  `data.choices[0]` puis `data.output` (le format OpenCode Zen /
  Anthropic Messages renvoie `{ output: "..." }` ou `{ output: { content: "..." } }`).
- **Auto-fallback de format** : pour `opencode-zen`, si le format OpenAI
  (`/responses`) échoue avec une 400, retry automatique en Anthropic
  (`/messages`). Le format réussi est notifié via `onFormatDetected`.
- **Rotation LRU des clés API** : sur 429, on tente la prochaine clé
  (`FOO_1`, `FOO_2`, …). Sur 401 (`opencode-zen`), idem. Sur 400 « model
  not supported », on **ne tourne pas** (ça ne changera rien avec une
  autre clé). Sur timeout réseau, rotation automatique.
- **Proxy CORS** : `toLocalUrl()` réécrit les URLs des providers locaux
  (`ollama`, `lmstudio`) et de certains providers en ligne avec path
  préfixé (`kilo`, `opencode-zen`) vers `/local-api/{id}/*`, géré par
  Vite (cf. `vite.config.js`).

### 6.4 `envLoader.js` — chargement des clés `.env`

- Source : `GET /api/env` (endpoint Node, renvoie un dict clé/valeur)
- Cache en mémoire (invalidation possible via `invalidateCache()`)
- **Multi-clés** : pour un `envKey` de base `FOO`, accepte `FOO`,
  `FOO_1`, `FOO_2`, … jusqu'à `_20`
- **Rotation LRU** : `getNextApiKey(baseEnvKey)` retourne la prochaine
  clé dans l'ordre circulaire. `resetRotationIndex()` à utiliser après
  une erreur non-429 (ne pas reset pendant une rotation, sinon on boucle
  sur la même clé).

### 6.5 `providerPanel.js` — workflow 6 étapes

```text
1. URL         → validateStoredProvider() (implicite à la sélection)
2. Clé API     → testApiKey() → fetch test chat
3. Modèles     → fetchModels() → liste dans le DOM
4. Sélection   → click sur un modèle → testModel() (chat + capabilities)
5. Test        → testModel() retourne { format, capabilities, latency }
6. OK          → état final (config encore en mémoire)
                  → bouton « 💾 Enregistrer » écrit dans /api/providers/{id}
```

Composants principaux :
- **Zone status sticky** : nom du provider, indicateur (vert / orange /
  gris), modèle, latence, format, présence d'une clé `.env`, barre de
  progression 6 étapes.
- **Grille des providers** : générée depuis `providers-grid.json` (via
  `providerLoader.getGridSections()`). Séparée en deux colonnes selon
  la longueur du nom (court → gauche, long → droite).
- **Workflow zone** : `renderEmptyWorkflow`, `renderLoadingStep`,
  `renderApiKeyStep`, `renderModelSelectionStep` (avec search + toggle
  « voir tous »), `renderValidatedStep` (récap + options avancées
  repliables : seuil d'optimisation, modèle de préparation, stats
  cumulées).

### 6.6 `chatPanel.js` — chat Mina (streaming)

**Layers de streaming** (optimisation UX) :

1. **Typewriter (10ms)** : ajoute les nouveaux caractères en texte brut
   dans la bulle (effet machine à écrire)
2. **Markdown sync (500ms)** : ré-applique le rendu Markdown complet
   (mise en forme) toutes les 500ms
3. **Stats (200ms)** : compteur de tokens + barre de progression dans
   le header (disparaît en fade-out 2s après la fin)
4. **Post-optimisation** : si la réponse dépasse
   `optimizationThreshold` (par défaut 500 tokens), un appel
   supplémentaire est fait via `promptEngine.optimizeResponse()` pour
   condenser. Stats cumulées dans `state.assistant.optimizationStats`.

**Quick actions** (`quickActions.js`) :

Catégories de prompts pré-écrits envoyées au LLM :
- **Analyse** : Analyser, Identifier les risques, Audit de cohérence, …
- **Suggestion** : Proposer des améliorations, Suggérer des cas de test, …
- **Documentation** : Générer la doc, Rédiger un ADR, …
- **Enrichissement** : Enrichir les propriétés, Compléter les champs vides, …

**Boutons par message** : copier (avec feedback ✓ 1.5s), régénérer
(réutilise `popLastChatMessage` pour ne pas perdre l'historique en cas
d'échec), re-préparer le prompt (force `forceRefresh`).

**Noms grecs par provider** (affichés dans le titre) :

| Provider       | Nom affiché |
|----------------|-------------|
| openrouter     | Mina        |
| kilo           | minautor    |
| gemini         | Atlas       |
| opencode-zen   | Athéna      |
| mistral        | Éole        |
| groq           | Héphaïstos  |
| ollama         | Dédale      |
| lmstudio       | Prométhée   |

### 6.7 `promptEngine.js` — préparation et optimisation

```text
preparePrompt(userText, graph, { forceRefresh })
  1. Identifie le type d'action (analysis / suggestion / documentation / enrichment / architecture / conversation)
     via matching sur les quick actions + heuristiques de mots-clés
  2. Sérialise le contexte (graph → text, tronqué selon contextWindow)
  3. Injecte le contexte + le template de prompt spécifique au type
  4. Si forceRefresh=false ET cache hit (clé = type-contextHash) → renvoie le cache
  5. Sinon calcule et stocke dans state.assistant.promptCache

optimizeResponse(originalContent, preparedPrompt, provider)
  → Renvoie la version condensée de la réponse (appel LLM séparé)
```

---

## 7. Quartiers

### 7.1 `quartierTop/`

- `logoTop.js` : logo SVG inline (badge « M » shimmer + reveal du texte)
- `menuActionsTop/` :
  - `assistantActionTop.js` : bouton → toggle chat
  - `providersActionTop.js` : bouton → toggle panneau providers
  - `exporterActionTop.js` : bouton → toggle panneau export
  - `effacerActionTop.js` : confirmation → `actions.clear()`
  - `themeClairSombreActionTop.js` : toggle light/dark
  - `menuActionsTop.js` : agrégateur (rendu des boutons dans `.top__actions`)

### 7.2 `quartierLeft/` — palette

`fonctionsMermaidLeft/menuMermaidActionsLeft/menuMermaidActionsLeft.js` :

- **6 catégories accordéon** : Processus, Décision, Services, DevOps,
  Architecture, Sécurité, etc. (cf. `propertySchemas.js` +
  `data/providers-grid.json`)
- **Recherche** : input `#palette-search` + clear button
- **Compteur** : `#palette-count` mis à jour dynamiquement
- **Collapse all / expand all** : bouton `Tout ouvrir` / `Tout fermer`
- **Drag & drop** : payload enrichi (`type`, `variant`, `icon`,
  `color`, `background`) déposé sur le canvas → `actions.addNode()`

### 7.3 `quartierCenter/`

Structure onglettée (`centerTabs.js`) : **Éditeur** / **Aperçu** / **Code** /
**Propriétés**.

- `structureCanvasCenter/structureCanvasCenter.js` : pose la grille
  (`canvas-grid`), le contenu (`canvas-content`), et l'overlay
  (`canvas-overlay` pour les edges SVG)
- `structureCanvasCenter/zoomCanvasCenter.js` : zoom molette + pan + fit-to-screen
- `structureCanvasCenter/grilleCanvasCenter.js` : grille SVG
- `structureCanvasCenter/historyCanvasCenter.js` : boutons undo/redo
- `previewPanel.js` : rendu Mermaid live (re-render debounced)
- `centerAuxPanels.js` (quartierRight) : onglets Code (copy) + Propriétés
  (formulaire dynamique via `propertySchemas.js`)

### 7.4 `quartierRight/`

- `centerAuxPanels.js` : onglets **Code** (textarea readonly) +
  **Propriétés** (formulaire piloté par `propertySchemas.getSchemaForType()`)
- `exportPanel.js` : panneau rétractable d'export (MMD / SVG / PNG /
  ZIP avec choix de mode : full / subtree / selected)

### 7.5 `quartierBottom/`

`quartierBottom.js` : status bar minimale lue depuis `state.status` :

- Compteur d'éléments (hubs inclus)
- Zoom %
- Message d'état (info / success / warning / error, avec auto-clear)
- Thème courant (Clair / Sombre)

---

## 8. Raccourcis clavier — `keyboard.js`

Voir le bloc de commentaire en tête de fichier pour la liste exhaustive.
Les plus importants :

| Combo                        | Action                                       |
|------------------------------|----------------------------------------------|
| `Ctrl+Z` / `Ctrl+Y`          | undo / redo                                  |
| `Ctrl+S`                     | save immédiat (force flush)                  |
| `Ctrl+A` / `Ctrl+C` / `Ctrl+V` / `Ctrl+D` | select all / copy / paste / duplicate |
| `Ctrl++` / `Ctrl+-` / `Ctrl+0` | zoom in / out / reset 100%                |
| `↑↓←→` / `Shift+↑↓←→`         | nudge sélection (20px / 100px)               |
| `F2` ou `Enter`              | ouvrir propriétés du nœud sélectionné        |
| `Ctrl+Shift+A`               | ouvrir le panneau chat                       |
| `Ctrl+Shift+C`               | FIM inline (quand focus dans `#code-preview`)|
| `/` (hors champ texte)       | ouvrir le chat et focuser l'input            |
| `Echap` (chat ouvert)        | fermer le chat                               |

---

## 9. Conventions & invariants

- **Pas de mutation directe** du state. Toujours passer par `actions.*`.
- **Pas de casting `any`** (en JS on l'évite par convention — types JSDoc).
- **DOM : source unique de vérité dans `code-city.js > createBaseStructure()`** —
  tous les modules ciblent les éléments par ID.
- **Persistance explicite** : le bouton « Enregistrer » est le seul
  point de persistance des configs provider. Les clés API transitent par
  `.env` et ne sont jamais écrites dans le state persistant.
- **Hubs = canvas-only** : ils n'apparaissent ni dans le code Mermaid
  exporté, ni dans la documentation ZIP.
- **IDs propres** : `n1-process`, `n2-user`, `e1`, `e2`, … (compteurs
  internes ré-étalonnés à chaque `loadGraph`).
- **Multi-clés `.env`** : `FOO`, `FOO_1`, …, `FOO_20` (rotation LRU
  automatique sur 429).

---

## 10. Commandes dev

```bash
npm run dev               # serveur Vite + Node API (port 8081)
npm run dev:vite          # Vite seul (sans le serveur d'API)
npm run build             # build production (dist/)
npm run preview           # sert dist/

npm run test:unit         # Vitest (state, aiClient, envLoader, etc.)
npm run test:unit:watch   # Vitest en watch
npm run test              # Playwright E2E (chromium, firefox, webkit)
npm run test:ui           # Playwright UI mode
npm run test:report       # ouvrir le dernier rapport HTML

npm run clear             # vide le cache de build
```

### Variables d'environnement (`.env` à la racine)

```bash
# Exemple multi-clés avec rotation LRU
OPENROUTER_API_KEY=sk-or-v1-xxxxx
OPENROUTER_API_KEY_1=sk-or-v1-yyyyy
OPENROUTER_API_KEY_2=sk-or-v1-zzzzz

MISTRAL_API_KEY=...
GROQ_API_KEY=...
GEMINI_API_KEY=...

OPENCODE_ZEN_API_KEY=...
KILO_API_KEY=...
```

> ⚠️ Le `.env` est dans `.gitignore`. Les providers locaux (Ollama,
> LM Studio) n'ont pas besoin de clé.

---

## 11. Tests

| Type        | Framework  | Couvre                                              |
|-------------|-----------|-----------------------------------------------------|
| Unit        | Vitest     | `state.js`, `ai/aiClient.js`, `ai/envLoader.js`, `ai/chatHistory.js`, `ai/fimHandler.js`, `ai/keyRotation.test.js`, `ai/promptEngine.js`, `ai/providerLoader.js`, `ai/providerPanel.js`, `ai/systemPrompt.js`, `ai/workflowRunner.js`, `ai/contextBuilder.js`, `mermaid/build.js` |
| E2E         | Playwright | `assistant.spec`, `assistant-fim.spec`, `assistant-context.spec`, `api-keys-modal.spec`, `export.spec`, `export-preview.spec`, `features.spec`, `hub-workflow.spec`, `mermaid-properties-sync.spec`, `palette-dragdrop.spec`, `prompt-engine.spec`, `properties.spec`, `providers.spec`, `streaming-rendering.spec`, `undo-redo.spec` |

---

## 12. Fichiers supprimés (historique)

- `utils.js` — helpers dépréciés (showNotification, copyToClipboard, …)
  remplacés par `actions.setStatusMessage()` et code inline
- `fonctionsCanvasCenter/` — no-op (rôle repris par
  `render/canvasRenderer.js`)
- `menuActionsCenter/` — no-op (rôle repris par `quartierRight/`)
- `mermaid/parse.js` (en tant que fichier) — la fonction `parseMermaidCode()`
  a été fusionnée dans `mermaid/build.js` (build + parse + render cohabitent)
