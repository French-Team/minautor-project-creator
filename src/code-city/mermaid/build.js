/**
 * Mermaid Build — Génération et parsing du code Mermaid
 *
 * - buildMermaidCode(state) : produit une chaîne de code Mermaid
 * - parseMermaidCode(code)  : analyse du code (best-effort) et renvoie
 *                              { nodes, edges, error? }
 *
 * Le format utilisé est `graph TD` (top-down). Chaque type de nœud du
 * store est mappé vers une forme Mermaid. Les IDs internes (UUID) sont
 * réutilisés tels quels pour permettre le round-trip.
 */

/* Mapping type interne -> forme Mermaid (et libellé safe) */
const SHAPE_BY_TYPE = {
  start:      { open: '([',    close: '])' },
  end:        { open: '([',    close: '])' },
  process:    { open: '[',     close: ']'  },
  decision:   { open: '{',     close: '}'  },
  document:   { open: '[/',    close: '/]' },
  user:       { open: '>',     close: ']'  },
  storage:    { open: '[(',    close: ')]' },
  module:     { open: '[[',    close: ']]' },
  important:  { open: '(',     close: ')'  },
  attention:  { open: '(',     close: ')'  },
  idea:       { open: '(',     close: ')'  },
  goal:       { open: '(',     close: ')'  },
  success:    { open: '(',     close: ')'  },
  hub:        { open: '{{',    close: '}}' },

  // Tests & Qualité
  'test-unit':        { open: '[',  close: ']'  },
  'test-integration': { open: '[',  close: ']'  },
  'test-e2e':         { open: '[',  close: ']'  },
  'test-coverage':    { open: '[',  close: ']'  },

  // DevOps & Infrastructure
  'devops-ci':         { open: '[',  close: ']'  },
  'devops-cd':         { open: '[',  close: ']'  },
  'devops-container':  { open: '[',  close: ']'  },
  'devops-monitoring': { open: '[',  close: ']'  },
  'devops-infra':      { open: '[',  close: ']'  },

  // Gestion de dépendances
  'dep-package': { open: '[[', close: ']]' },
  'dep-version': { open: '[[', close: ']]' },
  'dep-mono':    { open: '[[', close: ']]' },

  // Design Patterns
  'pattern-singleton': { open: '[[', close: ']]' },
  'pattern-observer':  { open: '[[', close: ']]' },
  'pattern-factory':   { open: '[[', close: ']]' },
  'pattern-adapter':   { open: '[[', close: ']]' },
  'pattern-strategy':  { open: '[[', close: ']]' },

  // Sécurité
  'sec-auth':     { open: '([', close: '])' },
  'sec-encrypt':  { open: '([', close: '])' },
  'sec-rbac':     { open: '([', close: '])' },
  'sec-firewall': { open: '([', close: '])' },

  // UI/UX Design
  'uiux-designsystem': { open: '[[', close: ']]' },
  'uiux-responsive':   { open: '[[', close: ']]' },
  'uiux-a11y':         { open: '[[', close: ']]' },
  'uiux-animation':    { open: '[[', close: ']]' },

  // Git & Versioning
  'git-branch': { open: '([', close: '])' },
  'git-merge':  { open: '([', close: '])' },
  'git-pr':     { open: '([', close: '])' },

  // Communication & Messaging
  'msg-event':        { open: '[/', close: '/]' },
  'msg-websocket':    { open: '[/', close: '/]' },
  'msg-rest':         { open: '[/', close: '/]' },
  'msg-microservice': { open: '[/', close: '/]' },

  // Composants enrichis
  'component-form':  { open: '[[', close: ']]' },
  'component-modal': { open: '[[', close: ']]' },
  'component-table': { open: '[[', close: ']]' },

  // Services enrichis
  'service-cache': { open: '[(', close: ')]' },
  'service-queue': { open: '[',  close: ']'  },

  // Environnement enrichi
  'env-config': { open: '[/', close: '/]' },

  // Architecture (nouvelle)
  'arch-clean':          { open: '[[', close: ']]' },
  'arch-hexagonal':      { open: '[[', close: ']]' },
  'arch-microfrontend':  { open: '[[', close: ']]' },
  'arch-monolith':       { open: '[[', close: ']]' },
  'arch-event-driven':   { open: '[[', close: ']]' },
  'arch-serverless':     { open: '[[', close: ']]' },

  // Data / IA (nouvelle)
  'data-ml':       { open: '[',  close: ']'  },
  'data-training': { open: '[',  close: ']'  },
  'data-pipeline': { open: '[',  close: ']'  },
  'data-ai':       { open: '[',  close: ']'  },

  // Gestion de projet (nouvelle)
  'proj-story':  { open: '[', close: ']' },
  'proj-task':   { open: '[', close: ']' },
  'proj-sprint': { open: '[', close: ']' },
  'proj-bug':    { open: '[', close: ']' },
  'proj-ticket': { open: '[', close: ']' },

  // Services enrichis (intégrations)
  'service-notif':   { open: '[/', close: '/]' },
  'service-email':   { open: '[/', close: '/]' },
  'service-webhook': { open: '[/', close: '/]' },

  // Tests enrichis (qualité de code)
  'test-lint':    { open: '[', close: ']' },
  'test-review':  { open: '[', close: ']' },
  'test-metrics': { open: '[', close: ']' },

  // DevOps enrichis (réseau)
  'devops-dns': { open: '[', close: ']' },
  'devops-lb':  { open: '[', close: ']' },
  'devops-cdn': { open: '[', close: ']' },

  // Design Patterns enrichis
  'pattern-decorator': { open: '[[', close: ']]' },
  'pattern-builder':   { open: '[[', close: ']]' },
  'pattern-composite': { open: '[[', close: ']]' },
  'pattern-proxy':     { open: '[[', close: ']]' },
  'pattern-state':     { open: '[[', close: ']]' },
  'pattern-command':   { open: '[[', close: ']]' },

  // Composants enrichis
  'component-sidebar':    { open: '[[', close: ']]' },
  'component-breadcrumb': { open: '[[', close: ']]' },
  'component-stepper':    { open: '[[', close: ']]' },
  'component-tabs':       { open: '[[', close: ']]' },
  'component-drawer':     { open: '[[', close: ']]' },
  'component-card':       { open: '[[', close: ']]' },

  // Services enrichis
  'service-search':   { open: '[/', close: '/]' },
  'service-s3':       { open: '[(', close: ')]' },
  'service-payment':  { open: '[/', close: '/]' },
  'service-logging':  { open: '[/', close: '/]' },

  // Sécurité enrichie
  'sec-oauth2':    { open: '([', close: '])' },
  'sec-ratelimit': { open: '([', close: '])' },
  'sec-cors':      { open: '([', close: '])' },
  'sec-csp':       { open: '([', close: '])' },
  'sec-audit':     { open: '([', close: '])' },

  // Git enrichi
  'git-tag':        { open: '([', close: '])' },
  'git-stash':      { open: '([', close: '])' },
  'git-cherrypick': { open: '([', close: '])' },
  'git-revert':     { open: '([', close: '])' },

  // Data / IA enrichis
  'data-warehouse': { open: '[(', close: ')]' },
  'data-viz':       { open: '[',  close: ']'  },
  'data-streaming': { open: '[',  close: ']'  },

  // Architecture enrichie
  'arch-microservices': { open: '[[', close: ']]' },
  'arch-layered':       { open: '[[', close: ']]' },
  'arch-soa':           { open: '[[', close: ']]' },
  'arch-ddd':           { open: '[[', close: ']]' },

  // UI/UX enrichi
  'uiux-theming':  { open: '[',  close: ']'  },
  'uiux-gestures': { open: '[',  close: ']'  },
  'uiux-loading':  { open: '[',  close: ']'  },
  'uiux-error':    { open: '[',  close: ']'  },

  // Communication enrichi
  'msg-grpc':        { open: '[/', close: '/]' },
  'msg-mqtt':        { open: '[/', close: '/]' },
  'msg-sse':         { open: '[/', close: '/]' },
  'msg-graphql-sub': { open: '[/', close: '/]' },

  // Initialisation enrichie
  'init-angular': { open: '([', close: '])' },
  'init-svelte':  { open: '([', close: '])' },
  'init-nestjs':  { open: '([', close: '])' },
  'init-express': { open: '([', close: '])' },

  // Gestion de projet enrichie
  'proj-roadmap':    { open: '[', close: ']' },
  'proj-retro':      { open: '[', close: ']' },
  'proj-backlog':    { open: '[', close: ']' },
  'proj-estimation': { open: '[', close: ']' },
  'proj-milestone':  { open: '[', close: ']' },

  // Gestion de dépendances enrichie
  'dep-audit':    { open: '[[', close: ']]' },
  'dep-license':  { open: '[[', close: ']]' },
  'dep-update':   { open: '[[', close: ']]' },
  'dep-registry': { open: '[[', close: ']]' },
  'dep-lockfile': { open: '[[', close: ']]' },

  // Environnement enrichi
  'env-secrets':       { open: '[/', close: '/]' },
  'env-feature-flag':  { open: '(',  close: ')'  },
  'env-staging':       { open: '[/', close: '/]' },
  'env-local':         { open: '[',  close: ']'  },
  'env-logging':       { open: '[/', close: '/]' },

  // Tests & Qualité enrichis
  'test-snapshot':  { open: '[', close: ']' },
  'test-perf':      { open: '[', close: ']' },
  'test-mutation':  { open: '[', close: ']' },
  'test-bdd':       { open: '[', close: ']' },

  // DevOps enrichi
  'devops-registry':      { open: '[(', close: ')]' },
  'devops-secrets':       { open: '([', close: '])' },
  'devops-alerting':      { open: '(',  close: ')'  },
  'devops-feature-flag':  { open: '([', close: '])' },
};

