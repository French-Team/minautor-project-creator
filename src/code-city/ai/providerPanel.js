/**
 * Provider Panel — Panneau de configuration des providers IA
 *
 * Activé par le bouton "Providers" du header. Permet de :
 *   - Choisir un provider parmi les presets (online + local)
 *   - Configurer la clé API / URL / modèle
 *   - Tester la connexion
 *   - Sauvegarder la configuration
 *
 * Suit le même pattern que exportPanel.js (slide-in depuis la droite).
 *
 * @module providerPanel
 */

import { getState, actions } from '../state.js';
import { PROVIDER_PRESETS, getOnlineProviders, getLocalProviders } from './providerPresets.js';
import { fetchLocalModels } from './aiClient.js';
import { openApiKeysModal } from './apiKeysModal.js';
import { toast } from './toast.js';

let isOpen = false;
let selectedPresetId = null;
let statusMessage = '';
let statusType = ''; // 'success' | 'error' | ''

export async function initializeProviderPanel() {
  console.log('🤖 Initialisation du panneau providers…');

  try {
    const root = document.getElementById('app-providers');
    const backdrop = document.getElementById('app-providers-backdrop');
    const closeBtn = document.getElementById('app-providers-close');
    const body = document.getElementById('app-providers-body');
    if (!root || !backdrop || !closeBtn || !body) {
      throw new Error('Panneau providers : éléments DOM manquants');
    }

    // Initialiser le preset sélectionné depuis le state
    const current = getState().assistant.provider;
    selectedPresetId = current.id;

    // Remplit le body
    body.innerHTML = renderProviderPanel();

    // Câble les clics
    body.addEventListener('click', handleBodyClick);

    // Câble les changements d'input (apiKey, model, temperature, maxTokens, baseUrl)
    body.addEventListener('input', handleBodyInput);

    // Câble la fermeture
    closeBtn.addEventListener('click', closeProviderPanel);
    backdrop.addEventListener('click', closeProviderPanel);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen) closeProviderPanel();
    });

    // État initial : fermé
    applyOpenState(root, false);
    console.log('✅ Panneau providers initialisé (fermé)');
  } catch (error) {
    console.error('❌ Erreur initialisation panneau providers:', error);
    throw error;
  }
}

/* ---------- API publique ---------- */

export function openProviderPanel() {
  const root = document.getElementById('app-providers');
  if (!root || isOpen) return;
  isOpen = true;
  const body = root.querySelector('#app-providers-body');
  if (body) {
    const current = getState().assistant.provider;
    selectedPresetId = current.id;
    body.innerHTML = renderProviderPanel();
  }
  applyOpenState(root, true);

  // Toast d'info selon le provider sélectionné
  const currentProvider = getState().assistant.provider;
  const preset = PROVIDER_PRESETS.find((p) => p.id === currentProvider.id);
  const providerName = preset?.name || currentProvider.id;

  if (currentProvider.id === 'mistral') {
    toast.warning(`${providerName} — FIM non disponible. Sélectionne Codestral pour la complétion code.`, { duration: 5000 });
  } else if (currentProvider.id === 'codestral') {
    toast.success(`${providerName} — FIM disponible (Ctrl+Space dans l'onglet Code).`, { duration: 4000 });
  } else {
    toast.info(`Provider actif : ${providerName}`);
  }
}

export function closeProviderPanel() {
  const root = document.getElementById('app-providers');
  if (!root || !isOpen) return;
  isOpen = false;
  statusMessage = '';
  statusType = '';
  applyOpenState(root, false);
}

export function toggleProviderPanel() {
  if (isOpen) closeProviderPanel();
  else openProviderPanel();
}

export function isProviderPanelOpen() {
  return isOpen;
}

/* ---------- Render ---------- */

