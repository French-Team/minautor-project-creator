/**
 * FIM Handler — Complétion inline Fill-in-the-Middle (Codestral)
 *
 * Gère la complétion de code inline depuis l'onglet Code :
 *   - Extrait le prefix (texte avant sélection) et suffix (texte après)
 *   - Appelle fimCompletion() de aiClient.js
 *   - Insère le résultat dans le textarea avec animation de surbrillance
 *
 * Le FIM est exclusif au provider Mistral/Codestral.
 * Timeout 15s (plus court que le chat car c'est de la complétion inline).
 *
 * @module fimHandler
 */

import { fimCompletion } from './aiClient.js';
import { getState } from '../state.js';

const FIM_TIMEOUT_MS = 15000;

/**
 * Extrait le prefix (texte avant la sélection) et le suffix (texte après).
 * @param {HTMLTextAreaElement} textarea
 * @returns {{ prefix: string, suffix: string, selected: string } | null}
 */
export function extractFimParts(textarea) {
  const { selectionStart, selectionEnd, value } = textarea;
  const start = Math.min(selectionStart, selectionEnd);
  const end = Math.max(selectionStart, selectionEnd);
  if (start === end) return null;

  return {
    prefix: value.slice(0, start),
    selected: value.slice(start, end),
    suffix: value.slice(end),
  };
}

/**
 * Déclenche la complétion FIM sur un textarea Code.
 * Extrait prefix/suffix, appelle fimCompletion, retourne le résultat.
 *
 * @param {HTMLTextAreaElement} textarea - Le textarea #code-preview
 * @param {Function} [onStatus] - Callback (type: 'thinking'|'error'|'done', message: string)
 * @returns {Promise<string|null>} Le texte complété ou null si échec
 */
export async function triggerFimCompletion(textarea, onStatus) {
  const parts = extractFimParts(textarea);
  if (!parts) return null;

  const provider = getState().assistant?.provider;
  if (!provider?.id) {
    onStatus?.('error', 'Configure un provider dans le panneau Providers pour utiliser la complétion FIM.');
    return null;
  }
  if (provider.id !== 'codestral') {
    onStatus?.('error', 'La complétion FIM est disponible uniquement avec Codestral.');
    return null;
  }

  onStatus?.('thinking', `Complétion FIM — prefix: ${parts.prefix.length} chars, suffix: ${parts.suffix.length} chars…`);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FIM_TIMEOUT_MS);

    const result = await Promise.race([
      fimCompletion(provider, parts.prefix, parts.suffix),
      new Promise((_, reject) => {
        controller.signal.addEventListener('abort', () => reject(new Error('Timeout FIM (15s)')));
      }),
    ]);
    clearTimeout(timeoutId);

    if (!result.content) {
      onStatus?.('error', 'Aucune complétion générée.');
      return null;
    }

    onStatus?.('done', `Complétion FIM terminée (${result.content.length} caractères)`);
    return result.content;

  } catch (error) {
    onStatus?.('error', `Erreur FIM : ${error.message}`);
    return null;
  }
}

/**
 * Insère le texte FIM dans le textarea à la position du curseur.
 * Ajoute une animation de surbrillance sur le texte inséré.
 *
 * @param {HTMLTextAreaElement} textarea
 * @param {string} completion - Le texte généré par FIM
 */
export function insertFimCompletion(textarea, completion) {
  if (!completion) return;

  const { selectionStart, selectionEnd, value } = textarea;
  const newValue = value.slice(0, selectionStart) + completion + value.slice(selectionEnd);

  textarea.value = newValue;
  textarea.selectionStart = selectionStart;
  textarea.selectionEnd = selectionStart + completion.length;
  textarea.focus();

  // Déclencher l'événement input pour synchroniser le state
  textarea.dispatchEvent(new Event('input', { bubbles: true }));

  // Animation de surbrillance
  textarea.classList.add('fim-highlight');
  setTimeout(() => textarea.classList.remove('fim-highlight'), 2000);
}

/**
 * Vérifie si le provider courant supporte le FIM.
 * @returns {boolean}
 */
export function isFimAvailable() {
  const provider = getState().assistant?.provider;
  return provider?.id === 'codestral';
}