const DEFAULT_SHAPE = { open: '[', close: ']' };

/** Échappe un label pour Mermaid (entre guillemets).
 *  - Échappe les guillemets doubles (Mermaid string escape)
 *  - Convertit les sauts de ligne en <br> (htmlLabels:true permet le rendu HTML)
 *  - Convertit les tabs en espaces (sinon le parser Mermaid les interprète mal)
 *  - Trim les espaces superflus
 *  - Filet de sécurité : si le label est vide, on met un placeholder
 */
function quoteLabel(label) {
  let s = String(label ?? '')
    .replace(/\r\n?/g, '\n')        // normalise les fins de ligne
    .replace(/"/g, '\\"')           // échappe les guillemets
    .replace(/\n/g, '<br>')         // sauts de ligne → <br> (htmlLabels)
    .replace(/\t/g, '    ')         // tabs → 4 espaces
    .trim();
  if (s === '') s = ' ';
  return `"${s}"`;
}

/** Échappe du texte "plain" pour l'inclure dans un label Mermaid rendu en
 *  HTML. Contrairement à quoteLabel, on neutralise les chevrons pour éviter
 *  toute injection HTML/SVG côté aperçu. Les sauts de ligne sont
 *  convertis en <br>, les guillemets échappés pour Mermaid. */
function quotePlainLabel(text) {
  let s = String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[<>]/g, (c) => (c === '<' ? '&lt;' : '&gt;'))
    .replace(/"/g, '\\"')
    .replace(/\n/g, '<br>')
    .replace(/\t/g, '    ')
    .trim();
  return s; // pas de wrap guillemets, ce texte est concaténé dans un label déjà quoté
}

/** Formate un identifiant pour Mermaid. Les IDs "exotiques" (avec des
 *  caractères non alphanumériques autres que `_`) sont entourés de
 *  guillemets : `"n1-user"`. Les IDs simples (lettres/chiffres/_) restent
 *  tels quels : `n1`. */
function toMermaidId(id) {
  if (/^[A-Za-z][A-Za-z0-9_]*$/.test(id)) return id;
  return `"${String(id).replace(/"/g, '\\"')}"`;
}

/** Renvoie la forme Mermaid pour un type donné.
 *  - Les types de la palette flowchart ont un mapping explicite.
 *  - Les types "projet" sont mappés par préfixe (component-* → module,
 *    service-database → storage, le reste → process).
 *  - Tout type inconnu tombe sur le DEFAULT_SHAPE (rectangle). */
function shapeFor(type) {
  if (SHAPE_BY_TYPE[type]) return SHAPE_BY_TYPE[type];
  if (type.startsWith('component-')) return SHAPE_BY_TYPE.module;
  if (type.startsWith('test-')) return DEFAULT_SHAPE;
  if (type.startsWith('devops-')) return DEFAULT_SHAPE;
  if (type.startsWith('dep-')) return SHAPE_BY_TYPE.module;
  if (type.startsWith('pattern-')) return SHAPE_BY_TYPE.module;
  if (type.startsWith('sec-')) return SHAPE_BY_TYPE.start;
  if (type.startsWith('uiux-')) return SHAPE_BY_TYPE.module;
  if (type.startsWith('git-')) return SHAPE_BY_TYPE.start;
  if (type.startsWith('msg-')) return SHAPE_BY_TYPE.document;
  if (type.startsWith('arch-')) return SHAPE_BY_TYPE.module;
  if (type.startsWith('data-')) return DEFAULT_SHAPE;
  if (type.startsWith('proj-')) return DEFAULT_SHAPE;
  if (type.startsWith('service-notif') || type.startsWith('service-email') || type.startsWith('service-webhook')) return SHAPE_BY_TYPE.document;
  if (type === 'service-database' || type === 'service-cache') return SHAPE_BY_TYPE.storage;
  if (type === 'service-queue') return DEFAULT_SHAPE;
  if (type === 'env-config') return SHAPE_BY_TYPE.document;
  return DEFAULT_SHAPE;
}

/**
 * Génère le code Mermaid à partir de l'état du store.
 * @param {{ nodes: Array, edges: Array }} graph
 * @returns {string} code Mermaid
 */
export function buildMermaidCode(graph) {
  const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
  const edges = Array.isArray(graph?.edges) ? graph.edges : [];

  // --- Exclure les hubs : nœuds canvas-only, pas d'équivalent Mermaid ---
  const hubIds = new Set(nodes.filter(n => n.type === 'hub').map(n => n.id));

  // Résoudre les connexions hub → arêtes directes source→target
  // 1) Trouver l'arête "source → hub" (via port hub-base)
  // 2) Trouver les arêtes "hub → target" (via ports hub-N)
  // 3) Générer des arêtes directes source→target, sans le hub
  const extraEdges = [];
  for (const hubId of hubIds) {
    const baseEdge = edges.find(e =>
      e.to === hubId && (e.toPort || 'in') === 'hub-base'
    );
    if (!baseEdge) continue;
    const sourceId = baseEdge.from;
    for (const e of edges) {
      if (e.from === hubId && (e.fromPort || '').startsWith('hub-') && e.to && e.to !== hubId) {
        extraEdges.push({ from: sourceId, to: e.to, label: e.label || '' });
      }
    }
  }

  const lines = ['graph TD'];

  // 1) Annotations propriétés (%% @props nodeId {json})
  //    Visibles dans le code mais invisibles dans le rendu Mermaid.
  for (const n of nodes) {
    if (hubIds.has(n.id)) continue;
    const props = n.properties;
    if (props && typeof props === 'object' && Object.keys(props).length > 0) {
      // Filtrer les valeurs vides/null/undefined
      const cleaned = {};
      for (const [k, v] of Object.entries(props)) {
        if (v != null && v !== '') cleaned[k] = v;
      }
      if (Object.keys(cleaned).length > 0) {
        lines.push(`    %% @props ${toMermaidId(n.id)} ${JSON.stringify(cleaned)}`);
      }
    }
  }

  // 2) déclarations de nœuds (pour donner un libellé propre à chaque)
  for (const n of nodes) {
    if (hubIds.has(n.id)) continue; // exclure les hubs
    const shape = shapeFor(n.type);
    const id = toMermaidId(n.id);
    const baseLabel = n.label || n.type;
    const desc = quotePlainLabel(n.description);
    // Le libellé est assemblé : libellé + (optionnel) <br><small>description</small>
    const labelHtml = desc ? `${baseLabel}<br><small>${desc}</small>` : baseLabel;
    lines.push(`    ${id}${shape.open}${quoteLabel(labelHtml)}${shape.close}`);
  }

  // 3) arêtes (hors hubs)
  for (const e of edges) {
    if (!e.from || !e.to) continue;
    if (hubIds.has(e.from) || hubIds.has(e.to)) continue;
    const from = toMermaidId(e.from);
    const to = toMermaidId(e.to);
    if (e.label) {
      lines.push(`    ${from} -->|${quoteLabel(e.label)}| ${to}`);
    } else {
      lines.push(`    ${from} --> ${to}`);
    }
  }
  // 4) Arêtes directes résolues depuis les hubs
  for (const e of extraEdges) {
    const from = toMermaidId(e.from);
    const to = toMermaidId(e.to);
    if (e.label) {
      lines.push(`    ${from} -->|${quoteLabel(e.label)}| ${to}`);
    } else {
      lines.push(`    ${from} --> ${to}`);
    }
  }

  return lines.join('\n') + '\n';
}

/* --------------------------------------------------------------------------
 * Parser (best-effort, syntaxe Mermaid `graph TD` simplifiée)
 * -------------------------------------------------------------------------- */

/**
 * Extrait l'identifiant et le label d'une déclaration de nœud Mermaid.
 * Renvoie null si la ligne n'est pas une déclaration de nœud.
 */
function parseNodeLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('%%')) return null;

  // Une ligne qui contient une flèche est une arête, pas une déclaration
  if (/(-->|---|-\.-|==>|x{1,2}x)/.test(trimmed)) return null;

  // id (guillemeté ou non) suivi d'une forme ouvrante, jusqu'à la fin de ligne.
  //   "n1-user"["Label"]  → id="n1-user", open="[", label=`"Label"`, close="]"
  //   n1[Label]            → id="n1",    open="[", label="Label",  close="]"
  const match = trimmed.match(/^("([^"]+)"|([A-Za-z_][A-Za-z0-9_-]*))\s*([\[\(\{>]{1,3}|\[\/|\(\\\/)(.*?)([\)\}\]]{1,3}|\/\]]|\)\])\s*$/);
  if (!match) return null;

  const [, , idQuoted, idBare, open, labelRaw, close] = match;
  const id = idQuoted || idBare;
  if (!close || !open || !id) return null;

  // Filet de sécurité : le label ne doit pas contenir d'opérateurs
  if (/(-->|---|-\.-|==>|x{1,2}x)/.test(labelRaw)) return null;

  let label = labelRaw.trim();
  if (label.startsWith('"') && label.endsWith('"')) {
    label = label.slice(1, -1).replace(/\\"/g, '"');
  }

  return { id, label, open, close };
}

