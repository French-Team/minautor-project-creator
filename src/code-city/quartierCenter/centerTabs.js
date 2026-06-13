/**
 * Center Tabs — Gestion des onglets de la zone centre
 *
 * 4 onglets au-dessus de la zone principale :
 *   - "Éditeur"    : toolbar + canvas (drag & drop, nœuds, ports)
 *   - "Aperçu"     : rendu Mermaid pleine zone
 *   - "Code"       : éditeur 2-way binding du code Mermaid
 *   - "Propriétés" : formulaire du nœud sélectionné
 *
 * L'aperçu se rafraîchit en background (previewPanel.js) même quand
 * un autre onglet est actif, pour que le switch soit instantané.
 *
 * Expose `activateEditorTab()` pour que le clic sur un nœud du rendu
 * Mermaid puisse basculer vers l'éditeur, et
 * `openPropertiesAndFocusLabel()` pour que le bouton ⚙ du menu rapide
 * du nœud ouvre l'onglet Propriétés et focus le libellé.
 */

import { getState, actions } from '../state.js';

import { getChatIcon } from "../chatIcons.js";
import { escapeHtml } from '../utils/html.js';

const VALID_TABS = ['editor', 'preview', 'code', 'properties'];
let activeTab = 'editor';

export function initializeCenterTabs() {
  console.log('📑 Initialisation des onglets du centre…');

  const tabs = document.querySelectorAll('.app__main .main__tab');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      if (tab.disabled) return;
      activateCenterTab(tab.dataset.centerTab);
    });
  });

  console.log('✅ Onglets du centre initialisés');

  // Floating FIM button in the Code tab
  createFimFloatingButton();
}

