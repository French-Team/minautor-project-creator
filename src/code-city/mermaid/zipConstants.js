/**
 * ZIP Constants — Constantes partagées pour l'export ZIP par sprints
 *
 * Utilisées par :
 *   - zipExporter.js  (génération du ZIP)
 *   - exportPanel.js  (aperçu modal)
 *
 * Single source of truth : toute modification ici se répercute aux deux endroits.
 */

/** Ordre des sprints par priorité (du plus critique au backlog). */
export const PRIORITY_ORDER = ['critical', 'high', 'medium', 'low'];

/** Métadonnées de chaque sprint (dossier, titre, emoji, description). */
export const SPRINT_META = {
  critical: {
    folder: 'sprint-1-critical',
    title: 'Sprint 1 — Critique',
    emoji: '🔴',
    description: 'Éléments critiques à traiter en priorité absolue. Ces éléments bloquent le reste du projet ou représentent des risques majeurs.',
  },
  high: {
    folder: 'sprint-2-high',
    title: 'Sprint 2 — Prioritaire',
    emoji: '🟠',
    description: 'Éléments importants qui doivent être traités rapidement après les critiques.',
  },
  medium: {
    folder: 'sprint-3-medium',
    title: 'Sprint 3 — Standard',
    emoji: '🟡',
    description: 'Éléments de développement courant. Planifier dans les itérations suivantes.',
  },
  low: {
    folder: 'sprint-4-low',
    title: 'Sprint 4 — Secondaire',
    emoji: '🟢',
    description: 'Éléments à traiter en dernier ou si du temps est disponible.',
  },
  none: {
    folder: 'sprint-5-backlog',
    title: 'Sprint 5 — Backlog',
    emoji: '⚪',
    description: 'Éléments sans priorité définie. À catégoriser et replanifier.',
  },
};

/**
 * Renvoie la clé de sprint pour une priorité donnée.
 * @param {string|undefined} p - Priorité du nœud
 * @returns {string} Clé dans SPRINT_META ('critical'|'high'|'medium'|'low'|'none')
 */
export function getPriorityKey(p) {
  return PRIORITY_ORDER.includes(p) ? p : 'none';
}

/**
 * Nettoie un nom pour en faire un nom de fichier sûr.
 * @param {string} name - Le nom brut
 * @returns {string} Le nom nettoyé, tronqué à 80 caractères
 */
export function sanitizeFilename(name) {
  return String(name)
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'unnamed';
}
