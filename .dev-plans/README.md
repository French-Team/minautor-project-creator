# 📐 .dev-plans — Index des Specs

> Spécifications techniques et plans d'implémentation utilisés pour concevoir
> les fonctionnalités du projet. **Document vivant** : les specs ne sont
> jamais supprimées même après implémentation, elles servent d'historique
> des décisions et de référence pour les revues.

---

## 🗺️ Carte des specs

```text
                                    ┌─────────────────────────────────────┐
                                    │       SOUS-SYSTÈME AI / MINA        │
                                    │  ┌──────────────────────────────┐  │
                                    │  │  SPEC-1 (Providers)          │  │
                                    │  │  → SPEC-2 (Assistant)        │  │
                                    │  │  → SPEC-3 (Intégration)      │  │
                                    │  │  (chaîne initiale)           │  │
                                    │  └──────────────────────────────┘  │
                                    │  ┌──────────────────────────────┐  │
                                    │  │  provider-refactor-spec v2   │  │
                                    │  │  → provider-panel-redesign   │  │
                                    │  │  → provider-panel-impl-guide │  │
                                    │  │  (refonte système providers) │  │
                                    │  └──────────────────────────────┘  │
                                    │  ┌──────────────────────────────┐  │
                                    │  │  chat-panel-improvements     │  │
                                    │  │  prompt-engine-spec          │  │
                                    │  └──────────────────────────────┘  │
                                    └─────────────────────────────────────┘

                                    ┌─────────────────────────────────────┐
                                    │       SOUS-SYSTÈME PALETTE         │
                                    │  ┌──────────────────────────────┐  │
                                    │  │  complete-sidebar-spec        │  │
                                    │  │  → categories-improvements    │  │
                                    │  │  (évolution catégories)       │  │
                                    │  └──────────────────────────────┘  │
                                    └─────────────────────────────────────┘

                                    ┌─────────────────────────────────────┐
                                    │       SOUS-SYSTÈME MERMAID         │
                                    │  ┌──────────────────────────────┐  │
                                    │  │  PLAN-PROPRIETES-EXPORT       │  │
                                    │  │  (propriétés + export ZIP)   │  │
                                    │  └──────────────────────────────┘  │
                                    └─────────────────────────────────────┘

                                    ┌─────────────────────────────────────┐
                                    │       RATTRAPAGE / BACKLOG         │
                                    │  ┌──────────────────────────────┐  │
                                    │  │  rattrapage-spec              │  │
                                    │  │  (consolide tous les items   │  │
                                    │  │   non implémentés / reportés) │  │
                                    │  └──────────────────────────────┘  │
                                    └─────────────────────────────────────┘
```

---

## 📋 Index des specs (13 fichiers)

### 1. Chaîne de specs AI initiale (3 specs)

Ces 3 specs forment la **vision initiale** du système AI. Elles ont été
écrites en cascade et définissent le **qui, quoi, où** de l'assistant.

| # | Spec | Sujet | Statut |
|---|------|-------|--------|
| 1 | [SPEC-1-PROVIDERS.md](SPEC-1-PROVIDERS.md) | Configuration des providers IA (presets, client API, panneau UI) | ⚠️ **Superseded** par `provider-refactor-spec.md` (reste valide comme vision) |
| 2 | [SPEC-2-ASSISTANT.md](SPEC-2-ASSISTANT.md) | Définition de l'assistant (personnalité Mina, system prompt, capacités) | ✅ Implémenté |
| 3 | [SPEC-3-INTEGRATION.md](SPEC-3-INTEGRATION.md) | Intégration dans le workflow (panneau chat, FIM, quick actions, header, clavier) | ✅ Implémenté |

**Déclencheur** : bouton « Providers » dans le header.
**Livrable** : Mina, l'assistant IA, conversationnel avec 8 providers, FIM inline, quick actions.

---

### 2. Refonte du système de providers (3 specs)

Après l'implémentation initiale, le système a été refondu pour séparer les
préoccupations (JSON / `.env` / state / UI). Les 3 specs suivantes
documentent l'évolution.

| # | Spec | Sujet | Statut |
|---|------|-------|--------|
| 4 | [provider-refactor-spec.md](provider-refactor-spec.md) | Refactor v2 — JSON source unique, `.env` server, `providerLoader.js` | ✅ Implémenté |
| 5 | [provider-panel-redesign-spec.md](provider-panel-redesign-spec.md) | Refonte UI — workflow guidé 6 étapes + grille 2 colonnes | ✅ Implémenté |
| 6 | [provider-panel-implementation-guide.md](provider-panel-implementation-guide.md) | Guide d'implémentation pas-à-pas (code, CSS, state) | ✅ Implémenté |

