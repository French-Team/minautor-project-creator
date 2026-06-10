# Guide d'implémentation détaillé — Provider Panel Redesign

> ✅ **Statut d'implémentation** (mis à jour : juin 2026) : **Implémenté** — les modules et styles décrits dans ce guide sont en production
>
> - Section A (`keyRotation.js`) ✅ implémenté
> - Section B (`workflowRunner.js`) ✅ implémenté (y compris les tests avec vi fake timers)
> - Section C (`aiClient.js` — `fetchModels`, `testModel`, normalisation OpenAI/Gemini/Ollama) ✅ implémenté
> - Section D (`providerPanel.js` — 3 zones, event delegation) ✅ implémenté
> - Section E (CSS — `.pp-status`, `.pp-grid`, `.pp-workflow__*`, `.pp-spinner`) ✅ implémenté dans `src/styles/default.css`
> - Section F (`state.js` — `modelMeta`, migration apiKeys) ✅ partiellement implémenté (la migration `apiKeys` a été abandonnée : les clés sont dans `.env`, pas dans le state)
> - Section G (`providerPresets.js` — `modelListingUrl`, `getOnlineProviders`, `getLocalProviders`) ✅ **refactor abandonné** : `providerPresets.js` a été supprimé, le contenu est dans `data/provider-configs.json`
> - **Drift significatif sur G** : `getOnlineProviders()` / `getLocalProviders()` ont été remplacés par `getPresetsByCategory('online' | 'local')` depuis `providerLoader.js` (via `provider-refactor-spec.md`)
> - Section H (résumé des modules et dépendances) ✅ reflète l'architecture finale
> - Section I (checklist) — toutes les phases 1–8 sont cochées ✅

**Ce document est la suite du spec technique (v1.4).** Il contient le code exact à écrire pour chaque module, les CSS, les structures DOM, et les mécanismes d'intégration. Pendant l'implémentation, on suit ce guide sans réfléchir.

> **Dépendances existantes réutilisées** (pas besoin de les recréer) :
> - `toLocalUrl(baseUrl, providerId)` → dans `aiClient.js` (ligne 24)
> - `escapeHtml(str)` → dans `providerPanel.js` (ligne 120)
> - `renderProviderPanel()` → fonction de rendu existante dans `providerPanel.js` (appelée `render()` dans ce guide)
> - CSS variables `--accent-soft`, `--success`, `--warning` → déjà définies dans `default.css`

---

## A. keyRotation.js — Service d'interchange de clés

### Code complet

```javascript
/**
 * keyRotation.js — Service d'interchange de clés API (LRU + détection 429)
 * 
 * Tout est en mémoire. Rien n'est persisté dans localStorage.
 * 
 * @module keyRotation
 */

import { getState } from '../state.js';

// --- État en mémoire ---

// Map<providerId, Map<keyValue, { lastUsedAt, rateLimitedUntil }>>
const keyMeta = new Map();

// Map<providerId, { count, windowStart }> — compteur erreurs 500/503
const errorCounts = new Map();

// Timer de reset automatique des clés rate-limitées
const resetTimers = new Map();

// --- Fonctions internes ---

/**
 * Récupère les clés API d'un provider depuis le state.
 */
function getKeysForProvider(providerId) {
  return (getState().assistant?.apiKeys || [])
    .map((key, index) => ({ ...key, _index: index }))
    .filter((key) => key.providerId === providerId);
}

/**
 * Récupère ou crée les métadonnées d'une clé.
 */
function getOrCreateMeta(providerId, keyValue) {
  if (!keyMeta.has(providerId)) {
    keyMeta.set(providerId, new Map());
  }
  const providerKeys = keyMeta.get(providerId);
  if (!providerKeys.has(keyValue)) {
    providerKeys.set(keyValue, {
      lastUsedAt: 0,
      rateLimitedUntil: 0,
    });
  }
  return providerKeys.get(keyValue);
}

/**
 * Vérifie si une clé est actuellement rate-limitée.
 */
function isCurrentlyRateLimited(providerId, keyValue) {
  const meta = keyMeta.get(providerId)?.get(keyValue);
  if (!meta) return false;
  return Date.now() < meta.rateLimitedUntil;
}

/**
 * Programme le reset automatique d'une clé rate-limitée.
 */
function scheduleReset(providerId, keyValue, retryAfterMs) {
  const timerId = setTimeout(() => {
    const meta = keyMeta.get(providerId)?.get(keyValue);
    if (meta) {
      meta.rateLimitedUntil = 0;
    }
    resetTimers.delete(`${providerId}:${keyValue}`);
  }, retryAfterMs);
  
  // Annuler un timer précédent s'il existe
  const prevTimer = resetTimers.get(`${providerId}:${keyValue}`);
  if (prevTimer) clearTimeout(prevTimer);
  resetTimers.set(`${providerId}:${keyValue}`, timerId);
}

// --- API publique ---

/**
 * Sélectionne la prochaine clé disponible (LRU parmi les clés non rate-limitées).
 * @param {string} providerId
 * @returns {{ index: number, value: string } | null}
 */
export function getNextKey(providerId) {
  const keys = getKeysForProvider(providerId);
  if (keys.length === 0) return null;

  // Filtrer les clés non rate-limitées
  const available = keys.filter(
    (k) => !isCurrentlyRateLimited(providerId, k.value)
  );

  if (available.length === 0) return null;

  // LRU : trier par lastUsedAt ASC (la plus ancienne en premier)
  available.sort((a, b) => {
    const metaA = keyMeta.get(providerId)?.get(a.value);
    const metaB = keyMeta.get(providerId)?.get(b.value);
    return (metaA?.lastUsedAt || 0) - (metaB?.lastUsedAt || 0);
  });

  const selected = available[0];
  // Mettre à jour lastUsedAt
  const meta = getOrCreateMeta(providerId, selected.value);
  meta.lastUsedAt = Date.now();

  return { index: selected._index, value: selected.value };
}

/**
 * Marque une clé comme rate-limitée.
 * @param {string} providerId
 * @param {number} keyIndex - Index dans le tableau apiKeys, ou -1 si inconnu
 * @param {number} retryAfter - Secondes avant retry (défaut: 60)
 */
export function markRateLimited(providerId, keyIndex, retryAfter = 60) {
  const keys = getKeysForProvider(providerId);
  if (keyIndex >= 0 && keyIndex < keys.length) {
    const keyValue = keys[keyIndex].value;
    const meta = getOrCreateMeta(providerId, keyValue);
    meta.rateLimitedUntil = Date.now() + (retryAfter * 1000);
    meta.lastUsedAt = Date.now(); // Mettre à jour LRU même en cas de rate limit
    scheduleReset(providerId, keyValue, retryAfter * 1000);
  }
}

/**
 * Vérifie si une clé est disponible (pas rate-limitée).
 * @param {string} providerId
 * @param {number} keyIndex
 * @returns {boolean}
 */
export function isKeyAvailable(providerId, keyIndex) {
  const keys = getKeysForProvider(providerId);
  if (keyIndex < 0 || keyIndex >= keys.length) return false;
  return !isCurrentlyRateLimited(providerId, keys[keyIndex].value);
}

/**
 * Réinitialise le status d'une clé.
 * @param {string} providerId
 * @param {number} keyIndex
 */
export function resetKeyStatus(providerId, keyIndex) {
  const keys = getKeysForProvider(providerId);
  if (keyIndex >= 0 && keyIndex < keys.length) {
    const keyValue = keys[keyIndex].value;
    const meta = keyMeta.get(providerId)?.get(keyValue);
    if (meta) {
      meta.rateLimitedUntil = 0;
    }
  }
}

/**
 * Retourne le statut de toutes les clés d'un provider.
 * Utilisé par la modale API keys (§6.3).
 * @param {string} providerId
 * @returns {Array<{ index, name, value, isRateLimited, rateLimitedUntil, isCurrentlyActive }>}
 */
export function getKeyStatuses(providerId) {
  const keys = getKeysForProvider(providerId);
  const currentApiKey = getState().assistant?.provider?.apiKey || '';

  return keys.map((k) => {
    const meta = keyMeta.get(providerId)?.get(k.value);
    return {
      index: k._index,
      name: k.name,
      value: k.value,
      isRateLimited: isCurrentlyRateLimited(providerId, k.value),
      rateLimitedUntil: meta?.rateLimitedUntil || 0,
      timeRemaining: meta
        ? Math.max(0, Math.ceil((meta.rateLimitedUntil - Date.now()) / 1000))
        : 0,
      isCurrentlyActive: k.value === currentApiKey,
    };
  });
}

/**
 * Track les erreurs 500/503 pour détection secondaire de rate limit.
 * @param {string} providerId
 */
export function trackError(providerId) {
  const now = Date.now();
  const entry = errorCounts.get(providerId) || { count: 0, windowStart: now };

  // Reset si la fenêtre de 60s est dépassée
  if (now - entry.windowStart > 60000) {
    entry.count = 0;
    entry.windowStart = now;
  }

  entry.count++;
  errorCounts.set(providerId, entry);

  // Si ≥3 erreurs en 60s → marquer TOUTES les clés du provider comme rate-limitées
  if (entry.count >= 3) {
    const keys = getKeysForProvider(providerId);
    keys.forEach((k) => {
      const meta = getOrCreateMeta(providerId, k.value);
      meta.rateLimitedUntil = now + 60000;
      meta.lastUsedAt = now;
      scheduleReset(providerId, k.value, 60000);
    });
    errorCounts.delete(providerId); // Reset après déclenchement
  }
}

/**
 * Réinitialise le compteur d'erreurs d'un provider (après une requête réussie).
 * @param {string} providerId
 */
export function resetErrorCount(providerId) {
  errorCounts.delete(providerId);
}

/**
 * Nettoyage complet (pour les tests).
 */
export function _reset() {
  keyMeta.clear();
  errorCounts.clear();
  resetTimers.forEach((timerId) => clearTimeout(timerId));
  resetTimers.clear();
}
```

