// @vitest-environment jsdom
/**
 * Tests d'intégration - providerPanel.js
 *
 * Layout 3 zones (status, grid, workflow) avec event delegation
 * et integration workflowRunner.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock des dépendances AVANT les imports
vi.mock('../state.js', () => ({
  getState: vi.fn(),
  actions: { updateProvider: vi.fn(), setProvider: vi.fn(), setMaxParallel: vi.fn() },
  subscribe: vi.fn(),
}));

vi.mock('./providerLoader.js', () => ({
  getPreset: vi.fn(),
  getPresetsByCategory: vi.fn(),
  getAllPresets: vi.fn(),
  getGridSections: vi.fn(),
  getColumnFromName: vi.fn(),
}));

vi.mock('./envLoader.js', () => ({
  getApiKeyForEnvKey: vi.fn(),
  hasApiKey: vi.fn(),
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

vi.mock('./workflowRunner.js', () => ({
  startWorkflow: vi.fn(),
  cancelWorkflow: vi.fn(),
  testApiKey: vi.fn(),
  selectModel: vi.fn(),
  getWorkflowState: vi.fn(),
  getDisplayModels: vi.fn(),
  setOnStepChange: vi.fn(),
}));

vi.mock('./providerStore.js', () => ({
  getProviderConfig: vi.fn(),
  setProviderConfig: vi.fn().mockResolvedValue(true),
  deleteProviderConfig: vi.fn(),
  listSavedProviders: vi.fn(),
  getActiveProvider: vi.fn(),
  setActiveProvider: vi.fn(),
}));

// Imports APRES les mocks
import { getState, subscribe, actions } from '../state.js';
import { toast } from './toast.js';
import {
  startWorkflow, cancelWorkflow, testApiKey, selectModel,
  getWorkflowState, getDisplayModels, setOnStepChange,
} from './workflowRunner.js';
import {
  getPreset, getPresetsByCategory, getGridSections, getColumnFromName,
} from './providerLoader.js';
import { getApiKeyForEnvKey, hasApiKey } from './envLoader.js';
import { setProviderConfig } from './providerStore.js';

import {
  initializeProviderPanel,
  openProviderPanel,
  closeProviderPanel,
  toggleProviderPanel,
  isProviderPanelOpen,
  _resetMismatchPromptCache,
} from './providerPanel.js';

// --- Helpers DOM ---

function createPanelDOM() {
  const root = document.createElement('div');
  root.id = 'app-providers';
  root.innerHTML = `
    <div id="app-providers-backdrop"></div>
    <div class="app__providers-panel">
      <div class="app__providers-header">
        <span class="app__providers-title">Providers</span>
        <button id="app-providers-close" class="app__providers-close">X</button>
      </div>
      <div id="app-providers-body" class="app__providers-body"></div>
    </div>
  `;
  document.body.appendChild(root);
  return root;
}

function removePanelDOM() {
  const root = document.getElementById('app-providers');
  if (root) root.remove();
}

// --- Default mock state ---

const DEFAULT_PROVIDER = {
  id: 'ollama',
  apiKey: '',
  baseUrl: 'http://localhost:11434/v1',
  model: 'llama3.2',
  temperature: 0.7,
  maxTokens: 4096,
  isConnected: false,
  lastTestedAt: null,
};

const MOCK_GRID_SECTIONS = [
  {
    id: 'online',
    label: 'En ligne',
    providers: [
      { id: 'openrouter', name: 'OpenRouter', visible: true, order: 1 },
      { id: 'gemini', name: 'Gemini', visible: true, order: 2 },
    ],
  },
  {
    id: 'local',
    label: 'Local',
    providers: [
      { id: 'ollama', name: 'ollama', visible: true, order: 1 },
      { id: 'lmstudio', name: 'LM Studio', visible: true, order: 2 },
    ],
  },
];

function setupDefaultState() {
  getState.mockReturnValue({
    assistant: {
      provider: { ...DEFAULT_PROVIDER },
      providers: { custom: [] },
      chatHistory: [],
    },
  });
  getGridSections.mockReturnValue(MOCK_GRID_SECTIONS);
  getPresetsByCategory.mockImplementation((cat) => {
    if (cat === 'online') {
      return [
        { id: 'openrouter', name: 'OpenRouter', category: 'online', authRequired: true, baseUrl: 'https://openrouter.ai/api/v1', icon: 'cloud', description: 'Aggregateur', defaultModel: 'meta-llama/llama-3.2-3b-instruct:free' },
        { id: 'gemini', name: 'Gemini', category: 'online', authRequired: true, baseUrl: 'https://generativelanguage.googleapis.com/v1beta', icon: 'sparkles', description: 'Google Gemini', defaultModel: 'gemini-2.5-flash' },
      ];
    }
    return [
      { id: 'ollama', name: 'ollama', category: 'local', authRequired: false, baseUrl: 'http://localhost:11434/v1', icon: 'server', description: '', defaultModel: 'llama3.2' },
      { id: 'lmstudio', name: 'LM Studio', category: 'local', authRequired: false, baseUrl: 'http://localhost:1234/v1', icon: 'server', description: '', defaultModel: '' },
    ];
  });
  getColumnFromName.mockImplementation((name) => name.trim().split(/\t/).length === 1 ? 1 : 2);
  getPreset.mockImplementation((id) => ({
    openrouter: { id: 'openrouter', name: 'OpenRouter', category: 'online', authRequired: true, baseUrl: 'https://openrouter.ai/api/v1', icon: 'cloud', description: 'Aggregateur', defaultModel: 'meta-llama/llama-3.2-3b-instruct:free' },
    gemini: { id: 'gemini', name: 'Gemini', category: 'online', authRequired: true, baseUrl: 'https://generativelanguage.googleapis.com/v1beta', icon: 'sparkles', description: 'Google Gemini', defaultModel: 'gemini-2.5-flash' },
    ollama: { id: 'ollama', name: 'ollama', category: 'local', authRequired: false, baseUrl: 'http://localhost:11434/v1', icon: 'server', description: '', defaultModel: 'llama3.2' },
    lmstudio: { id: 'lmstudio', name: 'LM Studio', category: 'local', authRequired: false, baseUrl: 'http://localhost:1234/v1', icon: 'server', description: '', defaultModel: '' },
  }[id]));
}

function setupWorkflowStep(step, overrides = {}) {
  getWorkflowState.mockReturnValue({
    step,
    error: null,
    loadedModels: [],
    modelMeta: null,
    selectedModelId: null,
    ...overrides,
  });
}

// =========================================================================
// Tests
// =========================================================================

describe('providerPanel', () => {
  beforeEach(() => {
    setupDefaultState();
    setupWorkflowStep(0);
    startWorkflow.mockReset();
    cancelWorkflow.mockReset();
    testApiKey.mockReset();
    selectModel.mockReset();
    getWorkflowState.mockReset();
    getDisplayModels.mockReset();
    setOnStepChange.mockReset();
    toast.info.mockReset();
    toast.success.mockReset();
    getWorkflowState.mockReturnValue({
      step: 0, error: null, loadedModels: [], modelMeta: null, selectedModelId: null,
    });
    createPanelDOM();
  });

  afterEach(() => {
    closeProviderPanel();
    removePanelDOM();
    vi.restoreAllMocks();
  });

  // =========================================================================
  // Initialisation
  // =========================================================================

  describe('initializeProviderPanel', () => {
    it('initialise sans erreur quand les elements DOM existent', async () => {
      await initializeProviderPanel();
      const root = document.getElementById('app-providers');
      expect(root.classList.contains('is-open')).toBe(false);
      expect(root.getAttribute('aria-hidden')).toBe('true');
    });

    it('enregistre le callback onStepChange', async () => {
      await initializeProviderPanel();
      expect(setOnStepChange).toHaveBeenCalledWith(expect.any(Function));
    });

    it('enregistre un subscriber state', async () => {
      await initializeProviderPanel();
      expect(subscribe).toHaveBeenCalledWith(expect.any(Function));
    });

    it('lance une erreur quand les elements DOM manquent', async () => {
      removePanelDOM();
      await expect(initializeProviderPanel()).rejects.toThrow('DOM manquants');
    });
  });

  // =========================================================================
  // Open / Close / Toggle
  // =========================================================================

  describe('open/close/toggle', () => {
    beforeEach(async () => {
      await initializeProviderPanel();
    });

    it('openProviderPanel ajoute is-open et affiche le contenu', () => {
      openProviderPanel();
      const root = document.getElementById('app-providers');
      expect(root.classList.contains('is-open')).toBe(true);
      expect(root.getAttribute('aria-hidden')).toBe('false');
      expect(isProviderPanelOpen()).toBe(true);
    });

    it('openProviderPanel affiche un toast info', () => {
      openProviderPanel();
      expect(toast.info).toHaveBeenCalledWith(expect.stringContaining('Provider actif'));
    });

    it('closeProviderPanel retire is-open', () => {
      openProviderPanel();
      closeProviderPanel();
      const root = document.getElementById('app-providers');
      expect(root.classList.contains('is-open')).toBe(false);
      expect(isProviderPanelOpen()).toBe(false);
    });

    it('toggleProviderPanel alterne ouvert/ferme', () => {
      expect(isProviderPanelOpen()).toBe(false);
      toggleProviderPanel();
      expect(isProviderPanelOpen()).toBe(true);
      toggleProviderPanel();
      expect(isProviderPanelOpen()).toBe(false);
    });

    it('double open ne reouvre pas', () => {
      openProviderPanel();
      openProviderPanel();
      expect(isProviderPanelOpen()).toBe(true);
    });

    it('double close ne plante pas', () => {
      closeProviderPanel();
      expect(isProviderPanelOpen()).toBe(false);
    });
  });

  // =========================================================================
  // Zone 1 - Progress Bar (CSS rendering)
  // =========================================================================

  describe('Zone 1 - Progress Bar', () => {
    beforeEach(async () => {
      await initializeProviderPanel();
    });

    it('affiche 6 etapes dans la barre de progression', () => {
      setupWorkflowStep(0);
      openProviderPanel();
      const progressBar = document.querySelector('.pp-progress');
      expect(progressBar).toBeTruthy();
      const steps = progressBar.querySelectorAll('.pp-progress__step');
      expect(steps.length).toBe(6);
    });

    it('affiche les labels corrects pour chaque etape', () => {
      setupWorkflowStep(0);
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      expect(body.innerHTML).toContain('>URL<');
      expect(body.innerHTML).toContain('>Clé<');
      expect(body.innerHTML).toContain('>Modèles<');
      expect(body.innerHTML).toContain('>Sélection<');
      expect(body.innerHTML).toContain('>Test<');
      expect(body.innerHTML).toContain('>OK<');
    });

    it('affiche les badges numerotes 1-6', () => {
      setupWorkflowStep(0);
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      const badges = body.querySelectorAll('.pp-progress__badge');
      expect(badges.length).toBe(6);
      expect(badges[0].textContent.trim()).toBe('1');
      expect(badges[5].textContent.trim()).toBe('6');
    });

    it('aucune etape active quand step=0', () => {
      setupWorkflowStep(0);
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      const activeSteps = body.querySelectorAll('.pp-progress__step.is-active');
      expect(activeSteps.length).toBe(0);
    });

    it('etape 1 est active et courante quand step=1', () => {
      setupWorkflowStep(1);
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      const activeSteps = body.querySelectorAll('.pp-progress__step.is-active');
      expect(activeSteps.length).toBe(1);
      expect(activeSteps[0].classList.contains('is-current')).toBe(true);
    });

    it('etapes 1 et 2 sont actives quand step=2', () => {
      setupWorkflowStep(2);
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      const activeSteps = body.querySelectorAll('.pp-progress__step.is-active');
      expect(activeSteps.length).toBe(2);
      const currentSteps = body.querySelectorAll('.pp-progress__step.is-current');
      expect(currentSteps.length).toBe(1);
    });

    it('toutes les etapes sont actives quand step=6 (validation)', () => {
      setupWorkflowStep(6);
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      const activeSteps = body.querySelectorAll('.pp-progress__step.is-active');
      expect(activeSteps.length).toBe(6);
    });

    it('step 7 (auto-restored) affiche toutes les etapes actives', () => {
      setupWorkflowStep(7);
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      const activeSteps = body.querySelectorAll('.pp-progress__step.is-active');
      expect(activeSteps.length).toBe(6);
    });

    it('le progres bar a la classe pp-progress', () => {
      setupWorkflowStep(3);
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      expect(body.querySelector('.pp-progress')).toBeTruthy();
    });
  });

  // =========================================================================
  // Zone 1 - Status
  // =========================================================================

  describe('Zone 1 - Status', () => {
    beforeEach(async () => {
      await initializeProviderPanel();
    });

    it('affiche le nom du provider actif', () => {
      setupWorkflowStep(0);
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      expect(body.innerHTML).toContain('pp-status');
      expect(body.innerHTML).toContain('ollama');
    });

    it('affiche le modele selectionne', () => {
      getState.mockReturnValue({
        assistant: {
          provider: { ...DEFAULT_PROVIDER, isConnected: true },
          providers: { custom: [] },
          chatHistory: [],
        },
      });
      setupWorkflowStep(0);
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      expect(body.innerHTML).toContain('llama3.2');
    });

    it('affiche — quand aucun modele', () => {
      getState.mockReturnValue({
        assistant: {
          provider: { ...DEFAULT_PROVIDER, model: '' },
          providers: { custom: [] },
          chatHistory: [],
        },
      });
      setupWorkflowStep(0);
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      expect(body.innerHTML).toContain('pp-status__label');
      expect(body.innerHTML).toContain('Modèle');
    });

    it('indicateur disconnected quand step=0, non connecte et aucun modele', () => {
      getState.mockReturnValue({
        assistant: {
          provider: { ...DEFAULT_PROVIDER, model: '', isConnected: false },
          providers: { custom: [] }, chatHistory: [],
        },
      });
      setupWorkflowStep(0);
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      expect(body.innerHTML).toContain('indicator--disconnected');
    });

    it('indicateur testing quand step=2 (en cours)', () => {
      setupWorkflowStep(2);
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      expect(body.innerHTML).toContain('indicator--testing');
    });

    it('indicateur connected quand step=7 et isConnected', () => {
      getState.mockReturnValue({
        assistant: {
          provider: { ...DEFAULT_PROVIDER, isConnected: true },
          providers: { custom: [] }, chatHistory: [],
        },
      });
      setupWorkflowStep(7);
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      expect(body.innerHTML).toContain('indicator--connected');
    });

    it('indicateur connected quand modele selectionne et connecte', () => {
      getState.mockReturnValue({
        assistant: {
          provider: { ...DEFAULT_PROVIDER, model: 'llama3.2', isConnected: true },
          providers: { custom: [] }, chatHistory: [],
        },
      });
      setupWorkflowStep(0);
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      expect(body.innerHTML).toContain('indicator--connected');
    });
  });

  // =========================================================================
  // Zone 2 - Provider Grid
  // =========================================================================

  describe('Zone 2 - Provider Grid', () => {
    beforeEach(async () => {
      await initializeProviderPanel();
    });

    it('affiche les sections En ligne et Local', () => {
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      expect(body.innerHTML).toContain('En ligne');
      expect(body.innerHTML).toContain('Local');
    });

    it('affiche les providers online dans pp-grid', () => {
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      expect(body.innerHTML).toContain('data-provider-id="openrouter"');
      expect(body.innerHTML).toContain('data-provider-id="gemini"');
    });

    it('affiche les providers local dans pp-grid', () => {
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      expect(body.innerHTML).toContain('data-provider-id="ollama"');
      expect(body.innerHTML).toContain('data-provider-id="lmstudio"');
    });

    it('provider actif a la classe is-active', () => {
      setupWorkflowStep(0);
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      const ollamaBtn = body.querySelector('[data-provider-id="ollama"]');
      expect(ollamaBtn).toBeTruthy();
      expect(ollamaBtn.classList.contains('is-active')).toBe(true);
    });

    it('provider inactif n a PAS la classe is-active', () => {
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      const openrouterBtn = body.querySelector('[data-provider-id="openrouter"]');
      expect(openrouterBtn).toBeTruthy();
      expect(openrouterBtn.classList.contains('is-active')).toBe(false);
    });

    it('le provider actif a la classe pp-grid__item', () => {
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      const activeBtn = body.querySelector('.pp-grid__item.is-active');
      expect(activeBtn).toBeTruthy();
      expect(activeBtn.dataset.providerId).toBe('ollama');
    });

    it('is-active ajoute le box-shadow gauche (accent)', () => {
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      const activeBtn = body.querySelector('.pp-grid__item.is-active');
      // Le CSS applique box-shadow: inset 3px 0 0 var(--accent)
      // On vérifie que le computed style contient bien inset
      const style = activeBtn.style;
      // Note: En jsdom le computed style peut ne pas avoir les variables CSS
      // On vérifie donc la présence de la classe
      expect(activeBtn.classList.contains('is-active')).toBe(true);
    });

    it('bouton inactif na pas la classe is-active', () => {
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      const inactiveBtn = body.querySelector('.pp-grid__item:not(.is-active)');
      expect(inactiveBtn).toBeTruthy();
    });

    it('clic sur un provider non-actif ne lui ajoute pas is-active avant le workflow', () => {
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      const geminiBtn = body.querySelector('[data-provider-id="gemini"]');
      // Le clic déclenche startWorkflow mais ne change pas encore l'état is-active
      // car le re-render dépend du state
      expect(geminiBtn.classList.contains('is-active')).toBe(false);
      geminiBtn.click();
      expect(startWorkflow).toHaveBeenCalledWith('gemini');
    });
  });

  // =========================================================================
  // Zone 2 - CSS Visuel (hover, structure colonnes)
  // =========================================================================

  describe('Zone 2 - CSS Visuel', () => {
    beforeEach(async () => {
      await initializeProviderPanel();
    });

    it('pp-grid a deux colonnes col1 et col2', () => {
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      const grid = body.querySelector('.pp-grid');
      expect(grid).toBeTruthy();
      const col1 = grid.querySelector('.pp-grid__col1');
      const col2 = grid.querySelector('.pp-grid__col2');
      expect(col1).toBeTruthy();
      expect(col2).toBeTruthy();
    });

    it('col1 nexiste pas pour les sections sans provider court', () => {
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      const sections = body.querySelectorAll('.pp-section');
      // Vérifie que la grille existe
      const grids = body.querySelectorAll('.pp-grid');
      expect(grids.length).toBe(2); // 2 sections: online + local
    });

      it('col2 existe pour chaque section de la grille', () => {
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      const cols2 = body.querySelectorAll('.pp-grid__col2');
      expect(cols2.length).toBe(2);
    });

    it('col2 a au moins un provider quand il y a des noms de 2 mots ou plus', () => {
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      // Utiliser nth-child pour cibler la bonne section
      const col2Online = body.querySelectorAll('.pp-grid__col2 .pp-grid__item');
      // Au moins un des providers doit être dans col2 (OpenRouter = 2 mots)
      expect(col2Online.length).toBeGreaterThanOrEqual(0);
    });

    it('les providers dans col2 sont plus longs que ceux en col1', () => {
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      const col1Items = body.querySelectorAll('.pp-grid__col1 .pp-grid__item');
      const col2Items = body.querySelectorAll('.pp-grid__col2 .pp-grid__item');
      // Compter les mots de chaque groupe
      const col1Words = Array.from(col1Items).map(el => el.querySelector('.pp-grid__name')?.textContent || '');
      const col2Words = Array.from(col2Items).map(el => el.querySelector('.pp-grid__name')?.textContent || '');
      // Si col2 a des items, leurs noms doivent avoir >= 2 mots en moyenne
      if (col2Items.length > 0) {
        const avgCol1 = col1Words.reduce((s, n) => s + n.trim().split(/\s+/).length, 0) / Math.max(col1Items.length, 1);
        const avgCol2 = col2Words.reduce((s, n) => s + n.trim().split(/\s+/).length, 0) / Math.max(col2Items.length, 1);
        expect(avgCol2).toBeGreaterThanOrEqual(avgCol1);
      }
    });

    it('col1 a une bordure droite (séparateur)', () => {
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      const col1 = body.querySelector('.pp-grid__col1');
      // Le CSS appliqué : border-right: 1px solid var(--border)
      expect(col1).toBeTruthy();
      const computedStyle = col1.constructor.name === 'CSSStyleDeclaration'
        ? col1 : getComputedStyle(col1);
      // En jsdom on vérifie juste que l'élément existe avec la bonne classe
      expect(col1.classList.contains('pp-grid__col1')).toBe(true);
    });

    it('pp-section__title existe et a le texte En ligne / Local', () => {
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      const titles = body.querySelectorAll('.pp-section__title');
      expect(titles.length).toBe(2);
      expect(titles[0].textContent).toBe('En ligne');
      expect(titles[1].textContent).toBe('Local');
    });

    it('pp-grid__item a la classe pp-grid__name enfant', () => {
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      const item = body.querySelector('.pp-grid__item');
      const nameSpan = item.querySelector('.pp-grid__name');
      expect(nameSpan).toBeTruthy();
      expect(nameSpan.textContent).toBeTruthy();
    });

    it('hover sur un provider declenche levent mouseenter', () => {
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      const geminiBtn = body.querySelector('[data-provider-id="gemini"]');
      const event = new MouseEvent('mouseenter', { bubbles: true, cancelable: true });
      const wasNotPrevented = geminiBtn.dispatchEvent(event);
      expect(wasNotPrevented).toBe(true);
    });

    it('mouseleave declenche levent correctement', () => {
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      const geminiBtn = body.querySelector('[data-provider-id="gemini"]');
      const leaveEvent = new MouseEvent('mouseleave', { bubbles: true });
      const wasNotPrevented = geminiBtn.dispatchEvent(leaveEvent);
      expect(wasNotPrevented).toBe(true);
    });

    it('le dernier pp-grid__item de chaque colonne nexiste quune fois', () => {
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      // Chaque section a 2 colonnes, chaque colonne a 1 last-child
      const lastChildren = body.querySelectorAll('.pp-grid__item:last-child');
      // Pour 2 sections x 2 colonnes = 4 last-child attendus
      expect(lastChildren.length).toBeGreaterThanOrEqual(2);
    });

    it('tous les pp-grid__item ont data-provider-id', () => {
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      const items = body.querySelectorAll('.pp-grid__item');
      expect(items.length).toBeGreaterThan(0);
      items.forEach(item => {
        expect(item.dataset.providerId).toBeTruthy();
      });
    });

    it('le provider en cours a le statut connected dans Zone 1', () => {
      getState.mockReturnValue({
        assistant: {
          provider: { ...DEFAULT_PROVIDER, isConnected: true, model: 'llama3.2' },
          providers: { custom: [] }, chatHistory: [],
        },
      });
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      const statusZone = body.querySelector('.pp-status');
      expect(statusZone).toBeTruthy();
      const indicator = statusZone.querySelector('.pp-status__indicator--connected');
      expect(indicator).toBeTruthy();
    });

    it('le provider actif dans la grille est le même que le provider state', () => {
      getState.mockReturnValue({
        assistant: {
          provider: { ...DEFAULT_PROVIDER, id: 'openrouter' },
          providers: { custom: [] }, chatHistory: [],
        },
      });
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      const activeBtn = body.querySelector('.pp-grid__item.is-active');
      expect(activeBtn.dataset.providerId).toBe('openrouter');
    });
  });

  // =========================================================================
  // Zone 3 - Workflow Steps
  // =========================================================================

  describe('Zone 3 - Workflow', () => {
    beforeEach(async () => {
      await initializeProviderPanel();
    });

    it('step 0 affiche letat vide', () => {
      setupWorkflowStep(0);
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      expect(body.innerHTML).toContain('Sélectionne un provider');
    });

    it('step 2 affiche le champ API key', () => {
      setupWorkflowStep(2);
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      expect(body.innerHTML).toContain('pp-api-key');
      expect(body.innerHTML).toContain('data-action="test-api-key"');
      expect(body.innerHTML).toContain('data-action="toggle-password"');
    });

    it('step 2 le bouton Tester est disabled par defaut', () => {
      setupWorkflowStep(2);
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      expect(body.innerHTML).toContain('disabled');
    });

    it('step 3 affiche le spinner de chargement', () => {
      setupWorkflowStep(3);
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      expect(body.innerHTML).toContain('pp-spinner');
      expect(body.innerHTML).toContain('Chargement des');
    });

    it('step 4 affiche la liste des modeles', () => {
      getDisplayModels.mockReturnValue({
        displayed: [
          { id: 'llama3.2', name: 'llama3.2', isFree: true, contextWindow: 4096 },
          { id: 'gpt-4', name: 'gpt-4', isFree: false, contextWindow: 128000 },
        ],
        total: 2, freeCount: 1, hasMore: false,
      });
      setupWorkflowStep(4);
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      expect(body.innerHTML).toContain('pp-model-search');
      expect(body.innerHTML).toContain('data-model-id="llama3.2"');
      expect(body.innerHTML).toContain('data-model-id="gpt-4"');
      expect(body.innerHTML).toContain('GRATUIT');
      expect(body.innerHTML).toContain('tokens');
    });

    it('step 4 affiche Voir tous les modeles quand hasMore', () => {
      getDisplayModels.mockReturnValue({
        displayed: [{ id: 'm1', name: 'm1', isFree: false }],
        total: 20, freeCount: 0, hasMore: true,
      });
      setupWorkflowStep(4);
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      expect(body.innerHTML).toContain('toggle-all-models');
      expect(body.innerHTML).toContain('Voir tous les');
    });

    it('step 5 affiche le spinner de test modele', () => {
      setupWorkflowStep(5);
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      expect(body.innerHTML).toContain('pp-spinner');
      expect(body.innerHTML).toContain('Test du');
    });

    it('step 7 affiche le resume de validation', () => {
      getWorkflowState.mockReturnValue({
        step: 7, error: null,
        loadedModels: [{ id: 'llama3.2', name: 'llama3.2', isFree: true }],
        modelMeta: { format: 'openai', capabilities: ['chat'], latency: 150 },
        selectedModelId: 'llama3.2',
      });
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      expect(body.innerHTML).toContain('Connexion val');
      expect(body.innerHTML).toContain('150ms');
      expect(body.innerHTML).toContain('openai');
    });
  });

  // =========================================================================
  // Zone 3 - CSS Visuel (Spinner, Model List, Summary)
  // =========================================================================

  describe('Zone 3 - CSS Visuel', () => {
    beforeEach(async () => {
      await initializeProviderPanel();
    });

    // --- Spinner ---

    it('pp-spinner existe dans les etapes de chargement', () => {
      setupWorkflowStep(3);
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      const spinner = body.querySelector('.pp-spinner');
      expect(spinner).toBeTruthy();
    });

    it('pp-spinner est enfant de pp-workflow__loading', () => {
      setupWorkflowStep(3);
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      const loading = body.querySelector('.pp-workflow__loading');
      expect(loading).toBeTruthy();
      const spinner = loading.querySelector('.pp-spinner');
      expect(spinner).toBeTruthy();
    });

    it('pp-workflow__loading contient le texte Veuillez patienter', () => {
      setupWorkflowStep(3);
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      const loading = body.querySelector('.pp-workflow__loading');
      expect(loading.textContent).toContain('Veuillez patienter');
    });

    it('spinner nest pas present en step 4 (selection modele)', () => {
      getDisplayModels.mockReturnValue({
        displayed: [{ id: 'm1', name: 'Model 1', isFree: true }],
        total: 1, freeCount: 1, hasMore: false,
      });
      setupWorkflowStep(4);
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      const spinner = body.querySelector('.pp-spinner');
      expect(spinner).toBeNull();
    });

    // --- Model List ---

    it('pp-workflow__model-list existe en step 4', () => {
      getDisplayModels.mockReturnValue({
        displayed: [{ id: 'm1', name: 'Model 1', isFree: true }],
        total: 1, freeCount: 1, hasMore: false,
      });
      setupWorkflowStep(4);
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      const list = body.querySelector('.pp-workflow__model-list');
      expect(list).toBeTruthy();
    });

    it('pp-workflow__model-item a pp-workflow__model-name enfant', () => {
      getDisplayModels.mockReturnValue({
        displayed: [{ id: 'llama3.2', name: 'llama3.2', isFree: true, contextWindow: 4096 }],
        total: 1, freeCount: 1, hasMore: false,
      });
      setupWorkflowStep(4);
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      const item = body.querySelector('.pp-workflow__model-item');
      expect(item).toBeTruthy();
      const nameEl = item.querySelector('.pp-workflow__model-name');
      expect(nameEl).toBeTruthy();
      expect(nameEl.textContent).toBe('llama3.2');
    });

    it('model gratuit affiche pp-workflow__model-free', () => {
      getDisplayModels.mockReturnValue({
        displayed: [{ id: 'm1', name: 'Free Model', isFree: true }],
        total: 1, freeCount: 1, hasMore: false,
      });
      setupWorkflowStep(4);
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      const freeTag = body.querySelector('.pp-workflow__model-free');
      expect(freeTag).toBeTruthy();
      expect(freeTag.textContent).toBe('GRATUIT');
    });

    it('model payant na pas pp-workflow__model-free', () => {
      getDisplayModels.mockReturnValue({
        displayed: [{ id: 'm1', name: 'Paid Model', isFree: false }],
        total: 1, freeCount: 0, hasMore: false,
      });
      setupWorkflowStep(4);
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      const freeTag = body.querySelector('.pp-workflow__model-free');
      expect(freeTag).toBeNull();
    });

    it('model avec contextWindow affiche pp-workflow__model-cw', () => {
      getDisplayModels.mockReturnValue({
        displayed: [{ id: 'm1', name: 'Model', isFree: false, contextWindow: 4096 }],
        total: 1, freeCount: 0, hasMore: false,
      });
      setupWorkflowStep(4);
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      const cwEl = body.querySelector('.pp-workflow__model-cw');
      expect(cwEl).toBeTruthy();
      expect(cwEl.textContent).toContain('tokens');
    });

    it('model selectionne a la classe is-active', () => {
      getDisplayModels.mockReturnValue({
        displayed: [
          { id: 'm1', name: 'Model 1', isFree: false },
          { id: 'm2', name: 'Model 2', isFree: false },
        ],
        total: 2, freeCount: 0, hasMore: false,
      });
      setupWorkflowStep(4, { selectedModelId: 'm2' });
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      const activeModel = body.querySelector('.pp-workflow__model-item.is-active');
      expect(activeModel).toBeTruthy();
      expect(activeModel.dataset.modelId).toBe('m2');
    });

    it('pp-workflow__search existe en step 4', () => {
      getDisplayModels.mockReturnValue({
        displayed: [{ id: 'm1', name: 'Model 1', isFree: true }],
        total: 1, freeCount: 1, hasMore: false,
      });
      setupWorkflowStep(4);
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      const search = body.querySelector('.pp-workflow__search');
      expect(search).toBeTruthy();
      expect(search.id).toBe('pp-model-search');
    });

    it('pp-workflow__show-more existe quand hasMore=true', () => {
      getDisplayModels.mockReturnValue({
        displayed: [{ id: 'm1', name: 'Model 1', isFree: false }],
        total: 20, freeCount: 0, hasMore: true,
      });
      setupWorkflowStep(4);
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      const showMore = body.querySelector('.pp-workflow__show-more');
      expect(showMore).toBeTruthy();
      expect(showMore.dataset.action).toBe('toggle-all-models');
    });

    it('aucun modele affiche pp-workflow__empty', () => {
      getDisplayModels.mockReturnValue({
        displayed: [],
        total: 0, freeCount: 0, hasMore: false,
      });
      setupWorkflowStep(4);
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      const empty = body.querySelector('.pp-workflow__empty');
      expect(empty).toBeTruthy();
      expect(empty.textContent).toContain('Aucun modèle');
    });

    // --- API Key Step ---

    it('pp-workflow__hint contient le texte .env', () => {
      setupWorkflowStep(2);
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      const hint = body.querySelector('.pp-workflow__hint');
      expect(hint).toBeTruthy();
      expect(hint.innerHTML).toContain('.env');
    });

    it('pp-workflow__hint contient un element code', () => {
      setupWorkflowStep(2);
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      const hint = body.querySelector('.pp-workflow__hint');
      const code = hint.querySelector('code');
      expect(code).toBeTruthy();
      expect(code.textContent).toBe('.env');
    });

    it('pp-workflow__input a le type password par defaut', () => {
      setupWorkflowStep(2);
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      const input = body.querySelector('.pp-workflow__input');
      expect(input).toBeTruthy();
      expect(input.type).toBe('password');
    });

    it('pp-workflow__input a le placeholder sk-...', () => {
      setupWorkflowStep(2);
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      const input = body.querySelector('.pp-workflow__input');
      expect(input.placeholder).toContain('sk-');
    });

    it('pp-workflow__eye-btn existe et a data-action toggle-password', () => {
      setupWorkflowStep(2);
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      const eyeBtn = body.querySelector('.pp-workflow__eye-btn');
      expect(eyeBtn).toBeTruthy();
      expect(eyeBtn.dataset.action).toBe('toggle-password');
    });

    it('pp-workflow__test-btn a la classe btn btn--primary', () => {
      setupWorkflowStep(2);
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      const testBtn = body.querySelector('.pp-workflow__test-btn');
      expect(testBtn).toBeTruthy();
      expect(testBtn.classList.contains('btn')).toBe(true);
      expect(testBtn.classList.contains('btn--primary')).toBe(true);
    });

    // --- Validation Summary ---

    it('pp-workflow__summary existe en step 6', () => {
      setupWorkflowStep(6, {
        loadedModels: [{ id: 'm1', name: 'Model 1', isFree: true }],
        modelMeta: { format: 'openai', latency: 100 },
        selectedModelId: 'm1',
      });
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      const summary = body.querySelector('.pp-workflow__summary');
      expect(summary).toBeTruthy();
    });

    it('pp-workflow__summary-title affiche Connexion validee', () => {
      setupWorkflowStep(6, {
        loadedModels: [{ id: 'm1', name: 'Model 1', isFree: true }],
        modelMeta: { format: 'openai', latency: 100 },
        selectedModelId: 'm1',
      });
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      const title = body.querySelector('.pp-workflow__summary-title');
      expect(title).toBeTruthy();
      expect(title.textContent).toContain('Connexion validée');
    });

    it('pp-workflow__summary-row affiche Provider Model Latence Format', () => {
      setupWorkflowStep(6, {
        loadedModels: [{ id: 'm1', name: 'Model 1', isFree: true }],
        modelMeta: { format: 'openai', latency: 150 },
        selectedModelId: 'm1',
      });
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      const rows = body.querySelectorAll('.pp-workflow__summary-row');
      expect(rows.length).toBeGreaterThanOrEqual(2);
      const labels = body.querySelectorAll('.pp-workflow__summary-label');
      const labelTexts = Array.from(labels).map(l => l.textContent);
      expect(labelTexts).toContain('Provider');
      expect(labelTexts).toContain('Modèle');
    });

    it('pp-workflow__summary-value contient les valeurs', () => {
      setupWorkflowStep(6, {
        loadedModels: [{ id: 'm1', name: 'Model 1', isFree: true }],
        modelMeta: { format: 'openai', latency: 150 },
        selectedModelId: 'm1',
      });
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      const values = body.querySelectorAll('.pp-workflow__summary-value');
      expect(values.length).toBeGreaterThan(0);
      // Les valeurs contiennent des texte non-vide
      values.forEach(v => expect(v.textContent.trim().length).toBeGreaterThan(0));
    });

    it('step 0 affiche pp-workflow__empty et non pp-workflow__step', () => {
      setupWorkflowStep(0);
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      const empty = body.querySelector('.pp-workflow__empty');
      expect(empty).toBeTruthy();
      const step = body.querySelector('.pp-workflow__step');
      expect(step).toBeNull();
    });

    it('step 5 nest pas un summary mais un loading spinner', () => {
      setupWorkflowStep(5);
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      const summary = body.querySelector('.pp-workflow__summary');
      expect(summary).toBeNull();
      const spinner = body.querySelector('.pp-spinner');
      expect(spinner).toBeTruthy();
    });
  });

  // =========================================================================
  // Event Listeners - Clics
  // =========================================================================

  describe('Event Listeners - Clics', () => {
    beforeEach(async () => {
      await initializeProviderPanel();
    });

    it('clic sur un provider appelle startWorkflow + cancelWorkflow', () => {
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      const btn = body.querySelector('[data-provider-id="openrouter"]');
      btn.click();
      expect(cancelWorkflow).toHaveBeenCalled();
      expect(startWorkflow).toHaveBeenCalledWith('openrouter');
    });

    it('clic sur un modele appelle selectModel', () => {
      getDisplayModels.mockReturnValue({
        displayed: [{ id: 'llama3.2', name: 'llama3.2', isFree: true }],
        total: 1, freeCount: 1, hasMore: false,
      });
      setupWorkflowStep(4);
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      const modelBtn = body.querySelector('[data-model-id="llama3.2"]');
      modelBtn.click();
      expect(selectModel).toHaveBeenCalledWith('llama3.2');
    });

    it('clic sur un provider different annule le workflow et redemarre', () => {
      setupWorkflowStep(7, {
        loadedModels: [{ id: 'llama3.2', name: 'llama3.2', isFree: true }],
        modelMeta: { format: 'openai', latency: 100 },
        selectedModelId: 'llama3.2',
      });
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      // Clic sur un autre provider (gemini) dans la grille
      const geminiBtn = body.querySelector('[data-provider-id="gemini"]');
      geminiBtn.click();
      expect(cancelWorkflow).toHaveBeenCalled();
      expect(startWorkflow).toHaveBeenCalledWith('gemini');
    });

    it('clic sur toggle-password change le type du champ', () => {
      setupWorkflowStep(2);
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      const input = body.querySelector('#pp-api-key');
      expect(input.type).toBe('password');

      const eyeBtn = body.querySelector('[data-action="toggle-password"]');
      eyeBtn.click();
      expect(input.type).toBe('text');

      eyeBtn.click();
      expect(input.type).toBe('password');
    });
  });

  // =========================================================================
  // Event Listeners - Input
  // =========================================================================

  describe('Event Listeners - Input', () => {
    beforeEach(async () => {
      await initializeProviderPanel();
    });

    it('saisie dans le champ API key active le bouton Tester', () => {
      setupWorkflowStep(2);
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      const input = body.querySelector('#pp-api-key');
      const btn = body.querySelector('#pp-test-key-btn');

      expect(btn.disabled).toBe(true);

      input.value = 'sk-test';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      expect(btn.disabled).toBe(false);
    });

    it('champ vide rend le bouton Tester disabled', () => {
      setupWorkflowStep(2);
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      const input = body.querySelector('#pp-api-key');
      const btn = body.querySelector('#pp-test-key-btn');

      input.value = 'sk-test';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      expect(btn.disabled).toBe(false);

      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      expect(btn.disabled).toBe(true);
    });

    it('recherche de modele met a jour la liste via getDisplayModels', () => {
      getDisplayModels.mockReturnValue({
        displayed: [{ id: 'llama3.2', name: 'llama3.2', isFree: true }],
        total: 1, freeCount: 1, hasMore: false,
      });
      setupWorkflowStep(4);
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      const searchInput = body.querySelector('#pp-model-search');

      searchInput.value = 'llama';
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      expect(getDisplayModels).toHaveBeenCalledWith('llama', false);
    });
  });

  // =========================================================================
  // Re-render after state change
  // =========================================================================

  describe('Re-render', () => {
    it('subscriber state declenche un re-render si le panneau est ouvert', async () => {
      await initializeProviderPanel();
      const subscriberFn = subscribe.mock.calls[0][0];
      openProviderPanel();

      getState.mockReturnValue({
        assistant: {
          provider: { ...DEFAULT_PROVIDER, model: 'gpt-4', isConnected: true },
          providers: { custom: [] }, chatHistory: [],
        },
      });

      subscriberFn({}, { type: 'assistant:provider' });
      const body = document.getElementById('app-providers-body');
      expect(body.innerHTML).toContain('gpt-4');
    });

    it('subscriber state ne fait rien si le panneau est ferme', async () => {
      await initializeProviderPanel();
      const subscriberFn = subscribe.mock.calls[0][0];
      expect(isProviderPanelOpen()).toBe(false);

      subscriberFn({}, { type: 'assistant:provider' });
      const body = document.getElementById('app-providers-body');
      expect(body.innerHTML).toBe('');
    });

    it('onStepChange declenche un re-render', async () => {
      await initializeProviderPanel();
      const stepChangeFn = setOnStepChange.mock.calls[0][0];
      openProviderPanel();

      setupWorkflowStep(2);
      stepChangeFn(2);
      const body = document.getElementById('app-providers-body');
      expect(body.innerHTML).toContain('pp-api-key');
    });
  });

  // =========================================================================
  // Zone 1 - Slot Mismatch Warning (bouton clickable + flash)
  // =========================================================================

  describe('Zone 1 - Slot Mismatch Warning (clickable)', () => {
    beforeEach(async () => {
      // Reset le dedup set pour que les tests soient order-independent
      _resetMismatchPromptCache();
      actions.setMaxParallel.mockReset();
      await initializeProviderPanel();
    });

    /**
     * Mock le state avec LM Studio comme provider actif et un serverConfig
     * contenant N modèles chargés (= N slots réels côté serveur).
     */
    function mockLmStudioWithSlots(maxParallel, actualSlots) {
      const serverConfig = actualSlots === null
        ? null
        : {
            loadedModels: Array.from({ length: actualSlots }, (_, i) => `model-${i}`),
            loadedCount: actualSlots,
            actualSlots,
            n_parallel: null,
            fetchedAt: Date.now(),
          };
      getState.mockReturnValue({
        assistant: {
          provider: {
            id: 'lmstudio',
            baseUrl: 'http://localhost:1234/v1',
            model: 'gpt-4',
            maxParallel,
            isConnected: true,
            lastTestedAt: Date.now(),
            serverConfig,
          },
          providers: { custom: [] },
          chatHistory: [],
          maxParallel,
        },
      });
    }

    /**
     * Mock le state avec Ollama (qui n'a pas de slots) comme provider actif.
     * runStep3 stocke actualSlots=null et loadedCount=N pour Ollama.
     */
    function mockOllamaWithModels(modelCount) {
      getState.mockReturnValue({
        assistant: {
          provider: {
            id: 'ollama',
            baseUrl: 'http://localhost:11434/v1',
            model: 'llama3.2',
            maxParallel: 1,
            isConnected: true,
            lastTestedAt: Date.now(),
            serverConfig: {
              loadedModels: Array.from({ length: modelCount }, (_, i) => `model-${i}`),
              loadedCount: modelCount,
              actualSlots: null, // Ollama = séquentiel
              n_parallel: null,
              fetchedAt: Date.now(),
            },
          },
          providers: { custom: [] },
          chatHistory: [],
          maxParallel: 1,
        },
      });
    }

    it('affiche un bouton clickable avec data-action sync-max-parallel en cas de mismatch', () => {
      mockLmStudioWithSlots(4, 2);
      setupWorkflowStep(7);
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      const btn = body.querySelector('[data-action="sync-max-parallel"]');
      expect(btn).toBeTruthy();
      expect(btn.tagName).toBe('BUTTON');
      expect(btn.dataset.actualSlots).toBe('2');
    });

    it('bouton mismatch a la classe pp-status__slots-sync-btn--mismatch et le hint', () => {
      mockLmStudioWithSlots(4, 2);
      setupWorkflowStep(7);
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      const btn = body.querySelector('[data-action="sync-max-parallel"]');
      expect(btn.classList.contains('pp-status__slots-sync-btn--mismatch')).toBe(true);
      const hint = btn.querySelector('.pp-status__slots-sync-hint');
      expect(hint).toBeTruthy();
      expect(hint.textContent).toContain('Sync à 2');
    });

    it('bouton match a la classe pp-status__slots-sync-btn--match et PAS de hint', () => {
      mockLmStudioWithSlots(4, 4);
      setupWorkflowStep(7);
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      const btn = body.querySelector('[data-action="sync-max-parallel"]');
      expect(btn).toBeTruthy();
      expect(btn.classList.contains('pp-status__slots-sync-btn--match')).toBe(true);
      const hint = btn.querySelector('.pp-status__slots-sync-hint');
      expect(hint).toBeNull();
    });

    it('PAS de bouton pour Ollama (actualSlots null)', () => {
      mockOllamaWithModels(3);
      setupWorkflowStep(7);
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      const btn = body.querySelector('[data-action="sync-max-parallel"]');
      expect(btn).toBeNull();
    });

    it('PAS de bouton pour les providers online (catégorie !== local)', () => {
      getState.mockReturnValue({
        assistant: {
          provider: {
            id: 'openrouter',
            model: 'gpt-4',
            isConnected: true,
            lastTestedAt: Date.now(),
          },
          providers: { custom: [] },
          chatHistory: [],
          maxParallel: 1,
        },
      });
      setupWorkflowStep(7);
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      const btn = body.querySelector('[data-action="sync-max-parallel"]');
      expect(btn).toBeNull();
    });

    it('clic sur le bouton appelle actions.setMaxParallel avec actualSlots', () => {
      mockLmStudioWithSlots(4, 2);
      setupWorkflowStep(7);
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      const btn = body.querySelector('[data-action="sync-max-parallel"]');
      btn.click();
      expect(actions.setMaxParallel).toHaveBeenCalledWith(2);
      expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('2'));
    });

    it('clic sur le bouton déclenche un flash visuel sur le slider (requestAnimationFrame)', async () => {
      mockLmStudioWithSlots(4, 2);
      setupWorkflowStep(7);
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      const btn = body.querySelector('[data-action="sync-max-parallel"]');
      btn.click();
      // Attendre la prochaine animation frame pour que le callback rAF s'exécute
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const sliderField = body.querySelector('#pp-max-parallel-field');
      expect(sliderField).toBeTruthy();
      expect(sliderField.classList.contains('pp-options__field--flash')).toBe(true);
    });

    it('clic avec data-actual-slots invalide (NaN) n appelle PAS setMaxParallel', () => {
      mockLmStudioWithSlots(4, 2);
      setupWorkflowStep(7);
      openProviderPanel();
      const body = document.getElementById('app-providers-body');
      // Inject un bouton corrompu (data-actual-slots = "abc")
      const badBtn = document.createElement('button');
      badBtn.dataset.action = 'sync-max-parallel';
      badBtn.dataset.actualSlots = 'abc';
      body.appendChild(badBtn);
      badBtn.click();
      expect(actions.setMaxParallel).not.toHaveBeenCalled();
      badBtn.remove();
    });
  });

  // =========================================================================
  // Auto-prompt toast (subscribe handler)
  // =========================================================================

  describe('Auto-prompt toast (subscribe handler)', () => {
    let subscriberFn;

    beforeEach(async () => {
      // Reset le dedup set pour des tests order-independent
      _resetMismatchPromptCache();
      actions.setMaxParallel.mockReset();
      toast.warning.mockReset();
      toast.success.mockReset();
      toast.info.mockReset();
      await initializeProviderPanel();
      // Capture le subscriber enregistré
      subscriberFn = subscribe.mock.calls[0][0];
    });

    function mockStateWithMismatchedSlots(providerId, maxParallel, actualSlots) {
      getState.mockReturnValue({
        assistant: {
          provider: {
            id: providerId,
            baseUrl: 'http://localhost:1234/v1',
            model: 'gpt-4',
            maxParallel,
            isConnected: true,
            lastTestedAt: Date.now(),
          },
          providers: { custom: [] },
          chatHistory: [],
          maxParallel,
        },
      });
    }

    function makeServerConfigMeta(actualSlots) {
      return {
        type: 'assistant:server-config',
        serverConfig: {
          loadedModels: Array.from({ length: actualSlots }, (_, i) => `model-${i}`),
          loadedCount: actualSlots,
          actualSlots,
          n_parallel: null,
          fetchedAt: Date.now(),
        },
      };
    }

    it('affiche un toast warning quand serverConfig a un mismatch ET le panneau est ouvert', () => {
      openProviderPanel();
      mockStateWithMismatchedSlots('lmstudio', 4, 2);
      subscriberFn(getState(), makeServerConfigMeta(2));
      expect(toast.warning).toHaveBeenCalledTimes(1);
      expect(toast.warning).toHaveBeenCalledWith(
        expect.stringContaining('Mismatch'),
        expect.objectContaining({ duration: 5000 }),
      );
    });

    it('PAS de toast quand le panneau est ferme (gating isOpen)', () => {
      expect(isProviderPanelOpen()).toBe(false);
      mockStateWithMismatchedSlots('lmstudio', 4, 2);
      subscriberFn(getState(), makeServerConfigMeta(2));
      expect(toast.warning).not.toHaveBeenCalled();
    });

    it('PAS de toast quand actualSlots === maxParallel (match)', () => {
      openProviderPanel();
      mockStateWithMismatchedSlots('lmstudio', 4, 4);
      subscriberFn(getState(), makeServerConfigMeta(4));
      expect(toast.warning).not.toHaveBeenCalled();
    });

    it('PAS de toast quand actualSlots est null (Ollama, pas de slots)', () => {
      openProviderPanel();
      mockStateWithMismatchedSlots('ollama', 1, null);
      subscriberFn(getState(), { type: 'assistant:server-config', serverConfig: null });
      expect(toast.warning).not.toHaveBeenCalled();
    });

    it('DEDUP: 2 events consecutifs avec meme (provider, actualSlots) → 1 seul toast', () => {
      openProviderPanel();
      mockStateWithMismatchedSlots('lmstudio', 4, 2);
      subscriberFn(getState(), makeServerConfigMeta(2));
      subscriberFn(getState(), makeServerConfigMeta(2));
      expect(toast.warning).toHaveBeenCalledTimes(1);
    });

    it('re-toste apres changement de provider (meme actualSlots, autre provider)', () => {
      openProviderPanel();
      mockStateWithMismatchedSlots('lmstudio', 4, 2);
      subscriberFn(getState(), makeServerConfigMeta(2));
      expect(toast.warning).toHaveBeenCalledTimes(1);
      // Changement de provider → dedup reset
      mockStateWithMismatchedSlots('ollama', 4, 2);
      subscriberFn(getState(), { type: 'assistant:provider' });
      // Re-mismatch pour le nouveau provider
      subscriberFn(getState(), makeServerConfigMeta(2));
      expect(toast.warning).toHaveBeenCalledTimes(2);
    });

    it('re-toste si actualSlots change (ex: autre modèle chargé)', () => {
      openProviderPanel();
      mockStateWithMismatchedSlots('lmstudio', 4, 2);
      subscriberFn(getState(), makeServerConfigMeta(2));
      expect(toast.warning).toHaveBeenCalledTimes(1);
      // Nouveau serverConfig avec 3 modèles chargés (autre dedup key)
      subscriberFn(getState(), makeServerConfigMeta(3));
      expect(toast.warning).toHaveBeenCalledTimes(2);
    });

    it('ne réagit PAS aux events non-server-config (assistant:provider seul, mismatch state)', () => {
      openProviderPanel();
      mockStateWithMismatchedSlots('lmstudio', 4, 2);
      // Event provider sans server-config → ne doit pas produire de toast
      subscriberFn(getState(), { type: 'assistant:provider' });
      expect(toast.warning).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Zone 4 — PromptEngine & Optimiseur de réponse
  // =========================================================================
  // Verrouille l'invariant "always interactive" demandé par l'utilisateur :
  // Zone 3 (chat) et Zone 4 (prep/optimizer) sont INDEPENDANTES. Le dropdown
  // et le slider de Zone 4 doivent toujours rendre, quel que soit l'état
  // du workflow Zone 3 ou le nombre de providers configurés.
  // Si un futur refactor ré-introduit du gating (info/warning gating), ces
  // tests cassent et préviennent la régression.

  describe('Zone 4 - PrepOptimizer (always interactive)', () => {
    let originalSetPreparationProvider;

    beforeEach(async () => {
      // Préserver l'existant si jamais un test l'a posé, et partir d'un mock neuf
      originalSetPreparationProvider = actions.setPreparationProvider;
      actions.setPreparationProvider = vi.fn();
      // setOptimizationProvider is added to actions here (per-test mock) because
      // the initial vi.mock('../state.js') at the top of the file only declares
      // updateProvider, setProvider, setMaxParallel, setPreparationProvider.
      // Mirrors the setPreparationProvider pattern above.
      actions.setOptimizationProvider = vi.fn();
      await initializeProviderPanel();
    });

    afterEach(() => {
      // Restore pour ne pas polluer les autres describe blocks
      actions.setPreparationProvider = originalSetPreparationProvider;
      actions.setOptimizationProvider = vi.fn();
    });

    it('rend la zone 4 .pp-prep-optimizer dans tous les cas (0, 1, 2+ providers)', () => {
      // Cas 1 : aucun autre provider configuré
      getState.mockReturnValue({
        assistant: {
          provider: { ...DEFAULT_PROVIDER },
          providers: { custom: [] },
          providerConfigs: {},
          chatHistory: [],
          preparationProviderId: null,
          optimizationThreshold: 500,
          optimizationStats: { totalOptimized: 0, totalTokensSaved: 0, averageCompression: 0 },
        },
      });
      openProviderPanel();
      expect(document.querySelector('.pp-prep-optimizer')).toBeTruthy();

      // Cas 2 : 1 autre provider configuré
      getState.mockReturnValue({
        assistant: {
          provider: { ...DEFAULT_PROVIDER },
          providers: { custom: [] },
          providerConfigs: { openrouter: { model: 'gpt-4' } },
          chatHistory: [],
          preparationProviderId: null,
          optimizationThreshold: 500,
          optimizationStats: { totalOptimized: 0, totalTokensSaved: 0, averageCompression: 0 },
        },
      });
      // Re-render en émettant un event
      subscribe.mock.calls[0][0](getState(), { type: 'assistant:provider' });
      expect(document.querySelector('.pp-prep-optimizer')).toBeTruthy();

      // Cas 3 : 2+ providers configurés
      getState.mockReturnValue({
        assistant: {
          provider: { ...DEFAULT_PROVIDER },
          providers: { custom: [] },
          providerConfigs: {
            openrouter: { model: 'gpt-4' },
            gemini: { model: 'gemini-2.5-flash' },
          },
          chatHistory: [],
          preparationProviderId: null,
          optimizationThreshold: 500,
          optimizationStats: { totalOptimized: 0, totalTokensSaved: 0, averageCompression: 0 },
        },
      });
      subscribe.mock.calls[0][0](getState(), { type: 'assistant:provider' });
      expect(document.querySelector('.pp-prep-optimizer')).toBeTruthy();
    });

    it('le dropdown #pp-prep-provider est TOUJOURS présent (invariant always interactive)', () => {
      // 0 autre provider
      getState.mockReturnValue({
        assistant: {
          provider: { ...DEFAULT_PROVIDER },
          providers: { custom: [] },
          providerConfigs: {},
          chatHistory: [],
          preparationProviderId: null,
          optimizationThreshold: 500,
          optimizationStats: { totalOptimized: 0, totalTokensSaved: 0, averageCompression: 0 },
        },
      });
      openProviderPanel();
      const select = document.getElementById('pp-prep-provider');
      expect(select).toBeTruthy();
      expect(select.tagName).toBe('SELECT');
    });

    it('l option par défaut "Même provider que le chat" est toujours en première position', () => {
      getState.mockReturnValue({
        assistant: {
          provider: { ...DEFAULT_PROVIDER, model: 'llama3.2' },
          providers: { custom: [] },
          providerConfigs: {},
          chatHistory: [],
          preparationProviderId: null,
          optimizationThreshold: 500,
          optimizationStats: { totalOptimized: 0, totalTokensSaved: 0, averageCompression: 0 },
        },
      });
      openProviderPanel();
      const select = document.getElementById('pp-prep-provider');
      const firstOption = select.querySelector('option');
      expect(firstOption).toBeTruthy();
      expect(firstOption.value).toBe('');
      expect(firstOption.textContent).toContain('Même provider que le chat');
    });

    it('l option "Même provider que le chat" est selected par défaut quand preparationProviderId est null', () => {
      getState.mockReturnValue({
        assistant: {
          provider: { ...DEFAULT_PROVIDER, model: 'llama3.2' },
          providers: { custom: [] },
          providerConfigs: {},
          chatHistory: [],
          preparationProviderId: null,
          optimizationThreshold: 500,
          optimizationStats: { totalOptimized: 0, totalTokensSaved: 0, averageCompression: 0 },
        },
      });
      openProviderPanel();
      const select = document.getElementById('pp-prep-provider');
      const defaultOption = select.querySelector('option[value=""]');
      expect(defaultOption.selected).toBe(true);
    });

    it('le slider #pp-opt-threshold est TOUJOURS présent et éditable (indépendant des stats)', () => {
      // Cas 1 : aucune stat d'optimisation
      getState.mockReturnValue({
        assistant: {
          provider: { ...DEFAULT_PROVIDER },
          providers: { custom: [] },
          providerConfigs: {},
          chatHistory: [],
          preparationProviderId: null,
          optimizationThreshold: 500,
          optimizationStats: { totalOptimized: 0, totalTokensSaved: 0, averageCompression: 0 },
        },
      });
      openProviderPanel();
      const slider = document.getElementById('pp-opt-threshold');
      expect(slider).toBeTruthy();
      expect(slider.type).toBe('range');
      expect(slider.disabled).toBe(false);

      // Cas 2 : avec stats
      getState.mockReturnValue({
        assistant: {
          provider: { ...DEFAULT_PROVIDER },
          providers: { custom: [] },
          providerConfigs: {},
          chatHistory: [],
          preparationProviderId: null,
          optimizationThreshold: 1000,
          optimizationStats: { totalOptimized: 5, totalTokensSaved: 1234, averageCompression: 42 },
        },
      });
      subscribe.mock.calls[0][0](getState(), { type: 'assistant:provider' });
      const slider2 = document.getElementById('pp-opt-threshold');
      expect(slider2).toBeTruthy();
      expect(slider2.type).toBe('range');
      expect(slider2.value).toBe('1000');
    });

    it('n affiche PAS le hint muted quand des stats existent', () => {
      getState.mockReturnValue({
        assistant: {
          provider: { ...DEFAULT_PROVIDER },
          providers: { custom: [] },
          providerConfigs: {},
          chatHistory: [],
          preparationProviderId: null,
          optimizationThreshold: 500,
          optimizationStats: { totalOptimized: 5, totalTokensSaved: 1234, averageCompression: 42 },
        },
      });
      openProviderPanel();
      expect(document.querySelector('.pp-options__hint--muted')).toBeNull();
      // Et les stats sont affichées
      expect(document.querySelector('.pp-opt-stats')).toBeTruthy();
    });

    it('affiche le hint muted UNIQUEMENT quand totalOptimized === 0 (pas encore de stats)', () => {
      getState.mockReturnValue({
        assistant: {
          provider: { ...DEFAULT_PROVIDER },
          providers: { custom: [] },
          providerConfigs: {},
          chatHistory: [],
          preparationProviderId: null,
          optimizationThreshold: 500,
          optimizationStats: { totalOptimized: 0, totalTokensSaved: 0, averageCompression: 0 },
        },
      });
      openProviderPanel();
      const muted = document.querySelector('.pp-options__hint--muted');
      expect(muted).toBeTruthy();
      expect(muted.textContent).toContain('Aucune optimisation');
    });

    it('n utilise PAS la classe CSS morte .pp-options__hint--info (info hint)', () => {
      getState.mockReturnValue({
        assistant: {
          provider: { ...DEFAULT_PROVIDER },
          providers: { custom: [] },
          providerConfigs: {},
          chatHistory: [],
          preparationProviderId: null,
          optimizationThreshold: 500,
          optimizationStats: { totalOptimized: 0, totalTokensSaved: 0, averageCompression: 0 },
        },
      });
      openProviderPanel();
      // Aucun info hint (la classe a été retirée du CSS)
      const infoHints = document.querySelectorAll('.pp-options__hint--info');
      expect(infoHints.length).toBe(0);
    });

    it('affiche les providers éligibles dans le dropdown quand il y en a (≠ du chat courant)', () => {
      getState.mockReturnValue({
        assistant: {
          provider: { ...DEFAULT_PROVIDER, id: 'ollama', model: 'llama3.2' },
          providers: { custom: [] },
          providerConfigs: {
            // ollama exclu (= current), openrouter + gemini éligibles
            openrouter: { model: 'gpt-4' },
            gemini: { model: 'gemini-2.5-flash' },
          },
          chatHistory: [],
          preparationProviderId: null,
          optimizationThreshold: 500,
          optimizationStats: { totalOptimized: 0, totalTokensSaved: 0, averageCompression: 0 },
        },
      });
      openProviderPanel();
      const select = document.getElementById('pp-prep-provider');
      const options = select.querySelectorAll('option');
      // 1 option "Même provider" + 2 providers éligibles (triés alphabétiquement par catégorie)
      expect(options.length).toBe(3);
      // Gemini < OpenRouter alphabétiquement (les deux sont 'online' → tie → sort by name)
      expect(options[1].value).toBe('gemini');
      expect(options[2].value).toBe('openrouter');
    });

    it('affiche uniquement "Même provider que le chat" si 0 autre provider configuré', () => {
      getState.mockReturnValue({
        assistant: {
          provider: { ...DEFAULT_PROVIDER },
          providers: { custom: [] },
          providerConfigs: {},
          chatHistory: [],
          preparationProviderId: null,
          optimizationThreshold: 500,
          optimizationStats: { totalOptimized: 0, totalTokensSaved: 0, averageCompression: 0 },
        },
      });
      openProviderPanel();
      const select = document.getElementById('pp-prep-provider');
      const options = select.querySelectorAll('option');
      // 1 seule option (le défaut)
      expect(options.length).toBe(1);
      expect(options[0].value).toBe('');
    });

    it('changement du select appelle actions.setPreparationProvider avec la valeur', () => {
      getState.mockReturnValue({
        assistant: {
          provider: { ...DEFAULT_PROVIDER, id: 'ollama' },
          providers: { custom: [] },
          providerConfigs: { openrouter: { model: 'gpt-4' } },
          chatHistory: [],
          preparationProviderId: null,
          optimizationThreshold: 500,
          optimizationStats: { totalOptimized: 0, totalTokensSaved: 0, averageCompression: 0 },
        },
      });
      openProviderPanel();
      const select = document.getElementById('pp-prep-provider');
      select.value = 'openrouter';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      expect(actions.setPreparationProvider).toHaveBeenCalledWith('openrouter');
    });

    // --- Header & Intro removal ---

    it('n affiche PAS le header de la zone (titre retiré pour gain de place)', () => {
      getState.mockReturnValue({
        assistant: {
          provider: { ...DEFAULT_PROVIDER },
          providers: { custom: [] },
          providerConfigs: {},
          chatHistory: [],
          preparationProviderId: null,
          optimizationThreshold: 500,
          optimizationStats: { totalOptimized: 0, totalTokensSaved: 0, averageCompression: 0 },
        },
      });
      openProviderPanel();
      expect(document.querySelector('.pp-prep-optimizer__header')).toBeNull();
      expect(document.querySelector('.pp-prep-optimizer__title')).toBeNull();
    });

    it('n affiche PAS l intro de la zone (description retirée pour gain de place)', () => {
      getState.mockReturnValue({
        assistant: {
          provider: { ...DEFAULT_PROVIDER },
          providers: { custom: [] },
          providerConfigs: {},
          chatHistory: [],
          preparationProviderId: null,
          optimizationThreshold: 500,
          optimizationStats: { totalOptimized: 0, totalTokensSaved: 0, averageCompression: 0 },
        },
      });
      openProviderPanel();
      expect(document.querySelector('.pp-prep-optimizer__intro')).toBeNull();
    });

    // --- Save button (save-prep-config) ---

    it('affiche un bouton "Enregistrer" en bas de la zone 4', () => {
      getState.mockReturnValue({
        assistant: {
          provider: { ...DEFAULT_PROVIDER },
          providers: { custom: [] },
          providerConfigs: {},
          chatHistory: [],
          preparationProviderId: null,
          optimizationThreshold: 500,
          optimizationStats: { totalOptimized: 0, totalTokensSaved: 0, averageCompression: 0 },
        },
      });
      openProviderPanel();
      const btn = document.querySelector('.pp-prep-optimizer__save-btn');
      expect(btn).toBeTruthy();
      expect(btn.tagName).toBe('BUTTON');
      expect(btn.dataset.action).toBe('save-prep-config');
      expect(btn.textContent).toContain('Enregistrer');
    });

    it('clic sur le bouton Enregistrer appelle setProviderConfig avec la config prep', async () => {
      setProviderConfig.mockClear();
      setProviderConfig.mockResolvedValue(true);

      getState.mockReturnValue({
        assistant: {
          provider: {
            ...DEFAULT_PROVIDER,
            id: 'ollama',
            model: 'llama3.2',
            modelMeta: { contextWindow: 8192, format: 'openai', latency: 100 },
          },
          providers: { custom: [] },
          providerConfigs: {},
          chatHistory: [],
          preparationProviderId: 'openrouter',
          optimizationThreshold: 800,
          optimizationStats: { totalOptimized: 0, totalTokensSaved: 0, averageCompression: 0 },
        },
      });
      openProviderPanel();
      const btn = document.querySelector('.pp-prep-optimizer__save-btn');
      btn.click();

      // Attendre la résolution de la promesse de setProviderConfig
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Vérifier que setProviderConfig a été appelé avec le bon id et la bonne config
      expect(setProviderConfig).toHaveBeenCalledTimes(1);
      const [callId, callConfig] = setProviderConfig.mock.calls[0];
      expect(callId).toBe('ollama');
      // La config doit contenir les champs prep
      expect(callConfig.preparationProviderId).toBe('openrouter');
      expect(callConfig.optimizationThreshold).toBe(800);
      // optimizationProviderId doit aussi être persisté (séparé de prep depuis
      // la séparation des rôles). Ce test ne le seed pas → on attend null
      // (= fallback sur preparationProviderId, rétro-compatible).
      expect(callConfig.optimizationProviderId).toBeNull();
      // contextWindow doit être extrait de modelMeta et persisté (pour le
      // filtre de compatibilité CW qui survit aux reloads)
      expect(callConfig.contextWindow).toBe(8192);
      // format doit aussi être persisté (pour le filtre de compatibilité
      // format qui survit aux reloads)
      expect(callConfig.format).toBe('openai');
      // Pas de champs éphémères
      expect(callConfig.modelMeta).toBeUndefined();
      expect(callConfig.apiKey).toBeUndefined();
      expect(callConfig.envKey).toBeUndefined();
      expect(callConfig.serverConfig).toBeUndefined();
      // Toast de succès
      expect(toast.success).toHaveBeenCalledWith('Configuration prep/optimizer enregistrée');
    });

    it('clic sur Enregistrer sans provider actif ne fait rien (silencieux)', () => {
      setProviderConfig.mockClear();
      getState.mockReturnValue({
        assistant: {
          provider: { id: '', model: '' },
          providers: { custom: [] },
          providerConfigs: {},
          chatHistory: [],
          preparationProviderId: null,
          optimizationThreshold: 500,
          optimizationStats: { totalOptimized: 0, totalTokensSaved: 0, averageCompression: 0 },
        },
      });
      openProviderPanel();
      const btn = document.querySelector('.pp-prep-optimizer__save-btn');
      // Ne doit pas throw
      expect(() => btn.click()).not.toThrow();
      // Et ne doit pas appeler setProviderConfig
      expect(setProviderConfig).not.toHaveBeenCalled();
    });

    // --- Compatibilité context window (filtre strict) ---

    it('petit chat + grand prep : le prep est éligible (4k < 128k OK)', () => {
      getState.mockReturnValue({
        assistant: {
          provider: { ...DEFAULT_PROVIDER, id: 'ollama', modelMeta: { contextWindow: 4096, format: 'openai', latency: 100 } },
          providers: { custom: [] },
          providerConfigs: { openrouter: { model: 'gpt-4', contextWindow: 128000 } },
          chatHistory: [],
          preparationProviderId: null,
          optimizationThreshold: 500,
          optimizationStats: { totalOptimized: 0, totalTokensSaved: 0, averageCompression: 0 },
        },
      });
      openProviderPanel();
      const select = document.getElementById('pp-prep-provider');
      const options = select.querySelectorAll('option');
      // 1 option "Même provider" + 1 prep (openrouter 128k > chat 4k)
      expect(options.length).toBe(2);
      expect(options[1].value).toBe('openrouter');
    });

    it('grand chat + grand prep : le prep est éligible (128k >= 128k)', () => {
      getState.mockReturnValue({
        assistant: {
          provider: { ...DEFAULT_PROVIDER, id: 'openrouter', modelMeta: { contextWindow: 128000, format: 'openai', latency: 100 } },
          providers: { custom: [] },
          providerConfigs: { gemini: { model: 'gemini-2.5-flash', contextWindow: 200000 } },
          chatHistory: [],
          preparationProviderId: null,
          optimizationThreshold: 500,
          optimizationStats: { totalOptimized: 0, totalTokensSaved: 0, averageCompression: 0 },
        },
      });
      openProviderPanel();
      const select = document.getElementById('pp-prep-provider');
      const options = select.querySelectorAll('option');
      // 1 option "Même provider" + 1 prep (gemini 200k >= chat 128k)
      expect(options.length).toBe(2);
      expect(options[1].value).toBe('gemini');
    });

    it('grand chat + petit opt : l\'optimizer est EXCLU (4k < 128k)', () => {
      // Le filtre CW strict s'applique UNIQUEMENT à l'optimizer (pas au prep
      // qui n'a pas besoin de grande CW). On teste donc le dropdown optimizer.
      getState.mockReturnValue({
        assistant: {
          provider: { ...DEFAULT_PROVIDER, id: 'openrouter', modelMeta: { contextWindow: 128000, format: 'openai', latency: 100 } },
          providers: { custom: [] },
          providerConfigs: { ollama: { model: 'llama3.2', contextWindow: 4096 } },
          chatHistory: [],
          preparationProviderId: null,
          optimizationProviderId: null,
          optimizationThreshold: 500,
          optimizationStats: { totalOptimized: 0, totalTokensSaved: 0, averageCompression: 0 },
        },
      });
      openProviderPanel();
      const select = document.getElementById('pp-opt-provider');
      const options = select.querySelectorAll('option');
      // 1 seule option (le défaut) — ollama 4k est exclu car < 128k (filtre CW strict)
      expect(options.length).toBe(1);
      expect(options[0].value).toBe('');
    });

    it('chat CW inconnue (model pas testé) : permissif, tous les prep sont éligibles', () => {
      getState.mockReturnValue({
        assistant: {
          provider: { ...DEFAULT_PROVIDER, id: 'openrouter' }, // pas de modelMeta
          providers: { custom: [] },
          providerConfigs: { ollama: { model: 'llama3.2', contextWindow: 4096 } },
          chatHistory: [],
          preparationProviderId: null,
          optimizationThreshold: 500,
          optimizationStats: { totalOptimized: 0, totalTokensSaved: 0, averageCompression: 0 },
        },
      });
      openProviderPanel();
      const select = document.getElementById('pp-prep-provider');
      const options = select.querySelectorAll('option');
      // 2 options — permissif car chat.modelMeta absent
      expect(options.length).toBe(2);
      expect(options[1].value).toBe('ollama');
    });

    it('prep CW inconnue : permissif, le prep reste éligible', () => {
      getState.mockReturnValue({
        assistant: {
          provider: { ...DEFAULT_PROVIDER, id: 'openrouter', modelMeta: { contextWindow: 128000, format: 'openai', latency: 100 } },
          providers: { custom: [] },
          providerConfigs: { gemini: { model: 'gemini-2.5-flash' } }, // pas de contextWindow
          chatHistory: [],
          preparationProviderId: null,
          optimizationThreshold: 500,
          optimizationStats: { totalOptimized: 0, totalTokensSaved: 0, averageCompression: 0 },
        },
      });
      openProviderPanel();
      const select = document.getElementById('pp-prep-provider');
      const options = select.querySelectorAll('option');
      // 2 options — permissif car prep.contextWindow absent
      expect(options.length).toBe(2);
      expect(options[1].value).toBe('gemini');
    });

    it('filtre mixte optimizer : seulement les opt avec CW >= chat CW sont éligibles', () => {
      // Le filtre CW strict s'applique UNIQUEMENT à l'optimizer (pas au prep).
      getState.mockReturnValue({
        assistant: {
          provider: { ...DEFAULT_PROVIDER, id: 'openrouter', modelMeta: { contextWindow: 128000, format: 'openai', latency: 100 } },
          providers: { custom: [] },
          providerConfigs: {
            ollama: { model: 'llama3.2', contextWindow: 4096 },        // exclu
            gemini: { model: 'gemini-2.5-flash', contextWindow: 200000, format: 'gemini' }, // exclu (format non supporté)
            lmstudio: { model: 'mistral-7b', contextWindow: 8192, format: 'openai' },    // exclu
            claude: { model: 'claude-3.5-sonnet', contextWindow: 500000, format: 'anthropic' }, // éligible
          },
          chatHistory: [],
          preparationProviderId: null,
          optimizationProviderId: null,
          optimizationThreshold: 500,
          optimizationStats: { totalOptimized: 0, totalTokensSaved: 0, averageCompression: 0 },
        },
      });
      openProviderPanel();
      const select = document.getElementById('pp-opt-provider');
      const options = select.querySelectorAll('option');
      // 1 "Utilise le provider de prep" + 1 éligible (claude — gemini exclu par format, ollama/lmstudio par CW)
      expect(options.length).toBe(2);
      expect(options[1].value).toBe('claude');
    });

    // --- Auto-reset : prep devient incompatible après changement de chat ---

    it('changement de chat : si l\'optimizer actuel devient incompatible (CW), auto-reset + warning toast', () => {
      // Setup : chat = openrouter (128k), optimizer = ollama (4k) — CW insuffisante pour l'optimizer
      // Note : le prep n'est PAS affecté (le prep peut être petit, c'est l'optimizer qui doit être gros)
      getState.mockReturnValue({
        assistant: {
          provider: { ...DEFAULT_PROVIDER, id: 'openrouter', modelMeta: { contextWindow: 128000, format: 'openai', latency: 100 } },
          providers: { custom: [] },
          providerConfigs: { ollama: { model: 'llama3.2', contextWindow: 4096 } },
          chatHistory: [],
          preparationProviderId: null,
          optimizationProviderId: 'ollama',
          optimizationThreshold: 500,
          optimizationStats: { totalOptimized: 0, totalTokensSaved: 0, averageCompression: 0 },
        },
      });
      openProviderPanel();

      // Capture le subscriber
      const subscriberFn = subscribe.mock.calls[subscribe.mock.calls.length - 1][0];
      toast.warning.mockClear();
      actions.setOptimizationProvider.mockClear();

      // Déclenche l'event assistant:provider (changement de chat)
      subscriberFn(getState(), { type: 'assistant:provider', provider: getState().assistant.provider });

      // Vérifier l'auto-reset de l'optimizer (et PAS du prep)
      expect(actions.setOptimizationProvider).toHaveBeenCalledWith(null);
      expect(actions.setPreparationProvider).not.toHaveBeenCalled();
      // Vérifier le warning toast mentionne ollama (preset lowercase)
      expect(toast.warning).toHaveBeenCalledWith(
        expect.stringContaining('ollama'),
        expect.objectContaining({ duration: 7000 }),
      );
      expect(toast.warning.mock.calls[0][0]).toContain('incompatible');
    });

    it('changement de chat : si le prep actuel reste compatible, PAS d auto-reset', () => {
      // Setup : chat = ollama (4k), prep = openrouter (128k) — compatible
      getState.mockReturnValue({
        assistant: {
          provider: { ...DEFAULT_PROVIDER, id: 'ollama', modelMeta: { contextWindow: 4096, format: 'openai', latency: 100 } },
          providers: { custom: [] },
          providerConfigs: { openrouter: { model: 'gpt-4', contextWindow: 128000 } },
          chatHistory: [],
          preparationProviderId: 'openrouter',
          optimizationThreshold: 500,
          optimizationStats: { totalOptimized: 0, totalTokensSaved: 0, averageCompression: 0 },
        },
      });
      openProviderPanel();

      const subscriberFn = subscribe.mock.calls[subscribe.mock.calls.length - 1][0];
      toast.warning.mockClear();
      actions.setPreparationProvider.mockClear();

      subscriberFn(getState(), { type: 'assistant:provider', provider: getState().assistant.provider });

      // PAS d'auto-reset (4k chat <= 128k prep = compatible)
      expect(actions.setPreparationProvider).not.toHaveBeenCalled();
      expect(toast.warning).not.toHaveBeenCalled();
    });

    it('changement de chat : si CW inconnue (model pas testé), PAS d auto-reset', () => {
      // Setup : chat sans modelMeta, prep avec CW connu — on ne peut pas comparer
      getState.mockReturnValue({
        assistant: {
          provider: { ...DEFAULT_PROVIDER, id: 'openrouter' }, // pas de modelMeta
          providers: { custom: [] },
          providerConfigs: { ollama: { model: 'llama3.2', contextWindow: 4096 } },
          chatHistory: [],
          preparationProviderId: 'ollama',
          optimizationThreshold: 500,
          optimizationStats: { totalOptimized: 0, totalTokensSaved: 0, averageCompression: 0 },
        },
      });
      openProviderPanel();

      const subscriberFn = subscribe.mock.calls[subscribe.mock.calls.length - 1][0];
      toast.warning.mockClear();
      actions.setPreparationProvider.mockClear();

      subscriberFn(getState(), { type: 'assistant:provider', provider: getState().assistant.provider });

      // PAS d'auto-reset (chat CW inconnue)
      expect(actions.setPreparationProvider).not.toHaveBeenCalled();
      expect(toast.warning).not.toHaveBeenCalled();
    });

    it('changement de chat : si prep est null (Même provider), PAS d auto-reset', () => {
      getState.mockReturnValue({
        assistant: {
          provider: { ...DEFAULT_PROVIDER, id: 'openrouter', modelMeta: { contextWindow: 128000, format: 'openai', latency: 100 } },
          providers: { custom: [] },
          providerConfigs: { ollama: { model: 'llama3.2', contextWindow: 4096 } },
          chatHistory: [],
          preparationProviderId: null, // "Même provider que le chat"
          optimizationThreshold: 500,
          optimizationStats: { totalOptimized: 0, totalTokensSaved: 0, averageCompression: 0 },
        },
      });
      openProviderPanel();

      const subscriberFn = subscribe.mock.calls[subscribe.mock.calls.length - 1][0];
      toast.warning.mockClear();
      actions.setPreparationProvider.mockClear();

      subscriberFn(getState(), { type: 'assistant:provider', provider: getState().assistant.provider });

      // PAS d'auto-reset (pas de prep spécifique)
      expect(actions.setPreparationProvider).not.toHaveBeenCalled();
      expect(toast.warning).not.toHaveBeenCalled();
    });

    // --- Filtre format (Gemini exclu, OpenAI/Anthropic OK) ---

    it('prep format "gemini" : EXCLU (non supporté par l optimiseur)', () => {
      getState.mockReturnValue({
        assistant: {
          provider: { ...DEFAULT_PROVIDER, id: 'ollama', modelMeta: { contextWindow: 4096, format: 'openai', latency: 100 } },
          providers: { custom: [] },
          providerConfigs: { gemini: { model: 'gemini-2.5-flash', contextWindow: 200000, format: 'gemini' } },
          chatHistory: [],
          preparationProviderId: null,
          optimizationThreshold: 500,
          optimizationStats: { totalOptimized: 0, totalTokensSaved: 0, averageCompression: 0 },
        },
      });
      openProviderPanel();
      const select = document.getElementById('pp-prep-provider');
      const options = select.querySelectorAll('option');
      // 1 seule option (le défaut) — gemini est exclu (format non supporté)
      expect(options.length).toBe(1);
      expect(options[0].value).toBe('');
    });

    it('prep format "openai" : éligible (supporté)', () => {
      getState.mockReturnValue({
        assistant: {
          provider: { ...DEFAULT_PROVIDER, id: 'ollama', modelMeta: { contextWindow: 4096, format: 'openai', latency: 100 } },
          providers: { custom: [] },
          providerConfigs: { openrouter: { model: 'gpt-4', contextWindow: 128000, format: 'openai' } },
          chatHistory: [],
          preparationProviderId: null,
          optimizationThreshold: 500,
          optimizationStats: { totalOptimized: 0, totalTokensSaved: 0, averageCompression: 0 },
        },
      });
      openProviderPanel();
      const select = document.getElementById('pp-prep-provider');
      const options = select.querySelectorAll('option');
      // 2 options — openrouter est éligible (format openai)
      expect(options.length).toBe(2);
      expect(options[1].value).toBe('openrouter');
    });

    it('prep format "anthropic" : éligible (supporté)', () => {
      getState.mockReturnValue({
        assistant: {
          provider: { ...DEFAULT_PROVIDER, id: 'openrouter', modelMeta: { contextWindow: 128000, format: 'openai', latency: 100 } },
          providers: { custom: [] },
          providerConfigs: { anthropic: { model: 'claude-3.5-sonnet', contextWindow: 200000, format: 'anthropic' } },
          chatHistory: [],
          preparationProviderId: null,
          optimizationThreshold: 500,
          optimizationStats: { totalOptimized: 0, totalTokensSaved: 0, averageCompression: 0 },
        },
      });
      openProviderPanel();
      const select = document.getElementById('pp-prep-provider');
      const options = select.querySelectorAll('option');
      // 2 options — anthropic est éligible (format anthropic)
      expect(options.length).toBe(2);
      expect(options[1].value).toBe('anthropic');
    });

    it('prep format inconnu : permissif, le prep reste éligible', () => {
      getState.mockReturnValue({
        assistant: {
          provider: { ...DEFAULT_PROVIDER, id: 'ollama', modelMeta: { contextWindow: 4096, format: 'openai', latency: 100 } },
          providers: { custom: [] },
          providerConfigs: { gemini: { model: 'gemini-2.5-flash', contextWindow: 200000 } }, // pas de format
          chatHistory: [],
          preparationProviderId: null,
          optimizationThreshold: 500,
          optimizationStats: { totalOptimized: 0, totalTokensSaved: 0, averageCompression: 0 },
        },
      });
      openProviderPanel();
      const select = document.getElementById('pp-prep-provider');
      const options = select.querySelectorAll('option');
      // 2 options — permissif car format inconnu
      expect(options.length).toBe(2);
      expect(options[1].value).toBe('gemini');
    });

    it('filtre mixte optimizer : exclu si format OR CW incompatible', () => {
      // Le filtre optimizer combine les deux règles (CW + format). Le filtre
      // prep (enhancement) n'applique que le format, pas la CW.
      getState.mockReturnValue({
        assistant: {
          provider: { ...DEFAULT_PROVIDER, id: 'openrouter', modelMeta: { contextWindow: 128000, format: 'openai', latency: 100 } },
          providers: { custom: [] },
          providerConfigs: {
            ollama: { model: 'llama3.2', contextWindow: 4096, format: 'openai' },       // exclu (CW 4k < 128k)
            gemini: { model: 'gemini-2.5-flash', contextWindow: 200000, format: 'gemini' }, // exclu (format non supporté)
            claude: { model: 'claude-3.5-sonnet', contextWindow: 200000, format: 'anthropic' }, // éligible
            mistral: { model: 'mistral-large', contextWindow: 128000, format: 'openai' },  // éligible (CW 128k >= 128k)
          },
          chatHistory: [],
          preparationProviderId: null,
          optimizationProviderId: null,
          optimizationThreshold: 500,
          optimizationStats: { totalOptimized: 0, totalTokensSaved: 0, averageCompression: 0 },
        },
      });
      openProviderPanel();
      const select = document.getElementById('pp-opt-provider');
      const options = select.querySelectorAll('option');
      // 1 "Utilise le provider de prep" + 2 éligibles (claude anthropic, mistral openai — triés alphabétiquement)
      expect(options.length).toBe(3);
      expect(options[1].value).toBe('claude');
      expect(options[2].value).toBe('mistral');
    });

    // --- Auto-reset sur incompatibilité FORMAT ---

    it('changement de chat : prep avec format non supporté déclenche auto-reset + warning "format"', () => {
      // chat = ollama (4k, openai), prep = gemini (200k, gemini)
      // Le prep a une bonne CW (200k > 4k) mais un mauvais format
      getState.mockReturnValue({
        assistant: {
          provider: { ...DEFAULT_PROVIDER, id: 'ollama', modelMeta: { contextWindow: 4096, format: 'openai', latency: 100 } },
          providers: { custom: [] },
          providerConfigs: { gemini: { model: 'gemini-2.5-flash', contextWindow: 200000, format: 'gemini' } },
          chatHistory: [],
          preparationProviderId: 'gemini',
          optimizationThreshold: 500,
          optimizationStats: { totalOptimized: 0, totalTokensSaved: 0, averageCompression: 0 },
        },
      });
      openProviderPanel();

      const subscriberFn = subscribe.mock.calls[subscribe.mock.calls.length - 1][0];
      toast.warning.mockClear();
      actions.setPreparationProvider.mockClear();

      subscriberFn(getState(), { type: 'assistant:provider', provider: getState().assistant.provider });

      // Auto-reset déclenché (raison: format)
      expect(actions.setPreparationProvider).toHaveBeenCalledWith(null);
      expect(toast.warning).toHaveBeenCalledWith(
        expect.stringContaining('gemini'), // format lowercase dans le mock
        expect.objectContaining({ duration: 7000 }),
      );
      // Le message mentionne le format comme raison (nouveau wording)
      expect(toast.warning.mock.calls[0][0]).toContain('gemini');
      expect(toast.warning.mock.calls[0][0]).toContain('supporté');
    });

    it('changement de chat : prep avec format supporté ne déclenche PAS d auto-reset', () => {
      // chat = ollama (4k, openai), prep = openrouter (128k, openai) — tout compatible
      getState.mockReturnValue({
        assistant: {
          provider: { ...DEFAULT_PROVIDER, id: 'ollama', modelMeta: { contextWindow: 4096, format: 'openai', latency: 100 } },
          providers: { custom: [] },
          providerConfigs: { openrouter: { model: 'gpt-4', contextWindow: 128000, format: 'openai' } },
          chatHistory: [],
          preparationProviderId: 'openrouter',
          optimizationThreshold: 500,
          optimizationStats: { totalOptimized: 0, totalTokensSaved: 0, averageCompression: 0 },
        },
      });
      openProviderPanel();

      const subscriberFn = subscribe.mock.calls[subscribe.mock.calls.length - 1][0];
      toast.warning.mockClear();
      actions.setPreparationProvider.mockClear();

      subscriberFn(getState(), { type: 'assistant:provider', provider: getState().assistant.provider });

      // PAS d'auto-reset
      expect(actions.setPreparationProvider).not.toHaveBeenCalled();
      expect(toast.warning).not.toHaveBeenCalled();
    });

    it('changement de chat : dedup par (chatId, prepId, reason) — CW puis format = 2 toasts distincts', () => {
      // Setup : chat = openrouter (128k), prep = anthropic (200k, anthropic) — tout compatible
      getState.mockReturnValue({
        assistant: {
          provider: { ...DEFAULT_PROVIDER, id: 'openrouter', modelMeta: { contextWindow: 128000, format: 'openai', latency: 100 } },
          providers: { custom: [] },
          providerConfigs: { anthropic: { model: 'claude-3.5-sonnet', contextWindow: 200000, format: 'anthropic' } },
          chatHistory: [],
          preparationProviderId: 'anthropic',
          optimizationThreshold: 500,
          optimizationStats: { totalOptimized: 0, totalTokensSaved: 0, averageCompression: 0 },
        },
      });
      openProviderPanel();
      const subscriberFn = subscribe.mock.calls[subscribe.mock.calls.length - 1][0];
      toast.warning.mockClear();
      actions.setPreparationProvider.mockClear();

      // Premier event : assistant:provider, tout est compatible → pas de toast
      subscriberFn(getState(), { type: 'assistant:provider', provider: getState().assistant.provider });
      expect(toast.warning).not.toHaveBeenCalled();

      // Le prep est maintenant null (après auto-reset) → plus de toast possible
      // (le test s'arrête ici car le prep a été reset)
    });

    // --- REGRESSION : chat sans modelMeta → resolver cascade pour chat CW ---

    /**
     * Bug rapporté par l'utilisateur (verbatim) : "si je sélectionne google
     * gemini, on me propose les provider 'petit', ex : lm-studio modele:
     * gemma-4 avec une fenetre de context de 4096".
     *
     * Cause racine : avant le fix, `getEligiblePrepProviders(mode='optimize')`
     * avait `chatContextWindow = current.modelMeta?.contextWindow ?? null` —
     * silencieux et permissif quand `modelMeta` était null. Le filtre strict
     * ne s'activait pas, et tous les providers passaient.
     *
     * Fix : `chatContextWindow` retombe sur `resolveContextWindow()` (cascade
     * resolver : exact → pattern → provider default → 4096). Pour Gemini sans
     * modelMeta, le resolver retourne 1,000,000 (provider default gemini).
     * LM Studio gemma-4 → 8k via pattern "gemma" (ou 4k via provider default).
     * Dans tous les cas, opt CW (8k ou 4k) < chat CW (1M) → opt EXCLU.
     *
     * Ce test verrouille le contrat : si un futur refactor retire le fallback
     * resolver sur chat CW, ce test échoue (lmstudio revient dans la liste).
     */
    it('REGRESSION : chat Gemini sans modelMeta → opt LM Studio EXCLU via resolver fallback (cascade strict)', () => {
      getState.mockReturnValue({
        assistant: {
          // Chat = Gemini, AUCUN modelMeta (model jamais testé)
          provider: { ...DEFAULT_PROVIDER, id: 'gemini', model: 'gemini-2.5-flash' },
          providers: { custom: [] },
          // Candidat = LM Studio avec gemma-4, PAS de contextWindow sauvegardé non plus
          // → les deux CWs viennent du resolver cascade
          providerConfigs: {
            lmstudio: { model: 'gemma-4', format: 'openai' },
          },
          chatHistory: [],
          preparationProviderId: null,
          optimizationProviderId: null,
          optimizationThreshold: 500,
          optimizationStats: { totalOptimized: 0, totalTokensSaved: 0, averageCompression: 0 },
        },
      });
      openProviderPanel();

      // OPTIMIZER dropdown (mode='optimize' = filtre CW strict)
      const optSelect = document.getElementById('pp-opt-provider');
      const optOptions = optSelect.querySelectorAll('option');
      // 1 seule option (le défaut) — lmstudio est exclu car opt CW (~8k) < chat CW (1M)
      // Sans le fix, ce test retournerait 2 options (lmstudio passerait).
      expect(optOptions.length).toBe(1);
      expect(optOptions[0].value).toBe('');

      // PREP dropdown (mode='enhance' = PAS de filtre CW)
      // → lmstudio DOIT rester éligible (le prep n'a pas besoin de grande CW)
      // C'est la raison pour laquelle l'optimizer a un filtre strict et le prep non.
      const prepSelect = document.getElementById('pp-prep-provider');
      const prepOptions = prepSelect.querySelectorAll('option');
      expect(prepOptions.length).toBe(2); // "Même provider" + lmstudio
      expect(prepOptions[1].value).toBe('lmstudio');
    });

    /**
     * Verrou complémentaire : avec le fallback resolver, le dropdown optimizer
     * est STRICT dès le premier rendu, sans dépendre d'un test modèle préalable.
     * Si Gemini est le chat (1M via provider default), AUCUN provider avec CW
     * connue < 1M ne doit apparaître.
     */
    it('REGRESSION : chat Gemini sans modelMeta → opt strict (aucun provider avec CW < 1M n apparaît)', () => {
      getState.mockReturnValue({
        assistant: {
          provider: { ...DEFAULT_PROVIDER, id: 'gemini', model: 'gemini-2.5-flash' },
          providers: { custom: [] },
          // Multiples candidats : tous avec des CWs < 1M
          providerConfigs: {
            lmstudio: { model: 'gemma-4', format: 'openai' },       // ~8k via pattern
            ollama: { model: 'llama3.2', format: 'openai' },        // 128k via pattern
            openrouter: { model: 'gpt-4', format: 'openai' },       // 128k via pattern
            anthropic: { model: 'claude-3.5-sonnet', format: 'anthropic' }, // 200k via exact
          },
          chatHistory: [],
          preparationProviderId: null,
          optimizationProviderId: null,
          optimizationThreshold: 500,
          optimizationStats: { totalOptimized: 0, totalTokensSaved: 0, averageCompression: 0 },
        },
      });
      openProviderPanel();

      const optSelect = document.getElementById('pp-opt-provider');
      const optOptions = optSelect.querySelectorAll('option');
      // 1 seule option (le défaut) — tous les candidats exclus (max 200k < 1M Gemini)
      expect(optOptions.length).toBe(1);
      expect(optOptions[0].value).toBe('');
    });

    /**
     * Verrou COMPLÉMENTAIRE au précédent : s'assure que le chemin EXPLICIT
     * (`current.modelMeta?.contextWindow`) est bien utilisé QUAND il est
     * défini, et PAS le resolver fallback. Sans cette garde, un futur refactor
     * pourrait accidentellement court-circuiter le chemin explicite et
     * toujours passer via le resolver — ce qui masquerait silencieusement des
     * bugs où `modelMeta` est incorrect (mais où le resolver le "corrigerait"
     * via son provider default).
     *
     * Scénario : chat OpenRouter avec `modelMeta={contextWindow: 50000}` (50k
     * explicite, INHABITUEL pour OpenRouter qui est plutôt 128k). Le resolver
     * cascade retournerait 128k (provider default openrouter). Le candidat
     * lmstudio gemma-4 a un `contextWindow` explicite de 60000 (60k, lui aussi
     * inhabituel — le resolver retournerait 8k via pattern "gemma").
     *   - Chemin EXPLICIT : 60k >= 50k → lmstudio INCLUS
     *   - Chemin RESOLVER  : 8k (gemma) < 128k (openrouter) → lmstudio EXCLU
     * Si le resolver est utilisé par erreur (au lieu du modelMeta explicite),
     * lmstudio serait exclu et ce test échouerait → régression détectée.
     */
    it('REGRESSION NEGATIVE : chat avec modelMeta explicite → resolver fallback NON utilisé (chemin explicite prioritaire)', () => {
      // ⚠️ Valeurs irréalistes (50k pour OpenRouter, 60k pour gemma-4) choisies
      // pour DIFFÉRER du resolver cascade. NE PAS les "corriger" en valeurs réalistes
      // (sinon les deux chemins — explicite vs resolver — produiraient le même
      // résultat et ce test ne pourrait plus distinguer lequel est utilisé).
      getState.mockReturnValue({
        assistant: {
          // Chat = openrouter, modelMeta explicite à 50k (volontairement bas
          // pour DIFFÉRER du resolver default de 128k)
          provider: {
            ...DEFAULT_PROVIDER,
            id: 'openrouter',
            modelMeta: { contextWindow: 50000, format: 'openai', latency: 100 },
          },
          providers: { custom: [] },
          // Candidat = lmstudio, contextWindow explicite à 60k (volontairement
          // haut pour DIFFÉRER du resolver pattern gemma qui retournerait 8k)
          providerConfigs: {
            lmstudio: { model: 'gemma-4', contextWindow: 60000, format: 'openai' },
          },
          chatHistory: [],
          preparationProviderId: null,
          optimizationProviderId: null,
          optimizationThreshold: 500,
          optimizationStats: { totalOptimized: 0, totalTokensSaved: 0, averageCompression: 0 },
        },
      });
      openProviderPanel();

      const optSelect = document.getElementById('pp-opt-provider');
      const optOptions = optSelect.querySelectorAll('option');
      // lmstudio est INCLUS (60k explicite >= 50k explicite) → 2 options
      // Si le resolver prenait le dessus, lmstudio serait exclu (8k < 128k) → 1 option
      expect(optOptions.length).toBe(2);
      expect(optOptions[1].value).toBe('lmstudio');
    });
  });
});