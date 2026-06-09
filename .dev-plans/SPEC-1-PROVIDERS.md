# Spec 1 : Configuration des Providers IA

> **Chaîne de specs** : [Spec 1 (Providers)](#spec-1--configuration-des-providers-ia) → [Spec 2 (Assistant)](SPEC-2-ASSISTANT.md) → [Spec 3 (Intégration)](SPEC-3-INTEGRATION.md)

---

## Contexte

L'application Minautor va intégrer un **assistant IA** pour aider les utilisateurs à concevoir leurs projets. Avant de pouvoir utiliser cet assistant, il faut configurer un **provider** (fournisseur d'API LLM). Cette spec couvre l'ajout du bouton "Providers" dans le header, le panneau de configuration, le stockage des clés, et les tests associés.

> **Note** : Cette spec est la **Spec 1 de 3**. Une fois les providers configurés, la [Spec 2 (Assistant)](SPEC-2-ASSISTANT.md) définit le rôle et les capacités de l'assistant, puis la [Spec 3 (Intégration)](SPEC-3-INTEGRATION.md) connecte le tout dans le workflow utilisateur.

---

## Vision

Un bouton **"Providers"** dans la barre du haut (à droite du bouton "Thème") ouvre un panneau latéral permettant de :

1. **Choisir** un provider parmi une liste de providers gratuits en ligne et locaux
2. **Configurer** la clé API (pour les providers en ligne) ou l'URL (pour les providers locaux)
3. **Tester** la connexion avant de sauvegarder
4. **Sélectionner** le provider par défaut utilisé par l'assistant

Le provider sélectionné est persisté dans `localStorage` et exposé via `state.js` pour être consommé par la [Spec 2 (Assistant)](SPEC-2-ASSISTANT.md).

---

## Providers supportés

### Providers en ligne (gratuits ou freemium)

| ID | Nom | Base URL | Auth | Limite gratuite | Notes |
|----|-----|----------|------|-----------------|-------|
| `openrouter` | OpenRouter | `https://openrouter.ai/api/v1` | API Key | Modèles gratuits disponibles | Agrégateur, accès à de nombreux modèles |
| `gemini` | Google Gemini | `https://generativelanguage.googleapis.com/v1beta` | API Key | 15 req/min, 1M tokens/jour | Modèles Gemini 2.5 Flash/Pro |
| `kilo` | Kilo Code | `https://api.kilocode.ai/v1` | API Key | Usage limité | Orienté code |
| `opencode-zen` | OpenCode Zen | `https://api.opencodezen.com/v1` | API Key | Usage limité | Alternative open-source |
| `mistral` | Mistral AI / Codestral | `https://codestral.mistral.ai/v1` | API Key | Usage limité | Modèles Codestral (optimisé code) + Mistral |
| `groq` | Groq | `https://api.groq.com/openai/v1` | API Key | 30 req/min, gratuit | Ultra-rapide (inference custom chip LPU) |

### Providers locaux (sans internet)

| ID | Nom | Base URL par défaut | Auth | Notes |
|----|-----|---------------------|------|-------|
| `ollama` | Ollama | `http://localhost:11434/v1` | Aucune | Compatible OpenAI API. Doit tourner en local. |
| `lmstudio` | LM Studio | `http://localhost:1234/v1` | Aucune | Interface GUI pour gérer les modèles locaux |

> Les providers locaux utilisent le format **OpenAI-compatible** (`/v1/chat/completions`). Aucune clé API requise.

---

## Architecture technique

### A. State Management (`state.js`)

Nouvelles propriétés dans `state` :

```js
state.assistant = {
  provider: {
    id: 'ollama',           // ID du provider sélectionné
    apiKey: '',             // Clé API (pour providers en ligne)
    baseUrl: '',            // URL de base (override optionnel)
    model: 'llama3.2',     // Modèle sélectionné
    temperature: 0.7,       // Température par défaut
    maxTokens: 4096,        // Tokens max par réponse
    isConnected: false,     // Dernier état de connexion
    lastTestedAt: null,     // Timestamp du dernier test
  },
  providers: {
    presets: PROVIDER_PRESETS,  // Constante (voir §B)
    custom: [],                 // Providers custom ajoutés par l'utilisateur
  }
};
```

