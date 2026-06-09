/**
 * Prompt Engine — Service de préparation dynamique des prompts
 *
 * Analyse la demande utilisateur, catégorise, compose ou réutilise
 * un prompt spécialisé, et le rend disponible pour le modèle de chat.
 *
 * Provider cible : Local (Ollama / LM Studio) — pas de limite de crédit
 *
 * @module promptEngine
 */

import { getState, actions } from '../state.js';
import { getPreset } from './providerLoader.js';
import { toLocalUrl } from './aiClient.js';
import { estimateTokens } from './chatHistory.js';

/* --------------------------------------------------------------------------
 * Types
 * -------------------------------------------------------------------------- */

/**
 * @typedef {'analysis'|'suggestion'|'documentation'|'enrichment'|'architecture'|'conversation'} PromptType
 */

/**
 * @typedef {Object} PreparedPrompt
 * @property {string} id
 * @property {PromptType} type
 * @property {string} userMessage
 * @property {string} prompt
 * @property {{ nodeCount: number, edgeCount: number, selectedNodes: string[], canvasSummary: string, contextHash: string }} context
 * @property {boolean} cached
 * @property {number} timestamp
 * @property {string} filePath
 * @property {number} duration
 */

/* --------------------------------------------------------------------------
 * Constantes
 * -------------------------------------------------------------------------- */

/** @type {Record<string, number>} */
const MODEL_CONTEXT_WINDOWS = {
  'llama3.2:3b': 8192,
  'llama3.2:1b': 8192,
  'llama3.1:8b': 128000,
  'llama3.1:70b': 128000,
  'llama3.1:405b': 128000,
  'llama3:8b': 8192,
  'mistral:7b': 8192,
  'mistral-nemo:12b': 128000,
  'mixtral:8x7b': 32768,
  'mixtral:8x22b': 65536,
  'qwen2.5:7b': 32768,
  'qwen2.5:14b': 32768,
  'qwen2.5:32b': 32768,
  'qwen2.5:72b': 32768,
  'deepseek-coder:6.7b': 16384,
  'deepseek-coder:33b': 16384,
  'deepseek-r1:7b': 16384,
  'codestral:22b': 32000,
  'phi3:14b': 4096,
  'phi3:mini': 4096,
  'phi3:medium': 128000,
  default: 4096,
};

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/** Délai maximum pour la détection de contexte */
const CONTEXT_DETECT_TIMEOUT = 5000;

/** Seuil d'optimisation par défaut (en tokens) */
export const DEFAULT_OPTIMIZATION_THRESHOLD = 500;

/** Seuil minimum de tokens pour déclencher l'amélioration du prompt via API (en tokens) */
const MIN_ENHANCEMENT_TOKENS = 100;

/** Prompt d'optimisation système */
const OPTIMIZATION_SYSTEM_PROMPT = `Tu es un assistant spécialisé dans l'optimisation de texte. Tu reçois une réponse générée par un autre modèle. Ta mission : réécrire cette réponse pour qu'elle soit PLUS CONCISE, tout en conservant TOUTES les informations importantes.

Règles :
- Supprime les formules de politesse et les introductions
- Condense les listes et les exemples
- Fusionne les phrases redondantes
- Garde les données chiffrées, les noms, les types précis
- Ne change pas le ton ni le format (Markdown)
- Réponds UNIQUEMENT avec le texte optimisé, sans commentaire`;

/** Prompt d'amélioration système pour la préparation de prompt via API */
const ENHANCEMENT_SYSTEM_PROMPT = `Tu es un expert en ingénierie de prompts. Tu reçois un prompt système conçu pour un assistant de conception de projet. Améliore-le pour le rendre PLUS CLAIR, PLUS STRUCTURÉ et PLUS EFFICACE.

Règles :
- Conserve l'intention et le contexte originaux
- Améliore la clarté des instructions
- Structure les consignes de manière logique
- Ajoute des exemples concrets si pertinent
- Rend les attentes plus explicites
- Ne change PAS le format de sortie attendu (Markdown)
- Ne supprime AUCUNE information du contexte du canvas
- Réponds UNIQUEMENT avec le prompt amélioré, sans commentaire ni introduction`;

