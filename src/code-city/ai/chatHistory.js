/**
 * Chat History — Gestion de l'historique des messages de chat
 *
 * Gère l'ajout, la troncature et l'estimation des tokens
 * de l'historique de conversation avec l'assistant Mina.
 *
 * Stocké dans state.assistant.chatHistory et persisté dans localStorage.
 *
 * @module chatHistory
 */

/**
 * Nombre maximum de messages conservés dans l'historique.
 * Au-delà, les plus anciens (hors system prompt) sont supprimés.
 */
export const MAX_HISTORY_MESSAGES = 50;

/**
 * Limite approximative en caractères pour l'historique.
 * Utilisée pour les estimations de taille.
 */
export const MAX_HISTORY_CHARS = 30000;

/**
 * Structure d'un message dans l'historique.
 * @typedef {Object} ChatMessage
 * @property {'user'|'assistant'} role
 * @property {string} content
 * @property {number} timestamp
 * @property {Object} [metadata]
 * @property {string[]} [metadata.nodesAffected] - IDs des nœuds mentionnés
 * @property {'suggest'|'enrich'|'analyze'|'document'} [metadata.actionType]
 */

/**
 * Tronque l'historique en gardant le system prompt (index 0)
 * et les N derniers messages.
 * @param {ChatMessage[]} messages
 * @returns {ChatMessage[]}
 */
export function trimHistory(messages) {
  if (messages.length <= MAX_HISTORY_MESSAGES) return messages;
  return [messages[0], ...messages.slice(-(MAX_HISTORY_MESSAGES - 1))];
}

/**
 * Estime le nombre de tokens pour un texte donné.
 * Approximation : 1 token ≈ 4 caractères (français).
 * @param {string} text
 * @returns {number}
 */
export function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

/**
 * Estime le nombre total de tokens dans l'historique.
 * @param {ChatMessage[]} messages
 * @returns {number}
 */
export function estimateHistoryTokens(messages) {
  return messages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
}

/**
 * Crée un message structuré pour l'historique.
 * @param {'user'|'assistant'} role
 * @param {string} content
 * @param {Object} [metadata]
 * @returns {ChatMessage}
 */
export function createMessage(role, content, metadata = {}) {
  return {
    role,
    content,
    timestamp: Date.now(),
    metadata: {
      nodesAffected: metadata.nodesAffected || [],
      actionType: metadata.actionType || null,
      ...metadata,
    },
  };
}

/**
 * Vérifie si l'historique est vide (hors system prompt potentiel).
 * @param {ChatMessage[]} messages
 * @returns {boolean}
 */
export function isEmpty(messages) {
  return !messages || messages.length === 0;
}
