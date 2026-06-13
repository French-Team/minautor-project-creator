/**
 * Quick Actions — Actions rapides prédéfinies pour le panneau chat
 *
 * Chaque action a un prompt pré-rempli et peut nécessiter
 * une sélection de nœud(s) sur le canvas.
 *
 * Les actions sont organisées par catégories pour permettre
 * une barre d'actions multi-sélecteurs.
 *
 * **Source unique des icônes** : `chatIcons.js` (wrapper autour de
 * `lucide-static`). `quickActions.js` n'importe plus directement depuis
 * `lucide-static` — `getActionIcon()` est un simple re-export de
 * `getChatIcon()` pour rétrocompatibilité avec les callers existants.
 *
 * @module quickActions
 */

import { getChatIcon } from '../chatIcons.js';

/**
 * Wrapper rétrocompatible autour de `getChatIcon()`.
 * Conservé pour ne pas casser les ~15 callers dans `chatPanel.js` qui
 * utilisent `getActionIcon('bar-chart', 11)` etc. avec des clés kebab-case.
 *
 * Pour les nouveaux usages, préférer `getChatIcon()` directement.
 *
 * @param {string} key - Clé kebab-case de l'icône (ex: 'bar-chart', 'alert-triangle')
 * @param {number} [size=14] - Taille en pixels
 * @returns {string} Le HTML SVG, ou '' si l'icône n'existe pas
 */
export function getActionIcon(key, size = 14) {
  return getChatIcon(key, size);
}

/**
 * Catégories d'actions rapides.
 * Chaque catégorie a un label et une liste d'actions.
 * Nouvelles catégories peuvent être ajoutées ici pour enrichir la barre.
 */
export const QUICK_ACTION_CATEGORIES = [
  {
    id: 'analysis',
    label: 'Analyse',
    icon: 'bar-chart',
    actions: [
      {
        id: 'analyze',
        label: 'Analyser',
        icon: 'bar-chart',
        prompt: 'Analyse mon diagramme complet. Identifie les points forts, les risques, et propose des améliorations.',
      },
      {
        id: 'suggest',
        label: 'Suggérer',
        icon: 'lightbulb',
        prompt: 'Regarde mon diagramme et suggère des éléments manquants ou des améliorations d\'architecture.',
      },
    ],
  },
  {
    id: 'documentation',
    label: 'Documentation',
    icon: 'file-text',
    actions: [
      {
        id: 'doc',
        label: 'Générer doc',
        icon: 'file-text',
        prompt: 'Génère la documentation complète de mon projet à partir du diagramme.',
      },
    ],
  },
  {
    id: 'editing',
    label: 'Édition',
    icon: 'zap',
    actions: [
      {
        id: 'enrich',
        label: 'Enrichir sélection',
        icon: 'search',
        prompt: 'Enrichis les propriétés des nœuds sélectionnés avec des descriptions techniques détaillées.',
        requiresSelection: true,
      },
      {
        id: 'fim',
        label: 'Compléter code',
        icon: 'zap',
        prompt: 'Je veux compléter du code Mermaid. Donne-moi les suggestions de code pour améliorer mon diagramme actuel. Montre le code Mermaid complet.',
      },
    ],
  },
];

// QUICK_ACTIONS supprimé lors de l'unification (juin 2026) — aucun import existait.