/* --------------------------------------------------------------------------
 * Templates de prompts par catégorie
 * -------------------------------------------------------------------------- */

/**
 * Templates de base pour chaque type de prompt.
 * Incluent des marqueurs {context} qui seront remplacés par le canvas context.
 * @type {Record<PromptType, string>}
 */
const PROMPT_TEMPLATES = {
  analysis: `Tu es un expert en analyse de projets logiciels. Analyse le canvas ci-dessous et identifie :

1. **Points forts** de la structure actuelle
2. **Problèmes potentiels** : dépendances manquantes, incohérences, risques
3. **Améliorations suggérées** : nœuds à ajouter, connexions à créer

Contexte du canvas :
{context}

Sois précis : cite les noms des nœuds et donne des recommandations concrètes.`,

  suggestion: `Tu es un assistant de conception de projet. En te basant sur le canvas ci-dessous, suggère des nœuds pertinents à ajouter.

Contexte du canvas :
{context}

Pour chaque suggestion, donne :
- **Type** : le type de nœud (process, service-api, component-form, etc.)
- **Label** : nom court et descriptif
- **Description** : une phrase expliquant son rôle
- **Connexions** : avec quels nœuds existants il devrait être relié

Priorise les suggestions qui complètent logiquement le projet.`,

  documentation: `Tu es un rédacteur technique. Génère de la documentation structurée en Markdown à partir du canvas ci-dessous.

Contexte du canvas :
{context}

Structure la documentation ainsi :
## Vue d'ensemble
## Composants
## Flux et dépendances
## Décisions architecturales

Sois clair et concis. Utilise des tableaux pour les listes de nœuds.`,

  enrichment: `Tu es un expert métier spécialisé dans l'enrichissement de données de projet. Pour le(s) nœud(s) suivant(s), propose des valeurs pertinentes pour leurs propriétés.

Contexte du canvas :
{context}

Pour chaque propriété, propose une valeur concrète et réaliste. Si une propriété est déjà remplie, suggère une amélioration si pertinent.`,

  architecture: `Tu es un architecte logiciel senior. Analyse la structure architecturale du canvas ci-dessous.

Contexte du canvas :
{context}

Dans ton analyse, aborde :
1. **Style architectural** détecté (monolithique, microservices, event-driven, etc.)
2. **Forces** de l'architecture actuelle
3. **Faiblesses et risques**
4. **Recommandations** pour améliorer la résilience, la scalabilité et la maintenabilité

Utilise des termes techniques précis mais reste accessible.`,

  conversation: `Tu es Mina, un assistant amical et serviable. Réponds de manière naturelle et concise à l'utilisateur. Tu peux l'aider à concevoir son projet, mais tu peux aussi simplement discuter.

Si l'utilisateur te demande quelque chose qui sort du cadre de la conception de projet, répond poliment mais redirige vers le sujet principal.`,
};

/* --------------------------------------------------------------------------
 * Catégorisation locale (mots-clés / regex)
 * -------------------------------------------------------------------------- */

/**
 * Règles de catégorisation par mots-clés.
 * Chaque règle associe un pattern (regex) à un type de prompt.
 * Ordre = priorité (première règle qui match gagne).
 * @type {Array<{ pattern: RegExp, type: PromptType }>}
 */
