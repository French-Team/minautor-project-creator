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
import { getIcon, iconLink, iconCog, iconTrash, iconDisconnect, iconXMark, iconRefresh, iconBranch } from '../icons.js';

import { openPropertiesAndFocusLabel } from '../quartierCenter/centerTabs.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const GRID_SIZE = 20;

let canvasContent = null;
let canvasArea = null;
let svgLayer = null;
let nodeElements = new Map();   // id → HTMLElement
let edgeElements = new Map();   // id → { line, label? }
let interaction = null;        // état de l'interaction en cours (drag, connect...)
let dragConnection = null;     // { fromId, fromPort, ghostEl } pendant un drag de connexion
const livePositions = new Map(); // id → {x, y} : position visuelle en cours de drag (non commitée)

// Menu actif : un seul à la fois, déclenché par clic (pas survol)
// null | { type: 'node', id } | { type: 'port', id, port }
let activeMenu = null;
let menuCloseTimeout = null;  // délai avant fermeture (laisse le temps de survoler le menu port)

// Connexion "armée" : après un clic "Connecter" du menu, on attend que
// l'utilisateur clique sur un AUTRE port pour créer la connexion.
let connectArmed = null;       // { fromId, fromPort, ghostEl } | null
let lastMouseEvent = null;     // dernier mousemove (pour positionner le ghost au arm)

// Interaction en attente (pour distinguer clic court d'un drag)
let pendingDown = null;        // { type, id, port?, startX, startY }
let hubPickerEl = null;        // popup de choix du nombre de branches
const DRAG_THRESHOLD = 4;      // pixels avant de considérer que c'est un drag

export function initializeCanvasRenderer() {
  console.log('🎨 Initialisation du canvas renderer');

  canvasContent = document.getElementById('canvas-content');
  canvasArea = document.querySelector('.canvas-area');
  if (!canvasContent) {
    throw new Error('Canvas content introuvable');
  }

  ensureSvgLayer();
  setupCanvasInteractions();
  subscribe(handleStateChange);
  renderAll();
  console.log('✅ Canvas renderer initialisé');
}