Nouvelles actions dans `state.js` :

```js
// Sélectionner un provider
actions.setProvider({ id, apiKey?, baseUrl?, model? })

// Mettre à jour un champ du provider courant
actions.updateProvider(patch)

// Tester la connexion au provider
actions.testProviderConnection() → Promise<{ ok: boolean, latency: number, error?: string }>

// Ajouter un provider custom
actions.addCustomProvider({ id, name, baseUrl, authRequired })

// Supprimer un provider custom
actions.removeCustomProvider(id)
```

### B. Presets de providers (`providerPresets.js`)

```js
// src/code-city/ai/providerPresets.js

export const PROVIDER_PRESETS = [
  // --- En ligne ---
  {
    id: 'openrouter',
    name: 'OpenRouter',
    category: 'online',          // 'online' | 'local'
    baseUrl: 'https://openrouter.ai/api/v1',
    authRequired: true,           // Nécessite une clé API
    defaultModel: 'meta-llama/llama-3.2-3b-instruct:free',
    models: [
      { id: 'meta-llama/llama-3.2-3b-instruct:free', name: 'Llama 3.2 3B (gratuit)', contextWindow: 8192 },
      { id: 'meta-llama/llama-3.1-8b-instruct:free', name: 'Llama 3.1 8B (gratuit)', contextWindow: 128000 },
      { id: 'google/gemma-2-9b-it:free', name: 'Gemma 2 9B (gratuit)', contextWindow: 8192 },
    ],
    icon: 'cloud',
    description: 'Agrégateur de modèles — accès à de nombreux modèles gratuits et payants.',
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    category: 'online',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    authRequired: true,
    defaultModel: 'gemini-2.5-flash',
    models: [
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', contextWindow: 1000000 },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', contextWindow: 1000000 },
    ],
    icon: 'sparkles',
    description: 'Modèles Google Gemini — généreux en tokens gratuits.',
    baseUrlFormat: 'custom',  // Utilise un format d'URL différent (pas OpenAI-compat)
  },
  {
    id: 'kilo',
    name: 'Kilo Code',
    category: 'online',
    baseUrl: 'https://api.kilocode.ai/v1',
    authRequired: true,
    defaultModel: 'kilo-default',
    models: [
      { id: 'kilo-default', name: 'Kilo Default', contextWindow: 32000 },
    ],
    icon: 'code',
    description: 'Service orienté code et développement.',
  },
  {
    id: 'opencode-zen',
    name: 'OpenCode Zen',
    category: 'online',
    baseUrl: 'https://api.opencodezen.com/v1',
    authRequired: true,
    defaultModel: 'zen-default',
    models: [
      { id: 'zen-default', name: 'Zen Default', contextWindow: 32000 },
    ],
    icon: 'sparkles',
    description: 'Alternative open-source pour le développement assisté.',
  },
  {
    id: 'mistral',
    name: 'Mistral AI / Codestral',
    category: 'online',
    baseUrl: 'https://codestral.mistral.ai/v1',
    authRequired: true,
    defaultModel: 'codestral-latest',
    models: [
      { id: 'codestral-latest', name: 'Codestral (dernière version)', contextWindow: 32000 },
      { id: 'codestral-2501', name: 'Codestral 2501', contextWindow: 32000 },
      { id: 'mistral-large-latest', name: 'Mistral Large', contextWindow: 128000 },
      { id: 'mistral-small-latest', name: 'Mistral Small', contextWindow: 32000 },
      { id: 'open-mistral-7b', name: 'Mistral 7B (gratuit)', contextWindow: 32000 },
    ],
    icon: 'code',
    description: 'Mistral AI — Codestral optimisé pour le code, modèles Mistral généralistes.',
  },
  {
    id: 'groq',
    name: 'Groq',
    category: 'online',
    baseUrl: 'https://api.groq.com/openai/v1',
    authRequired: true,
    defaultModel: 'llama-3.3-70b-versatile',
    models: [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', contextWindow: 128000 },
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B (instant)', contextWindow: 128000 },
      { id: 'gemma2-9b-it', name: 'Gemma 2 9B', contextWindow: 8192 },
      { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', contextWindow: 32768 },
    ],
    icon: 'sparkles',
    description: 'Groq — inference ultra-rapide sur chip LPU, gratuit jusqu\'à 30 req/min.',
  },

  // --- Locaux ---
  {
    id: 'ollama',
    name: 'Ollama',
    category: 'local',
    baseUrl: 'http://localhost:11434/v1',
    authRequired: false,
    defaultModel: 'llama3.2',
    models: [],   // Dynamiquement chargés via /api/tags
    icon: 'server',
    description: 'LLM local — nécessite Ollama installé et lancé.',
  },
  {
    id: 'lmstudio',
    name: 'LM Studio',
    category: 'local',
    baseUrl: 'http://localhost:1234/v1',
    authRequired: false,
    defaultModel: '',
    models: [],   // Dynamiquement chargés via /v1/models
    icon: 'server',
    description: 'Interface GUI pour gérer et exécuter des modèles locaux.',
  },
];
```