const CATEGORIZATION_RULES = [
  // Architecture
  { pattern: /architectur|pattern|style\s*archi|clean\s*arch|hexagonal|microservice|event.driven|ddd|layered|monolith/i, type: 'architecture' },
  { pattern: /conception|design|structure\s*(globale|generale)|organisation/i, type: 'architecture' },
  { pattern: /schema\s*archi|schema\s*global|vision\s*archi/i, type: 'architecture' },

  // Analyse
  { pattern: /analyse|analyser|evalue|evaluation|diagnostic|audit/i, type: 'analysis' },
  { pattern: /probleme|risque|amelioration|point\s*faible|faiblesse|force|amélioration/i, type: 'analysis' },
  { pattern: /review|revue|inspect|verifie|vérifie|controle|contrôle/i, type: 'analysis' },
  { pattern: /que\s*penses.tu|avis|opinion|conseil|recommande/i, type: 'analysis' },

  // Suggestion
  { pattern: /sugger|suggère|propose|ajout|recommande|idee|idée|nouveau\s*noeud|nouveau\s*nœud|ajouter/i, type: 'suggestion' },
  { pattern: /completer|compléter|manque|missing|ajout\s*de/i, type: 'suggestion' },
  { pattern: /quoi\s*ajouter|que\s*dois.je|besoin\s*de/i, type: 'suggestion' },

  // Documentation
  { pattern: /document|documentation|export|generer|générer|markdown|readme|rapport|report/i, type: 'documentation' },
  { pattern: /resume|résumé|synthese|synthèse|sommaire|tableau|table/i, type: 'documentation' },
  { pattern: /ecris|écris|redige|rédige|produis/i, type: 'documentation' },

  // Enrichissement
  { pattern: /enrichir|enrichi|propriete|propriété|champ|valeur|metadata|méta|complète/i, type: 'enrichment' },
  { pattern: /noeud\s*sélectionné|nœud\s*sélectionné|selection|sélection|node\s*selected|selected\s*node/i, type: 'enrichment' },
  { pattern: /complete\s*les\s*infos|remplir|renseigner/i, type: 'enrichment' },

  // Conversation (fallback : dernier recours)
  // Si rien d'autre n'a matché, c'est une conversation
];

/**
 * Message court (salutation) → conversation directe
 * @type {RegExp[]}
 */
