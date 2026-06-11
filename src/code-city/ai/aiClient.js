/**
 * AI Client — Client d'appel API LLM
 *
 * Fournit des fonctions pour interagir avec les providers IA :
 * - chatCompletion : appel chat standard (OpenAI-compat ou Gemini)
 * - fimCompletion  : complétion FIM pour Mistral (fill-in-the-middle)
 * - testConnection : test de connexion à un provider
 * - buildEndpointUrl : construit l'URL endpoint selon le provider
 * - fetchLocalModels : charge les modèles disponibles (Ollama/LM Studio)
 *
 * Les providers locaux (Ollama, LM Studio) sont routés via le proxy Vite
 * (vite.config.js) pour éviter les erreurs CORS cross-origin.
 */

import { getCategory } from './providerLoader.js';
import { getNextApiKey, resetRotationIndex, getApiKeyForEnvKey } from './envLoader.js';
import { toast } from './toast.js';
import { traceAiClient } from './traceLogger.js';

/**
 * Convertit une URL de provider local en URL proxy pour éviter CORS.
 * En dev, le proxy Vite (/local-api/{id}/*) forward vers localhost:{port}.
 * En prod ou si le provider n'est pas local, retourne l'URL d'origine.
 *
 * @param {string} baseUrl - URL d'origine du provider (ex: http://localhost:1234/v1)
 * @param {string} providerId - ID du provider (ex: 'ollama', 'lmstudio')
 * @returns {string} URL proxy ou URL d'origine
 */
/**
 * Providers en ligne avec target qui inclut déjà un path (ex: /zen/v1 pour opencode-zen)
 * Pour ces providers, on ne duplique PAS le path du baseUrl dans l'URL proxy
 */
const ONLINE_PROXIED_WITH_PATH = new Set(['kilo', 'opencode-zen']);

/**
 * Convertit une URL de provider local en URL proxy pour éviter CORS.
 * En dev, le proxy Vite (/local-api/{id}/*) forward vers localhost:{port}.
 * En prod ou si le provider n'est pas local, retourne l'URL d'origine.
 *
 * @param {string} url - URL complète du provider (ex: https://opencode.ai/zen/v1/chat/completions)
 * @param {string} providerId - ID du provider (ex: 'ollama', 'lmstudio')
 * @returns {string} URL proxy ou URL d'origine
 */
export function toLocalUrl(url, providerId) {
  const proxiedProviders = new Set(['ollama', 'lmstudio', 'kilo', 'opencode-zen']);
  if (!proxiedProviders.has(providerId)) return url;
  
  // Providers en ligne avec target qui inclut déjà un path (kilo, opencode-zen)
  // On extrait le endpoint (ex: /chat/completions) du full URL et on remplace le baseUrl par le proxy
  if (ONLINE_PROXIED_WITH_PATH.has(providerId)) {
    try {
      const u = new URL(url);
      const baseUrlForProvider = {
        'kilo': 'https://api.kilo.ai',
        'opencode-zen': 'https://opencode.ai/zen/v1',
      };
      const base = baseUrlForProvider[providerId];
      if (base) {
        const baseObj = new URL(base);
        const basePath = baseObj.pathname; // ex: '/zen/v1' pour opencode-zen
        const fullPath = u.pathname + u.search + u.hash;
        // Extraire le endpoint (ce qui suit le basePath)
        if (fullPath.startsWith(basePath)) {
          const endpoint = fullPath.slice(basePath.length); // ex: '/chat/completions'
          return `/local-api/${providerId}${endpoint}`;
        }
      }
    } catch {
      // En cas d'erreur, fallback
    }
    return `/local-api/${providerId}`;
  }
  
  // Providers locaux (ollama, lmstudio) : le target n'a pas de path, on garde le chemin complet
  try {
    const u = new URL(url);
    const path = u.pathname + u.search + u.hash;
    return `/local-api/${providerId}${path}`;
  } catch {
    const match = url.match(/^https?:\/\/[^/]+(\/?.*)$/);
    const path = match ? match[1] : url;
    return `/local-api/${providerId}${path}`;
  }
}

/**
 * Construit l'URL endpoint selon le format du provider.
 * - OpenAI-compatible (la plupart) : baseUrl + '/chat/completions'
 * - Gemini (REST natif) : format Gemini avec model:generateContent
 * - OpenCode Zen : utilise /responses (OpenAI) ou /messages (Anthropic) selon modelMeta.requestFormat
 * @param {Object} provider - Provider courant
 * @returns {string} URL complète de l'endpoint
 */
export function buildEndpointUrl(provider) {
  let endpoint;
  if (provider.id === 'gemini') {
    // Gemini API retourne des model IDs avec "models/" prefix (ex: "models/gemini-2.0-flash")
    // On le retire pour éviter "models/models/..." dans l'URL
    let modelId = provider.model;
    if (modelId.startsWith('models/')) {
      modelId = modelId.replace('models/', '');
    }
    endpoint = `${provider.baseUrl}/models/${modelId}:generateContent?key=${provider.apiKey}`;
  } else if (provider.id === 'opencode-zen') {
    // OpenCode Zen : utiliser le format détecté previously ou /responses par défaut
    // modelMeta.requestFormat peut être 'openai' ou 'anthropic'
    const format = provider.modelMeta?.requestFormat || 'openai';
    endpoint = `${provider.baseUrl}/${format === 'anthropic' ? 'messages' : 'responses'}`;
  } else {
    endpoint = `${provider.baseUrl}/chat/completions`;
  }
  traceAiClient('buildEndpointUrl', {
    providerId: provider.id,
    baseUrl: provider.baseUrl,
    model: provider.model,
    endpoint,
  });
  return endpoint;
}

/**
 * Formate les messages pour le format Anthropic (.messages endpoint).
 * @param {Array} messages - Messages au format OpenAI [{ role, content }]
 * @param {string} model - Model ID
 * @param {number} temperature
 * @param {number} maxTokens
 * @returns {Object} Body au format Anthropic Messages API
 */
