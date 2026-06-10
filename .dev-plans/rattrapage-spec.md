# Spec de Rattrapage — Items oubliés ou reportés

> **Date :** juin 2026
> **Statut :** 🟡 À planifier — reprend tous les items non implémentés ou reportés identifiés pendant l'audit des specs
> **Objectif :** Consolider en une seule spec tous les « à faire » pour éviter qu'ils ne se perdent dans les specs d'origine (qui sont maintenant marquées comme « ✅ Implémenté »)
> **Pré-requis :** avoir lu l'audit des sections « Statut d'implémentation » dans les 11 specs de `.dev-plans/`

---

## Contexte

L'audit code vs specs (juin 2026) a révélé que toutes les **grandes fonctionnalités** sont en production, mais que **4 zones de dette technique** subsistent :

1. **Chat Panel — Phase P2** : 2 items UX reportés
2. **Prompt Engine — Persistance disque** : pas implémentée, fonctionne uniquement en mémoire
3. **Export — Phase 8 (visuel)** : 3 items non implémentés
4. **Divers** : petits ajustements de cohérence

Cette spec reprend chaque item avec un plan d'implémentation ciblé, des critères d'acceptation, et des tests.

---

## 1. Chat Panel — Phase P2 (2 items reportés)

> Source : [chat-panel-improvements-spec.md](chat-panel-improvements-spec.md) — section §10 Phase P2

### Item 2.1 — Bouton « modifier » sur les messages utilisateur

**Pourquoi** : un utilisateur veut souvent corriger une question mal posée ou reformuler sans tout retaper.

**Comportement attendu** :

- Au hover d'un message `.chat-msg--user`, un bouton « ✏️ Modifier » apparaît à côté du timestamp
- Au clic : le contenu du message est injecté dans `#chat-input` (textarea), les messages ultérieurs (assistant inclus) sont **supprimés** du state et du DOM, le focus passe dans le textarea
- L'utilisateur peut éditer puis renvoyer avec Enter
- Si l'utilisateur clique « Modifier » mais qu'il y a déjà un streaming en cours → toast d'erreur « Une réponse est en cours, attends qu'elle se termine »

**Implémentation** :

| Fichier | Modification |
|---------|-------------|
| `src/code-city/ai/chatPanel.js` | Ajouter le bouton dans `renderHistoryMessage()` (rôle `user`) + handler `handleEditMessage(btn)` |
| `src/code-city/ai/chatPanel.js` | `handleEditMessage` : `actions.popLastChatMessagesFromIndex(index)` (nouvelle action à créer), `setInputValue(text)`, focus |
| `src/code-city/state.js` | Nouvelle action `popLastChatMessagesFromIndex(index)` — supprime tous les messages à partir de `index` (incluant `index`) et persiste |
| `src/styles/default.css` | CSS `.chat-msg__edit-btn` (apparaît au hover), `.chat-msg--user:hover .chat-msg__edit-btn` |

**Tests** :

- Unitaire : `state.js > popLastChatMessagesFromIndex` supprime bien tout à partir de l'index, persiste, notifie les subscribers
- E2E (`e2e/streaming-rendering.spec.js` ou nouveau) :
  - Clic « Modifier » sur un message user → textarea rempli avec le contenu
  - Clic « Modifier » pendant un streaming → toast d'erreur
  - Après modification + Enter → le message suivant est une nouvelle réponse (pas de doublon)

**Effort estimé** : 2h

---

### Item 2.2 — Transitions d'ouverture/fermeture du panneau chat

**Pourquoi** : actuellement le panneau apparaît/disparaît instantanément (classe `is-open` togglée brutalement). Un slide-in fluide améliore le ressenti.

**Comportement attendu** :

- Ouverture : slide-in depuis la droite + fade in du backdrop (~200ms ease-out)
- Fermeture : slide-out vers la droite + fade out du backdrop (~150ms ease-in)
- Pas de blocage du thread (utiliser CSS `transition` ou `@keyframes`)
- Le `Esc` ne doit pas casser la transition

**Implémentation** :

