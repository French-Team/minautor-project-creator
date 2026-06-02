/**
 * Canvas Renderer
 *
 * Synchronise l'état du graphe (state.nodes / state.edges) avec le DOM du
 * canvas. C'est le SEUL module autorisé à manipuler les éléments
 * `.canvas-element` et le SVG d'arêtes dans `#canvas-content`.
 *
 * Le renderer ne mute jamais l'état directement. Il écoute les changements
 * via `subscribe()` et dispatche des actions via `actions.*` en réponse
 * aux interactions utilisateur.
 */

import { getState, subscribe, actions } from '../state.js';
import { log } from '../utils.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const GRID_SIZE = 20;

let canvasContent = null;
let canvasArea = null;
let svgLayer = null;
let nodeElements = new Map();   // id → HTMLElement
let edgeElements = new Map();   // id → { line, label? }
let interaction = null;        // état de l'interaction en cours (drag, connect...)
let dragConnection = null;     // { fromId, fromPort, ghostEl } pendant un drag de connexion

export function initializeCanvasRenderer() {
  log('🎨 Initialisation du canvas renderer', 'info');

  canvasContent = document.getElementById('canvas-content');
  canvasArea = document.querySelector('.canvas-area');
  if (!canvasContent) {
    throw new Error('Canvas content introuvable');
  }

  ensureSvgLayer();
  setupCanvasInteractions();
  subscribe(handleStateChange);
  renderAll();
  log('✅ Canvas renderer initialisé', 'success');
}

function handleStateChange(state, meta = {}) {
  // Sync le DOM avec le state
  syncNodes(state.nodes);
  syncEdges(state.edges);
  applySelectionStyle(state.selection);
  applyConnectionState();
  applyZoom();
}

/* --------------------------------------------------------------------------
 * Rendu
 * -------------------------------------------------------------------------- */

function ensureSvgLayer() {
  svgLayer = canvasContent.querySelector('svg.edges-layer');
  if (!svgLayer) {
    svgLayer = document.createElementNS(SVG_NS, 'svg');
    svgLayer.setAttribute('class', 'edges-layer');
    svgLayer.style.position = 'absolute';
    svgLayer.style.top = '0';
    svgLayer.style.left = '0';
    svgLayer.style.width = '100%';
    svgLayer.style.height = '100%';
    svgLayer.style.pointerEvents = 'none';
    svgLayer.style.overflow = 'visible';

    // Flèche
    const defs = document.createElementNS(SVG_NS, 'defs');
    const marker = document.createElementNS(SVG_NS, 'marker');
    marker.setAttribute('id', 'arrowhead');
    marker.setAttribute('viewBox', '0 0 10 10');
    marker.setAttribute('refX', '9');
    marker.setAttribute('refY', '5');
    marker.setAttribute('markerWidth', '8');
    marker.setAttribute('markerHeight', '8');
    marker.setAttribute('orient', 'auto-start-reverse');
    const arrowPath = document.createElementNS(SVG_NS, 'path');
    arrowPath.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
    arrowPath.setAttribute('fill', 'currentColor');
    marker.appendChild(arrowPath);
    defs.appendChild(marker);
    svgLayer.appendChild(defs);

    canvasContent.appendChild(svgLayer);
  }
}

function renderAll() {
  const { nodes, edges } = getState();
  syncNodes(nodes);
  syncEdges(edges);
  applyZoom();
}

function syncNodes(nodes) {
  const incomingIds = new Set(nodes.map((n) => n.id));
  // Supprimer les éléments du DOM qui ne sont plus dans le state
  for (const [id, el] of nodeElements) {
    if (!incomingIds.has(id)) {
      el.remove();
      nodeElements.delete(id);
    }
  }
  // Ajouter ou mettre à jour
  for (const node of nodes) {
    let el = nodeElements.get(node.id);
    if (!el) {
      el = createNodeElement(node);
      canvasContent.appendChild(el);
      nodeElements.set(node.id, el);
    }
    updateNodeElement(el, node);
  }
}

