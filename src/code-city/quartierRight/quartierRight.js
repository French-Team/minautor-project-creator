/**
 * Quartier Right — Onglets Aperçu / Code / Propriétés
 *
 * - Aperçu : rendu live du diagramme via mermaid.render()
 * - Code : éditeur 2-way binding (state ↔ textarea, branché dans pipeline.js)
 * - Propriétés : formulaire d'édition du nœud sélectionné
 *
 * L'onglet Propriétés est mis en évidence automatiquement quand un nœud
 * est sélectionné. Le bouton "Copier" de l'onglet Code duplique le code
 * Mermaid dans le presse-papiers.
 */

import { getState, subscribe, actions } from '../state.js';
import { buildMermaidCode, renderMermaidToSvg } from '../mermaid/build.js';

let activeTab = 'preview';
let renderToken = 0;

export async function initializeQuartierRight() {
  console.log('➡️ Initialisation du quartier Right...');

  try {
    setupTabSwitching();
    setupCopyButton();
    subscribe(handleStateChange);
    handleStateChange(getState(), { type: 'init' });
    console.log('✅ Quartier Right initialisé');
  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation du quartier Right:', error);
    throw error;
  }
}

function setupTabSwitching() {
  const tabs = document.querySelectorAll('.app__right .tab');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      if (tab.disabled) return;
      activateTab(tab.dataset.tab);
    });
  });
}