function formatAnthropicRequest(messages, model, temperature, maxTokens) {
  const systemMsg = messages.find(m => m.role === 'system');
  const chatMessages = messages.filter(m => m.role !== 'system');
  
  return {
    model,
    messages: chatMessages.map(m => ({
      role: m.role === 'assistant' ? 'assistant' : m.role,
      content: m.content,
    })),
    system: systemMsg?.content || undefined,
    temperature: temperature ?? 1.0,
    max_tokens: maxTokens ?? 4096,
  };
}

/**
 * Formate les messages pour le format Gemini.
 * @param {Array} messages - Messages au format OpenAI
 * @param {string} model
 * @param {number} temperature
 * @param {number} maxTokens
 * @returns {Object} Body au format Gemini REST
 */
export function formatGeminiRequest(messages, model, temperature, maxTokens) {
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
 * @returns {{ content: string, usage: { promptTokens: number, completionTokens: number } }}
 */
export function parseGeminiResponse(data) {
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const usage = data.usageMetadata || {};
  const result = {
    content: text,
    usage: {
      promptTokens: usage.promptTokenCount || 0,
      completionTokens: usage.candidatesTokenCount || 0,
    },
  };
  traceAiClient('parseOpenAIResponse', {
    format: 'gemini',
    contentLen: text.length,
    usage: result.usage,
  });
  return result;
}

/**
 * Parse une réponse OpenAI-compatible en format unifié.
 * Gère automatiquement les formats OpenAI (choices) et Anthropic (output).
 * 
 * @param {Object} data
 * @param {string} providerId - ID du provider (non utilisé, gardé pour compatibilité)
 * @param {Object} modelMeta - Métadonnées du modèle (non utilisé, gardé pour compatibilité)
 * @returns {{ content: string, usage: { promptTokens: number, completionTokens: number } }}
 */
export function parseOpenAIResponse(data, providerId = '', modelMeta = null) {
  // Essayer OpenAI d'abord (format le plus courant): { choices: [{ message: { content: "..." } }] }
  if (data.choices?.[0]) {
    const choice = data.choices[0];
    const content = choice.message?.content || choice.text || '';
    const result = {
      content,
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
      },
    };
    traceAiClient('parseOpenAIResponse', {
      format: 'openai',
      contentLen: content.length,
      usage: result.usage,
    });
    return result;
  }
  
  // Fallback Anthropic/OpenCode Zen:
  //   { output: "..." }                                              (string simple)
  //   { output: { content: "..." } }                                 (objet content)
  //   { output: [{ type: "message", content: [{ type, text }] }] }   (array d'items)
  if (data.output !== undefined) {
    // Détection output vide : OpenCode Zen renvoie parfois { output: [], stop_reason: "max_output_tokens" }
    // quand le modèle ne génère aucun token (prompt trop vague, quota épuisé, etc.).
    // Sans cette vérif, on retournait content='' silencieusement, ce qui causait
    // des timeouts E2E (la chatPanel attendait un texte non-vide qui n'arrivait jamais).
    if (Array.isArray(data.output) && data.output.length === 0) {
      const stopReason = data.stop_reason || data.stopReason || 'inconnu';
      throw new Error(
        `Modèle a renvoyé output vide (stop_reason: ${stopReason}). ` +
        `Le prompt est peut-être trop vague, le modèle ne supporte pas la requête, ` +
        `ou le quota est épuisé. (usage: ${JSON.stringify(data.usage || {})})`,
      );
    }

    // Format array d'items (OpenCode Zen /responses non-streaming) :
    //   { output: [{ type: "reasoning", summary: [...] },
    //              { type: "message",    content: [{ type: "output_text", text: "..." }] }] }
    // → on filtre les items `type === 'message'` et on concatène les `.text` de leurs content[]
    if (Array.isArray(data.output)) {
      const textParts = [];
      for (const item of data.output) {
        if (!item || typeof item !== 'object') continue;
        // Item "message" standard
        if (item.type === 'message' && Array.isArray(item.content)) {
          for (const part of item.content) {
            if (typeof part?.text === 'string') textParts.push(part.text);
          }
        }
        // Au cas où l'item est directement { type, text } (variante)
        else if (typeof item.text === 'string' && item.type !== 'function_call') {
          textParts.push(item.text);
        }
      }
      return {
        content: textParts.join(''),
        // OpenCode Zen renvoie input_tokens/output_tokens (Anthropic-style)
        // tandis qu'OpenAI renvoie prompt_tokens/completion_tokens.
        // On lit les deux pour rester compatible.
        usage: {
          promptTokens: data.usage?.prompt_tokens ?? data.usage?.input_tokens ?? 0,
          completionTokens: data.usage?.completion_tokens ?? data.usage?.output_tokens ?? 0,
        },
      };
    }

    const result = {
      content: typeof data.output === 'string' ? data.output : (data.output.content || ''),
      usage: {
        promptTokens: data.usage?.prompt_tokens ?? data.usage?.input_tokens ?? 0,
        completionTokens: data.usage?.completion_tokens ?? data.usage?.output_tokens ?? 0,
      },
    };
    traceAiClient('parseOpenAIResponse', {
      format: 'opencode-zen-string',
      contentLen: result.content.length,
      usage: result.usage,
    });
    return result;
  }

  // Aucun format recognized
  traceAiClient('parseOpenAIResponse ERROR', {
    keys: Object.keys(data || {}),
    errorMsg: 'Format inconnu (ni choices ni output)',
  });
  throw new Error(`Réponse API invalide: ni choices ni output. Format: ${JSON.stringify(Object.keys(data || {}))}`);
}

/**
 * Vérifie si une erreur indique que le format de requête est incompatible avec le modèle.
 * @param {number} status - HTTP status code
 * @param {string} errorMsg - Error message
 * @returns {boolean} true si le format est incompatible
 */
