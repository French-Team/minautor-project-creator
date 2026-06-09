/**
 * Provider Panel — Panneau de configuration des providers IA (refonte spec)
 *
 * Layout 3 zones :
 *   Zone 1 — Status (sticky) : provider actif, modèle, indicateur de connexion
 *   Zone 2 — Grid providers  : grille générée depuis providers-grid.json
 *   Zone 3 — Workflow guidé  : étapes 1-6 avec barre de progression
 *
 * Source de vérité : provider-configs.json (via providerLoader)
 * Clés API         : .env (via envLoader → /api/env endpoint)
 *
 * @module providerPanel
 */

import { getState, actions, subscribe } from '../state.js';
import { openApiKeysModal } from './apiKeysModal.js';
import { getPreset, getPresetsByCategory } from './providerLoader.js';
import { hasApiKey } from './envLoader.js';
import { setProviderConfig } from './providerStore.js';
import { toast } from './toast.js';
import {
  startWorkflow,
  cancelWorkflow,
  testApiKey,
  selectModel,
  getWorkflowState,
  getDisplayModels,
  setOnStepChange,
  restartWorkflowFromStep4,
} from './workflowRunner.js';

// --- State éphémère UI (pas dans le store) ---

let isOpen = false;
let modelSearchQuery = '';
let showAllModels = false;

// --- Public API ---

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

    wireEventListeners(body);
    closeBtn.addEventListener('click', () => closeProviderPanel());
    backdrop.addEventListener('click', () => closeProviderPanel());

    // Rafraîchir Zone 1 quand le provider change
    subscribe((_state, meta) => {
      if (isOpen && meta.type === 'assistant:provider') {
        render();
      }
    });

    // Re-render à chaque changement d'étape workflow
    setOnStepChange(() => {
      if (isOpen) render();
    });

    applyOpenState(root, false);
    console.log('✅ Panneau providers initialisé (fermé)');
  } catch (error) {
    console.error('❌ Erreur initialisation panneau providers:', error);
    throw error;
  }
}

export function openProviderPanel() {
  const root = document.getElementById('app-providers');
  if (!root || isOpen) return;
  isOpen = true;
  modelSearchQuery = '';
  showAllModels = false;
  applyOpenState(root, true);
  render();

  const current = getState().assistant.provider;
  const preset = current.id ? getPreset(current.id) : null;
  toast.info(`Provider actif : ${preset?.name || current.id || 'aucun'}`);
}

export function closeProviderPanel() {
  const root = document.getElementById('app-providers');
  if (!root || !isOpen) return;
  isOpen = false;
  applyOpenState(root, false);
}

export function toggleProviderPanel() {
  if (isOpen) closeProviderPanel();
  else openProviderPanel();
}

export function isProviderPanelOpen() {
  return isOpen;
}

// --- DOM helpers ---

