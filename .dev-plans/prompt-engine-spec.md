# Spec — Prompt Engine : Préparation dynamique des prompts

> **Version** : 2.1  
> **Statut** : Validé — prêt pour implémentation  
> **Provider cible** : Local (Ollama / LM Studio) — pas de limite de crédit  
> **Dépend de** : Provider configuré, chat panel (P0/P1), aiClient

---

## Vision

Créer un **service vivant** qui prépare dynamiquement le prompt système pour le modèle de chat, en fonction de la demande de l'utilisateur et du contexte actuel du canvas, avec une étape de **post-optimisation** des réponses longues.

**Principe :**  
Au lieu d'utiliser un system prompt figé (`SYSTEM_PROMPT` dans `systemPrompt.js`), chaque requête utilisateur est d'abord analysée pour composer un prompt spécialisé, qui est écrit dans un fichier `data/prompts/`, puis utilisé comme instruction système pour le modèle de chat. Après génération, si la réponse dépasse un seuil, elle est automatiquement optimisée (révisée) par le modèle pour plus de concision.

**Chaîne complète :**
```
User → promptEngine.js (categorisation + composition)
    → data/prompts/{timestamp}-{type}.md (fichier disque)
    → buildSystemMessages(customPrompt) (systemPrompt.js)
    → aiClient.streamChatCompletion() (modèle principal)
    → Réponse brute
    → optimizeResponse() (si réponse > seuil)
    → Réponse optimisée → chatPanel (affichage final)
```

---

## Architecture

### A. Provider local

**Décision :** Le PromptEngine et l'optimisation utilisent le **même provider local** (Ollama/LM Studio) que le chat, par défaut. L'utilisateur peut choisir un modèle **différent** pour la préparation/optimisation si souhaité (via le panneau Providers).

Implications :
- Pas de limite de crédit / quota → pas de gestion de rotation de clés
- Fenêtre de contexte limitée (~4K-8K tokens typiquement) → optimisation nécessaire
- Latence variable selon le modèle chargé

### B. Auto-détection de la fenêtre de contexte

À l'initialisation du PromptEngine, la fenêtre de contexte du modèle local est détectée automatiquement :

1. **Ollama** : appel à `/api/show` avec le nom du modèle → extrait `context_length` ou `num_ctx` du Modelfile
2. **Fallback** : table de correspondance connue (modèles populaires)
3. **Default** : 4096 tokens si non détectable

```js
const MODEL_CONTEXT_WINDOWS = {
  'llama3.2:3b': 8192,
  'llama3.2:1b': 8192,
  'llama3.1:8b': 128000,
  'mistral:7b': 8192,
  'qwen2.5:7b': 32768,
  'deepseek-coder:6.7b': 16384,
  'phi3:14b': 4096,
  'phi3:mini': 4096,
  default: 4096,
};

async function detectContextWindow(provider, modelId) {
  // 1. Essayer local Ollama /api/show
  try {
    const url = toLocalUrl(provider.baseUrl.replace('/v1', ''), provider.id) + '/api/show';
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modelId }),
      signal: AbortSignal.timeout(5000),
    });
    if (resp.ok) {
      const data = await resp.json();
      const contextLength = data.modelfile_info?.context_length
        || data.modelfile?.match(/num_ctx\s+(\d+)/)?.[1]
        || null;
      if (contextLength) return parseInt(contextLength, 10);
    }
  } catch { /* fallback */ }

  // 2. Fallback : table de correspondance connue
  for (const [pattern, ctx] of Object.entries(MODEL_CONTEXT_WINDOWS)) {
    if (modelId.includes(pattern)) return ctx;
  }

  // 3. Default
  return 4096;
}
```

### C. Nouveau module : `src/code-city/ai/promptEngine.js`

Service central de préparation des prompts et post-optimisation.