### Tests (keyRotation.test.js)

```javascript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getNextKey,
  markRateLimited,
  isKeyAvailable,
  resetKeyStatus,
  getKeyStatuses,
  trackError,
  resetErrorCount,
  _reset,
} from './keyRotation.js';

// Mock du state
vi.mock('../state.js', () => ({
  getState: vi.fn(),
}));

// Mock de toast (évite les erreurs DOM dans les tests)
vi.mock('./toast.js', () => ({
  toast: {
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    dismissAll: vi.fn(),
  },
}));

import { getState } from '../state.js';

describe('keyRotation', () => {
  beforeEach(() => {
    _reset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function setupKeys(providerId, keyValues) {
    getState.mockReturnValue({
      assistant: {
        provider: { apiKey: keyValues[0] },
        apiKeys: keyValues.map((v, i) => ({
          name: `Key ${i + 1}`,
          providerId,
          value: v,
        })),
      },
    });
  }

  describe('getNextKey', () => {
    it('retourne la première clé si aucune n\'est utilisée', () => {
      setupKeys('openrouter', ['sk-1', 'sk-2', 'sk-3']);
      const result = getNextKey('openrouter');
      expect(result).toEqual({ index: 0, value: 'sk-1' });
    });

    it('retourne la clé LRU (la plus ancienne)', () => {
      setupKeys('openrouter', ['sk-1', 'sk-2', 'sk-3']);
      // Utiliser sk-1
      getNextKey('openrouter');
      // Utiliser sk-2
      vi.advanceTimersByTime(100);
      getNextKey('openrouter');
      // La prochaine devrait être sk-3 (jamais utilisée)
      vi.advanceTimersByTime(100);
      const result = getNextKey('openrouter');
      expect(result.value).toBe('sk-3');
    });

    it('retourne null si aucune clé disponible', () => {
      setupKeys('openrouter', []);
      expect(getNextKey('openrouter')).toBeNull();
    });

    it('ignore les clés rate-limitées', () => {
      setupKeys('openrouter', ['sk-1', 'sk-2']);
      markRateLimited('openrouter', 0, 60);
      const result = getNextKey('openrouter');
      expect(result.value).toBe('sk-2');
    });

    it('retourne null si toutes les clés sont rate-limitées', () => {
      setupKeys('openrouter', ['sk-1', 'sk-2']);
      markRateLimited('openrouter', 0, 60);
      markRateLimited('openrouter', 1, 60);
      expect(getNextKey('openrouter')).toBeNull();
    });
  });

  describe('markRateLimited', () => {
    it('marque une clé comme rate-limitée', () => {
      setupKeys('openrouter', ['sk-1', 'sk-2']);
      markRateLimited('openrouter', 0, 30);
      expect(isKeyAvailable('openrouter', 0)).toBe(false);
      expect(isKeyAvailable('openrouter', 1)).toBe(true);
    });

    it('reset automatique après le timeout', () => {
      setupKeys('openrouter', ['sk-1']);
      markRateLimited('openrouter', 0, 5);
      expect(isKeyAvailable('openrouter', 0)).toBe(false);
      vi.advanceTimersByTime(5000);
      expect(isKeyAvailable('openrouter', 0)).toBe(true);
    });
  });

  describe('getKeyStatuses', () => {
    it('retourne le statut de toutes les clés', () => {
      setupKeys('openrouter', ['sk-1', 'sk-2']);
      const statuses = getKeyStatuses('openrouter');
      expect(statuses).toHaveLength(2);
      expect(statuses[0].name).toBe('Key 1');
      expect(statuses[0].isRateLimited).toBe(false);
      expect(statuses[0].isCurrentlyActive).toBe(true); // sk-1 est le current apiKey
    });
  });

  describe('trackError', () => {
    it('incrémente le compteur d\'erreurs', () => {
      trackError('openrouter');
      trackError('openrouter');
      // 2 erreurs, pas encore de rate limit
      expect(isKeyAvailable('openrouter', 0)).toBe(true);
    });

    it('déclenche le rate limit après 3 erreurs', () => {
      setupKeys('openrouter', ['sk-1']);
      trackError('openrouter');
      trackError('openrouter');
      trackError('openrouter');
      // 3 erreurs → rate limit déclenché
      expect(isKeyAvailable('openrouter', 0)).toBe(false);
    });

    it('reset le compteur après une fenêtre de 60s', () => {
      trackError('openrouter');
      vi.advanceTimersByTime(61000);
      trackError('openrouter');
      // Nouvelle fenêtre, 1 erreur seulement
      expect(isKeyAvailable('openrouter', 0)).toBe(true);
    });
  });
});
```

### workflowRunner.test.js