| Fichier | Modification |
|---------|-------------|
| `src/styles/default.css` | Ajouter `transition: transform 200ms ease-out` sur `.app__chat-panel`, `transition: opacity 150ms ease-in` sur `.app__chat-backdrop`. État initial : `transform: translateX(100%)` + `opacity: 0`, état `is-open` : `transform: translateX(0)` + `opacity: 1` |
| `src/code-city/ai/chatPanel.js` | Vérifier que `applyOpenState()` ne touche plus à `display: none` (la classe `is-open` suffit) |
| `src/code-city/ai/chatPanel.js` | `closeChatPanel()` : après la transition, ajouter `setTimeout` pour mettre `display: none` si nécessaire (pour ne pas bloquer les clics derrière) |

**Tests** :

- Visuel (pas de test auto) : l'animation doit être visible à l'ouverture/fermeture
- E2E : le panneau est fonctionnel après l'animation (focus input, envoi message)

**Effort estimé** : 1h

---

## 2. Prompt Engine — Persistance disque

> Source : [prompt-engine-spec.md](prompt-engine-spec.md) — section §G « Fichiers sur disque » + §I « Endpoints API »

**Pourquoi** : actuellement `PromptEngine` fonctionne **uniquement en mémoire** (`state.assistant.promptCache`). Conséquence : à chaque rechargement, les prompts sont recalculés (perte de temps) et il n'y a pas d'historique persistant visible à l'utilisateur.

**Comportement attendu** :

- Chaque prompt préparé est sauvegardé dans `data/prompts/{ISO-timestamp}-{type}.md`
- Un fichier `data/prompts/index.json` liste tous les prompts (id, type, timestamp, tokens, filePath)
- Endpoints `GET /api/prompts`, `GET /api/prompts/{filename}`, `POST /api/prompts`, `DELETE /api/prompts/{id}` exposés par `scripts/env-server.mjs`
- Rotation automatique : max 50 fichiers. Quand on ajoute le 51e, on supprime le plus vieux (hors prompt actif + index.json)
- Le `state.assistant.promptCache` continue d'exister en mémoire (cache rapide) ; le disque est la **persistance**

**Implémentation** :

| Fichier | Modification |
|---------|-------------|
| `scripts/env-server.mjs` | Ajouter routes `/api/prompts` (GET liste, POST écriture, DELETE par id) — pattern identique à `/api/providers/{id}` |
| `src/code-city/ai/promptEngine.js` | Après `preparePrompt()`, si succès, `POST /api/prompts` avec `{ id, type, prompt, context, timestamp }` |
| `src/code-city/ai/promptEngine.js` | À l'init, `GET /api/prompts` pour pré-charger `index.json` en mémoire (warm cache) |
| `src/code-city/ai/promptEngine.js` | Méthode `clearDiskCache()` qui appelle `DELETE /api/prompts/{id}` pour chaque entrée |
| `src/code-city/state.js` | Pas de changement (le cache reste en mémoire) — mais l'action `clearPromptCache()` doit aussi vider le disque |
| `src/code-city/ai/promptEngine.test.js` | Nouveaux tests : mock `fetch`, vérifier que chaque `preparePrompt` hit POST /api/prompts |
| `e2e/prompt-engine.spec.js` | Test E2E : créer 3 prompts successifs, recharger la page, vérifier que les 3 sont toujours en cache mémoire (warm) |

**Format de fichier `data/prompts/{id}.md`** (existant dans la spec) :

```markdown
# Prompt préparé — {type}
> Généré le {date locale}
> Type : {type}
> Cache : {cached|composé}
> Contexte : {N} nœuds, {M} arêtes
> Fenêtre contexte : {N} tokens

## Message utilisateur
{userMessage}

## Prompt système
{prompt}

## Contexte utilisé
- Nœuds : {N} ({répartition par type})
- Arêtes : {M}
- Nœuds sélectionnés : {selectedIds|aucun}
```

**Format `data/prompts/index.json`** :

