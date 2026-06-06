/**
 * AI Client — Client d'appel API LLM
 *
 * Fournit des fonctions pour interagir avec les providers IA :
 * - chatCompletion : appel chat standard (OpenAI-compat ou Gemini)
 * - fimCompletion  : complétion FIM pour Codestral (fill-in-the-middle)
 * - testConnection : test de connexion à un provider
 * - buildEndpointUrl : construit l'URL endpoint selon le provider
 * - fetchLocalModels : charge les modèles disponibles (Ollama/LM Studio)
 *
 * Les providers locaux (Ollama, LM Studio) sont routés via le proxy Vite
 * (vite.config.js) pour éviter les erreurs CORS cross-origin.
 */

/**
 * Convertit une URL de provider local en URL proxy pour éviter CORS.
 * En dev, le proxy Vite (/local-api/{id}/*) forward vers localhost:{port}.
 * En prod ou si le provider n'est pas local, retourne l'URL d'origine.
 *
 * @param {string} baseUrl - URL d'origine du provider (ex: http://localhost:1234/v1)
 * @param {string} providerId - ID du provider (ex: 'ollama', 'lmstudio')
 * @returns {string} URL proxy ou URL d'origine
 */
function toLocalUrl(baseUrl, providerId) {
  const localProviders = new Set(['ollama', 'lmstudio']);
  if (!localProviders.has(providerId)) return baseUrl;
  // On conserve le path après le host+port d'origine
  try {
    const u = new URL(baseUrl);
    const path = u.pathname + u.search + u.hash;
    return `/local-api/${providerId}${path}`;
  } catch {
    // URL relative ou invalide → on tente quand même
    const match = baseUrl.match(/^https?:\/\/[^/]+(\/?.*)$/);
    const path = match ? match[1] : baseUrl;
    return `/local-api/${providerId}${path}`;
  }
}

/**
 * Construit l'URL endpoint selon le format du provider.
 * - OpenAI-compatible (la plupart) : baseUrl + '/chat/completions'
 * - Gemini (REST natif) : format Gemini avec model:generateContent
 * @param {Object} provider - Provider courant
 * @returns {string} URL complète de l'endpoint
 */
export function buildEndpointUrl(provider) {
  if (provider.id === 'gemini') {
    return `${provider.baseUrl}/models/${provider.model}:generateContent?key=${provider.apiKey}`;
  }
  return `${provider.baseUrl}/chat/completions`;
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
  return {
    content: text,
    usage: {
      promptTokens: usage.promptTokenCount || 0,
      completionTokens: usage.candidatesTokenCount || 0,
    },
  };
}

/**
 * Parse une réponse OpenAI-compatible en format unifié.
 * @param {Object} data
 * @returns {{ content: string, usage: { promptTokens: number, completionTokens: number } }}
 */
function parseOpenAIResponse(data) {
  return {
    content: data.choices[0].message.content,
    usage: {
      promptTokens: data.usage?.prompt_tokens || 0,
      completionTokens: data.usage?.completion_tokens || 0,
    },
  };
}

/**
 * Appel un provider LLM.
 *
 * @param {Object} provider - Provider courant depuis state.assistant.provider
 * @param {Array} messages  - Historique [{ role: 'system'|'user'|'assistant', content }]
 * @returns {Promise<{ content: string, usage: { promptTokens: number, completionTokens: number } }>}
 */
