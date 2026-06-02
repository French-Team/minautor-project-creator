/**
 * Action Exporter — Menu déroulant avec 3 formats
 *
 * - .mmd  (code Mermaid)
 * - .svg  (rendu vectoriel)
 * - .png  (rendu bitmap, échelle ×2)
 *
 * Toute la logique d'export est dans `mermaid/export.js`.
 */

import { getState, actions } from '../../state.js';
import { exportCode, exportSvg, exportPng } from '../../mermaid/export.js';

let menuEl = null;

export async function initializeExporterAction() {
  console.log('📤 Initialisation de l\'action exporter...');

  try {
    const exporterBtn = document.getElementById('exporter-btn');
    if (!exporterBtn) {
      throw new Error('Bouton exporter non trouvé');
    }

    // On transforme le bouton en toggle d'un menu
    exporterBtn.setAttribute('aria-haspopup', 'true');
    exporterBtn.setAttribute('aria-expanded', 'false');

    exporterBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMenu(exporterBtn);
    });

    document.addEventListener('click', (e) => {
      if (menuEl && !menuEl.contains(e.target) && e.target !== exporterBtn) {
        closeMenu();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menuEl) closeMenu();
    });

    console.log('✅ Action exporter initialisée');
  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation de l\'action exporter:', error);
    throw error;
  }
}

function toggleMenu(btn) {
  if (menuEl && menuEl.classList.contains('visible')) {
    closeMenu();
  } else {
    openMenu(btn);
  }
}

function openMenu(btn) {
  if (!menuEl) {
    menuEl = document.createElement('div');
    menuEl.className = 'export-menu';
    menuEl.innerHTML = `
      <button type="button" class="export-menu-item" data-format="code">
        <span class="export-menu-icon">📄</span>
        <span class="export-menu-text">
          <strong>Code Mermaid</strong>
          <small>Fichier .mmd (texte)</small>
        </span>
      </button>
      <button type="button" class="export-menu-item" data-format="svg">
        <span class="export-menu-icon">🖼️</span>
        <span class="export-menu-text">
          <strong>Image SVG</strong>
          <small>Vectoriel, redimensionnable</small>
        </span>
      </button>
      <button type="button" class="export-menu-item" data-format="png">
        <span class="export-menu-icon">🖼️</span>
        <span class="export-menu-text">
          <strong>Image PNG</strong>
          <small>Bitmap, échelle ×2 (≈ Retina)</small>
        </span>
      </button>
    `;
    document.body.appendChild(menuEl);

    menuEl.addEventListener('click', (e) => {
      const item = e.target.closest('.export-menu-item');
      if (!item) return;
      const format = item.dataset.format;
      closeMenu();
      runExport(format).catch((err) => {
        console.error('Erreur export:', err);
        actions.setStatusMessage(`Erreur export : ${err.message}`, 'error');
      });
    });
  }

  const rect = btn.getBoundingClientRect();
  menuEl.style.top = `${rect.bottom + 4}px`;
  menuEl.style.left = `${rect.right - 240}px`;
  menuEl.classList.add('visible');
  btn.setAttribute('aria-expanded', 'true');

  // Désactive les formats impossibles si canvas vide
  const isEmpty = getState().nodes.length === 0;
  menuEl.querySelectorAll('.export-menu-item').forEach((item) => {
    item.disabled = isEmpty;
    item.classList.toggle('disabled', isEmpty);
  });
}

function closeMenu() {
  if (menuEl) {
    menuEl.classList.remove('visible');
  }
  const btn = document.getElementById('exporter-btn');
  if (btn) btn.setAttribute('aria-expanded', 'false');
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
