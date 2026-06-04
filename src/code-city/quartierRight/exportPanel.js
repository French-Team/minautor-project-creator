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
 * La logique d'export elle-même reste dans `mermaid/export.js`. Ce
 * module ne fait que l'orchestration UI.
 */

import { getState, actions } from '../state.js';
import { exportCode, exportSvg, exportPng } from '../mermaid/export.js';
import { iconCode, iconPhoto, iconDownload } from '../icons.js';

let isOpen = false;

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

    // Câble les boutons d'export
    body.addEventListener('click', (e) => {
      const item = e.target.closest('[data-format]');
      if (!item || item.disabled) return;
      const format = item.dataset.format;
      // On ne ferme PAS automatiquement : l'utilisateur peut vouloir
      // exporter plusieurs formats d'affilée
      runExport(format).catch((err) => {
        console.error('Erreur export:', err);
        actions.setStatusMessage(`Erreur export : ${err.message}`, 'error');
      });
    });

    // Câble la fermeture
    closeBtn.addEventListener('click', closeExportPanel);
    backdrop.addEventListener('click', closeExportPanel);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen) closeExportPanel();
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

function renderExportOptions() {
  const isEmpty = getState().nodes.length === 0;
  return `
    <p class="export-panel__intro">
      Choisissez un format d'export pour votre diagramme.
    </p>
    <div class="export-panel__list">
      <button type="button" class="export-card" data-format="code" ${isEmpty ? 'disabled' : ''}>
        <span class="export-card__icon">${iconCode()}</span>
        <span class="export-card__body">
          <span class="export-card__title">Code Mermaid</span>
          <span class="export-card__desc">Fichier .mmd (texte brut)</span>
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
    </div>
    <p class="export-panel__hint" ${isEmpty ? '' : 'hidden'}>
      Ajoutez d'abord des éléments au canvas pour pouvoir exporter.
    </p>
  `;
}

async function runExport(format) {
  const graph = { nodes: getState().nodes, edges: getState().edges };
  if (graph.nodes.length === 0) {
    actions.setStatusMessage('Canvas vide — rien à exporter', 'warning');
    return;
  }

  actions.setStatusMessage(`Export ${format.toUpperCase()} en cours…`, 'info', 0);

  let result;
  try {
    if (format === 'code') result = exportCode(graph);
    else if (format === 'svg') result = await exportSvg(graph);
    else if (format === 'png') result = await exportPng(graph);
  } catch (err) {
    actions.setStatusMessage(`Échec export : ${err.message}`, 'error');
    return;
  }

  const kb = (result.bytes / 1024).toFixed(1);
  if (format === 'png') {
    actions.setStatusMessage(`PNG exporté (${result.width}×${result.height}, ${kb} Ko)`, 'success');
  } else {
    actions.setStatusMessage(`${format.toUpperCase()} exporté (${kb} Ko)`, 'success');
  }
}
