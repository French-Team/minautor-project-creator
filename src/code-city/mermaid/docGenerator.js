/**
 * Doc Generator — Générateur de documentation Markdown par catégorie
 *
 * Chaque catégorie de nœud produit un format Markdown adapté.
 * Les champs vides sont omis (pas de sections vides).
 *
 * Usage :
 *   import { generateDoc, generateDocSection, generateReadme } from './docGenerator.js';
 *   const md = generateDoc(node);          // 1 nœud → 1 section Markdown
 *   const full = generateDocSection(nodes); // nœuds → document multi-sections
 *   const readme = generateReadme(nodes, edges); // README synopsis
 */

import { getCategory } from '../propertySchemas.js';

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/** Échappe le texte pour le Markdown (évite les injections de balises). */
function esc(s) {
  return String(s || '').replace(/\|/g, '\\|');
}

/** Renvoie la valeur d'une propriété ou '' si absente/vide. */
function prop(node, key) {
  const v = node.properties?.[key];
  return v != null && String(v).trim() !== '' ? String(v).trim() : '';
}

/** Renvoie vrai si la valeur n'est pas vide. */
function hasProp(node, key) {
  return prop(node, key) !== '';
}

/** Génère une ligne de tableau Markdown. */
function tableRow(label, value) {
  if (!value) return '';
  return `| ${label} | \`${esc(value)}\` |`;
}

/** Génère une ligne de tableau avec contenu multi-ligne. */
function tableRowText(label, value) {
  if (!value) return '';
  return `| ${label} | ${value.replace(/\n/g, '<br>')} |`;
}

/** Priorité en emoji. */
function priorityEmoji(p) {
  const map = { low: '🟢', medium: '🟡', high: '🟠', critical: '🔴' };
  return map[p] || '';
}

/** Statut en emoji (proj-*). */
function statusEmoji(s) {
  const map = {
    'À faire': '⬜', 'En cours': '🔵', 'En revue': '🟡',
    'Terminé': '🟢', 'Bloqué': '🔴',
  };
  return map[s] || '';
}

/** Sévérité en emoji (sec-*). */
function severityEmoji(s) {
  const map = { Faible: '🟢', Moyen: '🟡', Élevé: '🟠', Critique: '🔴' };
  return map[s] || '';
}

/* -------------------------------------------------------------------------- */
/*  Templates par catégorie                                                   */
/* -------------------------------------------------------------------------- */

