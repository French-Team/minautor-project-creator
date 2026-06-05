/**
 * ZIP Exporter — Export structuré en ZIP "Livre de Développement"
 *
 * Génère un ZIP organisée par SPRINTS (priorité) :
 *
 *   README.md              → Roadmap complète (timeline, checklists, sommaire)
 *   diagram.svg            → Diagramme Mermaid rendu
 *   sprint-1-critical/     → Nœuds critiques (faire EN PREMIER)
 *     _sprint.md           → Intro du sprint + objectifs
 *     01-nom.md            → Fichiers numérotés par ordre topologique
 *     02-nom.md
 *     _index.md            → Table des matières du sprint
 *   sprint-2-high/
 *   sprint-3-medium/
 *   sprint-4-low/
 *   sprint-5-backlog/      → Priorité non définie
 *
 * L'ordre dans chaque sprint suit le tri topologique (dépendances avant).
 */

import JSZip from 'jszip';
import { getCategory } from '../propertySchemas.js';
import {
  generateDoc, topologicalSort, resolveSubtree,
} from './docGenerator.js';

/* -------------------------------------------------------------------------- */
/*  Priorités                                                                 */
/* -------------------------------------------------------------------------- */

export const PRIORITY_ORDER = ['critical', 'high', 'medium', 'low'];

export const SPRINT_META = {
  critical: {
    folder: 'sprint-1-critical',
    title: 'Sprint 1 — Critique',
    emoji: '🔴',
    description: 'Éléments critiques à traiter en priorité absolue. Ces éléments bloquent le reste du projet ou représentent des risques majeurs.',
  },
  high: {
    folder: 'sprint-2-high',
    title: 'Sprint 2 — Prioritaire',
    emoji: '🟠',
    description: 'Éléments importants qui doivent être traités rapidement après les critiques.',
  },
  medium: {
    folder: 'sprint-3-medium',
    title: 'Sprint 3 — Standard',
    emoji: '🟡',
    description: 'Éléments de développement courant. Planifier dans les itérations suivantes.',
  },
  low: {
    folder: 'sprint-4-low',
    title: 'Sprint 4 — Secondaire',
    emoji: '🟢',
    description: 'Éléments à traiter en dernier ou si du temps est disponible.',
  },
  none: {
    folder: 'sprint-5-backlog',
    title: 'Sprint 5 — Backlog',
    emoji: '⚪',
    description: 'Éléments sans priorité définie. À catégoriser et replanifier.',
  },
};

export function getPriorityKey(p) {
  return PRIORITY_ORDER.includes(p) ? p : 'none';
}

function sanitizeFilename(name) {
  return String(name)
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'unnamed';
}

/* -------------------------------------------------------------------------- */
/*  Génération du README roadmap                                              */
/* -------------------------------------------------------------------------- */

