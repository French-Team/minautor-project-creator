/**
 * Provider Presets — Constantes pour les providers IA supportés
 *
 * Source unique de vérité pour la configuration des providers.
 * Utilisé par providerPanel.js (UI) et aiClient.js (appels API).
 *
 * Providers en ligne : OpenRouter, Gemini, Kilo, OpenCode Zen, Mistral/Codestral, Groq
 * Providers locaux   : Ollama, LM Studio
 */

export const PROVIDER_PRESETS = [
  // --- En ligne ---
  {
    id: 'openrouter',
    name: 'OpenRouter',
    category: 'online',
    baseUrl: 'https://openrouter.ai/api/v1',
    authRequired: true,
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
    baseUrlFormat: 'custom',
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
    name: 'Mistral AI',
    category: 'online',
    baseUrl: 'https://api.mistral.ai/v1',
    authRequired: true,
    defaultModel: 'mistral-large-latest',
    models: [
      { id: 'mistral-large-latest', name: 'Mistral Large', contextWindow: 128000 },
      { id: 'mistral-small-latest', name: 'Mistral Small', contextWindow: 32000 },
      { id: 'open-mistral-7b', name: 'Mistral 7B (gratuit)', contextWindow: 32000 },
    ],
    icon: 'sparkles',
    description: 'Mistral AI — modèles généralistes via api.mistral.ai.',
  },
  {
    id: 'codestral',
    name: 'Codestral',
    category: 'online',
    baseUrl: 'https://codestral.mistral.ai/v1',
    authRequired: true,
    defaultModel: 'codestral-latest',
    models: [
      { id: 'codestral-latest', name: 'Codestral (dernière version)', contextWindow: 32000 },
      { id: 'codestral-2501', name: 'Codestral 2501', contextWindow: 32000 },
    ],
    icon: 'code',
    description: 'Codestral — modèle Mistral optimisé pour le code + FIM.',
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
    models: [],
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
    models: [],
    icon: 'server',
    description: 'Interface GUI pour gérer et exécuter des modèles locaux.',
  },
];

/** Retourne uniquement les providers en ligne. */
export function getOnlineProviders() {
  return PROVIDER_PRESETS.filter((p) => p.category === 'online');
}

/** Retourne uniquement les providers locaux. */
export function getLocalProviders() {
  return PROVIDER_PRESETS.filter((p) => p.category === 'local');
}
