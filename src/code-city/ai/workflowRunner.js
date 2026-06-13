/**
 * workflowRunner.js — Orchestrateur du workflow guidé (7 étapes)
 *
 * Tout est en mémoire. Rien n'est persisté.
 *
 * Architecture :
 *   - providerPanel.js appelle startWorkflow(providerId)
 *   - workflowRunner avance les étapes et met à jour le state
 *   - À l'étape 2, il pause (Promise) en attendant l'action utilisateur
 *   - L'Annulation utilise AbortController
 *
 * @module workflowRunner
 */

import { getState, actions } from '../state.js';
import { getPreset, getCategory } from './providerLoader.js';
import { getApiKeyForEnvKey, loadEnvKeys } from './envLoader.js';
import { chatCompletion, fetchModels, testModel, fetchLmStudioServerConfig } from './aiClient.js';
import { toast } from './toast.js';
import validationModels from '../data/validation-models.json';

// --- État en mémoire ---

let currentStep = 0;        // 0=inactive, 1-7=étapes
let currentError = null;    // { step, message, timestamp } | null
let abortController = null; // AbortController pour annulation
let workflowId = 0;         // Compteur pour détecter les workflows obsolètes
let loadedModels = [];      // Modèles chargés depuis l'API
let modelMeta = null;       // Métadonnées du modèle testé
let selectedModelId = null; // ID du modèle sélectionné
let resolveApiKeyTest = null;  // Resolve de la Promise de l'étape 2
let resolveModelSelect = null; // Resolve de la Promise de l'étape 4
let onStepChange = null;       // Callback pour notifier le panneau UI

// --- Debug helpers ---

const DEBUG = true; // Mettre à false pour disable les logs

function debug(...args) {
  if (DEBUG) {
    const timestamp = Date.now();
    console.log(`[${timestamp}] [WORKFLOW]`, ...args);
  }
}

function debugError(label, err) {
  if (DEBUG) {
    const timestamp = Date.now();
    console.error(`[${timestamp}] [WORKFLOW] ERROR ${label}:`, err.message || err);
  }
}

// --- Constantes ---

const TIMEOUTS = {
  apiKeyTest: 10000,   // 10s pour tester la clé
  loadModels: 15000,   // 15s pour charger les modèles
  modelTest: 20000,    // 20s pour tester le modèle
};

// Messages d'erreur explicites pour les providers locaux non démarrés
const LOCAL_PROVIDER_ERRORS = {
  CONNECTION_REFUSED_OLLAMA: {
    message: 'Ollama n\'est pas en cours d\'exécution',
    hint: 'Démarre Ollama avec: ollama serve',
    solution: 'Ollama doit être lancé sur http://localhost:11434',
  },
  CONNECTION_REFUSED_LMSTUDIO: {
    message: 'LM Studio n\'est pas en cours d\'exécution',
    hint: 'Démarre LM Studio et charge un modèle',
    solution: 'LM Studio doit être lancé sur http://localhost:1234',
  },
};

function getProviderErrorInfo(errorMsg) {
  if (!errorMsg) return null;
  // Vérifier les codes d'erreur CONNECTION_REFUSED
  for (const [code, info] of Object.entries(LOCAL_PROVIDER_ERRORS)) {
    if (errorMsg.includes(code)) {
      return { code, ...info };
    }
  }
  // Vérifier les messages "Connection refused" ou "Failed to fetch"
  if (errorMsg.includes('Connection refused') || 
      errorMsg.includes('Failed to fetch') ||
      errorMsg.includes('ECONNREFUSED')) {
    return {
      code: 'CONNECTION_REFUSED',
      message: 'Serveur local non accessible',
      hint: 'Vérifie que le serveur est démarré',
      solution: 'Impossible de se connecter au serveur local',
    };
  }
  return null;
}

// Modèles minimal pour tester la connexion (jamais stockés dans le state)
// IMPORTANT: Utiliser validation-models.json pour cohérance avec le reste du code
const getTestModel = (providerId) => {
  return validationModels.validationModels[providerId] || '';
};