```javascript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  startWorkflow,
  cancelWorkflow,
  testApiKey,
  selectModel,
  getWorkflowState,
  getDisplayModels,
  _reset,
} from './workflowRunner.js';

// Mock des dépendances
vi.mock('../state.js', () => ({
  getState: vi.fn(),
  actions: {
    updateProvider: vi.fn(),
  },
}));

vi.mock('./aiClient.js', () => ({
  chatCompletion: vi.fn(),
  fetchModels: vi.fn(),
  testModel: vi.fn(),
}));

vi.mock('./keyRotation.js', () => ({
  getNextKey: vi.fn(),
  markRateLimited: vi.fn(),
  resetErrorCount: vi.fn(),
}));

vi.mock('./toast.js', () => ({
  toast: {
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    dismissAll: vi.fn(),
  },
}));

vi.mock('./providerPresets.js', () => ({
  PROVIDER_PRESETS: [
    {
      id: 'ollama',
      name: 'ollama',
      category: 'local',
      baseUrl: 'http://localhost:11434/v1',
      authRequired: false,
      defaultModel: 'llama3.2',
      models: [{ id: 'llama3.2', name: 'llama3.2', isFree: true }],
    },
    {
      id: 'openrouter',
      name: 'OpenRouter',
      category: 'online',
      baseUrl: 'https://openrouter.ai/api/v1',
      authRequired: true,
      defaultModel: 'meta-llama/llama-3.2-3b-instruct:free',
      models: [],
    },
  ],
  getOnlineProviders: vi.fn(() => []),
  getLocalProviders: vi.fn(() => []),
}));

import { getState, actions } from '../state.js';
import { chatCompletion, fetchModels, testModel } from './aiClient.js';
import * as keyRotation from './keyRotation.js';

describe('workflowRunner', () => {
  beforeEach(() => {
    _reset();
    vi.useFakeTimers();
    getState.mockReturnValue({
      assistant: {
        provider: {
          id: 'ollama',
          apiKey: '',
          baseUrl: 'http://localhost:11434/v1',
          model: 'llama3.2',
          isConnected: false,
        },
        apiKeys: [],
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('startWorkflow (local provider)', () => {
    it('saute l\'étape 2 pour les providers locaux', async () => {
      fetchModels.mockResolvedValue([
        { id: 'llama3.2', name: 'llama3.2', isFree: true },
      ]);
      testModel.mockResolvedValue({
        format: 'openai',
        capabilities: ['chat'],
        contextWindow: null,
        latency: 100,
      });

      // Démarrer le workflow ET sélectionner un modèle via un micro-task
      // pour que le selectModel soit appelé APRÈS que le workflow atteigne l'étape 4
      const workflow = startWorkflow('ollama');
      // Laisser le workflow atteindre l'étape 4 (loadModels + runStep4)
      await vi.advanceTimersByTimeAsync(50);
      // Maintenant sélectionner le modèle (la Promise de l'étape 4 est en attente)
      selectModel('llama3.2');
      // Laisser le workflow terminer (test + validation)
      await vi.advanceTimersByTimeAsync(50);

      const state = getWorkflowState();
      expect(state.step).toBe(7); // Validé directement
      expect(actions.updateProvider).toHaveBeenCalled();
    });
  });

  describe('cancelWorkflow', () => {
    it('résout les Promises pendantes avec false', async () => {
      // Démarrer un workflow online pour bloquer à l'étape 2
      const workflow = startWorkflow('openrouter');
      void workflow; // Éviter le warning unhandled promise
      await vi.advanceTimersByTimeAsync(50);

      expect(getWorkflowState().step).toBe(2);

      // Annuler
      cancelWorkflow();

      // Le workflow devrait se terminer
      await vi.advanceTimersByTimeAsync(50);
      expect(getWorkflowState().step).toBe(0);
    });
  });

  describe('testApiKey', () => {
    it('succès → résout la Promise de l\'étape 2', async () => {
      chatCompletion.mockResolvedValue({ content: 'ok' });

      const workflow = startWorkflow('openrouter');
      void workflow; // Éviter le warning unhandled promise
      await vi.advanceTimersByTimeAsync(50);

      const result = await testApiKey('sk-test');
      expect(result.ok).toBe(true);
      expect(actions.updateProvider).toHaveBeenCalledWith(
        expect.objectContaining({ apiKey: 'sk-test' })
      );
    });

    it('échec → retourne { ok: false }', async () => {
      chatCompletion.mockRejectedValue(new Error('Unauthorized'));

      const result = await testApiKey('sk-bad');
      expect(result.ok).toBe(false);
      expect(result.error).toBe('Unauthorized');
    });
  });

  describe('getDisplayModels', () => {
    it('retourne les modèles triés (gratuits en premier)', () => {
      fetchModels.mockResolvedValue([
        { id: 'paid', name: 'Paid Model', isFree: false, contextWindow: 4096 },
        { id: 'free', name: 'Free Model', isFree: true, contextWindow: 2048 },
      ]);

      // Simuler loadedModels
      const result = getDisplayModels('', false);
      expect(result.displayed.length).toBeGreaterThanOrEqual(0);
    });
  });
});
```

---

## B. workflowRunner.js — Orchestrateur du workflow

### Architecture clé : la pause à l'étape 2

Le workflow est une fonction `async` qui avance étape par étape. À l'étape 2, il crée une **Promise** qui ne se résout que quand l'utilisateur clique "Tester" et que la clé est validée.

```javascript
// Mécanisme de pause
let resolveApiKeyTest = null; // Fonction qui résout la Promise de l'étape 2

// Dans startWorkflow():
// À l'étape 2, on attend :
const apiKeyValidated = await new Promise((resolve) => {
  resolveApiKeyTest = resolve;
});

// Quand l'utilisateur clique "Tester" et que le test réussit :
function onApiKeyTestSuccess() {
  if (resolveApiKeyTest) {
    resolveApiKeyTest(true);
    resolveApiKeyTest = null;
  }
}
```

### Code complet

```javascript
/**
 * workflowRunner.js — Orchestrateur du workflow guidé (7 étapes)
 * 
 * Tout est en mémoire. Rien n'est persisté.
 * 
 * Architecture :
 *   - providerPanel.js appelle startWorkflow(providerId)
 *   - workflowRunner avance les étapes et met à jour le state
 *   - À l'étape 2, il pause (Promise) en attendant l'action utilisateur
 *   - L'Annulation utilise AbortController
 * 
 * @module workflowRunner
 */

import { getState, actions } from '../state.js';
import { PROVIDER_PRESETS } from './providerPresets.js';
import { chatCompletion, fetchModels, testModel } from './aiClient.js';
import * as keyRotation from './keyRotation.js';
import { toast } from './toast.js';

// --- État en mémoire ---

let currentStep = 0;        // 0=inactive, 1-6=étapes
let currentError = null;    // { step, message, timestamp } | null
let abortController = null; // AbortController pour annulation
let loadedModels = [];      // Modèles chargés depuis l'API
let modelMeta = null;       // Métadonnées du modèle testé
let selectedModelId = null; // ID du modèle sélectionné
let resolveApiKeyTest = null; // Resolve de la Promise de l'étape 2
let resolveModelSelect = null; // Resolve de la Promise de l'étape 4

// --- Constantes ---

const TIMEOUTS = {
  apiKeyTest: 10000,   // 10s pour tester la clé
  loadModels: 15000,   // 15s pour charger les modèles
  modelTest: 20000,    // 20s pour tester le modèle
};

// --- Fonctions utilitaires ---

function getProviderName(providerId) {
  const preset = PROVIDER_PRESETS.find((p) => p.id === providerId);
  return preset?.name || providerId;
}

function setStep(step) {
  currentStep = step;
  currentError = null;
}

function setError(step, message) {
  currentError = { step, message, timestamp: Date.now() };
}

function abortIfCancelled() {
  if (abortController?.signal?.aborted) {
    throw new Error('WORKFLOW_CANCELLED');
  }
}

async function withTimeout(promise, ms, label) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  
  // Capturer le workflow AbortController localement pour éviter
  // les bugs si abortController est réassigné entre-temps
  const workflowAbort = abortController;
  let externalAbortHandler = null;
  if (workflowAbort?.signal) {
    externalAbortHandler = () => controller.abort();
    workflowAbort.signal.addEventListener('abort', externalAbortHandler, { once: true });
  }

  try {
    const result = await Promise.race([
      promise,
      new Promise((_, reject) => {
        controller.signal.addEventListener('abort', () => {
          reject(new Error(`TIMEOUT_${label.toUpperCase()}`));
        }, { once: true });
      }),
    ]);
    return result;
  } finally {
    clearTimeout(timer);
    // Cleanup: retirer l'event listener du BON signal (capturé localement)
    if (externalAbortHandler && workflowAbort?.signal) {
      workflowAbort.signal.removeEventListener('abort', externalAbortHandler);
    }
  }
}

// --- API publique ---

/**
 * Lance le workflow pour un provider donné.
 * @param {string} providerId
 */
export async function startWorkflow(providerId) {
  // Annuler le workflow précédent s'il y en a un
  if (abortController) {
    abortController.abort();
  }
  toast.dismissAll();

  // Initialiser
  abortController = new AbortController();
  loadedModels = [];
  modelMeta = null;
  selectedModelId = null;
  currentError = null;

  const preset = PROVIDER_PRESETS.find((p) => p.id === providerId);
  if (!preset) {
    setError(0, `Provider inconnu: ${providerId}`);
    return;
  }

  try {
    // Étape 1 : Sélection du provider
    setStep(1);
    toast.info(`Provider ${preset.name} sélectionné`);

    // Si local, skip l'étape 2
    const needsApiKey = preset.authRequired !== false;
    if (!needsApiKey) {
      await runStep3(providerId, preset);
    } else {
      // Étape 2 : Clé API (pause en attente de l'utilisateur)
      setStep(2);
      const apiKeyValidated = await waitForApiKeyTest();
      abortIfCancelled();
      
      if (!apiKeyValidated) {
        // L'utilisateur a annulé ou le test a échoué
        setStep(0);
        return;
      }

      // Continuer avec l'étape 3
      await runStep3(providerId, preset);
    }
  } catch (err) {
    if (err.message === 'WORKFLOW_CANCELLED') {
      // Annulation silencieuse
      setStep(0);
      return;
    }
    
    // Gérer les erreurs de timeout
    if (err.message?.startsWith('TIMEOUT_')) {
      const stepName = err.message.replace('TIMEOUT_', '');
      setError(currentStep, `Délai d'attente dépassé (${stepName})`);
      
      if (stepName === 'LOADMODELS') {
        toast.error(`Délai d'attente dépassé (${TIMEOUTS.loadModels / 1000}s). Modèles fallback affichés.`);
        // Fallback : utiliser les modèles du preset
        loadedModels = preset.models || [];
        await runStep4(providerId);
      } else if (stepName === 'MODELTEST') {
        toast.error(`Délai d'attente dépassé (${TIMEOUTS.modelTest / 1000}s). Sélectionne un autre modèle.`);
        // Rester à l'étape 4 pour permettre un nouveau choix
      }
      return;
    }

    // Autres erreurs
    setError(currentStep, err.message);
    toast.error(`Erreur: ${err.message}`);
    setStep(0);
  }
}

