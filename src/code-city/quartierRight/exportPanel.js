/**
 * Export Panel — Panneau rétractable des méthodes d'export
 *
 * Activé par le bouton "Exporter" du quartier Top. Contient toutes les
 * méthodes d'export (Mermaid, SVG, PNG, et futures). Le panneau
 * glisse depuis la droite, avec un backdrop, et se ferme via :
 *   - clic sur le bouton X du header
 *   - clic sur le backdrop
 *   - touche Escape
 *
 * Le panneau est FERMÉ par défaut (rétractable).
 *
 * Modes d'export :
 *   - selected : nœud sélectionné uniquement
 *   - subtree  : nœud + tous ses successeurs (BFS)
 *   - full     : plan complet
 *
 * Formats :
 *   - Documentation (.md) — généré par docGenerator
 *   - Code Mermaid (.mmd) — texte brut
 *   - Image SVG
 *   - Image PNG (×2 Retina)
 */

import { getState, actions } from '../state.js';
import { exportCode, exportSvg, exportPng } from '../mermaid/export.js';
import {
  generateDoc, generateReadme,
  resolveSubtree, topologicalSort,
} from '../mermaid/docGenerator.js';
import { generateZip, downloadZip, PRIORITY_ORDER, SPRINT_META, getPriorityKey } from '../mermaid/zipExporter.js';
import { getCategory } from '../propertySchemas.js';
import { iconCode, iconPhoto, iconDownload, iconJson } from '../icons.js';

let isOpen = false;
let currentMode = 'full'; // 'selected' | 'subtree' | 'full'

export async function initializeExportPanel() {
  console.log('📤 Initialisation du panneau d\'export…');

  try {
    const root = document.getElementById('app-export');
    const backdrop = document.getElementById('app-export-backdrop');
    const closeBtn = document.getElementById('app-export-close');
    const body = document.getElementById('app-export-body');
    if (!root || !backdrop || !closeBtn || !body) {
      throw new Error('Panneau d\'export : éléments DOM manquants');
    }

    // Remplit le body avec les options d'export
    body.innerHTML = renderExportOptions();

    // Câble les boutons d'export (formats)
    body.addEventListener('click', (e) => {
      // Gestion du changement de mode (radio buttons)
      const modeItem = e.target.closest('[data-mode]');
      if (modeItem) {
        currentMode = modeItem.dataset.mode;
        // Mettre à jour l'état actif des radio buttons
        body.querySelectorAll('[data-mode]').forEach((el) => {
          el.classList.toggle('is-active', el.dataset.mode === currentMode);
        });
        // Mettre à jour la description du mode
        const modeDesc = body.querySelector('.export-mode__desc');
        if (modeDesc) modeDesc.textContent = getModeDescription(currentMode);
        return;
      }

      // Bouton "Voir l'aperçu" → ouvre la modale
      if (e.target.closest('#export-preview-btn')) {
        openPreviewModal();
        return;
      }

      const item = e.target.closest('[data-format]');
      if (!item || item.disabled) return;
      const format = item.dataset.format;
      runExport(format).catch((err) => {
        console.error('Erreur export:', err);
        actions.setStatusMessage(`Erreur export : ${err.message}`, 'error');
      });
    });

    // Câble la fermeture
    closeBtn.addEventListener('click', closeExportPanel);
    backdrop.addEventListener('click', closeExportPanel);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen && !isPreviewModalOpen()) closeExportPanel();
    });

    // État initial : fermé
    applyOpenState(root, false);
    console.log('✅ Panneau d\'export initialisé (fermé)');
  } catch (error) {
    console.error('❌ Erreur initialisation panneau d\'export:', error);
    throw error;
  }
}

/* ---------- API publique ---------- */

/** Ouvre le panneau d'export (utilisé par le bouton du top bar). */
export function openExportPanel() {
  const root = document.getElementById('app-export');
  if (!root || isOpen) return;
  isOpen = true;
  // Ré-afficher le contenu pour refléter l'état courant (nœuds, sélection)
  const body = root.querySelector('#app-export-body');
  if (body) {
    body.innerHTML = renderExportOptions();
  }
  applyOpenState(root, true);
}

/** Ferme le panneau d'export. */
export function closeExportPanel() {
  const root = document.getElementById('app-export');
  if (!root || !isOpen) return;
  isOpen = false;
  applyOpenState(root, false);
}

/** Toggle (utilisé par le bouton du top bar). */
export function toggleExportPanel() {
  if (isOpen) closeExportPanel();
  else openExportPanel();
}

/** Renvoie l'état courant (utile pour tests). */
export function isExportPanelOpen() {
  return isOpen;
}