### C. Module d'appel API (`aiClient.js`)

```js
// src/code-city/ai/aiClient.js

/**
 * Construit l'URL endpoint selon le format du provider.
 * - OpenAI-compatible (la plupart) : baseUrl + '/chat/completions'
 * - Gemini (REST natif) : format Gemini avec model:generateContent
 * @param {Object} provider - Provider courant
 * @returns {string} URL complète de l'endpoint
 */
export function buildEndpointUrl(provider) {
  if (provider.id === 'gemini') {
    // Gemini utilise son propre format REST (pas OpenAI-compat)
    // Voir : https://ai.google.dev/gemini-api/docs/text-generation
    return `${provider.baseUrl}/models/${provider.model}:generateContent?key=${provider.apiKey}`;
  }
  // Tous les autres providers : format OpenAI-compatible
  return `${provider.baseUrl}/chat/completions`;
}

/**
 * Formate les messages pour le format Gemini (si provider.id === 'gemini').
 * @param {Array} messages - Messages au format OpenAI
 * @returns {Object} Body au format Gemini REST
 */
export function formatGeminiRequest(messages, model, temperature, maxTokens) {
  // Extraire le system prompt et les messages utilisateur/assistant
  const systemMsg = messages.find(m => m.role === 'system');
  const chatMessages = messages.filter(m => m.role !== 'system');

  return {
    contents: chatMessages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
    systemInstruction: systemMsg ? { parts: [{ text: systemMsg.content }] } : undefined,
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
    },
  };
}

/**
 * Parse la réponse Gemini en format unifié.
 * @param {Object} data - Réponse brute de Gemini
 * @returns {Object} { content, usage }
 */
export function parseGeminiResponse(data) {
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const usage = data.usageMetadata || {};
  return {
    content: text,
    usage: {
      promptTokens: usage.promptTokenCount || 0,
      completionTokens: usage.candidatesTokenCount || 0,
    },
  };
}

/**
 * Appel un provider LLM.
 *
 * @param {Object} provider - Provider courant depuis state.assistant.provider
 * @param {Array} messages  - Historique [{ role: 'system'|'user'|'assistant', content }]
 * @returns {Promise<{ content: string, usage: { promptTokens, completionTokens } }>}
 */
export async function chatCompletion(provider, messages) {
  const { baseUrl, apiKey, model, temperature, maxTokens } = provider;

  // Construire l'URL selon le format du provider
  const url = buildEndpointUrl(provider);

  // Adapter le format selon le provider
  let headers = { 'Content-Type': 'application/json' };
  let body;
  let parseResponse;

  if (provider.id === 'gemini') {
    // Gemini : format REST natif (pas OpenAI-compat)
    body = formatGeminiRequest(messages, model, temperature, maxTokens);
    // La clé API est dans l'URL (pas dans le header)
    parseResponse = parseGeminiResponse;
  } else {
    // OpenAI-compatible (OpenRouter, Ollama, LM Studio, Kilo, OpenCode Zen, Mistral, Groq)
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
    body = { model, messages, temperature, max_tokens: maxTokens, stream: false };
    parseResponse = (data) => ({
      content: data.choices[0].message.content,
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
      },
    });
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `Erreur HTTP ${response.status}`);
  }

  const data = await response.json();
  return parseResponse(data);
}

/**
 * FIM (Fill-in-the-Middle) pour Codestral — complétion de code inline.
 *
 * Envoie le code AVANT le curseur (prefix) et le code APRÈS (suffix),
 * le modèle génère le code intermédiaire.
 *
 * Endpoint : POST {baseUrl}/fim/completions (Codestral uniquement)
 *
 * @param {Object} provider - Provider courant (doit être Mistral/Codestral)
 * @param {string} prefix   - Code avant le curseur
 * @param {string} suffix   - Code après le curseur
 * @returns {Promise<{ content: string, usage: { promptTokens, completionTokens } }>}
 */
export async function fimCompletion(provider, prefix, suffix) {
  if (provider.id !== 'mistral') {
    throw new Error('FIM n\'est supporté que par Mistral/Codestral');
  }

  const url = `${provider.baseUrl}/fim/completions`;
  const headers = {
    'Content-Type': 'application/json',
  };
  if (provider.apiKey) {
    headers['Authorization'] = `Bearer ${provider.apiKey}`;
  }

  const body = {
    model: provider.model,
    prompt: prefix,           // Code AVANT le curseur
    suffix: suffix,           // Code APRÈS le curseur
    temperature: provider.temperature ?? 0.2,  // Plus bas = plus déterministe pour le code
    max_tokens: provider.maxTokens ?? 4096,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `Erreur HTTP ${response.status}`);
  }

  const data = await response.json();
  return {
    content: data.choices[0].message?.content || data.choices[0].text || '',
    usage: {
      promptTokens: data.usage?.prompt_tokens || 0,
      completionTokens: data.usage?.completion_tokens || 0,
    },
  };
}

/**
 * Teste la connexion à un provider.
 * Pour les providers locaux : vérifie que le serveur répond.
 * Pour les providers en ligne : fait un appel minimal (GET models ou ping).
 */
export async function testConnection(provider) {
  const start = Date.now();
  try {
    if (provider.category === 'local') {
      // Pour Ollama : GET /api/tags
      // Pour LM Studio : GET /v1/models
      const url = provider.id === 'ollama'
        ? `${provider.baseUrl.replace('/v1', '')}/api/tags`
        : `${provider.baseUrl}/models`;
      const response = await fetch(url, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      return { ok: true, latency: Date.now() - start, models: data };
    } else {
      // Pour les providers en ligne : test avec un prompt minimal
      const result = await chatCompletion(provider, [
        { role: 'user', content: 'Say "ok"' },
      ]);
      return { ok: true, latency: Date.now() - start };
    }
  } catch (error) {
    return { ok: false, latency: Date.now() - start, error: error.message };
  }
}

/**
 * Charge les modèles disponibles d'un provider local (Ollama/LM Studio).
 */
export async function fetchLocalModels(provider) {
  try {
    if (provider.id === 'ollama') {
      const resp = await fetch(`${provider.baseUrl.replace('/v1', '')}/api/tags`);
      const data = await resp.json();
      return (data.models || []).map(m => ({
        id: m.name,
        name: m.name,
        contextWindow: m.detail?.parameter_size ? undefined : 4096,
      }));
    } else {
      const resp = await fetch(`${provider.baseUrl}/models`);
      const data = await resp.json();
      return (data.data || []).map(m => ({
        id: m.id,
        name: m.id,
        contextWindow: m.context_window || undefined,
      }));
    }
  } catch {
    return [];
  }
}
```