function handleStateChange(state, meta = {}) {
  // Sync le DOM avec le state
  syncNodes(state.nodes);
  syncEdges(state.edges);
  applySelectionStyle(state.selection);
  applyConnectionState();
  applyPortConnectionState();
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

function updateHubElement(el, node) {
  el.dataset.type = 'hub';
  el.dataset.branches = String(node.hubBranches || 4);
  el.style.left = `${node.x}px`;
  el.style.top = `${node.y}px`;
  const body = el.querySelector('.hub-body');
  if (body) body.querySelector('.element-icon').innerHTML = getIcon('hub');
  // Mettre à jour les positions des branches SVG et ports
  const branches = node.hubBranches || 4;
  const { RADIUS, LINE_RADIUS, startAngle, angleStep } = getHubBranchParams(node);
  const hubSize = 160;
  const cx = hubSize / 2;
  const cy = hubSize / 2;
  const svg = el.querySelector('.hub-branches-svg');
  if (svg) {
    svg.innerHTML = '';
    for (let i = 0; i < branches; i++) {
      const angle = startAngle + i * angleStep;
      const line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('x1', cx);
      line.setAttribute('y1', cy);
      line.setAttribute('x2', cx + LINE_RADIUS * Math.cos(angle));
      line.setAttribute('y2', cy + LINE_RADIUS * Math.sin(angle));
      line.setAttribute('class', 'hub-branch-line');
      svg.appendChild(line);
    }
  }
  el.querySelectorAll('.hub-port').forEach((portEl, i) => {
    const angle = startAngle + i * angleStep;
    portEl.style.left = `${cx + RADIUS * Math.cos(angle)}px`;
    portEl.style.top = `${cy + RADIUS * Math.sin(angle)}px`;
  });
}

function updateNodeElement(el, node) {
  // Hub : vérifier si le nombre de branches a changé → recréer
  if (node.type === 'hub') {
    const currentBranches = parseInt(el.dataset.branches || '0', 10);
    if (currentBranches !== (node.hubBranches || 4)) {
      const newEl = createNodeElement(node);
      el.replaceWith(newEl);
      nodeElements.set(node.id, newEl);
      return;
    }
    updateHubElement(el, node);
    return;
  }
  if (el.dataset.id !== node.id) {
    el.dataset.id = node.id;
  }
  el.dataset.type = node.type;
  if (node.color) {
    el.dataset.color = node.color;
  } else {
    delete el.dataset.color;
  }
  el.style.left = `${node.x}px`;
  el.style.top = `${node.y}px`;
  // L'icône vient de la variante (si définie) ou du type
  const iconKey = node.icon || node.type;
  el.querySelector('.element-icon').innerHTML = getIcon(iconKey);
  el.querySelector('.element-name').textContent = node.label || '';
}

function nodeAnchor(node, port = 'center') {
  // Si le nœud est en cours de drag, on utilise la position live (non commitée)
  // pour que les arêtes suivent visuellement.
  const pos = livePositions.get(node.id) || node;
  // Lit les dimensions réelles de l'élément DOM (largeur variable selon le label)
  const el = nodeElements.get(node.id);
  const w = el?.offsetWidth  || 110;
  const h = el?.offsetHeight || 36;
  const cy = pos.y + h / 2;
  // Ports en CSS (border-box) : `left: -7px` et `right: -7px`, taille 12px
  // → centre IN  = pos.x - 1
  // → centre OUT = pos.x + w + 1
  if (port === 'in')      return { x: pos.x - 1,           y: cy };
  if (port === 'out')     return { x: pos.x + w + 1,       y: cy };
  if (port === 'top')     return { x: pos.x + w / 2,       y: pos.y - 1 };
  if (port === 'bottom')  return { x: pos.x + w / 2,       y: pos.y + h + 1 };
  // Hub : port de base (centre) ou port de branche (extrémité)
  if (node.type === 'hub') {
    const cx = pos.x + w / 2;
    const cy = pos.y + h / 2;
    if (port === 'hub-base') return { x: cx, y: cy };
    if (port.startsWith('hub-')) {
      const idx = parseInt(port.split('-')[1], 10);
      const { RADIUS, startAngle, angleStep } = getHubBranchParams(node);
      const angle = startAngle + idx * angleStep;
      return { x: cx + RADIUS * Math.cos(angle), y: cy + RADIUS * Math.sin(angle) };
    }
  }
  return { x: pos.x + w / 2, y: cy };
}

/**
 * Paramètres partagés du hub : angles et rayon des branches.
 * Utilisé par nodeAnchor, controlPoint, updateHubElement, etc.
 */
function getHubBranchParams(node) {
  const branches = node.hubBranches || 4;
  const basePort = node.hubBasePort || 'out';
  const RADIUS = 55;
  const LINE_RADIUS = RADIUS - 7; // lignes s'arrêtent avant le bord du port
  const fanBaseAngles = { out: 0, in: Math.PI, top: -Math.PI / 2, bottom: Math.PI / 2 };
  const baseAngle = fanBaseAngles[basePort] || 0;
  const fanAngle = Math.min(Math.PI * 0.92, (branches - 1) * 0.38);
  const startAngle = branches > 1 ? baseAngle - fanAngle / 2 : baseAngle;
  const angleStep = branches > 1 ? fanAngle / (branches - 1) : 0;
  return { branches, basePort, RADIUS, LINE_RADIUS, baseAngle, fanAngle, startAngle, angleStep };
}

/**
 * Direction unitaire d'une branche hub (du centre vers l'extrémité).
 */
function getHubBranchDir(node, branchIndex) {
  const { startAngle, angleStep } = getHubBranchParams(node);
  const angle = startAngle + branchIndex * angleStep;
  return { x: Math.cos(angle), y: Math.sin(angle) };
}

/**
 * Calcule un point de contrôle Bézier selon la direction du port.
 * Le vecteur part du port dans la direction naturelle du flux.
 */
function controlPoint(pt, port, dist) {
  if (port === 'out')    return { x: pt.x + dist, y: pt.y };
  if (port === 'in')     return { x: pt.x - dist, y: pt.y };
  if (port === 'top')    return { x: pt.x,        y: pt.y - dist };
  if (port === 'bottom') return { x: pt.x,        y: pt.y + dist };
  // Hub ports : la direction dépend de l'angle de la branche
  // On cherche le hub dans les DEUX côtés de l'arête (from ou to)
  if (port === 'hub-base' || port.startsWith('hub-')) {
    const nodes = getState().nodes;
    const hub = nodes.find((n) => n.id === currentEdgeFromId && n.type === 'hub')
      || nodes.find((n) => n.id === currentEdgeToId && n.type === 'hub');
    if (hub) {
      if (port === 'hub-base') {
        const { baseAngle } = getHubBranchParams(hub);
        return { x: pt.x - Math.cos(baseAngle) * dist, y: pt.y - Math.sin(baseAngle) * dist };
      }
      const idx = parseInt(port.split('-')[1], 10);
      const dir = getHubBranchDir(hub, idx);
      return { x: pt.x + dir.x * dist, y: pt.y + dir.y * dist };
    }
    return port === 'hub-base' ? { x: pt.x - dist, y: pt.y } : { x: pt.x + dist, y: pt.y };
  }
  return { x: pt.x + dist, y: pt.y };
}

// Variable temporaire pour passer le node ID à controlPoint (hub direction)
let currentEdgeFromId = null;
let currentEdgeToId = null;

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
  // Ligne visible (sans marker-end — la flèche est placée à 75% de la courbe)
  const line = document.createElementNS(SVG_NS, 'path');
  line.setAttribute('class', 'canvas-edge');
  g.appendChild(line);
  // Flèche indépendante (polygone) placée à 75% de la courbe
  const arrow = document.createElementNS(SVG_NS, 'polygon');
  arrow.setAttribute('class', 'edge-arrow');
  arrow.setAttribute('points', '-7,-5 7,0 -7,5');
  g.appendChild(arrow);
  // Bouton × au midpoint
  const handle = document.createElementNS(SVG_NS, 'g');
  handle.setAttribute('class', 'edge-handle');
  const bg = document.createElementNS(SVG_NS, 'circle');
  bg.setAttribute('class', 'edge-handle__bg');
  bg.setAttribute('r', '9');
  handle.appendChild(bg);
  // Icône × via SVG Heroicons
  const xSvg = document.createElementNS(SVG_NS, 'foreignObject');
  xSvg.setAttribute('x', '-8');
  xSvg.setAttribute('y', '-8');
  xSvg.setAttribute('width', '16');
  xSvg.setAttribute('height', '16');
  xSvg.innerHTML = `<span xmlns="http://www.w3.org/1999/xhtml" class="edge-handle__icon">${iconXMark()}</span>`;
  handle.appendChild(xSvg);
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
  g.arrow = arrow;
  g.hit = hit;
  g.handle = handle;
  return g;
}

