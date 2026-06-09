# Provider System Refactor — Spec v2

> **Date :** 7 juin 2026
> **Statut :** ✅ Validé (v2 — 12 corrections de review intégrées)
> **Objectif :** Refactoriser complètement le système de providers IA pour le rendre maintenable, configurable via JSON, et séparer clés API / configs / grille.
> **Impact estimé :** ~15 fichiers créés/modifiés/supprimés, ~227 tests à adapter

---

## 1. Résumé des problèmes actuels

Le système actuel mélange tout dans le code JavaScript :
- `providerPresets.js` : config des providers en dur dans le code
- `state.js` : cache `providerConfigs` dans localStorage + migration complexe + fonctions `registerPresets()`, `findPreset()`, `getPresetCategory()`, `getApiKeyForProvider()`
- `apiKeysModal.js` : gestion des clés API dans le state (localStorage)
- `workflowRunner.js` : workflow en 7 étapes avec beaucoup de logique métier
- `providerPanel.js` : 3 zones avec beaucoup de code de rendu
- `aiClient.js` : routing CORS/ proxy mélangé avec la logique API

**Problème principal :** Aucune source unique de vérité. Les configs sont dans le code JS, les clés dans localStorage, et le `.private/providers.json` existe mais n'est pas utilisé par l'app.

---

## 2. Architecture cible

### 2.1 Fichiers de configuration

```
src/code-city/data/
├── provider-configs.json     # Source unique de vérité pour les configs provider
└── providers-grid.json       # Layout de la grille (Zone 2)

.env.example                  # Template des variables d'environnement
.env                          # Variables réelles (dans .gitignore)
```

> **Note :** Les JSON sont dans `src/code-city/data/` pour pouvoir être importés directement via Vite (`import providerConfigs from '../data/provider-configs.json'`).

### 2.2 Clés API

Les clés API vivent dans le `.env` à la racine du projet. Le format utilise des noms génériques (pas de préfixe `VITE_`) :

```env
OPENROUTER_API_KEY=sk-or-xxx
GEMINI_API_KEY=AIzaSyxxx
GROQ_API_KEY=gsk_xxx
MISTRAL_API_KEY=
OPENCODE_ZEN_API_KEY=
```

> **Note :** Le préfixe `VITE_` est une contrainte Vite inutile côté serveur. On utilise des noms génériques et on mappe côté frontend si nécessaire.

### 2.3 Endpoint /api/env

Un petit serveur Node (dans `scripts/env-server.mjs`) expose les variables d'environnement du `.env` via un endpoint HTTP, sur le **même port que Vite** (via proxy).

```
GET /api/env → { "OPENROUTER_API_KEY": "sk-xxx", ... }
```

Le frontend lit les clés via `fetch('/api/env')` au démarrage.

---

## 3. Détail des fichiers JSON

### 3.1 `src/code-city/data/provider-configs.json`

Source unique de vérité pour **toutes** les configs provider. Tout y est : id, nom, URL, modèle par défaut, catégorie, icône, description, etc.

> **Simplification :** Le champ `testModel` est supprimé. On utilise `defaultModel` pour le test de clé ET comme sélection initiale. Pour les providers sans modèle par défaut (mistral, groq, opencode-zen), on utilise un modèle fixe défini dans le JSON comme `defaultModel`.

