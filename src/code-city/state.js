/**
 * Store d'état central de l'application
 *
 * Toute la vérité de l'application passe par ce store. Les modules lisent
 * l'état via `getState()` ou `subscribe()`, et le modifient uniquement via
 * les actions exportées par `actions`. Aucune mutation directe n'est
 * tolérée (par convention ; on n'utilise pas de Proxy pour ne pas plomber
 * les perfs).
 *
 * Le store inclut un système d'historique minimal (undo/redo) déjà
 * fonctionnel. Les raccourcis clavier Ctrl+Z / Ctrl+Y seront câblés en
 * phase 9 (Polish) et la persistance localStorage y sera ajoutée.
 */

const HISTORY_MAX_SIZE = 50;

const initialState = () => ({
  // Graphe du diagramme
  nodes: [],
  edges: [],

  // Sélection courante
  selection: { nodes: new Set(), edges: new Set() },

  // Mode d'interaction
  mode: 'select', // 'select' | 'connect'

  // Connexion en cours (premier port cliqué, on attend le second)
  connection: { from: null, port: null },

  // Survol courant
  hover: { node: null, edge: null },

  // Vue
  view: {
    theme: readStoredTheme(),
    zoom: 1,
    pan: { x: 0, y: 0 },
    gridVisible: true,
    snapToGrid: true,
  },

  // Statut (lu par la barre du bas)
  status: {
    elementCount: 0,
    zoomPercent: 100,
    theme: readStoredTheme(),
    message: 'Prêt',
    messageType: 'info', // 'info' | 'success' | 'warning' | 'error'
  },
});

