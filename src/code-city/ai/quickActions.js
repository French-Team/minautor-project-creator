/**
 * Quick Actions — Actions rapides prédéfinies pour le panneau chat
 *
 * Chaque action a un prompt pré-rempli et peut nécessiter
 * une sélection de nœud(s) sur le canvas.
 *
 * @module quickActions
 */

export const QUICK_ACTIONS = [
  {
    id: 'analyze',
    label: '📊 Analyser',
    prompt: 'Analyse mon diagramme complet. Identifie les points forts, les risques, et propose des améliorations.',
  },
  {
    id: 'suggest',
    label: '💡 Suggérer',
    prompt: 'Regarde mon diagramme et suggère des éléments manquants ou des améliorations d\'architecture.',
  },
  {
    id: 'doc',
    label: '📝 Doc',
    prompt: 'Génère la documentation complète de mon projet à partir du diagramme.',
  },
  {
    id: 'enrich',
    label: '🔍 Enrichir sélection',
    prompt: 'Enrichis les propriétés des nœuds sélectionnés avec des descriptions techniques détaillées.',
    requiresSelection: true,
  },
  {
    id: 'fim',
    label: '⚡ Compléter code',
    prompt: 'Je veux compléter du code Mermaid. Donne-moi les suggestions de code pour améliorer mon diagramme actuel. Montre le code Mermaid complet.',
  },
];
