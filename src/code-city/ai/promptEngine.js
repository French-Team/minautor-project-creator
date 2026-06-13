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
import { tracePromptEngine, traceOptimizer } from './traceLogger.js';
import { resolveContextWindow } from './modelContextResolver.js';

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

// DEPRECATED: l'ancienne table MODEL_CONTEXT_WINDOWS a été supprimée.
// Le resolver cascade (modelContextResolver.js + data/model-context-windows.json)
// est la source unique de vérité pour les CWs. Il couvre tous les modèles
// de cette ancienne table (llama3.2:3b → 128k, mistral:7b → 32k, codestral → 32k,
// phi3 → 128k pour le medium / 4k pour mini, etc.) + 100+ autres.
// Si une CW manque : ajouter une entrée dans data/model-context-windows.json
// (exact pour le modelId, ou pattern en fallback).

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
 * Résolution du provider de préparation
 * -------------------------------------------------------------------------- */

/**
 * Résout le provider à utiliser pour les appels de préparation (enhancement
 * de prompt en entrée). Ce rôle a des besoins MODESTES en fenêtre de
 * contexte (le prompt composé est petit) — un petit modèle local suffit
 * souvent et coûte moins cher.
 *
 * Logique :
 *   1. Si `state.assistant.provider.preparationProviderId` est défini ET
 *      différent du provider courant, on récupère la config du provider
 *      ciblé depuis `state.assistant.providerConfigs[id]` (model, apiKey,
 *      baseUrl, maxTokens). Le modèle utilisé est `preparationModel` si
 *      défini (override explicite) sinon le model de la config du provider.
 *   2. Sinon, on retourne le provider courant avec `preparationModel` comme
 *      override de modèle (comportement legacy).
 *
 * @param {Object} state - Le state global (getState())
 * @returns {Object|null} Provider config prêt à être passé à chatCompletion,
 *   ou null si aucun provider n'est disponible.
 */
function resolvePreparationProvider(state) {
  const provider = state?.assistant?.provider;
  if (!provider?.id) return null;

  const prepProviderId = provider.preparationProviderId;
  const configs = state.assistant.providerConfigs || {};

  // Cas 1 : un provider de préparation DIFFÉRENT du provider chat est défini
  if (typeof prepProviderId === 'string' && prepProviderId.length > 0 && prepProviderId !== provider.id) {
    const prepConfig = configs[prepProviderId];
    if (prepConfig && (prepConfig.apiKey || prepConfig.baseUrl)) {
      return {
        ...prepConfig,
        id: prepProviderId,
        // preparationModel est un override optionnel au sein du provider de prep
        model: provider.preparationModel || prepConfig.model || provider.model,
        temperature: 0.3,
        maxTokens: Math.min(prepConfig.maxTokens || 4096, 2048),
      };
    }
    // Le provider de prep ciblé n'a pas de config valide → fallback sur le provider courant
  }

  // Cas 2 : pas de provider de prep spécifique, ou provider de prep == provider chat
  return {
    ...provider,
    model: provider.preparationModel || provider.model,
    temperature: 0.3,
    maxTokens: Math.min(provider.maxTokens || 4096, 2048),
  };
}