**Déclencheur** : la spec 1 a révélé trop de couplage (configs JS, clés localStorage, state maitre).
**Livrable** : 8 providers dans `data/provider-configs.json`, serveur `/api/env`, panneau 3 zones (status / grille / workflow).

---

### 3. Améliorations du chat (2 specs)

Specs incrémentales sur le chat panel et le moteur de prompts.

| # | Spec | Sujet | Statut |
|---|------|-------|--------|
| 7 | [chat-panel-improvements-spec.md](chat-panel-improvements-spec.md) | marked + highlight.js, typewriter, raccourci `/`, barre d'actions catégorisée, icônes SVG | 🟢 P0 + P1 faits, **P2 partiel** (2 items reportés) |
| 8 | [prompt-engine-spec.md](prompt-engine-spec.md) | PromptEngine : préparation dynamique, cache par hash de contexte, post-optimisation | 🟡 **Drift** : mémoire OK, persistance disque non implémentée |

**Déclencheur** : feedback utilisateur sur l'UX du chat et besoin de prompts plus spécialisés.
**Livrable** : chat avec Markdown complet + coloration syntaxique, prompts adaptés au type d'action, post-optimisation des réponses longues.

---

### 4. Évolution de la palette (2 specs)

Évolution de la sidebar de 6 catégories vers 17 catégories.

| # | Spec | Sujet | Statut |
|---|------|-------|--------|
| 9 | [complete-sidebar-spec.md](complete-sidebar-spec.md) | 6 → 14 catégories (Tests, DevOps, Sécurité, Patterns, etc.) | ✅ Implémenté |
| 10 | [categories-improvements-spec.md](categories-improvements-spec.md) | 14 → 17 catégories (Architecture, Data/IA, Projet), bouton « Tout ouvrir/fermer » | ✅ Implémenté |

**Déclencheur** : couverture incomplète des besoins de conception logicielle.
**Livrable** : 17 catégories, ~75 éléments, ~135 variantes, regroupées par thème (Fondamentaux / Frontend / Backend / Architecture / Data / Qualité / Processus / Infrastructure / Support).

---

### 5. Export intelligent (1 spec)

Le plan fondateur du sous-système `mermaid/` (propriétés structurées + export ZIP).

| # | Spec | Sujet | Statut |
|---|------|-------|--------|
| 11 | [PLAN-PROPRIETES-EXPORT.md](PLAN-PROPRIETES-EXPORT.md) | Propriétés par catégorie (17 schémas), export ZIP multi-fichiers, templates Markdown | 🟡 Phases 0–7 faites, **Phase 8 partielle** (3 items visuels non faits) |

**Déclencheur** : passer d'un export mmd/svg/png basique à un « Livre de Développement » structuré.
**Livrable** : `propertySchemas.js` (17 schémas), `docGenerator.js` (templates), `zipExporter.js` (5 sprints par priorité), refonte `build.js` (annotations `%% @props`, hubs résolus).

---

### 7. Tests E2E providers (1 spec)

**Spec de planification** (pas une spec de feature). Décrit la stratégie pour
couvrir les **8 providers IA** (online + local) en E2E avec de vraies clés API.

| # | Spec | Sujet | Statut |
|---|------|-------|--------|
| 13 | [providers-e2e-spec.md](providers-e2e-spec.md) | Plan E2E 8 providers (ollama, lmstudio, openrouter, groq, mistral, kilo, opencode-zen, gemini) : helper partagé, 1 fichier/provider, vraies clés `.env`, skip gracieux | 🟡 **Planifié** — 3 sprints (A fondations, B OpenAI-compat, C formats custom), ~3.5j |

**Pourquoi maintenant** : l'audit a révélé que les tests E2E existants ne
touchent **que le provider par défaut `ollama`**. Or chaque provider utilise
des formats différents (OpenAI-compat, Gemini REST natif, OpenCode dual
OpenAI/Anthropic) — une régression sur n'importe quel provider passe sous
le radar. Stratégie : tests d'intégration réels via `.env` (pas de mocks
dupliqués), skip automatique si clé absente, structure 1 fichier par provider.

---

### 6. Rattrapage / Backlog (1 spec)