function updateNodeElement(el, node) {
  if (el.dataset.id !== node.id) {
    // L'ID du nœud a changé (ex: type modifié → freshNodeId)
    el.dataset.id = node.id;
    for (const [, group] of edgeElements) {
      // Les edges utilisent leur `from`/`to` du state, pas le DOM
    }
  }
  el.dataset.type = node.type;
  el.style.left = `${node.x}px`;
  el.style.top = `${node.y}px`;
  el.querySelector('.element-icon').textContent = node.icon || '';
  el.querySelector('.element-name').textContent = node.label || '';
}

function nodeAnchor(node, port = 'center') {
  // Position monde (le .canvas-element est en position:absolute dans le canvas)
  const cx = node.x + 60; // ~centre (min-width 110)
  const cy = node.y + 18; // ~mi-hauteur
  if (port === 'in')  return { x: node.x,        y: cy };
  if (port === 'out') return { x: node.x + 120,  y: cy };
  return { x: cx, y: cy };
}

function applyZoom() {
  const { zoom, pan } = getState().view;
  canvasContent.style.transform = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`;
}

function syncEdges(edges) {
  const incomingIds = new Set(edges.map((e) => e.id));
  // Supprimer
  for (const [id, group] of edgeElements) {
    if (!incomingIds.has(id)) {
      (group.line?.parentNode || group.parentNode)?.remove();
      edgeElements.delete(id);
    }
  }
  // Ajouter / mettre à jour
  for (const edge of edges) {
    let group = edgeElements.get(edge.id);
    if (!group) {
      group = createEdgeElement(edge);
      svgLayer.appendChild(group);
      edgeElements.set(edge.id, group);
    }
    updateEdgeElement(group, edge);
  }
}

function createEdgeElement(edge) {
  const g = document.createElementNS(SVG_NS, 'g');
  g.setAttribute('class', 'edge-group');
  g.dataset.id = edge.id;
  // Hit area élargie (invisible)
  const hit = document.createElementNS(SVG_NS, 'path');
  hit.setAttribute('class', 'canvas-edge-hit');
  hit.setAttribute('stroke', 'transparent');
  hit.setAttribute('stroke-width', '16');
  hit.setAttribute('fill', 'none');
  g.appendChild(hit);
  // Ligne visible
  const line = document.createElementNS(SVG_NS, 'path');
  line.setAttribute('class', 'canvas-edge');
  line.setAttribute('marker-end', 'url(#arrowhead)');
  g.appendChild(line);
  // Bouton × au midpoint
  const handle = document.createElementNS(SVG_NS, 'g');
  handle.setAttribute('class', 'edge-handle');
  const bg = document.createElementNS(SVG_NS, 'circle');
  bg.setAttribute('class', 'edge-handle__bg');
  bg.setAttribute('r', '8');
  handle.appendChild(bg);
  const x1 = document.createElementNS(SVG_NS, 'line');
  x1.setAttribute('class', 'edge-handle__icon');
  x1.setAttribute('x1', '-3'); x1.setAttribute('y1', '-3');
  x1.setAttribute('x2', '3');  x1.setAttribute('y2', '3');
  x1.setAttribute('stroke-width', '1.5');
  const x2 = document.createElementNS(SVG_NS, 'line');
  x2.setAttribute('class', 'edge-handle__icon');
  x2.setAttribute('x1', '-3'); x2.setAttribute('y1', '3');
  x2.setAttribute('x2', '3');  x2.setAttribute('y2', '-3');
  x2.setAttribute('stroke-width', '1.5');
  handle.appendChild(x1);
  handle.appendChild(x2);
  g.appendChild(handle);
  // Click × → removeEdge
  handle.addEventListener('mousedown', (e) => e.stopPropagation());
  handle.addEventListener('click', (e) => {
    e.stopPropagation();
    actions.removeEdge(edge.id);
    actions.setStatusMessage('Connexion supprimée', 'info');
  });
  // Stocker les références
  g.line = line;
  g.hit = hit;
  g.handle = handle;
  return g;
}

function updateEdgeElement(group, edge) {
  const { nodes } = getState();
  const from = nodes.find((n) => n.id === edge.from);
  const to = nodes.find((n) => n.id === edge.to);
  if (!from || !to) return;
  const p1 = nodeAnchor(from, 'out');
  const p2 = nodeAnchor(to, 'in');
  // Courbe de Bézier pour un arrondi naturel
  const dx = Math.max(40, Math.abs(p2.x - p1.x) * 0.4);
  const d = `M ${p1.x} ${p1.y} C ${p1.x + dx} ${p1.y}, ${p2.x - dx} ${p2.y}, ${p2.x} ${p2.y}`;
  group.line.setAttribute('d', d);
  group.hit.setAttribute('d', d);
  // × au milieu
  const mx = (p1.x + p2.x) / 2;
  const my = (p1.y + p2.y) / 2;
  group.handle.setAttribute('transform', `translate(${mx} ${my})`);
}

function createNodeElement(node) {
  const el = document.createElement('div');
  el.className = 'canvas-element';
  el.dataset.id = node.id;
  el.dataset.type = node.type;
  el.innerHTML = `
    <button class="port port--in" data-port="in" type="button" aria-label="Port d'entrée"></button>
    <div class="element-body">
      <span class="element-icon"></span>
      <span class="element-name"></span>
      <button class="element-delete" type="button" title="Supprimer (Suppr)" aria-label="Supprimer">×</button>
    </div>
    <button class="port port--out" data-port="out" type="button" aria-label="Port de sortie"></button>
  `;

  // Bouton supprimer (inline)
  const deleteBtn = el.querySelector('.element-delete');
  deleteBtn.addEventListener('mousedown', (e) => e.stopPropagation());
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    actions.removeNode(node.id);
    actions.setStatusMessage('Élément supprimé', 'info');
  });

  // Ports : mousedown démarre un drag, mouseup complète (ou annule)
  el.querySelectorAll('.port').forEach((portEl) => {
    portEl.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      startConnectionDrag(node.id, portEl.dataset.port, e);
    });
  });

  el.addEventListener('mousedown', (e) => onNodeMouseDown(e, node.id));
  return el;
}

/* --------------------------------------------------------------------------
 * Drag-to-connect : mousedown sur port → drag avec ligne fantôme → mouseup
 * sur un autre port = connexion. mouseup ailleurs = annule.
 * -------------------------------------------------------------------------- */

function startConnectionDrag(nodeId, port, startEvent) {
  if (dragConnection) return;
  // État du store (utilisé pour le feedback visuel : connect-source, etc.)
  actions.startConnection(nodeId, port);
  // Ligne fantôme dans le SVG
  const ghost = createGhostLine();
  dragConnection = { fromId: nodeId, fromPort: port, ghostEl: ghost };
  updateGhostLine(ghost, startEvent);
  document.addEventListener('mousemove', onConnectionDragMove);
  document.addEventListener('mouseup', onConnectionDragEnd);
}

function onConnectionDragMove(e) {
  if (!dragConnection) return;
  updateGhostLine(dragConnection.ghostEl, e);
  // Met en surbrillance le port sous la souris
  const portEl = e.target?.closest?.('.port');
  const targetNodeId = portEl?.closest?.('.canvas-element')?.dataset.id;
  for (const [id, el] of nodeElements) {
    el.classList.toggle('connect-target', id === targetNodeId && id !== dragConnection.fromId);
  }
}

function onConnectionDragEnd(e) {
  if (!dragConnection) return;
  const { fromId, ghostEl } = dragConnection;
  document.removeEventListener('mousemove', onConnectionDragMove);
  document.removeEventListener('mouseup', onConnectionDragEnd);

  // Cleanup
  for (const el of nodeElements.values()) el.classList.remove('connect-target');
  ghostEl.remove();
  dragConnection = null;

  // Cible ?
  const portEl = e.target?.closest?.('.port');
  const targetNodeId = portEl?.closest?.('.canvas-element')?.dataset.id;
  const targetPort = portEl?.dataset?.port;

  if (targetNodeId && targetNodeId !== fromId) {
    const edge = actions.completeConnection(targetNodeId, targetPort);
    if (edge) {
      actions.setStatusMessage('Connexion créée', 'success');
    } else {
      actions.setStatusMessage('Connexion déjà existante', 'warning');
    }
  } else {
    actions.cancelConnection();
  }
}

function createGhostLine() {
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('class', 'connection-ghost');
  path.setAttribute('fill', 'none');
  svgLayer.appendChild(path);
  return path;
}

function updateGhostLine(ghost, mouseEvent) {
  if (!dragConnection) return;
  const fromNode = getState().nodes.find((n) => n.id === dragConnection.fromId);
  if (!fromNode) return;
  const p1 = nodeAnchor(fromNode, dragConnection.fromPort);
  const p2 = getMouseWorldPos(mouseEvent);
  ghost.setAttribute('d', `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`);
  // Met à jour la couleur de la flèche (currentColor dans le marker)
  ghost.style.color = 'var(--accent)';
}

function getMouseWorldPos(mouseEvent) {
  const rect = canvasContent.getBoundingClientRect();
  const { zoom, pan } = getState().view;
  return {
    x: (mouseEvent.clientX - rect.left) / zoom - pan.x,
    y: (mouseEvent.clientY - rect.top) / zoom - pan.y,
  };
}

function applyConnectionState() {
  const { connection } = getState();
  const isConnecting = !!connection.from;
  document.body.classList.toggle('mode-connect', isConnecting);
  for (const [id, el] of nodeElements) {
    el.classList.toggle('connect-source', isConnecting && connection.from === id);
    el.classList.toggle('connect-target', isConnecting && connection.from && connection.from !== id);
  }
}

function applySelectionStyle(selection) {
  for (const [id, el] of nodeElements) {
    el.classList.toggle('selected', selection.nodes.has(id));
  }
  for (const [id, group] of edgeElements) {
    const line = group.line || group;
    line.classList?.toggle?.('selected', selection.edges.has(id));
  }
}

/* --------------------------------------------------------------------------
 * Interactions
 * -------------------------------------------------------------------------- */

function setupCanvasInteractions() {
  // Drop depuis la sidebar
  canvasContent.addEventListener('dragover', (e) => {
    if (Array.from(e.dataTransfer.types).includes('application/json')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  });
  canvasContent.addEventListener('drop', (e) => onCanvasDrop(e));

  // Clic sur le fond du canvas = désélection + annule une connexion en cours
  canvasContent.addEventListener('mousedown', (e) => {
    if (e.target === canvasContent || e.target === svgLayer) {
      if (getState().connection.from) {
        actions.cancelConnection();
        actions.setStatusMessage('Connexion annulée', 'info');
      } else {
        actions.deselectAll();
      }
    }
  });

  // Raccourcis clavier globaux
  document.addEventListener('keydown', (e) => {
    const tag = (e.target?.tagName || '').toLowerCase();
    const inField = tag === 'input' || tag === 'textarea' || e.target?.isContentEditable;
    if (inField) return;

    if (e.key === 'Delete' || e.key === 'Backspace') {
      const { selection } = getState();
      if (selection.nodes.size === 0 && selection.edges.size === 0) return;
      e.preventDefault();
      for (const id of selection.nodes) actions.removeNode(id);
      for (const id of selection.edges) actions.removeEdge(id);
      actions.setStatusMessage('Sélection supprimée', 'info');
    } else if (e.key === 'Escape') {
      // Annule un drag de connexion en cours (s'il y en a un)
      if (dragConnection) {
        document.removeEventListener('mousemove', onConnectionDragMove);
        document.removeEventListener('mouseup', onConnectionDragEnd);
        dragConnection.ghostEl?.remove();
        dragConnection = null;
      }
      if (getState().connection.from) {
        actions.cancelConnection();
        actions.setStatusMessage('Connexion annulée', 'info');
      }
    }
  });
}

function onCanvasDrop(e) {
  e.preventDefault();
  let payload;
  try {
    const raw = e.dataTransfer.getData('application/json');
    if (raw) payload = JSON.parse(raw);
  } catch (_) {
    payload = null;
  }
  if (!payload || !payload.type) return;

  const rect = canvasContent.getBoundingClientRect();
  const { zoom, pan } = getState().view;
  // Coordonnées "monde" : on inverse scale + translate
  const x = (e.clientX - rect.left) / zoom - pan.x;
  const y = (e.clientY - rect.top) / zoom - pan.y;

  actions.addNode({
    type: payload.type,
    label: payload.label || 'Nouveau',
    icon: payload.icon,
    x,
    y,
    priority: 'medium',
  });
  actions.setStatusMessage(`${payload.label || 'Élément'} ajouté`, 'success');
}

function onNodeMouseDown(e, nodeId) {
  if (e.button !== 0) return;
  if (e.target.closest('.element-delete')) return;

  e.preventDefault();
  e.stopPropagation();
  actions.selectNode(nodeId, e.shiftKey || e.ctrlKey || e.metaKey);

  // Démarrer le drag
  const state = getState();
  const node = state.nodes.find((n) => n.id === nodeId);
  if (!node) return;

  const { zoom } = state.view;
  const canvasRect = canvasContent.getBoundingClientRect();
  const offsetX = (e.clientX - canvasRect.left) / zoom - node.x;
  const offsetY = (e.clientY - canvasRect.top) / zoom - node.y;

  interaction = { type: 'drag', nodeId, offsetX, offsetY };

  document.addEventListener('mousemove', onNodeDragMove);
  document.addEventListener('mouseup', onNodeDragEnd, { once: true });
}

function onNodeDragMove(e) {
  if (!interaction || interaction.type !== 'drag') return;
  const { nodeId, offsetX, offsetY } = interaction;
  const state = getState();
  const { zoom, pan } = state.view;
  const canvasRect = canvasContent.getBoundingClientRect();
  const x = (e.clientX - canvasRect.left) / zoom - pan.x - offsetX;
  const y = (e.clientY - canvasRect.top) / zoom - pan.y - offsetY;
  // Mutation directe ici est OK (déjà dans un sous-flux d'interaction),
  // mais on passe par l'action pour respecter la convention et garder
  // l'historique propre : on accumule les positions et on commit au mouseup.
  if (!interaction._lastPos) interaction._lastPos = { x, y };
  interaction._lastPos = { x, y };
  // Mise à jour visuelle directe (sans push history à chaque frame)
  const el = nodeElements.get(nodeId);
  if (el) {
    let nx = x;
    let ny = y;
    if (state.view.snapToGrid) {
      nx = Math.round(nx / GRID_SIZE) * GRID_SIZE;
      ny = Math.round(ny / GRID_SIZE) * GRID_SIZE;
    }
    el.style.left = `${nx}px`;
    el.style.top = `${ny}px`;
  }
}

function onNodeDragEnd() {
  document.removeEventListener('mousemove', onNodeDragMove);
  if (!interaction || interaction.type !== 'drag') return;
  const { nodeId, _lastPos } = interaction;
  if (_lastPos) {
    actions.updateNode(nodeId, { x: _lastPos.x, y: _lastPos.y });
  }
  interaction = null;
  // Re-render des arêtes (les positions des nœuds ont changé)
  syncEdges(getState().edges);
}