/* ---------- internes ---------- */

function applyOpenState(root, open) {
  root.classList.toggle('is-open', open);
  root.setAttribute('aria-hidden', open ? 'false' : 'true');
}

function getModeDescription(mode) {
  const map = {
    selected: 'Documentation du nœud sélectionné',
    subtree: 'Documentation du nœud + tous les successeurs (BFS)',
    full: 'Documentation complète de tous les nœuds du plan',
  };
  return map[mode] || map.full;
}

function renderExportOptions() {
  const isEmpty = getState().nodes.length === 0;
  const hasSelection = getState().selection.nodes.size === 1;
  const modeBtn = (mode, label, icon, active) =>
    `<button type="button" class="export-mode-btn ${active ? 'is-active' : ''}" data-mode="${mode}" title="${label}" ${(!hasSelection && mode !== 'full') ? 'disabled' : ''}>
      <span class="export-mode-btn__icon">${icon}</span>
      <span class="export-mode-btn__label">${label}</span>
    </button>`;

  return `
    <p class="export-panel__intro">
      Choisissez le périmètre et le format d'export.
    </p>

    <div class="export-section">
      <div class="export-section__title">Périmètre</div>
      <div class="export-mode-btns">
        ${modeBtn('selected', 'Nœud sélectionné', '📄', currentMode === 'selected')}
        ${modeBtn('subtree', 'Sous-arbre', '🔗', currentMode === 'subtree')}
        ${modeBtn('full', 'Plan complet', '📋', currentMode === 'full')}
      </div>
      <div class="export-mode__desc">${getModeDescription(currentMode)}</div>
    </div>

    <div class="export-section">
      <div class="export-section__title">Format</div>
      <div class="export-panel__list">
        <button type="button" class="export-card" data-format="doc" ${isEmpty ? 'disabled' : ''}>
          <span class="export-card__icon">${iconCode()}</span>
          <span class="export-card__body">
            <span class="export-card__title">Documentation</span>
            <span class="export-card__desc">Fichier .md avec propriétés structurées</span>
          </span>
          <span class="export-card__chevron">${iconDownload()}</span>
        </button>
        <button type="button" class="export-card" data-format="code" ${isEmpty ? 'disabled' : ''}>
          <span class="export-card__icon">${iconCode()}</span>
          <span class="export-card__body">
            <span class="export-card__title">Code Mermaid</span>
            <span class="export-card__desc">Fichier .mmd (texte brut)</span>
          </span>
          <span class="export-card__chevron">${iconDownload()}</span>
        </button>
        <button type="button" class="export-card" data-format="json" ${isEmpty ? 'disabled' : ''}>
          <span class="export-card__icon">${iconJson()}</span>
          <span class="export-card__body">
            <span class="export-card__title">JSON Brut</span>
            <span class="export-card__desc">Données structurées nœuds + arêtes + propriétés</span>
          </span>
          <span class="export-card__chevron">${iconDownload()}</span>
        </button>
        <button type="button" class="export-card" data-format="svg" ${isEmpty ? 'disabled' : ''}>
          <span class="export-card__icon">${iconPhoto()}</span>
          <span class="export-card__body">
            <span class="export-card__title">Image SVG</span>
            <span class="export-card__desc">Vectoriel, redimensionnable à l'infini</span>
          </span>
          <span class="export-card__chevron">${iconDownload()}</span>
        </button>
        <button type="button" class="export-card" data-format="png" ${isEmpty ? 'disabled' : ''}>
          <span class="export-card__icon">${iconPhoto()}</span>
          <span class="export-card__body">
            <span class="export-card__title">Image PNG</span>
            <span class="export-card__desc">Bitmap, échelle ×2 (qualité Retina)</span>
          </span>
          <span class="export-card__chevron">${iconDownload()}</span>
        </button>
        <button type="button" class="export-card export-card--primary" data-format="zip" ${isEmpty ? 'disabled' : ''}>
          <span class="export-card__icon">📦</span>
          <span class="export-card__body">
            <span class="export-card__title">ZIP Complet</span>
            <span class="export-card__desc">Documentation + diagramme + README</span>
          </span>
          <span class="export-card__chevron">${iconDownload()}</span>
        </button>
      </div>
    </div>

    <div class="export-section export-section--preview">
      <div class="export-section__title">Aperçu Markdown</div>
      <button type="button" class="btn btn--sm" id="export-preview-btn" ${isEmpty ? 'disabled' : ''}>
        <span>👁</span> Voir l'aperçu
      </button>
    </div>

    <p class="export-panel__hint" ${isEmpty ? '' : 'hidden'}>
      Ajoutez d'abord des éléments au canvas pour pouvoir exporter.
    </p>
  `;
}