function isFormatIncompatibleError(status, errorMsg) {
  const lowerMsg = errorMsg.toLowerCase();
  
  // Vérifier les marqueurs de format incompatible dans le message d'erreur
  const hasFormatMarker = lowerMsg.includes('format') ||
                          lowerMsg.includes('not supported') ||
                          lowerMsg.includes('non pris en charge') ||
                          lowerMsg.includes('invalid request') ||
                          (lowerMsg.includes('model') && lowerMsg.includes('not'));
  
  // Erreur 400 Bad Request - presque toujours un problème de format
  if (status === 400) {
    return true; // 400 sans message spécifique est quand même probablement un format problème
  }
  
  // Erreur 401 Unauthorized avec message de format = aussi un problème de format
  // (OpenCode Zen retourne parfois 401 au lieu de 400 pour ces erreurs)
  if (status === 401 && hasFormatMarker) {
    return true;
  }
  
  // Autres erreurs avec marqueur de format
  if (hasFormatMarker) {
    return true;
  }
  
  return false;
}

/**
 * Vérifie si le message indique que la promotion gratuite est terminée.
 * OpenCode Zen renvoie ce message quand le quota gratuit d'un modèle est épuisé.
 * @param {string} errorMsg - Message d'erreur
 * @returns {boolean} true si le quota gratuit est épuisé
 */
function isFreeQuotaExhaustedError(errorMsg) {
  if (!errorMsg) return false;
  const lowerMsg = errorMsg.toLowerCase();
  return lowerMsg.includes('promotion gratuite') && 
         (lowerMsg.includes('terminée') || lowerMsg.includes('termine') || lowerMsg.includes('gratuite de') || lowerMsg.includes('opencode.ai/go'));
}

/**
 * Vérifie si une erreur est un timeout réseau.
 * @param {Error} err - Erreur capturée
 * @returns {boolean} true si c'est un timeout
 */
function isTimeoutError(err) {
  if (!err) return false;
  const msg = err.message || '';
  return msg.includes('aborted') || 
         msg.includes('timeout') || 
         msg.includes('Timeout') ||
         msg.includes('TIMEOUT') ||
         msg.includes('AbortError');
}

/**
 * Appel un provider LLM avec rotation LRU des clés API et détection automatique du format.
 *
 * Pour OpenCode Zen : si le format OpenAI (/responses) échoue, réessaie avec le format Anthropic (/messages).
 * Le format réussi est retourné via `onFormatDetected` callback si fourni.
 *
 * @param {Object} provider - Provider courant depuis state.assistant.provider
 * @param {Array} messages  - Historique [{ role: 'system'|'user'|'assistant', content }]
 * @param {Object} options - Options supplémentaires
 * @param {number} options.maxRetries - Nombre max de tentatives (default: 3)
 * @param {boolean} options.noRotation - Désactive la rotation LRU (pour tests)
 * @param {function(string): void} options.onFormatDetected - Callback quand le format est détecté (reçu 'openai' ou 'anthropic')
 * @returns {Promise<{ content: string, usage: { promptTokens: number, completionTokens: number }, detectedFormat?: string }>}
 */
