/**
 * Context Builder — Construction du contexte canvas pour l'assistant Mina
 *
 * Fournit des fonctions pour construire le contexte du canvas
 * (nœuds, arêtes, sélection) sous une forme structurée pour les appels API.
 *
 * @module contextBuilder
 */

/**
 * Construit le contexte complet du canvas pour les appels API.
 * Inclut les nœuds, arêtes, et la sélection courante.
 *
 * @param {{ nodes: Array, edges: Array}} graph - État du graphe depuis state.js
 * @param {string[]} [selectedNodeIds] - IDs des nœuds sélectionnés
 * @returns {Object} Contexte structuré du canvas
 */
export function buildCanvasContext(graph, selectedNodeIds = []) {
  const { nodes, edges } = graph;

  const context = {
    totalNodes: nodes.filter(n => n.type !== 'hub').length,
    totalEdges: edges.length,
    nodes: nodes
      .filter(n => n.type !== 'hub')
      .map(n => ({
        id: n.id,
        type: n.type,
        label: n.label || n.id,
        description: n.description || '',
        priority: n.priority || 'medium',
        properties: n.properties || {},
        isSelected: selectedNodeIds.includes(n.id),
        connections: {
          incoming: edges.filter(e => e.to === n.id).map(e => e.from),
          outgoing: edges.filter(e => e.from === n.id).map(e => e.to),
        },
      })),
  };

  return context;
}

/**
 * Construit un prompt contextuel pour un nœud spécifique.
 * Utilisé quand l'utilisateur demande de l'aide sur un nœud particulier.
 *
 * @param {Object} node - Le nœud cible
 * @param {{ nodes: Array, edges: Array}} graph - État du graphe
 * @returns {string} Prompt contextuel formaté
 */
export function buildNodePrompt(node, graph) {
  const incoming = graph.edges.filter(e => e.to === node.id);
  const outgoing = graph.edges.filter(e => e.from === node.id);

  return [
    `Nœud : ${node.label || node.id}`,
    `Type : ${node.type}`,
    `Priorité : ${node.priority || 'medium'}`,
    node.description ? `Description : ${node.description}` : '',
    Object.keys(node.properties || {}).length > 0
      ? `Propriétés : ${JSON.stringify(node.properties, null, 2)}`
      : '',
    incoming.length > 0
      ? `Entrées : ${incoming.map(e => e.from).join(', ')}`
      : 'Pas d\'entrées',
    outgoing.length > 0
      ? `Sorties : ${outgoing.map(e => e.to).join(', ')}`
      : 'Pas de sorties',
  ].filter(Boolean).join('\n');
}