export function activateTab(name) {
  if (!['preview', 'code', 'properties'].includes(name)) return;
  activeTab = name;
  document.querySelectorAll('.app__right .tab').forEach((t) => {
    const on = t.dataset.tab === name;
    t.classList.toggle('is-active', on);
    t.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  document.querySelectorAll('.app__right .tabpanel').forEach((p) => {
    p.classList.toggle('is-active', p.dataset.panel === name);
  });
  if (name === 'preview') renderPreview();
  if (name === 'properties') renderProperties();
}

function setupCopyButton() {
  const btn = document.getElementById('copy-code-btn');
  if (!btn) return;
  const label = btn.querySelector('span');
  const original = label ? label.textContent : 'Copier';
  btn.addEventListener('click', async () => {
    const code = buildMermaidCode(getState());
    try {
      await navigator.clipboard.writeText(code);
      if (label) label.textContent = 'Copié';
      btn.classList.add('btn--primary');
      setTimeout(() => {
        if (label) label.textContent = original;
        btn.classList.remove('btn--primary');
      }, 1200);
      actions.setStatusMessage('Code Mermaid copié', 'success', 1500);
    } catch (err) {
      actions.setStatusMessage(`Copie impossible : ${err.message}`, 'error');
    }
  });
}

/* --------------------------------------------------------------------------
 * Aperçu
 * -------------------------------------------------------------------------- */

async function renderPreview() {
  const container = document.getElementById('preview-container');
  if (!container) return;

  const { nodes, edges } = getState();
  if (nodes.length === 0) {
    container.className = 'preview-frame';
    container.innerHTML = '<span>Le diagramme apparaîtra ici dès qu\'il y aura des éléments.</span>';
    return;
  }

  const myToken = ++renderToken;
  const code = buildMermaidCode({ nodes, edges });
  container.className = 'preview-frame is-loading';
  container.innerHTML = '';

  const { svg, error } = await renderMermaidToSvg(code);
  if (myToken !== renderToken) return; // un autre rendu a pris le dessus

  if (error) {
    container.className = 'preview-frame';
    container.innerHTML = `
      <div class="preview-error">
        <strong>Erreur Mermaid</strong>
        <pre>${escapeHtml(error)}</pre>
      </div>
    `;
    return;
  }

  container.className = 'preview-frame';
  container.innerHTML = `<div class="preview-svg">${svg}</div>`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* --------------------------------------------------------------------------
 * Propriétés
 * -------------------------------------------------------------------------- */

function renderProperties() {
  const container = document.getElementById('properties-container');
  if (!container) return;

  const { selection, nodes } = getState();
  if (selection.nodes.size === 0) {
    container.innerHTML = '<div class="prop-empty">Sélectionnez un nœud pour modifier ses propriétés.</div>';
    return;
  }
  if (selection.nodes.size > 1) {
    container.innerHTML = `<div class="prop-empty">${selection.nodes.size} nœuds sélectionnés.<br>Édition multi-sélection à venir.</div>`;
    return;
  }

  const id = [...selection.nodes][0];
  const node = nodes.find((n) => n.id === id);
  if (!node) {
    container.innerHTML = '<div class="prop-empty">Nœud introuvable.</div>';
    return;
  }

  const TYPES = [
    'start','end','process','decision','document','user','storage',
    'module','important','attention','idea','goal','success',
  ];
  const PRIORITIES = ['low','medium','high','critical'];

  container.innerHTML = `
    <form class="prop-form" id="properties-form" autocomplete="off">
      <div class="prop-section">
        <div class="prop-section__title">Libellé</div>
        <input type="text" id="prop-label" class="prop-input prop-input--lg" value="${escapeAttr(node.label || '')}" />
      </div>

      <div class="prop-section">
        <div class="prop-section__title">Apparence</div>
        <div class="prop-grid">
          <div class="prop-field">
            <label for="prop-type">Type</label>
            <select id="prop-type">
              ${TYPES.map((t) => `<option value="${t}" ${node.type === t ? 'selected' : ''}>${t}</option>`).join('')}
            </select>
          </div>
          <div class="prop-field">
            <label for="prop-priority">Priorité</label>
            <select id="prop-priority">
              ${PRIORITIES.map((p) => `<option value="${p}" ${node.priority === p ? 'selected' : ''}>${p}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>

      <div class="prop-section">
        <div class="prop-section__title">Position</div>
        <div class="prop-grid">
          <div class="prop-field">
            <label for="prop-x">X</label>
            <input type="number" id="prop-x" value="${Math.round(node.x || 0)}" step="20" />
          </div>
          <div class="prop-field">
            <label for="prop-y">Y</label>
            <input type="number" id="prop-y" value="${Math.round(node.y || 0)}" step="20" />
          </div>
        </div>
      </div>

      <div class="prop-section prop-section--id">
        <div class="prop-id-row">
          <span class="prop-id-label">Identifiant</span>
          <code class="prop-id" id="prop-id-value">${escapeHtml(node.id)}</code>
        </div>
        <button type="button" class="btn btn--sm btn--ghost" id="prop-copy-id">Copier</button>
      </div>

      <div class="prop-actions">
        <button type="button" class="btn btn--danger btn--sm" id="prop-delete-btn">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
          </svg>
          <span>Supprimer</span>
        </button>
      </div>
    </form>
  `;

  bindPropertyInputs(node.id);
}

function escapeAttr(s) { return escapeHtml(s); }

function bindPropertyInputs(id) {
  const form = document.getElementById('properties-form');
  if (!form) return;
  const labelInput = form.querySelector('#prop-label');
  const typeSelect = form.querySelector('#prop-type');
  const prioritySelect = form.querySelector('#prop-priority');
  const xInput = form.querySelector('#prop-x');
  const yInput = form.querySelector('#prop-y');
  const deleteBtn = form.querySelector('#prop-delete-btn');
  const copyIdBtn = form.querySelector('#prop-copy-id');

  labelInput?.addEventListener('change', () => {
    actions.updateNode(id, { label: labelInput.value });
  });
  typeSelect?.addEventListener('change', () => {
    actions.updateNode(id, { type: typeSelect.value });
  });
  prioritySelect?.addEventListener('change', () => {
    actions.updateNode(id, { priority: prioritySelect.value });
  });
  xInput?.addEventListener('change', () => {
    actions.updateNode(id, { x: Number(xInput.value) || 0 });
  });
  yInput?.addEventListener('change', () => {
    actions.updateNode(id, { y: Number(yInput.value) || 0 });
  });
  deleteBtn?.addEventListener('click', () => {
    if (confirm('Supprimer ce nœud ?')) {
      actions.removeNode(id);
    }
  });
  copyIdBtn?.addEventListener('click', async () => {
    const idValue = form.querySelector('#prop-id-value')?.textContent || id;
    try {
      await navigator.clipboard.writeText(idValue);
      const span = copyIdBtn.querySelector('span') || copyIdBtn;
      const original = copyIdBtn.textContent;
      copyIdBtn.textContent = '✓ Copié';
      setTimeout(() => { copyIdBtn.textContent = original; }, 1200);
    } catch (err) {
      actions.setStatusMessage(`Copie impossible : ${err.message}`, 'error');
    }
  });
}

/* --------------------------------------------------------------------------
 * Souscription au store
 * -------------------------------------------------------------------------- */

function handleStateChange(state, meta = {}) {
  // Quand un nœud est sélectionné, basculer vers l'onglet Propriétés
  // (seulement si l'utilisateur n'est pas en train d'éditer le code).
  if (meta.type === 'selection:changed' && state.selection.nodes.size === 1) {
    activateTab('properties');
  }

  if (activeTab === 'preview' && shouldRefreshPreview(meta)) {
    renderPreview();
  }
  if (activeTab === 'properties' && [
    'selection:changed', 'node:updated', 'node:removed',
    'graph:cleared', 'graph:loaded', 'history:undo', 'history:redo', 'init',
  ].includes(meta.type)) {
    renderProperties();
  }
}

function shouldRefreshPreview(meta) {
  return [
    'node:added', 'node:updated', 'node:removed',
    'edge:added', 'edge:removed',
    'graph:cleared', 'graph:loaded',
    'history:undo', 'history:redo', 'view:theme',
    'init',
  ].includes(meta.type);
}
