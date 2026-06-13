/**
 * API Keys Modal — Gestion multi-clé des clés API
 *
 * Les clés sont stockées dans le fichier .env à la racine du projet.
 * Chaque provider peut avoir plusieurs clés (base + _1, _2, etc.)
 * pour la rotation LRU lors de rate limits (429).
 *
 * @module apiKeysModal
 */

import { getAllPresets, getPresetsByCategory } from './providerLoader.js';
import validationModels from '../data/validation-models.json';
import { loadEnvKeys, getCachedEnv, getAllKeysForEnvKey, invalidateCache } from './envLoader.js';
import { toast } from './toast.js';
import { chatCompletion } from './aiClient.js';
import { getState, actions } from '../state.js';
import { getChatIcon } from '../chatIcons.js';
import { escapeHtml } from '../utils/html.js';

let modalEl = null;
let navigationInterceptor = null;

// Empêche la navigation pendant que la modal est ouverte
function activateNavigationGuard() {
  if (navigationInterceptor) return;
  
  // Intercepter les événements qui pourraient causer un refresh
  const preventNav = (e) => {
    if (modalEl) {
      e.preventDefault();
      e.stopImmediatePropagation();
      console.warn('[apiKeysModal] Navigation bloquée pendant la modal');
      return false;
    }
  };
  
  // NOTE: On n'intercepte plus beforeunload car preventDefault() sur beforeunload
  // affiche le popup "Actualiser le site web ?" du navigateur, ce qui est perturbant.
  // Le vrai cause du refresh semble être une extension externe (cf. "webclient-infield.html" dans Network).
  
  // Bloquer popstate (changements d'historique)
  window.addEventListener('popstate', preventNav, true);
  // Bloquer submit de formulaire
  document.addEventListener('submit', preventNav, true);
  
  navigationInterceptor = preventNav;
}

function deactivateNavigationGuard() {
  if (!navigationInterceptor) return;
  
  window.removeEventListener('popstate', navigationInterceptor, true);
  document.removeEventListener('submit', navigationInterceptor, true);
  
  navigationInterceptor = null;
}

// --- Helpers ---

function maskKey(key) {
  if (!key) return '';
  if (key.length <= 8) return '••••••••';
  return key.slice(0, 4) + '•'.repeat(Math.min(key.length - 8, 20)) + key.slice(-4);
}

function getProviderName(providerId) {
  const preset = getAllPresets().find((p) => p.id === providerId);
  return preset?.name || providerId;
}

function getProviderEnvKey(providerId) {
  const preset = getAllPresets().find((p) => p.id === providerId);
  return preset?.envKey || null;
}

// --- API .env ---

async function apiEnvGetKeys(baseEnvKey) {
  const resp = await fetch('/api/env', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'getKeys', baseEnvKey }),
  });
  if (!resp.ok) throw new Error(await resp.text());
  return resp.json();
}

async function apiEnvAddKey(baseEnvKey, value) {
  const resp = await fetch('/api/env', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'addKey', baseEnvKey, value }),
  });
  if (!resp.ok) throw new Error(await resp.text());
  return resp.json();
}

async function apiEnvDeleteKey(key) {
  const resp = await fetch('/api/env', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'deleteKey', key }),
  });
  if (!resp.ok) throw new Error(await resp.text());
  return resp.json();
}

async function apiEnvSetKey(key, value) {
  const resp = await fetch('/api/env', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'setKey', key, value }),
  });
  if (!resp.ok) throw new Error(await resp.text());
  return resp.json();
}

// --- Modal ---