```json
{
  "providers": [
    {
      "id": "openrouter",
      "name": "OpenRouter",
      "category": "online",
      "baseUrl": "https://openrouter.ai/api/v1",
      "authRequired": true,
      "defaultModel": "google/gemma-4-26b-a4b-it:free",
      "modelListingUrl": "{baseUrl}/models",
      "envKey": "OPENROUTER_API_KEY",
      "icon": "cloud",
      "description": "Agrégateur de modèles.",
      "enabled": true,
      "maxParallel": 1
    },
    {
      "id": "gemini",
      "name": "Google Gemini",
      "category": "online",
      "baseUrl": "https://generativelanguage.googleapis.com/v1beta",
      "authRequired": true,
      "defaultModel": "gemini-2.0-flash",
      "modelListingUrl": "{baseUrl}/models?key={apiKey}",
      "envKey": "GEMINI_API_KEY",
      "icon": "sparkles",
      "description": "Google Gemini.",
      "baseUrlFormat": "custom",
      "enabled": true,
      "maxParallel": 1
    },
    {
      "id": "kilo",
      "name": "Kilo Code",
      "category": "online",
      "baseUrl": "https://api.kilo.ai/api/gateway",
      "authRequired": false,
      "defaultModel": "kilo-auto/free",
      "modelListingUrl": "{baseUrl}/models",
      "envKey": null,
      "icon": "code",
      "description": "Kilo Code Gateway — API OpenAI-compatible.",
      "enabled": true,
      "maxParallel": 1
    },
    {
      "id": "opencode-zen",
      "name": "OpenCode Zen",
      "category": "online",
      "baseUrl": "https://opencode.ai/zen/v1",
      "authRequired": true,
      "defaultModel": "meta-llama/llama-3.1-8b-instruct",
      "modelListingUrl": "{baseUrl}/models",
      "envKey": "OPENCODE_ZEN_API_KEY",
      "icon": "sparkles",
      "description": "OpenCode Zen.",
      "enabled": true,
      "maxParallel": 1
    },
    {
      "id": "mistral",
      "name": "mistral",
      "category": "online",
      "baseUrl": "https://api.mistral.ai/v1",
      "authRequired": true,
      "defaultModel": "mistral-small-latest",
      "modelListingUrl": "{baseUrl}/models",
      "envKey": "MISTRAL_API_KEY",
      "icon": "sparkles",
      "description": "Mistral AI — inclut les modèles Codestral pour le code + FIM.",
      "enabled": true,
      "maxParallel": 1
    },
    {
      "id": "groq",
      "name": "groq",
      "category": "online",
      "baseUrl": "https://api.groq.com/openai/v1",
      "authRequired": true,
      "defaultModel": "llama-3.1-8b-instant",
      "modelListingUrl": "{baseUrl}/models",
      "envKey": "GROQ_API_KEY",
      "icon": "sparkles",
      "description": "Groq — inference ultra-rapide.",
      "enabled": true,
      "maxParallel": 1
    },
    {
      "id": "ollama",
      "name": "ollama",
      "category": "local",
      "baseUrl": "http://localhost:11434/v1",
      "authRequired": false,
      "defaultModel": "",
      "modelListingUrl": "{baseUrl}/../api/tags",
      "envKey": null,
      "icon": "server",
      "description": "Ollama — LLM local.",
      "enabled": true,
      "maxParallel": 1
    },
    {
      "id": "lmstudio",
      "name": "LM Studio",
      "category": "local",
      "baseUrl": "http://localhost:1234/v1",
      "authRequired": false,
      "defaultModel": "",
      "modelListingUrl": "{baseUrl}/models",
      "envKey": null,
      "icon": "server",
      "description": "LM Studio — GUI pour modèles locaux.",
      "enabled": true,
      "maxParallel": 4
    }
  ]
}
```

#### Champs obligatoires par provider :

| Champ | Type | Description |
|-------|------|-------------|
| `id` | string | ID unique (ex: `openrouter`, `groq`) |
| `name` | string | Nom d'affichage |
| `category` | string | `online` ou `local` |
| `baseUrl` | string | URL de base de l'API |
| `authRequired` | boolean | Si `true`, nécessite une clé API |
| `defaultModel` | string | Modèle par défaut (utilisé pour le test ET la sélection initiale) |
| `envKey` | string\|null | Nom de la variable d'env (ex: `OPENROUTER_API_KEY`) ou `null` si pas de clé |
| `icon` | string | Nom de l'icône |
| `description` | string | Description courte |
| `enabled` | boolean | Si `false`, le provider n'apparaît pas dans la grille |
| `maxParallel` | number | Nombre max d'appels parallèles |