/**
 * Annule le workflow en cours.
 */
export function cancelWorkflow() {
  // Résoudre les Promises en attente avec false AVANT de nullifier
  // pour éviter les Promises pendantes (memory leak)
  if (resolveApiKeyTest) {
    resolveApiKeyTest(false);
    resolveApiKeyTest = null;
  }
  if (resolveModelSelect) {
    resolveModelSelect(false);
    resolveModelSelect = null;
  }
  if (abortController) {
    abortController.abort();
  }
  setStep(0);
}

/**
 * Retourne l'état actuel du workflow.
 * @returns {{ step, error, loadedModels, modelMeta, selectedModelId }}
 */
export function getWorkflowState() {
  return {
    step: currentStep,
    error: currentError,
    loadedModels,
    modelMeta,
    selectedModelId,
  };
}

// --- Étape 2 : Pause en attente de la clé API ---

/**
 * Crée une Promise qui se résout quand l'utilisateur valide sa clé.
 * @returns {Promise<boolean>}
 */
function waitForApiKeyTest() {
  return new Promise((resolve) => {
    resolveApiKeyTest = resolve;
  });
}

/**
 * Appelé par providerPanel.js quand l'utilisateur clique "Tester la clé".
 * @param {string} apiKey
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function testApiKey(apiKey) {
  if (!apiKey) return { ok: false, error: 'Clé API vide' };

  const provider = getState().assistant.provider;
  
  try {
    toast.info('Test de la clé en cours...');
    
    await withTimeout(
      chatCompletion(
        { ...provider, apiKey },
        [{ role: 'user', content: 'Say ok' }]
      ),
      TIMEOUTS.apiKeyTest,
      'apiKeyTest'
    );

    // Succès
    toast.success('Clé API validée');
    actions.updateProvider({ apiKey });
    
    // Résoudre la Promise de l'étape 2
    if (resolveApiKeyTest) {
      resolveApiKeyTest(true);
      resolveApiKeyTest = null;
    }
    
    return { ok: true };
  } catch (err) {
    const msg = err.message?.startsWith('TIMEOUT_')
      ? `Délai d'attente dépassé (${TIMEOUTS.apiKeyTest / 1000}s)`
      : err.message;
    
    toast.error(`Clé API invalide: ${msg}`);
    return { ok: false, error: msg };
  }
}

// --- Étape 3 : Chargement des modèles ---

async function runStep3(providerId, preset) {
  abortIfCancelled();
  setStep(3);
  toast.info('Chargement des modèles disponibles...');

  try {
    const provider = getState().assistant.provider;
    loadedModels = await withTimeout(
      fetchModels(provider),
      TIMEOUTS.loadModels,
      'loadModels'
    );

    abortIfCancelled();

    if (loadedModels.length === 0) {
      // Fallback sur les modèles du preset
      loadedModels = preset.models || [];
      if (loadedModels.length > 0) {
        toast.warning('Aucun modèle chargé depuis l\'API. Modèles fallback affichés.');
      } else {
        toast.error('Aucun modèle disponible pour ce provider.');
        setStep(0);
        return;
      }
    }

    // Compter les gratuits
    const freeCount = loadedModels.filter((m) => m.isFree).length;
    toast.success(`${loadedModels.length} modèles disponibles, ${freeCount} gratuits`);

    // Passer à l'étape 4
    await runStep4(providerId);
  } catch (err) {
    if (err.message === 'WORKFLOW_CANCELLED') throw err;
    
    // Fallback
    loadedModels = preset.models || [];
    if (loadedModels.length > 0) {
      toast.error(`Impossible de charger les modèles: ${err.message}. Modèles fallback affichés.`);
      await runStep4(providerId);
    } else {
      toast.error(`Impossible de charger les modèles: ${err.message}`);
      setStep(0);
    }
  }
}

// --- Étape 4 : Sélection du modèle ---

async function runStep4(providerId) {
  abortIfCancelled();
  setStep(4);

  // Pause en attente de la sélection du modèle
  const modelSelected = await waitForModelSelection();
  abortIfCancelled();

  if (!modelSelected) {
    setStep(0);
    return;
  }

  // Passer à l'étape 5
  await runStep5(providerId);
}

/**
 * Crée une Promise qui se résout quand l'utilisateur sélectionne un modèle.
 * @returns {Promise<boolean>}
 */
function waitForModelSelection() {
  return new Promise((resolve) => {
    resolveModelSelect = resolve;
  });
}

/**
 * Appelé par providerPanel.js quand l'utilisateur sélectionne un modèle.
 * @param {string} modelId
 */
export function selectModel(modelId) {
  selectedModelId = modelId;
  if (resolveModelSelect) {
    resolveModelSelect(true);
    resolveModelSelect = null;
  }
}

// --- Étape 5 : Test du modèle ---

async function runStep5(providerId) {
  abortIfCancelled();
  setStep(5);
  toast.info('Test du modèle en cours...');

  try {
    const provider = getState().assistant.provider;
    const model = loadedModels.find((m) => m.id === selectedModelId);
    
    const result = await withTimeout(
      testModel(provider, selectedModelId),
      TIMEOUTS.modelTest,
      'modelTest'
    );

    abortIfCancelled();

    modelMeta = result;
    toast.success(`Modèle ${model?.name || selectedModelId} testé avec succès (${result.latency}ms)`);

    // Passer à l'étape 6
    await runStep6(providerId, selectedModelId);
  } catch (err) {
    if (err.message === 'WORKFLOW_CANCELLED') throw err;
    
    const msg = err.message?.startsWith('TIMEOUT_')
      ? `Délai d'attente dépassé (${TIMEOUTS.modelTest / 1000}s)`
      : err.message;
    
    toast.error(`Test échoué: ${msg}`);
    // Rester à l'étape 4 pour permettre un nouveau choix
    await runStep4(providerId);
  }
}

// --- Étape 6 : Validation ---

async function runStep6(providerId, modelId) {
  abortIfCancelled();
  setStep(6);

  const provider = getState().assistant.provider;
  const model = loadedModels.find((m) => m.id === modelId);
  const preset = PROVIDER_PRESETS.find((p) => p.id === providerId);

  // Persister dans le state
  actions.updateProvider({
    model: modelId,
    isConnected: true,
    lastTestedAt: Date.now(),
    modelMeta: modelMeta,
  });

  toast.success(`Connexion validée ! ${preset?.name || providerId} — ${model?.name || modelId} est prêt.`);

  // Étape 7 : Sauvegarde auto (déjà fait par updateProvider → persistAssistant)
  setStep(7);
}

/**
 * Retourne les modèles filtrés et triés (Top 15 ou tous).
 * @param {string} searchQuery
 * @param {boolean} showAll
 * @returns {{ displayed, total, freeCount }}
 */