export async function chatCompletion(provider, messages, options = {}) {
  const { maxRetries = 3, noRotation = false, onFormatDetected = null } = options;
  const t0 = Date.now();

  traceAiClient('chatCompletion ENTRY', {
    providerId: provider.id,
    model: provider.model,
    messagesLen: messages.length,
    hasApiKey: !!provider.apiKey,
    maxRetries,
    requestFormat: provider.modelMeta?.requestFormat || 'openai',
  });

  let url = buildEndpointUrl(provider);
  url = toLocalUrl(url, provider.id);
  traceAiClient('chatCompletion URL', {
    url,
    isProxified: url.startsWith('/local-api/'),
  });

  let headers = { 'Content-Type': 'application/json' };
  let body;
  let parseResponse;
  let apiKey = provider.apiKey;
  let requestFormat = provider.modelMeta?.requestFormat || 'openai'; // 'openai' ou 'anthropic'

  if (provider.id === 'gemini') {
    body = formatGeminiRequest(messages, provider.model, provider.temperature, provider.maxTokens);
    parseResponse = parseGeminiResponse;
  } else if (requestFormat === 'anthropic' && provider.id === 'opencode-zen') {
    // Format Anthropic pour OpenCode Zen (endpoint /messages)
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
    body = formatAnthropicRequest(messages, provider.model, provider.temperature, provider.maxTokens);
    parseResponse = parseOpenAIResponse; // parseOpenAIResponse gère le format Anthropic (output)
  } else {
    // OpenAI-compatible (OpenRouter, Ollama, LM Studio, Kilo, OpenCode Zen, Mistral, Groq)
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
    body = { model: provider.model, messages, temperature: provider.temperature, max_tokens: provider.maxTokens, stream: false };
    parseResponse = parseOpenAIResponse;
  }

  traceAiClient('chatCompletion bodyBuilt', {
    bodyLen: JSON.stringify(body).length,
    requestFormat,
    model: provider.model,
    hasSystemMsg: !!messages.find((m) => m.role === 'system'),
  });

  let lastError;
  let lastStatus = null; // Dernier HTTP status pour détection 429
  let retries = 0;
  let formatRetryDone = false; // Pour éviter double retry

  while (retries <= maxRetries) {
      try {
        // Déclarer errorMsg en tête de try pour qu'il soit initialisé avant
        // tous les usages (429, 401, format-retry, throw final). Le `var`
        // remonte au function scope, mais l'assignation doit être faite ici
        // pour éviter `errorMsg is undefined` si la première erreur n'est pas
        // un 429 (ex: 401 direct).
        var errorMsg = '';
        traceAiClient('chatCompletion fetch CALL', {
          url,
          bodyLen: JSON.stringify(body).length,
          timeoutMs: 30000,
        });
        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(30000), // 30s timeout pour requête
        });

        if (response.ok) {
          traceAiClient('chatCompletion fetch OK', {
            status: response.status,
            durationMs: Date.now() - t0,
          });
          const data = await response.json();
          // Notifier le format détecté si callback fourni
          if (onFormatDetected && requestFormat !== (provider.modelMeta?.requestFormat || 'openai')) {
            // Le format a été changé pendant cette requête
            onFormatDetected(requestFormat);
          }
          // Succès — notifier si on a fait des retries
          if (retries > 0) {
            toast.success(`✅ Succès après ${retries} rotation(s)`, { duration: 3000 });
          }
          const parsed = parseResponse(data, provider.id, provider.modelMeta);
          traceAiClient('chatCompletion SUCCESS', {
            contentLen: parsed.content?.length || 0,
            usage: parsed.usage,
            detectedFormat: provider.id === 'gemini' ? 'gemini' : requestFormat,
            attempts: retries + 1,
          });
          return parsed;
        }

      // Erreur 429 = Rate limit → rotation de clé
      if (response.status === 429 && !noRotation) {
        lastStatus = 429;
        const errorData = await response.json().catch(() => ({}));
        // errorMsg déjà déclarée en tête de try block (var function-scope)
        errorMsg = errorData.error?.message || errorData.message || 'Rate limit exceeded';
        console.warn('[aiClient] Corps de la 429:', JSON.stringify(errorData).slice(0, 500));
        
        // Essayer de trouver une autre clé
        if (provider.envKey) {
            const nextKey = getNextApiKey(provider.envKey);
            if (nextKey) {
              traceAiClient('chatCompletion keyRotation', {
                envKey: provider.envKey,
                fromKey: apiKey ? apiKey.slice(0, 8) + '...' : 'none',
                toKey: nextKey.key,
                reason: '429',
              });
              console.warn(`[aiClient] Rate limit (429), rotation vers ${nextKey.key}`);
              toast.warning(`⚡ Rate limit — rotation vers ${nextKey.key} (tentative ${retries + 1}/${maxRetries + 1})`, { duration: 4000 });
              apiKey = nextKey.value;
              if (provider.id === 'gemini') {
                // Reconstruire l'URL avec la nouvelle clé
                url = buildEndpointUrl({ ...provider, apiKey });
                url = toLocalUrl(url, provider.id);
              } else {
                headers['Authorization'] = `Bearer ${apiKey}`;
              }
              retries++;
              // NE PAS reset l'index ici ! La rotation doit continuer vers la prochaine clé
              continue;
            }
          }
          traceAiClient('chatCompletion keyExhausted', {
            envKey: provider.envKey,
            attempts: retries + 1,
          });
          toast.error('🚫 Rate limit — aucune clé de rotation disponible');
          throw new Error(`${errorMsg} (429 Rate Limit - aucune clé de rotation disponible)`);
        }

        traceAiClient('chatCompletion fetch 429', {
          status: response.status,
          errorMsg: errorMsg.slice(0, 200),
        });

      // Erreur de format incompatible → retry avec l'autre format (OpenCode Zen seulement)
      // On fait ce check AVANT la rotation 401 pour les erreurs de format
      lastStatus = response.status;
      // Note: errorMsg est déjà déclarée plus haut (dans le bloc 429) — pas de re-déclaration ici
      try {
        const errorData = await response.json();
        errorMsg = errorData.error?.message || errorData.message || errorMsg;
      } catch {
        // Si le corps n'est pas du JSON valide, garder le message par défaut
      }

      // Pour OpenCode Zen avec format 'openai', si erreur de format, retry avec 'anthropic'
      if (provider.id === 'opencode-zen' &&
          requestFormat === 'openai' &&
          !formatRetryDone &&
          isFormatIncompatibleError(response.status, errorMsg)) {
        traceAiClient('chatCompletion formatRetry', {
          fromFormat: 'openai',
          toFormat: 'anthropic',
          reason: errorMsg.slice(0, 100),
        });
        console.warn(`[aiClient] Format OpenAI non supporté (${errorMsg}), retry avec Anthropic...`);
        toast.warning(`🔄 Format non supporté — tentative avec format Anthropic`, { duration: 4000 });
        
        // Switch vers format Anthropic
        requestFormat = 'anthropic';
        url = buildEndpointUrl({ ...provider, modelMeta: { requestFormat: 'anthropic' } });
        url = toLocalUrl(url, provider.id);
        headers['Authorization'] = apiKey ? `Bearer ${apiKey}` : headers['Authorization'];
        body = formatAnthropicRequest(messages, provider.model, provider.temperature, provider.maxTokens);
        formatRetryDone = true;
        retries++; // INCREMENTER pour compter cette tentative de format
        continue;
      }

      // Classifier l'erreur HTTP
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        traceAiClient('chatCompletion fetch 4xx', {
          status: response.status,
          errorMsg: errorMsg.slice(0, 200),
        });
      } else if (response.status >= 500) {
        traceAiClient('chatCompletion fetch 5xx', {
          status: response.status,
          errorMsg: errorMsg.slice(0, 200),
        });
      }

      // Erreur 401 Unauthorized → pour OpenCode Zen, on fait une rotation de clé
      // (seulement si ce n'est pas une erreur de format, car on a déjà fait le format retry ci-dessus)
      if (response.status === 401 && provider.envKey) {
        // errorMsg vient d'être parsée plus haut (bloc 429 ou bloc format retry)
        // Si errorMsg est undefined (cas 401 direct), on la construit ici
        if (typeof errorMsg === 'undefined') {
          errorMsg = `Erreur HTTP 401`;
        }
        // Vérifier si c'est une erreur de quota gratuit épuisé (OpenCode Zen)
        const isQuotaError = isFreeQuotaExhaustedError(errorMsg);
        
        // Vérifier si c'est une erreur de modèle non supporté (quota modèle épuisé sur le serveur)
        // Ces erreurs ne changeront PAS avec une autre clé, donc on ne fait pas de rotation
        const lowerMsg = errorMsg.toLowerCase();
        const isModelUnavailable = lowerMsg.includes('non pris en charge') ||
                                   lowerMsg.includes('not supported') ||
                                   lowerMsg.includes('not available') ||
                                   lowerMsg.includes('unavailable') ||
                                   lowerMsg.includes('quota') ||
                                   lowerMsg.includes('model');
        
        // Si le modèle n'est pas disponible, ne pas tourner - ça ne changera pas avec une autre clé
        if (isModelUnavailable && formatRetryDone) {
          console.error(`[aiClient] Modèle ${provider.model} non disponible sur OpenCode Zen (Après format retry)`);
          toast.error(`❌ Modèle "${provider.model}" non disponible. Le modèle n'est probablement plus offert par OpenCode Zen.`);
          throw new Error(`Modèle "${provider.model}" non disponible sur OpenCode Zen. Après format retry, le modèle ne supporte ni OpenAI ni Anthropic. Sélectionne un autre modèle.`);
        }
        
        const nextKey = getNextApiKey(provider.envKey);
        if (nextKey) {
          traceAiClient('chatCompletion keyRotation', {
            envKey: provider.envKey,
            fromKey: apiKey ? apiKey.slice(0, 8) + '...' : 'none',
            toKey: nextKey.key,
            reason: '401',
            isQuotaError,
          });
          if (isQuotaError) {
            console.warn(`[aiClient] Quota gratuit épuisé (401), rotation vers ${nextKey.key}`);
            toast.warning(`🎁 Quota gratuit épuisé — rotation vers ${nextKey.key}`, { duration: 4000 });
          } else {
            console.warn(`[aiClient] Erreur 401 (${errorMsg}), rotation vers ${nextKey.key}`);
            toast.warning(`🔑 Auth error — rotation vers ${nextKey.key}`, { duration: 4000 });
          }
          apiKey = nextKey.value;
          if (provider.id === 'gemini') {
            url = buildEndpointUrl({ ...provider, apiKey });
            url = toLocalUrl(url, provider.id);
          } else {
            headers['Authorization'] = `Bearer ${apiKey}`;
          }
          retries++;
          continue;
        }
        // Pas d'autre clé disponible
        traceAiClient('chatCompletion keyExhausted', {
          envKey: provider.envKey,
          attempts: retries + 1,
        });
        toast.error(`🔑 Erreur 401 — aucune clé de rotation disponible`);
        throw new Error(errorMsg);
      }

      // Message spécifique pour 429 (rate limit / quota)
      if (response.status === 429) {
        if (errorMsg.includes('free-models-per-day')) {
          errorMsg = 'Quota quotidien de modèles gratuits OpenRouter épuisé. Ajoute des crédits ou attends demain.';
        } else {
          errorMsg = `Rate limit (429) — trop de requêtes. Attends quelques minutes ou utilise une autre clé. ${errorMsg}`;
        }
      }

      throw new Error(errorMsg);

    } catch (err) {
      lastError = err;

      // Timeout réseau → rotation de clé si disponible
      if (isTimeoutError(err) && provider.envKey) {
        const nextKey = getNextApiKey(provider.envKey);
        if (nextKey) {
          traceAiClient('chatCompletion keyRotation', {
            envKey: provider.envKey,
            fromKey: apiKey ? apiKey.slice(0, 8) + '...' : 'none',
            toKey: nextKey.key,
            reason: 'timeout',
          });
          console.warn(`[aiClient] Timeout réseau, rotation vers ${nextKey.key}`);
          toast.warning(`⏱️ Timeout — rotation vers ${nextKey.key} (tentative ${retries + 1}/${maxRetries + 1})`, { duration: 4000 });
          apiKey = nextKey.value;
          if (provider.id === 'gemini') {
            url = buildEndpointUrl({ ...provider, apiKey });
            url = toLocalUrl(url, provider.id);
          } else {
            headers['Authorization'] = `Bearer ${apiKey}`;
          }
          // NE PAS reset l'index ici ! La rotation doit continuer
          retries++;
          continue;
        }
        // Pas d'autre clé disponible, throw l'erreur de timeout
        toast.error('⏱️ Timeout — aucune clé de rotation disponible');
        throw new Error(`Timeout réseau — le modèle gratuit est souvent lent. Réessaie ou choisis un autre modèle. (aucune clé de rotation disponible)`);
      }

      // Erreur 429 = Rate limit → rotation de clé (géré plus haut, mais au cas où)
      if (err.message.includes('429') && !noRotation && provider.envKey) {
        const nextKey = getNextApiKey(provider.envKey);
        if (nextKey) {
          traceAiClient('chatCompletion keyRotation', {
            envKey: provider.envKey,
            fromKey: apiKey ? apiKey.slice(0, 8) + '...' : 'none',
            toKey: nextKey.key,
            reason: '429',
          });
          console.warn(`[aiClient] Rate limit (429), rotation vers ${nextKey.key}`);
          toast.warning(`⚡ Rate limit détecté — rotation vers ${nextKey.key}`, { duration: 4000 });
          apiKey = nextKey.value;
          if (provider.id === 'gemini') {
            url = buildEndpointUrl({ ...provider, apiKey });
            url = toLocalUrl(url, provider.id);
          } else {
            headers['Authorization'] = `Bearer ${apiKey}`;
          }
          // NE PAS reset l'index ici !
          retries++;
          continue;
        }
      }

      // Erreur réseau ou autre - ne pas réessayer si max retries atteint
      if (retries >= maxRetries) {
        traceAiClient('chatCompletion THROW', {
          errorMsg: err.message?.slice(0, 200),
          status: lastStatus,
          attempts: retries + 1,
        });
        throw err;
      }

      traceAiClient('chatCompletion THROW', {
        errorMsg: err.message?.slice(0, 200),
        status: lastStatus,
        attempts: retries + 1,
      });
      throw err;
    }
  }

  // Si toutes les tentatives ont échoué sur 429, message clair
  if (lastStatus === 429) {
    throw new Error('Rate limit (429) — toutes les clés sont temporairement bloquées. Attends quelques minutes avant de réessayer.');
  }
  throw lastError || new Error('Max retries exceeded');
}