#### Champs optionnels :

| Champ | Type | Description |
|-------|------|-------------|
| `modelListingUrl` | string | URL pour lister les modèles (templated) |
| `baseUrlFormat` | string | Format spécial (`custom` pour Gemini) |

### 3.2 `src/code-city/data/providers-grid.json`

Layout de la grille de la Zone 2. Le `column` est **calculé automatiquement** depuis le nom du provider (1 mot = colonne 1, multi-mots = colonne 2). Le JSON ne définit que l'**ordre** et la **visibilité**.

```json
{
  "sections": [
    {
      "title": "En ligne",
      "providers": [
        { "id": "openrouter", "order": 1, "visible": true },
        { "id": "gemini", "order": 2, "visible": true },
        { "id": "kilo", "order": 3, "visible": true },
        { "id": "opencode-zen", "order": 4, "visible": true },
        { "id": "mistral", "order": 5, "visible": true },
        { "id": "groq", "order": 6, "visible": true }
      ]
    },
    {
      "title": "Local",
      "providers": [
        { "id": "ollama", "order": 1, "visible": true },
        { "id": "lmstudio", "order": 2, "visible": true }
      ]
    }
  ]
}
```

#### Champs par provider dans la grille :

| Champ | Type | Description |
|-------|------|-------------|
| `id` | string | ID du provider (référence vers `provider-configs.json`) |
| `order` | number | Ordre d'affichage (tri croissant) |
| `visible` | boolean | Si `false`, le provider n'apparaît pas dans la grille |

> **La colonne est calculée** dans le render : `provider.name.trim().split(/\s+/).length === 1 ? 1 : 2`. Pas besoin de la stocker dans le JSON.

---

## 4. Endpoint /api/env — Serveur Node

### 4.1 Fichier `scripts/env-server.mjs`

Un petit serveur Node (sans dépendance externe, juste `node:http` + `node:fs`) qui :
1. Lit le fichier `.env` à la racine (avec **fallback** si le fichier n'existe pas)
2. Expose `GET /api/env` qui retourne toutes les variables en JSON
3. Tourne sur un port configurable (défaut: 3001)

```javascript
// scripts/env-server.mjs
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const PORT = process.env.ENV_SERVER_PORT || 3001;
const ENV_PATH = path.resolve(process.cwd(), '.env');

function loadEnv() {
  // Fallback : si le .env n'existe pas, retourner un objet vide
  if (!fs.existsSync(ENV_PATH)) {
    console.warn('⚠️  Fichier .env introuvable — aucune clé API disponible');
    return {};
  }
  const content = fs.readFileSync(ENV_PATH, 'utf-8');
  const env = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    env[key] = value;
  }
  return env;
}

const server = http.createServer((req, res) => {
  if (req.url === '/api/env' && req.method === 'GET') {
    const env = loadEnv();
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify(env));
    return;
  }
  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`🔑 Env server running on http://localhost:${PORT}/api/env`);
});
```

### 4.2 Démarrage — cross-platform

Ajouter dans `package.json` :

```json
{
  "scripts": {
    "env": "node scripts/env-server.mjs",
    "dev": "npx concurrently \"node scripts/env-server.mjs\" \"vite --port 8081\""
  }
}
```

> **Windows :** `concurrently` fonctionne sur toutes les plateformes. Pas de `&` bash.

### 4.3 Proxy Vite pour `/api/env`

Le serveur env tourne sur port 3001. Le frontend sur port 8081. On ajoute un proxy dans `vite.config.js` :

```javascript
// vite.config.js — ajouter dans server.proxy
proxy: {
  // Proxy env server (port 3001 → 8081)
  '/api/env': {
    target: 'http://localhost:3001',
    changeOrigin: true,
  },
  // ... les autres proxies existants (kilo, ollama, lmstudio)
}
```

### 4.4 Fichier `.env.example`

Créer un `.env.example` à la racine comme template :

```env
# Clés API pour les providers IA
# Copie ce fichier en .env et remplis les clés que tu utilises
OPENROUTER_API_KEY=
GEMINI_API_KEY=
GROQ_API_KEY=
MISTRAL_API_KEY=
OPENCODE_ZEN_API_KEY=
```

> **Le `.env` est dans `.gitignore`** — le `.env.example` est versionné.

### 4.5 Utilisation côté frontend

```javascript
// src/code-city/ai/envLoader.js
let cachedEnv = null;

