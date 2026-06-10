# Spec : Refonte complète du panneau Providers

**Date** : 2026-06-06
**Statut** : En attente d'implémentation
**Statut d'implémentation** (mis à jour : juin 2026) : ✅ **Implémenté** — toutes les zones et étapes du workflow sont en production
>
> - `src/code-city/ai/providerPanel.js` ✅ refondu en 3 zones (status sticky / grille 2 colonnes / workflow 6 étapes)
> - `src/code-city/ai/workflowRunner.js` ✅ créé (étapes 0–7, `startWorkflow`, `cancelWorkflow`, `testApiKey`, `selectModel`, `getDisplayModels`)
> - `src/code-city/ai/keyRotation.js` ✅ créé (LRU rate-limit, `getNextKey`, `markRateLimited`, `trackError`, `getKeyStatuses`)
> - Barre de progression 6 étapes (URL → Clé → Modèles → Sélection → Test → OK) ✅
> - Détection 429 + rotation multi-clés + fallback « toutes clés rate-limitées » ✅
> - Tri Top 15 modèles : gratuit > context window DESC > alphabétique ✅
> - Le **Statut original** « En attente d'implémentation » est obsolète — la spec est implémentée
> - **Drift mineur** : la spec parlait de `apiKeys[]` dans le state (refactor abandonnait cette approche) ; le code utilise `providerConfigs` cache en mémoire
> - Pour le code exact à appliquer, voir [`provider-panel-implementation-guide.md`](provider-panel-implementation-guide.md) (également implémenté)
**Priorité** : Haute
**Version** : 1.4 (post cross-review — incohérences spec/guide résolues)

---

## 1. Résumé exécutif

Refonte complète du panneau de configuration des providers IA. Le panneau actuel (liste simple + config inline) est remplacé par un layout à 3 zones avec un workflow guidé automatisé, un service d'interchange de clés API, et des modèles chargés dynamiquement (plus de modèles hardcodés).

---

## 2. Architecture du panneau — 3 Zones

### 2.1 Dimensions du panneau
- **Largeur** : 30% de la largeur de l'écran (min: 400px, max: 700px)
- **Position** : Slide-in depuis la droite (comportement existant conservé)
- **Hauteur** : 100% de la fenêtre, avec scroll vertical si contenu dépasse
- **Z-index** : Au-dessus du canvas, au-dessous des modales et toasts

### 2.2 Zone 1 — Status de la config actuelle
**Position** : En haut du panneau (sticky)
**Contenu** :
- Nom du provider actif (ex: "Ollama", "OpenRouter")
- Modèle sélectionné (ex: "llama3.2", "meta-llama/llama-3.2-3b-instruct:free")
- Indicateur de statut : ✅ Connecté / ⚫ Déconnecté / ⏳ En cours de test (animation de pulsation)
- **Pas** de latence ni de nombre de clés dans cette zone (garder minimal)

### 2.3 Zone 2 — Tableau dynamique des providers
**Position** : Sous la Zone 1, hauteur variable
**Layout** : Tableau fixe à 2 colonnes
- **Colonne 1** (2/5 de la largeur) : Providers dont le `name` fait **1 seul mot** (ex: "kilo", "codestral", "gemini", "groq", "ollama", "OpenRouter")
- **Colonne 2** (3/5 de la largeur) : Providers dont le `name` fait **plusieurs mots** (ex: "Google Gemini", "OpenCode Zen", "LM Studio")
- **Règle de placement** : `name.split(' ').length === 1` → colonne 1, sinon → colonne 2. **Dynamique** — si on corrige "Google Gemini" en "Gemini", le provider passe automatiquement en colonne 1 au prochain rendu.
- **Chaque cellule** : Un bouton cliquable qui sélectionne le provider et lance le workflow dans la Zone 3
- **Séparation visuelle** : Providers en ligne (section "En ligne") puis providers locaux (section "Local")
- **Hauteur** : Variable — s'adapte au nombre de providers
- **Sélection active** : Le provider actif a un fond accent + bordure left colorée
- **Scroll** : Si plus de 15 providers, scroll vertical dans la Zone 2 (Zone 1 reste sticky)