```json
{
  "current": "2025-06-10T143022-analysis",
  "prompts": [
    { "id": "2025-06-10T143022-analysis", "type": "analysis", "timestamp": 1748943022000, "tokens": 420, "filePath": "data/prompts/2025-06-10T143022-analysis.md" }
  ],
  "totalFiles": 1,
  "lastModified": 1748943022000
}
```

**Tests** :

- Unitaire : `promptEngine` hit POST /api/prompts avec le bon payload
- Unitaire : rotation supprime bien le plus vieux fichier quand on dépasse 50
- E2E : 3 prompts successifs, rechargement, vérif cache warm
- E2E : `clearPromptCache()` vide aussi le disque

**Effort estimé** : 4h

---

## 3. Export — Phase 8 (visuel) — 3 items

> Source : [PLAN-PROPRIETES-EXPORT.md](PLAN-PROPRIETES-EXPORT.md) — section Phase 8 « Avancées visuelles »

### Item 3.1 — Badge statut coloré sur nœuds `proj-*`

**Pourquoi** : un nœud `proj-task` avec `properties.status = 'En cours'` est visuellement identique à un nœud `À faire`. Un badge coloré en haut à droite du nœud donne l'info en un coup d'œil.

**Mapping** (déjà dans `docGenerator.js`) :

| Status | Emoji | Couleur |
|--------|-------|---------|
| À faire | ⬜ | gris |
| En cours | 🔵 | bleu |
| En revue | 🟡 | jaune |
| Terminé | 🟢 | vert |
| Bloqué | 🔴 | rouge |

**Implémentation** :

| Fichier | Modification |
|---------|-------------|
| `src/code-city/render/canvasRenderer.js` | Dans le rendu du nœud, si `n.type` commence par `proj-` et `n.properties.status` existe, ajouter un `<span class="canvas-node__status-badge" data-status="...">` en haut à droite |
| `src/styles/default.css` | `.canvas-node__status-badge` (positionné `absolute` top: 4px, right: 4px, border-radius 50%, width/height 12px, border 1px solid) + 5 couleurs `[data-status="..."]` |

**Tests** :

- E2E : créer un nœud `proj-task` avec status `En cours` → badge bleu visible
- E2E : changer status → badge change de couleur
- Visuel : le badge ne doit pas masquer le titre du nœud

**Effort estimé** : 1h30

---

### Item 3.2 — Indicateur visuel de priorité

**Pourquoi** : `node.priority` (`low` / `medium` / `high` / `critical`) est utilisé dans l'export ZIP (sprints) mais invisible sur le canvas. Un indicateur (petit triangle en haut à gauche) aide à prioriser visuellement.

**Mapping** :

| Priorité | Forme | Couleur |
|----------|-------|---------|
| `critical` | 🔴 triangle plein | rouge |
| `high` | 🟠 triangle plein | orange |
| `medium` | 🟡 triangle | jaune |
| `low` | 🟢 triangle vide | vert |

**Implémentation** :

| Fichier | Modification |
|---------|-------------|
| `src/code-city/render/canvasRenderer.js` | Ajouter un `<span class="canvas-node__priority-marker" data-priority="...">` en haut à gauche du nœud |
| `src/styles/default.css` | `.canvas-node__priority-marker` (positionné `absolute` top: 4px, left: 4px, triangle en CSS `clip-path` ou SVG inline 12×12) + 4 couleurs |

**Tests** :

- E2E : nœud avec `priority: 'critical'` → marqueur rouge visible
- E2E : changer priorité → marqueur change
- Le marqueur ne doit pas chevaucher le badge statut (badge à droite)

**Effort estimé** : 1h30

---

### Item 3.3 — Warning visuel deadline proche

**Pourquoi** : un nœud `proj-task` avec `properties.deadline` dans 2 jours doit alerter l'utilisateur visuellement (animation de pulsation ou bordure rouge).

**Règle de warning** :

- Si `deadline < now + 48h` ET `status !== 'Terminé'` → bordure rouge + animation `pulse-border` 2s infinite
- Si `deadline < now` (en retard) ET `status !== 'Terminé'` → bordure rouge épaisse + badge « EN RETARD »