/**
 * Résout le provider à utiliser pour l'OPTIMISATION de réponse (sortie).
 * Distinct de resolvePreparationProvider() car les deux rôles ont des
 * besoins opposés en fenêtre de contexte :
 *   - enhancement (entrée) : prompt petit, petit modèle OK
 *   - optimization (sortie) : doit pouvoir contenir la réponse complète
 *     du chat pour la condenser → fenêtre de contexte ≥ celle du chat
 *
 * Résolution (par ordre de priorité) :
 *   1. Si `optimizationProviderId` est défini ET ≠ du chat, on l'utilise
 *      (config depuis providerConfigs[id], modèle = preparationModel override
 *      ou config.model, maxTokens plus généreux car on doit accommoder
 *      toute la réponse).
 *   2. Sinon (null), on RETOMBE sur resolvePreparationProvider() — qui
 *      lui-même retombe sur le chat. Comportement rétro-compatible : les
 *      configs sauvegardées avant l'introduction de optimizationProviderId
 *      continuent de fonctionner comme avant (1 seul provider = 2 rôles).
 *
 * Le filtre strict de compatibilité CW (≥ chat CW) est appliqué en amont
 * dans l'UI (providerPanel.getEligiblePrepProviders avec mode='optimize')
 * pour empêcher la sélection d'un provider insuffisant. Si un utilisateur
 * contourne ce filtre (ex: en éditant manuellement le localStorage),
 * optimizeResponse() détectera le mismatch et émettra un trace warning
 * sans crasher.
 *
 * @param {Object} state - Le state global (getState())
 * @returns {Object|null} Provider config prêt à être passé à chatCompletion
 */