**Providers prédéfinis (presets)** :
| ID | name | Colonne | Catégorie | Auth | modelListingUrl |
|---|---|---|---|---|---|
| openrouter | OpenRouter | 1 (1 mot) | online | ✅ | `{baseUrl}/models` |
| gemini | Gemini | 1 (1 mot) | online | ✅ | `{baseUrl}/models?key={apiKey}` |
| kilo | kilo | 1 (1 mot) | online | ✅ | `{baseUrl}/models` |
| opencode-zen | OpenCode Zen | 2 (2 mots) | online | ✅ | `{baseUrl}/models` |
| mistral | mistral | 1 (1 mot) | online | ✅ | `{baseUrl}/models` |
| codestral | codestral | 1 (1 mot) | online | ✅ | `{baseUrl}/models` |
| groq | groq | 1 (1 mot) | online | ✅ | `{baseUrl}/models` |
| ollama | ollama | 1 (1 mot) | local | ❌ | `GET /api/tags` |
| lmstudio | LM Studio | 2 (2 mots) | local | ❌ | `{baseUrl}/models` |

> **Note** : "OpenRouter" fait 1 seul mot → colonne 1. La règle est purement `name.split(' ').length`.

**Providers custom** : Affichés séparément des presets dans une section "Personnalisés" avec un bouton "➕ Ajouter un provider" en bas de la section. La même règle de placement s'applique au `name` du provider custom.

**Structure d'un provider custom** :
```javascript
{
  id: 'custom-1686000000',     // 'custom-' + timestamp
  name: 'Mon Provider',        // nom unique (1 mot → col1, >1 mot → col2)
  category: 'online',          // 'online' | 'local'
  baseUrl: 'https://...',      // URL de base
  authRequired: true,          // nécessite une clé API
  defaultModel: '',            // modèle par défaut
  models: [],                  // modèles pré-chargés (optionnel)
  icon: 'plug',                // icône
  description: '',             // description
  modelListingUrl: '',         // URL pour lister les modèles (optionnel, défaut: baseUrl + '/models')
}
```

**Fonction de placement** :
```javascript
// Détermine si un provider va en colonne 1 ou 2
function isShortName(name) {
  return name.trim().split(/\s+/).length === 1;
}
```

### 2.4 Zone 3 — Panel de configuration (Workflow guidé)
**Position** : Sous la Zone 2, prend tout l'espace restant
**Comportement** : Affiche le workflow étape par étape quand un provider est sélectionné dans la Zone 2
**État vide** : Quand aucun provider n'est sélectionné, afficher un message "Sélectionne un provider pour commencer"
**État final** : Après validation du workflow, afficher un résumé de la configuration (provider + modèle + statut)

---

## 3. Workflow guidé — Étapes

Le workflow se déroule **automatiquement en arrière-plan**. L'utilisateur est informé via des toasts à chaque étape. L'utilisateur peut interrompre le workflow à tout moment en sélectionnant un autre provider dans la Zone 2.

### Architecture du workflowRunner

Le workflow est orchestré par `workflowRunner.js`, un module ES séparé. **Il ne passe PAS par les actions du state.js** pour des raisons de coupling :

```javascript
// workflowRunner.js — API publique
export function startWorkflow(providerId) { ... }   // Lance le workflow
export function cancelWorkflow() { ... }             // Annule (AbortController)
export function getWorkflowState() { ... }           // Retourne { step, error }
```

- `providerPanel.js` importe `workflowRunner.js` directement
- `workflowRunner.js` importe `state.js` pour lire/écrire le provider
- **Pas de circularité** : state.js ne dépend PAS de workflowRunner.js
- L'`AbortController` est détenu par workflowRunner.js (niveau module)

### Annulation du workflow
- **Déclencheur** : Sélection d'un autre provider dans la Zone 2
- **Action** :
  1. `workflowRunner.cancelWorkflow()` — annule les appels API en cours via AbortController
  2. `toast.dismissAll()` — fermer tous les toasts du workflow précédent
  3. Lancer `workflowRunner.startWorkflow(newProviderId)` pour le nouveau provider
- **Pas de toast d'annulation** — le nouveau workflow démarre silencieusement

### Étape 1 : Sélection du provider
- **Déclencheur** : Clic sur un provider dans la Zone 2
- **Action** : `actions.setProvider(id)` + `workflowRunner.startWorkflow(id)`
- **Toast** : `info` — "Provider [nom] sélectionné"
- **Si local (Ollama/LM Studio)** : Passer directement à l'Étape 3 (pas de clé API)
- **Si même provider déjà actif** : Ne rien faire (pas de re-workflow)

### Étape 2 : Configuration de la clé API (si authRequired)
**Le workflow SE MET EN PAUSE ici** — il attend une action utilisateur (saisie de la clé + clic "Tester").

- **Contenu de la Zone 3** :
  - Champ "Clé API" (type password, avec bouton œil pour afficher/masquer)
  - Bouton "Tester la clé" (disabled tant que le champ est vide)
  - Indicateur de chargement pendant le test
- **Validation** :
  - Le champ ne doit pas être vide
  - La clé est envoyée au provider pour un test minimal (chatCompletion avec "Say ok" en anglais pour compatibilité maximale)
  - **Toast** : `info` — "Test de la clé en cours..."