function generateRoadmapReadme(sprints, totalEdges, svgIncluded) {
  const totalNodes = Object.values(sprints).reduce((sum, arr) => sum + arr.length, 0);
  const date = new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });

  const lines = [
    '# 📋 Plan de Développement du Projet',
    '',
    `> Généré le ${date} — ${totalNodes} éléments, ${totalEdges} connexions`,
    '',
    '---',
    '',
    '## 🎯 Vue d\'ensemble',
    '',
    'Ce document est votre **feuille de route**. Suivez les sprints dans l\'ordre.',
    'Chaque sprint contient les éléments à traiter, numérotés par ordre de dépendance.',
    '',
  ];

  // Timeline visuelle
  if (totalNodes > 0) {
    lines.push('## 📊 Timeline des Sprints');
    lines.push('');
    lines.push('```');
    for (const key of [...PRIORITY_ORDER, 'none']) {
      const nodes = sprints[key] || [];
      if (nodes.length === 0) continue;
      const meta = SPRINT_META[key];
      const bar = '█'.repeat(Math.min(nodes.length, 40));
      lines.push(`${meta.emoji} ${meta.title.padEnd(28)} ${bar} (${nodes.length})`);
    }
    lines.push('```');
    lines.push('');
  }

  // Checklists par sprint
  lines.push('## ✅ Roadmap Détaillée');
  lines.push('');

  for (const key of [...PRIORITY_ORDER, 'none']) {
    const nodes = sprints[key] || [];
    if (nodes.length === 0) continue;
    const meta = SPRINT_META[key];
    const folder = meta.folder;

    lines.push(`### ${meta.emoji} ${meta.title}`);
    lines.push('');
    lines.push(`> ${meta.description}`);
    lines.push('');
    lines.push(`📂 [Voir le dossier](./${folder}/)`);
    lines.push('');

    // Checklist
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const cat = getCategory(n.type);
      const filename = `${String(i + 1).padStart(2, '0')}-${sanitizeFilename(n.label || n.id)}.md`;
      const desc = n.description ? ` — ${n.description.slice(0, 100)}` : '';
      lines.push(`- [ ] [${n.label || n.id}](./${folder}/${filename}) \`${n.type}\`${desc}`);
    }
    lines.push('');
  }

  // Statistiques
  lines.push('## 📈 Statistiques');
  lines.push('');
  lines.push('| Sprint | Éléments | Priorité |');
  lines.push('|--------|----------|----------|');
  for (const key of [...PRIORITY_ORDER, 'none']) {
    const nodes = sprints[key] || [];
    if (nodes.length === 0) continue;
    const meta = SPRINT_META[key];
    lines.push(`| ${meta.title} | ${nodes.length} | ${meta.emoji} ${key} |`);
  }
  lines.push(`| **Total** | **${totalNodes}** | |`);
  lines.push('');

  // Guide de lecture
  lines.push('## 📖 Guide de Lecture');
  lines.push('');
  lines.push('1. **Commencez par le Sprint 1** (Critique) — ces éléments bloquent le projet');
  lines.push('2. **Enchaînez sur le Sprint 2** (Prioritaire) — éléments importants');
  lines.push('3. **Planifiez les Sprints 3-4** dans vos itérations suivantes');
  lines.push('4. **Le Sprint 5** (Backlog) = à catégoriser et replanifier');
  lines.push('');
  lines.push('Chaque fichier `.md` dans un sprint contient :');
  lines.push('- Description de l\'élément');
  lines.push('- Propriétés techniques');
  lines.push('- Dépendances et connexions');
  lines.push('');

  if (svgIncluded) {
    lines.push('## 🖼️ Diagramme');
    lines.push('');
    lines.push('Le diagramme visuel du projet est disponible dans [`diagram.svg`](./diagram.svg).');
    lines.push('');
  }

  // Footer
  lines.push('---');
  lines.push('');
  lines.push('*Généré par [CodeCity Canvas](https://github.com) — Plan de développement automatisé*');

  return lines.join('\n');
}

/* -------------------------------------------------------------------------- */
/*  Génération d'un _sprint.md                                                */
/* -------------------------------------------------------------------------- */

function generateSprintIntro(key, nodes) {
  const meta = SPRINT_META[key];
  const lines = [
    `# ${meta.emoji} ${meta.title}`,
    '',
    `> ${meta.description}`,
    '',
    `**${nodes.length}** élément${nodes.length > 1 ? 's' : ''} à traiter dans ce sprint.`,
    '',
    '---',
    '',
    '## 📋 Contenu de ce sprint',
    '',
    '| # | Élément | Type | Description |',
    '|---|---------|------|-------------|',
  ];

  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    const num = String(i + 1).padStart(2, '0');
    const filename = `${num}-${sanitizeFilename(n.label || n.id)}.md`;
    const desc = (n.description || '').slice(0, 60).replace(/\|/g, '\\|');
    lines.push(`| ${num} | [${n.label || n.id}](./${filename}) | \`${n.type}\` | ${desc} |`);
  }

  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('⬅️ [Retour au plan](../README.md)');

  return lines.join('\n');
}

/* -------------------------------------------------------------------------- */
/*  Génération d'un _index.md par sprint                                      */
/* -------------------------------------------------------------------------- */