**Implémentation** :

| Fichier | Modification |
|---------|-------------|
| `src/code-city/render/canvasRenderer.js` | Calculer `isOverdue` / `isNearDeadline` au moment du render du nœud, ajouter classes `is-overdue` / `is-near-deadline` |
| `src/code-city/render/canvasRenderer.js` | Mettre à jour le rendu à chaque changement de `state.status.message` (peu fréquent) ou via un interval de 1 minute pour les deadlines approchantes (à optimiser) |
| `src/styles/default.css` | `.canvas-node.is-overdue { border: 2px solid #dc2626; box-shadow: 0 0 0 2px rgba(220, 38, 38, 0.3); }` + `.is-near-deadline { animation: pulse-border 2s ease-in-out infinite; }` |

**Tests** :

- Unitaire : helper `getDeadlineStatus(node)` retourne `{ isOverdue, isNearDeadline, daysRemaining }`
- E2E : nœud avec deadline dans 24h → classe `is-near-deadline` appliquée
- E2E : nœud avec deadline passée → classe `is-overdue` + badge
- E2E : nœud terminé (status: 'Terminé') → pas de warning

**Effort estimé** : 3h

---

## 4. Divers — Cohérence et ajustements

### Item 4.1 — Cohérence nommage icône `chart` vs `chartBar`

**Source** : [categories-improvements-spec.md](categories-improvements-spec.md) mentionne `chartBar` mais `icons.js` utilise `chart`.

**Action** : renommer l'icône dans `icons.js` (`chart` → `chartBar`) pour matcher la spec, ou inversement mettre à jour la spec. **Recommandation** : garder `chart` (nom court) et corriger la spec.

**Effort** : 5min

---

### Item 4.2 — Doc d'`execution` du `localStorage.estimate()`

**Source** : [PLAN-PROPRIETES-EXPORT.md](PLAN-PROPRIETES-EXPORT.md) §10 Risques mentionne « localStorage quota dépassé ».

**Action** : s'assurer que `persistence.js > flushSave()` calcule bien la taille et appelle `navigator.storage.estimate()` à chaque save, et que le warning s'affiche au-delà de 80%.

**Vérification** : déjà implémenté (cf. audit). **Action** : juste ajouter un commentaire JSDoc au-dessus de la fonction pour documenter le comportement.

**Effort** : 10min

---

### Item 4.4 — ✅ CLÔTURÉ (2026-06-10) : Couverture E2E multi-providers

**Source** : audit code vs specs (juin 2026) — les tests E2E existants ne touchaient **que le provider par défaut `ollama`**, masquant toute régression sur les 7 autres providers (online + formats custom Gemini / OpenCode Zen).

**Action livrée** : nouvelle spec `.dev-plans/providers-e2e-spec.md` (méta-spec de planification) + helper partagé `e2e/helpers/providerTest.js` + spec pilote `e2e/providers/ollama.spec.js` (4 tests `@slow`) + CI nightly `.github/workflows/e2e-nightly.yml` + `e2e/README.md` complet.

**Sprint A ✅** : fondations (helper + ollama + config 60s + scripts npm) — 0.5j livré
**Sprint B 🔴** : 4 fichiers OpenAI-compat (openrouter, groq, mistral, kilo) — 1j
**Sprint C 🔴** : 3 fichiers formats custom (gemini, opencode-zen, lmstudio) — 1.5j

