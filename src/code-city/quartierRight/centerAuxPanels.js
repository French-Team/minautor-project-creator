/**
 * Center Aux Panels — Initialisation des onglets Code & Propriétés du centre
 *
 * Depuis la refonte, les onglets Code (2-way binding) et Propriétés
 * (formulaire du nœud) vivent dans la zone centre (4 onglets au lieu
 * de 2). Le switch d'onglets est géré par `quartierCenter/centerTabs.js`.
 *
 * Ce module se contente d'initialiser les comportements spécifiques à
 * chaque panel :
 *   - Code      : bouton "Copier" + sync du textarea
 *   - Propriétés: rendu du formulaire + bindings des champs
 *
 * Le panneau d'export (rétractable) vit dans `exportPanel.js` à côté.
 */

import { getState, subscribe, actions } from '../state.js';
import { buildMermaidCode } from '../mermaid/build.js';

export async function initializeCenterAuxPanels() {
  console.log('📋 Initialisation des panneaux Code & Propriétés…');

  try {
    setupCopyButton();
    subscribe(handleStateChange);
    handleStateChange(getState(), { type: 'init' });
    console.log('✅ Panneaux Code & Propriétés initialisés');
  } catch (error) {
    console.error('❌ Erreur initialisation panneaux centre :', error);
    throw error;
  }
}