```js
export class PromptEngine {
  // Analyse la demande et prépare le prompt
  async preparePrompt(userMessage, canvasContext): Promise<PreparedPrompt>

  // Retourne le prompt préparé actuel (depuis la mémoire)
  getCurrentPrompt(): PreparedPrompt | null

  // Post-optimisation : révise la réponse pour la rendre plus concise
  async optimizeResponse(response, preparedPrompt, provider): Promise<string | null>

  // Vider le cache
  clearCache(): void

  // Détecter la fenêtre de contexte du modèle
  static async detectContextWindow(provider, modelId): Promise<number>
}

// Structure PreparedPrompt
{
  id: string,          // UUID ou timestamp
  type: PromptType,    // 'analysis' | 'suggestion' | 'documentation' | 'enrichment' | 'architecture' | 'conversation'
  userMessage: string, // Message original de l'utilisateur
  prompt: string,      // Prompt système préparé (Markdown)
  context: {
    nodeCount: number,
    edgeCount: number,
    selectedNodes: string[],
    canvasSummary: string,
    contextHash: string,   // ← Hash du contenu canvas pour le cache
  },
  cached: boolean,     // true si le prompt vient du cache (pas d'appel API)
  timestamp: number,
  filePath: string,    // Chemin du fichier sur disque
  duration: number,    // ms de préparation
}
```

#### Correction #2 : Clé de cache avec hash du contexte

La clé de cache n'est plus seulement `{type}` mais **`{type}-{contextHash}`**, où `contextHash` est un hash MD5-like du résumé du canvas (nœuds + arêtes).

```js
function hashContext(nodes, edges) {
  // Résumer le canvas sous forme de chaîne, puis hasher
  const summary = [
    nodes.filter(n => n.type !== 'hub')
      .map(n => `${n.type}:${n.label}:${n.priority}`)
      .sort()
      .join('|'),
    edges.map(e => `${e.from}:${e.to}:${e.label}`)
      .sort()
      .join('|'),
  ].join('::');
  
  // Hash simple (pas besoin de crypto forte)
  let hash = 0;
  for (let i = 0; i < summary.length; i++) {
    hash = ((hash << 5) - hash) + summary.charCodeAt(i);
    hash |= 0; // Convert to 32-bit int
  }
  return Math.abs(hash).toString(36);
}

// Cache key
const cacheKey = `${type}-${hashContext(nodes, edges)}`;
```

**Avantage :** Invalidation automatique — si le canvas change, le hash change, donc le cache est manqué naturellement. Plus besoin de subscribre aux événements de modification du canvas pour invalider.

#### Correction #1 : Stratégie de fusion SYSTEM_PROMPT

Le prompt préparé **remplace** le `SYSTEM_PROMPT` de base par défaut. Cependant, deux modes sont disponibles :

| Mode | Description | Usage |
|------|-------------|-------|
| **`replace`** (défaut) | Le prompt préparé remplace complètement SYSTEM_PROMPT | Pour les analyses complexes, suggestions, doc |
| **`enrich`** | Le prompt préparé est préfixé DEVANT le SYSTEM_PROMPT | Pour les conversations, types non reconnus |

```js
// Dans systemPrompt.js
export function buildSystemMessages(graph, customPrompt = null, mode = 'replace') {
  if (!customPrompt) {
    return buildDefaultSystemMessages(graph); // comportement existant
  }

  if (mode === 'enrich') {
    // Préfixer le prompt préparé devant le SYSTEM_PROMPT de base
    return [{ role: 'system', content: customPrompt + '\n\n---\n\n' + SYSTEM_PROMPT }];
  }

  // Mode 'replace' (défaut) : utiliser uniquement le prompt préparé
  return [{ role: 'system', content: customPrompt }];
}
```

**Contexte utilisateur :** Le `buildCanvasContext()` de `contextBuilder.js` est utilisé pour fournir le résumé du canvas dans le prompt préparé lui-même. Le prompt préparé est auto-suffisant.