function updateEdgeElement(group, edge) {
  const { nodes } = getState();
  const from = nodes.find((n) => n.id === edge.from);
  const to = nodes.find((n) => n.id === edge.to);
  currentEdgeFromId = edge.from;
  currentEdgeToId = edge.to;
  if (!from || !to) return;
  const fp = edge.fromPort || 'out';
  const tp = edge.toPort || 'in';
  const p1 = nodeAnchor(from, fp);
  const p2 = nodeAnchor(to, tp);
  // Courbe de Bézier : direction du point de contrôle selon le port
  const dist = Math.max(40, Math.hypot(p2.x - p1.x, p2.y - p1.y) * 0.35);
  const c1 = controlPoint(p1, fp, dist);
  const c2 = controlPoint(p2, tp, dist);
  const d = `M ${p1.x} ${p1.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${p2.x} ${p2.y}`;
  group.line.setAttribute('d', d);
  group.hit.setAttribute('d', d);

  // Flèche à 75% de la courbe
  const totalLen = group.line.getTotalLength();
  if (totalLen > 0) {
    const pt75 = group.line.getPointAtLength(totalLen * 0.75);
    const pt73 = group.line.getPointAtLength(totalLen * 0.73);
    const angle = Math.atan2(pt75.y - pt73.y, pt75.x - pt73.x) * 180 / Math.PI;
    group.arrow.setAttribute('transform', `translate(${pt75.x} ${pt75.y}) rotate(${angle})`);
    group.arrow.style.display = '';
  } else {
    group.arrow.style.display = 'none';
  }

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

  // === HUB (connecteur multiple) ===
  if (node.type === 'hub') {
    el.classList.add('canvas-element--hub');
    const branches = node.hubBranches || 4;
    el.dataset.branches = String(branches);
    const { RADIUS, LINE_RADIUS, startAngle, angleStep } = getHubBranchParams(node);
    const hubSize = 160;
    const cx = hubSize / 2;
    const cy = hubSize / 2;
    let hubHtml = `<div class="hub-body"><span class="element-icon">${getIcon('hub')}</span></div>`;
    hubHtml += `<svg class="hub-branches-svg" xmlns="http://www.w3.org/2000/svg">`;
    for (let i = 0; i < branches; i++) {
      const angle = startAngle + i * angleStep;
      hubHtml += `<line x1="${cx}" y1="${cy}" x2="${cx + LINE_RADIUS * Math.cos(angle)}" y2="${cy + LINE_RADIUS * Math.sin(angle)}" class="hub-branch-line"/>`;
    }
    hubHtml += `</svg>`;
    for (let i = 0; i < branches; i++) {
      const angle = startAngle + i * angleStep;
      const px = cx + RADIUS * Math.cos(angle);
      const py = cy + RADIUS * Math.sin(angle);
      hubHtml += `<button class="port hub-port" data-port="hub-${i}" type="button" style="left:${px}px;top:${py}px"></button>`;
    }
    hubHtml += `<div class="port-menu port-menu--hub" data-for="hub" role="toolbar">`;
    hubHtml += `<button class="port-menu__btn" data-action="connect" type="button" title="Connecter">${iconLink()}</button>`;
    hubHtml += `<button class="port-menu__btn" data-action="disconnect" type="button" title="Déconnecter">${iconDisconnect()}</button>`;
    hubHtml += `<button class="port-menu__btn" data-action="reconnect" type="button" title="Reconnecter">${iconRefresh()}</button>`;
    hubHtml += `<button class="port-menu__btn port-menu__btn--danger" data-action="delete" type="button" title="Supprimer">${iconTrash()}</button>`;
    hubHtml += `</div>`;
    hubHtml += `<div class="node-menu" role="toolbar" aria-label="Actions du connecteur">`;
    hubHtml += `<button class="node-menu__btn node-menu__btn--num" data-action="resize-4" type="button" title="4 branches">4</button>`;
    hubHtml += `<button class="node-menu__btn node-menu__btn--num" data-action="resize-6" type="button" title="6 branches">6</button>`;
    hubHtml += `<button class="node-menu__btn node-menu__btn--num" data-action="resize-8" type="button" title="8 branches">8</button>`;
    hubHtml += `<button class="node-menu__btn node-menu__btn--num" data-action="resize-10" type="button" title="10 branches">10</button>`;
    hubHtml += `<button class="node-menu__btn node-menu__btn--danger" data-action="delete" type="button" title="Supprimer">${iconTrash()}</button>`;
    hubHtml += `</div>`;
    el.innerHTML = hubHtml;
    // Event listeners (même pattern que les nœuds normaux)
    const nodeMenu = el.querySelector('.node-menu');
    nodeMenu.addEventListener('mousedown', (e) => e.stopPropagation());
    nodeMenu.addEventListener('click', (e) => e.stopPropagation());
    nodeMenu.querySelectorAll('.node-menu__btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        handleNodeMenuAction(node.id, btn.dataset.action);
      });
    });
    el.querySelectorAll('.port-menu').forEach((pm) => {
      pm.addEventListener('mousedown', (e) => e.stopPropagation());
      pm.addEventListener('click', (e) => e.stopPropagation());
      pm.querySelectorAll('.port-menu__btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          handlePortMenuAction(node.id, pm.dataset.for, btn.dataset.action);
        });
      });
    });
    el.querySelectorAll('.port').forEach((portEl) => {
      portEl.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        if (connectArmed) {
          const targetNodeId = node.id;
          const targetPort = portEl.dataset.port;
          if (targetNodeId === connectArmed.fromId) {
            actions.cancelConnection();
            actions.setStatusMessage('Connexion annulée (même nœud)', 'info');
          } else {
            const edge = actions.completeConnection(targetNodeId, targetPort);
            if (edge) actions.setStatusMessage('Connexion créée', 'success');
            else actions.setStatusMessage('Connexion déjà existante', 'warning');
          }
          disarmConnection();
          return;
        }
        startPending('port', node.id, portEl.dataset.port, e);
      });
    });
    el.addEventListener('mousedown', (e) => onNodeMouseDown(e, node.id));
    el.addEventListener('mouseleave', () => {
      if (interaction?.type === 'drag') return;
      scheduleCloseMenu();
    });
    el.addEventListener('mouseenter', () => cancelScheduledClose());
    el.querySelectorAll('.port-menu').forEach((pm) => {
      pm.addEventListener('mouseenter', () => cancelScheduledClose());
    });
    return el;
  }

  // === NŒUD NORMAL ===
  el.innerHTML = `
    <div class="port-menu port-menu--in" data-for="in" role="toolbar" aria-label="Actions du port d'entrée gauche">
      <button class="port-menu__btn" data-action="connect"     type="button" title="Connecter vers un autre nœud" aria-label="Connecter">${iconLink()}</button>
      <button class="port-menu__btn" data-action="disconnect"  type="button" title="Déconnecter toutes les arêtes de ce port" aria-label="Déconnecter">${iconDisconnect()}</button>
      <button class="port-menu__btn" data-action="reconnect"   type="button" title="Reconnecter (déconnecter puis connecter)" aria-label="Reconnecter">${iconRefresh()}</button>
      <button class="port-menu__btn port-menu__btn--accent" data-action="multilink" type="button" title="Créer un connecteur multiple" aria-label="Multilink">${iconBranch()}</button>
      <button class="port-menu__btn port-menu__btn--danger" data-action="delete" type="button" title="Supprimer le nœud" aria-label="Supprimer">${iconTrash()}</button>
    </div>
    <button class="port port--in" data-port="in" type="button" aria-label="Port d'entrée"></button>
    <div class="port-menu port-menu--top" data-for="top" role="toolbar" aria-label="Actions du port d'entrée haut">
      <button class="port-menu__btn" data-action="connect"     type="button" title="Connecter vers un autre nœud" aria-label="Connecter">${iconLink()}</button>
      <button class="port-menu__btn" data-action="disconnect"  type="button" title="Déconnecter toutes les arêtes de ce port" aria-label="Déconnecter">${iconDisconnect()}</button>
      <button class="port-menu__btn" data-action="reconnect"   type="button" title="Reconnecter (déconnecter puis connecter)" aria-label="Reconnecter">${iconRefresh()}</button>
      <button class="port-menu__btn port-menu__btn--accent" data-action="multilink" type="button" title="Créer un connecteur multiple" aria-label="Multilink">${iconBranch()}</button>
      <button class="port-menu__btn port-menu__btn--danger" data-action="delete" type="button" title="Supprimer le nœud" aria-label="Supprimer">${iconTrash()}</button>
    </div>
    <button class="port port--top" data-port="top" type="button" aria-label="Port d'entrée haut"></button>
    <div class="element-body">
      <span class="element-icon"></span>
      <span class="element-name"></span>
    </div>
    <button class="port port--out" data-port="out" type="button" aria-label="Port de sortie"></button>
    <div class="port-menu port-menu--out" data-for="out" role="toolbar" aria-label="Actions du port de sortie droite">
      <button class="port-menu__btn" data-action="connect"     type="button" title="Connecter vers un autre nœud" aria-label="Connecter">${iconLink()}</button>
      <button class="port-menu__btn" data-action="disconnect"  type="button" title="Déconnecter toutes les arêtes de ce port" aria-label="Déconnecter">${iconDisconnect()}</button>
      <button class="port-menu__btn" data-action="reconnect"   type="button" title="Reconnecter (déconnecter puis connecter)" aria-label="Reconnecter">${iconRefresh()}</button>
      <button class="port-menu__btn port-menu__btn--accent" data-action="multilink" type="button" title="Créer un connecteur multiple" aria-label="Multilink">${iconBranch()}</button>
      <button class="port-menu__btn port-menu__btn--danger" data-action="delete" type="button" title="Supprimer le nœud" aria-label="Supprimer">${iconTrash()}</button>
    </div>
    <button class="port port--bottom" data-port="bottom" type="button" aria-label="Port de sortie bas"></button>
    <div class="port-menu port-menu--bottom" data-for="bottom" role="toolbar" aria-label="Actions du port de sortie bas">
      <button class="port-menu__btn" data-action="connect"     type="button" title="Connecter vers un autre nœud" aria-label="Connecter">${iconLink()}</button>
      <button class="port-menu__btn" data-action="disconnect"  type="button" title="Déconnecter toutes les arêtes de ce port" aria-label="Déconnecter">${iconDisconnect()}</button>
      <button class="port-menu__btn" data-action="reconnect"   type="button" title="Reconnecter (déconnecter puis connecter)" aria-label="Reconnecter">${iconRefresh()}</button>
      <button class="port-menu__btn port-menu__btn--accent" data-action="multilink" type="button" title="Créer un connecteur multiple" aria-label="Multilink">${iconBranch()}</button>
      <button class="port-menu__btn port-menu__btn--danger" data-action="delete" type="button" title="Supprimer le nœud" aria-label="Supprimer">${iconTrash()}</button>
    </div>
    <div class="node-menu" role="toolbar" aria-label="Actions rapides">
      <button class="node-menu__btn" data-action="connect" type="button" title="Connecter (glisser vers un autre nœud)" aria-label="Connecter">${iconLink()}</button>
      <button class="node-menu__btn" data-action="properties" type="button" title="Propriétés" aria-label="Propriétés">${iconCog()}</button>
      <button class="node-menu__btn node-menu__btn--danger" data-action="delete" type="button" title="Supprimer (Suppr)" aria-label="Supprimer">${iconTrash()}</button>
    </div>
  `;

  // ----- Menu nœud (clic = ouvrir, clic-bouton = exécuter) -----
  const nodeMenu = el.querySelector('.node-menu');
  nodeMenu.addEventListener('mousedown', (e) => e.stopPropagation());
  nodeMenu.addEventListener('click', (e) => e.stopPropagation());
  nodeMenu.querySelectorAll('.node-menu__btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleNodeMenuAction(node.id, btn.dataset.action);
    });
  });

  // ----- Menus port (4 actions) -----
  el.querySelectorAll('.port-menu').forEach((pm) => {
    pm.addEventListener('mousedown', (e) => e.stopPropagation());
    pm.addEventListener('click', (e) => e.stopPropagation());
    pm.querySelectorAll('.port-menu__btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        handlePortMenuAction(node.id, pm.dataset.for, btn.dataset.action);
      });
    });
  });

  // ----- Ports : clic = menu port, mousedown+drag = connexion drag -----
  el.querySelectorAll('.port').forEach((portEl) => {
    portEl.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      // Si une connexion est armée, ce clic la complète
      if (connectArmed) {
        const targetNodeId = node.id;
        const targetPort = portEl.dataset.port;
        if (targetNodeId === connectArmed.fromId) {
          actions.cancelConnection();
          actions.setStatusMessage('Connexion annulée (même nœud)', 'info');
        } else {
          const edge = actions.completeConnection(targetNodeId, targetPort);
          if (edge) actions.setStatusMessage('Connexion créée', 'success');
          else actions.setStatusMessage('Connexion déjà existante', 'warning');
        }
        disarmConnection();
        return;
      }
      startPending('port', node.id, portEl.dataset.port, e);
    });
  });

  // ----- Nœud : clic = menu nœud (sélectionne), mousedown+drag = déplacer -----
  el.addEventListener('mousedown', (e) => onNodeMouseDown(e, node.id));

  // ----- Nœud : sortie de souris = ferme le menu (avec délai pour laisser
  // le temps de survoler le menu port, qui est positionné en dehors du nœud).
  // On ignore pendant un drag en cours.
  el.addEventListener('mouseleave', () => {
    if (interaction?.type === 'drag') return;
    scheduleCloseMenu();
  });
  el.addEventListener('mouseenter', () => {
    cancelScheduledClose();
  });

  // Annule aussi la fermeture si la souris entre dans un menu port (en dehors du nœud)
  el.querySelectorAll('.port-menu').forEach((pm) => {
    pm.addEventListener('mouseenter', () => {
      cancelScheduledClose();
    });
  });

  return el;
}