function readStoredTheme() {
  try {
    const stored = localStorage.getItem('code-city-theme');
    if (stored === 'light' || stored === 'dark') return stored;
  } catch (_) {}
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

const state = initialState();
const subscribers = new Set();
const history = { stack: [], index: -1 };
let isApplyingHistory = false;
let isApplyingChange = false;

// Compteurs pour générer des IDs lisibles (n1-user, n2-process, e1…)
let nextNodeNum = 1;
let nextEdgeNum = 1;

function freshNodeId(type) {
  const slug = (type || 'process').replace(/[^a-z0-9]/gi, '-').toLowerCase();
  return `n${nextNodeNum++}-${slug}`;
}

function freshEdgeId() {
  return `e${nextEdgeNum++}`;
}

// Ré-étalonne les compteurs à partir d'un graphe chargé (anciens IDs
// node-…/edge-… ou déjà en n1/n2 — on s'aligne sur le max existant + 1).
function resyncCounters(nodes, edges) {
  let maxN = 0;
  let maxE = 0;
  for (const n of nodes) {
    const m = /^n(\d+)$/.exec(n.id);
    if (m) maxN = Math.max(maxN, Number(m[1]));
  }
  for (const e of edges) {
    const m = /^e(\d+)$/.exec(e.id);
    if (m) maxE = Math.max(maxE, Number(m[1]));
  }
  nextNodeNum = maxN + 1;
  nextEdgeNum = maxE + 1;
}

/* --------------------------------------------------------------------------
 * API publique
 * -------------------------------------------------------------------------- */

export function getState() {
  return state;
}

export function subscribe(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

export function snapshot() {
  return {
    nodes: state.nodes.map((n) => ({ ...n })),
    edges: state.edges.map((e) => ({ ...e })),
    selection: {
      nodes: new Set(state.selection.nodes),
      edges: new Set(state.selection.edges),
    },
    mode: state.mode,
    view: {
      theme: state.view.theme,
      zoom: state.view.zoom,
      pan: { ...state.view.pan },
      gridVisible: state.view.gridVisible,
      snapToGrid: state.view.snapToGrid,
    },
  };
}

function pushHistory() {
  if (isApplyingHistory) return;
  const snap = snapshot();
  // Si on était au milieu de la pile, on tronque la suite
  if (history.index < history.stack.length - 1) {
    history.stack.splice(history.index + 1);
  }
  history.stack.push(snap);
  if (history.stack.length > HISTORY_MAX_SIZE) {
    history.stack.shift();
  }
  history.index = history.stack.length - 1;
}

function notify(meta = {}) {
  if (isApplyingChange) return;
  for (const fn of subscribers) {
    try {
      fn(state, meta);
    } catch (err) {
      console.error('Subscriber error:', err);
    }
  }
}

/* --------------------------------------------------------------------------
 * Helpers internes
 * -------------------------------------------------------------------------- */

function generateId(prefix) {
  // Conservé pour usage externe éventuel, mais on préfère freshNodeId/freshEdgeId
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function recomputeStatus() {
  state.status.elementCount = state.nodes.length;
  state.status.theme = state.view.theme;
  state.status.zoomPercent = Math.round(state.view.zoom * 100);
}

/* --------------------------------------------------------------------------
 * Actions : graphe
 * -------------------------------------------------------------------------- */

export const actions = {
  addNode(data) {
    pushHistory();
    const type = data.type || 'process';
    const id = data.id || freshNodeId(type);
    const node = {
      id,
      type,
      label: data.label || 'Nouveau',
      x: Number.isFinite(data.x) ? data.x : 0,
      y: Number.isFinite(data.y) ? data.y : 0,
      priority: data.priority || 'medium',
      icon: data.icon || '📌',
      ...data,
      id,
    };
    state.nodes.push(node);
    recomputeStatus();
    notify({ type: 'node:added', node });
  },

  updateNode(id, patch) {
    const node = state.nodes.find((n) => n.id === id);
    if (!node) return;
    pushHistory();

    // Si le type change, on régénère l'ID et on propage aux arêtes + sélection
    if (patch.type && patch.type !== node.type) {
      const oldId = id;
      const newId = freshNodeId(patch.type);
      node.id = newId;
      for (const e of state.edges) {
        if (e.from === oldId) e.from = newId;
        if (e.to === oldId) e.to = newId;
      }
      if (state.selection.nodes.has(oldId)) {
        state.selection.nodes.delete(oldId);
        state.selection.nodes.add(newId);
      }
      if (state.hover.node === oldId) state.hover.node = newId;
      if (state.connection.from === oldId) state.connection.from = newId;
    }

    Object.assign(node, patch);
    recomputeStatus();
    notify({ type: 'node:updated', node });
  },

  removeNode(id) {
    const idx = state.nodes.findIndex((n) => n.id === id);
    if (idx === -1) return;
    pushHistory();
    state.nodes.splice(idx, 1);
    // Supprimer toutes les arêtes incidentes
    state.edges = state.edges.filter((e) => e.from !== id && e.to !== id);
    state.selection.nodes.delete(id);
    recomputeStatus();
    notify({ type: 'node:removed', id });
  },

  addEdge(data) {
    if (!data.from || !data.to || data.from === data.to) return null;
    // Éviter les doublons
    const exists = state.edges.some(
      (e) => e.from === data.from && e.to === data.to && (e.label || '') === (data.label || ''),
    );
    if (exists) return null;
    pushHistory();
    const edge = {
      id: data.id || freshEdgeId(),
      from: data.from,
      to: data.to,
      label: data.label || '',
      type: data.type || 'arrow',
    };
    state.edges.push(edge);
    notify({ type: 'edge:added', edge });
    return edge;
  },

  removeEdge(id) {
    const idx = state.edges.findIndex((e) => e.id === id);
    if (idx === -1) return;
    pushHistory();
    state.edges.splice(idx, 1);
    state.selection.edges.delete(id);
    notify({ type: 'edge:removed', id });
  },

  clear() {
    pushHistory();
    state.nodes = [];
    state.edges = [];
    state.selection.nodes.clear();
    state.selection.edges.clear();
    state.hover = { node: null, edge: null };
    recomputeStatus();
    notify({ type: 'graph:cleared' });
  },

  loadGraph(graph) {
    pushHistory();
    const rawNodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
    const rawEdges = Array.isArray(graph?.edges) ? graph.edges : [];

    // Migration : on ré-attribue des IDs propres (n1, n2, e1, e2…) en
    // conservant l'ordre. Les anciens node-…/edge-… sont remplacés et les
    // arêtes voient leur from/to réécrits en conséquence.
    const idMap = new Map();
    const newNodes = rawNodes.map((n, i) => {
      const newId = `n${i + 1}`;
      if (n.id && n.id !== newId) idMap.set(n.id, newId);
      return { ...n, id: newId };
    });
    const newEdges = rawEdges.map((e, i) => ({
      ...e,
      id: `e${i + 1}`,
      from: idMap.get(e.from) || e.from,
      to: idMap.get(e.to) || e.to,
    }));

    state.nodes = newNodes;
    state.edges = newEdges;
    resyncCounters(newNodes, newEdges);
    state.selection.nodes.clear();
    state.selection.edges.clear();
    recomputeStatus();
    notify({ type: 'graph:loaded' });
  },

  /* ----- sélection ----- */

  setSelection(nodes = new Set(), edges = new Set()) {
    state.selection.nodes = new Set(nodes);
    state.selection.edges = new Set(edges);
    notify({ type: 'selection:changed' });
  },

  selectNode(id, additive = false) {
    if (!additive) state.selection.nodes.clear();
    state.selection.nodes.add(id);
    notify({ type: 'selection:changed' });
  },

  deselectAll() {
    if (state.selection.nodes.size === 0 && state.selection.edges.size === 0) return;
    state.selection.nodes.clear();
    state.selection.edges.clear();
    notify({ type: 'selection:changed' });
  },

  /* ----- mode d'interaction ----- */

  setMode(mode) {
    if (state.mode === mode) return;
    state.mode = mode;
    notify({ type: 'mode:changed', mode });
  },

  /* ----- connexion (1er port cliqué, on attend le 2e) ----- */

  startConnection(nodeId, port) {
    // Click sur le même port que la source → annule
    if (state.connection.from === nodeId) {
      actions.cancelConnection();
      return;
    }
    state.connection.from = nodeId;
    state.connection.port = port || 'out';
    notify({ type: 'connection:started', from: nodeId, port: state.connection.port });
  },

  cancelConnection() {
    if (!state.connection.from) return;
    state.connection.from = null;
    state.connection.port = null;
    notify({ type: 'connection:cancelled' });
  },

  completeConnection(nodeId, _port) {
    const fromId = state.connection.from;
    if (!fromId) return null;
    // Auto-loop interdit
    if (fromId === nodeId) {
      actions.cancelConnection();
      return null;
    }
    // Reset avant d'ajouter (pour ne pas garder l'état pending dans le snap)
    state.connection.from = null;
    state.connection.port = null;
    const edge = actions.addEdge({ from: fromId, to: nodeId });
    notify({ type: 'connection:completed', from: fromId, to: nodeId, edge });
    return edge;
  },

  /* ----- hover ----- */

  setHover(kind, id) {
    if (state.hover[kind] === id) return;
    state.hover[kind === 'node' ? 'node' : 'edge'] = id;
    notify({ type: 'hover:changed' });
  },

  /* ----- vue ----- */

  setTheme(theme) {
    if (state.view.theme === theme) return;
    pushHistory();
    state.view.theme = theme;
    recomputeStatus();
    notify({ type: 'view:theme', theme });
  },

  toggleTheme() {
    actions.setTheme(state.view.theme === 'dark' ? 'light' : 'dark');
  },

  setZoom(zoom, center) {
    const next = Math.max(0.1, Math.min(3, zoom));
    if (state.view.zoom === next && !center) return;
    pushHistory();
    state.view.zoom = next;
    if (center) state.view.pan = { ...center };
    recomputeStatus();
    notify({ type: 'view:zoom', zoom: next });
  },

  setPan(pan) {
    state.view.pan = { ...pan };
    notify({ type: 'view:pan' });
  },

  setGridVisible(visible) {
    if (state.view.gridVisible === visible) return;
    pushHistory();
    state.view.gridVisible = visible;
    notify({ type: 'view:grid', visible });
  },

  toggleGrid() {
    actions.setGridVisible(!state.view.gridVisible);
  },

  setSnapToGrid(enabled) {
    state.view.snapToGrid = enabled;
    notify({ type: 'view:snap', enabled });
  },

  /* ----- statut ----- */

  setStatusMessage(message, type = 'info', durationMs = 2000) {
    state.status.message = message;
    state.status.messageType = type;
    notify({ type: 'status:message', message, messageType: type });
    if (durationMs > 0) {
      setTimeout(() => {
        if (state.status.message === message) {
          state.status.message = 'Prêt';
          state.status.messageType = 'info';
          notify({ type: 'status:message', message: 'Prêt', messageType: 'info' });
        }
      }, durationMs);
    }
  },

  /* ----- historique ----- */

  undo() {
    if (history.index <= 0) return false;
    history.index -= 1;
    const snap = history.stack[history.index];
    isApplyingHistory = true;
    isApplyingChange = true;
    try {
      state.nodes = snap.nodes.map((n) => ({ ...n }));
      state.edges = snap.edges.map((e) => ({ ...e }));
      state.selection.nodes = new Set(snap.selection.nodes);
      state.selection.edges = new Set(snap.selection.edges);
      state.mode = snap.mode;
      state.view = { ...state.view, ...snap.view };
      recomputeStatus();
    } finally {
      isApplyingChange = false;
      isApplyingHistory = false;
    }
    notify({ type: 'history:undo' });
    return true;
  },

  redo() {
    if (history.index >= history.stack.length - 1) return false;
    history.index += 1;
    const snap = history.stack[history.index];
    isApplyingHistory = true;
    isApplyingChange = true;
    try {
      state.nodes = snap.nodes.map((n) => ({ ...n }));
      state.edges = snap.edges.map((e) => ({ ...e }));
      state.selection.nodes = new Set(snap.selection.nodes);
      state.selection.edges = new Set(snap.selection.edges);
      state.mode = snap.mode;
      state.view = { ...state.view, ...snap.view };
      recomputeStatus();
    } finally {
      isApplyingChange = false;
      isApplyingHistory = false;
    }
    notify({ type: 'history:redo' });
    return true;
  },

  canUndo() {
    return history.index > 0;
  },

  canRedo() {
    return history.index < history.stack.length - 1;
  },
};

/* --------------------------------------------------------------------------
 * Exposé en debug
 * -------------------------------------------------------------------------- */

if (typeof window !== 'undefined') {
  window.__state = { getState, subscribe, actions, snapshot };
}