const TEMPLATES = {

  process: (node) => {
    const lines = [`## ${node.label}\n`];
    if (node.description) lines.push(`${node.description}\n`);
    const rows = [];
    if (hasProp(node, 'inputs')) rows.push(tableRowText('**Entrées**', prop(node, 'inputs')));
    if (hasProp(node, 'outputs')) rows.push(tableRowText('**Sorties**', prop(node, 'outputs')));
    if (hasProp(node, 'steps')) rows.push(tableRowText('**Étapes**', prop(node, 'steps')));
    if (rows.length) {
      lines.push('| Élément | Détail |');
      lines.push('|---------|--------|');
      lines.push(...rows);
      lines.push('');
    }
    return lines.join('\n');
  },

  decision: (node) => {
    const lines = [`## ${node.label}\n`];
    if (node.description) lines.push(`${node.description}\n`);
    if (hasProp(node, 'options')) {
      lines.push('### Options envisagées\n');
      prop(node, 'options').split('\n').forEach((o) => {
        if (o.trim()) lines.push(`- ${o.trim()}`);
      });
      lines.push('');
    }
    if (hasProp(node, 'criteria')) {
      lines.push('### Critères d\'évaluation\n');
      prop(node, 'criteria').split('\n').forEach((c) => {
        if (c.trim()) lines.push(`- ${c.trim()}`);
      });
      lines.push('');
    }
    if (hasProp(node, 'selected')) {
      lines.push(`> **Choix retenu :** ${prop(node, 'selected')}\n`);
    }
    return lines.join('\n');
  },

  service: (node) => {
    const lines = [`## ${node.label}\n`];
    if (node.description) lines.push(`${node.description}\n`);
    const method = prop(node, 'method');
    const endpoint = prop(node, 'endpoint');
    if (method || endpoint) {
      lines.push(`\`${method || 'GET'} ${endpoint || '/'}\`\n`);
    }
    const rows = [];
    if (hasProp(node, 'auth')) rows.push(tableRow('**Auth**', prop(node, 'auth')));
    if (hasProp(node, 'sla')) rows.push(tableRow('**SLA**', prop(node, 'sla')));
    if (rows.length) {
      lines.push('| Propriété | Valeur |');
      lines.push('|-----------|--------|');
      lines.push(...rows);
      lines.push('');
    }
    if (hasProp(node, 'requestSchema')) {
      lines.push('### Schéma requête\n');
      lines.push('```json');
      lines.push(prop(node, 'requestSchema'));
      lines.push('```\n');
    }
    if (hasProp(node, 'responseSchema')) {
      lines.push('### Schéma réponse\n');
      lines.push('```json');
      lines.push(prop(node, 'responseSchema'));
      lines.push('```\n');
    }
    return lines.join('\n');
  },

  devops: (node) => {
    const lines = [`## ${node.label}\n`];
    if (node.description) lines.push(`${node.description}\n`);
    const rows = [];
    if (hasProp(node, 'tool')) rows.push(tableRow('**Outil**', prop(node, 'tool')));
    if (hasProp(node, 'triggers')) rows.push(tableRow('**Déclencheurs**', prop(node, 'triggers')));
    if (rows.length) {
      lines.push('| Propriété | Valeur |');
      lines.push('|-----------|--------|');
      lines.push(...rows);
      lines.push('');
    }
    if (hasProp(node, 'steps')) {
      lines.push('### Étapes du pipeline\n');
      prop(node, 'steps').split('\n').forEach((s) => {
        if (s.trim()) lines.push(`- ${s.trim()}`);
      });
      lines.push('');
    }
    if (hasProp(node, 'rollback')) {
      lines.push('### Rollback\n');
      lines.push(prop(node, 'rollback'));
      lines.push('');
    }
    return lines.join('\n');
  },

  arch: (node) => {
    const lines = [`## ADR — ${node.label}\n`];
    if (node.description) lines.push(`${node.description}\n`);
    for (const [key, title] of [
      ['problem', 'Problème adressé'],
      ['solution', 'Solution retenue'],
      ['alternatives', 'Alternatives évaluées'],
      ['tradeoffs', 'Compromis'],
      ['consequences', 'Conséquences'],
    ]) {
      if (hasProp(node, key)) {
        lines.push(`### ${title}\n`);
        lines.push(prop(node, key));
        lines.push('');
      }
    }
    return lines.join('\n');
  },

  sec: (node) => {
    const lines = [`## ${node.label}\n`];
    if (node.description) lines.push(`${node.description}\n`);
    const sev = prop(node, 'severity');
    if (sev) lines.push(`**Sévérité :** ${severityEmoji(sev)} ${sev}\n`);
    const rows = [];
    if (hasProp(node, 'conformity')) rows.push(tableRow('**Conformité**', prop(node, 'conformity')));
    if (rows.length) {
      lines.push('| Propriété | Valeur |');
      lines.push('|-----------|--------|');
      lines.push(...rows);
      lines.push('');
    }
    if (hasProp(node, 'threat')) {
      lines.push('### Menace identifiée\n');
      lines.push(prop(node, 'threat'));
      lines.push('');
    }
    if (hasProp(node, 'mitigations')) {
      lines.push('### Mesures de mitigation\n');
      prop(node, 'mitigations').split('\n').forEach((m) => {
        if (m.trim()) lines.push(`- [ ] ${m.trim()}`);
      });
      lines.push('');
    }
    return lines.join('\n');
  },

  data: (node) => {
    const lines = [`## ${node.label}\n`];
    if (node.description) lines.push(`${node.description}\n`);
    const rows = [];
    if (hasProp(node, 'source')) rows.push(tableRow('**Source**', prop(node, 'source')));
    if (hasProp(node, 'format')) rows.push(tableRow('**Format**', prop(node, 'format')));
    if (hasProp(node, 'volume')) rows.push(tableRow('**Volume**', prop(node, 'volume')));
    if (hasProp(node, 'frequency')) rows.push(tableRow('**Fréquence**', prop(node, 'frequency')));
    if (rows.length) {
      lines.push('| Propriété | Valeur |');
      lines.push('|-----------|--------|');
      lines.push(...rows);
      lines.push('');
    }
    if (hasProp(node, 'schema')) {
      lines.push('### Schéma de données\n');
      lines.push('```');
      lines.push(prop(node, 'schema'));
      lines.push('```\n');
    }
    return lines.join('\n');
  },

  proj: (node) => {
    const lines = [`## ${node.label}\n`];
    if (node.description) lines.push(`${node.description}\n`);
    const status = prop(node, 'status');
    if (status) lines.push(`**Statut :** ${statusEmoji(status)} ${status}\n`);
    const rows = [];
    if (hasProp(node, 'assignee')) rows.push(tableRow('**Assigné à**', prop(node, 'assignee')));
    if (hasProp(node, 'estimation')) rows.push(tableRow('**Estimation**', prop(node, 'estimation')));
    if (hasProp(node, 'deadline')) rows.push(tableRow('**Échéance**', prop(node, 'deadline')));
    if (rows.length) {
      lines.push('| Propriété | Valeur |');
      lines.push('|-----------|--------|');
      lines.push(...rows);
      lines.push('');
    }
    if (hasProp(node, 'acceptance')) {
      lines.push('### Acceptance criteria\n');
      prop(node, 'acceptance').split('\n').forEach((a) => {
        if (a.trim()) lines.push(`- [ ] ${a.trim()}`);
      });
      lines.push('');
    }
    return lines.join('\n');
  },

  test: (node) => {
    const lines = [`## ${node.label}\n`];
    if (node.description) lines.push(`${node.description}\n`);
    const result = prop(node, 'result');
    const resultEmoji = { Pass: '✅', Fail: '❌', Skip: '⏭️', 'Non exécuté': '⬜' };
    if (result) lines.push(`**Résultat :** ${resultEmoji[result] || ''} ${result}\n`);
    const rows = [];
    if (hasProp(node, 'coverage')) rows.push(tableRow('**Couverture**', prop(node, 'coverage')));
    if (hasProp(node, 'framework')) rows.push(tableRow('**Framework**', prop(node, 'framework')));
    if (rows.length) {
      lines.push('| Propriété | Valeur |');
      lines.push('|-----------|--------|');
      lines.push(...rows);
      lines.push('');
    }
    if (hasProp(node, 'testCases')) {
      lines.push('### Cas de test\n');
      prop(node, 'testCases').split('\n').forEach((t) => {
        if (t.trim()) lines.push(`- ${t.trim()}`);
      });
      lines.push('');
    }
    return lines.join('\n');
  },

  uiux: (node) => {
    const lines = [`## ${node.label}\n`];
    if (node.description) lines.push(`${node.description}\n`);
    const rows = [];
    if (hasProp(node, 'responsive')) rows.push(tableRow('**Responsive**', prop(node, 'responsive')));
    if (hasProp(node, 'devices')) rows.push(tableRow('**Devices**', prop(node, 'devices')));
    if (rows.length) {
      lines.push('| Propriété | Valeur |');
      lines.push('|-----------|--------|');
      lines.push(...rows);
      lines.push('');
    }
    if (hasProp(node, 'wireframe')) {
      lines.push('### Wireframe / Maquette\n');
      lines.push(prop(node, 'wireframe'));
      lines.push('');
    }
    if (hasProp(node, 'accessibility')) {
      lines.push('### Accessibilité (WCAG)\n');
      prop(node, 'accessibility').split('\n').forEach((a) => {
        if (a.trim()) lines.push(`- ${a.trim()}`);
      });
      lines.push('');
    }
    return lines.join('\n');
  },

  pattern: (node) => {
    const lines = [`## Pattern — ${node.label}\n`];
    if (node.description) lines.push(`${node.description}\n`);
    for (const [key, title] of [
      ['problem', 'Problème résolu'],
      ['solution', 'Solution proposée'],
      ['tradeoffs', 'Compromis'],
      ['consequences', 'Conséquences'],
    ]) {
      if (hasProp(node, key)) {
        lines.push(`### ${title}\n`);
        lines.push(prop(node, key));
        lines.push('');
      }
    }
    return lines.join('\n');
  },

  env: (node) => {
    const lines = [`## ${node.label}\n`];
    if (node.description) lines.push(`${node.description}\n`);
    if (hasProp(node, 'variables')) {
      lines.push('### Variables d\'environnement\n');
      lines.push('```');
      lines.push(prop(node, 'variables'));
      lines.push('```\n');
    }
    if (hasProp(node, 'secrets')) {
      lines.push('### Secrets (noms)\n');
      prop(node, 'secrets').split('\n').forEach((s) => {
        if (s.trim()) lines.push(`- \`${s.trim()}\``);
      });
      lines.push('');
    }
    if (hasProp(node, 'regions')) {
      lines.push(`**Régions :** \`${prop(node, 'regions')}\`\n`);
    }
    return lines.join('\n');
  },

  component: (node) => {
    const lines = [`## Composant — ${node.label}\n`];
    if (node.description) lines.push(`${node.description}\n`);
    for (const [key, title] of [
      ['props', 'Props / Inputs'],
      ['states', 'État interne'],
      ['dependencies', 'Dépendances'],
      ['api', 'API publique'],
    ]) {
      if (hasProp(node, key)) {
        lines.push(`### ${title}\n`);
        lines.push('```');
        lines.push(prop(node, key));
        lines.push('```\n');
      }
    }
    return lines.join('\n');
  },

  git: (node) => {
    const lines = [`## ${node.label}\n`];
    if (node.description) lines.push(`${node.description}\n`);
    const rows = [];
    if (hasProp(node, 'branch')) rows.push(tableRow('**Branche**', prop(node, 'branch')));
    if (hasProp(node, 'merged')) rows.push(tableRow('**Merge**', prop(node, 'merged')));
    if (hasProp(node, 'pr')) rows.push(tableRow('**PR**', prop(node, 'pr')));
    if (rows.length) {
      lines.push('| Propriété | Valeur |');
      lines.push('|-----------|--------|');
      lines.push(...rows);
      lines.push('');
    }
    if (hasProp(node, 'conflicts')) {
      lines.push('### Conflits\n');
      lines.push(prop(node, 'conflicts'));
      lines.push('');
    }
    return lines.join('\n');
  },

  msg: (node) => {
    const lines = [`## ${node.label}\n`];
    if (node.description) lines.push(`${node.description}\n`);
    const rows = [];
    if (hasProp(node, 'protocol')) rows.push(tableRow('**Protocole**', prop(node, 'protocol')));
    if (hasProp(node, 'format')) rows.push(tableRow('**Format**', prop(node, 'format')));
    if (hasProp(node, 'qos')) rows.push(tableRow('**QoS**', prop(node, 'qos')));
    if (hasProp(node, 'retry')) rows.push(tableRow('**Retry**', prop(node, 'retry')));
    if (rows.length) {
      lines.push('| Propriété | Valeur |');
      lines.push('|-----------|--------|');
      lines.push(...rows);
      lines.push('');
    }
    return lines.join('\n');
  },

  init: (node) => {
    const lines = [`## ${node.label}\n`];
    if (node.description) lines.push(`${node.description}\n`);
    const rows = [];
    if (hasProp(node, 'version')) rows.push(tableRow('**Version**', prop(node, 'version')));
    if (hasProp(node, 'commande')) rows.push(tableRow('**Commande**', prop(node, 'commande')));
    if (rows.length) {
      lines.push('| Propriété | Valeur |');
      lines.push('|-----------|--------|');
      lines.push(...rows);
      lines.push('');
    }
    if (hasProp(node, 'dependencies')) {
      lines.push('### Dépendances principales\n');
      prop(node, 'dependencies').split('\n').forEach((d) => {
        if (d.trim()) lines.push(`- \`${d.trim()}\``);
      });
      lines.push('');
    }
    if (hasProp(node, 'config')) {
      lines.push('### Configuration\n');
      lines.push('```');
      lines.push(prop(node, 'config'));
      lines.push('```\n');
    }
    return lines.join('\n');
  },

  dep: (node) => {
    const lines = [`## ${node.label}\n`];
    if (node.description) lines.push(`${node.description}\n`);
    const rows = [];
    if (hasProp(node, 'name')) rows.push(tableRow('**Package**', prop(node, 'name')));
    if (hasProp(node, 'version')) rows.push(tableRow('**Version**', prop(node, 'version')));
    if (hasProp(node, 'license')) rows.push(tableRow('**Licence**', prop(node, 'license')));
    if (hasProp(node, 'auditStatus')) rows.push(tableRow('**Audit**', prop(node, 'auditStatus')));
    if (rows.length) {
      lines.push('| Propriété | Valeur |');
      lines.push('|-----------|--------|');
      lines.push(...rows);
      lines.push('');
    }
    return lines.join('\n');
  },

  default: (node) => {
    const lines = [`## ${node.label}\n`];
    if (node.description) lines.push(`${node.description}\n`);
    return lines.join('\n');
  },
};

