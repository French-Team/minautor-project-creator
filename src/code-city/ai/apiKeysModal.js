/**
 * API Keys Modal — Gestion des clés API
 *
 * Modale permettant d'ajouter, éditer, voir et supprimer des clés API.
 * Les clés sont stockées dans le state (localStorage via state.js).
 *
 * Usage :
 *   import { openApiKeysModal } from './apiKeysModal.js';
 *   openApiKeysModal();
 *
 * @module apiKeysModal
 */

import { getState, actions } from '../state.js';
import { PROVIDER_PRESETS } from './providerPresets.js';
import { toast } from './toast.js';

let modalEl = null;

/**
 * Échappe le HTML pour insertion sécurisée.
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Masque une clé API : affiche les 4 premiers et les 4 derniers caractères.
 */
function maskKey(key) {
  if (!key) return '';
  if (key.length <= 8) return '••••••••';
  return key.slice(0, 4) + '•'.repeat(Math.min(key.length - 8, 20)) + key.slice(-4);
}

/**
 * Retourne le nom du provider par son ID.
 */
function getProviderName(providerId) {
  const preset = PROVIDER_PRESETS.find((p) => p.id === providerId);
  return preset?.name || providerId;
}

/**
 * Ouvre la modale de gestion des clés API.
 */
export function openApiKeysModal() {
  if (modalEl) return;

  const keys = getState().assistant?.apiKeys || [];

  modalEl = document.createElement('div');
  modalEl.className = 'api-keys-modal is-open';
  modalEl.setAttribute('role', 'dialog');
  modalEl.setAttribute('aria-modal', 'true');
  modalEl.setAttribute('aria-labelledby', 'api-keys-modal-title');

  modalEl.innerHTML = `
    <div class="api-keys-modal__backdrop"></div>
    <div class="api-keys-modal__dialog">
      <header class="api-keys-modal__header">
        <h2 id="api-keys-modal-title" class="api-keys-modal__title">🔑 Gestion des clés API</h2>
        <button type="button" class="api-keys-modal__close" aria-label="Fermer">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </header>
      <div class="api-keys-modal__body">
        ${renderKeysList(keys)}
        <button type="button" class="btn btn--primary api-keys-modal__add-btn" data-action="add-key">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          Ajouter une clé API
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modalEl);

  // Câble les événements
  modalEl.querySelector('.api-keys-modal__backdrop').addEventListener('click', closeModal);
  modalEl.querySelector('.api-keys-modal__close').addEventListener('click', closeModal);
  modalEl.addEventListener('click', handleModalClick);
  document.addEventListener('keydown', handleEscape);

  // Focus trap
  requestAnimationFrame(() => {
    const firstFocusable = modalEl.querySelector('button, input, select');
    if (firstFocusable) firstFocusable.focus();
  });
}

/**
 * Ferme la modale.
 */
function closeModal() {
  if (!modalEl) return;
  modalEl.classList.remove('is-open');
  modalEl.addEventListener('animationend', () => {
    modalEl?.remove();
    modalEl = null;
  }, { once: true });
  // Fallback si pas d'animation
  setTimeout(() => {
    if (modalEl) {
      modalEl.remove();
      modalEl = null;
    }
  }, 300);
  document.removeEventListener('keydown', handleEscape);
}

function handleEscape(e) {
  if (e.key === 'Escape') closeModal();
}

/**
 * Rendu de la liste des clés API.
 */
function renderKeysList(keys) {
  if (!keys || keys.length === 0) {
    return `
      <div class="api-keys-modal__empty">
        <div class="api-keys-modal__empty-icon">🔐</div>
        <div class="api-keys-modal__empty-text">Aucune clé API enregistrée.</div>
        <div class="api-keys-modal__empty-hint">Ajoute une clé pour l'utiliser avec tes providers.</div>
      </div>
    `;
  }

  return `
    <div class="api-keys-modal__list">
      ${keys.map((key, index) => renderKeyItem(key, index)).join('')}
    </div>
  `;
}

/**
 * Rendu d'un élément de clé API.
 */
function renderKeyItem(key, index) {
  return `
    <div class="api-keys-modal__item" data-key-index="${index}">
      <div class="api-keys-modal__item-header">
        <span class="api-keys-modal__item-name">${escapeHtml(key.name || `Clé ${index + 1}`)}</span>
        <span class="api-keys-modal__item-provider">${escapeHtml(getProviderName(key.providerId))}</span>
      </div>
      <div class="api-keys-modal__item-key">
        <code>${escapeHtml(maskKey(key.value))}</code>
      </div>
      <div class="api-keys-modal__item-actions">
        <button type="button" class="api-keys-modal__action-btn" data-action="view-key" data-index="${index}" title="Voir">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        </button>
        <button type="button" class="api-keys-modal__action-btn" data-action="edit-key" data-index="${index}" title="Éditer">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button type="button" class="api-keys-modal__action-btn" data-action="use-key" data-index="${index}" title="Appliquer au provider actuel">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2v20M2 12h20"/>
          </svg>
        </button>
        <button type="button" class="api-keys-modal__action-btn api-keys-modal__action-btn--danger" data-action="delete-key" data-index="${index}" title="Supprimer">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"/>
          </svg>
        </button>
      </div>
    </div>
  `;
}

/**
 * Gestion des clics dans la modale.
 */
function handleModalClick(e) {
  const actionEl = e.target.closest('[data-action]');
  if (!actionEl) return;

  const action = actionEl.dataset.action;
  const index = parseInt(actionEl.dataset.index, 10);

  switch (action) {
    case 'add-key':
      showAddKeyForm();
      break;
    case 'view-key':
      viewKey(index);
      break;
    case 'edit-key':
      showEditKeyForm(index);
      break;
    case 'delete-key':
      deleteKey(index);
      break;
    case 'save-key':
      saveKey();
      break;
    case 'cancel-form':
      refreshModal();
      break;
    case 'use-key':
      useKey(index);
      break;
  }
}

/**
 * Affiche le formulaire d'ajout de clé.
 */
function showAddKeyForm() {
  const body = modalEl.querySelector('.api-keys-modal__body');
  const onlineProviders = PROVIDER_PRESETS.filter((p) => p.authRequired);

  body.innerHTML = `
    <div class="api-keys-modal__form">
      <div class="api-keys-modal__field">
        <label class="api-keys-modal__label" for="api-key-name">Nom</label>
        <input type="text" class="api-keys-modal__input" id="api-key-name" placeholder="Ma clé OpenRouter" autocomplete="off" />
      </div>
      <div class="api-keys-modal__field">
        <label class="api-keys-modal__label" for="api-key-provider">Provider</label>
        <select class="api-keys-modal__select" id="api-key-provider">
          ${onlineProviders.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('')}
        </select>
      </div>
      <div class="api-keys-modal__field">
        <label class="api-keys-modal__label" for="api-key-value">Clé API</label>
        <input type="password" class="api-keys-modal__input" id="api-key-value" placeholder="sk-..." autocomplete="off" />
      </div>
      <div class="api-keys-modal__form-actions">
        <button type="button" class="btn" data-action="cancel-form">Annuler</button>
        <button type="button" class="btn btn--primary" data-action="save-key">Sauvegarder</button>
      </div>
    </div>
  `;
}

/**
 * Affiche le formulaire d'édition de clé.
 */
function showEditKeyForm(index) {
  const keys = getState().assistant?.apiKeys || [];
  const key = keys[index];
  if (!key) return;

  const body = modalEl.querySelector('.api-keys-modal__body');
  const onlineProviders = PROVIDER_PRESETS.filter((p) => p.authRequired);

  body.innerHTML = `
    <div class="api-keys-modal__form">
      <input type="hidden" id="api-key-edit-index" value="${index}" />
      <div class="api-keys-modal__field">
        <label class="api-keys-modal__label" for="api-key-name">Nom</label>
        <input type="text" class="api-keys-modal__input" id="api-key-name" value="${escapeHtml(key.name || '')}" autocomplete="off" />
      </div>
      <div class="api-keys-modal__field">
        <label class="api-keys-modal__label" for="api-key-provider">Provider</label>
        <select class="api-keys-modal__select" id="api-key-provider">
          ${onlineProviders.map((p) => `<option value="${p.id}" ${p.id === key.providerId ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('')}
        </select>
      </div>
      <div class="api-keys-modal__field">
        <label class="api-keys-modal__label" for="api-key-value">Clé API</label>
        <input type="password" class="api-keys-modal__input" id="api-key-value" value="${escapeHtml(key.value || '')}" autocomplete="off" />
      </div>
      <div class="api-keys-modal__form-actions">
        <button type="button" class="btn" data-action="cancel-form">Annuler</button>
        <button type="button" class="btn btn--primary" data-action="save-key">Mettre à jour</button>
      </div>
    </div>
  `;
}

/**
 * Affiche la clé en clair (vue détaillée).
 */
function viewKey(index) {
  const keys = getState().assistant?.apiKeys || [];
  const key = keys[index];
  if (!key) return;

  const body = modalEl.querySelector('.api-keys-modal__body');
  body.innerHTML = `
    <div class="api-keys-modal__form">
      <div class="api-keys-modal__field">
        <label class="api-keys-modal__label">Nom</label>
        <div class="api-keys-modal__readonly">${escapeHtml(key.name || `Clé ${index + 1}`)}</div>
      </div>
      <div class="api-keys-modal__field">
        <label class="api-keys-modal__label">Provider</label>
        <div class="api-keys-modal__readonly">${escapeHtml(getProviderName(key.providerId))}</div>
      </div>
      <div class="api-keys-modal__field">
        <label class="api-keys-modal__label">Clé API</label>
        <div class="api-keys-modal__readonly api-keys-modal__readonly--key">
          <code>${escapeHtml(key.value)}</code>
          <button type="button" class="api-keys-modal__copy-btn" data-key-value="${escapeHtml(key.value)}" title="Copier">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="api-keys-modal__form-actions">
        <button type="button" class="btn" data-action="cancel-form">Retour</button>
        <button type="button" class="btn" data-action="edit-key" data-index="${index}">Éditer</button>
      </div>
    </div>
  `;

  // Copier la clé
  const copyBtn = body.querySelector('.api-keys-modal__copy-btn');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(copyBtn.dataset.keyValue).then(() => {
        toast.success('Clé copiée dans le presse-papier');
      }).catch(() => {
        toast.error('Impossible de copier la clé');
      });
    });
  }
}