export async function openApiKeysModal() {
  if (modalEl) return;

  // Activer la protection contre la navigation
  activateNavigationGuard();

  // Charger les clés avant d'afficher la modal
  let keysHtml;
  try {
    await loadEnvKeys();
    keysHtml = await renderKeysList();
  } catch (e) {
    keysHtml = '<div class="api-keys-modal__error">Erreur lors du chargement des clés API</div>';
  }

  modalEl = document.createElement('div');
  modalEl.className = 'api-keys-modal is-open';
  modalEl.setAttribute('role', 'dialog');
  modalEl.setAttribute('aria-modal', 'true');
  modalEl.setAttribute('aria-labelledby', 'api-keys-modal-title');

  modalEl.innerHTML = `
    <div class="api-keys-modal__backdrop"></div>
    <div class="api-keys-modal__dialog">
      <header class="api-keys-modal__header">
        <h2 id="api-keys-modal-title" class="api-keys-modal__title">${getChatIcon('key', 16)} Gestion des clés API</h2>
        <div class="api-keys-modal__header-actions">
          <span class="api-keys-modal__rotation-badge" title="Rotation LRU automatique">${getChatIcon('refresh', 12)}
            Rotation LRU
          </span>
          <button type="button" class="api-keys-modal__icon-btn" data-action="export-keys" title="Exporter les clés en JSON">${getChatIcon('download', 14)}</button>
          <button type="button" class="api-keys-modal__close" aria-label="Fermer">${getChatIcon('x', 16)}</button>
        </div>
      </header>
      <div class="api-keys-modal__body">
        ${keysHtml}
        <div class="api-keys-modal__actions">
          <button type="button" class="btn btn--primary api-keys-modal__add-btn" data-action="add-key">${getChatIcon('plus', 14)}
            Ajouter une clé API
          </button>
          ${renderEnvInfo()}
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modalEl);

  modalEl.querySelector('.api-keys-modal__backdrop').addEventListener('click', closeModal);
  modalEl.querySelector('.api-keys-modal__close').addEventListener('click', closeModal);
  modalEl.addEventListener('click', handleModalClick);
  document.addEventListener('keydown', handleEscape);

  requestAnimationFrame(() => {
    const firstFocusable = modalEl.querySelector('button, input, select');
    if (firstFocusable) firstFocusable.focus();
  });
}

function closeModal() {
  if (!modalEl) return;
  modalEl.classList.remove('is-open');
  modalEl.addEventListener('animationend', () => {
    modalEl?.remove();
    modalEl = null;
    deactivateNavigationGuard();
  }, { once: true });
  setTimeout(() => {
    if (modalEl) {
      modalEl.remove();
      modalEl = null;
    }
    deactivateNavigationGuard();
  }, 300);
  document.removeEventListener('keydown', handleEscape);
}

function handleEscape(e) {
  if (e.key === 'Escape') closeModal();
}

// --- Render ---

function renderEnvInfo() {
  return `
    <div class="api-keys-modal__env-info">${getChatIcon('info', 12)}
      Les clés sont stockées dans <code>.env</code>. Plusieurs clés = rotation LRU automatique.
    </div>
  `;
}

async function renderKeysList() {
  // Charger les clés depuis le serveur
  let envKeys = {};
  try {
    await loadEnvKeys();
    envKeys = getCachedEnv() || {};
  } catch (e) {
    // Si le serveur n'est pas joignable, utiliser le cache local
  }

  const onlineProviders = getPresetsByCategory('online').filter(p => p.authRequired && p.envKey);
  
  // Pour chaque provider, récupérer toutes ses clés
  const providerData = onlineProviders.map(p => {
    const allKeys = getAllKeysForEnvKey(p.envKey);
    return {
      name: p.name,
      providerId: p.id,
      envKey: p.envKey,
      keys: allKeys,
      hasKeys: allKeys.length > 0,
    };
  }).filter(k => k.hasKeys);

  if (providerData.length === 0) {
    return `
      <div class="api-keys-modal__empty">
        <div class="api-keys-modal__empty-icon">${getChatIcon('lock', 32)}</div>
        <div class="api-keys-modal__empty-text">Aucune clé API enregistrée.</div>
        <div class="api-keys-modal__empty-hint">Ajoute une clé pour l'utiliser avec tes providers. Plusieurs clés = rotation automatique.</div>
      </div>
    `;
  }

  return `
    <div class="api-keys-modal__list">
      ${providerData.map(p => renderProviderItem(p)).join('')}
    </div>
  `;
}

function renderProviderItem(provider) {
  const keyCount = provider.keys.length;
  const countLabel = keyCount === 1 ? '1 clé' : `${keyCount} clés`;
  
  return `
    <div class="api-keys-modal__provider" data-env-key="${provider.envKey}">
      <div class="api-keys-modal__provider-header">
        <div class="api-keys-modal__provider-info">
          <span class="api-keys-modal__provider-name">${escapeHtml(provider.name)}</span>
          <span class="api-keys-modal__provider-key-name">${escapeHtml(provider.envKey)}</span>
        </div>
        <div class="api-keys-modal__provider-meta">
          <span class="api-keys-modal__key-count" title="Rotation LRU">${countLabel}</span>
          ${keyCount > 1 ? `<span class="api-keys-modal__rotation-indicator" title="Rotation activée">${getChatIcon('refresh-cw', 12)}</span>` : ''}
          <button type="button" class="api-keys-modal__add-key-btn" data-action="add-key-for-provider" data-env-key="${provider.envKey}" title="Ajouter une autre clé">${getChatIcon('plus', 12)}</button>
        </div>
      </div>
      <div class="api-keys-modal__keys-list">
        ${provider.keys.map((k, idx) => renderKeyItem(provider.envKey, k, idx)).join('')}
      </div>
    </div>
  `;
}

function renderKeyItem(baseEnvKey, keyInfo, displayIndex) {
  const isBase = keyInfo.index === 0;
  const suffixLabel = isBase ? '' : ` #${keyInfo.index}`;
  const rotationClass = isBase ? '' : ' api-keys-modal__key-item--secondary';
  
  return `
    <div class="api-keys-modal__key-item${rotationClass}" data-key="${keyInfo.key}" data-index="${keyInfo.index}">
      <div class="api-keys-modal__key-badge">${isBase ? 'Base' : `#${keyInfo.index}`}</div>
      <div class="api-keys-modal__key-value">
        <code>${escapeHtml(maskKey(keyInfo.value))}</code>
      </div>
      <div class="api-keys-modal__key-actions">
        <button type="button" class="api-keys-modal__action-btn" data-action="view-key" data-key="${keyInfo.key}" title="Voir la clé complète">${getChatIcon('eye', 14)}</button>
        <button type="button" class="api-keys-modal__action-btn api-keys-modal__action-btn--danger" data-action="delete-key" data-key="${keyInfo.key}" title="Supprimer cette clé">${getChatIcon('trash', 14)}</button>
      </div>
    </div>
  `;
}

// --- Event handlers ---

function handleModalClick(e) {
  // Empêcher tout comportement par défaut (comme la soumission de formulaire)
  e.preventDefault();
  
  const actionEl = e.target.closest('[data-action]');
  if (!actionEl) return;

  const action = actionEl.dataset.action;
  const envKey = actionEl.dataset.envKey;
  const key = actionEl.dataset.key;

  switch (action) {
    case 'add-key':
      showAddKeyForm(null);
      break;
    case 'add-key-for-provider':
      showAddKeyForm(envKey);
      break;
    case 'view-key':
      viewKey(key);
      break;
    case 'delete-key':
      deleteKey(key);
      break;
    case 'save-key':
      saveKey(e);
      return false;
    case 'cancel-form':
      refreshModal();
      break;
    case 'export-keys':
      exportKeys();
      break;
    case 'copy-key':
      copyKey(actionEl.dataset.keyValue);
      break;
  }
}

function showAddKeyForm(preSelectedEnvKey) {
  const body = modalEl.querySelector('.api-keys-modal__body');
  const onlineProviders = getPresetsByCategory('online').filter(p => p.authRequired && p.envKey);

  const selectedEnvKey = preSelectedEnvKey || onlineProviders[0]?.envKey || '';
  
  // Récupérer le nombre de clés existantes pour ce provider
  const existingKeys = getAllKeysForEnvKey(selectedEnvKey);
  const nextIndex = existingKeys.length; // Prochaine clé = _1, _2, etc.
  const isAdditionalKey = existingKeys.length > 0;

  // Construire le hint pour la clé additionnelle
  let hintHtml = '';
  if (isAdditionalKey) {
    const suffix = nextIndex === 0 ? 1 : nextIndex;
    const newKeyName = `${selectedEnvKey}_${suffix}`;
    hintHtml = `
      <div class="api-keys-modal__form-hint">
        <span class="api-keys-modal__hint-icon">${getChatIcon('refresh-cw', 14)}</span>
        Rotation LRU : cette clé sera la <strong>clé #${existingKeys.length + 1}</strong> pour ce provider.
        <br/>Sera enregistrée comme <code>${newKeyName}</code>
      </div>
    `;
  } else {
    hintHtml = `
      <div class="api-keys-modal__form-hint">
        <span class="api-keys-modal__hint-icon">${getChatIcon('file-edit', 14)}</span>
        Première clé pour ce provider. Ajoute d'autres clés ensuite pour activer la rotation LRU.
      </div>
    `;
  }

  body.innerHTML = `
    <div class="api-keys-modal__form">
      ${hintHtml}
      <div class="api-keys-modal__field">
        <label class="api-keys-modal__label" for="api-key-provider">Provider</label>
        <select class="api-keys-modal__select" id="api-key-provider">
          ${onlineProviders.map((p) => {
            const keyCount = getAllKeysForEnvKey(p.envKey).length;
            const countLabel = keyCount > 0 ? ` (${keyCount} clé${keyCount > 1 ? 's' : ''})` : '';
            return `<option value="${p.envKey}" ${p.envKey === selectedEnvKey ? 'selected' : ''}>${escapeHtml(p.name)}${countLabel}</option>`;
          }).join('')}
        </select>
      </div>
      <div class="api-keys-modal__field">
        <label class="api-keys-modal__label" for="api-key-value">Clé API</label>
        <input type="password" class="api-keys-modal__input" id="api-key-value" placeholder="sk-..." autocomplete="off" />
      </div>
      <div class="api-keys-modal__form-actions">
        <button type="button" class="btn" data-action="cancel-form">Annuler</button>
        <button type="button" class="btn btn--primary" data-action="save-key">Sauvegarder dans .env</button>
      </div>
    </div>
  `;

  // Listener pour mettre à jour le hint quand le provider change
  const providerSelect = body.querySelector('#api-key-provider');
  providerSelect.addEventListener('change', () => {
    const newEnvKey = providerSelect.value;
    const keys = getAllKeysForEnvKey(newEnvKey);
    const nextIdx = keys.length;
    const isAdditional = keys.length > 0;
    const newKeyName = isAdditional ? `${newEnvKey}_${nextIdx === 0 ? 1 : nextIdx}` : newEnvKey;
    
    const hintEl = body.querySelector('.api-keys-modal__form-hint');
    if (hintEl) {
      if (isAdditional) {
        hintEl.innerHTML = `
          <span class="api-keys-modal__hint-icon">${getChatIcon('refresh-cw', 14)}</span>
          Rotation LRU : cette clé sera la <strong>clé #${keys.length + 1}</strong> pour ce provider.
          <br/>Sera enregistrée comme <code>${newKeyName}</code>
        `;
      } else {
        hintEl.innerHTML = `
          <span class="api-keys-modal__hint-icon">${getChatIcon('file-edit', 14)}</span>
          Première clé pour ce provider. Ajoute d'autres clés ensuite pour activer la rotation LRU.
        `;
      }
    }
  });
}

async function viewKey(key) {
  const body = modalEl.querySelector('.api-keys-modal__body');
  const envKeys = getCachedEnv() || {};
  const value = envKeys[key] || '';

  // Trouver le provider associé
  const provider = getAllPresets().find(p => {
    const keys = getAllKeysForEnvKey(p.envKey);
    return keys.some(k => k.key === key);
  });

  body.innerHTML = `
    <div class="api-keys-modal__form">
      <div class="api-keys-modal__field">
        <label class="api-keys-modal__label">Provider</label>
        <div class="api-keys-modal__readonly">${escapeHtml(provider?.name || 'Inconnu')}</div>
      </div>
      <div class="api-keys-modal__field">
        <label class="api-keys-modal__label">Variable .env</label>
        <div class="api-keys-modal__readonly"><code>${escapeHtml(key)}</code></div>
      </div>
      <div class="api-keys-modal__field">
        <label class="api-keys-modal__label">Clé API</label>
        <div class="api-keys-modal__readonly api-keys-modal__readonly--key">
          <code>${escapeHtml(value)}</code>
          ${value ? `
          <button type="button" class="api-keys-modal__copy-btn" data-action="copy-key" data-key-value="${escapeHtml(value)}" title="Copier">${getChatIcon('copy', 12)}</button>
          ` : ''}
        </div>
      </div>
      <div class="api-keys-modal__form-actions">
        <button type="button" class="btn" data-action="cancel-form">Retour</button>
      </div>
    </div>
  `;
}

function copyKey(value) {
  navigator.clipboard.writeText(value).then(() => {
    toast.success('Clé copiée dans le presse-papier');
  }).catch(() => {
    toast.error('Impossible de copier la clé');
  });
}

async function saveKey(event) {
  // Empêcher tout comportement par défaut
  if (event) event.preventDefault();
  
  const envKey = modalEl.querySelector('#api-key-provider')?.value;
  const value = modalEl.querySelector('#api-key-value')?.value?.trim();

  if (!value) {
    toast.warning('La valeur de la clé est requise');
    return;
  }
  if (!envKey) {
    toast.warning('Sélectionne un provider');
    return;
  }

  // Afficher un état de chargement pour indiquer le test en cours
  const saveBtn = modalEl.querySelector('[data-action="save-key"]');
  const originalText = saveBtn.textContent;
  saveBtn.textContent = 'Test en cours...';
  saveBtn.disabled = true;

  try {
    // Trouver le provider correspondant à cet envKey
    const providerPreset = getAllPresets().find(p => p.envKey === envKey);
    if (!providerPreset) {
      toast.error('Provider non trouvé pour cet envKey');
      return;
    }

    // Construire un provider temporaire pour tester la clé
    const testProvider = {
      id: providerPreset.id,
      baseUrl: providerPreset.baseUrl || '',
      model: validationModels.validationModels[providerPreset.id] ?? '',
      apiKey: value,
      envKey: envKey,
      temperature: 0.7,
      maxTokens: 128,
    };

    // Tester la clé avec un appel minimal
    toast.info('Test de la clé API en cours...');
    
    let testPassed = false;
    try {
      await chatCompletion(testProvider, [
        { role: 'user', content: 'Say "ok"' }
      ], { maxRetries: 1 }); // 1 seul retry pour le test
      testPassed = true;
    } catch (testErr) {
      testPassed = false;
      throw testErr;
    }

    if (!testPassed) {
      throw new Error('Test de clé échoué');
    }

    // La clé est valide - la sauvegarder dans .env
    const existingKeys = getAllKeysForEnvKey(envKey);
    
    if (existingKeys.length === 0) {
      // Première clé pour ce provider - utiliser setKey
      await apiEnvSetKey(envKey, value);
    } else {
      // Clé additionnelle - utiliser addKey
      await apiEnvAddKey(envKey, value);
    }
    
    invalidateCache();
    await loadEnvKeys();
    toast.success(`Clé API validée et sauvegardée !`);
    
    // Notifier le provider panel si le provider actif vient d'obtenir une clé
    if (envKey) notifyProviderPanelOnKeyChange(envKey);
    
    refreshModal();
  } catch (err) {
    // Réactiver le bouton
    saveBtn.textContent = originalText;
    saveBtn.disabled = false;
    
    // Message d'erreur explicatif
    const errorMsg = err.message || '';
    if (errorMsg.includes('401') || errorMsg.includes('No cookie auth') || errorMsg.includes('Invalid API key')) {
      toast.error(`Clé API invalide ou expirée`);
    } else if (errorMsg.includes('429') || errorMsg.includes('Rate limit')) {
      toast.error(`Rate limit — la clé semble valide mais le provider limite les requêtes`);
    } else if (errorMsg.includes('TIMEOUT') || errorMsg.includes('timeout')) {
      toast.error(`Timeout — le provider met trop de temps à répondre`);
    } else {
      toast.error(`Erreur lors du test: ${err.message}`);
    }
  }
}

async function deleteKey(key) {
  const body = modalEl.querySelector('.api-keys-modal__body');
  
  // Vérifier si c'est la dernière clé du provider
  const provider = getAllPresets().find(p => {
    const keys = getAllKeysForEnvKey(p.envKey);
    return keys.some(k => k.key === key);
  });
  
  if (!provider) return;
  
  const allKeysForProvider = getAllKeysForEnvKey(provider.envKey);
  const isLastKey = allKeysForProvider.length <= 1;

  body.innerHTML = `
    <div class="api-keys-modal__confirm">
      <div class="api-keys-modal__confirm-icon">${getChatIcon('alert-triangle', 32)}</div>
      <div class="api-keys-modal__confirm-title">Supprimer cette clé ?</div>
      <div class="api-keys-modal__confirm-text">
        ${isLastKey 
          ? `<strong>Attention :</strong> c'est la dernière clé pour <strong>${escapeHtml(provider.name)}</strong>. Sans clé, la rotation ne fonctionnera pas.` 
          : `La clé <code>${escapeHtml(key)}</code> sera supprimée du fichier <code>.env</code>.`
        }
      </div>
      <div class="api-keys-modal__confirm-actions">
        <button type="button" class="btn" data-action="cancel-form">Annuler</button>
        <button type="button" class="btn btn--danger" data-action="confirm-delete" data-key="${key}">Supprimer</button>
      </div>
    </div>
  `;

  body.querySelector('[data-action="confirm-delete"]')?.addEventListener('click', async () => {
    try {
      await apiEnvDeleteKey(key);
      invalidateCache();
      await loadEnvKeys();
      toast.success('Clé API supprimée du .env');
      
      // Notifier le provider panel si le provider actif a perdu sa clé
      notifyProviderPanelOnKeyChange(key);
      
      refreshModal();
    } catch (err) {
      toast.error(`Erreur: ${err.message}`);
    }
  });
}

async function refreshModal() {
  if (!modalEl) return;
  const body = modalEl.querySelector('.api-keys-modal__body');
  if (body) {
    const keysHtml = await renderKeysList();
    body.innerHTML = `
      ${keysHtml}
      <div class="api-keys-modal__actions">
        <button type="button" class="btn btn--primary api-keys-modal__add-btn" data-action="add-key">${getChatIcon('plus', 14)}
          Ajouter une clé API
        </button>
        ${renderEnvInfo()}
      </div>
    `;
  }
}

// --- Sync provider panel ---

/**
 * Après une modification de clé API, met à jour le cache providerConfigs
 * et notifie le provider panel pour qu'il se re-renderise.
 *
 * Gère deux cas :
 *   - Provider actif → actions.updateProvider() avec notification
 *   - Provider non actif → modification directe de providerConfigs + persist
 */
function notifyProviderPanelOnKeyChange(key) {
  // Trouver le provider concerné par cette clé
  let affectedPreset = null;
  for (const p of getAllPresets()) {
    if (p.envKey && (key === p.envKey || key.startsWith(p.envKey + '_'))) {
      affectedPreset = p;
      break;
    }
  }
  if (!affectedPreset || !affectedPreset.authRequired) return;

  const remainingKeys = getAllKeysForEnvKey(affectedPreset.envKey);
  const hasNoKeys = remainingKeys.length === 0;

  const state = getState();
  const currentProvider = state.assistant.provider;
  const configs = state.assistant.providerConfigs || {};

  if (currentProvider?.id === affectedPreset.id) {
    // Provider actif → via updateProvider (gère notification + configs)
    if (hasNoKeys) {
      actions.updateProvider({ isConnected: false, lastTestedAt: null });
    } else {
      actions.updateProvider({});
    }
  } else {
    // Provider non actif → modifier providerConfigs directement
    if (configs[affectedPreset.id]) {
      if (hasNoKeys) {
        configs[affectedPreset.id].isConnected = false;
        configs[affectedPreset.id].lastTestedAt = null;
      }
      // Déclencher une notification pour que les abonnés (chat bar, etc.) se mettent à jour
      // On utilise notify via un updateProvider sur le current (no-op) pour ne pas
      // dupliquer la logique de notification
      actions.updateProvider({});
    }
  }
}

// --- Export JSON (liste des providers avec statut de clé) ---

function exportKeys() {
  const onlineProviders = getPresetsByCategory('online').filter(p => p.authRequired && p.envKey);
  const exportData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    providers: onlineProviders.map(p => {
      const keys = getAllKeysForEnvKey(p.envKey);
      return {
        id: p.id,
        name: p.name,
        envKey: p.envKey,
        keyCount: keys.length,
        hasKeys: keys.length > 0,
      };
    }),
    note: 'Les clés API sont dans le fichier .env. Cette liste indique quels providers ont une clé configurée.',
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `code-city-providers-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success('Liste des providers exportée');
}