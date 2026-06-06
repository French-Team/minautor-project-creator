/**
 * Tests unitaires — chatHistory.js
 * Vérifie la gestion de l'historique des messages de chat.
 */
import { describe, it, expect } from 'vitest';
import {
  trimHistory,
  estimateTokens,
  estimateHistoryTokens,
  createMessage,
  isEmpty,
  MAX_HISTORY_MESSAGES,
  MAX_HISTORY_CHARS,
} from './chatHistory.js';

describe('MAX_HISTORY_MESSAGES', () => {
  it('est défini à 50', () => {
    expect(MAX_HISTORY_MESSAGES).toBe(50);
  });
});

describe('MAX_HISTORY_CHARS', () => {
  it('est défini à 30000', () => {
    expect(MAX_HISTORY_CHARS).toBe(30000);
  });
});

describe('trimHistory', () => {
  it('garde le system prompt (index 0) même quand on tronque', () => {
    const systemMsg = { role: 'system', content: 'System prompt' };
    const messages = [systemMsg];
    for (let i = 0; i < 60; i++) {
      messages.push({ role: 'user', content: `Message ${i}` });
    }
    const trimmed = trimHistory(messages);
    expect(trimmed[0]).toBe(systemMsg);
  });

  it('tronque au-delà de MAX_HISTORY_MESSAGES', () => {
    const systemMsg = { role: 'system', content: 'System prompt' };
    const messages = [systemMsg];
    for (let i = 0; i < 60; i++) {
      messages.push({ role: 'user', content: `Message ${i}` });
    }
    const trimmed = trimHistory(messages);
    expect(trimmed.length).toBe(MAX_HISTORY_MESSAGES);
  });

  it('ne tronque pas si <= MAX_HISTORY_MESSAGES', () => {
    const messages = [
      { role: 'system', content: 'System prompt' },
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi' },
    ];
    const trimmed = trimHistory(messages);
    expect(trimmed.length).toBe(3);
  });

  it('conserve les derniers messages quand on tronque', () => {
    const systemMsg = { role: 'system', content: 'System prompt' };
    const messages = [systemMsg];
    for (let i = 0; i < 60; i++) {
      messages.push({ role: 'user', content: `Message ${i}` });
    }
    const trimmed = trimHistory(messages);
    // Le dernier message devrait être "Message 59"
    const lastMsg = trimmed[trimmed.length - 1];
    expect(lastMsg.content).toBe('Message 59');
  });
});

describe('estimateTokens', () => {
  it('estime correctement pour du texte français', () => {
    // 4 caractères ≈ 1 token
    expect(estimateTokens('test')).toBe(1);
    expect(estimateTokens('bonjour')).toBe(2); // 7 chars → ceil(7/4) = 2
    expect(estimateTokens('')).toBe(0);
  });

  it('arrondit au supérieur', () => {
    expect(estimateTokens('abc')).toBe(1); // 3/4 = 0.75 → 1
    expect(estimateTokens('abcde')).toBe(2); // 5/4 = 1.25 → 2
  });
});

describe('estimateHistoryTokens', () => {
  it('somme les tokens de tous les messages', () => {
    const messages = [
      { role: 'system', content: 'test' },       // 1 token
      { role: 'user', content: 'bonjour' },       // 2 tokens
      { role: 'assistant', content: 'au revoir' }, // 10/4 = 3 tokens
    ];
    const total = estimateHistoryTokens(messages);
    expect(total).toBe(6); // 1 + 2 + 3
  });

  it('retourne 0 pour un tableau vide', () => {
    expect(estimateHistoryTokens([])).toBe(0);
  });
});

describe('createMessage', () => {
  it('crée un message avec timestamp par défaut', () => {
    const before = Date.now();
    const msg = createMessage('user', 'Hello');
    const after = Date.now();
    expect(msg.role).toBe('user');
    expect(msg.content).toBe('Hello');
    expect(msg.timestamp).toBeGreaterThanOrEqual(before);
    expect(msg.timestamp).toBeLessThanOrEqual(after);
  });

  it('inclut les metadata optionnelles', () => {
    const msg = createMessage('assistant', 'Response', {
      nodesAffected: ['n1', 'n2'],
      actionType: 'suggest',
    });
    expect(msg.metadata.nodesAffected).toEqual(['n1', 'n2']);
    expect(msg.metadata.actionType).toBe('suggest');
  });

  it('utilise des metadata vides par défaut', () => {
    const msg = createMessage('user', 'Test');
    expect(msg.metadata.nodesAffected).toEqual([]);
    expect(msg.metadata.actionType).toBeNull();
  });
});

describe('isEmpty', () => {
  it('retourne true pour null', () => {
    expect(isEmpty(null)).toBe(true);
  });

  it('retourne true pour undefined', () => {
    expect(isEmpty(undefined)).toBe(true);
  });

  it('retourne true pour un tableau vide', () => {
    expect(isEmpty([])).toBe(true);
  });

  it('retourne false pour un tableau non vide', () => {
    expect(isEmpty([{ role: 'user', content: 'Hi' }])).toBe(false);
  });
});