- **Résultat** :
  - ✅ Succès → `toast.success` — "Clé API validée" → reprendre le workflow (Étape 3)
  - ❌ Échec → `toast.error` — "Clé API invalide : [erreur]" → rester sur l'étape
- **Timeout** : 10 secondes maximum pour le test
- **Comportement timeout** : `toast.error` — "Délai d'attente dépassé (10s). Vérifie ta connexion." → rester sur l'étape, permettre un retry

### Étape 3 : Chargement des modèles disponibles
- **Déclencheur** : Clé API validée OU provider local
- **Action** : Appeler l'API de listing des modèles du provider
  - Providers online (OpenAI-compatible) : `GET {baseUrl}/models` avec Authorization header
  - Gemini : `GET {baseUrl}/models?key={apiKey}` (endpoint spécifique Google)
  - Providers local : `fetchLocalModels()` existant (Ollama: `/api/tags`, LM Studio: `/models`)
- **Normalisation des réponses** : `fetchModels()` doit normaliser les formats différents en un tableau commun :
  ```javascript
  // Format de sortie normalisé
  Array<{ id: string, name: string, contextWindow?: number, isFree?: boolean }>
  
  // OpenAI-compatible : { data: [{ id, owned_by, ... }] }
  // Gemini : { models: [{ name, displayName, ... }] }
  // Ollama : { models: [{ name, ... }] }
  ```
- **Stockage** : Les modèles sont stockés en **mémoire dans workflowRunner.js** (`loadedModels`), PAS dans le state persisté. Raison : les listes de modèles peuvent être volumineuses (100+ pour OpenRouter) et changent entre sessions.
- **Toast** : `info` — "Chargement des modèles disponibles..."
- **Résultat** :
  - ✅ Modèles reçus → afficher dans la Zone 3
  - ❌ Erreur → `toast.error` — "Impossible de charger les modèles : [erreur]" + afficher fallback (modèles hardcodés du preset)
- **Timeout** : 15 secondes maximum
- **Comportement timeout** : `toast.error` — "Délai d'attente dépassé (15s). Modèles fallback affichés." → afficher les modèles hardcodés du preset

### Étape 4 : Sélection du modèle
- **Affichage dans la Zone 3** :
  - **Par défaut** : "Top 15" des modèles (voir §4 pour le classement)
  - **Lien** : "Voir tous les modèles disponibles" en bas de la liste (affiche la suite)
  - **Chaque modèle** : Bouton cliquable avec nom + context window si disponible
  - **Modèle actif** : Fond accent + checkmark
  - **Barre de recherche** : Champ de filtrage au-dessus de la liste (recherche par nom, tri instantané)
- **État de la barre de recherche** : Variables locales du composant providerPanel.js (`searchQuery`, `showAllModels`), PAS dans le state global (pas de persistance nécessaire)
- **Toast** : `success` — "[nombre] modèles disponibles, [nombre] gratuits"

### Étape 5 : Test du modèle
- **Déclencheur** : Sélection d'un modèle
- **Action** : Vérifier que le modèle répond correctement
  - Envoyer un prompt simple : `"Say hello"`
  - **Objectif** : Vérifier que le modèle renvoie une réponse non vide et non-erreur
  - **Détection côté client** (PAS via le modèle) :
    - **Format** : Déterminé par le provider sélectionné (OpenAI-compatible par défaut, Gemini si `provider.id === 'gemini'`)
    - **FIM** : Tester l'endpoint `{baseUrl}/fim/completions` si `provider.id === 'codestral'` → si 200, `capabilities: ['chat', 'fim']`, sinon `capabilities: ['chat']`
    - **Context window** : Extraire de la réponse de l'API de listing modèles (champ `context_window` ou `contextWindow`), ou `null` si non disponible
  - **Stockage** : Ces informations sont sauvegardées en **mémoire dans workflowRunner.js** (`modelMeta`), PAS dans le state persisté
- **Toast** : `info` — "Test du modèle [nom] en cours..."
- **Résultat** :
  - ✅ Réponse reçue → `toast.success` — "Modèle [nom] testé avec succès ([latence]ms)"
  - ❌ Erreur → `toast.error` — "Test échoué : [erreur]" → permettre à l'utilisateur de choisir un autre modèle
- **Timeout** : 20 secondes maximum
- **Comportement timeout** : `toast.error` — "Délai d'attente dépassé (20s). Sélectionne un autre modèle." → permettre un nouveau choix