/**
 * Appel LLM en streaming SSE (Server-Sent Events).
 *
 * Envoie la requête avec stream: true, puis lit le flux SSE en
 * temps réel. Chaque token reçu est transmis via onToken().
 *
 * Supporté par : OpenAI, Ollama, LM Studio, Groq, Mistral, OpenRouter, Kilo.
 * Pour Gemini : fallback sur chatCompletion classique (pas de streaming SSE).
 *
 * @param {Object} provider - Provider courant
 * @param {Array} messages  - Historique [{ role, content }]
 * @param {Object} callbacks
 * @param {function(string): void} callbacks.onToken - Appelé pour chaque token
 * @param {function(): void}      callbacks.onDone  - Appelé quand le flux est terminé
 * @param {function(Error): void}  callbacks.onError - Appelé en cas d'erreur
 * @param {AbortSignal}  [signal]     - Signal d'annulation
 * @returns {Promise<{ content: string, usage: { promptTokens: number, completionTokens: number } }>}
 */
export async function streamChatCompletion(provider, messages, { onToken, onDone, onError }, signal) {
  const t0 = Date.now();
  traceAiClient('streamChatCompletion ENTRY', {
    providerId: provider.id,
    model: provider.model,
    hasSignal: !!signal,
  });

  // Gemini ne supporte pas le streaming SSE standard — fallback
  if (provider.id === 'gemini') {
    traceAiClient('streamChatCompletion fallback gemini', {
      providerId: provider.id,
      reason: 'no-sse',
    });
    const result = await chatCompletion(provider, messages);
    if (onToken) onToken(result.content);
    if (onDone) onDone();
    return result;
  }

  // OpenCode Zen : les deux formats (responses/messages) utilisent des endpoints
  // non-standard non gérés par le parsing SSE. Fallback non-streaming vers
  // chatCompletion() qui gère la détection automatique du format.
  //
  // Émulation de streaming : onToken+onDone synchrones après un await unique
  // empêchent le chatPanel de détecter la transition .chat-msg--streaming →
  // .chat-msg--assistant (les timers typewriter 10ms et markdownSync 500ms
  // sont cleared par onDone avant d'avoir pu tourner). On découpe donc le
  // contenu en chunks et on les envoie séquentiellement avec un microtask
  // break entre chaque, pour que les timers chatPanel tournent et que
  // streamedContent soit complet au moment de onDone.
  if (provider.id === 'opencode-zen') {
    traceAiClient('streamChatCompletion fallback opencode-zen', {
      providerId: provider.id,
      reason: 'no-sse',
    });
    const result = await chatCompletion(provider, messages);
    const fullContent = result.content || '';
    const CHUNK_SIZE = 20; // ~20 chars par chunk ≈ 1 typewriter timer (10ms)

    let chunkCount = 0;
    for (let i = 0; i < fullContent.length; i += CHUNK_SIZE) {
      const chunk = fullContent.slice(i, i + CHUNK_SIZE);
      chunkCount++;
      if (chunkCount % 5 === 0) {
        traceAiClient('streamChatCompletion chunk', {
          chunkLen: chunk.length,
          cumLen: Math.min(i + CHUNK_SIZE, fullContent.length),
          chunkCount,
          preview: chunk.slice(0, 40),
        });
      }
      if (onToken) onToken(chunk);
      // Microtask break : laisse les timers chatPanel (typewriter 10ms,
      // markdownSync 500ms) et le MutationObserver se déclencher entre chunks.
      // Garantit aussi que streamedContent += chunk est appliqué avant
      // l'évaluation du tour de boucle suivant.
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    if (onDone) onDone();
    traceAiClient('streamChatCompletion DONE', {
      contentLen: fullContent.length,
      durationMs: Date.now() - t0,
      chunkCount,
    });
    return result;
  }

  let apiKey = provider.apiKey;
  let url = toLocalUrl(buildEndpointUrl(provider), provider.id);

  let headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  let body = {
    model: provider.model,
    messages,
    temperature: provider.temperature,
    max_tokens: provider.maxTokens,
    stream: true,
  };

  // Helper pour faire la requête
  const doFetch = async () => {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      // Erreur 429 = Rate limit → rotation de clé
      if (response.status === 429 && provider.envKey) {
        const nextKey = getNextApiKey(provider.envKey);
        if (nextKey) {
          console.warn(`[aiClient] Stream: Rate limit (429), rotation vers ${nextKey.key}`);
          apiKey = nextKey.value;
          headers['Authorization'] = `Bearer ${apiKey}`;
          // Retry avec nouvelle clé (NE PAS reset l'index car on est en train de tourner)
          return doFetch();
        }
      }
      
      // Erreur non-429 ou pas de clé de rotation disponible
      const error = await response.json().catch(() => ({}));
      resetRotationIndex(provider.envKey); // Reset seulement pour erreurs non-429
      throw new Error(error.error?.message || `Erreur HTTP ${response.status}`);
    }
    return response;
  };

  const response = await doFetch();

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullContent = '';
  let usage = { promptTokens: 0, completionTokens: 0 };
  let finished = false;
  let chunkCount = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':')) continue;

        if (trimmed.startsWith('data: ')) {
          const dataStr = trimmed.slice(6);
          if (dataStr === '[DONE]') {
            finished = true;
            if (onDone) onDone();
            return { content: fullContent, usage };
          }
          try {
            const chunk = JSON.parse(dataStr);

            // Auto-détection du format: OpenAI (choices) ou Anthropic (output)
            // Essayer OpenAI d'abord (format le plus courant)
            const openaiDelta = chunk.choices?.[0]?.delta;
            if (openaiDelta?.content) {
              fullContent += openaiDelta.content;
              chunkCount++;
              if (chunkCount % 5 === 0) {
                traceAiClient('streamChatCompletion chunk', {
                  chunkLen: openaiDelta.content.length,
                  cumLen: fullContent.length,
                  chunkCount,
                  preview: openaiDelta.content.slice(0, 40),
                });
              }
              if (onToken) onToken(openaiDelta.content);
              if (chunk.usage) {
                usage = {
                  promptTokens: chunk.usage.prompt_tokens || 0,
                  completionTokens: chunk.usage.completion_tokens || 0,
                };
              }
            } else if (chunk.output !== undefined) {
              // Format Anthropic/OpenCode Zen: { output: "..." } or { output: { content: "..." } }
              const content = typeof chunk.output === 'string' ? chunk.output : (chunk.output.content || '');
              if (content) {
                fullContent += content;
                if (onToken) onToken(content);
              }
              if (chunk.usage) {
                usage = {
                  promptTokens: chunk.usage.prompt_tokens || 0,
                  completionTokens: chunk.usage.completion_tokens || 0,
                };
              }
            }
          } catch {
            if (dataStr !== '[DONE]') {
              fullContent += dataStr;
              if (onToken) onToken(dataStr);
            }
          }
        }
      }
    }

    // Gestion du buffer résiduel (cas rare où des données restent après la boucle principale)
    if (buffer.trim()) {
      const trimmed = buffer.trim();
      if (trimmed.startsWith('data: ')) {
        const dataStr = trimmed.slice(6);
        if (dataStr !== '[DONE]') {
          try {
            const chunk = JSON.parse(dataStr);
            // Auto-détection du format pour le buffer résiduel (même logique)
            const residualDelta = chunk.choices?.[0]?.delta;
            if (residualDelta?.content) {
              fullContent += residualDelta.content;
              if (onToken) onToken(residualDelta.content);
            } else if (chunk.output !== undefined) {
              const content = typeof chunk.output === 'string' ? chunk.output : (chunk.output.content || '');
              if (content) {
                fullContent += content;
                if (onToken) onToken(content);
              }
            }
          } catch {
            // Ignorer
          }
        }
      }
    }

    if (!finished && onDone) onDone();
    traceAiClient('streamChatCompletion DONE', {
      contentLen: fullContent.length,
      durationMs: Date.now() - t0,
      chunkCount,
    });
    return { content: fullContent, usage };
  } catch (err) {
    traceAiClient('streamChatCompletion ERROR', {
      errorMsg: err.message?.slice(0, 200),
      hasPartialContent: fullContent.length > 0,
    });
    if (!finished && onError) {
      onError(err);
      return { content: fullContent, usage };
    }
    throw err;
  }
}

