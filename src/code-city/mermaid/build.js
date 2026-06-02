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
};

const DEFAULT_SHAPE = { open: '[', close: ']' };

/** Échappe un label pour Mermaid (entre guillemets). */
function quoteLabel(label) {
  const s = String(label ?? '').replace(/"/g, '\\"');
  return `"${s}"`;
}

/** Formate un identifiant pour Mermaid. Les IDs "exotiques" (avec des
 *  caractères non alphanumériques autres que `_`) sont entourés de
 *  guillemets : `"n1-user"`. Les IDs simples (lettres/chiffres/_) restent
 *  tels quels : `n1`. */
function toMermaidId(id) {
  if (/^[A-Za-z][A-Za-z0-9_]*$/.test(id)) return id;
  return `"${String(id).replace(/"/g, '\\"')}"`;
}

/** Renvoie la forme Mermaid pour un type donné. */
function shapeFor(type) {
  return SHAPE_BY_TYPE[type] || DEFAULT_SHAPE;
}

/**
 * Génère le code Mermaid à partir de l'état du store.
 * @param {{ nodes: Array, edges: Array }} graph
 * @returns {string} code Mermaid
 */
export function buildMermaidCode(graph) {
  const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
  const edges = Array.isArray(graph?.edges) ? graph.edges : [];

  const lines = ['graph TD'];

  // 1) déclarations de nœuds (pour donner un libellé propre à chaque)
  for (const n of nodes) {
    const shape = shapeFor(n.type);
    const id = toMermaidId(n.id);
    lines.push(`    ${id}${shape.open}${quoteLabel(n.label || n.type)}${shape.close}`);
  }

  // 2) arêtes
  for (const e of edges) {
    if (!e.from || !e.to) continue;
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
  const declared = new Map(); // id -> label

  // Trouver l'en-tête `graph TD` ou `flowchart TD`
  const headerIdx = lines.findIndex((l) => /^\s*(graph|flowchart)\s+/i.test(l));
  if (headerIdx === -1) {
    return { nodes: [], edges: [], error: 'En-tête `graph TD` manquant' };
  }

  // Première passe : déclarations de nœuds
  for (let i = headerIdx + 1; i < lines.length; i++) {
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
    nodes.push({
      id,
      label: declaredNode?.label ?? id,
      type: declaredNode?.type ?? 'process',
    });
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