### D. Catégories de prompts (6 types)

| Type | ID | Template guide |
|------|-----|----------------|
| **Analyse** | `analysis` | Examine le canvas, identifie problèmes, propose améliorations |
| **Suggestion** | `suggestion` | Recommande des nœuds avec type, label, description |
| **Documentation** | `documentation` | Produit de la documentation formatée à partir des nœuds/propriétés |
| **Enrichissement** | `enrichment` | Propose des valeurs pour les champs structurés d'un nœud |
| **Architecture** | `architecture` | Analyse patterns, propose structure |
| **Conversation** | `conversation` | Prompt léger, pas d'analyse du canvas |

### E. Cache + Reuse

**Clé de cache :** `{type}-{contextHash}` (voir Correction #2 ci-dessus).

1. **Catégorisation locale** (0 appel API) :
   - Analyse par mots-clés / regex pour déterminer le `PromptType`
   - Si le type est détecté et qu'un prompt existe en cache pour `{type}-{hash}` → **reuse**

2. **Composition avec appel API** (1 appel) :
   - Si le cache est manqué → appel au modèle local pour composer le prompt spécialisé
   - Le prompt composé est mis en cache

3. **Règles de cache** :
   - Expiration après **5 minutes** (même clé de cache)
   - L'utilisateur peut forcer une re-préparation (bouton `↻ Re-préparer`)
   - Pas d'invalidation explicite au changement canvas (le hash change naturellement)

### F. Post-optimisation

**Déclenchement :** Seulement si la réponse générée dépasse un seuil configurable.
- Seuil par défaut : **500 tokens**
- **Note :** `estimateTokens()` dans `chatHistory.js` utilise le ratio approximatif **1 token ≈ 4 caractères**. Pour un modèle local, le ratio est plus proche de 1 token ≈ 2-3 caractères (français). Le seuil de 500 tokens ≈ ~1500-2000 caractères réels. L'estimation est volontairement conservative (sur-estime) pour éviter de manquer des optimisations importantes.

**Processus :**
```
1. Modèle génère une réponse brute (affichée en streaming)
2. Une fois la réponse terminée, estimation des tokens
3. Si ≤ seuil → réponse affichée telle quelle (pas d'optimisation)
4. Si > seuil → 
   a. Afficher badge "⚡ Optimisation en cours..."
   b. Appel API d'optimisation (même modèle ou modèle dédié)
   c. Succès → remplacer la réponse par la version optimisée
   d. Échec → garder la réponse brute, afficher message discret
```

#### Correction #3 : État `isOptimizing`

Nouvel état dans `chatPanel.js`, distinct de `isThinking` :

```js
let isOptimizing = false;    // true pendant l'optimisation (après streaming)
```

Pendant l'optimisation :
- Le bouton stop est caché (le streaming est fini)
- Un badge `⚡ Optimisation en cours...` apparaît à la place du curseur
- L'utilisateur ne peut pas envoyer un nouveau message (isThinking-like lock)

#### Correction #4 : Gestion d'échec de l'optimisation

| Cas | Comportement |
|-----|-------------|
| **Erreur API** (timeout, 500) | Garder la réponse brute, badge discret "⚠️ Optimisation non disponible" |
| **Réponse optimisée vide** | Garder l'originale, pas de badge |
| **Modèle d'optimisation non configuré** | Skip silencieux |

```js
async function postOptimize(response, type, provider, fallback) {
  try {
    const optimized = await promptEngine.optimizeResponse(response, type, provider);
    if (optimized && optimized.trim()) {
      return optimized;
    }
  } catch (err) {
    console.warn('[Optimization] Échec:', err.message);
  }
  return null; // fallback : garder l'originale
}
```

### G. Fichiers sur disque

Le prompt préparé est écrit dans `data/prompts/`.

```
data/prompts/
├── 2025-06-10T143022-analysis.md        ← Fichier horodaté
├── 2025-06-10T143105-suggestion.md
├── 2025-06-10T143340-documentation.md
└── index.json                           ← ← Remplace current.md (Correction #5)
```

#### Correction #5 : `index.json` au lieu de `current.md`

Le fichier `index.json` contient la liste des prompts préparés avec un pointeur vers le prompt actif :

```json
{
  "current": "2025-06-10T143022-analysis",
  "prompts": [
    { "id": "2025-06-10T143022-analysis", "type": "analysis", "timestamp": 1748943022000, "tokens": 420 },
    { "id": "2025-06-10T143105-suggestion", "type": "suggestion", "timestamp": 1748943105000, "tokens": 380 },
    { "id": "2025-06-10T143340-documentation", "type": "documentation", "timestamp": 1748943340000, "tokens": 510 }
  ],
  "totalFiles": 3,
  "lastModified": 1748943340000
}
```

**Avantages :** Pas de lien symbolique (incompatible Windows), lecture rapide (un seul fichier JSON), stats intégrées.

Format du fichier `.md` individuel (inchangé) :
```markdown
# Prompt préparé — Analysis
> Généré le 2025-06-10 14:30:22
> Type : analysis
> Cache : false (composition API)
> Contexte : 12 nœuds, 5 arêtes
> Fenêtre contexte : 8192 tokens

## Message utilisateur
[Message original]

## Prompt système
[Contenu du prompt préparé...]

## Contexte utilisé
- Nœuds : 12 (5 process, 3 services, 2 decisions, 2 data)
- Arêtes : 5
- Nœuds sélectionnés : aucun
```

### H. UI — Section prompt dans le chat

```
┌─ Message utilisateur ───────────────────────┐
│ "Analyse la structure du canvas..."          │
└──────────────────────────────────────────────┘
┌─ ▼ Prompt utilisé (analysis · préparé) ─────┐
│ [Contenu du prompt préparé...]                │
│                               [↻ Re-préparer] │
└──────────────────────────────────────────────┘
┌─ Réponse générée ───────────────────────────┐
│ [Contenu de la réponse...]                    │
│              [⚡ Optimisé] [📏 420 tokens]   │
└──────────────────────────────────────────────┘
```

Pendant l'optimisation (Correction #3) :
```
┌─ Message utilisateur ───────────────────────┐
│ "Analyse la structure..."                    │
└──────────────────────────────────────────────┘
┌─ ▼ Prompt utilisé (analysis · préparé) ─────┐
│ ...                                           │
└──────────────────────────────────────────────┘
┌─ Réponse — ⚡ Optimisation en cours... ──────┐
│ [Contenu de la réponse originale]             │
│   [Badge jaune : ⚡ Optimisation en cours...] │
└──────────────────────────────────────────────┘
```

### I. Ajouts dans state.js

```js
state.assistant = {
  // ... existant ...

  // PromptEngine
  currentPrompt: null,       // PreparedPrompt | null
  promptHistory: [],         // PreparedPrompt[] (max 20)
  promptCache: {},           // { [type-contextHash]: PreparedPrompt }

  // Fenêtre de contexte
  contextWindow: 4096,       // Détecté automatiquement

  // Modèle de préparation/optimisation (optionnel)
  preparationModel: null,    // null = utilise le même modèle que le chat
  optimizationThreshold: 500, // seuil en tokens pour déclencher l'optimisation

  // Stats d'optimisation
  optimizationStats: {
    totalOptimized: 0,
    totalTokensSaved: 0,
    averageCompression: 0,   // ratio en %
  },
};
```

Nouvelles actions :
```js
actions.setCurrentPrompt(preparedPrompt);
actions.clearPromptCache();
actions.setContextWindow(size);
actions.setPreparationModel(modelId);
actions.setOptimizationThreshold(threshold);
```

### J. Endpoint API

Ajouter dans `scripts/env-server.mjs` :

- `GET /api/prompts` — liste + `index.json`
- `GET /api/prompts/{filename}` — contenu d'un fichier `.md`
- `POST /api/prompts` — écrire un nouveau fichier + mettre à jour `index.json`
- `DELETE /api/prompts/{id}` — supprimer un fichier (rotation)

**Rotation automatique :** Le dossier `data/prompts/` est limité à **50 fichiers maximum**. À chaque écriture d'un nouveau prompt, si le seuil est dépassé, les fichiers les plus vieux sont supprimés (en conservant toujours le prompt actif et l'`index.json` à jour).