### Étape 6 : Validation de la connexion
- **Déclencheur** : Test du modèle réussi
- **Action** :
  - Marquer `provider.isConnected = true` (dans le state persisté)
  - Marquer `provider.lastTestedAt = Date.now()` (dans le state persisté)
  - Copier `modelMeta` depuis workflowRunner vers `state.assistant.provider.modelMeta` (temporaire — vidé par persistAssistant())
  - Copier `selectedModel` depuis workflowRunner vers `state.assistant.provider.model` (persisté)
- **Toast** : `success` — "Connexion validée ! [provider] — [modèle] est prêt."
- **Zone 3** : Afficher un résumé de la configuration (provider + modèle + statut)

### Étape 7 : Sauvegarde automatique
- **Déclencheur** : Chaque mutation du state
- **Action** : `persistAssistant()` appelé automatiquement à chaque mutation du state
- **Pas de bouton "Sauvegarder"** — tout est auto-save
- **Ce qui est persisté** : `provider` (sauf modelMeta), `providers.custom`, `apiKeys`, `chatHistory`
- **Ce qui N'EST PAS persisté** : `workflowState`, `loadedModels`, `modelMeta` (exclu de persistAssistant via destructuring), `searchQuery`, `showAllModels`

---

## 4. Classement des modèles — "Top 15"

