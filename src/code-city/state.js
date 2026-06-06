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

import { testConnection } from './ai/aiClient.js';
import { MAX_HISTORY_MESSAGES } from './ai/chatHistory.js';

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

  // Assistant IA — configuration du provider + historique chat + clés API
  assistant: readStoredAssistant() || {
    provider: { ...DEFAULT_PROVIDER },
    providers: {
      custom: [],
    },
    apiKeys: [],
    chatHistory: [],
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

const ASSISTANT_STORAGE_KEY = 'code-city-assistant';
const DEFAULT_PROVIDER = {
  id: 'ollama',
  apiKey: '',
  baseUrl: 'http://localhost:11434/v1',
  model: 'llama3.2',
  temperature: 0.7,
  maxTokens: 4096,
  isConnected: false,
  lastTestedAt: null,
};

function readStoredAssistant() {
  try {
    const raw = localStorage.getItem(ASSISTANT_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data && typeof data === 'object' && data.provider) {
      // Migration : l'ancien provider 'mistral' (codestral.mistral.ai) est
      // désormais splité en 'mistral' (api.mistral.ai) et 'codestral' (codestral.mistral.ai).
      // Si l'utilisateur avait 'mistral' avec baseUrl codestral, on migre vers 'codestral'.
      if (data.provider.id === 'mistral' && data.provider.baseUrl?.includes('codestral.mistral.ai')) {
        data.provider.id = 'codestral';
      }
      // S'assurer que apiKeys existe (backward compat pour anciens stockages)
      if (!Array.isArray(data.apiKeys)) {
        data.apiKeys = [];
      }
      return data;
    }
  } catch (_) {}
  return null;
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
    nodes: state.nodes.map((n) => ({ ...n, properties: n.properties ? { ...n.properties } : {} })),
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

/**
 * Recherche un preset par ID dans les presets intégrés ET les custom.
 */
function findPreset(id) {
  // On importe PROVIDER_PRESETS de façon lazy pour éviter les deps circulaires
  // au chargement. En pratique, les presets sont disponibles via une closure.
  return _presets.get(id) || state.assistant.providers.custom.find((p) => p.id === id) || null;
}

/**
 * Retourne la catégorie d'un preset ('online' | 'local').
 */
function getPresetCategory(id) {
  const preset = findPreset(id);
  if (!preset) return 'online';
  return preset.category;
}

/**
 * Cache des presets importés depuis providerPresets.js.
 * Peuplé une fois au démarrage via registerPresets().
 */
const _presets = new Map();

/**
 * Enregistre les presets de providers (appelé au démarrage).
 * @param {Array} presetList - Tableau PROVIDER_PRESETS
 */
export function registerPresets(presetList) {
  _presets.clear();
  for (const p of presetList) {
    _presets.set(p.id, p);
  }
}

/**
 * Persiste la section assistant dans localStorage.
 */
function persistAssistant() {
  try {
    const data = {
      provider: { ...state.assistant.provider },
      providers: {
        custom: [...state.assistant.providers.custom],
      },
      apiKeys: [...(state.assistant.apiKeys || [])],
      chatHistory: [...(state.assistant.chatHistory || [])],
    };
    localStorage.setItem(ASSISTANT_STORAGE_KEY, JSON.stringify(data));
  } catch (_) {
    /* noop — quota or private browsing */
  }
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
      description: '',
      metadata: [],
      properties: {},
      variant: data.variant || null,
      icon: data.icon || null,
      color: data.color || null,
      background: data.background || null,
      ...data,
      id,
    };
    state.nodes.push(node);
    recomputeStatus();
    notify({ type: 'node:added', node });
  },

  updateNode(id, patch) {
    const node = state.nodes.find((n) => n.id === id);
    if (!node) return null;
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
    return node;
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
      (e) => e.from === data.from && e.to === data.to
        && (e.fromPort || 'out') === (data.fromPort || 'out')
        && (e.toPort || 'in') === (data.toPort || 'in')
        && (e.label || '') === (data.label || ''),
    );
    if (exists) return null;
    pushHistory();
    const edge = {
      id: data.id || freshEdgeId(),
      from: data.from,
      to: data.to,
      fromPort: data.fromPort || 'out',
      toPort: data.toPort || 'in',
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

  /**
   * Supprime toutes les arêtes connectées à un port donné d'un nœud.
   *   port = 'out'  → supprime les arêtes SORTANTES (from === nodeId)
   *   port = 'in'   → supprime les arêtes ENTRANTES  (to   === nodeId)
   *   port = '*'    → supprime TOUTES les arêtes incidentes
   * Utilisé par le menu du port pour déconnecter puis reconnecter ailleurs.
   */
  removeNodeEdges(nodeId, port = '*') {
    const before = state.edges.length;
    const toRemove = state.edges.filter((e) => {
      if (port === '*') return e.from === nodeId || e.to === nodeId;
      // Port spécifique : on compare le port source ou cible (fallback 'out'/'in' pour anciens edges)
      if (e.from === nodeId && (e.fromPort || 'out') === port) return true;
      if (e.to === nodeId && (e.toPort || 'in') === port) return true;
      return false;
    });
    if (toRemove.length === 0) return 0;
    pushHistory();
    const removedIds = new Set(toRemove.map((e) => e.id));
    state.edges = state.edges.filter((e) => !removedIds.has(e.id));
    for (const id of removedIds) state.selection.edges.delete(id);
    notify({ type: 'edges:bulk-removed', ids: [...removedIds] });
    return toRemove.length;
  },

  /**
   * Crée un connecteur multiple (hub) rattaché à un port d'un nœud source.
   * @param {string} sourceNodeId - ID du nœud source
   * @param {string} sourcePort  - port du nœud source ('in','out','top','bottom')
   * @param {number} branchCount - nombre de branches (4, 6, 8, 10)
   * @param {number} x - position X (top-left de l'élément hub)
   * @param {number} y - position Y
n   */
  createHub(sourceNodeId, sourcePort, branchCount, x, y) {
    pushHistory();
    const id = freshNodeId('hub');
    const hub = {
      id,
      type: 'hub',
      label: '',
      x: Number.isFinite(x) ? x : 0,
      y: Number.isFinite(y) ? y : 0,
      hubBranches: branchCount,
      hubBasePort: sourcePort,
      priority: 'medium',
      description: '',
      metadata: [],
      properties: {},
      variant: null,
      icon: 'hub',
      color: null,
      background: null,
    };
    state.nodes.push(hub);

    // Arête de base : relie le nœud source au hub
    const isOutput = sourcePort === 'out' || sourcePort === 'bottom';
    const baseEdge = {
      id: freshEdgeId(),
      ...(isOutput
        ? { from: sourceNodeId, to: id, fromPort: sourcePort, toPort: 'hub-base' }
        : { from: id, to: sourceNodeId, fromPort: 'hub-base', toPort: sourcePort }),
      label: '',
      type: 'arrow',
    };
    state.edges.push(baseEdge);

    recomputeStatus();
    notify({ type: 'node:added', node: hub });
    return hub;
  },

  /**
   * Met à jour le nombre de branches d'un hub.
   * Supprime les arêtes excédentaires si le nombre diminue.
   */
  updateHubBranches(hubId, newCount) {
    const hub = state.nodes.find((n) => n.id === hubId);
    if (!hub || hub.type !== 'hub') return;
    const oldCount = hub.hubBranches || 4;
    if (newCount === oldCount) return;

    pushHistory();
    hub.hubBranches = newCount;

    // Supprimer les arêtes des branches >= newCount
    if (newCount < oldCount) {
      const toRemove = state.edges.filter((e) => {
        if (e.from === hubId && e.fromPort?.startsWith('hub-')) {
          return parseInt(e.fromPort.split('-')[1], 10) >= newCount;
        }
        if (e.to === hubId && e.toPort?.startsWith('hub-')) {
          return parseInt(e.toPort.split('-')[1], 10) >= newCount;
        }
        return false;
      });
      const removeIds = new Set(toRemove.map((e) => e.id));
      state.edges = state.edges.filter((e) => !removeIds.has(e.id));
      for (const rid of removeIds) state.selection.edges.delete(rid);
    }

    recomputeStatus();
    notify({ type: 'node:updated', node: hub });
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
      return {
        description: '',
        metadata: [],
        properties: {},
        variant: null,
        icon: null,
        color: null,
        background: null,
        ...n,
        id: newId,
      };
    });
    const newEdges = rawEdges.map((e, i) => ({
      ...e,
      id: `e${i + 1}`,
      from: idMap.get(e.from) || e.from,
      to: idMap.get(e.to) || e.to,
      fromPort: e.fromPort || 'out',
      toPort: e.toPort || 'in',
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

  completeConnection(nodeId, targetPort) {
    const fromId = state.connection.from;
    const fromPort = state.connection.port;
    if (!fromId) return null;
    // Auto-loop interdit
    if (fromId === nodeId) {
      actions.cancelConnection();
      return null;
    }
    // Reset avant d'ajouter (pour ne pas garder l'état pending dans le snap)
    state.connection.from = null;
    state.connection.port = null;
    const edge = actions.addEdge({
      from: fromId,
      to: nodeId,
      fromPort: fromPort || 'out',
      toPort: targetPort || 'in',
    });
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

  /* ----- assistant / providers ----- */

  /**
   * Sélectionne un provider (préset ou custom) et réinitialise
   * la configuration avec les valeurs par défaut du preset.
   */
  setProvider(presetOrId) {
    const preset = typeof presetOrId === 'string'
      ? findPreset(presetOrId)
      : presetOrId;
    if (!preset) return;

    state.assistant.provider = {
      id: preset.id,
      apiKey: state.assistant.provider?.id === preset.id ? (state.assistant.provider.apiKey || '') : '',
      baseUrl: preset.baseUrl || '',
      model: preset.defaultModel || '',
      temperature: 0.7,
      maxTokens: 4096,
      isConnected: false,
      lastTestedAt: null,
    };
    persistAssistant();
    notify({ type: 'assistant:provider', provider: state.assistant.provider });
  },

  /**
   * Met à jour un champ du provider courant (apiKey, model, temperature…).
   */
  updateProvider(patch) {
    Object.assign(state.assistant.provider, patch);
    persistAssistant();
    notify({ type: 'assistant:provider', provider: state.assistant.provider });
  },

  /**
   * Ajoute un provider custom et le sélectionne.
   */
  addCustomProvider(provider) {
    if (!provider || !provider.id || !provider.name) return;
    // Éviter les doublons d'ID
    const exists = state.assistant.providers.custom.some((p) => p.id === provider.id);
    if (exists) return;

    const custom = {
      id: provider.id,
      name: provider.name,
      category: provider.category || 'online',
      baseUrl: provider.baseUrl || '',
      authRequired: provider.authRequired !== false,
      defaultModel: provider.defaultModel || '',
      models: provider.models || [],
      icon: provider.icon || 'plug',
      description: provider.description || '',
    };
    state.assistant.providers.custom.push(custom);
    actions.setProvider(custom);
    notify({ type: 'assistant:custom-provider', custom });
  },

  /**
   * Supprime un provider custom par ID.
   */
  removeCustomProvider(id) {
    const idx = state.assistant.providers.custom.findIndex((p) => p.id === id);
    if (idx === -1) return;
    state.assistant.providers.custom.splice(idx, 1);
    // Si c'était le provider actif, revenir au défaut
    if (state.assistant.provider.id === id) {
      actions.setProvider('ollama');
    }
    persistAssistant();
    notify({ type: 'assistant:custom-provider-removed', id });
  },

  /**
   * Réinitialise le provider aux valeurs par défaut (Ollama).
   */
  resetProvider() {
    actions.setProvider({ ...DEFAULT_PROVIDER });
  },

  /* ----- API keys ----- */

  /**
   * Ajoute une clé API.
   * @param {Object} apiKey - { name, providerId, value }
   */
  addApiKey(apiKey) {
    if (!apiKey || !apiKey.value) return;
    const key = {
      name: apiKey.name || `Clé ${(state.assistant.apiKeys || []).length + 1}`,
      providerId: apiKey.providerId || '',
      value: apiKey.value,
      createdAt: Date.now(),
    };
    if (!Array.isArray(state.assistant.apiKeys)) {
      state.assistant.apiKeys = [];
    }
    state.assistant.apiKeys.push(key);
    persistAssistant();
    notify({ type: 'assistant:api-key-added', apiKey: key });
  },

  /**
   * Met à jour une clé API par index.
   * @param {number} index
   * @param {Object} patch - { name?, providerId?, value? }
   */
  updateApiKey(index, patch) {
    const keys = state.assistant.apiKeys;
    if (!Array.isArray(keys) || index < 0 || index >= keys.length) return;
    Object.assign(keys[index], patch);
    persistAssistant();
    notify({ type: 'assistant:api-key-updated', apiKey: keys[index] });
  },

  /**
   * Supprime une clé API par index.
   * @param {number} index
   */
  removeApiKey(index) {
    const keys = state.assistant.apiKeys;
    if (!Array.isArray(keys) || index < 0 || index >= keys.length) return;
    keys.splice(index, 1);
    persistAssistant();
    notify({ type: 'assistant:api-key-removed', index });
  },

  /* ----- chat history ----- */

  /**
   * Ajoute un message à l'historique de chat.
   * @param {Object} message - { role, content, timestamp?, metadata? }
   */
  pushChatMessage(message) {
    if (!message || !message.role || !message.content) return;
    const chatMessage = {
      role: message.role,
      content: message.content,
      timestamp: message.timestamp || Date.now(),
      metadata: message.metadata || {},
    };
    if (!Array.isArray(state.assistant.chatHistory)) {
      state.assistant.chatHistory = [];
    }
    state.assistant.chatHistory.push(chatMessage);
    // Tronquer au-delà de la limite
    if (state.assistant.chatHistory.length > MAX_HISTORY_MESSAGES) {
      state.assistant.chatHistory = state.assistant.chatHistory.slice(-MAX_HISTORY_MESSAGES);
    }
    persistAssistant();
    notify({ type: 'assistant:chat-message', message: chatMessage });
  },

  /**
   * Réinitialise l'historique de chat.
   */
  clearChatHistory() {
    state.assistant.chatHistory = [];
    persistAssistant();
    notify({ type: 'assistant:chat-cleared' });
  },

  /**
   * Teste la connexion au provider courant.
   * @returns {Promise<{ ok: boolean, latency: number, error?: string }>}
   */
  async testProviderConnection() {
    const provider = state.assistant.provider;
    if (!provider || !provider.id) {
      return { ok: false, latency: 0, error: 'Aucun provider configuré' };
    }
    const result = await testConnection({
      ...provider,
      category: getPresetCategory(provider.id),
    });
    state.assistant.provider.isConnected = result.ok;
    state.assistant.provider.lastTestedAt = Date.now();
    persistAssistant();
    notify({ type: 'assistant:provider-tested', result });
    return result;
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