export async function loadEnvKeys() {
  if (cachedEnv) return cachedEnv;
  try {
    const resp = await fetch('/api/env');
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    cachedEnv = await resp.json();
    return cachedEnv;
  } catch (err) {
    console.warn('Impossible de charger /api/env:', err.message);
    cachedEnv = {};
    return cachedEnv;
  }
}

export function getApiKeyForEnvKey(envKey) {
  if (!envKey || !cachedEnv) return '';
  return cachedEnv[envKey] || '';
}

export function hasApiKey(provider) {
  if (!provider.envKey) return false;
  return !!cachedEnv?.[provider.envKey];
}
```

---

## 5. Architecture des 3 Zones

### 5.1 Zone 1 — Status du provider actif (sticky)

Affiche les informations du provider sélectionné depuis `provider-configs.json`.

```
┌─────────────────────────────┐
│  OpenRouter          🟢    │  ← Nom + indicateur
│  Modèle: google/gemma-4…   │  ← Modèle sélectionné
│  Latence: 1234ms           │  ← Latence du dernier test
│  Format: openai            │  ← Format détecté
│  🔑 1 clé configurée       │  ← Badge clé API
└─────────────────────────────┘
```

**Source :** `provider-configs.json` pour le nom/description + `state.assistant.provider` pour le modèle/latence/statut.

### 5.2 Zone 2 — Grille des providers

Affiche les providers disponibles depuis `providers-grid.json`. La colonne (1 ou 2) est **calculée automatiquement** depuis le nom du provider.

```
┌──────────┬──────────┐
│ En ligne │          │
│ kilo     │ OpenRouter│
│ mistral  │ Gemini   │
│ groq     │ Zen      │
│──────────┼──────────│
│ Local    │          │
│ ollama   │ LM Studio│
└──────────┴──────────┘
```

**Source :** `providers-grid.json` pour l'ordre/visibilité + `provider-configs.json` pour le nom/icône. La colonne est calculée : `name.split(/\s+/).length === 1 ? 1 : 2`.

### 5.3 Zone 3 — Workflow de test automatisé

Flow continu avec **progression visuelle** (barre de badges numérotés).

#### Étapes du workflow :

```
1/6  Sélection du provider
     ↓ (auto)
