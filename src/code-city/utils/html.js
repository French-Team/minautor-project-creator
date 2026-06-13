/**
 * HTML Utilities — Helpers d'échappement HTML partagés
 *
 * Source unique pour `escapeHtml` et `escapeAttr` (juin 2026, refactor DRY).
 * Avant ce refactor, ces helpers étaient dupliqués dans 9 fichiers :
 *   - ai/apiKeysModal.js
 *   - ai/chatPanel.js
 *   - ai/markdownRenderer.js
 *   - ai/providerPanel.js
 *   - ai/toast.js
 *   - quartierCenter/centerTabs.js
 *   - quartierCenter/previewPanel.js
 *   - quartierRight/centerAuxPanels.js
 *   - quartierRight/exportPanel.js
 *
 * Usage :
 *   import { escapeHtml, escapeAttr } from '../utils/html.js';
 *   `<div>${escapeHtml(userInput)}</div>`
 *   `<input value="${escapeAttr(userInput)}" />`
 *
 * Sémantique :
 *   - escapeHtml : pour le contenu textuel entre balises (`<div>...</div>`)
 *   - escapeAttr : pour les valeurs d'attributs (`<input value="..." />`)
 *     Actuellement identique à escapeHtml, mais séparé pour permettre
 *     une évolution divergente (ex: échapper `'` pour les attributs entre
 *     apostrophes).
 *
 * @module html
 */

/**
 * Échappe les caractères HTML dangereux dans une chaîne pour insertion
 * dans le contenu textuel (entre balises).
 *
 * Échappe : & < > "
 *
 * @param {*} str - Valeur à échapper (sera convertie en string)
 * @returns {string} Chaîne échappée, sûre pour insertion dans innerHTML / template
 */
export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Échappe les caractères HTML dangereux dans une chaîne pour insertion
 * dans une valeur d'attribut HTML (entre guillemets).
 *
 * Actuellement identique à escapeHtml. Conservé comme fonction séparée
 * pour permettre une évolution future (ex: échapper `'` pour les
 * attributs entre apostrophes, ou ajouter un encodage URL).
 *
 * @param {*} str - Valeur à échapper (sera convertie en string)
 * @returns {string} Chaîne échappée, sûre pour valeur d'attribut HTML
 */
export function escapeAttr(str) {
  return escapeHtml(str);
}