/**
 * Sauvegarde une clé (ajout ou édition).
 */
function saveKey() {
  const name = modalEl.querySelector('#api-key-name')?.value?.trim();
  const providerId = modalEl.querySelector('#api-key-provider')?.value;
  const value = modalEl.querySelector('#api-key-value')?.value?.trim();
  const editIndex = modalEl.querySelector('#api-key-edit-index')?.value;

  if (!value) {
    toast.warning('La valeur de la clé est requise');
    return;
  }
  if (!providerId) {
    toast.warning('Sélectionne un provider');
    return;
  }

  const keys = [...(getState().assistant?.apiKeys || [])];

  if (editIndex !== undefined && editIndex !== '') {
    // Édition
    const idx = parseInt(editIndex, 10);
    keys[idx] = { ...keys[idx], name: name || keys[idx].name, providerId, value };
    actions.updateApiKey(idx, keys[idx]);
    toast.success('Clé API mise à jour');
  } else {
    // Ajout
    const newKey = { name: name || `Clé ${keys.length + 1}`, providerId, value };
    actions.addApiKey(newKey);
    toast.success('Clé API ajoutée');
  }

  refreshModal();
}

/**
 * Supprime une clé avec confirmation.
 */
function deleteKey(index) {
  const keys = getState().assistant?.apiKeys || [];
  const key = keys[index];
  if (!key) return;

  const body = modalEl.querySelector('.api-keys-modal__body');
  body.innerHTML = `
    <div class="api-keys-modal__confirm">
      <div class="api-keys-modal__confirm-icon">⚠️</div>
      <div class="api-keys-modal__confirm-title">Supprimer cette clé ?</div>
      <div class="api-keys-modal__confirm-text">
        La clé <strong>${escapeHtml(key.name || `Clé ${index + 1}`)}</strong> sera définitivement supprimée.
      </div>
      <div class="api-keys-modal__confirm-actions">
        <button type="button" class="btn" data-action="cancel-form">Annuler</button>
        <button type="button" class="btn btn--danger" data-action="confirm-delete" data-index="${index}">Supprimer</button>
      </div>
    </div>
  `;

  // Re-câbler le confirm delete
  body.querySelector('[data-action="confirm-delete"]')?.addEventListener('click', () => {
    actions.removeApiKey(index);
    toast.success('Clé API supprimée');
    refreshModal();
  });
}

/**
 * Applique une clé API au provider actuel.
 */
function useKey(index) {
  const keys = getState().assistant?.apiKeys || [];
  const key = keys[index];
  if (!key) return;

  actions.updateProvider({ apiKey: key.value });
  toast.success(`Clé "${key.name || key.providerId}" appliquée au provider actuel`);
  closeModal();
}

/**
 * Rafraîchit le contenu de la modale.
 */
function refreshModal() {
  if (!modalEl) return;
  const keys = getState().assistant?.apiKeys || [];
  const body = modalEl.querySelector('.api-keys-modal__body');
  if (body) {
    body.innerHTML = `
      ${renderKeysList(keys)}
      <button type="button" class="btn btn--primary api-keys-modal__add-btn" data-action="add-key">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 5v14M5 12h14"/>
        </svg>
        Ajouter une clé API
      </button>
    `;
  }
}