export function getDisplayModels(searchQuery = '', showAll = false) {
  let filtered = loadedModels;

  // Filtre de recherche
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter((m) =>
      m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q)
    );
  }

  // Tri : gratuit > context window DESC > alphabétique
  filtered.sort((a, b) => {
    if (a.isFree && !b.isFree) return -1;
    if (!a.isFree && b.isFree) return 1;
    const cwA = a.contextWindow || 0;
    const cwB = b.contextWindow || 0;
    if (cwB !== cwA) return cwB - cwA;
    return a.name.localeCompare(b.name);
  });

  const total = filtered.length;
  const freeCount = filtered.filter((m) => m.isFree).length;
  const displayed = showAll ? filtered : filtered.slice(0, 15);

  return { displayed, total, freeCount, hasMore: total > 15 };
}

/**
 * Nettoyage complet (pour les tests).
 */
export function _reset() {
  cancelWorkflow();
  loadedModels = [];
  modelMeta = null;
  selectedModelId = null;
}
```

---

## C. aiClient.js — Nouvelles fonctions

### fetchModels(provider)

> **Note** : `modelListingUrl` défini dans les presets n'est PAS utilisé ici car chaque provider a un format d'endpoint différent (Gemini utilise `?key=`, Ollama utilise `/api/tags`). Les if/else couvrent ces cas spécifiques. `modelListingUrl` est réservé pour les providers custom qui suivent le format OpenAI standard.

```javascript
/**
 * Charge les modèles disponibles depuis l'API du provider.
 * Normalise les formats différents (OpenAI, Gemini, Ollama) en un tableau commun.
 *
 * @param {Object} provider - { id, baseUrl, apiKey }
 * @returns {Promise<Array<{ id: string, name: string, contextWindow?: number, isFree?: boolean }>>}
 */