// --- Fonctions utilitaires ---

function setStep(step) {
  currentStep = step;
  currentError = null;
  onStepChange?.(step);
}

function setError(step, message) {
  currentError = { step, message, timestamp: Date.now() };
}

async function withTimeout(promise, ms, label) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);

  // Capturer le workflow AbortController localement pour éviter
  // les bugs si abortController est réassigné entre-temps
  const workflowAbort = abortController;
  let externalAbortHandler = null;
  if (workflowAbort?.signal) {
    externalAbortHandler = () => controller.abort();
    workflowAbort.signal.addEventListener('abort', externalAbortHandler, { once: true });
  }

  try {
    const result = await Promise.race([
      promise,
      new Promise((_, reject) => {
        controller.signal.addEventListener('abort', () => {
          reject(new Error(`TIMEOUT_${label.toUpperCase()}`));
        }, { once: true });
      }),
    ]);
    return result;
  } finally {
    clearTimeout(timer);
    // Cleanup: retirer l'event listener du BON signal (capturé localement)
    if (externalAbortHandler && workflowAbort?.signal) {
      workflowAbort.signal.removeEventListener('abort', externalAbortHandler);
    }
  }
}

// --- API publique ---

/**
 * Lance le workflow pour un provider donné.
 * @param {string} providerId
 */