const SHORT_GREETING_PATTERNS = [
  /^(bonjour|salut|coucou|hello|hi|hey|yo)\b/i,
  /^(merci|thanks|thank)\b/i,
  /^(oui|non|ok|d'accord|daccord|super|génial|genial|parfait)\s*$/i,
  /^comment\s*(vas|va)\s*tu/i,
  /^(ca\s*va|ça\s*va)\??$/i,
];

/* --------------------------------------------------------------------------
 * Hash de contexte
 * -------------------------------------------------------------------------- */

/**
 * Calcule un hash déterministe du canvas pour la clé de cache.
 * @param {Array} nodes
 * @param {Array} edges
 * @returns {string}
 */
export function hashContext(nodes, edges) {
  const summary = [
    (nodes || [])
      .filter(n => n.type !== 'hub')
      .map(n => `${n.type}:${n.label || ''}:${n.priority || 'medium'}`)
      .sort()
      .join('|'),
    (edges || [])
      .map(e => `${e.from}:${e.to}:${e.label || ''}`)
      .sort()
      .join('|'),
  ].join('::');

  let hash = 0;
  for (let i = 0; i < summary.length; i++) {
    hash = ((hash << 5) - hash) + summary.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

/* --------------------------------------------------------------------------
 * Helpers
 * -------------------------------------------------------------------------- */

/**
 * Génère un identifiant unique pour un prompt préparé.
 * @param {PromptType} type
 * @returns {string}
 */
function generatePromptId(type) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `${ts}-${type}`;
}

/**
 * Construit le résumé du canvas pour les templates.
 * @param {Array} nodes
 * @param {Array} edges
 * @param {string[]} [selectedNodeIds]
 * @returns {object}
 */
function buildCanvasContext(nodes, edges, selectedNodeIds = []) {
  const realNodes = (nodes || []).filter(n => n.type !== 'hub');
  const selectedNodes = selectedNodeIds.length > 0
    ? realNodes.filter(n => selectedNodeIds.includes(n.id))
    : [];

  const summary = [
    '## Contexte du canvas',
    '',
    `- **${realNodes.length} nœuds**, **${(edges || []).length} arêtes**`,
    '',
    '### Nœuds',
    ...realNodes.map(n => {
      const desc = n.description ? `: ${n.description.slice(0, 80)}` : '';
      return `- [${n.type}] ${n.label || n.id}${desc}`;
    }),
    '',
    '### Connexions',
    ...(edges || []).map(e => {
      const from = realNodes.find(n => n.id === e.from);
      const to = realNodes.find(n => n.id === e.to);
      return `- ${from?.label || e.from} → ${to?.label || e.to}`;
    }),
  ];

  let selectedInfo = '';
  if (selectedNodes.length > 0) {
    selectedInfo = [
      '',
      '### Nœud(s) sélectionné(s)',
      ...selectedNodes.map(n => {
        const props = n.properties && Object.keys(n.properties).length > 0
          ? `\n  Propriétés : ${JSON.stringify(n.properties)}`
          : '';
        return `- **${n.label || n.id}** (${n.type})${props}`;
      }),
    ].join('\n');
  }

  const result = {
    summary: summary.join('\n'),
    selectedInfo,
    nodeCount: realNodes.length,
    edgeCount: (edges || []).length,
    selectedNodes: selectedNodes.map(n => ({
      id: n.id,
      label: n.label,
      type: n.type,
      properties: n.properties || {},
    })),
  };

  return result;
}

/**
 * Formatte le contexte canvas pour injection dans les templates.
 * @param {object} ctx - Résultat de buildCanvasContext()
 * @param {PromptType} type
 * @returns {string}
 */
function formatContextForTemplate(ctx, type) {
  let text = ctx.summary;

  if (type === 'enrichment' && ctx.selectedNodes.length > 0) {
    text += ctx.selectedInfo;
  }

  return text;
}

/* --------------------------------------------------------------------------
 * PromptEngine
 * -------------------------------------------------------------------------- */

export class PromptEngine {
  /**
   * @param {Object} [options]
   * @param {number} [options.cacheTTL] - Durée de vie du cache (ms)
   */
  constructor(options = {}) {
    /** @type {PreparedPrompt|null} */
    this._current = null;

    /** @type {PreparedPrompt[]} */
    this._history = [];

    /** @type {Map<string, { prompt: PreparedPrompt, expiresAt: number }>} */
    this._cache = new Map();

    /** @type {number} */
    this._cacheTTL = options.cacheTTL || CACHE_TTL_MS;

    /** @type {number} */
    this._contextWindow = 4096; // Valeur par défaut, sera détectée

    /** @type {boolean} */
    this._contextDetected = false;
  }

  /* ----- Getters ----- */

  /**
   * Retourne le prompt préparé actuel.
   * @returns {PreparedPrompt|null}
   */
  getCurrentPrompt() {
    return this._current;
  }

  /**
   * Retourne l'historique des prompts préparés.
   * @returns {PreparedPrompt[]}
   */
  getPromptHistory() {
    return [...this._history];
  }

  /**
   * Retourne la fenêtre de contexte détectée.
   * @returns {number}
   */
  getContextWindow() {
    return this._contextWindow;
  }

  /* ----- Cache ----- */

  /**
   * Vide le cache mémoire.
   */
  clearCache() {
    this._cache.clear();
  }

  /**
   * Nettoie les entrées expirées du cache.
   */
  _pruneCache() {
    const now = Date.now();
    for (const [key, entry] of this._cache) {
      if (now > entry.expiresAt) {
        this._cache.delete(key);
      }
    }
  }

  /**
   * Récupère un prompt du cache si valide.
   * @param {string} cacheKey
   * @returns {PreparedPrompt|null}
   */
  _getFromCache(cacheKey) {
    this._pruneCache();
    const entry = this._cache.get(cacheKey);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this._cache.delete(cacheKey);
      return null;
    }
    return entry.prompt;
  }

  /**
   * Stocke un prompt dans le cache.
   * @param {string} cacheKey
   * @param {PreparedPrompt} prompt
   */
  _setCache(cacheKey, prompt) {
    this._cache.set(cacheKey, {
      prompt,
      expiresAt: Date.now() + this._cacheTTL,
    });
  }

  /* ----- Détection de contexte ----- */

  /**
   * Détecte la fenêtre de contexte du modèle local.
   * @param {Object} provider
   * @param {string} modelId
   * @returns {Promise<number>}
   */
  static async detectContextWindow(provider, modelId) {
    if (!modelId) return 4096;

    // 1. Essayer l'API Ollama /api/show
    if (provider?.id === 'ollama' && provider?.baseUrl) {
      try {
        const apiUrl = provider.baseUrl.replace('/v1', '').replace(/\/$/, '');
        const proxiedUrl = toLocalUrl(apiUrl, provider.id) + '/api/show';
        const resp = await fetch(proxiedUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: modelId }),
          signal: AbortSignal.timeout(CONTEXT_DETECT_TIMEOUT),
        });
        if (resp.ok) {
          const data = await resp.json();
          // Chercher context_length dans modelfile_info ou modelfile
          if (data.modelfile_info?.context_length) {
            return parseInt(data.modelfile_info.context_length, 10);
          }
          if (data.modelfile) {
            const match = data.modelfile.match(/num_ctx\s+(\d+)/);
            if (match) return parseInt(match[1], 10);
          }
        }
      } catch {
        // Fallback silencieux
      }
    }

    // 2. Table de correspondance connue
    for (const [pattern, ctx] of Object.entries(MODEL_CONTEXT_WINDOWS)) {
      if (modelId.toLowerCase().includes(pattern)) return ctx;
    }

    // 3. Valeur par défaut
    return 4096;
  }

  /**
   * Initialise la détection de contexte et met à jour le state.
   * @param {Object} provider
   * @returns {Promise<number>}
   */
  async initContextWindow(provider) {
    if (this._contextDetected) return this._contextWindow;

    const modelId = provider?.model || '';
    this._contextWindow = await PromptEngine.detectContextWindow(provider, modelId);
    this._contextDetected = true;

    // Mettre à jour le state
    if (typeof actions?.setContextWindow === 'function') {
      actions.setContextWindow(this._contextWindow);
    }

    return this._contextWindow;
  }

  /* ----- Catégorisation ----- */

  /**
   * Catégorise un message utilisateur en PromptType.
   * Utilise les règles locales (mots-clés / regex) — zéro appel API.
   * @param {string} message
   * @returns {PromptType}
   */
  categorizeMessage(message) {
    if (!message || typeof message !== 'string') return 'conversation';

    const trimmed = message.trim();

    // Salutations courtes → conversation
    for (const pattern of SHORT_GREETING_PATTERNS) {
      if (pattern.test(trimmed)) return 'conversation';
    }

    // Parcourir les règles par ordre de priorité
    for (const rule of CATEGORIZATION_RULES) {
      if (rule.pattern.test(trimmed)) return rule.type;
    }

    // Fallback
    return 'conversation';
  }

  /* ----- Composition de prompt ----- */

  /**
   * Compose un prompt à partir d'un template et du contexte canvas.
   * @param {PromptType} type
   * @param {object} canvasCtx
   * @returns {string}
   */
  composePrompt(type, canvasCtx) {
    const template = PROMPT_TEMPLATES[type] || PROMPT_TEMPLATES.conversation;
    const contextText = formatContextForTemplate(canvasCtx, type);
    return template.replace('{context}', contextText);
  }

  /* ----- Préparation ----- */

  /**
   * Analyse la demande et prépare (ou réutilise) un prompt spécialisé.
   *
   * @param {string} userMessage - Message de l'utilisateur
   * @param {{ nodes: Array, edges: Array }} graph - État du canvas
   * @param {Object} [options]
   * @param {string[]} [options.selectedNodeIds]
   * @param {boolean} [options.forceRefresh=false] - Ignorer le cache
   * @returns {Promise<PreparedPrompt>}
   */
  async preparePrompt(userMessage, graph, options = {}) {
    const { selectedNodeIds = [], forceRefresh = false } = options;
    const startTime = Date.now();

    // 1. Catégoriser localement
    const type = this.categorizeMessage(userMessage);
    const canvasCtx = buildCanvasContext(graph.nodes, graph.edges, selectedNodeIds);

    // 2. Vérifier le cache (sauf si force refresh)
    if (!forceRefresh) {
      const cHash = hashContext(graph.nodes, graph.edges);
      const cacheKey = `${type}-${cHash}`;
      const cached = this._getFromCache(cacheKey);
      if (cached) {
        // Mettre à jour le message utilisateur (le contexte canvas est identique)
        cached.userMessage = userMessage;
        cached.cached = true;
        this._current = cached;
        return cached;
      }
    }

    // 3. Composer le prompt (localement, pas d'appel API)
    let prompt = this.composePrompt(type, canvasCtx);
    let apiEnhanced = false;
    let originalPrompt = null;

    // 3b. Améliorer le prompt via l'API si un modèle de préparation est configuré
    //     et que le type n'est pas une simple conversation
    if (type !== 'conversation') {
      const state = getState();
      const provider = state.assistant?.provider;
      const hasPreparationModel = provider?.preparationModel &&
        typeof provider.preparationModel === 'string' &&
        provider.preparationModel.length > 0;

      if (hasPreparationModel) {
        originalPrompt = prompt;
        const enhanced = await this._enhancePromptViaApi(prompt);
        if (enhanced) {
          prompt = enhanced;
          apiEnhanced = true;
        }
      }
    }

    // 4. Construire l'objet PreparedPrompt
    const cHash = hashContext(graph.nodes, graph.edges);
    const prepared = {
      id: generatePromptId(type),
      type,
      userMessage,
      prompt,
      context: {
        nodeCount: canvasCtx.nodeCount,
        edgeCount: canvasCtx.edgeCount,
        selectedNodes: canvasCtx.selectedNodes.map(n => n.id),
        canvasSummary: canvasCtx.summary,
        contextHash: cHash,
      },
      apiEnhanced,
      originalPrompt,
      cached: false,
      timestamp: Date.now(),
      filePath: `data/prompts/${generatePromptId(type)}.md`,
      duration: Date.now() - startTime,
    };

    // 5. Cache + historique + current
    const cacheKey = `${type}-${cHash}`;
    this._setCache(cacheKey, prepared);
    this._history.push(prepared);
    if (this._history.length > 20) {
      this._history.shift();
    }
    this._current = prepared;

    // 6. Mettre à jour le state
    if (typeof actions?.setCurrentPrompt === 'function') {
      actions.setCurrentPrompt(prepared);
    }

    // 7. Écrire sur le disque (fire-and-forget)
    this._writeToFile(prepared).catch(() => {});

    return prepared;
  }

  /* ----- Amélioration du prompt via API ----- */

  /**
   * Améliore un prompt composé localement en l'envoyant au modèle de préparation.
   * Utilise le modèle de préparation s'il est configuré, sinon le modèle du chat.
   *
   * @param {string} composedPrompt - Prompt composé localement à améliorer
   * @returns {Promise<string|null>} - Prompt amélioré ou null si échec
   */
  async _enhancePromptViaApi(composedPrompt) {
    if (!composedPrompt || !composedPrompt.trim()) return null;

    const tokenCount = estimateTokens(composedPrompt);
    if (tokenCount < MIN_ENHANCEMENT_TOKENS) return null;

    try {
      const state = getState();
      const provider = state.assistant?.provider;
      if (!provider?.id) return null;

      const messages = [
        { role: 'system', content: ENHANCEMENT_SYSTEM_PROMPT },
        { role: 'user', content: composedPrompt },
      ];

      // Utiliser le modèle de préparation s'il est configuré, sinon le modèle du chat
      const enhancementProvider = {
        ...provider,
        model: provider.preparationModel || provider.model,
        temperature: 0.3, // Température basse pour des révisions plus stables
        maxTokens: Math.min(provider.maxTokens || 4096, 2048),
      };

      const { chatCompletion } = await import('./aiClient.js');

      const result = await chatCompletion(enhancementProvider, messages, {
        maxRetries: 1,
        noRotation: true,
      });

      const enhanced = result?.content?.trim();
      if (!enhanced || enhanced === composedPrompt.trim()) return null;

      return enhanced;
    } catch (err) {
      console.warn('[PromptEngine] Échec amélioration prompt:', err.message);
      return null;
    }
  }

  /* ----- Post-optimisation ----- */

  /**
   * Post-optimisation : révise une réponse pour la rendre plus concise.
   * Appelle le modèle local avec un prompt d'optimisation.
   *
   * @param {string} response - Réponse brute du modèle
   * @param {PreparedPrompt} preparedPrompt - Prompt préparé utilisé
   * @param {Object} provider - Provider pour l'appel API
   * @returns {Promise<string|null>} - Réponse optimisée ou null si échec
   */
  async optimizeResponse(response, preparedPrompt, provider) {
    if (!response || !response.trim()) return null;
    if (!provider?.id) return null;

    const tokenCount = estimateTokens(response);
    const threshold = DEFAULT_OPTIMIZATION_THRESHOLD;

    // Ne pas optimiser si en dessous du seuil
    if (tokenCount <= threshold) return null;

    try {
      // Construire les messages pour l'optimisation
      const messages = [
        { role: 'system', content: OPTIMIZATION_SYSTEM_PROMPT },
        { role: 'user', content: `Réponse originale :\n\n${response}` },
      ];

      // Utiliser le provider principal ou le modèle de préparation
      const optimizationProvider = {
        ...provider,
        model: provider.preparationModel || provider.model,
        temperature: 0.3, // Température basse pour des révisions plus stables
        maxTokens: Math.min(provider.maxTokens || 4096, 2048),
      };

      // Importer dynamiquement pour éviter les dépendances circulaires
      const { chatCompletion } = await import('./aiClient.js');

      const result = await chatCompletion(optimizationProvider, messages, {
        maxRetries: 1,
        noRotation: true,
      });

      const optimized = result?.content?.trim();
      if (!optimized) return null;

      return optimized;
    } catch (err) {
      console.warn('[PromptEngine] Échec optimisation:', err.message);
      return null;
    }
  }

  /* ----- Persistance fichier ----- */

  /**
   * Écrit le prompt préparé dans data/prompts/ via l'API.
   * @param {PreparedPrompt} prepared
   */
  async _writeToFile(prepared) {
    try {
      const content = [
        `# Prompt préparé — ${capitalize(prepared.type)}`,
        `> Généré le ${new Date(prepared.timestamp).toLocaleString('fr-FR')}`,
        `> Type : ${prepared.type}`,
        `> Cache : ${prepared.cached ? 'oui (réutilisé)' : 'non (composition locale)'}`,
        `> Contexte : ${prepared.context.nodeCount} nœuds, ${prepared.context.edgeCount} arêtes`,
        `> Fenêtre contexte : ${this._contextWindow} tokens`,
        '',
        '## Message utilisateur',
        prepared.userMessage,
        '',
        '## Prompt système',
        prepared.prompt,
        '',
        '## Contexte utilisé',
        `- Nœuds : ${prepared.context.nodeCount}`,
        `- Arêtes : ${prepared.context.edgeCount}`,
        prepared.context.selectedNodes.length > 0
          ? `- Nœuds sélectionnés : ${prepared.context.selectedNodes.join(', ')}`
          : '- Nœuds sélectionnés : aucun',
      ].join('\n');

      await fetch('/api/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: prepared.id + '.md',
          content,
          index: {
            id: prepared.id,
            type: prepared.type,
            timestamp: prepared.timestamp,
            tokens: estimateTokens(prepared.prompt),
          },
        }),
      });
    } catch (err) {
      console.warn('[PromptEngine] Échec écriture fichier:', err.message);
    }
  }
}

/* --------------------------------------------------------------------------
 * Helpers internes
 * -------------------------------------------------------------------------- */

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