**Cette spec est spéciale** : elle ne décrit pas une nouvelle feature, mais
**consolide tous les items non implémentés ou reportés** identifiés lors de
l'audit code vs specs de juin 2026. Sa raison d'être : les specs d'origine
ont été marquées « ✅ Implémenté » (par souci de synthèse), mais elles
contiennent des items de second ordre (P2, ajustements, drifts) qui
seraient perdus sans cette consolidation.

| # | Spec | Sujet | Statut |
|---|------|-------|--------|
| 12 | [rattrapage-spec.md](rattrapage-spec.md) | Consolidation des items reportés : Chat P2 (2), persistance disque Prompt Engine, Export Phase 8 visuel (3), divers (3) | 🟡 **À planifier** — 9 items, ~7 jours |

**Déclencheur** : audit code vs specs (juin 2026) révélant 9 items non implémentés disséminés dans 4 specs différentes.
**Livrable** : 4 sprints, plan d'implémentation priorisé, checklist de mise à jour des specs d'origine.

**Pourquoi une spec dédiée plutôt qu'éparpiller dans les specs d'origine ?**

- Les specs d'origine sont **verrouillées sur leur vision initiale** (impossible d'ajouter des items sans réécrire la spec)
- Un développeur lisant `chat-panel-improvements-spec.md` ne devrait pas voir « ⏳ reporté » dans une spec marquée « ✅ Implémenté »
- Une seule référence centrale facilite la planification sprint
- Chaque item pointe vers **la spec d'origine** qui l'avait initialement décrit (traçabilité)

---

## 🗂️ Résumé par thématique

### Système AI / Mina

| Spec | Vrai rôle |
|------|-----------|
| SPEC-1 | Infrastructure : providers, presets, client API, premier panneau |
| SPEC-2 | Cerveau : qui est Mina, system prompt, capacités, format messages |
| SPEC-3 | UX : où apparaît Mina, panneau chat, FIM, raccourcis |
| provider-refactor | Architecture cible : JSON + `.env` + proxy Vite |
| provider-panel-redesign | UX cible : workflow 6 étapes + grille + status |
| provider-panel-impl | Code exact à écrire (CSS, JS, state) |
| chat-panel-improvements | Polish UX : marked, typewriter, SVG, raccourcis |
| prompt-engine | Intelligence : prompts spécialisés + cache + post-optimisation |

### Palette / Sidebar

| Spec | Vrai rôle |
|------|-----------|
| complete-sidebar-spec | Premier enrichissement (6 → 14 catégories) |
| categories-improvements | Réorganisation (14 → 17, regroupement thématique) |

### Mermaid / Export

| Spec | Vrai rôle |
|------|-----------|
| PLAN-PROPRIETES-EXPORT | Le plan directeur du sous-système `mermaid/` moderne (propriétés + export ZIP) |

### Rattrapage / Backlog

| Spec | Vrai rôle |
|------|-----------|
| rattrapage-spec | **Méta-spec** : consolide 9 items reportés, ne décrit pas de nouvelle feature |

### Tests E2E

| Spec | Vrai rôle |
|------|-----------|
| providers-e2e-spec | **Méta-spec** : plan d'implémentation des 8 tests E2E d'intégration providers, ne décrit pas de feature (3 sprints, helper partagé) |

---

## 🔗 Liaisons entre specs

```text
SPEC-1 (Providers initiaux)
   │
   ├─► SPEC-2 (Assistant)
   │      │
   │      └─► SPEC-3 (Intégration)
   │
   └─► provider-refactor-spec v2 (refonte architecture providers)
          │
          ├─► provider-panel-redesign-spec (refonte UI)
          │      │
          │      └─► provider-panel-implementation-guide (code exact)
          │
          └─► (toutes inspirent le code actuel dans src/code-city/ai/)

chat-panel-improvements-spec
   │
   └─► prompt-engine-spec
          │
          └─► utilise contextBuilder.js (de SPEC-2) + aiClient (de SPEC-1)

complete-sidebar-spec
   │
   └─► categories-improvements-spec

PLAN-PROPRIETES-EXPORT (indépendant des autres)
   │
   └─► alimente mermaid/build.js + mermaid/docGenerator.js + mermaid/zipExporter.js
   │
   └─► génère 3 items Phase 8 dans rattrapage-spec.md (badges visuels)

rattrapage-spec (méta-spec)
   │
   ├─► reprend 2 items de chat-panel-improvements-spec.md (§10 Phase P2)
   ├─► reprend 1 drift de prompt-engine-spec.md (§G persistance disque)
   └─► reprend 3 items de PLAN-PROPRIETES-EXPORT.md (Phase 8 visuelle)
```