export async function startWorkflow(providerId) {
  debug(`startWorkflow(${providerId}) - début`);
  
  // Annuler le workflow précédent s'il y en a un
  if (abortController) {
    debug('Annulation du workflow précédent');
    abortController.abort();
  }
  toast.dismissAll();

  // Incrémenter le compteur — les anciens workflows abandonnent silencieusement
  const myId = ++workflowId;
  debug(`Workflow ID=${myId}`);

  // Initialiser
  abortController = new AbortController();
  loadedModels = [];
  modelMeta = null;
  selectedModelId = null;
  currentError = null;

  const preset = getPreset(providerId);
  if (!preset) {
    debugError('startWorkflow', `Provider inconnu: ${providerId}`);
    setError(0, `Provider inconnu: ${providerId}`);
    return;
  }
  debug(`Preset trouvé: ${preset.name}, envKey: ${preset.envKey}, authRequired: ${preset.authRequired}`);

  // Mettre à jour le provider actif dans le store (Zone 1 + grid is-active)
  actions.setProvider(providerId);

  // Auto-skip : si le provider est déjà configuré, aller directement au step 7
  const restored = getState().assistant.provider;
  debug(`Provider restauré: isConnected=${restored.isConnected}, model=${restored.model}`);
  
  if (restored.isConnected && restored.model) {
    selectedModelId = restored.model;
    // Restaurer modelMeta si disponible (du cache ou du provider)
    if (restored.modelMeta) {
      modelMeta = restored.modelMeta;
    }
    debug(`AUTO-SKIP vers step 7 (provider déjà configuré)`);
    setStep(7);
    toast.info(`${preset.name} — ${selectedModelId} est prêt`);
    return;
  }

  try {
    const needsApiKey = preset.authRequired !== false;
    debug(`needsApiKey=${needsApiKey}`);

    // Étape 1 : Sélection du provider
    setStep(1);
    toast.info(`Provider ${preset.name} sélectionné`);
    debug(`Step 1: Provider sélectionné`);

    if (!needsApiKey) {
      // Providers locaux : skip directement au chargement des modèles
      debug('Provider local, skip étape clé API');
      await runStep3(providerId, preset, myId);
    } else {
      // Vérifier si une clé API existe dans le .env via envKey du preset
      // IMPORTANT: charger d'abord les clés depuis le serveur
      debug('Chargement des clés depuis /api/env...');
      await loadEnvKeys();
      const existingKey = getApiKeyForEnvKey(preset.envKey) || '';
      debug(`Clé pour ${preset.envKey}: ${existingKey ? 'trouvée (longueur=' + existingKey.length + ')' : 'AUCUNE'}`);

      if (existingKey) {
        // Clé existante → auto-tester sans demander à l'utilisateur
        // Reste à step 1 (pas de setStep(3) pour éviter "Chargement des modèles" pendant le test)
        debug(`Test de la clé existante... (longueur=${existingKey.length})`);
        toast.info(`Clé existante détectée, vérification…`);

        const result = await testApiKey(existingKey);
        debug(`Résultat testApiKey: ok=${result.ok}, error=${result.error}`);
        if (myId !== workflowId) return;

        if (result.ok) {
          // Clé validée → continuer directement au chargement des modèles
          debug('Clé validée, passage au chargement des modèles');
          await runStep3(providerId, preset, myId);
        } else {
          // Clé invalide → montrer l'étape 2 pour que l'utilisateur corrige
          debug('Clé invalide, étape 2 demandée');
          setStep(2);
          toast.warning(`Clé existante invalide. Entrez une nouvelle clé.`);
          const apiKeyValidated = await waitForApiKeyTest();
          if (myId !== workflowId) return;
          if (!apiKeyValidated) {
            debug('Utilisateur a annulé');
            setStep(0);
            return;
          }
          await runStep3(providerId, preset, myId);
        }
      } else {
        // Aucune clé → demander à l'utilisateur
        debug(`Aucune clé pour ${preset.envKey}, demande à l'utilisateur`);
        setStep(2);
        const apiKeyValidated = await waitForApiKeyTest();
        if (myId !== workflowId) return;
        if (!apiKeyValidated) {
          debug('Utilisateur a annulé');
          setStep(0);
          return;
        }
        await runStep3(providerId, preset, myId);
      }
    }
  } catch (err) {
    debugError('startWorkflow', err);
    if (myId !== workflowId) return;

    // Gérer les erreurs de timeout
    if (err.message?.startsWith('TIMEOUT_')) {
      const stepName = err.message.replace('TIMEOUT_', '');
      setError(currentStep, `Délai d'attente dépassé (${stepName})`);

      if (stepName === 'LOADMODELS') {
        toast.error(`Délai d'attente dépassé (${TIMEOUTS.loadModels / 1000}s). Modèles fallback affichés.`);
        loadedModels = [];
        await runStep4(providerId, myId);
      } else if (stepName === 'MODELTEST') {
        toast.error(`Délai d'attente dépassé (${TIMEOUTS.modelTest / 1000}s). Sélectionne un autre modèle.`);
        // Rester à l'étape 4 pour permettre un nouveau choix
      }
      return;
    }

    // Autres erreurs
    setError(currentStep, err.message);
    toast.error(`Erreur: ${err.message}`);
    setStep(0);
  }
}

/**
 * Annule le workflow en cours.
 */
export function cancelWorkflow() {
  // Résoudre les Promises en attente avec false AVANT de nullifier
  // pour éviter les Promises pendantes (memory leak)
  if (resolveApiKeyTest) {
    resolveApiKeyTest(false);
    resolveApiKeyTest = null;
  }
  if (resolveModelSelect) {
    resolveModelSelect(false);
    resolveModelSelect = null;
  }
  if (abortController) {
    abortController.abort();
  }
  loadedModels = [];
  modelMeta = null;
  setStep(0);
}

/**
 * Redémarre le workflow depuis l'étape 4 (sélection du modèle).
 * Utilisé par le bouton "Modifier" pour permettre de changer de modèle
 * sans passer par l'auto-skip de step 7.
 * @param {string} providerId
 */