function applyOpenState(root, open) {
  root.classList.toggle('is-open', open);
  root.setAttribute('aria-hidden', open ? 'false' : 'true');
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// --- Render principal ---

function render() {
  const body = document.querySelector('#app-providers-body');
  if (!body || !isOpen) return;
  body.innerHTML = `
    ${renderStatusZone()}
    ${renderHeaderActions()}
    ${renderProviderGrid()}
    ${renderWorkflowZone()}
  `;
}

function renderHeaderActions() {
  return `
    <div class="pp-header-actions">
      <button type="button" class="pp-header-btn" data-action="open-keys-modal" title="Gérer les clés API">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
        </svg>
        Clés API
      </button>
      <button type="button" class="pp-header-btn pp-header-btn--danger" data-action="clear-localstorage" title="Réinitialiser le state (dev)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>
        Réinitialiser (dev)
      </button>
    </div>
  `;
}

// =========================================================================
// Zone 1 — Status de la config actuelle (sticky)
// =========================================================================

function renderStatusZone() {
  const current = getState().assistant.provider;
  const preset = current.id ? getPreset(current.id) : null;
  const { step, selectedModelId, modelMeta, loadedModels } = getWorkflowState();

  // Déterminer la classe de statut
  let statusClass = 'disconnected';
  if (current.isConnected && current.model) {
    statusClass = 'connected';
  } else if (step > 0 && step < 6) {
    statusClass = 'testing';
  }

  // Vérifier si le provider a une clé API dans .env (via envLoader)
  const providerPreset = current.id ? getPreset(current.id) : null;
  const hasEnvKey = !!(providerPreset && hasApiKey(providerPreset));

  // Modèle affiché — seulement si le provider a été validé (isConnected ou lastTestedAt)
  // Sinon le modèle reste en arrière-plan (pas de display si provider pas encore configuré)
  const modelName = (current.isConnected || current.lastTestedAt)
    ? (current.model || (selectedModelId && loadedModels?.find(m => m.id === selectedModelId)?.name) || '—')
    : '—';

  const providerName = preset ? escapeHtml(preset.name) : escapeHtml(current.id || '—');

  return `
    <div class="pp-status">
      <div class="pp-status__header">
        <span class="pp-status__name">${providerName}</span>
        <span class="pp-status__indicator pp-status__indicator--${statusClass}" title="${statusClass}"></span>
      </div>
      <div class="pp-status__details">
        <div class="pp-status__row">
          <span class="pp-status__label">Modèle</span>
          <span class="pp-status__value">${escapeHtml(modelName)}</span>
        </div>
        ${modelMeta ? `
          <div class="pp-status__row">
            <span class="pp-status__label">Latence</span>
            <span class="pp-status__value">${modelMeta.latency}ms</span>
          </div>
          <div class="pp-status__row">
            <span class="pp-status__label">Format</span>
            <span class="pp-status__value">${escapeHtml(modelMeta.format)}</span>
          </div>
        ` : ''}
        ${hasEnvKey ? `
          <div class="pp-status__row">
            <span class="pp-status__label">Clé API</span>
            <span class="pp-status__value pp-status__value--key">✅ Configurée</span>
          </div>
        ` : ''}
      </div>
      ${renderProgressBar(step)}
    </div>
  `;
}

/**
 * Barre de progression 6 étapes.
 * Étapes 1-6 : URL → Clé → Modèles → Sélection → Test → Validated
 */
function renderProgressBar(currentStep) {
  const steps = [
    { n: 1, label: 'URL' },
    { n: 2, label: 'Clé' },
    { n: 3, label: 'Modèles' },
    { n: 4, label: 'Sélection' },
    { n: 5, label: 'Test' },
    { n: 6, label: 'OK' },
  ];

  const activeStep = currentStep > 0 ? Math.min(currentStep, 6) : 0;

  return `
    <div class="pp-progress">
      ${steps.map(s => `
        <div class="pp-progress__step ${activeStep >= s.n ? 'is-active' : ''} ${activeStep === s.n ? 'is-current' : ''}">
          <div class="pp-progress__badge">${s.n}</div>
          <div class="pp-progress__label">${s.label}</div>
        </div>
      `).join('')}
    </div>
  `;
}

// =========================================================================
// Zone 2 — Grille des providers (depuis providers-grid.json via providerLoader)
// =========================================================================

function renderProviderGrid() {        const online = getPresetsByCategory('online');        const local = getPresetsByCategory('local');
  const current = getState().assistant.provider;

  function isShortName(name) {
    return name.trim().split(/\b\b/g).length === 1 || name.trim().split(/\b\b/g).length < 2;
  }

  function renderProviderBtn(p) {
    const isActive = current.id === p.id;
    return `<button type="button" class="pp-grid__item ${isActive ? 'is-active' : ''}"
                    data-provider-id="${p.id}">
      <span class="pp-grid__name">${escapeHtml(p.name)}</span>
    </button>`;
  }

  const onlineShort = online.filter(p => isShortName(p.name));
  const onlineLong = online.filter(p => !isShortName(p.name));
  const localShort = local.filter(p => isShortName(p.name));
  const localLong = local.filter(p => !isShortName(p.name));

  return `
    <div class="pp-section">
      <div class="pp-section__title">En ligne</div>
      <div class="pp-grid">
        <div class="pp-grid__col1">${onlineShort.map(renderProviderBtn).join('')}</div>
        <div class="pp-grid__col2">${onlineLong.map(renderProviderBtn).join('')}</div>
      </div>
    </div>
    <div class="pp-section">
      <div class="pp-section__title">Local</div>
      <div class="pp-grid">
        <div class="pp-grid__col1">${localShort.map(renderProviderBtn).join('')}</div>
        <div class="pp-grid__col2">${localLong.map(renderProviderBtn).join('')}</div>
      </div>
    </div>
  `;
}

// =========================================================================
// Zone 3 — Workflow guidé 6 étapes
// =========================================================================

function renderWorkflowZone() {
  const { step } = getWorkflowState();
  const current = getState().assistant.provider;

  switch (step) {
    case 0: return renderEmptyWorkflow();
    case 1: return renderLoadingStep('Vérification de l\u0027URL…');
    case 2: return renderApiKeyStep(current);
    case 3: return renderLoadingStep('Chargement des modèles disponibles…');
    case 4: return renderModelSelectionStep();
    case 5: return renderLoadingStep('Test du modèle en cours…');
    case 6: return renderValidatedStep();
    case 7: return renderValidatedStep(); // Step 7 = auto-restoré (step 6 = validation manuelle
    default: return renderEmptyWorkflow();
  }
}

function renderEmptyWorkflow() {
  return `
    <div class="pp-workflow">
      <div class="pp-workflow__empty">
        Sélectionne un provider dans la grille ci-dessus pour commencer
      </div>
    </div>
  `;
}

function renderLoadingStep(message) {
  return `
    <div class="pp-workflow">
      <div class="pp-workflow__step">
        <div class="pp-workflow__step-title">⏳ ${escapeHtml(message)}</div>
        <div class="pp-workflow__loading">
          <div class="pp-spinner"></div>
          <span>Veuillez patienter</span>
        </div>
      </div>
    </div>
  `;
}

function renderApiKeyStep(current) {
  // Si une clé est déjà dans le state (via env), on l'affiche masquée
  const savedKey = current.apiKey || '';
  const savedKeyDisplay = savedKey ? '•'.repeat(Math.min(savedKey.length, 20)) : '';

  return `
    <div class="pp-workflow">
      <div class="pp-workflow__step">
        <div class="pp-workflow__step-title">🔑 Clé API</div>
        <p class="pp-workflow__hint">
          Entre ta clé API pour ce provider. Elle sera stockée dans le fichier <code>.env</code> à la racine du projet.
        </p>
        <div class="pp-workflow__field">
          <label class="pp-workflow__label" for="pp-api-key">Clé API</label>
          <div class="pp-workflow__input-group">
            <input type="password" class="pp-workflow__input" id="pp-api-key"
                   placeholder="sk-..." autocomplete="off"
                   value="${savedKey ? escapeHtml(savedKey) : ''}" />
            <button type="button" class="pp-workflow__eye-btn" data-action="toggle-password" title="Afficher/masquer">👁</button>
          </div>
        </div>
        <button type="button" class="btn btn--primary pp-workflow__test-btn" id="pp-test-key-btn"
                data-action="test-api-key" ${savedKey ? '' : 'disabled'}>
          Continuer →
        </button>
      </div>
    </div>
  `;
}

function renderModelSelectionStep() {
  const { displayed, total, freeCount, hasMore } = getDisplayModels(modelSearchQuery, showAllModels);
  const state = getWorkflowState();

  return `
    <div class="pp-workflow">
      <div class="pp-workflow__step">
        <div class="pp-workflow__step-title">📦 Modèles (${total}${freeCount > 0 ? `, ${freeCount} gratuits` : ''})</div>
        <input type="text" class="pp-workflow__search" id="pp-model-search"
               placeholder="Rechercher un modèle…" value="${escapeHtml(modelSearchQuery)}" />
        <div class="pp-workflow__model-list">
          ${displayed.length === 0
            ? '<div class="pp-workflow__empty">Aucun modèle trouvé</div>'
            : displayed.map(m => `
                <button type="button" class="pp-workflow__model-item ${m.id === state.selectedModelId ? 'is-active' : ''}"
                        data-model-id="${escapeHtml(m.id)}">
                  <span class="pp-workflow__model-name">${escapeHtml(m.name)}</span>
                  ${m.contextWindow ? `<span class="pp-workflow__model-cw">${m.contextWindow.toLocaleString()} tokens</span>` : ''}
                  ${m.isFree ? '<span class="pp-workflow__model-free">GRATUIT</span>' : ''}
                </button>
              `).join('')
          }
        </div>
        ${hasMore ? `
          <button type="button" class="pp-workflow__show-more" data-action="toggle-all-models">
            ${showAllModels ? 'Voir moins' : `Voir tous les modèles (${total})`}
          </button>
        ` : ''}
      </div>
    </div>
  `;
}

function renderValidatedStep() {
  const state = getWorkflowState();
  const current = getState().assistant.provider;
  const preset = current.id ? getPreset(current.id) : null;
  const model = state.loadedModels?.find(m => m.id === state.selectedModelId);

  return `
    <div class="pp-workflow">
      <div class="pp-workflow__step">
        <div class="pp-workflow__summary">
          <div class="pp-workflow__summary-title">✅ Connexion validée</div>
          <div class="pp-workflow__summary-row">
            <span class="pp-workflow__summary-label">Provider</span>
            <span class="pp-workflow__summary-value">${escapeHtml(preset?.name || '')}</span>
          </div>
          <div class="pp-workflow__summary-row">
            <span class="pp-workflow__summary-label">Modèle</span>
            <span class="pp-workflow__summary-value">${escapeHtml(model?.name || state.selectedModelId || '')}</span>
          </div>
          ${state.modelMeta ? `
            <div class="pp-workflow__summary-row">
              <span class="pp-workflow__summary-label">Latence</span>
              <span class="pp-workflow__summary-value">${state.modelMeta.latency}ms</span>
            </div>
            <div class="pp-workflow__summary-row">
              <span class="pp-workflow__summary-label">Format</span>
              <span class="pp-workflow__summary-value">${escapeHtml(state.modelMeta.format)}</span>
            </div>
          ` : ''}
        </div>
        <div class="pp-workflow__actions">
          <button type="button" class="btn btn--primary" data-action="save-config" title="Enregistrer cette configuration comme默认值">
            💾 Enregistrer
          </button>
          <button type="button" class="btn btn--secondary" data-action="edit-config" title="Modifier la configuration">
            ✏️ Modifier
          </button>
        </div>
      </div>
    </div>
  `;
}

// =========================================================================
// Event Listeners (delegation sur le body du panel)
// =========================================================================

function wireEventListeners(panelEl) {
  panelEl.addEventListener('click', (e) => {
    const target = e.target.closest('[data-action], [data-provider-id], [data-model-id]');
    if (!target) return;

    // Clic sur un provider (Zone 2)
    const providerId = target.dataset.providerId;
    if (providerId) {
      cancelWorkflow();
      modelSearchQuery = '';
      showAllModels = false;
      startWorkflow(providerId);
      return;
    }

    // Clic sur un modèle (Zone 3, étape 4)
    const modelId = target.dataset.modelId;
    if (modelId) {
      selectModel(modelId);
      return;
    }

    // Actions
    const action = target.dataset.action;
    switch (action) {
      case 'test-api-key': {
        const input = panelEl.querySelector('#pp-api-key');
        const apiKey = input?.value?.trim();
        if (apiKey) {
          const btn = panelEl.querySelector('#pp-test-key-btn');
          if (btn) { btn.disabled = true; btn.textContent = '⏳ Test…'; }
          testApiKey(apiKey).finally(() => render());
        }
        break;
      }
      case 'toggle-password': {
        const input = panelEl.querySelector('#pp-api-key');
        if (input) input.type = input.type === 'password' ? 'text' : 'password';
        break;
      }
      case 'toggle-all-models': {
        showAllModels = !showAllModels;
        const workflowEl = panelEl.querySelector('.pp-workflow');
        if (workflowEl) workflowEl.innerHTML = renderWorkflowZone();
        break;
      }
      case 'new-workflow': {
        cancelWorkflow();
        modelSearchQuery = '';
        showAllModels = false;
        render();
        break;
      }
      case 'edit-config': {
        // Revenir à l'étape de sélection de modèle (étape 4)
        const current2 = getState().assistant.provider;
        if (current2.id) {
          cancelWorkflow();
          modelSearchQuery = '';
          showAllModels = false;
          restartWorkflowFromStep4(current2.id);
        }
        break;
      }
      case 'save-config': {
        // SEUL point de persistance des configs provider
        // Tout le workflow (test clé, sélection modèle, validation) ne vit qu'en mémoire.
        const currentProvider = getState().assistant.provider;
        const currentPreset = currentProvider.id ? getPreset(currentProvider.id) : null;

        if (currentProvider.id) {
          // Exclure les champs sensibles/internes :
          //   apiKey  → reste dans .env (via envLoader)
          //   envKey  → dérivé du preset, pas besoin de le stocker
          //   modelMeta → éphémère (résultat du dernier test)
          const { modelMeta: _, apiKey: _k, envKey: _e, ...config } = currentProvider;

          // Écrire dans le fichier provider individuel (data/providers/{id}.json)
          setProviderConfig(currentProvider.id, config).then(ok => {
            if (ok) {
              // Sync in-memory cache
              const configs = getState().assistant.providerConfigs || {};
              configs[currentProvider.id] = config;
              getState().assistant.providerConfigs = configs;

              toast.success(`Configuration ${currentPreset?.name || currentProvider.id} enregistrée !`);
            } else {
              toast.error('Erreur lors de la sauvegarde');
            }
          });
        }
        break;
      }
      case 'open-keys-modal': {
        openApiKeysModal();
        break;
      }
      case 'clear-localstorage': {
        if (confirm('Effacer tout le localStorage et revenir à la config par défaut ?')) {
          localStorage.removeItem('code-city-assistant');
          localStorage.removeItem('code-city-theme');
          actions.resetProvider();
          toast.success('localStorage réinitialisé');
          closeProviderPanel();
          window.location.reload();
        }
        break;
      }
    }
  });

  // Input search — mise à jour ciblée de la Zone 3 sans re-render complet
  panelEl.addEventListener('input', (e) => {
    if (e.target.id === 'pp-model-search') {
      modelSearchQuery = e.target.value;
      const workflowEl = panelEl.querySelector('.pp-workflow');
      if (workflowEl) {
        workflowEl.innerHTML = renderWorkflowZone();
        const searchInput = panelEl.querySelector('#pp-model-search');
        if (searchInput) {
          searchInput.focus();
          searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
        }
      }
    }

    // Activer/désactiver le bouton si clé vide
    if (e.target.id === 'pp-api-key') {
      const btn = panelEl.querySelector('#pp-test-key-btn');
      if (btn) btn.disabled = !e.target.value.trim();
    }
  });
}