### Critères de classement (par ordre de priorité)
1. **Modèles gratuits** en premier (ceux avec `:free` dans l'ID ou marqués comme free)
2. **Context window** : les modèles avec un grand context window en second
3. **Alphabétique** : tri alphabétique par nom pour les modèles égaux

> **Note** : Il n'existe pas de source de données de "popularité" fiable. Le classement est basé sur des critères objectifs (gratuit → context window → alphabétique).

### Algorithme de détection "gratuit"
```javascript
function isFreeModel(model) {
  // OpenRouter : ':free' dans l'ID
  if (model.id.includes(':free')) return true;
  // Convention générique : '-free' dans l'ID
  if (model.id.includes('-free')) return true;
  // Mot-clé dans le nom
  if (model.name.toLowerCase().includes('gratuit') || model.name.toLowerCase().includes('free')) return true;
  // Pricing explicite
  if (model.pricing?.prompt === '0' || model.pricing?.prompt === 0) return true;
  return false;
}
```

### Affichage
- **Top 15** : Affiché par défaut, trié par (gratuit > context window DESC > alphabétique)
- **"Voir tous les modèles"** : Lien cliquable en bas de la liste Top 15
  - Affiche la suite des modèles (au-delà des 15 premiers)
  - Le lien se transforme en "Voir moins" pour revenir au Top 15
- **Barre de recherche** : Filtre instantané par nom de modèle (recherche-insensible-casse)

---

## 5. Service d'interchange de clés API

### 5.1 Objectif
Quand une clé API atteint sa limite de requêtes (rate limit), le service bascule automatiquement sur la clé suivante disponible pour le même provider.

### 5.2 Détection de rate limit
- **Code HTTP** : 429 (Too Many Requests)
- **Headers** (si disponibles) :
  - `Retry-After` : temps d'attente en secondes avant la prochaine requête
  - `X-RateLimit-Remaining` : nombre de requêtes restantes
  - `X-RateLimit-Reset` : timestamp de réinitialisation
- **Fallback** : Si pas de headers, utiliser un timeout par défaut de 60 secondes
- **Détection secondaire (erreurs 500/503)** : keyRotation.js maintient un compteur d'erreurs par provider en mémoire :
  ```javascript
  // Dans keyRotation.js — compteur d'erreurs
  const errorCounts = new Map(); // providerId → { count, windowStart }
  
  function trackError(providerId) {
    const now = Date.now();
    const entry = errorCounts.get(providerId) || { count: 0, windowStart: now };
    // Reset si la fenêtre de 60s est dépassée
    if (now - entry.windowStart > 60000) {
      entry.count = 0;
      entry.windowStart = now;
    }
    entry.count++;
    errorCounts.set(providerId, entry);
    // Si ≥3 erreurs en 60s → traiter comme rate limit
    if (entry.count >= 3) {
      markRateLimited(providerId, -1, 60); // -1 = index inconnu, timeout 60s
    }
  }
  ```

### 5.3 Stratégie — Least-Recently-Used (LRU)
```javascript
// Service keyRotation — API publique
export const keyRotation = {
  // Sélectionne la prochaine clé (LRU parmi les clés non rate-limitées)
  getNextKey(providerId) { ... },

  // Marque une clé comme rate-limitée
  markRateLimited(providerId, keyIndex, retryAfter) { ... },

  // Vérifie si une clé est de nouveau disponible
  isKeyAvailable(providerId, keyIndex) { ... },

  // Réinitialise le status d'une clé après son timeout
  resetKeyStatus(providerId, keyIndex) { ... },

  // Retourne le statut de toutes les clés d'un provider (utilisé par §6.3)
  getKeyStatuses(providerId) { ... },

  // Track les erreurs 500/503 pour détection secondaire
  trackError(providerId) { ... }
};
```

### 5.4 Workflow d'interchange
1. Requête échoue avec HTTP 429
2. Parser les headers `Retry-After` et `X-RateLimit-Remaining`
3. Marquer la clé courante comme rate-limitée avec `rateLimitedUntil = Date.now() + (retryAfter * 1000)`
4. Sélectionner la prochaine clé disponible (LRU parmi les clés non rate-limitées)
5. Si aucune clé disponible → **notififer l'utilisateur** (voir §5.5)
6. Si une clé disponible → réessayer la requête avec la nouvelle clé
7. Si le retry réussi → `toast.success` — "Basculement sur une autre clé API réussi"
8. **Max retries** : 3 tentatives maximum par requête avant abandon

### 5.5 Gestion de l'échec (toutes les clés rate-limitées)
Quand toutes les clés d'un provider sont rate-limitées :
- `toast.error` — "Toutes les clés API de [provider] sont rate-limitées"
- **Options proposées à l'utilisateur** :
  1. **Ajouter une nouvelle clé** → Ouvre la modale apiKeysModal en mode ajout
  2. **Changer de provider** → Retour à la Zone 2 pour sélectionner un autre provider
  3. **Attendre** → Afficher le temps d'attente restant (si calculable)

### 5.6 Persistance des statuts de clés
- Les statuts `isRateLimited` et `rateLimitedUntil` sont en mémoire (pas en localStorage)
- Au rechargement de la page, les clés sont considérées comme disponibles
- Les timestamps `lastUsedAt` sont sauvegardés dans `state.assistant.apiKeys[].lastUsedAt`

---

## 6. Modale de gestion des clés API (refonte)

### 6.1 Validation à l'ajout
Quand l'utilisateur ajoute une nouvelle clé :
1. **Toast** : `info` — "Validation de la clé API..."
2. **Test** : Envoyer un appel minimal au provider (chatCompletion "Say ok" en anglais)
3. **Résultat** :
   - ✅ Succès → `toast.success` — "Clé API validée et sauvegardée"
   - ❌ Échec → `toast.error` — "Clé API invalide : [erreur]" → la clé n'est PAS sauvegardée
4. **Timeout** : 10 secondes maximum
5. **Rate limiting** : Maximum 3 tentatives de validation par minute (anti-abus)
   - **État du compteur** : Variable locale dans `apiKeysModal.js` (`let validationAttempts = [];`)
   - À chaque tentative : push `Date.now()`, filtrer les timestamps > 60s, vérifier `length < 3`

### 6.2 Interface de la modale
- **Liste des clés** : Masquées (4 premiers + 4 derniers caractères)
- **Actions par clé** : Voir, Éditer, Appliquer au provider, Supprimer
- **Bouton ajouter** : Formulaire (nom, provider, clé API)
- **Indicateur de statut** : Badge vert (valide), orange (rate-limitée avec temps restant), gris (non testée)
- **Clé active** : Indicateur visuel de la clé actuellement utilisée par le provider

### 6.3 Service d'interchange intégré
La modale affiche (en utilisant `keyRotation.getKeyStatuses(providerId)` défini en §5.3) :
- Le nombre total de clés par provider
- Les clés actuellement rate-limitées (avec temps restant)
- La clé "active" (celle utilisée en ce moment)

### 6.4 Backward compatibility
- Les anciennes clés (sans `lastUsedAt`, `isValid`, `lastTestedAt`) sont automatiquement migrées dans `readStoredAssistant()`
- Valeurs par défaut : `lastUsedAt: null`, `isValid: null`, `lastTestedAt: null`
- **Migration** : Dans `readStoredAssistant()`, boucler sur `data.apiKeys` et ajouter les champs manquants

---

## 7. State Management

### 7.1 Structure du state `assistant` (PERSISTÉ dans localStorage)
```javascript
assistant: {
  provider: {
    id: 'ollama',
    apiKey: '',
    baseUrl: 'http://localhost:11434/v1',
    model: 'llama3.2',
    temperature: 0.7,
    maxTokens: 4096,
    isConnected: false,
    lastTestedAt: null,
    modelMeta: null, // TEMPORAIRE — voir §7.7 : sérialisé puis vidé après copie
  },
  providers: {
    custom: [], // Array<CustomProvider> — voir §2.3 pour la structure
  },
  apiKeys: [
    {
      name: 'Ma clé OpenRouter',
      providerId: 'openrouter',
      value: 'sk-...',
      createdAt: 1686000000000,
      lastUsedAt: 1686000000000,
      isValid: true, // null = non testée, true = valide, false = invalide
      lastTestedAt: 1686000000000,
    }
  ],
  chatHistory: [],
}
```

### 7.2 État du workflow (EN MÉMOIRE uniquement — dans workflowRunner.js)
```javascript
// workflowRunner.js — variables au niveau module
let currentStep = 0;        // 0=inactive, 1=provider, 2=apikey, 3=loading, 4=select, 5=testing, 6=validated
let currentError = null;    // { step: number, message: string, timestamp: number } | null
let abortController = null; // AbortController pour annulation
let loadedModels = [];      // Array<{ id, name, contextWindow?, isFree? }> — PAS persisté
let modelMeta = null;       // { format, capabilities, contextWindow } — temporaire, copié dans state à l'étape 6
```

### 7.3 État de la barre de recherche (EN MÉMOIRE — dans providerPanel.js)
```javascript
// providerPanel.js — variables locales du composant
let modelSearchQuery = '';
let showAllModels = false;
```

### 7.4 État du rate limiting erreurs (EN MÉMOIRE — dans keyRotation.js)
```javascript
// keyRotation.js — compteur d'erreurs 500/503
const errorCounts = new Map(); // providerId → { count: number, windowStart: number }
```

### 7.5 État validation rate limiting (EN MÉMOIRE — dans apiKeysModal.js)
```javascript
// apiKeysModal.js — compteur de tentatives
let validationAttempts = []; // Array<number> — timestamps des tentatives (sliding window 60s)
```

### 7.6 Opérations implémentées dans workflowRunner.js (PAS dans state.js)

Ces opérations sont gérées par `workflowRunner.js` qui appelle `aiClient.js` directement. Elles **ne sont PAS des actions state.js** pour éviter la circularité (workflowRunner → state.js, mais PAS state.js → workflowRunner.js) :

| Opération | Implémentée dans | Fonction aiClient utilisée |
|---|---|---|
| Tester une clé API | `workflowRunner.testApiKey()` | `chatCompletion()` |
| Sélectionner la prochaine clé (LRU) | `keyRotation.getNextKey()` | — |
| Marquer une clé rate-limitée | `keyRotation.markRateLimited()` | — |
| Charger les modèles | `workflowRunner.runStep3()` | `fetchModels()` |
| Tester un modèle | `workflowRunner.runStep5()` | `testModel()` |

> **Note** : `cancelWorkflow()` N'EST PAS une action du state. C'est une fonction de `workflowRunner.js` appelée directement par `providerPanel.js` pour éviter la circularité.
> 
> **Note** : `modelMeta` est stocké temporairement dans `state.assistant.provider.modelMeta` à l'étape 6, puis **exclu de la sérialisation** dans `persistAssistant()` (voir §7.7). C'est un état éphémère recopié au rechargement.

### 7.7 Persistance
- `persistAssistant()` sérialise **uniquement** : `provider`, `providers`, `apiKeys`, `chatHistory`
- **NE PAS sérialiser** : `loadedModels` (trop volumineux), `workflowState` (éphémère), `modelMeta` (temporaire)
- Les statuts rate-limit (keyRotation) sont en mémoire uniquement
- La barre de recherche est en mémoire uniquement

---

## 8. Fichiers à modifier/créer

### Fichiers existants à modifier
| Fichier | Modifications |
|---|---|
| `src/code-city/ai/providerPanel.js` | Réécriture complète → layout 3 zones, workflow guidé, annulation, barre de recherche |
| `src/code-city/ai/providerPresets.js` | Renommer `name` en `name` court/long selon les presets existants + ajouter `modelListingUrl` |
| `src/code-city/ai/apiKeysModal.js` | Validation à l'ajout + indicateurs de statut + backward compat + compteur tentatives |
| `src/code-city/ai/aiClient.js` | Ajouter `fetchModels(provider)` dynamique + `testModel()` + gestion 429 |
| `src/code-city/state.js` | Nouvelles actions + `modelMeta` dans provider + migration apiKeys |
| `src/styles/default.css` | Nouveaux styles pour layout 3 zones, tableau, workflow, barre de recherche |

### Fichiers à créer
| Fichier | Description |
|---|---|
| `src/code-city/ai/keyRotation.js` | Service d'interchange de clés (LRU + détection 429 + compteur erreurs 500/503) — tout en mémoire |
| `src/code-city/ai/workflowRunner.js` | Orchestrateur du workflow guidé (étapes 1-7 + pause step 2 + annulation + AbortController) — tout en mémoire |

---

## 9. Contraintes techniques

- **Pas de framework** : Vanilla JS + DOM (comme le reste du projet)
- **Module system** : ES Modules (import/export)
- **State** : Store central dans `state.js` avec subscribers
- **CSS** : Variables CSS existantes (--bg, --text, --accent, --border, etc.)
- **Toast** : Service existant dans `toast.js` (success, error, info, warning)
- **Tests** : Vitest existant (118 tests) — ajouter des tests pour keyRotation et workflowRunner
- **Annulation** : Utiliser AbortController pour les appels fetch du workflow
- **Sécurité** : Clés API stockées en clair dans localStorage (contrainte client-side)
- **Timeout** : Chaque étape du workflow a un timeout spécifique (10-20 secondes)
- **État éphémère** : workflowState, loadedModels, modelMeta, searchQuery, errorCounts, validationAttempts sont en mémoire, PAS persistés
- **Coupling** : workflowRunner.js est importé par providerPanel.js. state.js ne dépend PAS de workflowRunner.js (pas de circularité)

---

## 10. UX Flow — Scénario complet

```
1. User clique "Providers" → panneau s'ouvre
2. Zone 1 : Affiche "Ollama — llama3.2 — ⚫ Déconnecté"
3. Zone 2 : Liste des providers (OpenRouter, Gemini, ..., Ollama, LM Studio)
4. Zone 3 : "Sélectionne un provider pour commencer"

--- User clique sur "OpenRouter" ---

5. Zone 1 : "OpenRouter — (aucun modèle) — ⏳ En cours..."
6. Zone 2 : OpenRouter sélectionné (fond accent)
7. Zone 3 : Étape 2 — Champ clé API + bouton "Tester"
8. Toast : "Provider OpenRouter sélectionné"

--- User entre sa clé et clique "Tester" ---

9. Toast : "Test de la clé en cours..."
10. API test : chatCompletion("Say ok") → Succès
11. Toast : "Clé API validée"
12. Zone 3 → Étape 3 : "Chargement des modèles..."
13. Toast : "Chargement des modèles disponibles..."

--- API retourne la liste des modèles ---

14. Toast : "47 modèles disponibles, 12 gratuits"
15. Zone 3 → Étape 4 : Top 15 affiché + barre de recherche
16. Zone 1 : "OpenRouter — (aucun modèle) — ⚫ Déconnecté"

--- User clique sur "Llama 3.2 3B (gratuit)" ---

17. Toast : "Test du modèle Llama 3.2 3B en cours..."
18. API test : chatCompletion("Say hello") → réponse non vide
19. Détection client : format=openai, capabilities=["chat"], contextWindow=8192
20. modelMeta stocké en mémoire
21. Toast : "Modèle Llama 3.2 3B testé avec succès (245ms)"
22. Zone 1 : "OpenRouter — Llama 3.2 3B (gratuit) — ✅ Connecté"
23. Zone 3 → Étape 6 : Résumé de la configuration
24. Auto-save → state persisté en localStorage

--- Plus tard, rate limit atteint ---

25. Requête chat échoue → HTTP 429 + Retry-After: 30
26. keyRotation.markRateLimited("openrouter", 0, 30)
27. keyRotation.getNextKey("openrouter") → clé index 1
28. Retry automatique avec clé index 1 → Succès
29. Toast : "Basculement sur une autre clé API réussi"

--- Toutes les clés rate-limitées ---

30. toast.error : "Toutes les clés API de OpenRouter sont rate-limitées"
31. Options : [Ajouter une clé] [Changer de provider] [Attendre 30s]
```

---

## 11. Risques et mitigation

| Risque | Impact | Mitigation |
|---|---|---|
| Certains providers n'ont pas d'API de listing modèles | High | Fallback sur modèles hardcodés du preset |
| Gemini utilise un format API différent | Medium | `modelListingUrl` dans le preset + normalisation dans `fetchModels()` |
| Test modèle "Say hello" ne vérifie pas le format | Low | Le format est déterminé côté client par le provider sélectionné |
| Trop de toasts simultanés | Low | Max 5 toasts visibles + `toast.dismissAll()` au début de chaque workflow |
| Performance si beaucoup de providers custom | Low | Scroll dans Zone 2, pas de virtual scroll pour l'instant |
| Rate limit non détecté (pas de 429) | Medium | Compteur d'erreurs 500/503 dans keyRotation.js (≥3 en 60s) |
| Clés API en clair dans localStorage | Medium | Documenter la contrainte client-side |
| Prompt de test en français non compris | Low | Prompt "Say hello" en anglais universel |
| Workflow interrompu par sélection d'un autre provider | Low | AbortController + toast.dismissAll() + cancelWorkflow() |
| loadedModels volumineux (100+ modèles) | Medium | Stocké en mémoire uniquement, PAS dans localStorage |
| Circularité state.js ↔ workflowRunner.js | Low | workflowRunner importe state.js, mais PAS l'inverse |

---

## 12. Tests requis

### Stratégie de mocking
- **fetch** : Mock global avec `vi.fn()` pour simuler les réponses API
- **DOM** : Utiliser `jsdom` (déjà présent dans les dépendances) pour les tests de rendering
- **localStorage** : Mock avec `vi.fn()` pour les tests de persistence
- **Toast** : Mock du service toast pour vérifier les appels (`vi.mock('./toast.js')`)
- **Workflow async** : Utiliser `vi.useFakeTimers()` pour les timeouts + `await` pour les promesses
- **Formats API** : Mock des réponses OpenAI (`{ data: [...] }`), Gemini (`{ models: [...] }`), Ollama (`{ models: [...] }`)

### Tests unitaires (Vitest)
- `keyRotation.test.js` :
  - LRU : sélection de la clé la plus ancienne
  - Détection 429 : marquage rate-limitée + reset timeout
  - Basculement : passage automatique à la clé suivante
  - Échec : toutes les clés rate-limitées
  - Reset : remise à zéro après expiration du timeout
  - Compteur erreurs : 3 erreurs 500 en 60s → rate limit déclenché

- `workflowRunner.test.js` :
  - Chaque étape du workflow (1-7)
  - Transitions entre étapes
  - Pause à l'étape 2 (attente utilisateur)
  - Gestion des erreurs à chaque étape
  - Annulation du workflow (AbortController)
  - Timeouts à chaque étape (fake timers)
  - Providers locaux (skip étape 2)
  - loadedModels non persisté (vérifier que persistAssistant ne les inclut pas)

- `providerPresets.test.js` : Mis à jour (count = 9 + custom)
- `aiClient.test.js` : Nouvelles fonctions `fetchModels`, `testModel`
- `apiKeysModal.test.js` : Validation à l'ajout, indicateurs de statut, rate limiting tentatives

### Tests d'intégration
- Workflow complet : sélection → clé → modèles → test → validation
- Interchange de clés : mock HTTP 429, vérifier le basculement
- Providers locaux : workflow sans clé API
- Annulation : sélection d'un autre provider mid-workflow
- loadedModels : vérifier qu'il n'est pas dans le localStorage après le workflow

---

## 13. Ordre d'implémentation proposé

1. **Phase 1 — State + Types** (state.js)
   - Ajouter `modelMeta` au provider (persisté)
   - Ajouter `lastUsedAt`, `isValid`, `lastTestedAt` aux apiKeys
   - Nouvelles actions (validateApiKey, rotateApiKey, etc.)
   - Backward compatibility : migration des anciennes apiKeys dans `readStoredAssistant()`

2. **Phase 2 — Services** (keyRotation.js, workflowRunner.js)
   - Créer le service keyRotation (LRU + 429 + compteur erreurs 500/503) — tout en mémoire
   - Créer le workflowRunner (orchestrateur étapes + pause step 2 + annulation + AbortController) — tout en mémoire

3. **Phase 3 — API Client** (aiClient.js)
   - Ajouter `fetchModels(provider)` dynamique (OpenAI + Gemini + local) avec normalisation
   - Ajouter `testModel(provider, model)` avec prompt "Say hello"
   - Modifier `testConnection` pour retourner les headers 429

4. **Phase 4 — Provider Panel** (providerPanel.js)
   - Réécrire le render pour le layout 3 zones
   - Implémenter le workflow guidé dans la Zone 3 (appel workflowRunner)
   - Ajouter barre de recherche pour les modèles (état local)
   - Intégrer le toast à chaque étape
   - Implémenter l'annulation du workflow (cancelWorkflow + dismissAll)

5. **Phase 5 — API Keys Modal** (apiKeysModal.js)
   - Ajouter validation à l'ajout (test chatCompletion)
   - Ajouter indicateurs de statut (vert/orange/gris) via keyRotation.getKeyStatuses()
   - Afficher les clés rate-limitées
   - Backward compatibility pour les anciennes clés
   - Compteur de tentatives (état local)

6. **Phase 6 — CSS** (default.css)
   - Styles pour le layout 3 zones
   - Styles pour le tableau de providers (2 colonnes)
   - Styles pour le workflow guidé
   - Styles pour la barre de recherche
   - Styles pour les indicateurs de statut

7. **Phase 7 — Tests**
   - Tests unitaires pour keyRotation et workflowRunner
   - Tests d'intégration pour le workflow complet
   - Mise à jour des tests existants
   - Mocking strategy pour fetch et DOM