Le dossier suit le même pattern que `data/providers/` (déjà existant). Créer le dossier au démarrage si inexistant.

---

## Plan d'implémentation

### Phase PE-1 : Fondation du PromptEngine

| # | Tâche | Fichiers | Effort |
|---|-------|----------|--------|
| 1.1 | Créer `promptEngine.js` : classe, types, interface publique, templates | `promptEngine.js` | 3h |
| 1.2 | Implémenter la catégorisation locale par mots-clés/règles | `promptEngine.js` | 1h |
| 1.3 | Implémenter l'auto-détection de la fenêtre de contexte (`detectContextWindow`) | `promptEngine.js` | 1h |
| 1.4 | Implémenter le cache + reuse (clé `{type}-{contextHash}`, timeout 5min) | `promptEngine.js` | 1h |
| 1.5 | Ajouter l'état `currentPrompt`, `promptHistory`, `contextWindow` dans `state.js` + actions | `state.js` | 1h |
| 1.6 | Endpoint API `POST /api/prompts` + `index.json` | `scripts/env-server.mjs` | 1h |
| 1.7 | Tests unitaires : catégorisation, cache (hash), détection contexte, templates | `promptEngine.test.js` | 2h |

### Phase PE-2 : Intégration dans le chat

| # | Tâche | Fichiers | Effort |
|---|-------|----------|--------|
| 2.1 | Modifier `sendMessage()` dans `chatPanel.js` pour appeler `promptEngine.preparePrompt()` | `chatPanel.js` | 1h |
| 2.2 | Modifier `buildSystemMessages()` pour accepter `customPrompt` + mode `replace/enrich` | `systemPrompt.js` | 0.5h |
| 2.3 | Section repliable dans le flux de chat (details/summary + CSS) | `chatPanel.js` + `default.css` | 2h |
| 2.4 | Rafraîchissement périodique (30s) + au changement canvas (subscribe) | `chatPanel.js` | 1h |
| 2.5 | Endpoint `GET /api/prompts` + `DELETE` pour rotation | `scripts/env-server.mjs` | 1h |
| 2.6 | Tests E2E : section prompt visible, cache, re-préparation | `e2e/prompt-engine.spec.js` | 3h |

