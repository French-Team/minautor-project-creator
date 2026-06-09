/**
 * Tests unitaires — envLoader.js
 *
 * Mock fetch pour /api/env endpoint. Mock localStorage pour les tests
 * qui pourraient en dépendre indirectement.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// --- Mock fetch ---
const fetchMock = vi.fn();
globalThis.fetch = fetchMock;

// --- Mock console.warn pour capturer les warnings ---
const warnMock = vi.fn();
vi.stubGlobal('console', {
  ...console,
  warn: warnMock,
});

// --- Import après mocks ---
import {
  loadEnvKeys,
  getApiKeyForEnvKey,
  hasApiKey,
  invalidateCache,
} from './envLoader.js';

describe('envLoader — loadEnvKeys', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    warnMock.mockReset();
    // Invalider le cache avant chaque test
    invalidateCache();
  });

  it('charge les clés depuis /api/env et met en cache', async () => {
    const envData = {
      OPENROUTER_API_KEY: 'sk-or-...',
      GROQ_API_KEY: 'gsk_...',
      GEMINI_API_KEY: 'AIza...',
    };
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => envData,
    });

    const result = await loadEnvKeys();

    expect(fetchMock).toHaveBeenCalledWith('/api/env');
    expect(result).toEqual(envData);
    expect(result.OPENROUTER_API_KEY).toBe('sk-or-...');
    expect(result.GROQ_API_KEY).toBe('gsk_...');
  });

  it('utilise le cache après le premier appel (pas de nouveau fetch)', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ KEY_ONE: 'value1' }),
    });

    await loadEnvKeys();
    await loadEnvKeys(); // 2e appel — doit utiliser le cache

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retourne un objet vide quand le fetch échoue', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Network error'));

    const result = await loadEnvKeys();

    expect(result).toEqual({});
    expect(warnMock).toHaveBeenCalledWith(
      '[envLoader] Impossible de charger /api/env:',
      'Network error',
    );
  });

  it('retourne un objet vide quand HTTP status est 500', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    const result = await loadEnvKeys();

    expect(result).toEqual({});
    expect(warnMock).toHaveBeenCalledWith(
      '[envLoader] Impossible de charger /api/env:',
      'HTTP 500',
    );
  });

  it('retourne un objet vide quand HTTP status est 404', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    const result = await loadEnvKeys();

    expect(result).toEqual({});
    expect(warnMock).toHaveBeenCalledWith(
      '[envLoader] Impossible de charger /api/env:',
      'HTTP 404',
    );
  });
});

describe('envLoader — getApiKeyForEnvKey', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    warnMock.mockReset();
    invalidateCache();
  });

  it('retourne la clé quand elle existe', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ OPENROUTER_API_KEY: 'sk-or-v2-xxx' }),
    });
    await loadEnvKeys();

    expect(getApiKeyForEnvKey('OPENROUTER_API_KEY')).toBe('sk-or-v2-xxx');
  });

  it('retourne "" quand la clé n existe pas', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ OPENROUTER_API_KEY: 'sk-or-v2-xxx' }),
    });
    await loadEnvKeys();

    expect(getApiKeyForEnvKey('NON_EXISTENT_KEY')).toBe('');
  });

  it('retourne "" quand envKey est null', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ KEY: 'value' }),
    });
    await loadEnvKeys();

    expect(getApiKeyForEnvKey(null)).toBe('');
  });

  it('retourne "" quand envKey est undefined', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ KEY: 'value' }),
    });
    await loadEnvKeys();

    expect(getApiKeyForEnvKey(undefined)).toBe('');
  });

  it('retourne "" quand envKey est une chaîne vide', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ KEY: 'value' }),
    });
    await loadEnvKeys();

    expect(getApiKeyForEnvKey('')).toBe('');
  });

  it('retourne "" quand le cache est vide (loadEnvKeys pas appelé)', () => {
    expect(getApiKeyForEnvKey('SOME_KEY')).toBe('');
  });
});

describe('envLoader — hasApiKey', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    warnMock.mockReset();
    invalidateCache();
  });

  it('retourne true quand le provider a une clé configurée', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ GROQ_API_KEY: 'gsk_live_xxx' }),
    });
    await loadEnvKeys();

    const provider = { id: 'groq', envKey: 'GROQ_API_KEY' };
    expect(hasApiKey(provider)).toBe(true);
  });

  it('retourne false quand le provider n a pas de clé configurée', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ GROQ_API_KEY: '' }),
    });
    await loadEnvKeys();

    const provider = { id: 'groq', envKey: 'GROQ_API_KEY' };
    expect(hasApiKey(provider)).toBe(false);
  });

  it('retourne false quand le provider n a pas de envKey', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ KEY: 'value' }),
    });
    await loadEnvKeys();

    expect(hasApiKey({ id: 'ollama' })).toBe(false);
    expect(hasApiKey({ id: 'ollama', envKey: null })).toBe(false);
    expect(hasApiKey({ id: 'ollama', envKey: '' })).toBe(false);
  });

  it('retourne false quand provider est null', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ KEY: 'value' }),
    });
    await loadEnvKeys();

    expect(hasApiKey(null)).toBe(false);
  });

  it('retourne false quand provider est undefined', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ KEY: 'value' }),
    });
    await loadEnvKeys();

    expect(hasApiKey(undefined)).toBe(false);
  });
});

describe('envLoader — invalidateCache', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    warnMock.mockReset();
    invalidateCache();
  });

  it('invalide le cache et force un nouveau fetch', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ KEY_A: 'value_a' }),
    });

    // Premier chargement
    await loadEnvKeys();
    expect(getApiKeyForEnvKey('KEY_A')).toBe('value_a');

    // Invalider le cache
    invalidateCache();

    // Nouveau fetch avec nouvelles données
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ KEY_B: 'value_b' }),
    });

    const result = await loadEnvKeys();
    expect(result.KEY_B).toBe('value_b');
    expect(getApiKeyForEnvKey('KEY_A')).toBe('');
    expect(getApiKeyForEnvKey('KEY_B')).toBe('value_b');
  });

  it('invalide le cache même si pas encore chargé', () => {
    // Ne doit pas throw
    expect(() => invalidateCache()).not.toThrow();
  });
});