/* -------------------------------------------------------------------------- */
/*  Traversée de graphe                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Résout le sous-ensemble aval (successeurs) à partir d'un nœud donné.
 * Utilise BFS avec Set visited + max depth 50 pour éviter les cycles.
 *
 * @param {string} nodeId - ID du nœud de départ
 * @param {Object[]} edges - Liste des arêtes du graphe
 * @returns {Set<string>} Set des IDs des nœuds atteints (incluant nodeId)
 */
export function resolveSubtree(nodeId, edges) {
  const visited = new Set([nodeId]);
  const queue = [{ id: nodeId, depth: 0 }];
  const MAX_DEPTH = 50;

  // Construire une map de successeurs : nodeId → [targetIds]
  const successors = new Map();
  for (const e of edges) {
    if (!e.from || !e.to) continue;
    if (!successors.has(e.from)) successors.set(e.from, []);
    successors.get(e.from).push(e.to);
  }

  while (queue.length > 0) {
    const { id, depth } = queue.shift();
    if (depth >= MAX_DEPTH) continue;

    const nexts = successors.get(id) || [];
    for (const nextId of nexts) {
      if (!visited.has(nextId)) {
        visited.add(nextId);
        queue.push({ id: nextId, depth: depth + 1 });
      }
    }
  }

  return visited;
}