/**
 * Résout le contexte d'export selon le mode courant.
 * @returns {{ exportNodes: Object[], selectedNodeId: string|null, graph: { nodes, edges } }}
 */
function resolveExportContext() {
  const { nodes, edges, selection } = getState();
  const graph = { nodes, edges };
  const hasOneSelection = selection.nodes.size === 1;
  const selectedNodeId = hasOneSelection ? [...selection.nodes][0] : null;

  if (currentMode === 'selected' && selectedNodeId) {
    const node = nodes.find((n) => n.id === selectedNodeId);
    return { exportNodes: node ? [node] : [], selectedNodeId, graph };
  }

  if (currentMode === 'subtree' && selectedNodeId) {
    const ids = resolveSubtree(selectedNodeId, edges);
    return { exportNodes: nodes.filter((n) => ids.has(n.id)), selectedNodeId, graph };
  }

  // full (ou pas de sélection)
  return { exportNodes: topologicalSort(nodes, edges), selectedNodeId: null, graph };
}




/**
 * Génère l'aperçu Markdown organisé par sprints (même structure que le ZIP).
 */
function generatePreviewMarkdown() {
  const ctx = resolveExportContext();
  const nodes = ctx.exportNodes;
  if (nodes.length === 0) return '';

  // Mode sélection : un seul nœud, pas de sprint
  if (currentMode === 'selected' && nodes.length === 1) {
    return generateDoc(nodes[0]);
  }

  // Regrouper par priorité
  const sprints = {};
  for (const key of [...PRIORITY_ORDER, 'none']) sprints[key] = [];
  for (const n of nodes) {
    sprints[getPriorityKey(n.priority)].push(n);
  }

  // Trier chaque sprint par topologie
  for (const key of [...PRIORITY_ORDER, 'none']) {
    if (sprints[key].length > 1) sprints[key] = topologicalSort(sprints[key], ctx.graph.edges);
  }

  const totalNodes = nodes.length;
  const parts = [];

  // En-tête
  parts.push('# 📋 Aperçu du ZIP — Plan de Développement\n');
  parts.push(`> ${totalNodes} élément${totalNodes > 1 ? 's' : ''} organisé${totalNodes > 1 ? 's' : ''} par sprint (priorité)\n`);
  parts.push('---\n');

  // Timeline rapide
  parts.push('## 📊 Vue d\'ensemble\n');
  parts.push('```');
  for (const key of [...PRIORITY_ORDER, 'none']) {
    const arr = sprints[key];
    if (arr.length === 0) continue;
    const meta = SPRINT_META[key];
    const bar = '█'.repeat(Math.min(arr.length, 30));
    parts.push(`${meta.emoji} ${meta.title.padEnd(26)} ${bar} (${arr.length})`);
  }
  parts.push('```\n');
  parts.push('---\n');

  // Contenu par sprint
  for (const key of [...PRIORITY_ORDER, 'none']) {
    const arr = sprints[key];
    if (arr.length === 0) continue;
    const meta = SPRINT_META[key];

    parts.push(`## ${meta.emoji} ${meta.title}\n`);
    parts.push(`**${arr.length}** élément${arr.length > 1 ? 's' : ''} à traiter\n`);
    parts.push('---\n');

    for (let i = 0; i < arr.length; i++) {
      const n = arr[i];
      const num = String(i + 1).padStart(2, '0');
      const doc = generateDoc(n, { sprintTitle: meta.title, sprintEmoji: meta.emoji });
      parts.push(`### ${num}. ${n.label || n.id}\n`);
      // Extraire le contenu du doc (enlever le heading duplicate et le breadcrumb)
      const lines = doc.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        // Sauter le breadcrumb et le heading principal (déjà affiché)
        if (trimmed.startsWith('> 📁')) continue;
        if (trimmed.match(/^##\s+/)) continue;
        if (trimmed === '---' && lines.indexOf(line) < 3) continue;
        parts.push(line);
      }
      parts.push('');
    }
    parts.push('---\n');
  }

  return parts.join('\n');
}

/**
 * Convertit du Markdown simple en HTML pour l'aperçu.
 * Gère les headers, tableaux, listes, blocs de code, et texte gras/italique.
 */
function markdownToHtml(md) {
  if (!md) return '';
  const lines = md.split('\n');
  let html = '';
  let inTable = false;
  let inTableBody = false;
  let inCodeBlock = false;
  let inList = false;
  let listType = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Bloc de code
    if (line.trimStart().startsWith('```')) {
      if (inCodeBlock) {
        html += '</code></pre>';
        inCodeBlock = false;
      } else {
        html += '<pre class="preview-md__code"><code>';
        inCodeBlock = true;
      }
      continue;
    }
    if (inCodeBlock) {
      html += escapeHtml(line) + '\n';
      continue;
    }

    // Fermer la liste si changement
    if (inList && !line.match(/^[\-\*\d]/)) {
      html += `</${listType}>`;
      inList = false;
    }

    // Fermer le tableau si changement
    if (inTable && !line.startsWith('|')) {
      html += (inTableBody ? '</tbody>' : '</thead>') + '</table>';
      inTable = false;
      inTableBody = false;
    }

    const trimmed = line.trim();

    // Ligne vide
    if (!trimmed) {
      continue;
    }

    // Séparateur horizontal
    if (trimmed.match(/^[-*_]{3,}$/)) {
      html += '<hr class="preview-md__hr">';
      continue;
    }

    // Headers
    const headerMatch = trimmed.match(/^(#{1,6})\s+(.+)/);
    if (headerMatch) {
      const level = headerMatch[1].length;
      html += `<h${level} class="preview-md__h${level}">${inlineMarkdown(headerMatch[2])}</h${level}>`;
      continue;
    }

    // Table
    if (trimmed.startsWith('|')) {
      if (!inTable) {
        html += '<table class="preview-md__table"><thead>';
        inTable = true;
        inTableBody = false;
      }
      // Ligne de séparation du tableau
      if (trimmed.match(/^\|[\s\-:|]+\|$/)) {
        html += '</thead><tbody>';
        inTableBody = true;
        continue;
      }
      const cells = trimmed.split('|').filter((c, i, arr) => i > 0 && i < arr.length - 1);
      const tag = inTableBody ? 'td' : 'th';
      html += '<tr>' + cells.map((c) => `<${tag}>${inlineMarkdown(c.trim())}</${tag}>`).join('') + '</tr>';
      continue;
    }

    // Liste à puces
    const bulletMatch = trimmed.match(/^[-\*]\s+(.+)/);
    if (bulletMatch) {
      if (!inList || listType !== 'ul') {
        if (inList) html += `</${listType}>`;
        html += '<ul class="preview-md__list">';
        inList = true;
        listType = 'ul';
      }
      html += `<li>${inlineMarkdown(bulletMatch[1])}</li>`;
      continue;
    }

    // Liste numérotée
    const numMatch = trimmed.match(/^\d+\.\s+(.+)/);
    if (numMatch) {
      if (!inList || listType !== 'ol') {
        if (inList) html += `</${listType}>`;
        html += '<ol class="preview-md__list">';
        inList = true;
        listType = 'ol';
      }
      html += `<li>${inlineMarkdown(numMatch[1])}</li>`;
      continue;
    }

    // Texte normal (ignorer les lignes avec uniquement des tirets de table)
    html += `<p class="preview-md__p">${inlineMarkdown(trimmed)}</p>`;
  }

  // Fermer les éléments ouverts
  if (inList) html += `</${listType}>`;
  if (inTable) html += '</tbody></table>';
  if (inCodeBlock) html += '</code></pre>';

  return html;
}

function inlineMarkdown(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="preview-md__inline-code">$1</code>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" class="preview-md__link">$1</a>');
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderMarkdownPreview() {
  const md = generatePreviewMarkdown();
  if (!md) return '<div class="export-preview__empty">Aucun contenu à prévisualiser</div>';
  return markdownToHtml(md);
}



/* ---------- Modal Aperçu Markdown ---------- */

let previewModalBackdrop = null;

function ensurePreviewModal() {
  if (previewModalBackdrop) return;
  previewModalBackdrop = document.createElement('div');
  previewModalBackdrop.className = 'preview-modal';
  previewModalBackdrop.innerHTML = `
    <div class="preview-modal__backdrop"></div>
    <div class="preview-modal__dialog">
      <div class="preview-modal__header">
        <span class="preview-modal__title">Aperçu Markdown</span>
        <button type="button" class="preview-modal__close" title="Fermer">✕</button>
      </div>
      <div class="preview-modal__body" id="preview-modal-content"></div>
    </div>
  `;
  document.body.appendChild(previewModalBackdrop);

  // Fermeture — clic en dehors du dialogue
  previewModalBackdrop.addEventListener('click', (e) => {
    if (!e.target.closest('.preview-modal__dialog')) closePreviewModal();
  });
  previewModalBackdrop.querySelector('.preview-modal__close').addEventListener('click', closePreviewModal);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && previewModalBackdrop.classList.contains('is-open')) {
      e.stopPropagation();
      closePreviewModal();
    }
  });
}