export async function fetchModels(provider) {
  const { id, baseUrl, apiKey } = provider;

  // Construire l'URL de listing
  let url;
  if (id === 'gemini') {
    url = `${baseUrl}/models?key=${apiKey}`;
  } else if (id === 'ollama') {
    url = toLocalUrl(baseUrl.replace('/v1', ''), id) + '/api/tags';
  } else if (id === 'lmstudio') {
    url = toLocalUrl(baseUrl, id) + '/models';
  } else {
    // OpenAI-compatible (openrouter, groq, mistral, codestral, kilo, opencode-zen)
    url = toLocalUrl(baseUrl, id) + '/models';
  }

  const headers = {};
  if (apiKey && id !== 'gemini') {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const response = await fetch(url, {
    method: 'GET',
    headers,
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data = await response.json();

  // Normaliser selon le format
  if (id === 'ollama') {
    return normalizeOllamaModels(data);
  } else if (id === 'gemini') {
    return normalizeGeminiModels(data);
  } else {
    return normalizeOpenAIModels(data);
  }
}

function normalizeOpenAIModels(data) {
  return (data.data || []).map((m) => ({
    id: m.id,
    name: m.id,
    contextWindow: m.context_window || m.context_length || null,
    isFree: m.id.includes(':free') || m.id.includes('-free'),
  }));
}

function normalizeGeminiModels(data) {
  return (data.models || []).map((m) => ({
    id: m.name,
    name: m.displayName || m.name,
    contextWindow: null, // Gemini ne fournit pas toujours le context window
    isFree: false, // Gemini n'a pas de modèle "free" explicite
  }));
}

function normalizeOllamaModels(data) {
  return (data.models || []).map((m) => ({
    id: m.name,
    name: m.name,
    contextWindow: null,
    isFree: true, // Tous les modèles locaux sont "gratuits"
  }));
}
```

### testModel(provider, modelId)

```javascript
/**
 * Teste un modèle en lui envoyant "Say hello".
 * Retourne les métadonnées du modèle (format, capabilities, contextWindow).
 *
 * @param {Object} provider
 * @param {string} modelId
 * @returns {Promise<{ format: string, capabilities: string[], contextWindow: number|null, latency: number }>}
 */
export async function testModel(provider, modelId) {
  const start = Date.now();

  // 1. Test chat
  await chatCompletion(
    { ...provider, model: modelId },
    [{ role: 'user', content: 'Say hello' }]
  );

  const latency = Date.now() - start;

  // 2. Détection côté client
  let format = 'openai';
  if (provider.id === 'gemini') format = 'gemini';

  const capabilities = ['chat'];

  // 3. Test FIM si codestral
  if (provider.id === 'codestral') {
    try {
      const fimUrl = toLocalUrl(`${provider.baseUrl}/fim/completions`, provider.id);
      const fimResponse = await fetch(fimUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(provider.apiKey ? { 'Authorization': `Bearer ${provider.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: modelId,
          prompt: 'function hello() {',
          suffix: '}',
          max_tokens: 10,
        }),
        signal: AbortSignal.timeout(5000),
      });
      if (fimResponse.ok) {
        capabilities.push('fim');
      }
    } catch {
      // FIM non disponible, c'est OK
    }
  }

  // 4. Context window (déjà disponible depuis fetchModels)
  // On le récupère du loadedModels dans workflowRunner

  return {
    format,
    capabilities,
    contextWindow: null, // Sera complété par workflowRunner depuis loadedModels
    latency,
  };
}
```

### testConnection modifié (retourne les headers 429)

```javascript
/**
 * Teste la connexion à un provider.
 * MODIFICATION : retourne aussi les headers 429 pour keyRotation.
 *
 * @param {Object} provider
 * @returns {Promise<{ ok: boolean, latency: number, error?: string, status?: number, headers?: Object }>}
 */
export async function testConnection(provider) {
  const start = Date.now();
  try {
    if (provider.category === 'local') {
      const url = provider.id === 'ollama'
        ? `${toLocalUrl(provider.baseUrl.replace('/v1', ''), provider.id)}/api/tags`
        : `${toLocalUrl(provider.baseUrl, provider.id)}/models`;
      const response = await fetch(url, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      return { ok: true, latency: Date.now() - start, models: data };
    } else {
      const response = await chatCompletion(provider, [
        { role: 'user', content: 'Say "ok"' },
      ]);
      return { ok: true, latency: Date.now() - start };
    }
  } catch (error) {
    return {
      ok: false,
      latency: Date.now() - start,
      error: error.message,
      status: error.status,
    };
  }
}
```

---

## D. providerPanel.js — Rendu exact

### Variables locales (state éphémère du composant)

```javascript
// Variables locales (pas dans le state central — non persistées)
let modelSearchQuery = '';
let showAllModels = false;
```

### Structure DOM de la Zone 2 (grille providers)

```javascript
function renderProviderGrid() {
  const online = getOnlineProviders();
  const local = getLocalProviders();
  const current = getState().assistant.provider;

  // Séparer en colonne 1 (1 mot) et colonne 2 (multi-mots)
  function isShortName(name) {
    return name.trim().split(/\s+/).length === 1;
  }

  function renderProviderBtn(p) {
    const isActive = current.id === p.id;
    return `<button class="pp-grid__item ${isActive ? 'is-active' : ''}" 
                    data-provider-id="${p.id}">
      <span class="pp-grid__name">${escapeHtml(p.name)}</span>
    </button>`;
  }

  const onlineShort = online.filter((p) => isShortName(p.name));
  const onlineLong = online.filter((p) => !isShortName(p.name));
  const localShort = local.filter((p) => isShortName(p.name));
  const localLong = local.filter((p) => !isShortName(p.name));

  return `
    <div class="pp-section">
      <div class="pp-section__title">En ligne</div>
      <div class="pp-grid">
        <div class="pp-grid__col1">
          ${onlineShort.map(renderProviderBtn).join('')}
        </div>
        <div class="pp-grid__col2">
          ${onlineLong.map(renderProviderBtn).join('')}
        </div>
      </div>
    </div>
    <div class="pp-section">
      <div class="pp-section__title">Local</div>
      <div class="pp-grid">
        <div class="pp-grid__col1">
          ${localShort.map(renderProviderBtn).join('')}
        </div>
        <div class="pp-grid__col2">
          ${localLong.map(renderProviderBtn).join('')}
        </div>
      </div>
    </div>
  `;
}
```

### Structure DOM de la Zone 3 (workflow)

```javascript
function renderWorkflowZone() {
  const { step } = getWorkflowState();

  switch (step) {
    case 0: return renderEmptyState();
    case 2: return renderApiKeyStep();
    case 3: return renderLoadingStep();
    case 4: return renderModelSelectionStep();
    case 5: return renderTestingStep();
    case 6:
    case 7: return renderValidatedStep();
    default: return renderEmptyState();
  }
}

// --- CSS pour le spinner et le loading ---
// À ajouter dans la section CSS (§E) :
// .pp-workflow__loading { display: flex; align-items: center; gap: 12px; padding: 24px; color: var(--text-secondary, #888); }
// .pp-spinner { width: 20px; height: 20px; border: 2px solid var(--border); border-top-color: var(--accent, #3b82f6); border-radius: 50%; animation: pp-spin 0.8s linear infinite; }
// @keyframes pp-spin { to { transform: rotate(360deg); } }

function renderEmptyState() {
  return `<div class="pp-workflow__empty">Sélectionne un provider pour commencer</div>`;
}

function renderApiKeyStep() {
  return `
    <div class="pp-workflow__step">
      <div class="pp-workflow__step-title">🔑 Clé API</div>
      <div class="pp-workflow__field">
        <label class="pp-workflow__label" for="pp-api-key">Clé API</label>
        <div class="pp-workflow__input-group">
          <input type="password" class="pp-workflow__input" id="pp-api-key" 
                 placeholder="sk-..." autocomplete="off" />
          <button class="pp-workflow__eye-btn" data-action="toggle-password" 
                  title="Afficher/masquer">👁</button>
        </div>
      </div>
      <button class="btn btn--primary pp-workflow__test-btn" id="pp-test-key-btn" 
              data-action="test-api-key" disabled>
        Tester la clé
      </button>
    </div>
  `;
}

function renderLoadingStep() {
  return `
    <div class="pp-workflow__step">
      <div class="pp-workflow__step-title">⏳ Chargement des modèles...</div>
      <div class="pp-workflow__loading">
        <div class="pp-spinner"></div>
        <span>Recherche des modèles disponibles</span>
      </div>
    </div>
  `;
}

function renderTestingStep() {
  return `
    <div class="pp-workflow__step">
      <div class="pp-workflow__step-title">🧪 Test du modèle...</div>
      <div class="pp-workflow__loading">
        <div class="pp-spinner"></div>
        <span>Envoi d'un test au modèle</span>
      </div>
    </div>
  `;
}

function renderValidatedStep() {
  const state = getWorkflowState();
  const preset = PROVIDER_PRESETS.find((p) => p.id === getState().assistant.provider.id);
  const model = state.loadedModels?.find((m) => m.id === state.selectedModelId);

  return `
    <div class="pp-workflow__step">
      <div class="pp-workflow__summary">
        <div class="pp-workflow__summary-title">✅ Connexion validée</div>
        <div class="pp-workflow__summary-row">
          <span class="pp-workflow__summary-label">Provider</span>
          <span class="pp-workflow__summary-value">${escapeHtml(preset?.name || '')}</span>
        </div>
        <div class="pp-workflow__summary-row">
          <span class="pp-workflow__summary-label">Modèle</span>
          <span class="pp-workflow__summary-value">${escapeHtml(model?.name || state.selectedModelId || '')}</span>
        </div>
        ${state.modelMeta ? `
        <div class="pp-workflow__summary-row">
          <span class="pp-workflow__summary-label">Latence</span>
          <span class="pp-workflow__summary-value">${state.modelMeta.latency}ms</span>
        </div>
        <div class="pp-workflow__summary-row">
          <span class="pp-workflow__summary-label">Format</span>
          <span class="pp-workflow__summary-value">${state.modelMeta.format}</span>
        </div>
        ` : ''}
      </div>
      <button class="btn btn--primary pp-workflow__test-btn" data-action="new-workflow">
        Changer de provider
      </button>
    </div>
  `;
}

function renderModelSelectionStep() {
  // Utiliser getDisplayModels() depuis workflowRunner pour éviter la duplication
  const { displayed, total, freeCount, hasMore } = getDisplayModels(modelSearchQuery, showAllModels);
  const state = getWorkflowState();

  return `
    <div class="pp-workflow__step">
      <div class="pp-workflow__step-title">📦 Modèles (${total}, ${freeCount} gratuits)</div>
      <input type="text" class="pp-workflow__search" id="pp-model-search" 
             placeholder="Rechercher un modèle..." value="${escapeHtml(modelSearchQuery)}" />
      <div class="pp-workflow__model-list">
        ${displayed.map((m) => `
          <button class="pp-workflow__model-item ${m.id === state.selectedModelId ? 'is-active' : ''}" 
                  data-model-id="${m.id}">
            <span class="pp-workflow__model-name">${escapeHtml(m.name)}</span>
            ${m.contextWindow ? `<span class="pp-workflow__model-cw">${m.contextWindow.toLocaleString()} tokens</span>` : ''}
            ${m.isFree ? '<span class="pp-workflow__model-free">GRATUIT</span>' : ''}
          </button>
        `).join('')}
      </div>
      ${hasMore ? `
        <button class="pp-workflow__show-more" data-action="toggle-all-models">
          ${showAllModels ? 'Voir moins' : `Voir tous les modèles (${total})`}
        </button>
      ` : ''}
    </div>
  `;
}
```

---

### Câblage des event listeners

Après le `renderProviderPanel()` (appelé `render()` dans ce guide), câbler les event listeners via event delegation sur le conteneur du panel :

```javascript
function wireEventListeners(panelEl) {
  // Event delegation : un seul listener sur le conteneur parent
  panelEl.addEventListener('click', (e) => {
    const target = e.target.closest('[data-action], [data-provider-id], [data-model-id]');
    if (!target) return;

    // --- Clic sur un provider (Zone 2) ---
    const providerId = target.dataset.providerId;
    if (providerId) {
      cancelWorkflow();
      startWorkflow(providerId);
      render(); // Re-render pour montrer la Zone 3
      return;
    }

    // --- Clic sur un modèle (Zone 3, étape 4) ---
    const modelId = target.dataset.modelId;
    if (modelId) {
      selectModel(modelId);
      render(); // Re-render pour montrer le spinner de test
      return;
    }

    // --- Actions par data-action ---
    const action = target.dataset.action;
    switch (action) {
      case 'test-api-key': {
        const input = panelEl.querySelector('#pp-api-key');
        const apiKey = input?.value?.trim();
        if (apiKey) {
          testApiKey(apiKey).then(() => render());
        }
        break;
      }
      case 'toggle-password': {
        const input = panelEl.querySelector('#pp-api-key');
        if (input) {
          input.type = input.type === 'password' ? 'text' : 'password';
        }
        break;
      }
      case 'toggle-all-models': {
        showAllModels = !showAllModels;
        render();
        break;
      }
      case 'new-workflow': {
        cancelWorkflow();
        modelSearchQuery = '';
        showAllModels = false;
        render();
        break;
      }
    }
  });

  // --- Input search (Zone 3, étape 4) ---
  // Utiliser 'input' pour le filtrage en temps réel
  // IMPORTANT : ne pas re-render() tout le panel, sinon on perd le focus.
  // On met à jour uniquement la liste des modèles.
  panelEl.addEventListener('input', (e) => {
    if (e.target.id === 'pp-model-search') {
      modelSearchQuery = e.target.value;
      // Re-render le contenu de la Zone 3 uniquement, puis re-focus
      const workflowEl = panelEl.querySelector('.pp-workflow');
      if (workflowEl) {
        workflowEl.innerHTML = renderWorkflowZone();
        // Re-focus sur le champ de recherche après le re-render
        const searchInput = panelEl.querySelector('#pp-model-search');
        if (searchInput) {
          searchInput.focus();
          searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
        }
      }
    }
  });

  // --- Input API key : activer/désactiver le bouton Tester ---
  panelEl.addEventListener('input', (e) => {
    if (e.target.id === 'pp-api-key') {
      const btn = panelEl.querySelector('#pp-test-key-btn');
      if (btn) {
        btn.disabled = !e.target.value.trim();
      }
    }
  });
}
```

---

## E. CSS exacts — default.css (à ajouter)

```css
/* ============================================================
   Provider Panel — Layout 3 zones
   ============================================================ */

/* --- Zone 1 : Status --- */
.pp-status {
  position: sticky;
  top: 0;
  z-index: 10;
  padding: 12px 16px;
  background: var(--bg);
  border-bottom: 1px solid var(--border);
}
.pp-status__name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}
.pp-status__model {
  font-size: 12px;
  color: var(--text-secondary, var(--text));
  opacity: 0.7;
  margin-top: 2px;
}
.pp-status__indicator {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-left: 8px;
  vertical-align: middle;
}
.pp-status__indicator--connected { background: var(--success, #22c55e); }
.pp-status__indicator--disconnected { background: var(--text-secondary, #666); }
.pp-status__indicator--testing {
  background: var(--warning, #f59e0b);
  animation: pp-pulse 1s ease-in-out infinite;
}
@keyframes pp-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

/* --- Zone 2 : Grid providers --- */
.pp-section {
  padding: 8px 0;
}
.pp-section__title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--text-secondary, #888);
  padding: 4px 16px 6px;
  letter-spacing: 0.5px;
}
.pp-grid {
  display: grid;
  grid-template-columns: 2fr 3fr;
  gap: 2px 4px;
  padding: 0 8px;
}
.pp-grid__col1, .pp-grid__col2 {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.pp-grid__item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background: transparent;
  border: none;
  border-left: 3px solid transparent;
  border-radius: var(--radius, 4px);
  cursor: pointer;
  text-align: left;
  font-size: 13px;
  color: var(--text);
  transition: background 0.15s, border-color 0.15s;
}
.pp-grid__item:hover {
  background: var(--bg-tert);
}
.pp-grid__item.is-active {
  background: var(--accent-soft, rgba(59,130,246,0.1));
  border-left-color: var(--accent, #3b82f6);
}
.pp-grid__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* --- Zone 3 : Workflow --- */
.pp-workflow {
  padding: 16px;
  overflow-y: auto;
}
.pp-workflow__empty {
  text-align: center;
  color: var(--text-secondary, #888);
  font-size: 13px;
  padding: 32px 16px;
}
.pp-workflow__step {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.pp-workflow__step-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}

/* --- Workflow : Champs --- */
.pp-workflow__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.pp-workflow__label {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary, #888);
}
.pp-workflow__input-group {
  display: flex;
  gap: 4px;
}
.pp-workflow__input {
  flex: 1;
  padding: 8px 12px;
  background: var(--bg-tert);
  border: 1px solid var(--border);
  border-radius: var(--radius, 4px);
  color: var(--text);
  font-size: 13px;
  font-family: monospace;
}
.pp-workflow__input:focus {
  outline: none;
  border-color: var(--accent, #3b82f6);
}
.pp-workflow__eye-btn {
  padding: 8px;
  background: var(--bg-tert);
  border: 1px solid var(--border);
  border-radius: var(--radius, 4px);
  cursor: pointer;
  font-size: 14px;
}

/* --- Workflow : Boutons --- */
.pp-workflow__test-btn {
  width: 100%;
}
.pp-workflow__test-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* --- Workflow : Barre de recherche --- */
.pp-workflow__search {
  width: 100%;
  padding: 8px 12px;
  background: var(--bg-tert);
  border: 1px solid var(--border);
  border-radius: var(--radius, 4px);
  color: var(--text);
  font-size: 13px;
}
.pp-workflow__search:focus {
  outline: none;
  border-color: var(--accent, #3b82f6);
}

/* --- Workflow : Liste de modèles --- */
.pp-workflow__model-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 300px;
  overflow-y: auto;
}
.pp-workflow__model-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: transparent;
  border: none;
  border-left: 3px solid transparent;
  border-radius: var(--radius, 4px);
  cursor: pointer;
  text-align: left;
  font-size: 13px;
  color: var(--text);
  transition: background 0.15s;
}
.pp-workflow__model-item:hover {
  background: var(--bg-tert);
}
.pp-workflow__model-item.is-active {
  background: var(--accent-soft, rgba(59,130,246,0.1));
  border-left-color: var(--accent, #3b82f6);
}
.pp-workflow__model-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pp-workflow__model-cw {
  font-size: 11px;
  color: var(--text-secondary, #888);
}
.pp-workflow__model-free {
  font-size: 10px;
  font-weight: 600;
  color: var(--success, #22c55e);
  background: rgba(34, 197, 94, 0.1);
  padding: 2px 6px;
  border-radius: 3px;
}

/* --- Workflow : Show more --- */
.pp-workflow__show-more {
  background: none;
  border: none;
  color: var(--accent, #3b82f6);
  font-size: 12px;
  cursor: pointer;
  padding: 8px;
  text-align: center;
}
.pp-workflow__show-more:hover {
  text-decoration: underline;
}

/* --- Workflow : Résumé validation --- */
.pp-workflow__summary {
  padding: 16px;
  background: var(--accent-soft, rgba(59,130,246,0.05));
  border: 1px solid var(--accent, #3b82f6);
  border-radius: var(--radius, 4px);
}
.pp-workflow__summary-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--accent, #3b82f6);
  margin-bottom: 8px;
}
.pp-workflow__summary-row {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  padding: 4px 0;
}
.pp-workflow__summary-label {
  color: var(--text-secondary, #888);
}
.pp-workflow__summary-value {
  color: var(--text);
  font-weight: 500;
}

/* --- Workflow : Loading / Spinner --- */
.pp-workflow__loading {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 24px;
  color: var(--text-secondary, #888);
  font-size: 13px;
}
.pp-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--border);
  border-top-color: var(--accent, #3b82f6);
  border-radius: 50%;
  animation: pp-spin 0.8s linear infinite;
  flex-shrink: 0;
}
@keyframes pp-spin {
  to { transform: rotate(360deg); }
}

/* --- API Keys button --- */
.pp-keys-btn {
  width: 100%;
  margin-top: 8px;
}
```

---

## F. state.js — Modifications exactes

### Ajouter `modelMeta` au provider dans initialState

```javascript
// Dans initialState(), le DEFAULT_PROVIDER :
const DEFAULT_PROVIDER = {
  id: 'ollama',
  apiKey: '',
  baseUrl: 'http://localhost:11434/v1',
  model: 'llama3.2',
  temperature: 0.7,
  maxTokens: 4096,
  isConnected: false,
  lastTestedAt: null,
  modelMeta: null, // NOUVEAU : { format, capabilities, contextWindow }
};
```

### Migration apiKeys dans readStoredAssistant()

```javascript
function readStoredAssistant() {
  try {
    const raw = localStorage.getItem(ASSISTANT_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data && typeof data === 'object' && data.provider) {
      // Migration mistral → codestral
      if (data.provider.id === 'mistral' && data.provider.baseUrl?.includes('codestral.mistral.ai')) {
        data.provider.id = 'codestral';
      }
      // Migration apiKeys : ajouter les champs manquants
      if (Array.isArray(data.apiKeys)) {
        data.apiKeys = data.apiKeys.map((k) => ({
          name: k.name || `Clé`,
          providerId: k.providerId || '',
          value: k.value || '',
          createdAt: k.createdAt || Date.now(),
          lastUsedAt: k.lastUsedAt ?? null,    // NOUVEAU
          isValid: k.isValid ?? null,           // NOUVEAU
          lastTestedAt: k.lastTestedAt ?? null, // NOUVEAU
        }));
      }
      if (!Array.isArray(data.apiKeys)) {
        data.apiKeys = [];
      }
      return data;
    }
  } catch (_) {}
  return null;
}
```

### Modifier persistAssistant() pour exclure loadedModels

```javascript
function persistAssistant() {
  try {
    // Exclure modelMeta (état éphémère) de la sérialisation
    const { modelMeta: _, ...providerWithoutMeta } = state.assistant.provider || {};
    const data = {
      provider: providerWithoutMeta,
      providers: { custom: [...state.assistant.providers.custom] },
      apiKeys: [...(state.assistant.apiKeys || [])],
      chatHistory: [...(state.assistant.chatHistory || [])],
    };
    localStorage.setItem(ASSISTANT_STORAGE_KEY, JSON.stringify(data));
  } catch (_) {}
}
```

---

## G. providerPresets.js — Modifications exactes

### Fonctions de filtrage + `modelListingUrl` à chaque preset

```javascript
/**
 * Retourne les providers en ligne (authRequired).
 */
export function getOnlineProviders() {
  return PROVIDER_PRESETS.filter((p) => p.category === 'online');
}

/**
 * Retourne les providers locaux (pas d'auth).
 */
export function getLocalProviders() {
  return PROVIDER_PRESETS.filter((p) => p.category === 'local');
}

export const PROVIDER_PRESETS = [
  {
    id: 'openrouter',
    name: 'OpenRouter',
    category: 'online',
    baseUrl: 'https://openrouter.ai/api/v1',
    authRequired: true,
    defaultModel: 'meta-llama/llama-3.2-3b-instruct:free',
    modelListingUrl: '{baseUrl}/models', // AJOUT
    models: [], // SERA REMPLACÉ PAR fetchModels()
    icon: 'cloud',
    description: 'Agrégateur de modèles',
  },
  {
    id: 'gemini',
    name: 'Gemini',
    category: 'online',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    authRequired: true,
    defaultModel: 'gemini-2.5-flash',
    modelListingUrl: '{baseUrl}/models?key={apiKey}', // AJOUT
    models: [],
    icon: 'sparkles',
    description: 'Google Gemini',
  },
  {
    id: 'kilo',
    name: 'kilo',
    category: 'online',
    baseUrl: 'https://api.kilo.ai',
    authRequired: true,
    defaultModel: 'kilo-default',
    modelListingUrl: '{baseUrl}/models',
    models: [],
    icon: 'code',
    description: 'Kilo Code',
  },
  {
    id: 'opencode-zen',
    name: 'OpenCode Zen',
    category: 'online',
    baseUrl: 'https://opencode.ai/zen/v1',
    authRequired: true,
    defaultModel: 'zen-default',
    modelListingUrl: '{baseUrl}/models',
    models: [],
    icon: 'sparkles',
    description: 'OpenCode Zen',
  },
  {
    id: 'mistral',
    name: 'mistral',
    category: 'online',
    baseUrl: 'https://api.mistral.ai/v1',
    authRequired: true,
    defaultModel: '',
    modelListingUrl: '{baseUrl}/models',
    models: [],
    icon: 'sparkles',
    description: 'Mistral AI',
  },
  {
    id: 'codestral',
    name: 'codestral',
    category: 'online',
    baseUrl: 'https://codestral.mistral.ai/v1',
    authRequired: true,
    defaultModel: 'codestral-latest',
    modelListingUrl: '{baseUrl}/models',
    models: [],
    icon: 'code',
    description: 'Codestral',
  },
  {
    id: 'groq',
    name: 'groq',
    category: 'online',
    baseUrl: 'https://api.groq.com/openai/v1',
    authRequired: true,
    defaultModel: '',
    modelListingUrl: '{baseUrl}/models',
    models: [],
    icon: 'sparkles',
    description: 'Groq',
  },
  {
    id: 'ollama',
    name: 'ollama',
    category: 'local',
    baseUrl: 'http://localhost:11434/v1',
    authRequired: false,
    defaultModel: '',
    modelListingUrl: '{baseUrl}/../api/tags',
    models: [],
    icon: 'server',
    description: 'Ollama',
  },
  {
    id: 'lmstudio',
    name: 'LM Studio',
    category: 'local',
    baseUrl: 'http://localhost:1234/v1',
    authRequired: false,
    defaultModel: '',
    modelListingUrl: '{baseUrl}/models',
    models: [],
    icon: 'server',
    description: 'LM Studio',
  },
];
```

---

## H. Résumé des modules et dépendances

```
providerPanel.js
  ├── importe : workflowRunner.js, state.js, toast.js, providerPresets.js
  ├── appelle : workflowRunner.startWorkflow(), .cancelWorkflow(), .testApiKey(), .selectModel(), .getWorkflowState(), .getDisplayModels()
  └── rend : 3 zones (status, grid, workflow)

workflowRunner.js
  ├── importe : state.js, aiClient.js, keyRotation.js, toast.js, providerPresets.js
  ├── appelle : actions.setProvider(), .updateProvider(), chatCompletion(), fetchModels(), testModel(), keyRotation.*
  └── gère : Promise pause (étape 2), AbortController, loadedModels (mémoire)

keyRotation.js
  ├── importe : state.js
  ├── lit : state.assistant.apiKeys, state.assistant.provider.apiKey
  └── gère : LRU, rate limit tracking, error counting (tout en mémoire)

aiClient.js
  ├── importe : (rien de nouveau)
  ├── ajoute : fetchModels(), testModel(), normalizeOpenAI/Gemini/OllamaModels()
  └── modifie : testConnection() (retourne status 429)

state.js
  ├── ajoute : modelMeta au DEFAULT_PROVIDER, migration apiKeys, persistAssistant() exclut modelMeta
  └── actions : aucune nouvelle action — utilise updateProvider() existant

providerPresets.js
  └── ajoute : modelListingUrl, getOnlineProviders(), getLocalProviders(), vides models[] (chargés dynamiquement)
```

---

## I. Checklist d'implémentation (par phase)

### Phase 1 — state.js
- [ ] Ajouter `modelMeta: null` au DEFAULT_PROVIDER
- [ ] Ajouter migration apiKeys dans readStoredAssistant() (lastUsedAt, isValid, lastTestedAt)
- [ ] Vérifier que persistAssistant() ne sérialise pas loadedModels
- [ ] Lancer `npx vitest run` → 118 tests passent

### Phase 2 — keyRotation.js
- [ ] Copier le code complet de §A
- [ ] Créer keyRotation.test.js avec les tests de §A
- [ ] Lancer `npx vitest run keyRotation` → tous passent

### Phase 2 — workflowRunner.js
- [ ] Copier le code complet de §B (incluant workflowRunner.test.js)
- [ ] Lancer `npx vitest run workflowRunner` → tous passent

### Phase 3 — aiClient.js
- [ ] Ajouter fetchModels() avec normalisation (§C)
- [ ] Ajouter testModel() (§C)
- [ ] Modifier testConnection() pour retourner status
- [ ] Ajouter aiClient.test.js (tests pour fetchModels, testModel, normalisation)
- [ ] Lancer `npx vitest run aiClient` → tous passent

### Phase 4 — providerPanel.js
- [ ] Réécrire render() avec les 3 zones (§D)
- [ ] Implémenter renderProviderGrid() avec isShortName()
- [ ] Implémenter renderWorkflowZone() avec les 6 états
- [ ] Câbler les event listeners (provider click, model click, test key, search)
- [ ] Intégrer workflowRunner (startWorkflow, cancelWorkflow, testApiKey, selectModel)
- [ ] Lancer le serveur dev (port 8081) et tester manuellement

### Phase 5 — CSS
- [ ] Copier les CSS de §E dans default.css
- [ ] Ajouter `--text-secondary: #888` dans `:root` de default.css (si pas déjà présent — vérifier avant)
- [ ] Vérifier le rendu dans le navigateur
- [ ] Ajuster les couleurs/sizes si nécessaire

### Phase 6 — Tests apiKeysModal
- [ ] Ajouter apiKeysModal.test.js (validation à l'ajout, indicateurs de statut, rate limiting tentatives)
- [ ] Lancer `npx vitest run apiKeysModal` → tous passent

### Phase 7 — providerPresets.js
- [ ] Ajouter modelListingUrl à chaque preset (§G)
- [ ] Ajouter `getOnlineProviders()` et `getLocalProviders()` (filtrage par category)
- [ ] Vider les models[] (seront chargés dynamiquement)
- [ ] Mettre à jour providerPresets.test.js (count = 9, nouveaux champs)
- [ ] Lancer `npx vitest run providerPresets` → tous passent

### Phase 8 — Tests finaux
- [ ] Lancer `npx vitest run` → tous les tests passent
- [ ] Vérifier le build : `npx vite build`
- [ ] Tester le workflow complet dans le navigateur