/* --------------------------------------------------------------------------
 * Click vs Drag : distingue un clic court d'un mousedown+drag
 * -------------------------------------------------------------------------- */
function startPending(type, id, port, e) {
  pendingDown = { type, id, port, startX: e.clientX, startY: e.clientY, consumed: false };
  document.addEventListener('mousemove', onPendingMove);
  document.addEventListener('mouseup', onPendingUp, { once: true });
}

function onPendingMove(e) {
  if (!pendingDown || pendingDown.consumed) return;
  const dx = Math.abs(e.clientX - pendingDown.startX);
  const dy = Math.abs(e.clientY - pendingDown.startY);
  if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) {
    // C'est un drag : on consomme et on démarre l'action
    const pd = pendingDown;
    pd.consumed = true;
    document.removeEventListener('mousemove', onPendingMove);
    if (pd.type === 'node') {
      actions.selectNode(pd.id);
      startNodeDrag(pd.id, e);
    } else if (pd.type === 'port') {
      startConnectionDrag(pd.id, pd.port, e);
    }
  }
}

function onPendingUp(e) {
  document.removeEventListener('mousemove', onPendingMove);
  if (!pendingDown || pendingDown.consumed) {
    pendingDown = null;
    return;
  }
  // C'était un clic court (pas de drag)
  const pd = pendingDown;
  pendingDown = null;
  if (pd.type === 'node') {
    actions.selectNode(pd.id);
    openNodeMenu(pd.id);
  } else if (pd.type === 'port') {
    openPortMenu(pd.id, pd.port);
  }
}