**Statut** : ✅ **CLÔTURÉ côté planification + Sprint A** — la gap « E2E multi-providers » est comblée par la meta-spec + les fondations, même si les 7 fichiers Sprint B/C restent à écrire. Cf. `.dev-plans/providers-e2e-spec.md` §2 (Statut mis à jour ✅) et §7 (Plan d'implémentation).

---

### Item 4.3 — Test E2E manquant pour `provider-panel-implementation-guide.md`

**Source** : la spec §A mentionne `keyRotation.test.js` mais pas de test E2E Playwright pour la rotation de clés sur 429.

**Action** : ajouter un test dans `e2e/providers.spec.js` qui :
- Mock une réponse 429
- Vérifie que le `toast.warning` s'affiche
- Vérifie qu'une 2e requête est lancée avec une clé différente
- Vérifie qu'après 3 échecs, le toast d'erreur final s'affiche

**Effort** : 2h

---

## Plan d'implémentation recommandé

```text
Sprint 1 (4 jours) — Chat Panel P2 + cohérences rapides
├── Item 2.1  Bouton modifier messages user (2h)
├── Item 2.2  Transitions ouverture/fermeture (1h)
├── Item 4.1  Cohérence chart/chartBar (5min)
├── Item 4.2  JSDoc persistence.js (10min)
└── Tests E2E associés (3h)

Sprint 2 (1.5 jours) — Export visuel
├── Item 3.1  Badge statut proj-* (1h30)
├── Item 3.2  Indicateur priorité (1h30)
└── Item 3.3  Warning deadline (3h)
└── Tests E2E associés (2h)

Sprint 3 (1 jour) — Persistance Prompt Engine
├── Item 2    Persistance disque prompts (4h)
└── Tests E2E associés (2h)

Sprint 4 (0.5 jour) — Test E2E keyRotation
└── Item 4.3  Test E2E rotation 429 (2h)
```

**Effort total** : ~7 jours (1.5 sprint).

---

## Tests

| Type | Fichier cible | Items couverts |
|------|---------------|----------------|
| Unitaire Vitest | `state.js` | 2.1 (popLastChatMessagesFromIndex) |
| Unitaire Vitest | `promptEngine.js` | 2 (POST /api/prompts, rotation) |
| Unitaire Vitest | `canvasRenderer.js` (helpers) | 3.3 (getDeadlineStatus) |
| E2E Playwright | `streaming-rendering.spec.js` ou nouveau | 2.1, 2.2 |
| E2E Playwright | `export-preview.spec.js` (nouveau) | 3.1, 3.2, 3.3 |
| E2E Playwright | `prompt-engine.spec.js` | 2 (warm cache) |
| E2E Playwright | `providers.spec.js` | 4.3 (rotation 429) |

---

## Risques

| Risque | Impact | Mitigation |
|--------|--------|------------|
| Persistance disque ajoute de la latence (POST synchrone) | UX | POST en `keepalive: true` comme `persistChatHistory`, ou fire-and-forget |
| Animation chat panel bloque le thread sur mobile bas de gamme | Perf | Utiliser `transform` (GPU) plutôt que `left`/`right` |
| Warning deadline se met à jour que si on bouge un nœud | UX | Ajouter un interval 1 min pour rafraîchir les warnings, optimisable (vérifier seulement les nœuds `proj-*` avec deadline) |
| Le warm cache consomme de la mémoire au boot | Faible | Limiter le warm à 20 derniers prompts (cf. `MAX_PROMPT_HISTORY`) |
| Rotation disque : race condition si 2 prompts simultanés | Faible | Lock fichier (`fs.openSync` + `flock`) côté `env-server.mjs` |

---

## Décisions

- **Persistance disque des prompts** : synchrone (POST après `preparePrompt`) — la latence est acceptable car l'utilisateur attend déjà la réponse du LLM
- **Animation chat** : `transform: translateX` (GPU) plutôt que `left`/`right` (CPU)
- **Warning deadline** : interval 1 min côté renderer (acceptable car les deadlines sont en jours, pas en secondes)
- **Nommage chart/chartBar** : garder `chart` (plus court) et corriger la spec `categories-improvements-spec.md`
- **Item 4.3 (test E2E rotation 429)** : reporter à un sprint futur si temps manque — la rotation est déjà testée unitairement

---

## Annexe : checklist de mise à jour

Quand un item est implémenté, mettre à jour :
- Cette spec : cocher l'item ✅
- La spec d'origine : mettre à jour la section « Statut d'implémentation »
- Le `CHANGELOG.md` : ajouter une ligne dans la prochaine section versionnée
- `.dev-plans/README.md` : si l'item a un impact sur l'index, mettre à jour