/**
 * FIM (Fill-in-the-Middle) pour Mistral — complétion de code inline.
 *
 * Envoie le code AVANT le curseur (prefix) et le code APRÈS (suffix),
 * le modèle génère le code intermédiaire.
 *
 * Endpoint : POST {baseUrl}/fim/completions (Mistral uniquement)
 *
 * @param {Object} provider - Provider courant (doit être Mistral)
 * @param {string} prefix   - Code avant le curseur
 * @param {string} suffix   - Code après le curseur
 * @returns {Promise<{ content: string, usage: { promptTokens: number, completionTokens: number } }>}
 */
export async function fimCompletion(provider, prefix, suffix) {
  const t0 = Date.now();
  traceAiClient('fimCompletion ENTRY', {
    prefixLen: prefix.length,
    suffixLen: suffix.length,
    model: provider.model,
  });
  if (provider.id !== 'mistral') {
    traceAiClient('fimCompletion FAILED', {
      providerId: provider.id,
      errorMsg: "FIM n'est supporté que par Mistral",
    });
    throw new Error("FIM n'est supporté que par Mistral");
  }

  const url = toLocalUrl(`${provider.baseUrl}/fim/completions`, provider.id);
  const headers = {
    'Content-Type': 'application/json',
  };
  if (provider.apiKey) {
    headers['Authorization'] = `Bearer ${provider.apiKey}`;
  }

  const body = {
    model: provider.model,
    prompt: prefix,
    suffix: suffix,
    temperature: provider.temperature ?? 0.2,
    max_tokens: provider.maxTokens ?? 4096,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    traceAiClient('fimCompletion FAILED', {
      providerId: provider.id,
      errorMsg: error.error?.message || `Erreur HTTP ${response.status}`,
    });
    throw new Error(error.error?.message || `Erreur HTTP ${response.status}`);
  }

  const data = await response.json();
  const result = {
    content: data.choices[0].message?.content || data.choices[0].text || '',
    usage: {
      promptTokens: data.usage?.prompt_tokens || 0,
      completionTokens: data.usage?.completion_tokens || 0,
    },
  };
  traceAiClient('fimCompletion SUCCESS', {
    contentLen: result.content.length,
    usage: result.usage,
    durationMs: Date.now() - t0,
  });
  return result;
}

