/**
 * Trace Logger — Système de traçage centralisé
 *
 * Émet des logs vers la console DevTools et un buffer accessible via window.__CHAT_LOG_BUFFER.
 * Activé par VITE_CHAT_DEBUG=true au build, strippé en prod (dead-code-eliminated par Vite/Rollup).
 *
 * Usage:
 *   import { traceChat, tracePromptEngine, traceOptimizer, traceAiClient, traceSystemPrompt } from './traceLogger.js';
 *   traceChat('sendMessage ENTRY', { text, skipUser });
 *   traceChat('onToken', { tokenLen, cumLen });
 *
 * @module traceLogger
 */

// Constante remplacée par Vite au build : si VITE_CHAT_DEBUG !== 'true' ou '1',
// toutes les fonctions trace*() sont des no-ops (dead-code-eliminated en prod).
const CHAT_DEBUG = import.meta.env?.VITE_CHAT_DEBUG === 'true' ||
                   import.meta.env?.VITE_CHAT_DEBUG === '1' ||
                   false;

// Ring buffer accessible depuis la console DevTools (max 500 entrées, FIFO)
if (typeof window !== 'undefined' && !window.__CHAT_LOG_BUFFER) {
  window.__CHAT_LOG_BUFFER = [];
}
const MAX_BUFFER_SIZE = 500;
const t0 = Date.now();

/**
 * Émet un log du module chat panel (préfixe [CHAT]).
 * @param {string} event - Nom de l'événement (ex: 'sendMessage', 'onToken')
 * @param {Object} [data] - Données associées (objet sérialisable)
 */
export function traceChat(event, data) {
  if (!CHAT_DEBUG) return;
  _emit('[CHAT]', event, data);
}

/**
 * Émet un log du module prompt engine (préfixe [PROMPT-ENGINE]).
 * @param {string} event
 * @param {Object} [data]
 */
export function tracePromptEngine(event, data) {
  if (!CHAT_DEBUG) return;
  _emit('[PROMPT-ENGINE]', event, data);
}

/**
 * Émet un log du module optimiseur (préfixe [OPTIMIZER]).
 * @param {string} event
 * @param {Object} [data]
 */
export function traceOptimizer(event, data) {
  if (!CHAT_DEBUG) return;
  _emit('[OPTIMIZER]', event, data);
}

/**
 * Émet un log du module aiClient (chatCompletion / streamChatCompletion / parseOpenAIResponse).
 * @param {string} event
 * @param {Object} [data]
 */
export function traceAiClient(event, data) {
  if (!CHAT_DEBUG) return;
  _emit('[AI-CLIENT]', event, data);
}

/**
 * Émet un log du module systemPrompt (buildSystemMessages).
 * @param {string} event
 * @param {Object} [data]
 */
export function traceSystemPrompt(event, data) {
  if (!CHAT_DEBUG) return;
  _emit('[SYSTEM-PROMPT]', event, data);
}

/**
 * Émet un log dans la console et le buffer.
 * Format mixte : ligne d'événement courte (toujours visible) + console.groupCollapsed()
 * avec détails collapsibles (event, data, time).
 *
 * @private
 * @param {string} prefix - Préfixe du module (ex: '[CHAT]')
 * @param {string} event  - Nom de l'événement
 * @param {Object} [data] - Données sérialisables (objet ou undefined)
 */
function _emit(prefix, event, data) {
  const elapsed = Date.now() - t0;
  const line = `${prefix} [+${elapsed}ms] ${event}`;

  if (data !== undefined) {
    // Format mixte : log court (toujours visible) + groupe collapsible avec détails
    console.log(line);
    console.groupCollapsed(`${prefix} details`);
    console.log('event:', event);
    console.log('data:', data);
    console.log('time:', `${elapsed}ms`);
    console.groupEnd();
  } else {
    // Pas de data → log simple, pas de groupe
    console.log(line);
  }

  // Push au buffer (copie shallow pour éviter mutations externes)
  if (typeof window !== 'undefined' && window.__CHAT_LOG_BUFFER) {
    const entry = { ts: Date.now(), elapsedMs: elapsed, prefix, event, data };
    window.__CHAT_LOG_BUFFER.push(entry);
    if (window.__CHAT_LOG_BUFFER.length > MAX_BUFFER_SIZE) {
      window.__CHAT_LOG_BUFFER.shift(); // FIFO : drop la plus ancienne
    }
  }
}