/* --------------------------------------------------------------------------
 * Code panel — bouton Copier
 * -------------------------------------------------------------------------- */

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
 * Properties panel — rendu du formulaire
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
  const metadata = Array.isArray(node.metadata) ? node.metadata : [];
  const description = typeof node.description === 'string' ? node.description : '';

  container.innerHTML = `
    <form class="prop-form" id="properties-form" autocomplete="off">
      <div class="prop-section">
        <div class="prop-section__title">Libellé</div>
        <input type="text" id="prop-label" class="prop-input prop-input--lg" value="${escapeAttr(node.label || '')}" />
      </div>

      <div class="prop-section">
        <div class="prop-section__title">Description</div>
        <textarea id="prop-description" class="prop-input prop-textarea" rows="3" placeholder="Notes, contexte, liens…">${escapeHtml(description)}</textarea>
        <div class="prop-hint">Affichée en sous-titre dans l'aperçu Mermaid.</div>
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
        <div class="prop-section__title">Métadonnées</div>
        <div class="prop-metadata" id="prop-metadata-list">
          ${metadata.map((m, i) => metadataRowHtml(i, m)).join('')}
        </div>
        <button type="button" class="btn btn--ghost btn--sm" id="prop-add-metadata">+ Ajouter un champ</button>
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

/** Génère le HTML d'une ligne de métadonnée (clé + valeur + bouton supprimer). */
function metadataRowHtml(index, m) {
  return `
    <div class="prop-metadata__row" data-index="${index}">
      <input type="text" class="prop-input prop-input--meta-key" placeholder="Clé" value="${escapeAttr(m.key || '')}" />
      <input type="text" class="prop-input prop-input--meta-value" placeholder="Valeur" value="${escapeAttr(m.value || '')}" />
      <button type="button" class="btn-icon prop-metadata__remove" data-action="remove" title="Supprimer ce champ" aria-label="Supprimer ce champ">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    </div>
  `;
}

function bindPropertyInputs(id) {
  const form = document.getElementById('properties-form');
  if (!form) return;
  // `currentId` suit l'ID réel du nœud dans le store (qui peut changer
  // quand l'utilisateur modifie le type — l'ID est alors régénéré).
  let currentId = id;

  const labelInput = form.querySelector('#prop-label');
  const descTextarea = form.querySelector('#prop-description');
  const typeSelect = form.querySelector('#prop-type');
  const prioritySelect = form.querySelector('#prop-priority');
  const xInput = form.querySelector('#prop-x');
  const yInput = form.querySelector('#prop-y');
  const deleteBtn = form.querySelector('#prop-delete-btn');
  const copyIdBtn = form.querySelector('#prop-copy-id');
  const metadataList = form.querySelector('#prop-metadata-list');
  const addMetadataBtn = form.querySelector('#prop-add-metadata');

  labelInput?.addEventListener('change', () => {
    actions.updateNode(currentId, { label: labelInput.value });
  });

  // Description : debounce pour ne pas spammer l'historique à chaque
  // frappe, mais l'aperçu Mermaid se rafraîchit silencieusement (le
  // re-render du form est bloqué tant que le focus est dans le textarea).
  if (descTextarea) {
    const debouncedDescSave = debounce(() => {
      actions.updateNode(currentId, { description: descTextarea.value });
    }, 200);
    descTextarea.addEventListener('input', debouncedDescSave);
    // Flush au blur pour ne pas perdre la saisie si on quitte vite
    descTextarea.addEventListener('change', () => {
      actions.updateNode(currentId, { description: descTextarea.value });
    });
  }

  typeSelect?.addEventListener('change', () => {
    const updated = actions.updateNode(currentId, { type: typeSelect.value });
    // L'ID a été régénéré : on suit le nouveau pour les saves suivants
    if (updated) currentId = updated.id;
  });
  prioritySelect?.addEventListener('change', () => {
    actions.updateNode(currentId, { priority: prioritySelect.value });
  });
  xInput?.addEventListener('change', () => {
    actions.updateNode(currentId, { x: Number(xInput.value) || 0 });
  });
  yInput?.addEventListener('change', () => {
    actions.updateNode(currentId, { y: Number(yInput.value) || 0 });
  });
  deleteBtn?.addEventListener('click', () => {
    if (confirm('Supprimer ce nœud ?')) {
      actions.removeNode(currentId);
    }
  });
  copyIdBtn?.addEventListener('click', async () => {
    const idValue = form.querySelector('#prop-id-value')?.textContent || currentId;
    try {
      await navigator.clipboard.writeText(idValue);
      const original = copyIdBtn.textContent;
      copyIdBtn.textContent = '✓ Copié';
      setTimeout(() => { copyIdBtn.textContent = original; }, 1200);
    } catch (err) {
      actions.setStatusMessage(`Copie impossible : ${err.message}`, 'error');
    }
  });

  // --- Métadonnées (liste clé/valeur) -------------------------------
  if (addMetadataBtn) {
    addMetadataBtn.addEventListener('click', () => {
      const node = getState().nodes.find((n) => n.id === currentId);
      if (!node) return;
      const next = [...(Array.isArray(node.metadata) ? node.metadata : []), { key: '', value: '' }];
      actions.updateNode(currentId, { metadata: next });
      // Focus la nouvelle ligne après le re-render
      requestAnimationFrame(() => {
        const rows = form.querySelectorAll('.prop-metadata__row');
        const last = rows[rows.length - 1];
        const keyInput = last?.querySelector('.prop-input--meta-key');
        keyInput?.focus();
      });
    });
  }
  if (metadataList) {
    // Suppression d'une ligne (délégation)
    metadataList.addEventListener('click', (e) => {
      const removeBtn = e.target.closest('[data-action="remove"]');
      if (!removeBtn) return;
      const row = removeBtn.closest('.prop-metadata__row');
      const index = Number(row?.dataset.index);
      if (Number.isNaN(index)) return;
      const node = getState().nodes.find((n) => n.id === currentId);
      if (!node) return;
      const next = (Array.isArray(node.metadata) ? node.metadata : []).filter((_, i) => i !== index);
      actions.updateNode(currentId, { metadata: next });
    });
    // Édition clé/valeur (délégation + debounce)
    const debouncedMetaSave = debounce((input) => {
      const row = input.closest('.prop-metadata__row');
      const index = Number(row?.dataset.index);
      if (Number.isNaN(index)) return;
      const field = input.classList.contains('prop-input--meta-key') ? 'key' : 'value';
      const node = getState().nodes.find((n) => n.id === currentId);
      if (!node) return;
      const next = (Array.isArray(node.metadata) ? node.metadata : []).map((m, i) =>
        i === index ? { ...m, [field]: input.value } : m,
      );
      actions.updateNode(currentId, { metadata: next });
    }, 200);
    metadataList.addEventListener('input', (e) => {
      const t = e.target;
      if (t.matches('.prop-input--meta-key, .prop-input--meta-value')) {
        debouncedMetaSave(t);
      }
    });
    // Flush au blur pour ne pas perdre la saisie
    metadataList.addEventListener('change', (e) => {
      const t = e.target;
      if (!t.matches('.prop-input--meta-key, .prop-input--meta-value')) return;
      const row = t.closest('.prop-metadata__row');
      const index = Number(row?.dataset.index);
      if (Number.isNaN(index)) return;
      const field = t.classList.contains('prop-input--meta-key') ? 'key' : 'value';
      const node = getState().nodes.find((n) => n.id === currentId);
      if (!node) return;
      const next = (Array.isArray(node.metadata) ? node.metadata : []).map((m, i) =>
        i === index ? { ...m, [field]: t.value } : m,
      );
      actions.updateNode(currentId, { metadata: next });
    });
  }
}

/** Petit debounce utilitaire (closure). */
function debounce(fn, ms) {
  let timer = null;
  return (...args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/* --------------------------------------------------------------------------
 * Souscription au store
 * -------------------------------------------------------------------------- */

function handleStateChange(state, meta = {}) {
  // On ne re-rend le formulaire Propriétés que quand l'onglet est actif,
  // pour éviter de clobber la saisie quand l'utilisateur est sur un
  // autre onglet (Éditeur, Aperçu, Code).
  const propsTab = document.querySelector('.main__tab[data-center-tab="properties"]');
  const isPropsActive = propsTab?.classList.contains('is-active');
  if (!isPropsActive) return;

  if ([
    'selection:changed', 'node:updated', 'node:removed',
    'graph:cleared', 'graph:loaded', 'history:undo', 'history:redo', 'init',
  ].includes(meta.type)) {
    if (isEditingFormField()) return;
    renderProperties();
  }
}

/** Renvoie true si le focus est dans un INPUT ou TEXTAREA du formulaire
 *  Propriétés. Sert à éviter de re-render le form pendant la saisie. */
function isEditingFormField() {
  const el = document.activeElement;
  if (!el) return false;
  if (!el.closest('.prop-form')) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA';
}

/* --------------------------------------------------------------------------
 * Échappements HTML
 * -------------------------------------------------------------------------- */

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
function escapeAttr(s) { return escapeHtml(s); }
