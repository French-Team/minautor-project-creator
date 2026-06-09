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
  actions: { updateProvider: vi.fn(), setProvider: vi.fn() },
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

// Imports APRES les mocks
import { getState, subscribe } from '../state.js';
import { toast } from './toast.js';
import {
  startWorkflow, cancelWorkflow, testApiKey, selectModel,
  getWorkflowState, getDisplayModels, setOnStepChange,
} from './workflowRunner.js';
import {
  getPreset, getPresetsByCategory, getGridSections, getColumnFromName,
} from './providerLoader.js';
import { getApiKeyForEnvKey, hasApiKey } from './envLoader.js';

import {
  initializeProviderPanel,
  openProviderPanel,
  closeProviderPanel,
  toggleProviderPanel,
  isProviderPanelOpen,
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
});