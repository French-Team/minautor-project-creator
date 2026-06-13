/**
 * Provider Panel — Panneau de configuration des providers IA (refonte spec)
 *
 * Layout 4 zones :
 *   Zone 1 — Status (sticky)        : provider actif, modèle, indicateur de connexion
 *   Zone 2 — Grid providers         : grille générée depuis providers-grid.json
 *   Zone 3 — Test & résultat        : workflow guidé 6 étapes (URL → Clé → Modèles → Sélection → Test → Validated)
 *   Zone 4 — PromptEngine & Optim.  : choix du provider de prep + optimiseur de réponse
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
import { getChatIcon } from '../chatIcons.js';
import { escapeHtml } from '../utils/html.js';
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
import { resolveContextWindow } from './modelContextResolver.js';

// --- State éphémère UI (pas dans le store) ---

// Ordre d'affichage des catégories de providers dans les dropdowns.
// Toute catégorie non listée tombe en fin de liste (alphabétique).
const PROVIDER_CATEGORY_ORDER = { online: 0, local: 1 };

// Formats supportés par l'optimiseur de réponse (promptEngine.optimizeResponse
// → chatCompletion). Tout format hors de cette liste (ex: 'gemini' qui utilise
// un endpoint non-standard) est exclu du dropdown prep pour éviter un échec
// d'appel d'optimisation silencieux.
const SUPPORTED_PREP_FORMATS = ['openai', 'anthropic'];

/**
 * Formate un nombre de tokens en notation compacte (4k, 128k, 1M).
 * Utilisé dans les tooltips et toasts pour rester lisible.
 * @param {number} tokens
 * @returns {string}
 */