/* --------------------------------------------------------------------------
 * Actions des menus (factorisation)
 * -------------------------------------------------------------------------- */
function handleNodeMenuAction(nodeId, action) {
  closeMenu();
  if (action === 'delete') {
    actions.removeNode(nodeId);
    actions.setStatusMessage('Élément supprimé', 'info');
  } else if (action === 'connect') {
    armConnection(nodeId, 'out', 'Cliquez sur un autre port pour connecter (Échap pour annuler)');
  } else if (action === 'properties') {
    openPropertiesAndFocusLabel();
    actions.selectNode(nodeId);
  } else if (action.startsWith('resize-')) {
    const count = parseInt(action.split('-')[1], 10);
    if (Number.isFinite(count)) {
      actions.updateHubBranches(nodeId, count);
      actions.setStatusMessage(`Connecteur : ${count} branches`, 'success');
    }
  }
}

function handlePortMenuAction(nodeId, port, action) {
  closeMenu();
  if (action === 'delete') {
    // Supprime SEULEMENT les connexions de ce port (pas le nœud)
    const removed = actions.removeNodeEdges(nodeId, port);
    actions.setStatusMessage(
      removed > 0
        ? `${removed} connexion${removed > 1 ? 's' : ''} supprimée${removed > 1 ? 's' : ''}`
        : 'Aucune connexion à supprimer',
      removed > 0 ? 'success' : 'info',
    );
    return;
  }
  if (action === 'disconnect') {
    const removed = actions.removeNodeEdges(nodeId, port);
    actions.setStatusMessage(
      removed > 0
        ? `${removed} connexion${removed > 1 ? 's' : ''} déconnectée${removed > 1 ? 's' : ''}`
        : 'Aucune connexion à supprimer',
      removed > 0 ? 'success' : 'info',
    );
    return;
  }
  if (action === 'connect') {
    armConnection(nodeId, port);
    return;
  }
  if (action === 'reconnect') {
    const removed = actions.removeNodeEdges(nodeId, port);
    armConnection(nodeId, port, removed > 0
      ? `Déconnecté (${removed}) — cliquez sur un autre port`
      : 'Cliquez sur un autre port pour reconnecter');
    return;
  }
  if (action === 'multilink') {
    showHubPicker(nodeId, port);
    return;
  }
}

