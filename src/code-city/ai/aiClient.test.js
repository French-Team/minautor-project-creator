/**
 * Tests unitaires — aiClient.js
 * Vérifie les fonctions d'appel API LLM (mock fetch).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildEndpointUrl,
  formatGeminiRequest,
  parseGeminiResponse,
  chatCompletion,
  fimCompletion,
  testConnection,
} from './aiClient.js';

// Mock global fetch
beforeEach(() => {
  vi.restoreAllMocks();
});

// --- buildEndpointUrl ---

describe('buildEndpointUrl', () => {
  it('génère la bonne URL pour OpenRouter', () => {
    const url = buildEndpointUrl({ id: 'openrouter', baseUrl: 'https://openrouter.ai/api/v1', model: 'test' });
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
  });

  it('génère la bonne URL pour Ollama', () => {
    const url = buildEndpointUrl({ id: 'ollama', baseUrl: 'http://localhost:11434/v1', model: 'llama3.2' });
    expect(url).toBe('http://localhost:11434/v1/chat/completions');
  });

  it('génère la bonne URL pour Groq', () => {
    const url = buildEndpointUrl({ id: 'groq', baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b' });
    expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
  });

  it('génère la bonne URL pour Mistral', () => {
    const url = buildEndpointUrl({ id: 'mistral', baseUrl: 'https://api.mistral.ai/v1', model: 'mistral-large-latest' });
    expect(url).toBe('https://api.mistral.ai/v1/chat/completions');
  });

  it('génère la bonne URL pour Codestral', () => {
    const url = buildEndpointUrl({ id: 'codestral', baseUrl: 'https://codestral.mistral.ai/v1', model: 'codestral-latest' });
    expect(url).toBe('https://codestral.mistral.ai/v1/chat/completions');
  });

  it('génère l\'URL REST native pour Gemini', () => {
    const url = buildEndpointUrl({
      id: 'gemini',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
      model: 'gemini-2.5-flash',
      apiKey: 'test-key',
    });
    expect(url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=test-key'
    );
  });
});

// --- formatGeminiRequest ---

describe('formatGeminiRequest', () => {
  it('convertit les messages OpenAI → Gemini', () => {
    const messages = [
      { role: 'system', content: 'Tu es un assistant.' },
      { role: 'user', content: 'Bonjour' },
      { role: 'assistant', content: 'Salut !' },
      { role: 'user', content: 'Comment ça va ?' },
    ];

    const result = formatGeminiRequest(messages, 'gemini-2.5-flash', 0.7, 4096);

    expect(result.systemInstruction).toEqual({ parts: [{ text: 'Tu es un assistant.' }] });
    expect(result.contents).toHaveLength(3);
    expect(result.contents[0]).toEqual({ role: 'user', parts: [{ text: 'Bonjour' }] });
    expect(result.contents[1]).toEqual({ role: 'model', parts: [{ text: 'Salut !' }] });
    expect(result.contents[2]).toEqual({ role: 'user', parts: [{ text: 'Comment ça va ?' }] });
    expect(result.generationConfig).toEqual({ temperature: 0.7, maxOutputTokens: 4096 });
  });

  it('gère les messages sans system prompt', () => {
    const messages = [{ role: 'user', content: 'Test' }];
    const result = formatGeminiRequest(messages, 'test', 0.5, 1024);

    expect(result.systemInstruction).toBeUndefined();
    expect(result.contents).toHaveLength(1);
  });
});

// --- parseGeminiResponse ---

describe('parseGeminiResponse', () => {
  it('extrait le texte et les tokens', () => {
    const data = {
      candidates: [{ content: { parts: [{ text: 'Réponse Gemini' }] } }],
      usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 50 },
    };

    const result = parseGeminiResponse(data);
    expect(result.content).toBe('Réponse Gemini');
    expect(result.usage).toEqual({ promptTokens: 100, completionTokens: 50 });
  });

  it('gère une réponse vide', () => {
    const result = parseGeminiResponse({});
    expect(result.content).toBe('');
    expect(result.usage).toEqual({ promptTokens: 0, completionTokens: 0 });
  });
});

// --- chatCompletion ---

describe('chatCompletion', () => {
  it('appelle l\'API OpenAI-compat avec les bons headers', async () => {
    const mockResponse = {
      choices: [{ message: { content: 'Hello!' } }],
      usage: { prompt_tokens: 10, completion_tokens: 5 },
    };

    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const provider = {
      id: 'openrouter',
      baseUrl: 'https://openrouter.ai/api/v1',
      apiKey: 'test-key',
      model: 'test-model',
      temperature: 0.7,
      maxTokens: 4096,
    };

    const result = await chatCompletion(provider, [
      { role: 'user', content: 'Hi' },
    ]);

    expect(global.fetch).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-key',
        },
      })
    );
    expect(result.content).toBe('Hello!');
    expect(result.usage).toEqual({ promptTokens: 10, completionTokens: 5 });
  });

  it('appelle Gemini avec le bon format', async () => {
    const mockResponse = {
      candidates: [{ content: { parts: [{ text: 'Bonjour!' }] } }],
      usageMetadata: { promptTokenCount: 20, candidatesTokenCount: 10 },
    };

    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const provider = {
      id: 'gemini',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
      apiKey: 'test-key',
      model: 'gemini-2.5-flash',
      temperature: 0.7,
      maxTokens: 4096,
    };

    const result = await chatCompletion(provider, [
      { role: 'user', content: 'Bonjour' },
    ]);

    expect(result.content).toBe('Bonjour!');
    expect(result.usage).toEqual({ promptTokens: 20, completionTokens: 10 });
  });

  it('lève une erreur si HTTP ≥ 400', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: { message: 'Clé API invalide' } }),
    });

    const provider = {
      id: 'openrouter',
      baseUrl: 'https://openrouter.ai/api/v1',
      apiKey: 'bad-key',
      model: 'test',
      temperature: 0.7,
      maxTokens: 4096,
    };

    await expect(
      chatCompletion(provider, [{ role: 'user', content: 'Hi' }])
    ).rejects.toThrow('Clé API invalide');
  });
});

// --- fimCompletion ---

describe('fimCompletion', () => {
  it('envoie prefix+suffix au format Codestral FIM', async () => {
    const mockResponse = {
      choices: [{ message: { content: 'a + b' } }],
      usage: { prompt_tokens: 30, completion_tokens: 5 },
    };

    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const provider = {
      id: 'codestral',
      baseUrl: 'https://codestral.mistral.ai/v1',
      apiKey: 'test-key',
      model: 'codestral-latest',
      temperature: 0.2,
      maxTokens: 4096,
    };

    const result = await fimCompletion(provider, 'def add(a, b):\n    return ', '\n\nprint(add(2, 3))');

    expect(global.fetch).toHaveBeenCalledWith(
      'https://codestral.mistral.ai/v1/fim/completions',
      expect.objectContaining({ method: 'POST' })
    );

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.prompt).toBe('def add(a, b):\n    return ');
    expect(body.suffix).toBe('\n\nprint(add(2, 3))');
    expect(body.model).toBe('codestral-latest');
    expect(result.content).toBe('a + b');
  });

  it('rejette les providers non-Codestral', async () => {
    const provider = { id: 'mistral', baseUrl: 'https://api.mistral.ai/v1' };

    await expect(
      fimCompletion(provider, 'prefix', 'suffix')
    ).rejects.toThrow('FIM n\'est supporté que par Codestral');
  });

  it('rejette les providers non-Mistral (ex: OpenRouter)', async () => {
    const provider = { id: 'openrouter', baseUrl: 'https://openrouter.ai/api/v1' };

    await expect(
      fimCompletion(provider, 'prefix', 'suffix')
    ).rejects.toThrow('FIM n\'est supporté que par Codestral');
  });
});

// --- testConnection ---

describe('testConnection', () => {
  it('retourne { ok: true } si le serveur répond (provider en ligne)', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: 'ok' } }],
        usage: {},
      }),
    });

    const provider = {
      id: 'openrouter',
      baseUrl: 'https://openrouter.ai/api/v1',
      apiKey: 'test-key',
      model: 'test',
      temperature: 0.7,
      maxTokens: 100,
      category: 'online',
    };

    const result = await testConnection(provider);
    expect(result.ok).toBe(true);
    expect(typeof result.latency).toBe('number');
  });

  it('retourne { ok: false, error } si le fetch échoue', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));

    const provider = {
      id: 'ollama',
      baseUrl: 'http://localhost:11434/v1',
      category: 'local',
    };

    const result = await testConnection(provider);
    expect(result.ok).toBe(false);
    expect(result.error).toBe('Network error');
  });
});