### D. Panneau de configuration UI (`providerPanel.js`)

Le panneau suit le même pattern que `exportPanel.js` — slide-in depuis la droite, avec backdrop.

```
src/code-city/ai/
├── providerPresets.js       — Constantes PROVIDER_PRESETS
├── aiClient.js              — Client d'appel API (chatCompletion, fimCompletion, testConnection)
└── providerPanel.js         — Panneau de configuration UI
```

#### Structure du panneau

```
┌─────────────────────────────────────┐
│ Providers IA                    [✕] │
├─────────────────────────────────────┤
│                                     │
│  ● En ligne (gratuit/freemium)      │
│  ┌────────────────────────────────┐ │
│  │ 🌐 OpenRouter            [>]  │ │
│  │ 🌟 Google Gemini         [>]  │ │
│  │ 💻 Kilo Code             [>]  │ │
│  │ ✨ OpenCode Zen          [>]  │ │
│  │ 💻 Mistral AI / Codestral [>]  │ │
│  │ ⚡ Groq                  [>]  │ │
│  └────────────────────────────────┘ │
│                                     │
│  ● Local (pas d'internet)           │
│  ┌────────────────────────────────┐ │
│  │ 🖥 Ollama                [>]  │ │
│  │ 🖥 LM Studio             [>]  │ │
│  └────────────────────────────────┘ │
│                                     │
│  ── Configuration ──────────────── │
│                                     │
│  Provider : Ollama ●                │
│  Modèle   : [llama3.2        ▾]    │
│  URL      : [http://localhost:11434]│
│  API Key  : [••••••••••••••••]     │
│  Temp     : [0.7]                   │
│  Max tok  : [4096]                  │
│                                     │
│  [🔄 Tester la connexion]           │
│  ✅ Connecté — 45ms — 3 modèles    │
│                                     │
│  [💾 Sauvegarder]                   │
│                                     │
└─────────────────────────────────────┘
```