### Phase PE-3 : Post-optimisation

| # | Tâche | Fichiers | Effort |
|---|-------|----------|--------|
| 3.1 | Implémenter `optimizeResponse()` dans `promptEngine.js` avec gestion d'échec | `promptEngine.js` | 2h |
| 3.2 | Prompts d'optimisation (template pour la révision de réponse) | `promptEngine.js` | 1h |
| 3.3 | Intégrer dans `sendMessage()` : après réponse, `isOptimizing = true`, estimer tokens | `chatPanel.js` | 1h |
| 3.4 | UI : badge "⚡ Optimisation en cours..." + remplacement fluide de la réponse | `chatPanel.js` + `default.css` | 1.5h |
| 3.5 | Badge `⚡ Optimisé` + mini message d'échec si l'optimisation échoue | `chatPanel.js` + `default.css` | 1h |
| 3.6 | Configuration : seuil d'optimisation dans le panneau chat | `chatPanel.js` | 1h |
| 3.7 | Tests unitaires + E2E pour l'optimisation (succès + échec) | `promptEngine.test.js` + `e2e/` | 2h |

### Phase PE-4 : Modèle de préparation séparé

| # | Tâche | Fichiers | Effort |
|---|-------|----------|--------|
| 4.1 | Ajouter la sélection de modèle de préparation dans le panneau Providers | `providerPanel.js` | 2h |
| 4.2 | `preparationModel` dans state.js + actions associées | `state.js` | 0.5h |
| 4.3 | `promptEngine` utilise le modèle de préparation si configuré, sinon le modèle chat | `promptEngine.js` | 1h |
| 4.4 | Tests : préparation avec modèle différent, fallback | `promptEngine.test.js` | 1h |