/**
 * Teste la connexion à un provider.
 * - Providers locaux : vérifie que le serveur répond (GET /api/tags ou /v1/models)
 * - Providers en ligne : fait un appel minimal (chatCompletion avec prompt "Say ok")
 *
 * @param {Object} provider
 * @returns {Promise<{ ok: boolean, latency: number, error?: string, models?: Object }>}
 */
export async function testConnection(provider) {
  const category = provider.category || getCategory(provider.id);
  const start = Date.now();
  try {
    if (category === 'local') {
      const url = provider.id === 'ollama'
        ? `${toLocalUrl(provider.baseUrl.replace('/v1', ''), provider.id).replace(/\/$/, '')}/api/tags`
        : `${toLocalUrl(provider.baseUrl, provider.id).replace(/\/$/, '')}/models`;
      const response = await fetch(url, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      return { ok: true, latency: Date.now() - start, models: data };
    } else {
      // Providers en ligne nécessitent un modèle pour tester
      if (!provider.model) {
        return {
          ok: false,
          latency: Date.now() - start,
          error: 'Aucun modèle sélectionné',
        };
      }
      const response = await chatCompletion(provider, [
        { role: 'user', content: 'Say "ok"' },
      ], { maxRetries: 1 });
      return { ok: true, latency: Date.now() - start };
    }
  } catch (error) {
    // Détecter les erreurs de connexion refusée pour les providers locaux
    const errMsg = error.message || '';
    let errorDetail = error.message;
    if (category === 'local') {
      if (errMsg.includes('CONNECTION_REFUSED') ||
          errMsg.includes('Failed to fetch') ||
          errMsg.includes('ECONNREFUSED') ||
          errMsg.includes('NetworkError')) {
        if (provider.id === 'ollama') {
          errorDetail = 'CONNECTION_REFUSED_OLLAMA';
        } else if (provider.id === 'lmstudio') {
          errorDetail = 'CONNECTION_REFUSED_LMSTUDIO';
        }
      }
    }
    return {
      ok: false,
      latency: Date.now() - start,
      error: errorDetail,
      status: error.status,
    };
  }
}

/**
 * Charge les modèles disponibles d'un provider (via l'API du provider).
 *
 * @param {Object} provider
 * @returns {Promise<Array<{ id: string, name: string, contextWindow?: number, isFree?: boolean }>>}
 */
export async function fetchModels(provider) {
  const { id, baseUrl, apiKey } = provider;

  let url;
  if (id === 'gemini') {
    url = `${baseUrl}/models?key=${apiKey}`;
  } else if (id === 'ollama') {
    url = toLocalUrl(baseUrl.replace('/v1', ''), id).replace(/\/$/, '') + '/api/tags';
  } else if (id === 'lmstudio') {
    url = toLocalUrl(baseUrl, id) + '/models';
  } else {
    url = toLocalUrl(baseUrl, id) + '/models';
  }

  const headers = {};
  if (apiKey && id !== 'gemini') {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  let response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(15000),
    });
  } catch (err) {
    // Erreur de connexion (réseau, CORS, serveur éteint)
    if (id === 'ollama') {
      throw new Error('CONNECTION_REFUSED_OLLAMA');
    } else if (id === 'lmstudio') {
      throw new Error('CONNECTION_REFUSED_LMSTUDIO');
    }
    throw new Error(`Erreur de connexion: ${err.message}`);
  }    if (!response.ok) {
      // 504 = Gateway Timeout (Vite proxy n'a pas pu atteindre le serveur local)
      if (response.status === 504) {
        if (id === 'ollama') {
          throw new Error('CONNECTION_REFUSED_OLLAMA');
        } else if (id === 'lmstudio') {
          throw new Error('CONNECTION_REFUSED_LMSTUDIO');
        }
      }
      throw new Error(`HTTP ${response.status}`);
    }

  const data = await response.json();

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
    contextWindow: null,
    isFree: false,
  }));
}