#### Comportement

| Action | Comportement |
|--------|-------------|
| Clic sur un provider preset | Sélectionne le provider, affiche la config |
| Changement de modèle | Met à jour `state.assistant.provider.model` |
| Changement de clé API | Masquée par `password`, stockée en clair dans localStorage |
| "Tester la connexion" | Appelle `testConnection()`, affiche le résultat (✅/❌) |
| "Sauvegarder" | Persiste dans localStorage, ferme le panneau |
| Sélection d'un provider local | Cache le champ API Key, affiche le bouton "Tester", appelle `fetchLocalModels()` pour remplir le dropdown de modèles |

---

## Fichiers à créer/modifier

| # | Action | Fichier | Description |
|---|--------|---------|-------------|
| 1 | **Créer** | `src/code-city/ai/providerPresets.js` | Presets de providers (constantes) |
| 2 | **Créer** | `src/code-city/ai/aiClient.js` | Client d'appel API LLM |
| 3 | **Créer** | `src/code-city/ai/providerPanel.js` | Panneau de configuration UI |
| 4 | **Modifier** | `src/code-city/quartierTop/menuActionsTop/menuActionsTop.js` | Ajouter le bouton "Providers" après "Thème" |
| 5 | **Modifier** | `src/code-city/state.js` | Ajouter `state.assistant` + actions providers |
| 6 | **Modifier** | `src/code-city/persistence.js` | Persister `state.assistant` dans localStorage |
| 7 | **Modifier** | `src/code-city/code-city.js` | Initialiser `providerPanel` au démarrage |
| 8 | **Modifier** | `src/styles/default.css` | Styles du panneau providers (reprendre le pattern exportPanel) |

---

## Plan de tests

### Tests E2E : `e2e/providers.spec.js`

| # | Test | Vérification |
|---|------|-------------|
| 1 | Le bouton "Providers" est visible dans le header | `page.locator('#providers-btn').isVisible()` |
| 2 | Le clic ouvre le panneau providers | Le panneau a la classe `is-open` |
| 3 | Les 8 providers preset sont affichés | 6 en ligne + 2 locaux |
| 4 | Sélectionner Ollama affiche la config locale | Champ API Key caché, URL pré-remplie |
| 5 | Sélectionner OpenRouter affiche le champ API Key | Champ visible et éditable |
| 6 | Tester la connexion Ollama (si lancé) | Affiche ✅ ou ❌ |
| 7 | Changer le modèle met à jour le state | `state.assistant.provider.model` modifié |
| 8 | La clé API est masquée dans l'UI | Input type="password" |
| 9 | Sauvegarder persiste dans localStorage | Recharger la page → même provider sélectionné |
| 10 | Fermer le panneau via X ou Escape | Le panneau se ferme |

### Tests unitaires : `src/code-city/ai/providerPresets.test.js`