/**
 * Tri topologique des nœuds selon les arêtes (Kahn's algorithm).
 * Les nœuds sans dépendance viennent en premier.
 * Les hubs sont exclus du tri.
 *
 * @param {Object[]} nodes
 * @param {Object[]} edges
 * @returns {Object[]} Nœuds triés dans l'ordre topologique
 */
export function topologicalSort(nodes, edges) {
  // Filtrer les hubs
  const docNodes = nodes.filter((n) => n.type !== 'hub');
  const nodeIds = new Set(docNodes.map((n) => n.id));
  const nodeMap = new Map(docNodes.map((n) => [n.id, n]));

  // Compter les arêtes entrantes (in-degree) uniquement entre nœuds non-hub
  const inDegree = new Map();
  const adj = new Map();
  for (const id of nodeIds) {
    inDegree.set(id, 0);
    adj.set(id, []);
  }
  for (const e of edges) {
    if (!nodeIds.has(e.from) || !nodeIds.has(e.to)) continue;
    if (e.from === e.to) continue; // auto-loop
    adj.get(e.from).push(e.to);
    inDegree.set(e.to, (inDegree.get(e.to) || 0) + 1);
  }

  // File des nœuds avec in-degree 0
  const queue = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const sorted = [];
  while (queue.length > 0) {
    const id = queue.shift();
    sorted.push(nodeMap.get(id));
    for (const next of adj.get(id) || []) {
      const newDeg = (inDegree.get(next) || 1) - 1;
      inDegree.set(next, newDeg);
      if (newDeg === 0) queue.push(next);
    }
  }

  // Ajouter les nœuds restants (cycles) à la fin dans leur ordre original
  for (const n of docNodes) {
    if (!sorted.includes(n)) sorted.push(n);
  }

  return sorted;
}