---

## 📊 Métriques d'implémentation

| Spec | Fichiers principaux créés | Fichiers principaux modifiés | Tests associés |
|------|---------------------------|------------------------------|----------------|
| SPEC-1 | `providerPresets.js`, `aiClient.js`, `providerPanel.js` | `state.js`, `code-city.js`, `default.css` | `e2e/providers.spec.js` |
| SPEC-2 | `systemPrompt.js`, `chatHistory.js`, `quickActions.js` | `state.js` | `systemPrompt.test.js` |
| SPEC-3 | `chatPanel.js`, `contextBuilder.js`, `fimHandler.js` | `keyboard.js`, `default.css` | `e2e/assistant*.spec.js`, `e2e/assistant-fim.spec.js` |
| provider-refactor | `data/provider-configs.json`, `data/providers-grid.json`, `envLoader.js`, `providerLoader.js`, `providerStore.js`, `workflowRunner.js` | `state.js`, `aiClient.js`, `chatPanel.js`, `providerPanel.js` | `providerLoader.test.js`, `envLoader.test.js` |
| provider-panel-redesign | `keyRotation.js` (LRU rate-limit) | `providerPanel.js`, `aiClient.js`, `state.js` | `keyRotation.test.js`, `workflowRunner.test.js` |
| chat-panel-improvements | `markdownRenderer.js` | `chatPanel.js`, `quickActions.js`, `state.js` | `streaming-rendering.spec.js` |
| prompt-engine | `promptEngine.js` | `chatPanel.js`, `state.js`, `systemPrompt.js`, `providerPanel.js` | `prompt-engine.spec.js`, `promptEngine.test.js` |
| complete-sidebar | — | `menuMermaidActionsLeft.js`, `build.js`, `icons.js`, `default.css` | (visuels) |
| categories-improvements | — | `menuMermaidActionsLeft.js`, `code-city.js`, `build.js`, `default.css` | (visuels) |
| PLAN-PROPRIETES-EXPORT | `propertySchemas.js`, `docGenerator.js`, `zipExporter.js`, `zipConstants.js` | `state.js` (snapshot deep-clone), `centerAuxPanels.js`, `exportPanel.js` | `properties.spec.js`, `mermaid-properties-sync.spec.js`, `export.spec.js`, `export-preview.spec.js`, `hub-workflow.spec.js` |
| rattrapage-spec | _aucun nouveau fichier_ (méta-spec) | 7 fichiers à modifier (`chatPanel.js`, `promptEngine.js`, `canvasRenderer.js`, `persistence.js`, `state.js`, `icons.js`, `default.css`) + `scripts/env-server.mjs` | 4 nouveaux fichiers de tests (E2E + unitaires) |

---

## 🎯 Comment lire ce dossier

1. **Point d'entrée pour comprendre une fonctionnalité** : commence par la spec « Liaisons » ci-dessus.
2. **Pour comprendre l'architecture AI** : lis les 3 specs de la chaîne initiale, puis `provider-refactor-spec` (refonte), puis `provider-panel-redesign-spec` (UX).
3. **Pour contribuer** : lis la spec d'implémentation correspondante (ex. `provider-panel-implementation-guide.md` pour modifier le panneau Providers).
4. **Pour le backlog** : va directement à [rattrapage-spec.md](rattrapage-spec.md) — c'est la liste priorisée de tout ce qui reste à faire.
5. **Pour le contexte historique** : les commits git référencent souvent ces specs dans leurs messages.

> ⚠️ Ces specs ne sont **pas des références de vérité absolue** : le code
> dans `src/` peut avoir évolué depuis. En cas de divergence, **le code
> prime**. Les specs servent surtout à comprendre le **pourquoi** des
> décisions.

---

## 📊 Légende des statuts

| Symbole | Signification |
|---------|---------------|
| ✅ **Implémenté** | Spec entièrement implémentée en production |
| 🟢 **P0+P1 faits** | Sprint principal terminé, items secondaires (P2) restants |
| 🟡 **Drift** | Implémenté avec écart par rapport à la spec — voir note « Statut d'implémentation » en tête de spec |
| ⚠️ **Superseded** | Vision initiale implémentée mais remplacée par une spec plus récente — reste valide comme historique |
| 🔴 **Non implémenté** | Spec validée mais code non écrit — voir `rattrapage-spec.md` |