function normalizeOllamaModels(data) {
  return (data.models || []).map((m) => ({
    id: m.name,
    name: m.name,
    contextWindow: null,
    isFree: true,
  }));
}

/**
 * Teste un modèle spécifique (chat + détection capabilities).
 *
 * @param {Object} provider
 * @param {string} modelId
 * @returns {Promise<{ format: string, capabilities: string[], contextWindow: number|null, latency: number }>}
 */
export async function testModel(provider, modelId) {
  const start = Date.now();

  // Détecter le format réel (OpenCode Zen peut utiliser OpenAI ou Anthropic)
  let detectedRequestFormat = 'openai';

  // Test chat (noRotation=true pour éviter rotation pendant test modèle)
  // Note: parseOpenAIResponse gère automatiquement les formats OpenAI et Anthropic
  await chatCompletion(
    { ...provider, model: modelId },
    [{ role: 'user', content: 'Say hello' }],
    {
      maxRetries: 3,
      noRotation: true,
      onFormatDetected: (format) => { detectedRequestFormat = format; },
    }
  );

  const latency = Date.now() - start;

  // Détection format :
  //   Gemini → 'gemini'
  //   OpenCode Zen → tel que détecté par onFormatDetected ('openai' | 'anthropic')
  //   Autres → 'openai'
  let format = provider.id === 'gemini' ? 'gemini' : detectedRequestFormat;

  const capabilities = ['chat'];

  // 3. Test FIM si mistral
  if (provider.id === 'mistral') {
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

  return {
    format, // 'openai' | 'anthropic' | 'gemini'
    requestFormat: format, // Alias pour buildEndpointUrl() qui lit modelMeta.requestFormat
    capabilities,
    contextWindow: null,
    latency,
  };
}

/**
 * Charge les modèles d'un provider local (Ollama ou LM Studio) pour le chatPanel.
 *
 * @param {Object} provider
 * @returns {Promise<Array<{ id: string, name: string, contextWindow?: number }>>}
 */
export async function fetchLocalModels(provider) {
  const apiKey = provider.apiKey || '';
  try {
    if (provider.id === 'ollama') {
      const headers = {};
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
      const resp = await fetch(
        `${toLocalUrl(provider.baseUrl.replace('/v1', ''), provider.id).replace(/\/$/, '')}/api/tags`,
        { headers, signal: AbortSignal.timeout(10000) }
      );
      if (!resp.ok) {
        if (resp.status >= 500) {
          // Erreur serveur = connexion refusée (Vite proxy ne peut pas atteindre Ollama)
          return { error: 'CONNECTION_REFUSED_OLLAMA' };
        }
        throw new Error(`HTTP ${resp.status}`);
      }
      const data = await resp.json();
      return (data.models || []).map(m => ({
        id: m.name,
        name: m.name,
        contextWindow: m.detail?.parameter_size ? undefined : 4096,
      }));
    } else {
      const headers = {};
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
      const resp = await fetch(
        `${toLocalUrl(provider.baseUrl, provider.id)}/models`,
        { headers, signal: AbortSignal.timeout(10000) }
      );
      if (!resp.ok) {
        if (resp.status >= 500) {
          // Erreur serveur = connexion refusée (Vite proxy ne peut pas atteindre LM Studio)
          return { error: 'CONNECTION_REFUSED_LMSTUDIO' };
        }
        throw new Error(`HTTP ${resp.status}`);
      }
      const data = await resp.json();
      return (data.data || []).map(m => ({
        id: m.id,
        name: m.id,
        contextWindow: m.context_window || undefined,
      }));
    }
  } catch (err) {
    // Toute erreur de connexion (network, CORS, timeout, refuse) → retour d'erreur
    // plutôt que tableau vide pour que l'appelant puisse afficher un message explicite
    const errMsg = err.message || '';
    if (errMsg.includes('CONNECTION_REFUSED') ||
        errMsg.includes('Failed to fetch') ||
        errMsg.includes('ECONNREFUSED') ||
        errMsg.includes('NetworkError') ||
        errMsg.includes('TypeError')) {
      return { error: provider.id === 'ollama' ? 'CONNECTION_REFUSED_OLLAMA' : 'CONNECTION_REFUSED_LMSTUDIO' };
    }
    return [];
  }
}