export async function restartWorkflowFromStep4(providerId) {
  debug(`restartWorkflowFromStep4(${providerId}) - début`);
  
  // Annuler le workflow précédent s'il y en a un
  if (abortController) {
    debug('restartWorkflowFromStep4 - annulation workflow précédent');
    abortController.abort();
  }
  toast.dismissAll();

  // Incrémenter le compteur — les anciens workflows abandonnent silencieusement
  const myId = ++workflowId;
  debug(`restartWorkflowFromStep4 - Workflow ID=${myId}`);

  // Initialiser
  abortController = new AbortController();
  currentError = null;

  const preset = getPreset(providerId);
  if (!preset) {
    debugError('restartWorkflowFromStep4', `Provider inconnu: ${providerId}`);
    setError(0, `Provider inconnu: ${providerId}`);
    return;
  }
  debug(`restartWorkflowFromStep4 - preset: ${preset.name}`);

  // Charger les clés depuis le serveur (au cas où)
  debug('restartWorkflowFromStep4 - chargement clés...');
  await loadEnvKeys();
  
  // Récupérer la clé API depuis envLoader et l'attribuer au provider
  const apiKey = getApiKeyForEnvKey(preset.envKey);
  if (apiKey) {
    debug(`restartWorkflowFromStep4 - clé API trouvée (longueur=${apiKey.length}), attribution au provider`);
    actions.updateProvider({ apiKey });
  } else {
    debug('restartWorkflowFromStep4 - AUCUNE clé API pour ce provider');
  }

  // Aller directement à l'étape 4 (sélection du modèle)
  // On reutilise loadedModels s'il y en a déjà, sinon on les charge
  if (loadedModels.length === 0) {
    debug('restartWorkflowFromStep4 - loadedModels vide, chargement...');
    // Charger les modèles si pas encore fait
    setStep(3);
    toast.info('Chargement des modèles disponibles...');
    try {
      const provider = getState().assistant.provider;
      debug(`restartWorkflowFromStep4 - fetchModels(provider)...`);
      loadedModels = await withTimeout(
        fetchModels(provider),
        TIMEOUTS.loadModels,
        'loadModels'
      );
      debug(`restartWorkflowFromStep4 - ${loadedModels.length} modèles reçus`);
      if (myId !== workflowId) return;
      if (loadedModels.length === 0) {
        toast.error('Aucun modèle disponible pour ce provider.');
        setStep(0);
        return;
      }
    } catch (err) {
      debugError('restartWorkflowFromStep4', err);
      if (myId !== workflowId) return;
      toast.error(`Impossible de charger les modèles: ${err.message}`);
      setStep(0);
      return;
    }
  } else {
    debug(`restartWorkflowFromStep4 - réutilise ${loadedModels.length} modèles existants`);
  }

  // Aller à l'étape 4
  setStep(4);
  toast.info(`Sélectionne un modèle pour ${preset.name}`);
  debug('restartWorkflowFromStep4 - Step 4: sélection modèle');

  // Pause en attente de la sélection du modèle
  const modelSelected = await waitForModelSelection();
  if (myId !== workflowId) return;

  if (!modelSelected) {
    debug('restartWorkflowFromStep4 - utilisateur a annulé, retour step 7');
    setStep(7); // Retour au state validé si annulation
    return;
  }

  await runStep5(providerId, myId);
}

/**
 * Enregistre un callback appelé à chaque changement d'étape.
 * Utilisé par providerPanel.js pour re-rendre la Zone 3.
 * @param {Function|null} fn - callback(step) ou null pour désactiver
 */
export function setOnStepChange(fn) {
  onStepChange = fn;
}

/**
 * Retourne l'état actuel du workflow.
 * @returns {{ step, error, loadedModels, modelMeta, selectedModelId }}
 */
export function getWorkflowState() {
  return {
    step: currentStep,
    error: currentError,
    loadedModels,
    modelMeta,
    selectedModelId,
  };
}

// --- Étape 2 : Pause en attente de la clé API ---

/**
 * Crée une Promise qui se résout quand l'utilisateur valide sa clé.
 * @returns {Promise<boolean>}
 */
function waitForApiKeyTest() {
  debug('waitForApiKeyTest - en attente de la clé utilisateur');
  return new Promise((resolve) => {
    resolveApiKeyTest = resolve;
  });
}