/* --------------------------------------------------------------------------
 * Menus : ouverture / fermeture (un seul menu actif à la fois)
 * -------------------------------------------------------------------------- */
function openNodeMenu(id) {
  cancelScheduledClose();
  activeMenu = { type: 'node', id };
  applyMenuClasses();
}

function openPortMenu(id, port) {
  cancelScheduledClose();
  activeMenu = { type: 'port', id, port };
  // Pour les ports hub, positionner le menu dynamiquement
  if (port.startsWith('hub-')) {
    const el = nodeElements.get(id);
    const menu = el?.querySelector('.port-menu--hub');
    const portEl = el?.querySelector(`[data-port="${port}"]`);
    if (menu && portEl) {
      menu.dataset.for = port;
      const pl = parseFloat(portEl.style.left) || 0;
      const pt = parseFloat(portEl.style.top) || 0;
      menu.style.left = `${pl + 16}px`;
      menu.style.top = `${pt - 11}px`;
    }
  }
  applyMenuClasses();
}

function scheduleCloseMenu() {
  cancelScheduledClose();
  menuCloseTimeout = setTimeout(() => {
    menuCloseTimeout = null;
    closeMenu();
  }, 400); // 400 ms pour laisser le temps de survoler le menu port
}

function cancelScheduledClose() {
  if (menuCloseTimeout != null) {
    clearTimeout(menuCloseTimeout);
    menuCloseTimeout = null;
  }
}

function closeMenu() {
  cancelScheduledClose();
  if (!activeMenu) return;
  activeMenu = null;
  applyMenuClasses();
}

function applyMenuClasses() {
  for (const [id, el] of nodeElements) {
    const nodeMatch = activeMenu && activeMenu.type === 'node' && activeMenu.id === id;
    const portMatch = activeMenu && activeMenu.type === 'port' && activeMenu.id === id;
    el.classList.toggle('node-menu-active', !!nodeMatch);
    el.classList.toggle('port-menu-active', !!portMatch);
    el.classList.toggle('port-menu-active-in',      !!(portMatch && activeMenu.port === 'in'));
    el.classList.toggle('port-menu-active-out',     !!(portMatch && activeMenu.port === 'out'));
    el.classList.toggle('port-menu-active-top',     !!(portMatch && activeMenu.port === 'top'));
    el.classList.toggle('port-menu-active-bottom',  !!(portMatch && activeMenu.port === 'bottom'));
    // Hub port menu
    const isHubPort = portMatch && activeMenu.port?.startsWith('hub-');
    el.classList.toggle('port-menu-active-hub', !!isHubPort);
  }
}

/* --------------------------------------------------------------------------
 * Connexion armée : déclenchée par "Connecter" du menu port
 *   armConnection : met en attente, montre un ghost line vers la souris,
 *                   le prochain clic sur un port crée la connexion
 *   disarmConnection : annule (clic ailleurs ou Échap)
 * -------------------------------------------------------------------------- */
function armConnection(nodeId, port, statusMessage) {
  if (connectArmed) disarmConnection();
  actions.startConnection(nodeId, port); // classes CSS sur le nœud source
  const ghost = createGhostLine();
  connectArmed = { fromId: nodeId, fromPort: port, ghostEl: ghost };
  if (lastMouseEvent) updateGhostLine(ghost, lastMouseEvent);
  actions.setStatusMessage(
    statusMessage || 'Cliquez sur un autre port pour connecter (Échap pour annuler)',
    'info',
    0, // pas d'auto-clear
  );
  // Cancel si clic ailleurs
  document.addEventListener('mousedown', onArmedClickOutside, true);
}

function disarmConnection() {
  if (!connectArmed) return;
  connectArmed.ghostEl?.remove();
  for (const el of nodeElements.values()) {
    el.classList.remove('connect-target');
    el.classList.remove('connect-target-hover');
  }
  connectArmed = null;
  document.removeEventListener('mousedown', onArmedClickOutside, true);
  if (getState().connection.from) actions.cancelConnection();
}