function openPreviewModal() {
  ensurePreviewModal();
  const content = document.getElementById('preview-modal-content');
  if (content) {
    content.innerHTML = renderMarkdownPreview();
  }
  previewModalBackdrop.classList.add('is-open');
}

function closePreviewModal() {
  if (previewModalBackdrop) {
    previewModalBackdrop.classList.remove('is-open');
  }
}

function isPreviewModalOpen() {
  return previewModalBackdrop && previewModalBackdrop.classList.contains('is-open');
}

async function runExport(format) {
  const ctx = resolveExportContext();
  if (ctx.graph.nodes.length === 0) {
    actions.setStatusMessage('Canvas vide — rien à exporter', 'warning');
    return;
  }

  actions.setStatusMessage(`Export ${format.toUpperCase()} en cours…`, 'info', 0);

  try {

    // Formats qui dépendent du mode (nœud/sous-arbre/plan)
    if (format === 'doc') {
      if (ctx.exportNodes.length === 0) {
        actions.setStatusMessage('Aucun nœud sélectionné', 'warning');
        return;
      }
      let md;
      if (currentMode === 'selected') {
        md = generateDoc(ctx.exportNodes[0]);
      } else if (currentMode === 'subtree') {
        md = generateDocSection(ctx.exportNodes);
      } else {
        const readme = generateReadme(ctx.graph.nodes, ctx.graph.edges);
        const sections = generateDocSection(ctx.exportNodes);
        md = readme + '\n\n---\n\n# Détail des éléments\n\n' + sections;
      }
      downloadText(md, 'documentation.md');
      const kb = (new Blob([md]).size / 1024).toFixed(1);
      actions.setStatusMessage(`Documentation exportée (${kb} Ko, ${ctx.exportNodes.length} nœuds)`, 'success');
      return;
    }

    // ZIP export
    if (format === 'zip') {
      let svgCode = null;
      try { svgCode = (await exportSvg(ctx.graph)).svg; } catch (_) { /* optional */ }
      const blob = await generateZip(ctx.graph, currentMode, ctx.selectedNodeId, svgCode);
      downloadZip(blob, 'export-mon-projet');
      const kb = (blob.size / 1024).toFixed(1);
      actions.setStatusMessage(`ZIP exporté (${kb} Ko)`, 'success');
      return;
    }

    // JSON export (mode-aware)
    if (format === 'json') {
      const jsonData = {
        version: 1,
        exportedAt: new Date().toISOString(),
        mode: currentMode,
        nodes: ctx.exportNodes.map((n) => ({
          id: n.id,
          type: n.type,
          label: n.label,
          description: n.description || '',
          properties: n.properties || {},
          priority: n.priority || 'medium',
          variant: n.variant || null,
          color: n.color || null,
          x: n.x,
          y: n.y,
          ...(Array.isArray(n.metadata) && n.metadata.length > 0 ? { metadata: n.metadata } : {}),
        })),
        edges: ctx.graph.edges.filter((e) => {
          const nodeIds = new Set(ctx.exportNodes.map((n) => n.id));
          return nodeIds.has(e.from) && nodeIds.has(e.to);
        }).map((e) => ({
          id: e.id,
          from: e.from,
          to: e.to,
          fromPort: e.fromPort || 'out',
          toPort: e.toPort || 'in',
          label: e.label || '',
        })),
      };
      const jsonStr = JSON.stringify(jsonData, null, 2);
      downloadText(jsonStr, 'export.json');
      const kb = (new Blob([jsonStr]).size / 1024).toFixed(1);
      actions.setStatusMessage(`JSON exporté (${kb} Ko, ${ctx.exportNodes.length} nœuds)`, 'success');
      return;
    }

    // Formats classiques (tout le diagramme)
    let result;
    if (format === 'code') result = exportCode(ctx.graph);
    else if (format === 'svg') result = await exportSvg(ctx.graph);
    else if (format === 'png') result = await exportPng(ctx.graph);

    const kb = (result.bytes / 1024).toFixed(1);
    if (format === 'png') {
      actions.setStatusMessage(`PNG exporté (${result.width}×${result.height}, ${kb} Ko)`, 'success');
    } else {
      actions.setStatusMessage(`${format.toUpperCase()} exporté (${kb} Ko)`, 'success');
    }
  } catch (err) {
    actions.setStatusMessage(`Échec export : ${err.message}`, 'error');
  }
}

/**
 * Déclenche le téléchargement d'un fichier texte.
 */
function downloadText(content, filename) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}