/**
 * Appelé par providerPanel.js quand l'utilisateur clique "Tester la clé".
 * @param {string} apiKey
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function testApiKey(apiKey) {
  debug(`testApiKey(l=${apiKey.length}) - début`);
  if (!apiKey) {
    debug('testApiKey - Clé vide');
    return { ok: false, error: 'Clé API vide' };
  }

  const stateProvider = getState().assistant.provider;
  const preset = getPreset(stateProvider.id);
  debug(`testApiKey - provider: ${stateProvider.id}, preset.envKey: ${preset?.envKey}`);
  
  // reconstruire le provider avec envKey du preset (non stocké en state)
  const provider = {
    ...stateProvider,
    envKey: preset?.envKey || stateProvider.envKey || null,
  };

  // IMPORTANT: Pour tester une clé API, on utilise TOUJOURS le modèle de validation
  // (depuis validation-models.json), pas le modèle potentiellement obsolète stocké en state.
  // Le modèle en state peut être un modèle payant qu'on n'a plus les credits pour,
  // ou un modèle qui n'est plus disponible.
  const testModel = getTestModel(provider.id) || provider.model || '';
  debug(`testApiKey - modèle de test: ${testModel}`);

  try {
    toast.info('Test de la clé en cours...');
    debug('testApiKey - appel chatCompletion...');

    const result = await withTimeout(
      chatCompletion(
        { ...provider, apiKey, model: testModel },
        [{ role: 'user', content: 'Say ok' }],
        { maxRetries: 3 } // rotation activée (pas de noRotation)
      ),
      TIMEOUTS.apiKeyTest,
      'apiKeyTest'
    );
    debug('testApiKey - chatCompletion réussi');

    // Succès — la clé API est stockée dans .env par envLoader
    toast.success('Clé API validée');
    debug('testApiKey - toast success affiché');
    
    // Mettre à jour le provider courant avec la clé
    actions.updateProvider({ apiKey });
    debug('testApiKey - provider mis à jour avec apiKey');

    // Résoudre la Promise de l'étape 2
    if (resolveApiKeyTest) {
      debug('testApiKey - résolution de la Promise étape 2');
      resolveApiKeyTest(true);
      resolveApiKeyTest = null;
    }

    return { ok: true };
  } catch (err) {
    debugError('testApiKey', err);
    const msg = err.message?.startsWith('TIMEOUT_')
      ? `Délai d'attente dépassé (${TIMEOUTS.apiKeyTest / 1000}s)`
      : err.message;

    debug(`testApiKey - erreur: ${msg}`);
    toast.error(`Clé API invalide: ${msg}`);
    return { ok: false, error: msg };
  }
}

// --- Étape 3 : Chargement des modèles ---

async function runStep3(providerId, preset, myId) {
  if (myId !== workflowId) return;
  debug(`runStep3 - debut, provider=${providerId}`);
  setStep(3);
  toast.info('Chargement des modèles disponibles...');
  debug('Step 3: Chargement des modèles');

  try {
    const provider = getState().assistant.provider;
    debug(`runStep3 - provider state: id=${provider.id}, envKey=${provider.envKey}`);
    debug(`runStep3 - fetchModels(provider)...`);
    
    loadedModels = await withTimeout(
      fetchModels(provider),
      TIMEOUTS.loadModels,
      'loadModels'
    );
    debug(`runStep3 - fetchModels terminé, ${loadedModels.length} modèles reçus`);

    if (myId !== workflowId) return;

    // Providers locaux : interroger le serveur pour récupérer le nombre de
    // modèles chargés (= nombre de slots actifs côté LM Studio). Le `n_parallel`
    // réel n'est pas exposé par l'API, mais chaque modèle chargé occupe 1 slot.
    // On stocke le résultat sur provider.serverConfig pour affichage dans
    // la Status zone (comparaison configuré vs réel).
    if (preset.category === 'local') {
      try {
        if (provider.id === 'lmstudio') {
          const serverInfo = await fetchLmStudioServerConfig(provider);
          if (serverInfo.ok) {
            actions.setServerConfig({
              loadedModels: serverInfo.models,
              loadedCount: serverInfo.models.length,
              actualSlots: serverInfo.models.length,
              n_parallel: serverInfo.n_parallel, // null (non exposé par l'API LM Studio)
              fetchedAt: Date.now(),
            });
            debug(`runStep3 - LM Studio server config: ${serverInfo.models.length} modèles chargés`);
          }
        } else if (provider.id === 'ollama') {
          // Ollama n'a pas de slots, on stocke juste le count de modèles
          actions.setServerConfig({
            loadedModels: loadedModels.map((m) => m.id),
            loadedCount: loadedModels.length,
            actualSlots: null, // Ollama = séquentiel
            n_parallel: null,
            fetchedAt: Date.now(),
          });
          debug(`runStep3 - Ollama: ${loadedModels.length} modèles disponibles`);
        }
      } catch (err) {
        debugError('runStep3 serverConfig', err);
        // Non-bloquant : on continue sans serverConfig
      }
    }

    if (loadedModels.length === 0) {
      debug('runStep3 - AUCUN modèle reçu');
      toast.error('Aucun modèle disponible pour ce provider.');
      setStep(0);
      return;
    }

    const freeCount = loadedModels.filter((m) => m.isFree).length;
    debug(`runStep3 - ${loadedModels.length} modèles, ${freeCount} gratuits`);
    toast.success(`${loadedModels.length} modèles disponibles, ${freeCount} gratuits`);

    await runStep4(providerId, myId);
  } catch (err) {
    debugError('runStep3', err);
    if (myId !== workflowId) return;

    // Vérifier si c'est une erreur de provider local non démarré
    const errorInfo = getProviderErrorInfo(err.message);
    if (errorInfo) {
      // Afficher un toast explicatif avec les instructions
      debug(`runStep3 - erreur provider local: ${errorInfo.code}`);
      toast.error(errorInfo.message);
      toast.warning(errorInfo.hint, { duration: 8000 });
      toast.info(errorInfo.solution, { duration: 8000 });
      setStep(0);
      return;
    }

    debug(`runStep3 - erreur chargement modèles: ${err.message}`);
    toast.error(`Impossible de charger les modèles: ${err.message}`);
    setStep(0);
  }
}

// --- Étape 4 : Sélection du modèle ---

async function runStep4(providerId, myId) {
  if (myId !== workflowId) return;
  setStep(4);

  // Pause en attente de la sélection du modèle
  const modelSelected = await waitForModelSelection();
  if (myId !== workflowId) return;

  if (!modelSelected) {
    setStep(0);
    return;
  }

  await runStep5(providerId, myId);
}

/**
 * Crée une Promise qui se résout quand l'utilisateur sélectionne un modèle.
 * @returns {Promise<boolean>}
 */