/** Active un onglet du centre. */
export function activateCenterTab(name) {
  if (!VALID_TABS.includes(name)) return;
  activeTab = name;
  document.querySelectorAll('.app__main .main__tab').forEach((t) => {
    const on = t.dataset.centerTab === name;
    t.classList.toggle('is-active', on);
    t.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  document.querySelectorAll('.app__main .main__panel').forEach((p) => {
    p.classList.toggle('is-active', p.dataset.centerPanel === name);
  });
  // Show/hide the floating FIM button based on active tab
  updateFimFloatingVisibility(name);

  // Si on revient sur l'éditeur, le canvas doit reprendre sa taille —
  // un resize OBSERVER sur la zone le fait déjà, mais on s'assure que
  // l'overlay est synchro.
  if (name === 'editor') {
    window.dispatchEvent(new Event('resize'));
  }
}

/** Bascule vers l'onglet Éditeur. Utilisé quand on clique un nœud dans
 *  l'aperçu Mermaid. */
export function activateEditorTab() {
  activateCenterTab('editor');
}

/** Bascule vers l'onglet Propriétés (et focus le libellé). */
export function openPropertiesAndFocusLabel() {
  activateCenterTab('properties');
  requestAnimationFrame(() => {
    const input = document.getElementById('prop-label');
    if (input) {
      input.focus();
      input.select();
    }
  });
}

/** Renvoie l'onglet actuellement actif. */
export function getActiveCenterTab() {
  return activeTab;
}

/**
 * Centre la vue du canvas sur un nœud donné.
 * Calcule le pan nécessaire pour que le centre du nœud tombe au centre
 * de la zone canvas visible, en tenant compte du zoom courant.
 */
export function centerOnNode(nodeId) {
  const state = getState();
  const node = state.nodes.find((n) => n.id === nodeId);
  if (!node) return;

  const container = document.querySelector('.app__main .canvas-area');
  if (!container) return;
  const rect = container.getBoundingClientRect();

  // Récupère les dimensions réelles du nœud dans le DOM
  const el = document.querySelector(`.canvas-element[data-id="${cssEscape(nodeId)}"]`);
  const w = el?.offsetWidth || 140;
  const h = el?.offsetHeight || 48;
  const cx = node.x + w / 2;
  const cy = node.y + h / 2;

  const zoom = state.view.zoom;
  // On veut : cx * zoom + pan.x = rect.width / 2
  const newPan = {
    x: rect.width / 2 - cx * zoom,
    y: rect.height / 2 - cy * zoom,
  };
  actions.setPan(newPan);
}

/* --------------------------------------------------------------------------
 * FIM Floating Button — "🤖 Compléter" above the code textarea
 * -------------------------------------------------------------------------- */
let fimFloatingBtn = null;
let fimStatusEl = null;

function createFimFloatingButton() {
  fimFloatingBtn = document.createElement('button');
  fimFloatingBtn.type = 'button';
  fimFloatingBtn.className = 'fim-floating-btn';
  fimFloatingBtn.title = 'Compléter la sélection (Ctrl+Shift+C)';
  fimFloatingBtn.innerHTML = `<span class="fim-floating-btn__icon">${getChatIcon('bot', 14)}</span> Compléter`;
  fimFloatingBtn.style.display = 'none';

  fimStatusEl = document.createElement('span');
  fimStatusEl.className = 'fim-floating-btn__status';
  fimStatusEl.style.display = 'none';
  fimFloatingBtn.appendChild(fimStatusEl);

  fimFloatingBtn.addEventListener('click', async () => {
    const textarea = document.getElementById('code-preview');
    if (!textarea) return;
    fimFloatingBtn.disabled = true;
    const result = await triggerFimCompletion(textarea, (type, msg) => {
      if (type === 'thinking') {
        fimStatusEl.textContent = msg;
        fimStatusEl.style.display = 'inline';
        fimFloatingBtn.classList.add('is-loading');
      } else if (type === 'done') {
        fimStatusEl.innerHTML = `${getChatIcon('check', 11)} ${escapeHtml(msg)}`;
        fimStatusEl.style.display = 'inline';
        fimFloatingBtn.classList.remove('is-loading');
        setTimeout(() => { fimStatusEl.style.display = 'none'; }, 3000);
      } else if (type === 'error') {
        fimStatusEl.innerHTML = `${getChatIcon('x', 11)} ${escapeHtml(msg)}`;
        fimStatusEl.style.display = 'inline';
        fimFloatingBtn.classList.remove('is-loading');
        setTimeout(() => { fimStatusEl.style.display = 'none'; }, 5000);
      }
    });
    if (result) insertFimCompletion(textarea, result);
    fimFloatingBtn.disabled = false;
    updateFimFloatingVisibility(activeTab);
  });

  document.body.appendChild(fimFloatingBtn);

  // Update position + visibility on relevant events
  const textarea = document.getElementById('code-preview');
  if (textarea) {
    const update = () => updateFimFloatingVisibility(activeTab);
    textarea.addEventListener('select', update);
    textarea.addEventListener('click', update);
    textarea.addEventListener('keyup', update);
    textarea.addEventListener('input', update);
  }
  window.addEventListener('resize', () => updateFimFloatingVisibility(activeTab));
}

function updateFimFloatingVisibility(tab) {
  if (!fimFloatingBtn) return;
  const textarea = document.getElementById('code-preview');
  const hasSelection = textarea && textarea.selectionStart !== textarea.selectionEnd;
  const visible = tab === 'code' && isFimAvailable() && hasSelection;
  if (!visible) {
    fimFloatingBtn.style.display = 'none';
    return;
  }
  // Position the button above the textarea selection area
  const taRect = textarea.getBoundingClientRect();
  fimFloatingBtn.style.display = 'flex';
  fimFloatingBtn.style.right = `${window.innerWidth - taRect.right + 8}px`;
  fimFloatingBtn.style.top = `${taRect.top - 4}px`;
}

/** Échappe une chaîne pour un selector CSS (id qui contient des caractères
 *  spéciaux comme les tirets des IDs typés n1-user). */
function cssEscape(s) {
  if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(s);
  return String(s).replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`);
}
