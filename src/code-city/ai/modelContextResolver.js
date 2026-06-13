/**
 * modelContextResolver — Résolveur de fenêtre de contexte d'un modèle
 *
 * Combine 5 sources de CW en cascade (de la plus fiable à la moins fiable) :
 *   1. Valeur API explicite (passée par le caller, ex: inputTokenLimit Gemini)
 *   2. Table de référence (model-context-windows.json) — match exact
 *   3. Table de référence — match par pattern (ex: "gpt-4o" → 128000)
 *   4. Provider default (champ defaultContextWindow du provider-configs.json)
 *   5. Fallback dur : 4096
 *
 * Pourquoi cette cascade : aucun provider ne retourne la CW de manière
 * cohérente dans son endpoint de listing. Gemini la met dans
 * `inputTokenLimit`, OpenRouter nécessite un appel par modèle à
 * `/api/v1/models/{id}`, Ollama à `/api/show`, et LM Studio/Mistral/Groq
 * ne l'exposent pas du tout. Cette cascade garantit qu'on a TOUJOURS
 * une CW utilisable, même quand l'API n'en donne pas.
 *
 * Le resolver est utilisé par :
 *   - normalizeGeminiModels / normalizeOllamaModels / normalizeOpenAIModels
 *     (aiClient.js) — pour enrichir le listing de modèles
 *   - PromptEngine.detectContextWindow (promptEngine.js) — fallback
 *   - getEligiblePrepProviders (providerPanel.js) — filtre strict
 *
 * @module modelContextResolver
 */

import { getPreset } from './providerLoader.js';
import modelContextWindows from '../data/model-context-windows.json';

// Garde en mémoire les résultats de lookup par modèle pour éviter de
// re-calculer plusieurs fois la même résolution (perf + cohérence).
// Clé : `${providerId}:${modelId}`. Reset au reload de la page.
const _resolutionCache = new Map();

/**
 * Résout la fenêtre de contexte d'un modèle avec cascade de fallbacks.
 *
 * @param {Object} args
 * @param {string} args.modelId - ID du modèle (ex: "gemini-2.5-flash")
 * @param {string} [args.providerId] - ID du provider (pour fallback)
 * @param {number|null} [args.apiValue] - Valeur retournée par l'API (optionnel)
 * @param {boolean} [args.useCache=true] - Utiliser le cache in-memory
 * @returns {number} Fenêtre de contexte en tokens (jamais null, minimum 4096)
 */
export function resolveContextWindow({ modelId, providerId = null, apiValue = null, useCache = true } = {}) {
  // Clé de cache (provider optionnel : on inclut dans la clé pour gérer
  // les collisions de modelId entre providers, ex: "gpt-4" chez OpenAI vs OpenRouter)
  const cacheKey = `${providerId || ''}:${modelId || ''}:${apiValue || 'null'}`;

  if (useCache && _resolutionCache.has(cacheKey)) {
    return _resolutionCache.get(cacheKey);
  }

  const result = _resolveUncached({ modelId, providerId, apiValue });

  if (useCache) {
    _resolutionCache.set(cacheKey, result);
  }
  return result;
}

/**
 * Version non-cached de resolveContextWindow (pour les tests).
 */
export function _resolveUncached({ modelId, providerId, apiValue }) {
  // 1. Valeur API explicite (la plus fiable)
  if (Number.isFinite(apiValue) && apiValue > 0) {
    return apiValue;
  }

  if (!modelId || typeof modelId !== 'string') {
    return _fallback(providerId);
  }

  // 2. Table de référence — match exact (case-insensitive)
  // L'API peut renvoyer "models/gemini-2.5-flash" ou "gemini-2.5-flash" —
  // on normalise en retirant le préfixe "models/" pour Gemini.
  const normalizedId = _normalizeModelId(modelId, providerId);
  const exact = modelContextWindows.exact[normalizedId];
  if (exact) {
    return exact;
  }

  // 3. Table de référence — match par pattern (case-insensitive includes)
  // On itère sur les patterns triés par ordre de déclaration (les plus
  // spécifiques sont déclarés en premier dans le JSON).
  const lowerId = normalizedId.toLowerCase();
  for (const [pattern, cw] of Object.entries(modelContextWindows.patterns)) {
    if (lowerId.includes(pattern)) {
      return cw;
    }
  }

  // 4. Provider default
  return _fallback(providerId);
}

/**
 * Fallback : provider default → 4096.
 */
function _fallback(providerId) {
  if (providerId) {
    // 1. Champ defaultContextWindow du provider-configs.json (priorité max pour le fallback)
    const providerDefault = modelContextWindows.providerDefaults?.[providerId];
    if (Number.isFinite(providerDefault) && providerDefault > 0) {
      return providerDefault;
    }
    // 2. Champ defaultContextWindow du preset (au cas où provider-configs.json n'est pas chargé)
    const preset = getPreset(providerId);
    if (preset?.defaultContextWindow) {
      return preset.defaultContextWindow;
    }
  }
  return 4096;
}

/**
 * Normalise un modelId pour le matching (retire les préfixes provider-spécifiques).
 * Ex: "models/gemini-2.5-flash" → "gemini-2.5-flash" pour Gemini.
 *     "openai/gpt-4o" → "gpt-4o" pour OpenRouter.
 */
function _normalizeModelId(modelId, providerId) {
  let id = modelId;

  // Gemini retourne les modèles avec préfixe "models/" dans /v1beta/models
  if (providerId === 'gemini' && id.startsWith('models/')) {
    id = id.slice('models/'.length);
  }

  // OpenRouter retourne les modèles avec préfixe "{provider}/" (ex: "openai/gpt-4o")
  if (providerId === 'openrouter' && id.includes('/')) {
    const slashIdx = id.indexOf('/');
    // Si le préfixe ressemble à un provider connu (lettres minuscules + tirets),
    // on le retire. Sinon, on garde (ex: "nousresearch/hermes-3-70b" est le modelId réel).
    const prefix = id.slice(0, slashIdx);
    if (/^[a-z][a-z0-9-]*$/.test(prefix) && prefix !== 'meta' && prefix !== 'mistralai') {
      // Préfixe type "openai" / "anthropic" / "google" → à retirer
      // MAIS on garde les préfixes type "meta-llama" / "mistralai" qui sont des
      // préfixes OpenRouter valides (le modelId complet est nécessaire)
      const KNOWN_PROVIDER_PREFIXES = ['openai', 'anthropic', 'google', 'cohere', 'meta-llama'];
      if (KNOWN_PROVIDER_PREFIXES.includes(prefix)) {
        id = id.slice(slashIdx + 1);
      }
    }
  }

  return id.toLowerCase();
}

/**
 * Vide le cache de résolution (utile pour les tests).
 * @internal
 */
export function _clearResolutionCache() {
  _resolutionCache.clear();
}

/**
 * Expose la table de référence pour les tests.
 * @internal
 */
export function _getModelContextWindowsTable() {
  return modelContextWindows;
}