function waitForModelSelection() {
  return new Promise((resolve) => {
    resolveModelSelect = resolve;
  });
}

/**
 * Appelé par providerPanel.js quand l'utilisateur sélectionne un modèle.
 * @param {string} modelId
 */
export function selectModel(modelId) {
  selectedModelId = modelId;
  if (resolveModelSelect) {
    resolveModelSelect(true);
    resolveModelSelect = null;
  }
}

// --- Étape 5 : Test du modèle ---

async function runStep5(providerId, myId) {
  if (myId !== workflowId) return;
  debug(`runStep5 - debut, selectedModelId=${selectedModelId}`);
  setStep(5);
  toast.info('Test du modèle en cours...');
  debug('Step 5: Test du modèle');

  try {
    const stateProvider = getState().assistant.provider;
    const preset = getPreset(providerId);
    debug(`runStep5 - provider.id: ${stateProvider.id}`);
    debug(`runStep5 - stateProvider.apiKey: ${stateProvider.apiKey ? 'oui (longueur=' + stateProvider.apiKey.length + ')' : 'NON DEFINI'}`);
    debug(`runStep5 - preset.envKey: ${preset?.envKey}`);
    
    // reconstruire le provider avec envKey du preset (non stocké en state)
    const provider = {
      ...stateProvider,
      envKey: preset?.envKey || stateProvider.envKey || null,
    };
    debug(`runStep5 - provider.apiKey après reconstruction: ${provider.apiKey ? 'oui (longueur=' + provider.apiKey.length + ')' : 'NON'}`);
    
    const model = loadedModels.find((m) => m.id === selectedModelId);
    debug(`runStep5 - modèle: ${model?.name || selectedModelId}`);

    debug(`runStep5 - testModel(provider, ${selectedModelId})...`);
    const result = await withTimeout(
      testModel(provider, selectedModelId),
      TIMEOUTS.modelTest,
      'modelTest'
    );
    debug(`runStep5 - testModel réussi, latency=${result?.latency}ms`);

    if (myId !== workflowId) return;

    modelMeta = result;
    debug(`runStep5 - toast success`);
    toast.success(`Modèle ${model?.name || selectedModelId} testé avec succès (${result.latency}ms)`);
    await runStep6(providerId, selectedModelId, myId);
  } catch (err) {
    debugError('runStep5', err);
    if (myId !== workflowId) return;

    const isTimeout = err.message?.startsWith('TIMEOUT_');
    const model = loadedModels.find((m) => m.id === selectedModelId);
    const isFreeModel = model?.isFree;
    
    // Message personnalisé pour les timeouts des modèles gratuits
    let msg;
    if (isTimeout && isFreeModel) {
      msg = `Timeout — le modèle gratuit "${model.name}" est souvent lent. Réessaie ou choisis un autre modèle.`;
    } else if (isTimeout) {
      msg = `Délai d'attente dépassé (${TIMEOUTS.modelTest / 1000}s). Le modèle peut être occupé.`;
    } else {
      msg = err.message;
    }

    debug(`runStep5 - erreur: ${msg}, retour à step 4`);
    toast.error(msg, { duration: 5000 });
    await runStep4(providerId, myId);
  }
}