function generateSprintIndex(key, nodes) {
  const meta = SPRINT_META[key];
  const lines = [
    `# Index — ${meta.title}`,
    '',
    `${nodes.length} élément${nodes.length > 1 ? 's' : ''}`,
    '',
  ];

  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    const num = String(i + 1).padStart(2, '0');
    const filename = `${num}-${sanitizeFilename(n.label || n.id)}.md`;
    lines.push(`- [${num}. ${n.label || n.id}](./${filename}) — \`${n.type}\``);
  }

  return lines.join('\n');
}

/* -------------------------------------------------------------------------- */
/*  API publique                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Génère un ZIP structuré par sprints (priorités) à partir du graphe.
 *
 * @param {Object} graph - { nodes, edges }
 * @param {string} mode  - 'selected' | 'subtree' | 'full'
 * @param {string|null} nodeId - ID du nœud sélectionné
 * @param {string|null} svgCode - Code SVG du diagramme rendu
 * @returns {Promise<Blob>} Le ZIP en tant que Blob
 */
export async function generateZip(graph, mode = 'full', nodeId = null, svgCode = null) {
  const { nodes, edges } = graph;

  if (!nodes || nodes.length === 0) {
    throw new Error('Canvas vide — rien à exporter');
  }

  if (nodes.length > 500) {
    console.warn('⚠️ ZIP export: plus de 500 nœuds, cela peut être lent');
  }

  // 1. Résoudre les nœuds à exporter
  let exportNodes;
  if (mode === 'selected' && nodeId) {
    const node = nodes.find((n) => n.id === nodeId);
    exportNodes = node ? [node] : [];
  } else if (mode === 'subtree' && nodeId) {
    const ids = resolveSubtree(nodeId, edges);
    exportNodes = nodes.filter((n) => ids.has(n.id));
  } else {
    exportNodes = topologicalSort(nodes, edges);
  }

  // Filtrer les hubs
  exportNodes = exportNodes.filter((n) => n.type !== 'hub');

  if (exportNodes.length === 0) {
    throw new Error('Aucun nœud à documenter');
  }

  // 2. Regrouper par priorité + tri topologique dans chaque groupe
  const sprints = {};
  for (const key of [...PRIORITY_ORDER, 'none']) {
    sprints[key] = [];
  }

  for (const node of exportNodes) {
    const pKey = getPriorityKey(node.priority);
    sprints[pKey].push(node);
  }

  // Trier chaque sprint par ordre topologique
  for (const key of [...PRIORITY_ORDER, 'none']) {
    if (sprints[key].length > 1) {
      sprints[key] = topologicalSort(sprints[key], edges);
    }
  }

  // 3. Créer le ZIP
  const zip = new JSZip();

  // 4. README roadmap
  const readme = generateRoadmapReadme(sprints, edges.length, !!svgCode);
  zip.file('README.md', readme);

  // 5. diagram.svg
  if (svgCode) {
    zip.file('diagram.svg', svgCode);
  }

  // 6. Générer les dossiers sprint
  for (const key of [...PRIORITY_ORDER, 'none']) {
    const nodes = sprints[key];
    if (nodes.length === 0) continue;

    const meta = SPRINT_META[key];
    const folder = meta.folder;

    // _sprint.md (intro du sprint)
    zip.file(`${folder}/_sprint.md`, generateSprintIntro(key, nodes));

    // _index.md (table des matières du sprint)
    zip.file(`${folder}/_index.md`, generateSprintIndex(key, nodes));

    // Fichiers numérotés
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const num = String(i + 1).padStart(2, '0');
      const filename = `${num}-${sanitizeFilename(n.label || n.id)}.md`;
      const doc = generateDoc(n, { sprintTitle: meta.title, sprintEmoji: meta.emoji });
      if (doc) {
        zip.file(`${folder}/${filename}`, doc);
      }
    }
  }

  // 7. Générer le ZIP
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

/**
 * Déclenche le téléchargement du ZIP.
 *
 * @param {Blob} blob - Le blob ZIP
 * @param {string} filename - Le nom du fichier (sans extension)
 */
export function downloadZip(blob, filename = 'export-mon-projet') {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.zip`;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}
