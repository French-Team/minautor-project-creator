// @vitest-environment jsdom
/**
 * Tests unitaires — traceLogger.js
 * Vérifie le système de traçage centralisé : helpers, buffer FIFO, format mixte, no-op en prod.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

// Stub VITE_CHAT_DEBUG=true AVANT l'import du module (CHAT_DEBUG est figé à l'import).
// vi.stubEnv doit être appelé avant que import.meta.env soit évalué.
vi.hoisted(() => {
  vi.stubEnv('VITE_CHAT_DEBUG', 'true');
});

let traceChat;
let tracePromptEngine;
let traceOptimizer;
let traceAiClient;
let traceSystemPrompt;

beforeAll(async () => {
  // Force un re-import après le stubEnv pour que CHAT_DEBUG soit évalué avec VITE_CHAT_DEBUG=true
  vi.resetModules();
  const mod = await import('./traceLogger.js');
  traceChat = mod.traceChat;
  tracePromptEngine = mod.tracePromptEngine;
  traceOptimizer = mod.traceOptimizer;
  traceAiClient = mod.traceAiClient;
  traceSystemPrompt = mod.traceSystemPrompt;
});

describe('traceLogger (CHAT_DEBUG=true)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    if (typeof window !== 'undefined' && window.__CHAT_LOG_BUFFER) {
      window.__CHAT_LOG_BUFFER.length = 0;
    }
  });

  it('traceChat émet un log console avec préfixe [CHAT]', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    traceChat('sendMessage ENTRY', { text: 'hello' });
    expect(spy).toHaveBeenCalled();
    // Première ligne : "[CHAT] [+<n>ms] sendMessage ENTRY"
    expect(spy.mock.calls[0][0]).toMatch(/^\[CHAT\] \[\+\d+ms\] sendMessage ENTRY$/);
  });

  it('traceChat ajoute au buffer __CHAT_LOG_BUFFER', () => {
    traceChat('onToken', { tokenLen: 5 });
    expect(window.__CHAT_LOG_BUFFER).toHaveLength(1);
    expect(window.__CHAT_LOG_BUFFER[0]).toMatchObject({
      prefix: '[CHAT]',
      event: 'onToken',
      data: { tokenLen: 5 },
    });
  });

  it('buffer est limité à 500 entrées (FIFO)', () => {
    for (let i = 0; i < 600; i++) {
      traceChat('test', { i });
    }
    expect(window.__CHAT_LOG_BUFFER).toHaveLength(500);
    // Les 100 premières entrées sont évincées (FIFO)
    expect(window.__CHAT_LOG_BUFFER[0].data.i).toBe(100);
  });

  it('tracePromptEngine utilise le préfixe [PROMPT-ENGINE]', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    tracePromptEngine('cache HIT', { cacheKey: 'analysis-abc' });
    expect(spy.mock.calls[0][0]).toMatch(/^\[PROMPT-ENGINE\]/);
    expect(window.__CHAT_LOG_BUFFER[0].prefix).toBe('[PROMPT-ENGINE]');
  });

  it('traceOptimizer utilise le préfixe [OPTIMIZER]', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    traceOptimizer('optimizeResponse SUCCESS', { tokensSaved: 100 });
    expect(spy.mock.calls[0][0]).toMatch(/^\[OPTIMIZER\]/);
    expect(window.__CHAT_LOG_BUFFER[0].prefix).toBe('[OPTIMIZER]');
  });

  it('traceAiClient utilise le préfixe [AI-CLIENT]', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    traceAiClient('chatCompletion fetch OK', { status: 200 });
    expect(spy.mock.calls[0][0]).toMatch(/^\[AI-CLIENT\]/);
    expect(window.__CHAT_LOG_BUFFER[0].prefix).toBe('[AI-CLIENT]');
  });

  it('traceSystemPrompt utilise le préfixe [SYSTEM-PROMPT]', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    traceSystemPrompt('buildSystemMessages REPLACE', { promptLen: 420 });
    expect(spy.mock.calls[0][0]).toMatch(/^\[SYSTEM-PROMPT\]/);
    expect(window.__CHAT_LOG_BUFFER[0].prefix).toBe('[SYSTEM-PROMPT]');
  });

  it('format mixte : première ligne + console.groupCollapsed() pour détails (avec data)', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const groupSpy = vi.spyOn(console, 'groupCollapsed').mockImplementation(() => {});
    const groupEndSpy = vi.spyOn(console, 'groupEnd').mockImplementation(() => {});
    traceChat('onToken', { tokenLen: 5, cumLen: 10 });
    // 1 console.log (header) + 3 console.log (event, data, time) = 4 appels
    expect(logSpy).toHaveBeenCalledTimes(4);
    expect(groupSpy).toHaveBeenCalledWith(expect.stringContaining('[CHAT] details'));
    expect(groupEndSpy).toHaveBeenCalled();
  });

  it('pas de console.group() si pas de data', () => {
    const groupSpy = vi.spyOn(console, 'groupCollapsed').mockImplementation(() => {});
    traceChat('event simple');
    // Quand data === undefined, seul un console.log est émis (pas de groupe)
    expect(groupSpy).not.toHaveBeenCalled();
  });

  it('les entrées du buffer exposent ts, elapsedMs, prefix, event, data', () => {
    traceChat('test', { foo: 'bar' });
    const entry = window.__CHAT_LOG_BUFFER[0];
    expect(typeof entry.ts).toBe('number');
    expect(typeof entry.elapsedMs).toBe('number');
    expect(entry.prefix).toBe('[CHAT]');
    expect(entry.event).toBe('test');
    expect(entry.data).toEqual({ foo: 'bar' });
  });
});

describe('traceLogger (CHAT_DEBUG=false)', () => {
  let traceChatOff;
  let traceAiClientOff;

  beforeAll(async () => {
    // Re-import avec VITE_CHAT_DEBUG=false
    vi.stubEnv('VITE_CHAT_DEBUG', 'false');
    vi.resetModules();
    const mod = await import('./traceLogger.js');
    traceChatOff = mod.traceChat;
    traceAiClientOff = mod.traceAiClient;
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    if (typeof window !== 'undefined' && window.__CHAT_LOG_BUFFER) {
      window.__CHAT_LOG_BUFFER.length = 0;
    }
  });

  it('traceChat ne fait rien (no-op) quand CHAT_DEBUG=false', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    traceChatOff('test', { x: 1 });
    expect(logSpy).not.toHaveBeenCalled();
    // Le buffer peut toujours recevoir l'entrée (push après no-op ? NON : _emit n'est pas appelé)
    // → le buffer reste vide
  });

  it('traceAiClient ne fait rien (no-op) quand CHAT_DEBUG=false', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    traceAiClientOff('test', { x: 1 });
    expect(logSpy).not.toHaveBeenCalled();
  });
});