// --- Étape 6 : Validation ---

async function runStep6(providerId, modelId, myId) {
  if (myId !== workflowId) return;
  setStep(6);

  const provider = getState().assistant.provider;
  const model = loadedModels.find((m) => m.id === modelId);
  const preset = getPreset(providerId);

  // Persister dans le state
  actions.updateProvider({
    model: modelId,
    isConnected: true,
    lastTestedAt: Date.now(),
    modelMeta: modelMeta,
  });

  toast.success(`Connexion validée ! ${preset?.name || providerId} — ${model?.name || modelId} est prêt.`);

  // Étape 7 : Sauvegarde auto (déjà fait par updateProvider → persistAssistant)
  setStep(7);
}

/**
 * Retourne les modèles filtrés et triés (Top 15 ou tous).
 * @param {string} searchQuery
 * @param {boolean} showAll
 * @returns {{ displayed, total, freeCount, hasMore }}
 */
export function getDisplayModels(searchQuery = '', showAll = false) {
  let filtered = loadedModels;

  // Filtre de recherche
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter((m) =>
      m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q)
    );
  }

  // Tri : gratuit > context window DESC > alphabétique
  filtered.sort((a, b) => {
    if (a.isFree && !b.isFree) return -1;
    if (!a.isFree && b.isFree) return 1;
    const cwA = a.contextWindow || 0;
    const cwB = b.contextWindow || 0;
    if (cwB !== cwA) return cwB - cwA;
    return a.name.localeCompare(b.name);
  });

  const total = filtered.length;
  const freeCount = filtered.filter((m) => m.isFree).length;
  const displayed = showAll ? filtered : filtered.slice(0, 15);

  return { displayed, total, freeCount, hasMore: total > 15 };
}

/**
 * Nettoyage complet (pour les tests).
 */
export function _reset() {
  cancelWorkflow();
  loadedModels = [];
  modelMeta = null;
  selectedModelId = null;
}