/**
 * Extrait un identifiant Mermaid d'un token (guillemeté ou non).
 * Renvoie null si le token n'est pas un ID valide.
 */
function extractId(token) {
  const t = String(token).trim();
  // ID guillemeté : "n1-user"
  if (t.startsWith('"')) {
    const end = t.indexOf('"', 1);
    if (end > 1) return t.slice(1, end);
    return null;
  }
  // ID non guillemeté : lettres/chiffres/_/-
  const m = t.match(/^([A-Za-z_][A-Za-z0-9_-]*)/);
  return m ? m[1] : null;
}

/**
 * Extrait une arête d'une ligne Mermaid.
 */
function parseEdgeLine(line) {
  const arrowMatch = line.match(/(-->|---|-\.-|==>|x{1,2}x)/);
  if (!arrowMatch) return null;

  const arrowIdx = arrowMatch.index;
  const leftPart = line.slice(0, arrowIdx).trim();
  const rightPart = line.slice(arrowIdx + arrowMatch[0].length).trim();
  if (!leftPart || !rightPart) return null;

  // Label de bord optionnel : |...| ou "..."
  let label = '';
  let right = rightPart;
  const labelMatch = rightPart.match(/^\|([^|]*)\|\s*(.+)$/);
  if (labelMatch) {
    label = labelMatch[1].trim();
    if (label.startsWith('"') && label.endsWith('"')) {
      label = label.slice(1, -1).replace(/\\"/g, '"');
    }
    right = labelMatch[2].trim();
  }

  // IDs : on accepte les groupes `A & B` mais chaque token doit
  // ressembler à un identifiant Mermaid (les formes inline sont
  // volontairement ignorées, on déduira les labels depuis les
  // déclarations de nœuds).
  const fromIds = leftPart.split('&').map(extractId).filter(Boolean);
  const toIds = right.split('&').map(extractId).filter(Boolean);
  if (fromIds.length === 0 || toIds.length === 0) return null;

  const edges = [];
  for (const from of fromIds) {
    for (const to of toIds) {
      edges.push({ from, to, label });
    }
  }
  return edges;
}

/**
 * Déduit le type de nœud à partir de la forme Mermaid.
 * C'est l'inverse du SHAPE_BY_TYPE, best-effort.
 */
function inferType(open, close) {
  const key = open + '|' + close;
  for (const [type, shape] of Object.entries(SHAPE_BY_TYPE)) {
    if (shape.open === open && shape.close === close) return type;
  }
  // heuristiques de repli
  if (open === '{') return 'decision';
  if (open === '([' && close === '])') return 'process';
  return 'process';
}

/**
 * Parse un code Mermaid (best-effort). Renvoie
 *   { nodes: [{id,label,type}], edges: [{from,to,label}], error? }
 */
export function parseMermaidCode(code) {
  if (typeof code !== 'string') {
    return { nodes: [], edges: [], error: 'Code invalide' };
  }

  const lines = code.split(/\r?\n/);
  const declared = new Map(); // id -> { label, type }
  const propsMap = new Map(); // id -> { properties }

  // Trouver l'en-tête `graph TD` ou `flowchart TD`
  const headerIdx = lines.findIndex((l) => /^\s*(graph|flowchart)\s+/i.test(l));
  if (headerIdx === -1) {
    return { nodes: [], edges: [], error: 'En-tête `graph TD` manquant' };
  }

  // Première passe : annotations propriétés + déclarations de nœuds
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    // Parser les lignes %% @props nodeId {json}
    const propsMatch = trimmed.match(/^%%\s*@props\s+([A-Za-z_][A-Za-z0-9_-]*|"[^"]+")\s+(.+)$/);
    if (propsMatch) {
      const rawId = propsMatch[1];
      const id = rawId.startsWith('"') ? rawId.slice(1, -1) : rawId;
      try {
        const props = JSON.parse(propsMatch[2]);
        if (props && typeof props === 'object') {
          propsMap.set(id, props);
        }
      } catch (_) {
        // JSON invalide → on ignore silencieusement
      }
      continue;
    }

    const node = parseNodeLine(lines[i]);
    if (node) declared.set(node.id, { label: node.label, type: inferType(node.open, node.close) });
  }

  // Deuxième passe : arêtes
  const edges = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const parsed = parseEdgeLine(lines[i]);
    if (parsed) edges.push(...parsed);
  }

  // Déduire les nœuds : union de declared + arêtes
  const ids = new Set(declared.keys());
  for (const e of edges) {
    ids.add(e.from);
    ids.add(e.to);
  }

  const nodes = [];
  for (const id of ids) {
    const declaredNode = declared.get(id);
    const node = {
      id,
      label: declaredNode?.label ?? id,
      type: declaredNode?.type ?? 'process',
    };
    // N'inclure properties QUE si une ligne %% @props explicite existait.
    // L'absence de la clé indique au pipeline de vider les propriétés.
    if (propsMap.has(id)) {
      node.properties = propsMap.get(id);
    }
    nodes.push(node);
  }

  return { nodes, edges, error: null };
}

/**
 * Rend le code Mermaid en SVG via la lib mermaid. Renvoie un objet
 * { svg, error? }.
 */
import mermaid from 'mermaid';

export async function renderMermaidToSvg(code) {
  try {
    const id = 'mermaid-preview-' + Date.now();
    const { svg } = await mermaid.render(id, code);
    return { svg };
  } catch (err) {
    return { svg: '', error: err?.message || String(err) };
  }
}