2/6  Vérification URL + clé API
     ↓ (si pas de clé → demande à l'utilisateur)
3/6  Test de la clé API
     ↓ (si OK)
4/6  Chargement des modèles
     ↓ (affiche la liste)
5/6  Sélection du modèle par l'utilisateur
     ↓ (clic sur un modèle)
6/6  Test du modèle + validation
     ↓ (si OK)
✅  Provider configuré !
```

#### Barre de progression visuelle :

```
[●]───[●]───[●]───[○]───[○]───[○]
 1     2     3     4     5     6
```

- `[●]` = étape complétée
- `[◉]` = étape en cours (spinner)
- `[○]` = étape non atteinte

#### Logique du workflow :

1. **Sélection provider** (auto) : L'utilisateur clique sur un provider dans la Zone 2. Le workflow démarre automatiquement.

2. **Vérification URL + clé** (auto) :
   - Si `authRequired: false` → skip à l'étape 4
   - Si `authRequired: true` → cherche une clé dans `/api/env` via `envKey`
   - Si clé trouvée → passe à l'étape 3
   - Si pas de clé → passe à l'étape 2b (demande à l'utilisateur)

3. **Test de la clé** (auto) :
   - Appelle `chatCompletion()` avec le `defaultModel` du JSON
   - Si OK → passe à l'étape 4
   - Si échec → affiche l'erreur, reste à l'étape 2

4. **Chargement des modèles** (auto) :
   - Appelle `fetchModels()` avec le `baseUrl` du JSON
   - Affiche la liste des modèles triés (gratuits en premier)
   - Si échec → affiche l'erreur, permet un retry

5. **Sélection du modèle** (manuel) :
   - L'utilisateur clique sur un modèle dans la liste
   - Barre de recherche pour filtrer
   - "Voir plus" si > 15 modèles

6. **Test du modèle** (auto) :
   - Appelle `chatCompletion()` avec le modèle sélectionné
   - Si OK → marque `isConnected: true` dans le state
   - Si échec → revient à l'étape 5

---

## 6. État de l'application (state.js)

### 6.1 Structure du state

```javascript
const initialState = () => ({
  // ... (graphe, sélection, mode, vue — inchangés)

  assistant: {
    // Provider actif (état en cours, pas la config)
    provider: {
      id: 'ollama',
      model: '',           // Modèle sélectionné par l'utilisateur
      temperature: 0.7,
      maxTokens: 4096,
      isConnected: false,
      lastTestedAt: null,
      modelMeta: null,     // { format, capabilities, contextWindow, latency }
    },
    // Cache des configs par provider (modèle, temp, etc.)
    // Les clés API ne sont JAMAIS dans le state
    providerConfigs: {},
    // Historique de chat
    chatHistory: [],
  },
});
```

### 6.2 `providerConfigs` — ce qui reste

Après suppression de `apiKey`, le cache `providerConfigs` contient uniquement les **préférences utilisateur** par provider :

```javascript
providerConfigs: {
  'openrouter': {
    model: 'google/gemma-4-26b-a4b-it:free',  // modèle choisi par l'utilisateur
    temperature: 0.7,
    maxTokens: 4096,
    isConnected: true,                          // statut de connexion
    lastTestedAt: 1717756800000,                // timestamp du dernier test
  },
  'groq': { ... }
}
```

### 6.3 Changements par rapport à l'actuel

| Champ supprimé | Raison |
|---------------|--------|
| `provider.apiKey` | Les clés viennent de `.env` via `/api/env` |
| `providerConfigs[].apiKey` | Idem |
| `state.assistant.apiKeys[]` | Tout le tableau est supprimé |

| Champ ajouté | Description |
|-------------|-------------|
| `providerConfigs[].lastTestedAt` | Timestamp du dernier test réussi |

### 6.4 Migration des fonctions de `state.js`

Le `state.js` actuel contient des fonctions qui doivent être **migrées** vers `providerLoader.js` :

| Fonction actuelle | Action | Destination |
|-------------------|--------|-------------|
| `registerPresets(presetList)` | **Supprimée** | Remplacée par le chargement JSON dans `providerLoader.js` |
| `validateStoredProvider()` | **Migrée** | `providerLoader.validateStoredProvider()` |
| `findPreset(id)` | **Migrée** | `providerLoader.getPreset(id)` |
| `getPresetCategory(id)` | **Migrée** | `providerLoader.getCategory(id)` |
| `getApiKeyForProvider(providerId)` | **Remplacée** | `envLoader.getApiKeyForEnvKey(preset.envKey)` |
| `autoTestConnection()` | **Gardée** | Adaptée pour utiliser `envLoader` au lieu de `apiKeys[]` |

> **Les clés API (`apiKeys[]`) sont supprimées du state.** La modal `apiKeysModal.js` n'est plus nécessaire.

---

## 7. Fichiers à créer/modifier

### 7.1 Nouveaux fichiers

| Fichier | Description |
|---------|-------------|
| `src/code-city/data/provider-configs.json` | Configs de tous les providers (source unique de vérité) |
| `src/code-city/data/providers-grid.json` | Layout de la grille |
| `scripts/env-server.mjs` | Serveur pour exposer les clés API depuis `.env` |
| `.env.example` | Template des variables d'environnement |
| `src/code-city/ai/envLoader.js` | Loader pour les clés API depuis `/api/env` |
| `src/code-city/ai/providerLoader.js` | Charge les JSON, expose `getPreset()`, `getCategory()`, `validateStoredProvider()` |

### 7.2 Fichiers à modifier

| Fichier | Changement |
|---------|-----------|
| `vite.config.js` | Ajouter proxy `/api/env` → port 3001 |
| `package.json` | Ajouter scripts `env`, `dev` avec `concurrently` |
| `src/code-city/code-city.js` | Remplacer `registerPresets(PROVIDER_PRESETS)` par `loadProviderConfigs()` + `loadEnvKeys()` |
| `src/code-city/state.js` | Supprimer `apiKeys[]`, `registerPresets()`, `findPreset()`, `getPresetCategory()`, `getApiKeyForProvider()` |
| `src/code-city/ai/providerPanel.js` | Refactoriser les 3 zones |
| `src/code-city/ai/workflowRunner.js` | Simplifier le workflow (6 étapes), lire clés via `envLoader` |
| `src/code-city/ai/aiClient.js` | Lire les clés via `envLoader` au lieu de `apiKeys[]` |
| `src/code-city/ai/chatPanel.js` | Remplacer `PROVIDER_PRESETS` par `providerLoader.getPreset()` |
| `src/code-city/state.test.js` | Réécrire les tests sans `PROVIDER_PRESETS` ni `apiKeys[]` |
| `src/code-city/ai/providerPanel.test.js` | Adapter les tests au nouveau format |

### 7.3 Fichiers à supprimer

| Fichier | Raison |
|---------|--------|
| `src/code-city/ai/providerPresets.js` | Remplacé par `data/provider-configs.json` |
| `src/code-city/ai/providerPresets.test.js` | Tests des presets (remplacés par `providerLoader.test.js`) |
| `src/code-city/ai/apiKeysModal.js` | Remplacé par le `.env` |
| `src/code-city/ai/apiKeysModal.test.js` | Tests de la modal |

---

## 8. Migration — étapes détaillées

### 8.1 Approche : Remplacement direct

On supprime l'ancien code d'un coup et on remplace par le nouveau. Pas de migration progressive.

### 8.2 Ordre d'implémentation

| Étape | Action | Fichiers |
|-------|--------|----------|
| 1 | Créer les JSON de config | `src/code-city/data/provider-configs.json`, `providers-grid.json` |
| 2 | Créer `.env.example` | `.env.example` à la racine |
| 3 | Créer le serveur env | `scripts/env-server.mjs` |
| 4 | Créer `envLoader.js` | `src/code-city/ai/envLoader.js` |
| 5 | Créer `providerLoader.js` | `src/code-city/ai/providerLoader.js` |
| 6 | Modifier `vite.config.js` | Ajouter proxy `/api/env` |
| 7 | Modifier `package.json` | Ajouter scripts `env`, `dev` |
| 8 | Modifier `code-city.js` | Remplacer imports + init |
| 9 | Modifier `state.js` | Supprimer apiKeys, fonctions migrées |
| 10 | Refactoriser `providerPanel.js` | 3 zones avec nouveau format |
| 11 | Refactoriser `workflowRunner.js` | 6 étapes, envLoader |
| 12 | Modifier `aiClient.js` | envLoader pour les clés |
| 13 | Modifier `chatPanel.js` | providerLoader au lieu de PROVIDER_PRESETS |
| 14 | Supprimer les anciens fichiers | providerPresets.js, apiKeysModal.js |
| 15 | Réécrire les tests | ~227 tests à adapter |
| 16 | Tester le flow complet | Navigateur : sélection → clé → modèles → test → validé |

---

## 9. Contraintes techniques

### 9.1 Compatibilité

- **Vite** : Les JSON dans `src/code-city/data/` sont importés directement (`import data from '...json'`)
- **Node** : Le serveur d'env utilise uniquement les modules natifs de Node (`node:http`, `node:fs`)
- **Windows** : `concurrently` pour démarrer env server + Vite en parallèle
- **Browser** : Le frontend lit les clés via `fetch('/api/env')` au démarrage
- **Tests** : Les tests unitaires mock le `providerLoader` et `envLoader`

### 9.2 Sécurité

- Le `.env` est dans `.gitignore` (pas de commit accidentel)
- Le `.env.example` est versionné (template sans valeurs)
- L'endpoint `/api/env` retourne toutes les variables (accessible uniquement en dev via le proxy Vite)
- En production, on utilise les variables d'environnement du serveur (pas le `.env`)
- Le state ne contient **jamais** de clé API

### 9.3 Performance

- Les JSON sont importés au build (Vite les inclut dans le bundle) — pas de fetch async
- Le `.env` est lu à chaque appel à `/api/env` (pour permettre les modifications à chaud)
- Le state garde le provider actif en mémoire (pas de relecture du JSON à chaque render)
- Le cache `cachedEnv` dans `envLoader` évite les appels répétés à `/api/env`

---

## 10. Tests

### 10.1 Tests unitaires

| Test | Ce qu'il teste |
|------|---------------|
| `providerLoader.test.js` | Charge les JSON, `getPreset()`, `getCategory()`, `validateStoredProvider()` |
| `envLoader.test.js` | Mock le fetch, teste le cache, `getApiKeyForEnvKey()`, `hasApiKey()` |
| `providerPanel.test.js` | Render des 3 zones, events, workflow |
| `workflowRunner.test.js` | Flow complet 6 étapes, erreurs, timeouts |
| `aiClient.test.js` | Lit les clés via `envLoader`, construit les URLs |
| `state.test.js` | State, actions, providerConfigs (sans apiKeys) |

### 10.2 Tests d'intégration

- Flow complet dans le navigateur : sélection → clé → modèles → test → validé
- Test avec chaque provider : openrouter, gemini, kilo, groq, mistral, opencode-zen, ollama, lmstudio

### 10.3 Impact sur les tests existants

**~227 tests** existants. Estimation de l'impact :
- `state.test.js` : ~15 tests à réécrire (utilisent `PROVIDER_PRESETS` et `apiKeys[]`)
- `providerPresets.test.js` : ~10 tests supprimés (remplacés par `providerLoader.test.js`)
- `providerPanel.test.js` : ~5 tests à adapter
- `workflowRunner.test.js` : ~10 tests à adapter
- `aiClient.test.js` : ~5 tests à adapter
- **Total : ~35 tests à réécrire, ~10 tests supprimés, ~227 → ~217 tests**

---

## 11. Points d'attention

1. **Le `.env` doit exister** avant de lancer l'app (sinon l'endpoint retourne `{}`). Le `env-server.mjs` a un fallback pour ne pas crasher.
2. **Le serveur Node doit tourner** en même temps que Vite (script `dev` avec `concurrently`)
3. **Les providers `authRequired: false`** (kilo, ollama, lmstudio) skip l'étape de clé
4. **Le `defaultModel` doit être un vrai modèle** (pas `openrouter/free` qui n'existe pas)
5. **La colonne de la grille est calculée** depuis le nom du provider (1 mot = col 1, multi-mots = col 2)
6. **Les providers `enabled: false`** n'apparaissent pas dans la grille
7. **Les clés API sont lues au démarrage** via `/api/env` (cache en mémoire)
8. **Le state ne contient jamais de clé API** (sécurité)
9. **Les JSON sont dans `src/`** pour être importés directement par Vite (pas dans `data/` ou `public/`)
10. **Le proxy `/api/env` est obligatoire** dans `vite.config.js` pour connecter le frontend au serveur env
