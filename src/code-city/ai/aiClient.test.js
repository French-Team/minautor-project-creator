/**
 * Tests unitaires — aiClient.js
 * Vérifie les fonctions d'appel API LLM (mock fetch).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildEndpointUrl,
  formatGeminiRequest,
  parseGeminiResponse,
  parseOpenAIResponse,
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

  it('génère la bonne URL pour Mistral avec modèle codestral', () => {
    const url = buildEndpointUrl({ id: 'mistral', baseUrl: 'https://api.mistral.ai/v1', model: 'codestral-latest' });
    expect(url).toBe('https://api.mistral.ai/v1/chat/completions');
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
  it('envoie prefix+suffix au format Mistral FIM', async () => {
    const mockResponse = {
      choices: [{ message: { content: 'a + b' } }],
      usage: { prompt_tokens: 30, completion_tokens: 5 },
    };

    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const provider = {
      id: 'mistral',
      baseUrl: 'https://api.mistral.ai/v1',
      apiKey: 'test-key',
      model: 'codestral-latest',
      temperature: 0.2,
      maxTokens: 4096,
    };

    const result = await fimCompletion(provider, 'def add(a, b):\n    return ', '\n\nprint(add(2, 3))');

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.mistral.ai/v1/fim/completions',
      expect.objectContaining({ method: 'POST' })
    );

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.prompt).toBe('def add(a, b):\n    return ');
    expect(body.suffix).toBe('\n\nprint(add(2, 3))');
    expect(body.model).toBe('codestral-latest');
    expect(result.content).toBe('a + b');
  });

  it('rejette les providers non-Mistral (ex: OpenRouter)', async () => {
    const provider = { id: 'openrouter', baseUrl: 'https://openrouter.ai/api/v1' };

    await expect(
      fimCompletion(provider, 'prefix', 'suffix')
    ).rejects.toThrow('FIM n\'est supporté que par Mistral');
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

// --- parseOpenAIResponse ---

describe('parseOpenAIResponse', () => {
  it('extrait le contenu d\'une réponse OpenAI (choices[0].message.content)', () => {
    const data = {
      choices: [{ message: { content: 'Réponse OpenAI' } }],
      usage: { prompt_tokens: 10, completion_tokens: 5 },
    };
    const result = parseOpenAIResponse(data);
    expect(result.content).toBe('Réponse OpenAI');
    expect(result.usage).toEqual({ promptTokens: 10, completionTokens: 5 });
  });

  it('extrait le contenu d\'une réponse OpenCode Zen (output: string)', () => {
    const data = {
      output: 'Réponse OpenCode',
      usage: { prompt_tokens: 8, completion_tokens: 4 },
    };
    const result = parseOpenAIResponse(data);
    expect(result.content).toBe('Réponse OpenCode');
    expect(result.usage).toEqual({ promptTokens: 8, completionTokens: 4 });
  });

  it('extrait le contenu d\'une réponse OpenCode Zen (output: { content })', () => {
    const data = {
      output: { content: 'Réponse via output.content' },
      usage: { prompt_tokens: 12, completion_tokens: 6 },
    };
    const result = parseOpenAIResponse(data);
    expect(result.content).toBe('Réponse via output.content');
  });

  it('extrait le contenu d\'une réponse OpenCode Zen (output: array d\'items message)', () => {
    // Format réel observé : { output: [{ type: "message", content: [{ type: "output_text", text: "..." }] }] }
    const data = {
      id: 'resp-abc',
      object: 'response',
      model: 'deepseek-v4-flash',
      output: [
        { type: 'reasoning', summary: [] },
        {
          type: 'message',
          content: [
            { type: 'output_text', text: 'Les chats sont très mignons.' },
          ],
        },
      ],
      stop_reason: 'end_turn',
      usage: { input_tokens: 85, output_tokens: 10, total_tokens: 95 },
    };
    const result = parseOpenAIResponse(data);
    expect(result.content).toBe('Les chats sont très mignons.');
    // input_tokens/output_tokens (Anthropic-style) sont mappés sur prompt/completion
    expect(result.usage).toEqual({ promptTokens: 85, completionTokens: 10 });
  });

  it('concatène les .text de plusieurs items type=message dans output[]', () => {
    const data = {
      output: [
        { type: 'message', content: [{ type: 'output_text', text: 'Hello ' }] },
        { type: 'message', content: [{ type: 'output_text', text: 'world ' }] },
        { type: 'message', content: [{ type: 'output_text', text: '!' }] },
      ],
    };
    const result = parseOpenAIResponse(data);
    expect(result.content).toBe('Hello world !');
  });

  it('ignore les items de type non-message (reasoning, function_call)', () => {
    const data = {
      output: [
        { type: 'reasoning', summary: 'thinking...' },
        { type: 'function_call', name: 'foo', arguments: '{}' },
        { type: 'message', content: [{ type: 'output_text', text: 'final answer' }] },
      ],
    };
    const result = parseOpenAIResponse(data);
    expect(result.content).toBe('final answer');
  });

  it('extrait le texte d\'un format deepseek reasoning avec .content[].text[] profondément imbriqués', () => {
    // Format réel deepseek-v4-flash (OpenCode Zen) :
    //   - item reasoning avec summary[] imbriqué
    //   - item message avec content[] de plusieurs parts (output_text + annotations)
    //   - usage avec input_tokens/output_tokens (Anthropic-style)
    const data = {
      id: 'resp-deepseek-xyz',
      object: 'response',
      model: 'deepseek-v4-flash',
      created_at: 1717600000,
      output: [
        {
          type: 'reasoning',
          id: 'rs_1',
          summary: [
            { type: 'summary_text', text: 'User asked about cats' },
          ],
        },
        {
          type: 'message',
          id: 'msg_2',
          status: 'completed',
          role: 'assistant',
          content: [
            { type: 'output_text', text: 'Les chats', annotations: [] },
            { type: 'output_text', text: ' sont très', annotations: [] },
            { type: 'output_text', text: ' mignons.', annotations: [] },
          ],
        },
      ],
      stop_reason: 'end_turn',
      usage: {
        input_tokens: 42,
        output_tokens: 18,
        total_tokens: 60,
      },
    };
    const result = parseOpenAIResponse(data);
    // Les 3 parts .text du message sont concaténés dans l'ordre
    expect(result.content).toBe('Les chats sont très mignons.');
    // Usage Anthropic-style mappé sur le format unifié
    expect(result.usage).toEqual({ promptTokens: 42, completionTokens: 18 });
  });

  it('extrait le texte d\'un message avec content mixte (text + non-text) en filtrant les parts non textuelles', () => {
    // Format avec parts hétérogènes : output_text, refusals, etc.
    const data = {
      output: [
        {
          type: 'message',
          content: [
            { type: 'output_text', text: 'Réponse ' },
            { type: 'refusal', refusal: 'je refuse cette partie' },
            { type: 'output_text', text: 'mixte.' },
            { type: 'image', image_url: 'https://example.com/img.png' },
          ],
        },
      ],
    };
    const result = parseOpenAIResponse(data);
    // Seules les parts .text sont conservées (les autres sont silencieusement ignorées)
    expect(result.content).toBe('Réponse mixte.');
  });

  it('throw une erreur explicite si output: [] avec stop_reason (modèle n\'a rien généré)', () => {
    const data = {
      id: 'resp-123',
      object: 'response',
      model: 'deepseek-v4-flash',
      output: [],
      stop_reason: 'max_output_tokens',
      usage: { input_tokens: 85, output_tokens: 10, total_tokens: 95 },
    };
    expect(() => parseOpenAIResponse(data)).toThrow(/output vide/);
  });

  it('l\'erreur output vide expose stop_reason et usage pour le diagnostic', () => {
    const data = {
      output: [],
      stop_reason: 'quota_exhausted',
      usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
    };
    let err;
    try {
      parseOpenAIResponse(data);
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.message).toContain('output vide');
    expect(err.message).toContain('quota_exhausted');
    expect(err.message).toContain('"input_tokens":0');
  });

  it('fallback stopReason (camelCase) si stop_reason absent', () => {
    const data = { output: [], stopReason: 'content_filter' };
    let err;
    try {
      parseOpenAIResponse(data);
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.message).toContain('content_filter');
  });

  it('throw si ni choices ni output ne sont présents (format inconnu)', () => {
    const data = { id: 'abc', model: 'foo' };
    expect(() => parseOpenAIResponse(data)).toThrow(/Réponse API invalide/);
  });
});