function applyOpenState(root, open) {
  root.classList.toggle('is-open', open);
  root.setAttribute('aria-hidden', open ? 'false' : 'true');
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderProviderPanel() {
  const current = getState().assistant.provider;
  const online = getOnlineProviders();
  const local = getLocalProviders();
  const preset = PROVIDER_PRESETS.find((p) => p.id === selectedPresetId);

  return `

    <div class="provider-panel__section">
      <div class="provider-panel__section-title">● En ligne (gratuit/freemium)</div>
      <div class="provider-panel__list">
        ${online.map((p) => renderProviderItem(p, current)).join('')}
      </div>
    </div>

    <div class="provider-panel__section">
      <div class="provider-panel__section-title">● Local (pas d'internet)</div>
      <div class="provider-panel__list">
        ${local.map((p) => renderProviderItem(p, current)).join('')}
      </div>
    </div>

    <div class="provider-panel__section">
      <div class="provider-panel__section-title">── Configuration ──</div>
      <div class="provider-panel__config">
        <div class="provider-panel__config-header">
          <span class="provider-panel__config-name">${preset ? escapeHtml(preset.name) : 'Aucun'}</span>
          <span class="provider-panel__config-badge provider-panel__config-badge--${preset?.category || 'online'}">${preset?.category === 'local' ? 'Local' : 'En ligne'}</span>
        </div>

        <div class="provider-panel__field">
          <label class="provider-panel__label" for="provider-model">Modèle</label>
          <select class="provider-panel__select" id="provider-model">
            ${renderModelOptions(preset, current.model)}
          </select>
        </div>

        <div class="provider-panel__field">
          <label class="provider-panel__label" for="provider-base-url">URL</label>
          <input type="text" class="provider-panel__input" id="provider-base-url"
                 value="${escapeHtml(current.baseUrl)}" spellcheck="false" />
        </div>

        ${preset?.authRequired ? `
        <div class="provider-panel__field">
          <label class="provider-panel__label" for="provider-api-key">Clé API</label>
          <input type="password" class="provider-panel__input" id="provider-api-key"
                 value="${escapeHtml(current.apiKey)}" placeholder="sk-..." autocomplete="off" />
        </div>
        ` : ''}

        <div class="provider-panel__field-row">
          <div class="provider-panel__field provider-panel__field--half">
            <label class="provider-panel__label" for="provider-temperature">Température</label>
            <input type="number" class="provider-panel__input" id="provider-temperature"
                   value="${current.temperature}" min="0" max="2" step="0.1" />
          </div>
          <div class="provider-panel__field provider-panel__field--half">
            <label class="provider-panel__label" for="provider-max-tokens">Max tokens</label>
            <input type="number" class="provider-panel__input" id="provider-max-tokens"
                   value="${current.maxTokens}" min="256" max="128000" step="256" />
          </div>
        </div>

        <button type="button" class="btn provider-panel__test-btn" id="provider-test-btn">
          🔄 Tester la connexion
        </button>

        ${statusMessage ? `
        <div class="provider-panel__status provider-panel__status--${statusType}">
          ${statusType === 'success' ? '✅' : '❌'} ${escapeHtml(statusMessage)}
        </div>
        ` : ''}

        <button type="button" class="btn btn--primary provider-panel__save-btn" id="provider-save-btn">
          💾 Sauvegarder
        </button>

        <button type="button" class="btn provider-panel__keys-btn" id="provider-keys-btn">
          🔑 Gérer les clés API
        </button>
      </div>
    </div>
  `;
}

function renderProviderItem(preset, current) {
  const isActive = current.id === preset.id;
  const iconMap = {
    cloud: '🌐', sparkles: '✨', code: '💻', server: '🖥',
  };
  const icon = iconMap[preset.icon] || '🤖';

  return `
    <button type="button" class="provider-panel__item ${isActive ? 'is-active' : ''}"
            data-preset-id="${preset.id}">
      <span class="provider-panel__item-icon">${icon}</span>
      <span class="provider-panel__item-name">${escapeHtml(preset.name)}</span>
      ${isActive ? '<span class="provider-panel__item-check">●</span>' : ''}
    </button>
  `;
}

function renderModelOptions(preset, currentModel) {
  if (!preset) return '<option value="">Aucun provider sélectionné</option>';

  const models = preset.models || [];
  if (models.length === 0) {
    // Provider local sans modèles pré-définis — laisser l'utilisateur taper
    return `<option value="${escapeHtml(currentModel)}">${escapeHtml(currentModel) || '(saisir manuellement)'}</option>`;
  }

  return models.map((m) => {
    const selected = m.id === currentModel ? 'selected' : '';
    return `<option value="${escapeHtml(m.id)}" ${selected}>${escapeHtml(m.name)}</option>`;
  }).join('');
}

/* ---------- Event handlers ---------- */

function handleBodyClick(e) {
  // Sélection d'un provider preset
  const presetItem = e.target.closest('[data-preset-id]');
  if (presetItem) {
    const id = presetItem.dataset.presetId;
    selectedPresetId = id;
    actions.setProvider(id);
    // Charger les modèles locaux si applicable
    const preset = PROVIDER_PRESETS.find((p) => p.id === id);
    if (preset?.category === 'local') {
      loadLocalModels(preset);
    }
    statusMessage = '';
    statusType = '';
    refreshBody();
    return;
  }

  // Bouton tester la connexion
  if (e.target.closest('#provider-test-btn')) {
    handleTestConnection();
    return;
  }

  // Bouton sauvegarder
  if (e.target.closest('#provider-save-btn')) {
    handleSave();
    return;
  }

  // Bouton gérer les clés API
  if (e.target.closest('#provider-keys-btn')) {
    openApiKeysModal();
    return;
  }
}

function handleBodyInput(e) {
  const id = e.target.id;
  const value = e.target.value;

  switch (id) {
    case 'provider-model':
      actions.updateProvider({ model: value });
      break;
    case 'provider-base-url':
      actions.updateProvider({ baseUrl: value });
      break;
    case 'provider-api-key':
      actions.updateProvider({ apiKey: value });
      break;
    case 'provider-temperature': {
      const temp = parseFloat(value);
      if (!isNaN(temp)) actions.updateProvider({ temperature: temp });
      break;
    }
    case 'provider-max-tokens': {
      const tokens = parseInt(value, 10);
      if (!isNaN(tokens)) actions.updateProvider({ maxTokens: tokens });
      break;
    }
  }
}

async function handleTestConnection() {
  const testBtn = document.getElementById('provider-test-btn');
  if (testBtn) {
    testBtn.disabled = true;
    testBtn.textContent = '⏳ Test en cours…';
  }

  try {
    const result = await actions.testProviderConnection();

    if (result.ok) {
      const latency = result.latency || 0;
      const modelCount = result.models?.models?.length;
      const parts = [`Connecté`, `${latency}ms`];
      if (modelCount != null) parts.push(`${modelCount} modèles`);
      statusMessage = parts.join(' — ');
      statusType = 'success';
    } else {
      statusMessage = result.error || 'Échec de la connexion';
      statusType = 'error';
    }
  } catch (err) {
    statusMessage = err.message;
    statusType = 'error';
  }

  if (testBtn) {
    testBtn.disabled = false;
    testBtn.textContent = '🔄 Tester la connexion';
  }
  refreshBody();
}

function handleSave() {
  const current = getState().assistant.provider;
  actions.setStatusMessage(`Provider ${current.id} sauvegardé`, 'success');
  closeProviderPanel();
}

async function loadLocalModels(preset) {
  try {
    const provider = getState().assistant.provider;
    const models = await fetchLocalModels(provider);
    if (models.length > 0) {
      // Mettre à jour le premier modèle par défaut
      const firstModel = models[0];
      actions.updateProvider({ model: firstModel.id });
      // Mettre à jour la liste des modèles dans le preset
      preset.models = models;
      refreshBody();
    }
  } catch {
    // Ignore — les modèles locaux ne sont peut-être pas disponibles
  }
}

function refreshBody() {
  const root = document.getElementById('app-providers');
  if (!root || !isOpen) return;
  const body = root.querySelector('#app-providers-body');
  if (body) {
    body.innerHTML = renderProviderPanel();
  }
}