/* -------------------------------------------------------------------------- */
/*  API publique                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Génère la documentation Markdown pour un seul nœud.
 * @param {Object} node - Le nœud du graphe
 * @param {Object} [context] - Contexte optionnel pour le breadcrumb ZIP
 * @param {string} [context.sprintTitle] - Titre du sprint
 * @param {string} [context.sprintEmoji] - Emoji du sprint
 * @returns {string} Le contenu Markdown
 */
export function generateDoc(node, context = null) {
  if (!node) return '';
  // Les hubs sont filtrés (pas de doc propre)
  if (node.type === 'hub') return '';

  // Fil d'Ariane (breadcrumb) si contexte fourni
  const breadcrumb = [];
  if (context) {
    breadcrumb.push('📁 [Plan](../README.md)');
    if (context.sprintTitle) {
      breadcrumb.push(`${context.sprintEmoji || '📋'} [${context.sprintTitle}](./_sprint.md)`);
    }
    breadcrumb.push(`📄 ${node.label || node.id}`);
  }

  const category = getCategory(node.type);
  const template = TEMPLATES[category] || TEMPLATES.default;
  const md = template(node);

  // Assembler le document final
  const parts = [];
  if (breadcrumb.length > 0) {
    parts.push(`> ${breadcrumb.join(' > ')}`);
    parts.push('');
  }
  parts.push(md);

  // Ajouter les métadonnées libres s'il y en a
  const metadata = Array.isArray(node.metadata) ? node.metadata : [];
  const filledMeta = metadata.filter((m) => m.key && m.value);
  if (filledMeta.length > 0) {
    const extra = [];
    extra.push('### Métadonnées\n');
    extra.push('| Clé | Valeur |');
    extra.push('|-----|--------|');
    for (const m of filledMeta) {
      extra.push(`| ${esc(m.key)} | ${esc(m.value)} |`);
    }
    extra.push('');
    parts.push(extra.join('\n'));
  }
  return parts.join('\n');
}