export async function chatCompletion(provider, messages) {
  const { baseUrl, apiKey, model, temperature, maxTokens } = provider;

  let url = buildEndpointUrl(provider);
  url = toLocalUrl(url, provider.id);

  let headers = { 'Content-Type': 'application/json' };
  let body;
  let parseResponse;

  if (provider.id === 'gemini') {
    body = formatGeminiRequest(messages, model, temperature, maxTokens);
    parseResponse = parseGeminiResponse;
  } else {
    // OpenAI-compatible (OpenRouter, Ollama, LM Studio, Kilo, OpenCode Zen, Mistral, Groq)
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
    body = { model, messages, temperature, max_tokens: maxTokens, stream: false };
    parseResponse = parseOpenAIResponse;
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
  // Gemini ne supporte pas le streaming SSE standard — fallback
  if (provider.id === 'gemini') {
    const result = await chatCompletion(provider, messages);
    if (onToken) onToken(result.content);
    if (onDone) onDone();
    return result;
  }

  const { apiKey, model, temperature, maxTokens } = provider;
  let url = toLocalUrl(buildEndpointUrl(provider), provider.id);

  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  const body = {
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
    stream: true,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `Erreur HTTP ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullContent = '';
  let usage = { promptTokens: 0, completionTokens: 0 };
  let finished = false; // Guard contre l'appel double de onDone

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Parser les lignes SSE : chaque ligne commence par "data: "
      const lines = buffer.split('\n');
      // Garder la dernière ligne incomplète dans le buffer
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':')) continue; // ping ou ligne vide

        if (trimmed.startsWith('data: ')) {
          const dataStr = trimmed.slice(6);
          if (dataStr === '[DONE]') {
            // Flux terminé
            finished = true;
            if (onDone) onDone();
            return { content: fullContent, usage };
          }
          try {
            const chunk = JSON.parse(dataStr);
            // Format OpenAI : chunk.choices[0].delta.content
            const delta = chunk.choices?.[0]?.delta;
            if (delta?.content) {
              fullContent += delta.content;
              if (onToken) onToken(delta.content);
            }
            // Usage peut arriver dans le dernier chunk (selon le provider)
            if (chunk.usage) {
              usage = {
                promptTokens: chunk.usage.prompt_tokens || 0,
                completionTokens: chunk.usage.completion_tokens || 0,
              };
            }
          } catch {
            // Ligne SSE non-JSON (certains providers envoient du texte brut)
            if (dataStr !== '[DONE]') {
              fullContent += dataStr;
              if (onToken) onToken(dataStr);
            }
          }
        }
      }
    }

    // Si on sort de la boucle sans [DONE], traiter le buffer restant
    if (buffer.trim()) {
      const trimmed = buffer.trim();
      if (trimmed.startsWith('data: ')) {
        const dataStr = trimmed.slice(6);
        if (dataStr === '[DONE]') {
          finished = true;
        } else {
          try {
            const chunk = JSON.parse(dataStr);
            const delta = chunk.choices?.[0]?.delta;
            if (delta?.content) {
              fullContent += delta.content;
              if (onToken) onToken(delta.content);
            }
            if (chunk.usage) {
              usage = {
                promptTokens: chunk.usage.prompt_tokens || 0,
                completionTokens: chunk.usage.completion_tokens || 0,
              };
            }
          } catch {
            // Ignorer
          }
        }
      }
    }

    if (!finished && onDone) onDone();
    return { content: fullContent, usage };
  } catch (err) {
    if (!finished && onError) {
      onError(err);
      return { content: fullContent, usage };
    }
    throw err;
  }
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
 * @returns {Promise<{ content: string, usage: { promptTokens: number, completionTokens: number } }>}
 */
export async function fimCompletion(provider, prefix, suffix) {
  if (provider.id !== 'codestral') {
    throw new Error('FIM n\'est supporté que par Codestral');
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
 * - Providers locaux : vérifie que le serveur répond (GET /api/tags ou /v1/models)
 * - Providers en ligne : fait un appel minimal (chatCompletion avec prompt "Say ok")
 *
 * @param {Object} provider
 * @returns {Promise<{ ok: boolean, latency: number, error?: string, models?: Object }>}
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
      await chatCompletion(provider, [
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
 *
 * @param {Object} provider
 * @returns {Promise<Array<{ id: string, name: string, contextWindow?: number }>>}
 */
export async function fetchLocalModels(provider) {
  try {
    if (provider.id === 'ollama') {
      const resp = await fetch(`${toLocalUrl(provider.baseUrl.replace('/v1', ''), provider.id)}/api/tags`);
      const data = await resp.json();
      return (data.models || []).map(m => ({
        id: m.name,
        name: m.name,
        contextWindow: m.detail?.parameter_size ? undefined : 4096,
      }));
    } else {
      const resp = await fetch(`${toLocalUrl(provider.baseUrl, provider.id)}/models`);
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
