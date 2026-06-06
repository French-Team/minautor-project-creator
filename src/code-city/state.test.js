/**
 * Tests unitaires — state.js (actions providers / assistant)
 *
 * Mock localStorage avant d'importer state.js pour éviter les erreurs JSDOM.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// --- Mock localStorage ---
const storage = {};
const localStorageMock = {
  getItem: vi.fn((key) => storage[key] ?? null),
  setItem: vi.fn((key, value) => { storage[key] = value; }),
  removeItem: vi.fn((key) => { delete storage[key]; }),
  clear: vi.fn(() => { Object.keys(storage).forEach(k => delete storage[k]); }),
};
// @ts-ignore
globalThis.localStorage = localStorageMock;

// Mock window.matchMedia
if (typeof globalThis.matchMedia === 'undefined') {
  // @ts-ignore
  globalThis.matchMedia = () => ({ matches: false });
}

// Mock AbortController (pour testProviderConnection via fetch)
if (typeof globalThis.AbortSignal === 'undefined') {
  // @ts-ignore
  globalThis.AbortSignal = { timeout: () => ({}) };
}

// --- Mock fetch pour testProviderConnection ---
const fetchMock = vi.fn();
globalThis.fetch = fetchMock;

// --- Import AFTER mocks ---
import { getState, actions, registerPresets } from './state.js';
import { PROVIDER_PRESETS } from './ai/providerPresets.js';

describe('state — registerPresets', () => {
  beforeEach(() => {
    registerPresets(PROVIDER_PRESETS);
  });

  it('enregistre les presets sans erreur', () => {
    const state = getState();
    expect(state.assistant).toBeDefined();
    expect(state.assistant.provider).toBeDefined();
  });

  it('le provider par défaut est ollama', () => {
    const state = getState();
    // Si pas de localStorage mocké avec une config, le défaut est ollama
    // (readStoredAssistant retourne null car storage est vide après clear)
    localStorageMock.clear();
    // Re-import impossible (singleton), on vérifie juste la structure
    expect(state.assistant.provider).toHaveProperty('id');
    expect(state.assistant.provider).toHaveProperty('apiKey');
    expect(state.assistant.provider).toHaveProperty('model');
  });
});

describe('state — actions.setProvider', () => {
  beforeEach(() => {
    localStorageMock.clear();
    registerPresets(PROVIDER_PRESETS);
    // Réinitialiser le provider à ollama par défaut
    // (le state est un singleton, on ne peut pas le réinitialiser facilement)
    actions.setProvider('ollama');
  });

  it('change le provider avec un preset ID', () => {
    actions.setProvider('groq');
    const state = getState();
    expect(state.assistant.provider.id).toBe('groq');
    expect(state.assistant.provider.baseUrl).toBe('https://api.groq.com/openai/v1');
    expect(state.assistant.provider.model).toBe('llama-3.3-70b-versatile');
  });

  it('préserve la clé API si on change vers le même provider', () => {
    actions.updateProvider({ apiKey: 'test-key-123' });
    actions.setProvider('groq');
    const state = getState();
    // On a changé de provider (ollama → groq), la clé devrait être réinitialisée
    expect(state.assistant.provider.apiKey).toBe('');
  });

  it('conserve la clé API si on re-sélectionne le même provider', () => {
    // D'abord basculer sur groq, puis définir une clé, puis re-sélectionner groq
    actions.setProvider('groq');
    actions.updateProvider({ apiKey: 'groq-key-456' });
    actions.setProvider('groq'); // même provider — la clé devrait être conservée
    const state = getState();
    expect(state.assistant.provider.apiKey).toBe('groq-key-456');
  });

  it('ignore un ID inconnu', () => {
    const before = { ...getState().assistant.provider };
    actions.setProvider('unknown-provider');
    const after = getState().assistant.provider;
    expect(after.id).toBe(before.id); // inchangé
  });

  it('accepte un objet preset personnalisé', () => {
    const customPreset = {
      id: 'my-custom',
      name: 'My Custom',
      category: 'online',
      baseUrl: 'https://my-api.com/v1',
      defaultModel: 'custom-model',
    };
    actions.setProvider(customPreset);
    expect(getState().assistant.provider.id).toBe('my-custom');
    expect(getState().assistant.provider.baseUrl).toBe('https://my-api.com/v1');
    expect(getState().assistant.provider.model).toBe('custom-model');
  });
});

describe('state — actions.updateProvider', () => {
  beforeEach(() => {
    localStorageMock.clear();
    registerPresets(PROVIDER_PRESETS);
    actions.setProvider('ollama');
  });

  it('met à jour la clé API', () => {
    actions.updateProvider({ apiKey: 'my-secret-key' });
    expect(getState().assistant.provider.apiKey).toBe('my-secret-key');
  });

  it('met à jour le modèle', () => {
    actions.updateProvider({ model: 'llama3.1' });
    expect(getState().assistant.provider.model).toBe('llama3.1');
  });

  it('met à jour la température', () => {
    actions.updateProvider({ temperature: 0.3 });
    expect(getState().assistant.provider.temperature).toBe(0.3);
  });

  it('met à jour maxTokens', () => {
    actions.updateProvider({ maxTokens: 8192 });
    expect(getState().assistant.provider.maxTokens).toBe(8192);
  });

  it('met à jour plusieurs champs en une fois', () => {
    actions.updateProvider({ apiKey: 'key', model: 'model', temperature: 0.1 });
    const p = getState().assistant.provider;
    expect(p.apiKey).toBe('key');
    expect(p.model).toBe('model');
    expect(p.temperature).toBe(0.1);
  });
});

describe('state — actions.addCustomProvider / removeCustomProvider', () => {
  beforeEach(() => {
    localStorageMock.clear();
    registerPresets(PROVIDER_PRESETS);
    actions.setProvider('ollama');
    // Nettoyer les custom providers résiduels
    getState().assistant.providers.custom = [];
  });

  it('ajoute un provider custom', () => {
    actions.addCustomProvider({
      id: 'my-llm',
      name: 'My LLM',
      category: 'online',
      baseUrl: 'https://my-llm.com/v1',
      defaultModel: 'my-model',
    });
    const state = getState();
    expect(state.assistant.providers.custom).toHaveLength(1);
    expect(state.assistant.providers.custom[0].id).toBe('my-llm');
    // Le provider courant devrait être le custom ajouté
    expect(state.assistant.provider.id).toBe('my-llm');
  });

  it('ignore les doublons d\'ID', () => {
    actions.addCustomProvider({ id: 'my-llm', name: 'First', baseUrl: 'https://a.com' });
    actions.addCustomProvider({ id: 'my-llm', name: 'Second', baseUrl: 'https://b.com' });
    expect(getState().assistant.providers.custom).toHaveLength(1);
  });

  it('ignore un provider sans ID ou nom', () => {
    actions.addCustomProvider({ baseUrl: 'https://a.com' });
    expect(getState().assistant.providers.custom).toHaveLength(0);
    actions.addCustomProvider({ id: 'x' });
    expect(getState().assistant.providers.custom).toHaveLength(0);
  });

  it('supprime un provider custom', () => {
    actions.addCustomProvider({ id: 'temp', name: 'Temp', baseUrl: 'https://temp.com' });
    expect(getState().assistant.providers.custom).toHaveLength(1);
    actions.removeCustomProvider('temp');
    expect(getState().assistant.providers.custom).toHaveLength(0);
  });

  it('revient à ollama quand le provider supprimé est actif', () => {
    actions.addCustomProvider({ id: 'temp', name: 'Temp', baseUrl: 'https://temp.com' });
    expect(getState().assistant.provider.id).toBe('temp');
    actions.removeCustomProvider('temp');
    expect(getState().assistant.provider.id).toBe('ollama');
  });

  it('ignore la suppression d\'un ID inexistant', () => {
    actions.addCustomProvider({ id: 'a', name: 'A', baseUrl: 'https://a.com' });
    actions.removeCustomProvider('nonexistent');
    expect(getState().assistant.providers.custom).toHaveLength(1);
  });
});

describe('state — actions.testProviderConnection', () => {
  beforeEach(() => {
    localStorageMock.clear();
    registerPresets(PROVIDER_PRESETS);
    actions.setProvider('ollama');
    // Nettoyer les custom providers résiduels
    getState().assistant.providers.custom = [];
    fetchMock.mockReset();
  });

  it('retourne ok:true pour un provider local qui répond', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ models: [] }),
    });
    const result = await actions.testProviderConnection();
    expect(result.ok).toBe(true);
    expect(result.latency).toBeGreaterThanOrEqual(0);
    expect(getState().assistant.provider.isConnected).toBe(true);
    expect(getState().assistant.provider.lastTestedAt).toBeGreaterThan(0);
  });

  it('retourne ok:false si le fetch échoue', async () => {
    fetchMock.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const result = await actions.testProviderConnection();
    expect(result.ok).toBe(false);
    expect(result.error).toBe('ECONNREFUSED');
    expect(getState().assistant.provider.isConnected).toBe(false);
  });

  it('retourne ok:false si HTTP >= 400', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
    });
    const result = await actions.testProviderConnection();
    expect(result.ok).toBe(false);
  });
});

describe('state — persistAssistant (localStorage)', () => {
  beforeEach(() => {
    localStorageMock.clear();
    registerPresets(PROVIDER_PRESETS);
    actions.setProvider('ollama');
    // Nettoyer les custom providers résiduels des tests précédents
    getState().assistant.providers.custom = [];
  });

  it('sauvegarde dans localStorage au setProvider', () => {
    actions.setProvider('groq');
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'code-city-assistant',
      expect.any(String),
    );
    const saved = JSON.parse(storage['code-city-assistant']);
    expect(saved.provider.id).toBe('groq');
  });

  it('sauvegarde dans localStorage au updateProvider', () => {
    actions.updateProvider({ apiKey: 'key-xyz' });
    const saved = JSON.parse(storage['code-city-assistant']);
    expect(saved.provider.apiKey).toBe('key-xyz');
  });

  it('sauvegarde les custom providers', () => {
    actions.addCustomProvider({ id: 'custom1', name: 'Custom', baseUrl: 'https://c.com' });
    const saved = JSON.parse(storage['code-city-assistant']);
    expect(saved.providers.custom).toHaveLength(1);
    expect(saved.providers.custom[0].id).toBe('custom1');
  });
});
