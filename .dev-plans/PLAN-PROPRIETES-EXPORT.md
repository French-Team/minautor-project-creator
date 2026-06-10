# Plan de travail — Propriétés de nœuds & Export intelligent

> ✅ **Statut d'implémentation** (mis à jour : juin 2026) : **Implémenté** — toutes les phases 0 à 7 sont en production
>
> - **Phase 0** (Snapshot deep-clone `properties`) ✅ — `state.js` snapshot() clone les `properties`
> - **Phase 1** (Schémas par catégorie) ✅ — `src/code-city/propertySchemas.js` créé, 17 schémas (`CATEGORY_SCHEMAS`), `getCategory(type)`, `getSchemaForType(type)`
> - **Phase 2** (Persistance) ✅ — `persistence.js` inclut `properties`, `loadGraph` restaure, `navigator.storage.estimate()` warning > 80% quota
> - **Phase 3** (Générateur de doc) ✅ — `src/code-city/mermaid/docGenerator.js` créé, templates par catégorie (process, decision, service, devops, arch, sec, data, proj, test, uiux, pattern, env, component, git, msg, init, dep)
> - **Phase 4** (Multi-niveaux : selected / subtree / full) ✅ — `resolveSubtree()` BFS, `topologicalSort()` Kahn
> - **Phase 5** (Export ZIP) ✅ — `src/code-city/mermaid/zipExporter.js` créé (JSZip), `zipConstants.js` avec `PRIORITY_ORDER` + `SPRINT_META`, structure en 5 sprints (critical → backlog)
> - **Phase 6** (Refonte panneau export) ✅ — `src/code-city/quartierRight/exportPanel.js` avec modes, formats, ZIP
> - **Phase 7** (Mermaid ↔ propriétés) ✅ — annotations `%% @props` dans `build.js`, round-trip parser/build
> - **Phase 8** (visuel) ⏳ **partiellement** — badges statut `proj-*` non implémentés, indicateur priorité visuel non implémenté
> - 4 tests E2E dédiés : `e2e/properties.spec.js`, `e2e/mermaid-properties-sync.spec.js`, `e2e/export.spec.js`, `e2e/export-preview.spec.js` ✅
> - **Drift mineur** : la spec parlait de `getAllTypes()` dans `propertySchemas.js` — cette fonction n'a pas été créée (les types restent dans `menuMermaidActionsLeft.js`)
> - **Drift mineur** : la structure ZIP finale utilise des **sprints de priorité** (5 dossiers) au lieu des dossiers par catégorie (`plan/`, `components/`, `devops/`, `security/`, `testing/`, `project/`, etc.) — c'est [`zipExporter.js`](../src/code-city/mermaid/zipExporter.js) qui l'illustre

## Vision

Utiliser le canvas comme outil de **conception de projet sans coder**. Chaque nœud du diagramme représente un élément du projet (composant, service, tâche, décision…). Les propriétés de chaque nœud stockent les informations métier. L'export génère de la **documentation vivante** à partir de ces informations.

Le diagramme Mermaid est le squelette visuel. Les propriétés sont le contenu. L'export assemble le tout.

---

## État actuel (vérifié)

### Nœud (state.js)
```
{ id, type, label, description, x, y, priority, metadata[], variant, icon, color, background }
```
- `metadata` = tableau de `{ key, value }` (champs libres)
- `description` = texte libre (affiché en sous-titre Mermaid)
- Pas de champ `properties` → à ajouter

### Snapshot (state.js) — ⚠️ shallow clone
```js
snapshot() → { nodes: state.nodes.map((n) => ({ ...n })) }
```
Le `...n` est un **shallow clone**. Quand on ajoutera `properties: {}`, modifier `node.properties.tool = 'X'` **avant** `pushHistory()` corrompra le snapshot précédent. **Correction requise** avant Phase 2.