/**
 * Génère un document multi-sections pour une liste de nœuds.
 * @param {Object[]} nodes - Liste de nœuds
 * @returns {string} Le document Markdown complet
 */
export function generateDocSection(nodes) {
  if (!nodes || nodes.length === 0) return '> Aucun élément à documenter.\n';
  // Filtrer les hubs
  const docNodes = nodes.filter((n) => n.type !== 'hub');
  if (docNodes.length === 0) return '> Aucun élément à documenter.\n';
  const sections = docNodes.map((n) => generateDoc(n)).filter(Boolean);
  return sections.join('\n---\n\n');
}

/**
 * Génère un README synopsis pour un export ZIP.
 * @param {Object[]} nodes
 * @param {Object[]} edges
 * @returns {string} Le contenu README.md
 */
export function generateReadme(nodes, edges) {
  const docNodes = nodes.filter((n) => n.type !== 'hub');
  const totalNodes = docNodes.length;
  const totalEdges = edges.length;

  // Compter par catégorie
  const catCounts = {};
  for (const n of docNodes) {
    const cat = getCategory(n.type);
    catCounts[cat] = (catCounts[cat] || 0) + 1;
  }

  const lines = [
    '# Documentation du projet\n',
    `> Générée automatiquement le ${new Date().toLocaleDateString('fr-FR')}\n`,
    '## Résumé\n',
    `- **${totalNodes}** éléments documentés`,
    `- **${totalEdges}** connexions\n`,
  ];

  if (Object.keys(catCounts).length > 0) {
    lines.push('### Répartition par catégorie\n');
    lines.push('| Catégorie | Nombre |');
    lines.push('|-----------|--------|');
    const sorted = Object.entries(catCounts).sort((a, b) => b[1] - a[1]);
    for (const [cat, count] of sorted) {
      lines.push(`| ${cat} | ${count} |`);
    }
    lines.push('');
  }

  lines.push('## Contenu\n');
  lines.push('| Élément | Type |');
  lines.push('|---------|------|');
  for (const n of docNodes) {
    lines.push(`| ${esc(n.label)} | ${n.type} |`);
  }
  lines.push('');

  return lines.join('\n');
}