function onArmedClickOutside(e) {
  if (!connectArmed) return;
  // Si le clic est sur un port, le handler du port gère la complétion
  if (e.target?.closest?.('.port')) return;
  // Sinon : annule
  actions.setStatusMessage('Connexion annulée', 'info');
  disarmConnection();
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
  // Tous les nœuds (sauf source) restent en connect-target pendant le drag
  // Le nœud sous la souris reçoit un style supplémentaire via .connect-target-hover
  const portEl = e.target?.closest?.('.port');
  const targetNodeId = portEl?.closest?.('.canvas-element')?.dataset.id;
  for (const [id, el] of nodeElements) {
    el.classList.toggle('connect-target', id !== dragConnection.fromId);
    el.classList.toggle('connect-target-hover', id === targetNodeId && id !== dragConnection.fromId);
  }
}

function onConnectionDragEnd(e) {
  if (!dragConnection) return;
  const { fromId, ghostEl } = dragConnection;
  document.removeEventListener('mousemove', onConnectionDragMove);
  document.removeEventListener('mouseup', onConnectionDragEnd);

  // Cleanup
  for (const el of nodeElements.values()) {
    el.classList.remove('connect-target');
    el.classList.remove('connect-target-hover');
  }
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
  const fp = dragConnection.fromPort;
  // Set temp vars so controlPoint can find the hub node for hub ports
  currentEdgeFromId = dragConnection.fromId;
  currentEdgeToId = null;
  const p1 = nodeAnchor(fromNode, fp);
  const p2 = getMouseWorldPos(mouseEvent);
  const dist = Math.max(40, Math.hypot(p2.x - p1.x, p2.y - p1.y) * 0.35);
  const c1 = controlPoint(p1, fp, dist);
  ghost.setAttribute('d', `M ${p1.x} ${p1.y} C ${c1.x} ${c1.y}, ${p2.x} ${p2.y}, ${p2.x} ${p2.y}`);
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

/**
 * Allume les ports qui ont au moins une arête connectée (in/out).
 * Mis à jour à chaque changement d'état (addEdge, removeEdge, etc.)
 */
function applyPortConnectionState() {
  const { nodes, edges } = getState();    const portConnected = new Map(); // nodeId → Set of port names
    for (const e of edges) {
      // Port source (fromPort)
      if (!portConnected.has(e.from)) portConnected.set(e.from, new Set());
      portConnected.get(e.from).add(e.fromPort || 'out');
      // Port cible (toPort)
      if (!portConnected.has(e.to)) portConnected.set(e.to, new Set());
      portConnected.get(e.to).add(e.toPort || 'in');
    }
    for (const node of nodes) {
      const el = nodeElements.get(node.id);
      if (!el) continue;
      const connected = portConnected.get(node.id) || new Set();
      if (node.type === 'hub') {
        const branches = node.hubBranches || 4;
        for (let i = 0; i < branches; i++) {
          el.querySelector(`[data-port="hub-${i}"]`)?.classList.toggle('connected', connected.has(`hub-${i}`));
        }
      } else {
        el.querySelector('.port--in')?.classList.toggle('connected', connected.has('in'));
        el.querySelector('.port--out')?.classList.toggle('connected', connected.has('out'));
        el.querySelector('.port--top')?.classList.toggle('connected', connected.has('top'));
        el.querySelector('.port--bottom')?.classList.toggle('connected', connected.has('bottom'));
      }
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

  // Mise à jour permanente de la position souris (utilisée par armConnection)
  document.addEventListener('mousemove', (e) => {
    lastMouseEvent = e;
    if (connectArmed) {
      updateGhostLine(connectArmed.ghostEl, e);
      // Tous les nœuds (sauf source) restent en connect-target pendant l'arm
      const portEl = e.target?.closest?.('.port');
      const targetNodeId = portEl?.closest?.('.canvas-element')?.dataset.id;
      for (const [id, el] of nodeElements) {
        el.classList.toggle('connect-target', id !== connectArmed.fromId);
        el.classList.toggle('connect-target-hover', id === targetNodeId && id !== connectArmed.fromId);
      }
    }
  });

  // Clic sur le fond du canvas = désélection + ferme le menu + annule une connexion
  canvasContent.addEventListener('mousedown', (e) => {
    if (e.target === canvasContent || e.target === svgLayer) {
      removeHubPicker();
      closeMenu();
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
      // Ferme le picker hub
      if (hubPickerEl) {
        removeHubPicker();
        return;
      }
      // Ferme le menu actif
      if (activeMenu) {
        closeMenu();
        return;
      }
      // Annule une connexion armée
      if (connectArmed) {
        actions.setStatusMessage('Connexion annulée', 'info');
        disarmConnection();
        return;
      }
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
    variant: payload.variant || null,
    icon: payload.icon || null,
    color: payload.color || null,
    background: payload.background || null,
    x,
    y,
    priority: 'medium',
  });
  const variantLabel = payload.variantLabel ? ` (${payload.variantLabel})` : '';
  actions.setStatusMessage(`${payload.label || 'Élément'}${variantLabel} ajouté`, 'success');
}

function onNodeMouseDown(e, nodeId) {
  if (e.button !== 0) return;
  if (e.target.closest('.node-menu')) return;
  if (e.target.closest('.port-menu')) return;
  if (e.target.closest('.port')) return; // géré par le port lui-même

  e.preventDefault();
  e.stopPropagation();
  // Clic simple → ouvre le menu nœud (sélection + menu).
  // Clic + déplacement → démarre un drag (géré dans onPendingMove).
  startPending('node', nodeId, null, e);
}

function startNodeDrag(nodeId, startEvent) {
  const state = getState();
  const node = state.nodes.find((n) => n.id === nodeId);
  if (!node) return;
  const { zoom } = state.view;
  const canvasRect = canvasContent.getBoundingClientRect();
  const offsetX = (startEvent.clientX - canvasRect.left) / zoom - node.x;
  const offsetY = (startEvent.clientY - canvasRect.top) / zoom - node.y;
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
    el.classList.add('is-dragging');
    let nx = x;
    let ny = y;
    if (state.view.snapToGrid) {
      nx = Math.round(nx / GRID_SIZE) * GRID_SIZE;
      ny = Math.round(ny / GRID_SIZE) * GRID_SIZE;
    }
    el.style.left = `${nx}px`;
    el.style.top = `${ny}px`;
    // Position live (utilisée par nodeAnchor pour les arêtes connectées)
    livePositions.set(nodeId, { x: nx, y: ny });
    // Re-render des arêtes connectées pour qu'elles suivent le nœud
    for (const edge of state.edges) {
      if (edge.from === nodeId || edge.to === nodeId) {
        const group = edgeElements.get(edge.id);
        if (group) updateEdgeElement(group, edge);
      }
    }
    // Pendant un drag, la ligne fantôme d'une connexion en cours doit
    // aussi suivre l'anchor source
    if (dragConnection) {
      const ghost = dragConnection.ghostEl;
      const fromNode = state.nodes.find((n) => n.id === dragConnection.fromId);
      if (ghost && fromNode) {
        const fp = dragConnection.fromPort;
        const p1 = nodeAnchor(fromNode, fp);
        const p2 = getMouseWorldPos(e);
        const dist = Math.max(40, Math.hypot(p2.x - p1.x, p2.y - p1.y) * 0.35);
        const c1 = controlPoint(p1, fp, dist);
        ghost.setAttribute('d', `M ${p1.x} ${p1.y} C ${c1.x} ${c1.y}, ${p2.x} ${p2.y}, ${p2.x} ${p2.y}`);
      }
    }
  }
}

/* --------------------------------------------------------------------------
 * Hub picker popup : choix du nombre de branches (4, 6, 8, 10)
 * -------------------------------------------------------------------------- */
function showHubPicker(nodeId, port) {
  removeHubPicker();
  const node = getState().nodes.find((n) => n.id === nodeId);
  if (!node) return;
  const anchor = nodeAnchor(node, port);
  const { zoom, pan } = getState().view;
  const rect = canvasContent.getBoundingClientRect();
  const screenX = rect.left + pan.x + anchor.x * zoom;
  const screenY = rect.top + pan.y + anchor.y * zoom;
  const picker = document.createElement('div');
  picker.className = 'hub-picker';
  picker.innerHTML = `
    <div class=\"hub-picker__title\">Branches</div>
    <div class=\"hub-picker__btns\">
      <button class=\"hub-picker__btn\" data-count=\"4\">4</button>
      <button class=\"hub-picker__btn\" data-count=\"6\">6</button>
      <button class=\"hub-picker__btn\" data-count=\"8\">8</button>
      <button class=\"hub-picker__btn\" data-count=\"10\">10</button>
    </div>`;
  picker.style.left = `${screenX + 10}px`;
  picker.style.top = `${screenY - 30}px`;
  picker.addEventListener('mousedown', (e) => e.stopPropagation());
  picker.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-count]');
    if (btn) {
      const count = parseInt(btn.dataset.count, 10);
      handleCreateHub(nodeId, port, count);
      removeHubPicker();
    }
  });
  document.body.appendChild(picker);
  hubPickerEl = picker;
  setTimeout(() => document.addEventListener('mousedown', onHubPickerOutside, true), 10);
}

