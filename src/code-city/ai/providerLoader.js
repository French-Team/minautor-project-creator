/**
 * providerLoader — Charge les configs provider depuis les fichiers JSON
 * Source unique de vérité : src/code-city/data/provider-configs.json
 */

import providerConfigs from '../data/provider-configs.json';
import providersGrid from '../data/providers-grid.json';

/**
 * Retourne le provider config complet pour un id
 * @param {string} id
 * @returns {object|null}
 */
export function getPreset(id) {
  return providerConfigs.providers.find((p) => p.id === id) || null;
}

/**
 * Retourne la catégorie d'un provider ('online' | 'local')
 * @param {string} id
 * @returns {string|null}
 */
export function getCategory(id) {
  const preset = getPreset(id);
  return preset ? preset.category : null;
}

/**
 * Retourne TOUS les providers
 * @returns {object[]}
 */
export function getAllPresets() {
  return providerConfigs.providers;
}

/**
 * Retourne les providers d'une catégorie
 * @param {'online'|'local'} category
 * @returns {object[]}
 */
export function getPresetsByCategory(category) {
  return providerConfigs.providers.filter((p) => p.category === category);
}

/**
 * Retourne le layout de la grille (providers-grid.json)
 * @returns {object}
 */
export function getGridLayout() {
  return providersGrid;
}

/**
 * Retourne les sections triées de la grille
 * @returns {object[]}
 */
export function getGridSections() {
  return providersGrid.sections.map((section) => ({
    ...section,
    providers: section.providers
      .filter((p) => p.visible)
      .sort((a, b) => a.order - b.order),
  }));
}

/**
 * Calcule la colonne (1 ou 2) depuis le nom du provider
 * 1 mot → colonne 1, multi-mots → colonne 2
 * @param {string} name
 * @returns {1|2}
 */
export function getColumnFromName(name) {
  return name.trim().split(/\s+/).length === 1 ? 1 : 2;
}

/**
 * Valide le provider stocké dans le state au démarrage
 * Vérifie que le provider.id existe toujours dans les configs
 * @param {string|null} storedProviderId
 * @returns {boolean}
 */
export function validateStoredProvider(storedProviderId) {
  if (!storedProviderId) return false;
  const preset = getPreset(storedProviderId);
  return preset !== null && preset.enabled;
}