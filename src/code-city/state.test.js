/**
 * Tests unitaires — state.js (actions providers / assistant)
 *
 * Mock fetch pour la persistance JSON (plus de localStorage).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// --- Mock fetch pour persistance JSON (/api/state) ---
const fetchMock = vi.fn();
globalThis.fetch = fetchMock;
// Mock fetch pour retourner une promesse résolue (fire-and-forget)
fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });

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

// --- Import AFTER mocks ---
import { getState, actions } from './state.js';

describe('state — actions.setProvider', () => {
  beforeEach(() => {
    fetchMock.mockClear();
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
    actions.setProvider('ollama');
  });

  it('change le provider avec un preset ID et pre-popule le modele depuis defaultModel', () => {
    actions.setProvider('groq');
    const state = getState();
    expect(state.assistant.provider.id).toBe('groq');
    expect(state.assistant.provider.baseUrl).toBe('https://api.groq.com/openai/v1');
    // Le modele est pre-rempli depuis validation-models.json pour groq
    expect(state.assistant.provider.model).toBe('llama-3.1-8b-instant');
  });

  it('préserve envKey si on change vers le même provider', () => {
    actions.updateProvider({ envKey: 'GROQ_API_KEY' });
    actions.setProvider('groq');
    const state = getState();
    // On a changé de provider (ollama → groq), envKey vient du preset
    expect(state.assistant.provider.envKey).toBe('GROQ_API_KEY');
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

  it('calcule la colonne à partir du nom (pas de champ column stocké)', () => {
    actions.setProvider('kilo');
    const state = getState();
    // Le provider n'a plus de champ column — la grille le calcule depuis le nom
    expect(state.assistant.provider.column).toBeUndefined();
    expect(state.assistant.provider.id).toBe('kilo');
  });
});

describe('state — actions.updateProvider', () => {
  beforeEach(() => {
    fetchMock.mockClear();
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
    actions.setProvider('ollama');
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
    actions.updateProvider({ model: 'llama3', temperature: 0.1 });
    const p = getState().assistant.provider;
    expect(p.model).toBe('llama3');
    expect(p.temperature).toBe(0.1);
  });
});

describe('state — actions.addCustomProvider / removeCustomProvider', () => {
  beforeEach(() => {
    fetchMock.mockClear();
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
    actions.setProvider('ollama');
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
    expect(state.assistant.provider.id).toBe('my-llm');
  });

  it('ignore les doublons d ID', () => {
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

  it('ignore la suppression dun ID inexistant', () => {
    actions.addCustomProvider({ id: 'a', name: 'A', baseUrl: 'https://a.com' });
    actions.removeCustomProvider('nonexistent');
    expect(getState().assistant.providers.custom).toHaveLength(1);
  });
});

describe('state — persistance', () => {
  // Nouvelle architecture : seul le chat est persisté via /api/state.
  // Les configs provider sont dans data/providers/{id}.json via "💾 Enregistrer".
  // setProvider/updateProvider ne font que de la mémoire + save active provider ID.

  beforeEach(() => {
    fetchMock.mockClear();
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
    actions.setProvider('ollama');
    // Clear the fetch call from setProvider's setActiveProvider
    fetchMock.mockClear();
    getState().assistant.providers.custom = [];
  });

  it('setProvider ne persist PLUS via /api/state (écrit /api/active-provider)', () => {
    actions.setProvider('groq');
    // NE DOIT PAS appeler /api/state (plus d'auto-persist)
    const stateCalls = fetchMock.mock.calls.filter(c => c[0] === '/api/state');
    expect(stateCalls.length).toBe(0);
    // DOIT appeler /api/active-provider (sauvegarde de l'ID uniquement)
    expect(fetchMock).toHaveBeenCalledWith('/api/active-provider', expect.objectContaining({
      method: 'POST',
    }));
  });

  it('updateProvider ne persist PLUS du tout (mémoire seulement)', () => {
    actions.updateProvider({ model: 'llama3' });
    expect(fetchMock).not.toHaveBeenCalled();
    // Mais la valeur est bien en mémoire
    expect(getState().assistant.provider.model).toBe('llama3');
  });

  it('addCustomProvider ne persist PLUS via /api/state', () => {
    actions.addCustomProvider({ id: 'custom1', name: 'Custom', baseUrl: 'https://c.com' });
    // NE DOIT PAS appeler /api/state
    const stateCalls = fetchMock.mock.calls.filter(c => c[0] === '/api/state');
    expect(stateCalls.length).toBe(0);
    // Mais le provider est bien en mémoire
    expect(getState().assistant.providers.custom).toHaveLength(1);
  });

  it('la config provider reste en mémoire après setProvider', () => {
    actions.setProvider('groq');
    const state = getState();
    expect(state.assistant.provider.id).toBe('groq');
    expect(state.assistant.provider.model).toBe('llama-3.1-8b-instant'); // defaultModel du preset groq
  });

  it('pushChatMessage persist via /api/state (chat seulement)', () => {
    actions.pushChatMessage({
      role: 'user',
      content: 'Bonjour',
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/state', expect.objectContaining({
      method: 'POST',
    }));
    const lastCall = fetchMock.mock.calls.at(-1);
    const body = JSON.parse(lastCall[1].body);
    // Le body doit contenir chatHistory mais PAS provider/providers/providerConfigs
    expect(body.chatHistory).toBeDefined();
    expect(body.provider).toBeUndefined();
    expect(body.providers).toBeUndefined();
    expect(body.providerConfigs).toBeUndefined();
  });
});