function removeHubPicker() {
  if (hubPickerEl) {
    hubPickerEl.remove();
    hubPickerEl = null;
    document.removeEventListener('mousedown', onHubPickerOutside, true);
  }
}

function onHubPickerOutside(e) {
  if (hubPickerEl && !hubPickerEl.contains(e.target)) removeHubPicker();
}

function handleCreateHub(nodeId, port, branchCount) {
  const node = getState().nodes.find((n) => n.id === nodeId);
  if (!node) return;
  const anchor = nodeAnchor(node, port);
  const hubSize = 160;
  const offsets = { out: { dx: 80, dy: 0 }, in: { dx: -80, dy: 0 }, top: { dx: 0, dy: -80 }, bottom: { dx: 0, dy: 80 } };
  const off = offsets[port] || offsets.out;
  const centerX = anchor.x + off.dx;
  const centerY = anchor.y + off.dy;
  actions.createHub(nodeId, port, branchCount, centerX - hubSize / 2, centerY - hubSize / 2);
  actions.setStatusMessage(`Connecteur ${branchCount} branches créé`, 'success');
}

function onNodeDragEnd() {
  document.removeEventListener('mousemove', onNodeDragMove);
  if (!interaction || interaction.type !== 'drag') return;
  const { nodeId, _lastPos } = interaction;
  const el = nodeElements.get(nodeId);
  if (el) el.classList.remove('is-dragging');
  livePositions.delete(nodeId);
  if (_lastPos) {
    actions.updateNode(nodeId, { x: _lastPos.x, y: _lastPos.y });
  }
  interaction = null;
  // Re-render des arêtes (les positions des nœuds ont changé)
  syncEdges(getState().edges);
}