### Propriétés UI (centerAuxPanels.js)
- Label, Description, Type (**hardcodé: 13 types only**), Priorité, Position X/Y, Métadonnées
- `currentId` suit le changement de type (régénération d'ID)
- Re-render bloqué quand `isEditingFormField()` est true
- **Le sélecteur de type ne contient que 13 types** → doit être remplacé par la liste complète depuis la palette

### Export actuel (exportPanel.js + export.js)
- Panel rétractable (slide-in depuis la droite)
- 3 boutons: Code Mermaid (.mmd), SVG, PNG (×2 Retina)
- `runExport(format)` dispatche vers `exportCode/exportSvg/exportPng`
- **Un seul format à la fois, tout le diagramme**

### Palette (menuMermaidActionsLeft.js) — 15 sections, ~120 types
```
base       → start, end, process, decision, document, user, storage
advanced   → module, important, attention, idea, goal, success
components → component-header/footer/navbar/form/modal/table/sidebar/breadcrumb/stepper/tabs/drawer/card
uiux       → uiux-designsystem/responsive/a11y/animation/theming/gestures/loading/error
services   → service-api/auth/database/cache/queue/notif/email/webhook/search/s3/payment/logging
messaging  → msg-event/websocket/rest/microservice/grpc/mqtt/sse/graphql-sub
arch       → arch-clean/hexagonal/microfrontend/monolith/event-driven/serverless/microservices/layered/soa/ddd
patterns   → pattern-singleton/observer/factory/adapter/strategy/decorator/builder/composite/proxy/state/command
data       → data-ml/training/pipeline/ai/warehouse/viz/streaming
testing    → test-unit/integration/e2e/coverage/lint/review/metrics/snapshot/perf/mutation/bdd
project    → proj-story/task/sprint/bug/ticket/roadmap/retro/backlog/estimation/milestone
git        → git-branch/merge/pr/tag/stash/cherrypick/revert
devops     → devops-ci/cd/container/monitoring/infra/dns/lb/cdn/registry/secrets/alerting/feature-flag
security   → sec-auth/encrypt/rbac/firewall/oauth2/ratelimit/cors/csp/audit
dependencies → dep-package/version/mono/audit/license/update/registry/lockfile
init       → init-nextjs/react/vue/angular/svelte/nestjs/express
env        → env-secure/vars/config/secrets/feature-flag/staging/local/logging
```

---

## Problèmes identifiés dans le plan v1

| # | Problème | Impact | Solution |
|---|----------|--------|----------|
| 1 | Snapshot shallow clone corrompra `properties: {}` | Bug critique | Deep-clone uniquement le champ `properties` dans `snapshot()` |
| 2 | TYPE_TO_CATEGORY mapping est incomplet et ne correspond pas au PALETTE réel | Plan inutilisable | Utiliser le préfixe du `type` (avant le premier `-`) comme catégorie |
| 3 | Confusion metadata/properties non résolue | UX confuse | Garder `metadata[]` pour les champs libres, `properties{}` pour les champs structurés |
| 4 | Pas de stratégie quand le type change | Perte de données | Conserver les propriétés compatibles, réinitialiser les incompatibles |
| 5 | Pas de validation | Données corrompues | Validation basique (types, required) avant save |
| 6 | Pas de mention du preview panel enrichi | Feature manquante | Phase 7: enrichir l'onglet Aperçu avec les propriétés |
| 7 | `jszip` mentionné sans alternative évaluée | Choix non optimisé | `jszip` (33KB gzip) ou `fflate` (8KB) — jszip choisi pour l'API plus simple |
| 8 | Pas de gestion des cycles BFS | Potentiel boucle infinie | Set `visited` + max depth 50 |
| 9 | Pas de plan pour les hubs dans l'export | Nœuds ignorés | Filtrer les hubs, documentation via les nœuds reliés |
| 10 | Pas de gestion quota localStorage | Crash possible | Estimation taille + warning avant save |

---

## Architecture technique révisée

### A. Mapping catégorie par préfixe (pas par dictionnaire complet)

```js
// propertySchemas.js — mapping automatique par préfixe du type
// Ex: 'devops-ci' → préfixe 'devops', 'service-api' → 'service'

function getCategory(type) {
  if (!type) return 'default';
  const i = type.indexOf('-');
  return i > 0 ? type.slice(0, i) : type; // 'process' → 'process', 'devops-ci' → 'devops'
}

const CATEGORY_SCHEMAS = {
  'process': { /* champs */ },
  'decision': { /* champs */ },
  'service': { /* champs */ },
  'devops': { /* champs */ },
  'arch': { /* champs */ },
  'sec': { /* champs */ },
  'data': { /* champs */ },
  'proj': { /* champs */ },
  'test': { /* champs */ },
  'uiux': { /* champs */ },
  'pattern': { /* champs */ },
  'env': { /* champs */ },
  'component': { /* champs */ },
  'git': { /* champs */ },
  'msg': { /* champs */ },
  'init': { /* champs */ },
  'dep': { /* champs */ },
  // Tous les types sans préfixe connu → schema 'default' (pas de champs spécifiques)
};
```

> **Avantage :** Aucun dictionnaire TYPE_TO_CATEGORY à maintenir. Un nouveau type `devops-xyz` est automatiquement mappé à la catégorie `devops`.

### B. Champs par catégorie

| Catégorie | Champs spécifiques |
|-----------|-------------------|
| `process` | `inputs` (textarea), `outputs` (textarea), `steps` (textarea) |
| `decision` | `options` (textarea), `criteria` (textarea), `selected` (text) |
| `service` | `endpoint` (text), `method` (select: GET/POST/PUT/PATCH/DELETE), `auth` (select), `requestSchema` (textarea), `responseSchema` (textarea), `sla` (text) |
| `devops` | `tool` (select: GitHub Actions/GitLab CI/Jenkins/etc), `triggers` (text), `steps` (textarea), `rollback` (textarea) |
| `arch` | `problem` (textarea), `solution` (textarea), `alternatives` (textarea), `tradeoffs` (textarea), `consequences` (textarea) |
| `sec` | `threat` (textarea), `severity` (select: Faible/Moyen/Élevé/Critique), `mitigations` (textarea), `conformity` (text) |
| `data` | `source` (text), `format` (select: JSON/CSV/XML/Parquet), `volume` (text), `frequency` (select), `schema` (textarea) |
| `proj` | `assignee` (text), `estimation` (text), `deadline` (date), `status` (select: À faire/En cours/En revue/Terminé/Bloqué), `acceptance` (textarea) |
| `test` | `coverage` (text), `framework` (select: Vitest/Jest/Pytest/etc), `testCases` (textarea), `result` (select: Pass/Fail/Skip) |
| `uiux` | `wireframe` (textarea), `accessibility` (textarea), `responsive` (select: Desktop/Tablet/Mobile/Tous), `devices` (text) |
| `pattern` | `problem` (textarea), `solution` (textarea), `tradeoffs` (textarea), `consequences` (textarea) |
| `env` | `variables` (textarea), `secrets` (textarea: noms only), `regions` (text) |
| `component` | `props` (textarea), `states` (textarea), `dependencies` (textarea), `api` (textarea) |
| `git` | `branch` (text), `merged` (select: Oui/Non/En cours), `conflicts` (text), `pr` (text) |
| `msg` | `protocol` (text), `format` (text), `qos` (select), `retry` (text) |
| `init` | `version` (text), `dependencies` (textarea), `command` (text), `config` (textarea) |
| `dep` | `name` (text), `version` (text), `license` (select), `auditStatus` (select) |
| `default` | Aucun champ spécifique (description + metadata libres suffisent) |

### C. Schéma d'un champ

```js
{
  key: 'endpoint',        // Clé dans node.properties
  type: 'text' | 'textarea' | 'select' | 'date',
  label: 'Endpoint',      // Libellé affiché
  placeholder: '/api/v1/resource',
  options: [...],         // Pour type='select'
  required: false,        // Validation basique
}
```

### D. Merge strategy pour `properties`

```js
// Dans centerAuxPanels.js — TOUJOURS merger, jamais remplacer :
const currentNode = getState().nodes.find(n => n.id === currentId);
actions.updateNode(currentId, {
  properties: { ...currentNode.properties, [key]: newValue }
});
```

> `Object.assign(node, patch)` remplace `properties` en entier. Le caller doit donc toujours spread l'existant.

### E. Structure du ZIP exporté

```
export-mon-projet/
├── README.md                    ← Synopsis + sommaire + stats
├── diagram.svg                  ← Le diagramme Mermaid (SVG)
├── plan/                        ← arch-*, process, decision
│   ├── 01-architecture.md
│   ├── 02-processus.md
│   └── 03-decisions.md
├── components/                  ← component-*
│   ├── composant-a.md
│   └── composant-b.md
├── devops/                      ← devops-*
│   ├── pipeline-ci.md
│   └── infrastructure.md
├── security/                    ← sec-*
│   └── threat-model.md
├── testing/                     ← test-*
│   └── test-plan.md
├── project/                     ← proj-*
│   ├── backlog.md
│   └── timeline.md
├── data/                        ← data-*
│   └── pipeline-data.md
├── services/                    ← service-*, msg-*
│   ├── api-rest.md
│   └── websocket.md
├── config/                      ← env-*, init-*, dep-*
│   └── env-config.md
└── git/                         ← git-*
    └── branching-strategy.md
```

> Seuls les dossiers contenant des nœuds sont créés. Le README.md contient un sommaire auto-généré + stats (nombre de nœuds par catégorie).

---

## Plan de décomposition révisé

### Phase 0 : Correction Snapshot (bloquant)

**Objectif :** Corriger le shallow clone pour supporter `properties: {}` sans corrompre l'historique.

| # | Tâche | Fichiers |
|---|-------|----------|
| 0.1 | Deep-clone UNIQUEMENT le champ `properties` dans `snapshot()` : `properties: n.properties ? { ...n.properties } : {}` | `state.js` |
| 0.2 | Ajouter `properties: {}` au modèle de nœud par défaut dans `addNode`, `createHub`, `loadGraph` | `state.js` |
| 0.3 | Migration `loadGraph` : initialiser `properties: {}` pour les anciens nœuds qui n'en ont pas | `state.js` |
| 0.4 | Tests : vérifier que modifier `node.properties` après `pushHistory()` ne corrompt pas le snapshot précédent | `e2e/undo-redo.spec.js` ou nouveau test |

### Phase 1 : Schémas de propriétés par catégorie

**Objectif :** Le panneau Propriétés affiche des champs adaptés au type du nœud.

| # | Tâche | Fichiers |
|---|-------|----------|
| 1.1 | Créer `src/code-city/propertySchemas.js` : `getCategory(type)`, `CATEGORY_SCHEMAS`, `getSchemaForType(type)`, `getAllTypes()` | `propertySchemas.js` (nouveau) |
| 1.2 | **Remplacer le sélecteur Type hardcodé** dans `centerAuxPanels.js` : importer `PALETTE` depuis `menuMermaidActionsLeft.js` et dériver la liste complète des types (~120) au lieu des 13 hardcodés | `centerAuxPanels.js` |
| 1.3 | Après les champs existants, insérer la section "Propriétés métier" dynamique selon `getSchemaForType(type)` | `centerAuxPanels.js` |
| 1.4 | Renderer les champs dynamiques : text, textarea, select, date — avec labels et placeholders | `centerAuxPanels.js` |
| 1.5 | **Sauvegarder avec merge** : `actions.updateNode(id, { properties: { ...currentNode.properties, [key]: value } })` — TOUJOURS spread l'existant | `centerAuxPanels.js` |
| 1.6 | **Debounce** sur les champs textarea/text (comme la description existante) pour ne pas spammer l'historique | `centerAuxPanels.js` |
| 1.7 | Gérer le changement de type : conserver les propriétés compatibles, réinitialiser les incompatibles | `centerAuxPanels.js` |
| 1.8 | Styles CSS pour les nouveaux champs (prop-field, prop-textarea, prop-select) — réutiliser le système existant | `default.css` |
| 1.9 | Tests E2E : panneau affiche les bons champs par type, sauvegarde correcte, debounce, reset au changement de type | `e2e/properties.spec.js` (nouveau) |

### Phase 2 : Stockage & Persistance

**Objectif :** `properties` est persisté dans le store et le localStorage.

| # | Tâche | Fichiers |
|---|-------|----------|
| 2.1 | `updateNode` accepte `properties` dans le patch (déjà fait via `Object.assign`) — vérifier le comportement | `state.js` (vérifier) |
| 2.2 | `persistence.js` : `saveGraph` inclut `properties`, `loadGraph` restaure `properties` | `persistence.js` |
| 2.3 | **Estimation taille localStorage dans `saveGraph`** : calculer `JSON.stringify(graph).length`, warning si > 80% du quota (`navigator.storage.estimate()`) | `persistence.js` |
| 2.4 | Tests : round-trip `properties` dans save/load | `e2e/persistence.spec.js` (nouveau) ou existant |

### Phase 3 : Générateur de documentation par catégorie

**Objectif :** Chaque catégorie produit du Markdown formaté à partir de ses propriétés.

| # | Tâche | Fichiers |
|---|-------|----------|
| 3.1 | Créer `src/code-city/mermaid/docGenerator.js` : `generateDoc(node)`, `generateDocSection(nodes)` | `docGenerator.js` (nouveau) |
| 3.2 | Template par défaut : `## {label}\n\n{description}` | `docGenerator.js` |
| 3.3 | Templates par catégorie : chaque catégorie a sa structure Markdown | `docGenerator.js` |
| 3.4 | Filtrer les hubs (type === 'hub') de la documentation | `docGenerator.js` |
| 3.5 | Tests unitaires : chaque template produit le bon Markdown | `docGenerator.test.js` (nouveau) |

### Phase 4 : Export multi-niveaux

**Objectif :** L'utilisateur choisit quoi exporter (nœud, sous-arbre, tout).

| # | Tâche | Fichiers |
|---|-------|----------|
| 4.1 | `resolveSubtree(nodeId, edges)` — BFS aval avec `Set visited` + max depth 50 | `docGenerator.js` |
| 4.2 | `topologicalSort(nodes, edges)` — tri pour l'export plan complet | `docGenerator.js` |
| 4.3 | Ajouter les modes dans le panneau export (radio buttons : nœud/sous-arbre/plan) | `exportPanel.js` |
| 4.4 | Export nœud unique → 1 fichier .md | `docGenerator.js` + `exportPanel.js` |
| 4.5 | Export sous-arbre → .md multi-sections | `docGenerator.js` + `exportPanel.js` |
| 4.6 | Export plan complet → collecte + tri topologique | `docGenerator.js` + `exportPanel.js` |
| 4.7 | Tests E2E : chaque mode produit le bon contenu | `e2e/export.spec.js` (nouveau) |

### Phase 5 : Export ZIP multi-fichiers

**Objectif :** L'export complet génère un ZIP structuré avec README.

| # | Tâche | Fichiers |
|---|-------|----------|
| 5.1 | Installer `jszip` | `package.json` |
| 5.2 | Créer `src/code-city/mermaid/zipExporter.js` : `generateZip(graph, mode, nodeId?)` | `zipExporter.js` (nouveau) |
| 5.3 | Regrouper nœuds par catégorie → dossiers | `zipExporter.js` |
| 5.4 | Générer README.md synopsis + sommaire + stats | `zipExporter.js` |
| 5.5 | Inclure SVG du diagramme dans le ZIP | `zipExporter.js` |
| 5.6 | Téléchargement ZIP via Blob + `<a>` éphémère | `exportPanel.js` |
| 5.7 | Warning si > 500 nœuds | `zipExporter.js` |
| 5.8 | Tests E2E : ZIP contient la bonne structure | `e2e/export.spec.js` |

### Phase 6 : Refonte du panneau d'export

**Objectif :** Le panneau droit devient un hub d'export complet avec preview.

> ⚠️ **Note :** Cette phase est une refonte significative de `exportPanel.js` (radio buttons + checkboxes + preview). Elle dépend de Phase 4 pour les modes et Phase 5 pour le ZIP.

| # | Tâche | Fichiers |
|---|-------|----------|
| 6.1 | Refonte panneau : section Mode (radio buttons) + section Formats (checkboxes) + bouton Exporter | `exportPanel.js` + `default.css` |
| 6.2 | Preview Markdown avant export (button-triggered, pas live) dans une zone dédiée | `exportPanel.js` |
| 6.3 | Export JSON brut (données structurées) | `exportPanel.js` |
| 6.4 | État du panneau : mettre à jour les options selon la sélection courante | `exportPanel.js` |
| 6.5 | Tests E2E : panneau affiche les bons contrôles par mode | `e2e/export.spec.js` |

### Phase 7 : Intégration Mermaid ↔ Propriétés

**Objectif :** Le code Mermaid et l'aperçu reflètent les propriétés enrichies.

| # | Tâche | Fichiers |
|---|-------|----------|
| 7.1 | Enrichir les labels Mermaid avec les propriétés clés (ex: `API\nGET /users`) | `build.js` |
| 7.2 | Inférer `properties` depuis le code Mermaid parsé (si JSON dans les labels) | `build.js` |
| 7.3 | Enrichir l'onglet Aperçu avec les propriétés du nœud sélectionné | `previewPanel.js` |
| 7.4 | Tests round-trip Mermaid ↔ properties | `build.test.js` (nouveau) |

### Phase 8 : Avancées visuelles (optionnel)

**Objectif :** Les propriétés influencent le rendu canvas.

| # | Tâche | Fichiers |
|---|-------|----------|
| 8.1 | Badge statut coloré sur nœuds `proj-*` (Vert=Terminé, Orange=En cours, Rouge=Bloqué) | `canvasRenderer.js` + `default.css` |
| 8.2 | Indicateur visuel de priorité (icône, bordure) | `canvasRenderer.js` + `default.css` |
| 8.3 | Warning visuel deadline proche (flash rouge) | `canvasRenderer.js` |

---

## Risques identifiés

| Risque | Impact | Mitigation |
|--------|--------|------------|
| Shallow clone corrompt l'historique | Critique | Phase 0 : deep-clone UNIQUEMENT `properties` dans `snapshot()` |
| Trop de champs = formulaire surchargé | UX | Disclosure progressif : sections repliables avec `details/summary` |
| Type change → perte de propriétés | UX | Conserver les propriétés compatibles, réinitialiser les incompatibles |
| ZIP lourd pour gros graphes | Perf | Max 500 nœuds avant warning, lazy generation |
| Cycle dans le graphe → boucle infinie BFS | Bug | `Set visited` + max depth 50 |
| Round-trip Mermaid ↔ properties perte de données | UX | JSON encodé dans les labels Mermaid pour les props critiques |
| localStorage quota dépassé | Crash | Estimation dans `saveGraph` : `JSON.stringify(graph).length` + `navigator.storage.estimate()` > 80% → warning |
| Templates figés = pas de personnalisation | UX | Phase 7 : templates basés sur les schémas (facilement extensibles) |
| metadata vs properties confusion | UX | `metadata` = champs libres (key/value), `properties` = champs structurés par catégorie. UI : deux sections distinctes ("Champs structurés" vs "Champs libres") |
| Performance si beaucoup de nœuds sélectionnés | Perf | Mode multi-édition à venir, pour l'instant édition single-node uniquement |
| Performance génération Markdown pour 500+ nœuds | Perf | Lazy generation (un nœud à la fois), max 500 avant warning |
| Sélecteur type hardcodé à 13 types | UX | Phase 1.2 : remplacer par `PALETTE` importée depuis `menuMermaidActionsLeft.js` |
| Refonte exportPanel sous-estimée | Dev | Phase 6 = refactor majeur, pas du polish. Dépend de Phases 4+5 |
| Debounce manquant sur nouveaux champs | Perf/UX | Phase 1.6 : debounce textarea/text comme la description existante |
| Merge properties non défini | Bug | Documenté dans Architecture §D : TOUJOURS spread `{ ...currentNode.properties, [key]: value }` |

---

## Priorisation recommandée

```
Phase 0 (Snapshot)       ← CRITIQUE, bloquant tout le reste
Phase 1 (Schémas)        ← Fondation UI
Phase 2 (Stockage)       ← Persistance
Phase 3 (Générateur)     ← Core value : la documentation
Phase 4 (Multi-niveaux)  ← UX export
Phase 5 (ZIP)            ← Livrable final
Phase 6 (Refonte panel)  ← Refonte majeure (pas polish)
Phase 7 (Mermaid)        ← Enrichissement
Phase 8 (Visuel)         ← Bonus
```

**Estimations révisées :**
- **Phase 0** = 2h (correction ciblée + tests)
- **Phase 1+2** = fondations (1-2 jours)
- **Phase 3** = MVP export (1 jour)
- **Phase 4+5** = export complet (2-3 jours)
- **Phase 6** = refonte panel (1-2 jours, pas du polish)
- **Phase 7+8** = améliorations (optionnel)

---

## Notes techniques

### Dépendances à ajouter
- `jszip` — ZIP côté client (API simple, bien documenté)

### Compatibilité
- Tout reste côté client (pas de backend)
- localStorage pour la persistence
- Export via Blob + download

### Migration
- `snapshot()` dans `state.js` : deep-clone UNIQUEMENT `properties` (`{ ...n.properties }`)
- `loadGraph` dans `state.js` : initialiser `properties: {}` pour les anciens nœuds
- Le format Mermaid est préservé (pas de breaking change)
- `metadata[]` est conservé, `properties{}` est un ajout complémentaire

### Décisions architecturales
- **Préfixe comme catégorie** : `getCategory('devops-ci')` → `'devops'` (pas de dictionnaire)
- **properties vs metadata** : `properties{}` = champs structurés par schéma, `metadata[]` = champs libres key/value
- **Merge properties** : TOUJOURS `{ ...currentNode.properties, [key]: value }` (jamais remplacement)
- **Changement de type** : propriétés incompatibles = reset, compatibles = conservation
- **BFS** : avec `Set visited` + max depth 50 pour éviter les cycles
- **Hubs** : filtrés de l'export (type === 'hub' → ignoré)
- **Debounce** : tous les champs texte/textarea des propriétés = debounce 200ms
- **Sélecteur type** : importé depuis `PALETTE` dans `menuMermaidActionsLeft.js` (120+ types)