| # | Test | Vérification |
|---|------|-------------|
| 1 | `PROVIDER_PRESETS` contient 8 providers | `expect(PROVIDER_PRESETS.length).toBe(8)` |
| 2 | Chaque provider a les champs requis | `id`, `name`, `category`, `baseUrl`, `authRequired`, `defaultModel` |
|  3 | Providers en ligne ont `authRequired: true` | Filtrer par `category === 'online'` |
| 4 | Providers locaux ont `authRequired: false` | Filtrer par `category === 'local'` |
| 5 | Gemini n'est PAS OpenAI-compat | `baseUrlFormat: 'custom'` défini |
| 6 | Les IDs sont uniques | `new Set(PROVIDER_PRESETS.map(p => p.id)).size === 8` |

### Tests unitaires : `src/code-city/ai/aiClient.test.js`

| # | Test | Vérification |
|---|------|-------------|
| 1 | `buildEndpointUrl` génère la bonne URL pour OpenRouter | `.../chat/completions` |
| 2 | `buildEndpointUrl` génère la bonne URL pour Gemini | Format REST natif Gemini |
| 3 | `testConnection` retourne `{ ok: true }` si le serveur répond | Mock fetch |
| 4 | `testConnection` retourne `{ ok: false, error }` si timeout | Mock fetch avec delay |
|  5 | `chatCompletion` lève une erreur si HTTP ≥ 400 | Mock fetch avec 400 |
| 6 | `buildEndpointUrl` pour Gemini retourne l'URL REST native | Format `models/{model}:generateContent` |
| 7 | `formatGeminiRequest` convertit les messages OpenAI → Gemini | `contents[].parts[].text` |
| 8 | `fimCompletion` envoie prefix+suffix au format Codestral FIM | Endpoint `/fim/completions` |
| 9 | `fimCompletion` rejette les providers non-Mistral | Message d'erreur explicite |

---

## Persistance

```
localStorage key : 'code-city-assistant'
Valeur           : JSON.stringify(state.assistant)
Format           :
{
  provider: {
    id: 'ollama',
    apiKey: '',
    baseUrl: 'http://localhost:11434/v1',
    model: 'llama3.2',
    temperature: 0.7,
    maxTokens: 4096,
  }
}
```

> La clé API est stockée en clair dans localStorage. C'est acceptable car l'application tourne 100% côté client (pas de backend).
>
> **Note** : La [Spec 2 (Assistant)](SPEC-2-ASSISTANT.md) étend ce format avec `chatHistory` (historique des messages du chat). Le format complet est documenté dans la Spec 2.

---

## Risques

| Risque | Impact | Mitigation |
|--------|--------|------------|
| Clé API exposée dans localStorage | Faible (client-only) | Avertissement dans l'UI, pas de transmission serveur |
| Provider local non lancé | UX | Test de connexion avant utilisation, message clair |
| Rate limiting (providers gratuits) | UX | Messages d'erreur explicites, suggestion de provider alternatif |
| Modèle non disponible sur le provider | UX | Appeler `fetchLocalModels()` au changement de provider pour rafraîchir les modèles disponibles |
| Changement d'API des providers tiers | Maintenance | Abstraction via `buildEndpointUrl()`, un seul endroit à modifier |

---

## Estimations

| Phase | Tâche | Estimation |
|-------|-------|------------|
| 0.1 | `providerPresets.js` — constantes | 1h |
| 0.2 | `state.js` — ajouter `state.assistant` + actions | 2h |
| 0.3 | `aiClient.js` — client d'appel API | 3h |
| 0.4 | `providerPanel.js` — panneau UI | 4h |
| 0.5 | Intégration header + persistence | 2h |
| 0.6 | Tests E2E + unitaires | 3h |
| **Total** | | **~15h** |

---

## Liaison avec les autres specs

- **→ [Spec 2 (Assistant)](SPEC-2-ASSISTANT.md)** : Une fois le provider configuré, la Spec 2 définit **comment** l'assistant l'utilise (system prompt, capacités, personnalité)
- **→ [Spec 3 (Intégration)](SPEC-3-INTEGRATION.md)** : La Spec 3 connecte le provider + assistant dans le workflow utilisateur (panneau chat, raccourcis, contexte)