function resolveOptimizationProvider(state) {
  const provider = state?.assistant?.provider;
  if (!provider?.id) return null;

  const optProviderId = provider.optimizationProviderId;
  const configs = state.assistant.providerConfigs || {};

  // Cas 1 : un provider d'optimisation DIFFÉRENT est explicitement défini
  if (typeof optProviderId === 'string' && optProviderId.length > 0 && optProviderId !== provider.id) {
    const optConfig = configs[optProviderId];
    if (optConfig && (optConfig.apiKey || optConfig.baseUrl)) {
      return {
        ...optConfig,
        id: optProviderId,
        model: optConfig.model || provider.model,
        temperature: 0.3,
        // maxTokens plus généreux que pour l'enhancement : on doit accommoder
        // toute la réponse + le prompt d'optimisation système. 4096 = valeur
        // safe par défaut, l'utilisateur peut configurer plus haut dans le preset.
        maxTokens: Math.min(optConfig.maxTokens || 8192, 8192),
      };
    }
    // Le provider d'optimisation ciblé n'a pas de config valide → fallback
  }

  // Cas 2 (défaut) : pas de provider d'optimisation spécifique → retombe
  // sur le provider de préparation (qui lui-même retombe sur le chat).
  // C'est le chemin rétro-compatible : les configs sans optimizationProviderId
  // utilisent le même provider pour les 2 rôles, comme avant l'introduction
  // de cette séparation.
  return resolvePreparationProvider(state);
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
    const beforeSize = this._cache.size;
    this._cache.clear();
    tracePromptEngine('clearCache', { beforeSize, afterSize: this._cache.size });
  }

  /**
   * Nettoie les entrées expirées du cache.
   */
  _pruneCache() {
    const beforeSize = this._cache.size;
    const now = Date.now();
    for (const [key, entry] of this._cache) {
      if (now > entry.expiresAt) {
        this._cache.delete(key);
      }
    }
    const removedCount = beforeSize - this._cache.size;
    if (removedCount > 0) {
      tracePromptEngine('cache PRUNE', { removedCount, remainingCount: this._cache.size });
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
   *
   * Stratégie de cascade (de la plus précise à la moins précise) :
   *   1. API Ollama /api/show (si provider=ollama) — la valeur RÉELLE du modelfile
   *   2. Resolver cascade (modelContextResolver.js) — table de référence
   *      avec 150+ modèles exact + patterns + provider defaults
   *   3. Fallback dur : 4096
   *
   * @param {Object} provider
   * @param {string} modelId
   * @returns {Promise<number>}
   */
  static async detectContextWindow(provider, modelId) {
    if (!modelId) {
      tracePromptEngine('detectContextWindow', { modelId: '', detected: 4096, source: 'default' });
      return 4096;
    }

    // 1. Essayer l'API Ollama /api/show (plus précis que la table — valeur réelle du modelfile)
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
            const detected = parseInt(data.modelfile_info.context_length, 10);
            tracePromptEngine('detectContextWindow', { modelId, detected, source: 'ollama-api' });
            return detected;
          }
          if (data.modelfile) {
            const match = data.modelfile.match(/num_ctx\s+(\d+)/);
            if (match) {
              const detected = parseInt(match[1], 10);
              tracePromptEngine('detectContextWindow', { modelId, detected, source: 'ollama-modelfile' });
              return detected;
            }
          }
        }
      } catch {
        // Fallback silencieux → resolver cascade
      }
    }

    // 2. Resolver cascade (exact → pattern → provider default → 4096)
    const resolved = resolveContextWindow({
      modelId,
      providerId: provider?.id,
      apiValue: null,
    });
    tracePromptEngine('detectContextWindow', {
      modelId,
      detected: resolved,
      source: 'resolver-cascade',
    });
    return resolved;
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
    const t0 = Date.now();
    if (!message || typeof message !== 'string') {
      tracePromptEngine('categorizeMessage', {
        userMessageLen: 0,
        detectedType: 'conversation',
        rulesMatched: 'none',
        durationMs: Date.now() - t0,
      });
      return 'conversation';
    }

    const trimmed = message.trim();
    let rulesMatched = 'none';

    // Salutations courtes → conversation
    for (const pattern of SHORT_GREETING_PATTERNS) {
      if (pattern.test(trimmed)) {
        rulesMatched = 'short-greeting';
        break;
      }
    }

    // Parcourir les règles par ordre de priorité
    if (rulesMatched === 'none') {
      for (const rule of CATEGORIZATION_RULES) {
        if (rule.pattern.test(trimmed)) {
          rulesMatched = rule.type;
          break;
        }
      }
    }

    // Déterminer le type final
    let detectedType = 'conversation';
    if (rulesMatched === 'short-greeting') {
      detectedType = 'conversation';
    } else if (rulesMatched !== 'none') {
      detectedType = rulesMatched;
    }

    tracePromptEngine('categorizeMessage', {
      userMessageLen: message.length,
      detectedType,
      rulesMatched,
      durationMs: Date.now() - t0,
    });

    return detectedType;
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
    const result = template.replace('{context}', contextText);
    tracePromptEngine('composePrompt', {
      type,
      templateLen: template.length,
      composedLen: result.length,
      contextTextLen: contextText.length,
    });
    return result;
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
      tracePromptEngine('cacheKey computed', { type, contextHash: cHash, fullKey: cacheKey });
      const cached = this._getFromCache(cacheKey);
      if (cached) {
        // Mettre à jour le message utilisateur (le contexte canvas est identique)
        cached.userMessage = userMessage;
        cached.cached = true;
        this._current = cached;
        const expiresInMs = this._cache.get(cacheKey)?.expiresAt - Date.now();
        tracePromptEngine('cache HIT', { cacheKey, promptId: cached.id, expiresInMs });
        tracePromptEngine('preparePrompt COMPLETE', {
          preparedId: cached.id,
          type: cached.type,
          cached: true,
          apiEnhanced: cached.apiEnhanced,
          durationMs: Date.now() - startTime,
        });
        return cached;
      }
      tracePromptEngine('cache MISS', { cacheKey });
    }

    // 3. Composer le prompt (localement, pas d'appel API)
    let prompt = this.composePrompt(type, canvasCtx);
    let apiEnhanced = false;
    let originalPrompt = null;

    // 3b. Améliorer le prompt via l'API si un provider de préparation est
    //     configuré (modèle de prep OU provider de prep distinct du chat).
    //     resolvePreparationProvider() retourne null si pas de provider
    //     actif, et retombe toujours sur le provider chat sinon.
    if (type !== 'conversation') {
      const state = getState();
      const provider = state.assistant?.provider;
      const hasCustomPrep = !!(provider?.preparationModel ||
        (provider?.preparationProviderId && provider.preparationProviderId !== provider.id));

      if (hasCustomPrep) {
        originalPrompt = prompt;
        const prep = resolvePreparationProvider(state);
        tracePromptEngine('enhancePromptViaApi ENTRY', {
          originalLen: prompt.length,
          tokenCount: estimateTokens(prompt),
          model: prep?.model,
          providerId: prep?.id,
        });
        const enhanced = await this._enhancePromptViaApi(prompt);
        if (enhanced) {
          prompt = enhanced;
          apiEnhanced = true;
          tracePromptEngine('enhancePromptViaApi SUCCESS', {
            originalLen: originalPrompt.length,
            enhancedLen: enhanced.length,
          });
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
    tracePromptEngine('cache SET', { cacheKey, promptId: prepared.id, expiresAt: Date.now() + this._cacheTTL });
    this._history.push(prepared);
    if (this._history.length > 20) {
      this._history.shift();
    }
    this._current = prepared;

    // 6. Mettre à jour le state
    if (typeof actions?.setCurrentPrompt === 'function') {
      actions.setCurrentPrompt(prepared);
    }

    // 7. Écrire sur le disque (fire-and-forget) + index.json
    this._writeToFile(prepared).catch(() => {});

    tracePromptEngine('preparePrompt COMPLETE', {
      preparedId: prepared.id,
      type: prepared.type,
      cached: false,
      apiEnhanced,
      durationMs: Date.now() - startTime,
    });

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
    if (!composedPrompt || !composedPrompt.trim()) {
      tracePromptEngine('enhancePromptViaApi SKIP', { reason: 'empty-prompt' });
      return null;
    }

    const tokenCount = estimateTokens(composedPrompt);
    if (tokenCount < MIN_ENHANCEMENT_TOKENS) {
      tracePromptEngine('enhancePromptViaApi SKIP', { tokenCount, minRequired: MIN_ENHANCEMENT_TOKENS });
      return null;
    }

    try {
      const state = getState();
      const provider = state.assistant?.provider;
      if (!provider?.id) {
        tracePromptEngine('enhancePromptViaApi SKIP', { reason: 'no-provider' });
        return null;
      }

      const messages = [
        { role: 'system', content: ENHANCEMENT_SYSTEM_PROMPT },
        { role: 'user', content: composedPrompt },
      ];

      // Résoudre le provider de préparation : si preparationProviderId pointe
      // vers un autre provider que le chat, on récupère sa config depuis
      // state.assistant.providerConfigs[id]. Sinon, on utilise le provider
      // courant avec éventuellement le preparationModel override.
      const enhancementProvider = resolvePreparationProvider(state);

      const { chatCompletion } = await import('./aiClient.js');

      const result = await chatCompletion(enhancementProvider, messages, {
        maxRetries: 1,
        noRotation: true,
      });

      const enhanced = result?.content?.trim();
      if (!enhanced) return null;
      if (enhanced === composedPrompt.trim()) {
        tracePromptEngine('enhancePromptViaApi NO_CHANGE', { originalLen: composedPrompt.length });
        return null;
      }

      return enhanced;
    } catch (err) {
      console.warn('[PromptEngine] Échec amélioration prompt:', err.message);
      tracePromptEngine('enhancePromptViaApi FAILED', { errorMsg: err.message?.slice(0, 200) });
      return null;
    }
  }

  /* ----- Post-optimisation ----- */

  /**
   * Post-optimisation : révise une réponse pour la rendre plus concise.
   * Appelle le modèle local avec un prompt d'optimisation.
   *
   * Modes supportés (option `options.mode`) :
   *   - 'replace' (défaut) : utilise `OPTIMIZATION_SYSTEM_PROMPT` seul comme
   *     message système. Le LLM d'optimisation n'a pas connaissance du
   *     prompt préparé utilisé pour la conversation.
   *   - 'enrich' : concatène `OPTIMIZATION_SYSTEM_PROMPT` avec le contenu du
   *     prompt préparé (`preparedPrompt.prompt`) pour donner au LLM
   *     d'optimisation le contexte complet du projet. Émet l'événement
   *     `[OPTIMIZER] optimizeResponse ENRICH` avec les longueurs
   *     `customPromptLen` et `systemPromptLen`.
   *
   * Le mode 'enrich' est utile pour les projets où la concision doit
   * respecter le contexte métier (par exemple conserver la terminologie
   * spécifique d'un domaine).
   *
   * @param {string} response - Réponse brute du modèle
   * @param {PreparedPrompt} preparedPrompt - Prompt préparé utilisé
   * @param {Object} provider - Provider pour l'appel API
   * @param {Object} [options]
   * @param {('replace'|'enrich')} [options.mode='replace'] - Mode d'enrichissement
   * @returns {Promise<string|null>} - Réponse optimisée ou null si échec
   */
  async optimizeResponse(response, preparedPrompt, provider, options = {}) {
    const t0 = Date.now();
    const { mode = 'replace' } = options;
    const tokenCount = estimateTokens(response);
    const threshold = DEFAULT_OPTIMIZATION_THRESHOLD;
    traceOptimizer('optimizeResponse ENTRY', {
      responseLen: response?.length || 0,
      tokenCount,
      threshold,
      mode,
      willOptimize: !!(response && response.trim()) && !!provider?.id && tokenCount > threshold,
    });
    if (!response || !response.trim()) {
      traceOptimizer('optimizeResponse SKIP', { reason: 'empty-response' });
      return null;
    }
    if (!provider?.id) {
      traceOptimizer('optimizeResponse NO_PROVIDER', { hasProvider: false });
      return null;
    }

    // Ne pas optimiser si en dessous du seuil
    if (tokenCount <= threshold) {
      traceOptimizer('optimizeResponse SKIP', { reason: 'below-threshold', tokenCount, threshold });
      return null;
    }

    // Guard explicite : si le caller demande mode='enrich' mais qu'aucun
    // prompt préparé n'est disponible, on émet une trace dédiée pour
    // auditer l'intention du caller (vs un fallback silencieux vers
    // 'replace' qui masquerait l'intention).
    if (mode === 'enrich' && !preparedPrompt?.prompt) {
      traceOptimizer('optimizeResponse SKIP', { reason: 'no-prepared-prompt' });
      return null;
    }

    try {
      // Construire le system prompt selon le mode
      // 'replace' (défaut) : OPTIMIZATION_SYSTEM_PROMPT seul
      // 'enrich' : OPTIMIZATION_SYSTEM_PROMPT + contexte préparé
      let systemPrompt = OPTIMIZATION_SYSTEM_PROMPT;
      if (mode === 'enrich') {
        systemPrompt = OPTIMIZATION_SYSTEM_PROMPT +
          '\n\n---\n\n## Contexte du projet (prompt préparé)\n\n' +
          preparedPrompt.prompt;
        traceOptimizer('optimizeResponse ENRICH', {
          customPromptLen: preparedPrompt.prompt.length,
          systemPromptLen: OPTIMIZATION_SYSTEM_PROMPT.length,
          enrichedLen: systemPrompt.length,
        });
      }

      // Construire les messages pour l'optimisation
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Réponse originale :\n\n${response}` },
      ];

      // Résoudre le provider d'optimisation (séparé de _enhancePromptViaApi
      // qui utilise resolvePreparationProvider). Les deux rôles ont des besoins
      // opposés : le prep prompt est petit (resolvePreparationProvider suffit),
      // l'optimisation doit pouvoir contenir toute la réponse (donc on utilise
      // resolveOptimizationProvider qui retombe sur resolvePreparationProvider
      // si optimizationProviderId est null = rétro-compatible).
      const state = getState();
      const optimizationProvider = resolveOptimizationProvider(state);

      // Defensive check : si le provider résolu a une CW < chat CW, on émet
      // un trace warning. L'UI empêche normalement cette config via le filtre
      // strict, mais un utilisateur peut l'avoir contournée (ex: édition
      // manuelle du localStorage). On log mais on ne bloque pas — laisser
      // l'appel échouer naturellement avec un message d'erreur est plus
      // informatif qu'un throw silencieux.
      const chatCW = state.assistant?.provider?.modelMeta?.contextWindow ?? null;
      const optCW = optimizationProvider.contextWindow ?? optimizationProvider.modelMeta?.contextWindow ?? null;
      if (chatCW && optCW && optCW < chatCW) {
        traceOptimizer('optimizeResponse CW_MISMATCH', {
          chatContextWindow: chatCW,
          optimizationContextWindow: optCW,
          optimizationProviderId: optimizationProvider.id,
          hint: 'optimizationProvider CW < chat CW — risk of truncation',
        });
      }

      traceOptimizer('optimizeResponse API_CALL', {
        model: optimizationProvider.model,
        messagesLen: 2,
        temperature: 0.3,
        maxTokens: optimizationProvider.maxTokens,
        mode,
      });

      // Importer dynamiquement pour éviter les dépendances circulaires
      const { chatCompletion } = await import('./aiClient.js');

    const result = await chatCompletion(optimizationProvider, messages, {
      maxRetries: 1,
      noRotation: true,
      timeout: 90000, // 90s : l'optimisation peut prendre du temps sur les longues réponses
    });

      const optimized = result?.content?.trim();
      if (!optimized) {
        traceOptimizer('optimizeResponse EMPTY', { originalLen: response.length });
        return null;
      }

      const optimizedTokens = estimateTokens(optimized);
      const tokensSaved = Math.max(0, tokenCount - optimizedTokens);
      const compressionRatio = Math.round((1 - optimized.length / response.length) * 100);
      traceOptimizer('optimizeResponse SUCCESS', {
        originalLen: response.length,
        optimizedLen: optimized.length,
        compressionRatio,
        durationMs: Date.now() - t0,
        tokensSaved,
      });
      return optimized;
    } catch (err) {
      // Un timeout sur l'optimisation n'est pas un échec critique : le LLM a juste
      // pris trop de temps pour condenser une longue réponse. On log en info (pas warn)
      // et on retourne null pour que la réponse originale soit conservée telle quelle.
      const isTimeout = err.name === 'TimeoutError' || /signal timed out|aborted/i.test(err.message || '');
      if (isTimeout) {
        console.info('[PromptEngine] Optimisation timeoutée (>90s) — réponse originale conservée:', err.message);
        traceOptimizer('optimizeResponse TIMEOUT', {
          errorMsg: err.message?.slice(0, 200),
          originalLen: response?.length || 0,
        });
      } else {
        console.warn('[PromptEngine] Échec optimisation:', err.message);
        traceOptimizer('optimizeResponse FAILED', {
          errorMsg: err.message?.slice(0, 200),
          originalLen: response?.length || 0,
        });
      }
      return null;
    }
  }

  /* ----- Persistance fichier (data/prompts/) ----- */

  /**
   * Écrit le prompt préparé dans data/prompts/ via l'API env-server
   * et met à jour l'index.json (rotation à 50 fichiers gérée côté serveur).
   * @param {PreparedPrompt} prepared
   */
  async _writeToFile(prepared) {
    tracePromptEngine('writeToFile CALL', {
      promptId: prepared.id,
      filePath: prepared.filePath,
      contentLen: prepared.prompt.length,
    });
    try {
      const content = [
        `# Prompt préparé — ${prepared.type}`,
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

      const resp = await fetch('/api/prompts', {
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
            category: prepared.type,
          },
        }),
      });
      if (resp.ok) {
        tracePromptEngine('writeToFile SUCCESS', {
          promptId: prepared.id,
          filePath: prepared.filePath,
          status: resp.status,
        });
      } else {
        tracePromptEngine('writeToFile FAILED', {
          promptId: prepared.id,
          errorMsg: `HTTP ${resp.status}`,
        });
      }
    } catch (err) {
      console.warn('[PromptEngine] Échec écriture fichier:', err.message);
      tracePromptEngine('writeToFile FAILED', {
        promptId: prepared.id,
        errorMsg: err.message?.slice(0, 200),
      });
    }
  }
}
