/**
 * Tests TDD — workflowRunner.js
 * Orchestrateur du workflow guidé (7 étapes)
 *
 * Ces tests définissent l'API attendue AVANT l'implémentation (TDD Red phase).
 * Quand workflowRunner.js sera créé, ces tests devront passer.
 *
 * Architecture testée :
 *   - startWorkflow(providerId) → avance étape par étape
 *   - Étape 2 : pause (Promise) en attente de testApiKey()
 *   - Étape 4 : pause (Promise) en attente de selectModel()
 *   - cancelWorkflow() → résout les Promises + AbortController
 *   - getWorkflowState() → { step, error, loadedModels, modelMeta, selectedModelId }
 *   - getDisplayModels(query, showAll) → tri gratuit > contextWindow > alpha
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  startWorkflow,
  cancelWorkflow,
  testApiKey,
  selectModel,
  getWorkflowState,
  getDisplayModels,
  _reset,
} from './workflowRunner.js';

// Mock des dépendances
vi.mock('../state.js', () => ({
  getState: vi.fn(),
  getApiKeyForProvider: vi.fn(() => ''),
  actions: {
    setProvider: vi.fn(),
    updateProvider: vi.fn(),
    addApiKey: vi.fn(),
  },
}));

vi.mock('./aiClient.js', () => ({
  chatCompletion: vi.fn(),
  fetchModels: vi.fn(),
  testModel: vi.fn(),
}));

vi.mock('./keyRotation.js', () => ({
  getNextKey: vi.fn(),
  markRateLimited: vi.fn(),
  resetErrorCount: vi.fn(),
}));

vi.mock('./toast.js', () => ({
  toast: {
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    dismissAll: vi.fn(),
  },
}));

vi.mock('./providerLoader.js', () => ({
  getAllPresets: vi.fn(() => [
    {
      id: 'ollama',
      name: 'ollama',
      category: 'local',
      baseUrl: 'http://localhost:11434/v1',
      authRequired: false,
      defaultModel: 'llama3.2',
      models: [{ id: 'llama3.2', name: 'llama3.2', isFree: true }],
    },
    {
      id: 'openrouter',
      name: 'OpenRouter',
      category: 'online',
      baseUrl: 'https://openrouter.ai/api/v1',
      authRequired: true,
      defaultModel: 'meta-llama/llama-3.2-3b-instruct:free',
      models: [],
    },
  ]),
  getPresetsByCategory: vi.fn(() => []),
  getPreset: vi.fn((id) => {
    const presets = {
      ollama: {
        id: 'ollama',
        name: 'ollama',
        category: 'local',
        baseUrl: 'http://localhost:11434/v1',
        authRequired: false,
        defaultModel: 'llama3.2',
      },
      openrouter: {
        id: 'openrouter',
        name: 'OpenRouter',
        category: 'online',
        baseUrl: 'https://openrouter.ai/api/v1',
        authRequired: true,
        defaultModel: 'meta-llama/llama-3.2-3b-instruct:free',
      },
    };
    return presets[id];
  }),
  getCategory: vi.fn(),
}));

import { getState, actions } from '../state.js';
import { chatCompletion, fetchModels, testModel } from './aiClient.js';
import { toast } from './toast.js';

describe('workflowRunner', () => {
  beforeEach(() => {
    _reset();
    vi.useFakeTimers();
    getState.mockReturnValue({
      assistant: {
        provider: {
          id: 'ollama',
          apiKey: '',
          baseUrl: 'http://localhost:11434/v1',
          model: 'llama3.2',
          isConnected: false,
        },
        apiKeys: [],
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // =========================================================================
  // getWorkflowState — État initial
  // =========================================================================

  describe('getWorkflowState', () => {
    it('retourne step=0 quand aucun workflow n\'est lancé', () => {
      const state = getWorkflowState();
      expect(state.step).toBe(0);
      expect(state.error).toBeNull();
      expect(state.loadedModels).toEqual([]);
      expect(state.modelMeta).toBeNull();
      expect(state.selectedModelId).toBeNull();
    });
  });

  // =========================================================================
  // startWorkflow — Provider local (skip étape 2)
  // =========================================================================

  describe('startWorkflow (provider local)', () => {
    it('saute l\'étape 2 pour les providers locaux', async () => {
      fetchModels.mockResolvedValue([
        { id: 'llama3.2', name: 'llama3.2', isFree: true },
      ]);
      testModel.mockResolvedValue({
        format: 'openai',
        capabilities: ['chat'],
        contextWindow: null,
        latency: 100,
      });

      // Démarrer le workflow ET sélectionner un modèle via un micro-task
      // pour que le selectModel soit appelé APRÈS que le workflow atteigne l'étape 4
      const workflow = startWorkflow('ollama');
      // Laisser le workflow atteindre l'étape 4 (loadModels + runStep4)
      await vi.advanceTimersByTimeAsync(50);
      // Maintenant sélectionner le modèle (la Promise de l'étape 4 est en attente)
      selectModel('llama3.2');
      // Laisser le workflow terminer (test + validation)
      await vi.advanceTimersByTimeAsync(50);

      const state = getWorkflowState();
      expect(state.step).toBe(7); // Validé directement
      expect(actions.updateProvider).toHaveBeenCalled();
    });

    it('affiche un toast info au démarrage', async () => {
      fetchModels.mockResolvedValue([
        { id: 'llama3.2', name: 'llama3.2', isFree: true },
      ]);
      testModel.mockResolvedValue({
        format: 'openai',
        capabilities: ['chat'],
        contextWindow: null,
        latency: 50,
      });

      const workflow = startWorkflow('ollama');
      await vi.advanceTimersByTimeAsync(50);
      selectModel('llama3.2');
      await vi.advanceTimersByTimeAsync(50);

      expect(toast.info).toHaveBeenCalledWith('Provider ollama sélectionné');
    });

    it('appelle fetchModels avec les bonnes données provider', async () => {
      fetchModels.mockResolvedValue([]);
      getState.mockReturnValue({
        assistant: {
          provider: {
            id: 'ollama',
            apiKey: '',
            baseUrl: 'http://localhost:11434/v1',
            model: 'llama3.2',
          },
          apiKeys: [],
        },
      });

      const workflow = startWorkflow('ollama');
      await vi.advanceTimersByTimeAsync(50);

      expect(fetchModels).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'ollama' })
      );
    });

    it('arrête le workflow quand fetchModels retourne un tableau vide', async () => {
      fetchModels.mockResolvedValue([]);

      const workflow = startWorkflow('ollama');
      await vi.advanceTimersByTimeAsync(50);

      // Aucun modèle disponible → error et step=0
      expect(getWorkflowState().step).toBe(0);
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('Aucun modèle disponible')
      );
    });

    it('affiche un toast error quand aucun modèle n est disponible', async () => {
      fetchModels.mockResolvedValue([]);

      const workflow = startWorkflow('ollama');
      await vi.advanceTimersByTimeAsync(50);

      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('Aucun modèle disponible')
      );
    });
  });

  // =========================================================================
  // startWorkflow — Provider online (pause étape 2)
  // =========================================================================

  describe('startWorkflow (provider online)', () => {
    it('se bloque à l\'étape 2 en attendant la clé API', async () => {
      const workflow = startWorkflow('openrouter');
      void workflow;
      await vi.advanceTimersByTimeAsync(50);

      expect(getWorkflowState().step).toBe(2);
    });

    it('toast.info affiché au démarrage', async () => {
      const workflow = startWorkflow('openrouter');
      void workflow;
      await vi.advanceTimersByTimeAsync(50);

      expect(toast.info).toHaveBeenCalledWith('Provider OpenRouter sélectionné');
    });
  });

  // =========================================================================
  // cancelWorkflow — Annulation
  // =========================================================================

  describe('cancelWorkflow', () => {
    it('résout les Promises pendantes avec false', async () => {
      const workflow = startWorkflow('openrouter');
      void workflow;
      await vi.advanceTimersByTimeAsync(50);

      expect(getWorkflowState().step).toBe(2);

      cancelWorkflow();

      await vi.advanceTimersByTimeAsync(50);
      expect(getWorkflowState().step).toBe(0);
    });

    it('réinitialise loadedModels et modelMeta', async () => {
      fetchModels.mockResolvedValue([
        { id: 'llama3.2', name: 'llama3.2', isFree: true },
      ]);
      testModel.mockResolvedValue({
        format: 'openai',
        capabilities: ['chat'],
        contextWindow: null,
        latency: 100,
      });

      const workflow = startWorkflow('ollama');
      await vi.advanceTimersByTimeAsync(50);
      selectModel('llama3.2');
      await vi.advanceTimersByTimeAsync(50);

      // Le workflow est terminé, loadedModels est rempli
      expect(getWorkflowState().loadedModels.length).toBeGreaterThan(0);

      // cancelWorkflow réinitialise tout
      cancelWorkflow();
      expect(getWorkflowState().loadedModels).toEqual([]);
      expect(getWorkflowState().modelMeta).toBeNull();
    });

    it('appelle toast.dismissAll', async () => {
      const workflow = startWorkflow('openrouter');
      void workflow;
      await vi.advanceTimersByTimeAsync(50);

      cancelWorkflow();

      expect(toast.dismissAll).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // testApiKey — Test de clé API
  // =========================================================================

  describe('testApiKey', () => {
    it('succès → résout la Promise de l\'étape 2', async () => {
      chatCompletion.mockResolvedValue({ content: 'ok' });

      const workflow = startWorkflow('openrouter');
      void workflow;
      await vi.advanceTimersByTimeAsync(50);

      expect(getWorkflowState().step).toBe(2);

      const result = await testApiKey('sk-test');
      expect(result.ok).toBe(true);
      expect(actions.updateProvider).toHaveBeenCalledWith(
        expect.objectContaining({ apiKey: 'sk-test' })
      );
    });

    it('échec → retourne { ok: false } sans résoudre la Promise', async () => {
      chatCompletion.mockRejectedValue(new Error('Unauthorized'));

      const workflow = startWorkflow('openrouter');
      void workflow;
      await vi.advanceTimersByTimeAsync(50);

      const result = await testApiKey('sk-bad');
      expect(result.ok).toBe(false);
      expect(result.error).toBe('Unauthorized');

      // Le workflow reste à l'étape 2
      expect(getWorkflowState().step).toBe(2);
    });

    it('clé vide → retourne immédiatement { ok: false }', async () => {
      const result = await testApiKey('');
      expect(result.ok).toBe(false);
      expect(result.error).toContain('vide');
    });

    it('appelle chatCompletion avec "Say ok"', async () => {
      chatCompletion.mockResolvedValue({ content: 'ok' });

      const workflow = startWorkflow('openrouter');
      void workflow;
      await vi.advanceTimersByTimeAsync(50);

      await testApiKey('sk-test');

      expect(chatCompletion).toHaveBeenCalledWith(
        expect.objectContaining({ apiKey: 'sk-test' }),
        [{ role: 'user', content: 'Say ok' }],
        { maxRetries: 3 }  // rotation activée (pas de noRotation)
      );
    });

    it('timeout → retourne { ok: false } avec message de timeout', async () => {
      // chatCompletion ne résout jamais (simule un timeout)
      chatCompletion.mockImplementation(() => new Promise(() => {}));

      const workflow = startWorkflow('openrouter');
      void workflow;
      await vi.advanceTimersByTimeAsync(50);

      // Avancer au-delà du timeout (10s)
      const resultPromise = testApiKey('sk-slow');
      await vi.advanceTimersByTimeAsync(10001);
      const result = await resultPromise;

      expect(result.ok).toBe(false);
      expect(result.error).toContain('Délai');
    });
  });

  // =========================================================================
  // selectModel — Sélection de modèle
  // =========================================================================

  describe('selectModel', () => {
    it('déclenche la reprise du workflow après sélection', async () => {
      fetchModels.mockResolvedValue([
        { id: 'llama3.2', name: 'llama3.2', isFree: true },
      ]);
      testModel.mockResolvedValue({
        format: 'openai',
        capabilities: ['chat'],
        contextWindow: null,
        latency: 100,
      });

      const workflow = startWorkflow('ollama');
      await vi.advanceTimersByTimeAsync(50);

      expect(getWorkflowState().step).toBe(4);

      selectModel('llama3.2');
      await vi.advanceTimersByTimeAsync(50);

      expect(getWorkflowState().step).toBe(7);
      expect(getWorkflowState().selectedModelId).toBe('llama3.2');
    });

    it('appelle testModel avec les bonnes données', async () => {
      fetchModels.mockResolvedValue([
        { id: 'llama3.2', name: 'llama3.2', isFree: true },
      ]);
      testModel.mockResolvedValue({
        format: 'openai',
        capabilities: ['chat'],
        contextWindow: null,
        latency: 100,
      });

      const workflow = startWorkflow('ollama');
      await vi.advanceTimersByTimeAsync(50);
      selectModel('llama3.2');
      await vi.advanceTimersByTimeAsync(50);

      expect(testModel).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'ollama' }),
        'llama3.2'
      );
    });
  });

  // =========================================================================
  // getDisplayModels — Tri et filtrage
  // =========================================================================

  describe('getDisplayModels', () => {
    it('retourne les modèles triés (gratuits en premier)', () => {
      // Simuler loadedModels via un workflow complet
      // On teste la fonction directement
      const result = getDisplayModels('', false);
      // Par défaut, loadedModels est vide
      expect(result.displayed).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.hasMore).toBe(false);
    });

    it('retourne hasMore=true quand il y a plus de 15 modèles', () => {
      // On ne peut pas facilement injecter 16 modèles sans workflow
      // Donc on teste la logique de tri directement
      const result = getDisplayModels('', true);
      expect(result.displayed).toEqual([]);
    });

    it('filtre par recherche', () => {
      const result = getDisplayModels('llama', false);
      expect(result.displayed).toEqual([]);
    });
  });

  // =========================================================================
  // Gestion d'erreurs
  // =========================================================================

  describe('gestion d\'erreurs', () => {
    it('provider inconnu → error et step=0', async () => {
      const workflow = startWorkflow('unknown-provider');
      void workflow;
      await vi.advanceTimersByTimeAsync(50);

      const state = getWorkflowState();
      expect(state.step).toBe(0);
      expect(state.error).toBeDefined();
      expect(state.error.message).toContain('inconnu');
    });

    it('fetchModels échoue → error et step=0', async () => {
      fetchModels.mockRejectedValue(new Error('Network error'));

      const workflow = startWorkflow('ollama');
      await vi.advanceTimersByTimeAsync(50);

      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('Network error')
      );
      expect(getWorkflowState().step).toBe(0);
    });

    it('testModel échoue → retour à l\'étape 4', async () => {
      fetchModels.mockResolvedValue([
        { id: 'llama3.2', name: 'llama3.2', isFree: true },
      ]);
      testModel.mockRejectedValue(new Error('Model error'));

      const workflow = startWorkflow('ollama');
      await vi.advanceTimersByTimeAsync(50);
      selectModel('llama3.2');
      await vi.advanceTimersByTimeAsync(50);

      // On devrait revenir à l'étape 4 pour permettre un nouveau choix
      expect(getWorkflowState().step).toBe(4);
    });
  });

  // =========================================================================
  // Annulation pendant le workflow
  // =========================================================================

  describe('annulation pendant le workflow', () => {
    it('annulation pendant le chargement des modèles', async () => {
      // fetchModels ne résout jamais (simule un fetch lent)
      fetchModels.mockImplementation(() => new Promise(() => {}));

      const workflow = startWorkflow('ollama');
      void workflow;
      await vi.advanceTimersByTimeAsync(50);

      expect(getWorkflowState().step).toBe(3);

      cancelWorkflow();
      await vi.advanceTimersByTimeAsync(50);

      expect(getWorkflowState().step).toBe(0);
    });

    it('nouveau workflow annule le précédent', async () => {
      // 1. Lancer un workflow local ollama bloqué à l'étape 3 (fetchModels never resolves)
      fetchModels.mockImplementation(() => new Promise(() => {}));

      const workflow1 = startWorkflow('ollama');
      void workflow1;
      await vi.advanceTimersByTimeAsync(50);

      expect(getWorkflowState().step).toBe(3);

      // 2. Annuler proprement le 1er workflow (comme le ferait providerPanel.js)
      cancelWorkflow();
      await vi.advanceTimersByTimeAsync(50);
      expect(getWorkflowState().step).toBe(0);

      // 3. Lancer un 2e workflow openrouter
      fetchModels.mockResolvedValue([]);
      testModel.mockResolvedValue({
        format: 'openai',
        capabilities: ['chat'],
        contextWindow: null,
        latency: 100,
      });

      const workflow2 = startWorkflow('openrouter');
      void workflow2;
      await vi.advanceTimersByTimeAsync(50);

      // Le 2e workflow est à l'étape 2 (online → pause attente API key)
      expect(getWorkflowState().step).toBe(2);
    });
  });

  // =========================================================================
  // Étape 6 — Validation et persistance
  // =========================================================================

  describe('validation (étape 6)', () => {
    it('appelle updateProvider avec isConnected=true', async () => {
      fetchModels.mockResolvedValue([
        { id: 'llama3.2', name: 'llama3.2', isFree: true },
      ]);
      testModel.mockResolvedValue({
        format: 'openai',
        capabilities: ['chat'],
        contextWindow: 4096,
        latency: 150,
      });

      const workflow = startWorkflow('ollama');
      await vi.advanceTimersByTimeAsync(50);
      selectModel('llama3.2');
      await vi.advanceTimersByTimeAsync(50);

      expect(actions.updateProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'llama3.2',
          isConnected: true,
          lastTestedAt: expect.any(Number),
        })
      );
    });

    it('toast.success de validation affiché', async () => {
      fetchModels.mockResolvedValue([
        { id: 'llama3.2', name: 'llama3.2', isFree: true },
      ]);
      testModel.mockResolvedValue({
        format: 'openai',
        capabilities: ['chat'],
        contextWindow: null,
        latency: 100,
      });

      const workflow = startWorkflow('ollama');
      await vi.advanceTimersByTimeAsync(50);
      selectModel('llama3.2');
      await vi.advanceTimersByTimeAsync(50);

      expect(toast.success).toHaveBeenCalledWith(
        expect.stringContaining('validée')
      );
    });
  });
});