---

## Risques et mitigations

| Risque | Impact | Mitigation |
|--------|--------|------------|
| **Fenêtre contexte insuffisante** (ex: modèle 4K) | Réponse tronquée ou échec | Auto-détection + warning si prompt > 50% de la fenêtre |
| **Post-optimisation = appel API supplémentaire** | Latence doublée | Seulement si réponse > seuil (pas systématique) |
| **Échec optimisation** | Aucune optimisation | **Fallback :** garder la réponse brute + badge discret |
| **Modèle de préparation séparé non dispo** | Prompt non préparé | Fallback : utiliser le modèle du chat |
| **Cache obsolète** (même hash, canvas différent) | Mauvais prompt utilisé | Expiration 5 minutes + bouton "Re-préparer" |
| **Ollama /api/show non supporté** | Contexte non détecté | Fallback table de correspondance → fallback 4096 |
| **Double optimisation** | Boucle infinie | Flag interne `_alreadyOptimized` |
| **Estimation tokens approximative** (ratio 4:1) | Seuil déclenché trop tard/tôt | Note dans la doc, seuil ajustable |
| **Mode `enrich`** : concaténation prompt préparé + SYSTEM_PROMPT | Dépassement fenêtre de contexte | Utiliser uniquement pour les prompts courts (conversation). Fallback vers `replace` si la taille totale > 50% de la fenêtre |

---

## Dépendances

- `chatPanel.js` — déjà lu, modifié (P0/P1)
- `systemPrompt.js` — déjà lu, à modifier (PE-2.2)
- `state.js` — déjà lu, à étendre (PE-1.5, PE-4.2)
- `aiClient.js` — déjà lu, pas de changement nécessaire
- `providerPanel.js` — déjà lu, à étendre (PE-4.1)
- `scripts/env-server.mjs` — déjà lu, pattern REST existant pour ajouter endpoints
- `data/prompts/` — à créer (data/ existe déjà)

---

## Décisions architecturales

| Décision | Choix | Raison |
|----------|-------|--------|
| **Provider** | Local (Ollama/LM Studio) | Pas de limite de crédit, gratuit |
| **Modèle** | Adaptable (auto-détection) | Système s'adapte au modèle chargé |
| **Stratégie SYSTEM_PROMPT** | `replace` par défaut, `enrich` en fallback | Le prompt préparé est auto-suffisant |
| **Clé de cache** | `{type}-{contextHash}` | Invalidation automatique, pas de subscribe nécessaire |
| **Expiration cache** | 5 minutes | Évite les prompts trop obsolètes |
| **Post-optimisation** | Seuil 500 tokens, pas systématique | Évite le surcoût pour les réponses courtes |
| **Échec optimisation** | Fallback réponse brute | Non-bloquant |
| **Visibilité optimisée** | Seulement la version finale | UX simple |
| **Index prompts** | `index.json` (pas de lien symbolique) | Portable Windows, lisible en un appel |
| **Modèle préparation** | Sélectionnable par l'utilisateur | Flexibilité |
| **Section UI** | `<details>/<summary>` HTML natif | Pas de JS supplémentaire, accessible |
| **Fallback global** | `SYSTEM_PROMPT` existant si promptEngine échoue | Pas de regression |