function formatContextWindow(tokens) {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(0)}M tokens`;
  if (tokens >= 1_000) return `${Math.round(tokens / 1_000)}k tokens`;
  return `${tokens} tokens`;
}

let isOpen = false;
let modelSearchQuery = '';
let showAllModels = false;
// Auto-prompt dédupliqué : on évite de re-toster la même mismatch pour
// le même (providerId, actualSlots). Reset à chaque changement de provider.
const promptedMismatches = new Set();
let lastPromptedProviderId = null;
// Auto-reset dedup : on évite de re-toster la même incompatibilité CW pour
// la même paire (chatId, prepId). Reset à chaque changement de chat.
const incompatResetKeys = new Set();
let lastIncompatChatId = null;

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

    // Rafraîchir quand le provider, les stats d'optimisation, les slots ou
    // la config serveur (LM Studio / Ollama) changent
    subscribe((state, meta) => {
      // Reset du cache d'auto-prompt à chaque changement de provider
      if (meta.type === 'assistant:provider') {
        const newId = state.assistant?.provider?.id || null;
        if (newId !== lastPromptedProviderId) {
          promptedMismatches.clear();
          lastPromptedProviderId = newId;
        }
        // Reset du dedup d'auto-reset quand le chat change (la nouvelle
        // paire chat/prep peut être différente de la précédente)
        if (newId !== lastIncompatChatId) {
          incompatResetKeys.clear();
          lastIncompatChatId = newId;
        }

        // Auto-reset de preparationProviderId (PRÉPARATION/enhancement en entrée) :
        // on reset à null (="Même provider que le chat") si le format devient
        // incompatible. Pas de filtre CW ici : le prep a un besoin FAIBLE en
        // tokens (juste un prompt composé localement), un petit modèle rapide
        // est acceptable et même souhaitable. Seuls les formats non supportés
        // par l'optimiseur (ex: 'gemini') déclenchent le reset.
        // Gated sur isOpen : si le panneau est fermé, l'utilisateur ne voit
        // pas le re-render du dropdown — mais l'auto-reset doit quand même
        // avoir lieu pour éviter que la prochaine amélioration de prompt
        // échoue silencieusement.
        const newChat = state.assistant?.provider;
        const prepId = state.assistant?.preparationProviderId;
        if (newChat?.id && prepId) {
          const configs = state.assistant?.providerConfigs || {};
          const prepConfig = configs[prepId];
          const prepFormat = prepConfig?.format ?? prepConfig?.modelMeta?.format ?? null;

          if (prepFormat && !SUPPORTED_PREP_FORMATS.includes(prepFormat)) {
            const dedupKey = `${newChat.id}:prep:${prepId}:format`;
            if (!incompatResetKeys.has(dedupKey)) {
              incompatResetKeys.add(dedupKey);
              const chatPreset = getPreset(newChat.id);
              const prepPreset = getPreset(prepId);
              actions.setPreparationProvider(null);
              toast.warning(
                `Provider de prep "${prepPreset?.name || prepId}" : le format "${prepFormat}" n'est pas supporté ` +
                `par l'optimiseur (seuls OpenAI et Anthropic le sont). ` +
                `Incompatible avec le chat "${chatPreset?.name || newChat.id}". ` +
                `Reset à "Même provider que le chat".`,
                { duration: 7000 },
              );
            }
          }
        }

        // Auto-reset de optimizationProviderId (OPTIMISATION/condensation en sortie) :
        // on reset à null (="Utilise le provider de prep") si la CW devient
        // insuffisante OU si le format devient incompatible. L'optimiseur a
        // besoin d'une GRANDE fenêtre de contexte (doit contenir toute la
        // réponse du chat) — filtre CW strict (≥ chat CW), comme avant.
        // Indépendant du prep : le prep peut rester configuré même si
        // l'optimiseur est reset. Dedup key séparé.
        const optId = state.assistant?.optimizationProviderId;
        if (newChat?.id && optId) {
          const newChatCW = newChat.modelMeta?.contextWindow ?? null;
          const configs = state.assistant?.providerConfigs || {};
          const optConfig = configs[optId];
          const optCW = optConfig?.contextWindow ?? optConfig?.modelMeta?.contextWindow ?? null;
          const optFormat = optConfig?.format ?? optConfig?.modelMeta?.format ?? null;

          // Priorité : CW > format (l'échec CW est plus visible — troncature
          // silencieuse — que l'échec format — erreur d'API claire).
          let incompatReason = null;
          if (newChatCW && optCW && optCW < newChatCW) {
            incompatReason = 'cw';
          } else if (optFormat && !SUPPORTED_PREP_FORMATS.includes(optFormat)) {
            incompatReason = 'format';
          }

          if (incompatReason) {
            const dedupKey = `${newChat.id}:opt:${optId}:${incompatReason}`;
            if (!incompatResetKeys.has(dedupKey)) {
              incompatResetKeys.add(dedupKey);
              const chatPreset = getPreset(newChat.id);
              const optPreset = getPreset(optId);
              actions.setOptimizationProvider(null);
              const reasonText = incompatReason === 'cw'
                ? `fenêtre contexte ${formatContextWindow(optCW)} < ${formatContextWindow(newChatCW)}`
                : `le format "${optFormat}" n'est pas supporté par l'optimiseur (seuls OpenAI et Anthropic le sont)`;
              toast.warning(
                `Provider d'optimisation "${optPreset?.name || optId}" ${reasonText} ` +
                `incompatible avec le chat "${chatPreset?.name || newChat.id}". ` +
                `Reset à "Utilise le provider de prep".`,
                { duration: 7000 },
              );
            }
          }
        }
      }

      // Auto-prompt : quand serverConfig est mis à jour et qu'il y a un
      // mismatch (maxParallel ≠ actualSlots), on affiche UN toast d'invite
      // à cliquer "Sync à X". Dédoublonné par (providerId, actualSlots) pour
      // éviter le spam si l'event est ré-émis (ex: renderStatusZone multiples).
      // Gated sur isOpen : si le panneau est fermé, l'UI actionnable (bouton
      // clickable dans la Status zone) est invisible — le toast n'aurait
      // aucun moyen d'être actionné. On laisse l'indicateur persister pour
      // quand l'utilisateur rouvre le panneau.
      if (isOpen && meta.type === 'assistant:server-config') {
        const provider = state.assistant?.provider;
        const sc = meta.serverConfig;
        if (provider && sc && sc.actualSlots !== null && sc.actualSlots !== undefined) {
          const maxParallel = state.assistant?.maxParallel ?? 1;
          const actualSlots = sc.actualSlots;
          const key = `${provider.id}:${actualSlots}`;
          if (maxParallel !== actualSlots && !promptedMismatches.has(key)) {
            promptedMismatches.add(key);
            toast.warning(
              `Mismatch : ${maxParallel} slot${maxParallel > 1 ? 's' : ''} configuré${maxParallel > 1 ? 's' : ''}, ` +
              `${actualSlots} chargé${actualSlots > 1 ? 's' : ''} sur le serveur. ` +
              `Synchroniser ?`,
              { duration: 5000 },
            );
          }
        }
      }

      if (isOpen && (
        meta.type === 'assistant:provider' ||
        meta.type === 'assistant:optimization-stats' ||
        meta.type === 'assistant:max-parallel' ||
        meta.type === 'assistant:server-config' ||
        meta.type === 'assistant:preparation-provider'
      )) {
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

/**
 * Reset le cache d'auto-prompt mismatch (test-only).
 * Vide le Set des (providerId, actualSlots) déjà promptés et réinitialise
 * le tracker de dernier provider prompté. Utile pour les tests qui
 * doivent vérifier le comportement du dedup sans dépendre de l'ordre
 * d'exécution.
 * @internal
 */
export function _resetMismatchPromptCache() {
  promptedMismatches.clear();
  lastPromptedProviderId = null;
}

// --- DOM helpers ---

function applyOpenState(root, open) {
  root.classList.toggle('is-open', open);
  root.setAttribute('aria-hidden', open ? 'false' : 'true');
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
    ${renderPrepOptimizerZone()}
  `;
}

function renderHeaderActions() {
  return `
    <div class="pp-header-actions">
      <button type="button" class="pp-header-btn" data-action="open-keys-modal" title="Gérer les clés API">${getChatIcon('key', 14)}
        Clés API
      </button>
      <button type="button" class="pp-header-btn pp-header-btn--danger" data-action="clear-localstorage" title="Réinitialiser le state (dev)">${getChatIcon('trash', 14)}
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

  // Slots parallèles : affichés uniquement pour les providers locaux
  // (LM Studio, Ollama). La valeur vient du state (1 par défaut).
  const isLocal = preset?.category === 'local';
  const maxParallel = getState().assistant?.maxParallel ?? 1;
  // serverConfig : populé par workflowRunner après fetchModels (LM Studio / Ollama).
  // Contient le nombre de modèles chargés côté serveur (proxy du nombre de slots actifs).
  // Note : on évite le nom `loadedModels` (déjà destructuré de getWorkflowState()).
  const serverConfig = current.serverConfig || null;
  const actualSlots = serverConfig?.actualSlots ?? null;
  const loadedModelIds = serverConfig?.loadedModels || [];
  // Calcul du mismatch : 'match' | 'mismatch' | 'unknown'
  const slotStatus = (isLocal && actualSlots !== null)
    ? (maxParallel === actualSlots ? 'match' : 'mismatch')
    : 'unknown';

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
            <span class="pp-status__value pp-status__value--key">${getChatIcon('check', 12)} Configurée</span>
          </div>
        ` : ''}
        ${isLocal ? `
          <div class="pp-status__row" title="Nombre max de requêtes concurrentes envoyées au serveur. Doit correspondre au n_parallel configuré dans LM Studio (Developer → Server Settings).${actualSlots !== null ? ` ${loadedModelIds.length} modèle(s) actuellement chargé(s) côté serveur.` : ''}">
            <span class="pp-status__label">Slots</span>
            <span class="pp-status__value pp-status__value--${slotStatus}">
              ${maxParallel}${maxParallel > 1 ? ' en parallèle' : ' (séquentiel)'}
              ${actualSlots !== null ? `
                <button type="button" class="pp-status__slots-sync-btn pp-status__slots-sync-btn--${slotStatus}"
                        data-action="sync-max-parallel"
                        data-actual-slots="${actualSlots}"
                        title="Modèles chargés côté serveur : ${escapeHtml(loadedModelIds.join(', ') || 'aucun')}.${slotStatus === 'mismatch' ? ` Cliquer pour synchroniser maxParallel à ${actualSlots}.` : ''}">
                  ${slotStatus === 'match' ? '✓' : '⚠'} ${actualSlots} chargé${actualSlots > 1 ? 's' : ''} sur le serveur
                  ${slotStatus === 'mismatch' ? `<span class="pp-status__slots-sync-hint">→ Sync à ${actualSlots}</span>` : ''}
                </button>
              ` : ''}
            </span>
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
        <div class="pp-workflow__step-title">${escapeHtml(message)}</div>
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
        <div class="pp-workflow__step-title">${getChatIcon('key', 14)} Clé API</div>
        <p class="pp-workflow__hint">
          Entre ta clé API pour ce provider. Elle sera stockée dans le fichier <code>.env</code> à la racine du projet.
        </p>
        <div class="pp-workflow__field">
          <label class="pp-workflow__label" for="pp-api-key">Clé API</label>
          <div class="pp-workflow__input-group">
            <input type="password" class="pp-workflow__input" id="pp-api-key"
                   placeholder="sk-..." autocomplete="off"
                   value="${savedKey ? escapeHtml(savedKey) : ''}" />
            <button type="button" class="pp-workflow__eye-btn" data-action="toggle-password" title="Afficher/masquer">${getChatIcon('eye', 14)}</button>
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
        <div class="pp-workflow__step-title">${getChatIcon('package', 14)} Modèles (${total}${freeCount > 0 ? `, ${freeCount} gratuits` : ''})</div>
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
  const current = getState().assistant.provider;    const preset = current.id ? getPreset(current.id) : null;
  const model = state.loadedModels?.find(m => m.id === state.selectedModelId);
  // Slots parallèles : affichés uniquement pour les providers locaux (LM Studio, Ollama).
  // La valeur du preset sert de défaut visuel si l'utilisateur n'a rien sauvegardé.
  const isLocal = preset?.category === 'local';
  const maxParallel = isLocal ? (getState().assistant?.maxParallel ?? preset?.maxParallel ?? 1) : 1;

  return `
    <div class="pp-workflow">
      <div class="pp-workflow__step">
        <div class="pp-workflow__summary">
          <div class="pp-workflow__summary-title">${getChatIcon('check', 14)} Connexion validée</div>
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
        ${isLocal ? `
          <div class="pp-options__field" id="pp-max-parallel-field">
            <label class="pp-options__label" for="pp-max-parallel">
              Slots parallèles : <strong id="pp-max-parallel-value">${maxParallel}</strong> <span id="pp-max-parallel-suffix">${maxParallel > 1 ? 'requêtes simultanées' : '(séquentiel)'}</span>
            </label>
            <p class="pp-options__hint">Nombre max de requêtes concurrentes envoyées au serveur. Doit correspondre au <code>n_parallel</code> configuré dans LM Studio (Developer → Server Settings). Au-delà, le serveur sérialise les requêtes excédentaires.</p>
            <div class="pp-options__slider-wrap">
              <input type="range" id="pp-max-parallel" class="pp-options__slider"
                     min="1" max="8" step="1" value="${maxParallel}"
                     aria-labelledby="pp-max-parallel-value" />
              <div class="pp-options__slider-labels">
                <span>1</span>
                <span>4 (défaut LM Studio)</span>
                <span>8</span>
              </div>
            </div>
          </div>
        ` : ''}
        <div class="pp-workflow__actions">
          <button type="button" class="btn btn--primary" data-action="save-config" title="Enregistrer cette configuration">
            ${getChatIcon('save', 14)} Enregistrer
          </button>
          <button type="button" class="btn btn--secondary" data-action="edit-config" title="Modifier la configuration">
            ${getChatIcon('pencil', 14)} Modifier
          </button>
        </div>
      </div>
    </div>
  `;
}

// =========================================================================
// Zone 4 — PromptEngine & Optimiseur de réponse
// =========================================================================

/**
 * Rend la zone 4 : choix du provider pour le prompt-engine + optimiseur
 * de réponse (seuil d'optimisation + stats) + bouton d'enregistrement.
 *
 * Cette zone est TOUJOURS visible et TOUJOURS interactive, indépendante
 * du workflow de la zone 3. Elle délègue le rendu du dropdown à
 * `renderPrepProviderSelect()` (voir doc de cette fonction pour le détail
 * des options). Le slider de seuil d'optimisation est toujours visible
 * et éditable, indépendamment des stats. Les stats d'optimisation sont
 * affichées quand elles existent, sinon un hint muted les annonce
 * comme "à venir".
 *
 * Le bouton "Enregistrer" en bas de la zone persiste la config
 * prep/optimizer (preparationProviderId, preparationModel,
 * optimizationThreshold, maxParallel) dans le fichier qui stocke la
 * config par défaut du provider de chat (`data/providers/{chatId}.json`).
 * C'est le même fichier que celui écrit par le bouton "Enregistrer"
 * de la zone 3, mais accessible directement depuis la zone 4 sans
 * devoir passer par le workflow de validation du chat.
 *
 * @returns {string} HTML de la zone 4
 */
function renderPrepOptimizerZone() {
  const current = getState().assistant.provider;
  // Deux listes distinctes : le prep (enhancement) et l'optimiseur ont des
  // besoins opposés en CW. Le prep n'a pas de filtre CW, l'optimiseur oui.
  const eligiblePrepProviders = getEligiblePrepProviders(current, 'enhance');
  const eligibleOptimizerProviders = getEligiblePrepProviders(current, 'optimize');
  const optimizationThreshold = getState().assistant?.optimizationThreshold ?? 500;
  const optStats = getState().assistant?.optimizationStats || {};
  const hasStats = optStats.totalOptimized > 0;

  return `
    <div class="pp-prep-optimizer">
      <!-- Section 1 : Provider pour la PRÉPARATION de prompt (enhancement en entrée) -->
      <div class="pp-prep-optimizer__section">
        <h4 class="pp-prep-optimizer__section-title">${getChatIcon('zap', 12)} Provider pour le prompt-engine</h4>
        <p class="pp-prep-optimizer__subhint">Provider utilisé par le <strong>PromptEngine</strong> pour <em>améliorer</em> le prompt avant de l'envoyer au chat. Le prompt composé localement est petit — un petit modèle rapide/économique distinct du chat est souvent suffisant. Pas de filtre sur la fenêtre de contexte (la CW nécessaire est faible).</p>
        <div class="pp-options__field pp-options__field--prominent">
          ${renderPrepProviderSelect(eligiblePrepProviders)}
        </div>
      </div>

      <!-- Section 2 : Provider pour l'OPTIMISATION de réponse (condensation en sortie) -->
      <div class="pp-prep-optimizer__section">
        <h4 class="pp-prep-optimizer__section-title">${getChatIcon('settings', 12)} Provider pour l'optimisation de réponse</h4>
        <p class="pp-prep-optimizer__subhint">Provider utilisé par l'<strong>optimiseur de réponse</strong> pour <em>condenser</em> les réponses trop longues (au-dessus du seuil). Doit avoir une fenêtre de contexte <strong>≥ celle du chat</strong> pour pouvoir recevoir et condenser la réponse complète. Si non défini, retombe sur le provider de prep ci-dessus (puis le chat).</p>
        <div class="pp-options__field pp-options__field--prominent">
          ${renderOptimizationProviderSelect(eligibleOptimizerProviders)}
        </div>
      </div>

      <!-- Section 3 : Seuil d'optimisation + stats -->
      <div class="pp-prep-optimizer__section">
        <h4 class="pp-prep-optimizer__section-title">${getChatIcon('settings', 12)} Seuil d'optimisation</h4>
        <p class="pp-prep-optimizer__subhint">L'optimiseur condense automatiquement les réponses trop longues (au-dessus du seuil) pour économiser des tokens.</p>
        <div class="pp-options__field">
          <label class="pp-options__label" for="pp-opt-threshold">
            Seuil d'optimisation : <strong id="pp-opt-threshold-value">${optimizationThreshold}</strong> tokens
          </label>
          <div class="pp-options__slider-wrap">
            <input type="range" id="pp-opt-threshold" class="pp-options__slider"
                   min="100" max="2000" step="50" value="${optimizationThreshold}"
                   aria-labelledby="pp-opt-threshold-value" />
            <div class="pp-options__slider-labels">
              <span>100</span>
              <span>1 000</span>
              <span>2 000</span>
            </div>
          </div>
        </div>
        ${hasStats ? `
          <div class="pp-opt-stats">
            <div class="pp-opt-stats__title">${getChatIcon('bar-chart', 12)} Statistiques d'optimisation</div>
            <div class="pp-opt-stats__grid">
              <div class="pp-opt-stats__item">
                <span class="pp-opt-stats__value">${optStats.totalOptimized}</span>
                <span class="pp-opt-stats__label">optimisé${optStats.totalOptimized > 1 ? 's' : ''}</span>
              </div>
              <div class="pp-opt-stats__item">
                <span class="pp-opt-stats__value">${optStats.totalTokensSaved.toLocaleString('fr-FR')}</span>
                <span class="pp-opt-stats__label">tokens économisés</span>
              </div>
              <div class="pp-opt-stats__item">
                <span class="pp-opt-stats__value">${optStats.averageCompression}%</span>
                <span class="pp-opt-stats__label">taux de compression</span>
              </div>
            </div>
          </div>
        ` : `
          <p class="pp-options__hint pp-options__hint--muted">
            ${getChatIcon('info', 12)} Aucune optimisation effectuée pour l'instant. Les stats apparaîtront après la première réponse condensée.
          </p>
        `}
      </div>

      <!-- Actions : sauvegarde de la config prep/optimizer dans le fichier du provider de chat -->
      <div class="pp-prep-optimizer__actions">
        <button type="button" class="btn btn--primary pp-prep-optimizer__save-btn"
                data-action="save-prep-config"
                title="Enregistrer la configuration prep/optimizer dans le fichier du provider de chat">
          ${getChatIcon('save', 14)} Enregistrer
        </button>
      </div>
    </div>
  `;
}

/**
 * Liste les providers éligibles comme provider de préparation : configurés,
 * avec un modèle défini, et différents du provider de chat courant.
 * Tri : online d'abord, puis local, puis toute autre catégorie (alphabétique).
 * Source unique de vérité utilisée par renderPrepOptimizerZone() et
 * renderPrepProviderSelect() pour éviter la duplication de la logique de filtrage.
 *
 * **Deux modes** (les deux rôles du prep ont des besoins opposés) :
 *   - `mode='enhance'` (défaut) : pas de filtre CW. Ce provider est utilisé
 *     par `_enhancePromptViaApi()` qui prend un prompt composé localement
 *     (souvent petit) et l'améliore. Un petit modèle local rapide suffit.
 *   - `mode='optimize'` : filtre CW strict (prep.contextWindow ≥ chat.contextWindow).
 *     Ce provider est utilisé par `optimizeResponse()` qui doit recevoir la
 *     réponse complète du chat pour la condenser. Si le prep a une CW
 *     insuffisante, la condensation tronque ou échoue silencieusement.
 *
 * **Compatibilité format (filtre strict, les deux modes)** : un prep provider
 * est éligible seulement si son format fait partie de `SUPPORTED_PREP_FORMATS`.
 * Les formats non supportés (ex: Gemini qui utilise un endpoint propriétaire)
 * sont exclus car l'optimiseur (promptEngine.optimizeResponse) appelle
 * chatCompletion() qui ne gère que les formats OpenAI et Anthropic. Si le
 * format est inconnu (model pas testé), on est permissif.
 *
 * Si l'une des deux fenêtres est inconnue (model pas encore testé), on est
 * permissif (le candidat reste éligible) — l'utilisateur a la chance de
 * re-tester pour activer le filtre.
 *
 * @param {Object} current - Le provider actif (state.assistant.provider)
 * @param {('enhance'|'optimize')} [mode='enhance'] - Le rôle ciblé
 * @returns {Array<{id: string, model: string, name: string, category: string, contextWindow: number|null, format: string|null}>}
 */
function getEligiblePrepProviders(current, mode = 'enhance') {
  const configs = getState().assistant.providerConfigs || {};
  const currentProviderId = current.id;
  // Fenêtre de contexte du chat — si le model n'a pas encore été testé
  // (modelMeta absent), on retombe sur le resolver cascade (provider default)
  // pour garantir que le filtre reste strict dès le premier chargement.
  // Sans ce fallback, le filtre mode='optimize' est SILENCIEUX et PERMISSIF
  // quand chat CW est null → l'utilisateur voit passer des providers
  // largement sous-dimensionnés (ex: gemma-4 4096 vs Gemini 1M).
  const chatContextWindow = current.modelMeta?.contextWindow
    ?? resolveContextWindow({
      modelId: current.model,
      providerId: current.id,
      apiValue: null,
    });

  const candidates = Object.entries(configs)
    .filter(([id, cfg]) => cfg && cfg.model && id !== currentProviderId)
    .map(([id, cfg]) => {
      const preset = getPreset(id);
      // Le prep candidate peut avoir son contextWindow / format soit au
      // top-level (extrait de modelMeta lors de la sauvegarde) soit dans
      // modelMeta directement (cas éphémère, avant save/reload).
      // Si aucun des deux n'est connu (model pas encore testé), on passe par
      // le resolver cascade (table de référence + provider default) au lieu
      // d'être permissif. Garantit que le filtre CW fonctionne dès le premier
      // chargement, sans avoir à tester chaque modèle.
      const savedCw = cfg.contextWindow ?? cfg.modelMeta?.contextWindow ?? null;
      const prepContextWindow = savedCw ?? resolveContextWindow({
        modelId: cfg.model,
        providerId: id,
        apiValue: null,
      });
      const prepFormat = cfg.format ?? cfg.modelMeta?.format ?? null;
      return {
        id,
        model: cfg.model,
        name: preset?.name || id,
        category: preset?.category || 'online',
        contextWindow: prepContextWindow,
        format: prepFormat,
      };
    })
    .filter((c) => {
      // Règle 1 (mode='optimize' uniquement) : prep.contextWindow >= chat.contextWindow
      // Pour l'enhancement (mode='enhance'), pas de filtre CW : le prompt
      // composé est typiquement petit, un petit modèle local suffit.
      if (mode === 'optimize' && chatContextWindow && c.contextWindow && c.contextWindow < chatContextWindow) {
        return false;
      }
      // Règle 2 (les deux modes) : prep.format doit être supporté par l'optimiseur
      if (c.format && !SUPPORTED_PREP_FORMATS.includes(c.format)) {
        return false;
      }
      return true;
    });
  candidates.sort((a, b) => {
    const oa = PROVIDER_CATEGORY_ORDER[a.category] ?? 2;
    const ob = PROVIDER_CATEGORY_ORDER[b.category] ?? 2;
    return oa !== ob ? oa - ob : a.name.localeCompare(b.name);
  });
  return candidates;
}

/**
 * Rend le <select> provider de préparation (sans wrapper, sans label).
 * L'option "Même provider que le chat" est toujours présente en première
 * position : c'est le défaut fonctionnel (provider de chat utilisé pour
 * la prep). Les autres options sont les providers éligibles (configurés
 * et ≠ du chat courant), triés par catégorie.
 *
 * @param {Array} eligibleProviders - Liste des providers éligibles
 *   (pré-calculée par getEligiblePrepProviders() avec mode='enhance')
 * @returns {string} HTML du <select>
 */
function renderPrepProviderSelect(eligibleProviders) {
  const prepProviderId = getState().assistant.preparationProviderId;
  return `
    <select id="pp-prep-provider" class="pp-options__select">
      <option value="" ${!prepProviderId ? 'selected' : ''}>— Même provider que le chat (${escapeHtml(getState().assistant.provider.model || '—')})</option>
      ${eligibleProviders.map(c => `
        <option value="${escapeHtml(c.id)}" ${prepProviderId === c.id ? 'selected' : ''}>
          ${escapeHtml(c.name)} → ${escapeHtml(c.model)}
        </option>
      `).join('')}
    </select>
  `;
}

/**
 * Rend le <select> provider d'optimisation de réponse (sans wrapper, sans label).
 * L'option "— Utilise le provider de prep" est l'option par défaut : quand
 * optimizationProviderId === null, resolveOptimizationProvider() retombe sur
 * resolvePreparationProvider() (rétro-compatible). Les autres options sont
 * les providers éligibles (configurés et ≠ du chat courant, avec CW ≥ chat
 * CW — filtre strict appliqué par getEligiblePrepProviders mode='optimize'),
 * triés par catégorie.
 *
 * @param {Array} eligibleProviders - Liste des providers éligibles
 *   (pré-calculée par getEligiblePrepProviders() avec mode='optimize')
 * @returns {string} HTML du <select>
 */
function renderOptimizationProviderSelect(eligibleProviders) {
  const optProviderId = getState().assistant.optimizationProviderId;
  const prepProviderId = getState().assistant.preparationProviderId;
  const prepProviderName = prepProviderId
    ? (getPreset(prepProviderId)?.name || prepProviderId)
    : 'le chat';
  return `
    <select id="pp-opt-provider" class="pp-options__select">
      <option value="" ${!optProviderId ? 'selected' : ''}>— Utilise le provider de prep (${escapeHtml(prepProviderName)})</option>
      ${eligibleProviders.map(c => `
        <option value="${escapeHtml(c.id)}" ${optProviderId === c.id ? 'selected' : ''}>
          ${escapeHtml(c.name)} → ${escapeHtml(c.model)}${c.contextWindow ? ` (${formatContextWindow(c.contextWindow)})` : ''}
        </option>
      `).join('')}
    </select>
  `;
}

// =========================================================================
// Event Listeners (delegation sur le body du panel)
// =========================================================================

/**
 * Persiste la config du provider courant dans son fichier
 * (`data/providers/{id}.json`) et synchronise le cache in-memory.
 * Source unique de vérité utilisée par les boutons "Enregistrer" de la
 * zone 3 (save-config) et de la zone 4 (save-prep-config).
 *
 * Exclut les champs sensibles/éphémères :
 *   - apiKey        → reste dans .env (via envLoader)
 *   - envKey        → dérivé du preset, pas besoin de le stocker
 *   - modelMeta     → éphémère (résultat du dernier test)
 *   - serverConfig  → éphémère (chargé depuis le serveur, change à chaque session)
 *
 * Ajoute les champs de configuration prep/optimizer + maxParallel.
 *
 * @param {Object} currentProvider - state.assistant.provider
 * @param {Object} [opts]
 * @param {string} [opts.successMessage] - Message du toast de succès
 * @returns {void}
 */
function persistProviderConfig(currentProvider, { successMessage = 'Configuration enregistrée' } = {}) {
  const { modelMeta: _, apiKey: _k, envKey: _e, serverConfig: _s, ...config } = currentProvider;
  // Extraire contextWindow + format du modelMeta éphémère AVANT de le
  // stripper, pour qu'ils soient disponibles dans providerConfigs[id]
  // même après reload. Sinon, les filtres de compatibilité CW + format
  // (chat vs prep) ne pourraient pas comparer les providers sauvegardés.
  if (currentProvider.modelMeta?.contextWindow) {
    config.contextWindow = currentProvider.modelMeta.contextWindow;
  }
  if (currentProvider.modelMeta?.format) {
    config.format = currentProvider.modelMeta.format;
  }
  config.optimizationThreshold = getState().assistant?.optimizationThreshold ?? 500;
  config.preparationModel = getState().assistant?.preparationModel || null;
  config.preparationProviderId = getState().assistant?.preparationProviderId || null;
  config.optimizationProviderId = getState().assistant?.optimizationProviderId || null;
  config.maxParallel = getState().assistant?.maxParallel ?? 1;

  setProviderConfig(currentProvider.id, config).then((ok) => {
    if (ok) {
      const configs = getState().assistant.providerConfigs || {};
      configs[currentProvider.id] = config;
      getState().assistant.providerConfigs = configs;
      toast.success(successMessage);
    } else {
      toast.error('Erreur lors de la sauvegarde');
    }
  });
}

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
          if (btn) { btn.disabled = true; btn.textContent = 'Test…'; }
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
      case 'sync-max-parallel': {
        // One-click sync depuis la Status zone : aligne maxParallel sur
        // le nombre de modèles chargés sur le serveur LM Studio. L'utilisateur
        // n'a pas besoin d'ouvrir les Options avancées pour corriger.
        const actual = Number(target.dataset.actualSlots);
        if (Number.isFinite(actual) && actual >= 1) {
          actions.setMaxParallel(actual);
          // Feedback visuel : flasher brièvement le slider dans les Options
          // avancées pour que l'utilisateur voie que la valeur a changé,
          // même s'il regardait l'Options panel et pas la Status zone.
          // On attend un tick pour laisser le DOM se mettre à jour après
          // le re-render déclenché par setMaxParallel().
          requestAnimationFrame(() => {
            const sliderField = panelEl.querySelector('#pp-max-parallel-field');
            if (sliderField) {
              sliderField.classList.remove('pp-options__field--flash');
              // Force reflow pour ré-déclencher l'animation si déjà présente
              // eslint-disable-next-line no-unused-expressions
              sliderField.offsetWidth;
              sliderField.classList.add('pp-options__field--flash');
            }
          });
          toast.success(`Slots parallèles synchronisés sur ${actual}`);
        }
        break;
      }
      case 'save-config': {
        // SEUL point de persistance des configs provider
        // Tout le workflow (test clé, sélection modèle, validation) ne vit qu'en mémoire.
        const currentProvider = getState().assistant.provider;
        const currentPreset = currentProvider.id ? getPreset(currentProvider.id) : null;

        if (currentProvider.id) {
          persistProviderConfig(currentProvider, {
            successMessage: `Configuration ${currentPreset?.name || currentProvider.id} enregistrée !`,
          });
        }
        break;
      }
      case 'save-prep-config': {
        // Sauvegarde ciblée de la config prep/optimizer (Zone 4) dans le
        // fichier qui stocke la config par défaut du provider de chat
        // (data/providers/{chatId}.json). Accessible directement depuis
        // Zone 4 sans devoir passer par le workflow Zone 3.
        const currentProvider = getState().assistant.provider;
        if (currentProvider.id) {
          persistProviderConfig(currentProvider, {
            successMessage: 'Configuration prep/optimizer enregistrée',
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

    // Slider seuil d'optimisation — mettre à jour l'affichage et le state en direct
    if (e.target.id === 'pp-opt-threshold') {
      const value = Number(e.target.value);
      const display = panelEl.querySelector('#pp-opt-threshold-value');
      if (display) display.textContent = value;
      actions.setOptimizationThreshold(value);
    }

    // Slider slots parallèles (LM Studio) — mise à jour live du state
    if (e.target.id === 'pp-max-parallel') {
      const value = Number(e.target.value);
      const display = panelEl.querySelector('#pp-max-parallel-value');
      const suffix = panelEl.querySelector('#pp-max-parallel-suffix');
      if (display) display.textContent = value;
      if (suffix) suffix.textContent = value > 1 ? 'requêtes simultanées' : '(séquentiel)';
      actions.setMaxParallel(value);
    }

  });

  // Change event pour les selects de providers (change ≠ input pour <select>)
  panelEl.addEventListener('change', (e) => {
    if (e.target.id === 'pp-prep-provider') {
      actions.setPreparationProvider(e.target.value || null);
    }
    if (e.target.id === 'pp-opt-provider') {
      actions.setOptimizationProvider(e.target.value || null);
    }
  });
}