// @vitest-environment jsdom
/**
 * Tests unitaires — modelContextResolver.js
 *
 * Le resolver cascade est le cœur de la résolution de context window pour
 * tous les providers. La cascade est :
 *   1. API value (passée explicitement par le caller)
 *   2. Table de référence (model-context-windows.json) — match exact
 *   3. Table de référence — match par pattern
 *   4. Provider default (champ defaultContextWindow du provider-configs.json)
 *   5. Fallback dur : 4096
 *
 * Ces tests verrouillent le comportement de la cascade — si quelqu'un modifie
 * la priorité ou la table, ils cassent et préviennent la régression.
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Mock le providerLoader avant l'import (utilisé par le resolver)
import { vi } from 'vitest';
vi.mock('./providerLoader.js', () => ({
  getPreset: vi.fn((id) => {
    const defaults = {
      openrouter: { id: 'openrouter', defaultContextWindow: 128000 },
      gemini: { id: 'gemini', defaultContextWindow: 1000000 },
      ollama: { id: 'ollama', defaultContextWindow: 8192 },
      lmstudio: { id: 'lmstudio', defaultContextWindow: 4096 },
      mistral: { id: 'mistral', defaultContextWindow: 32000 },
      groq: { id: 'groq', defaultContextWindow: 131072 },
      kilo: { id: 'kilo', defaultContextWindow: 128000 },
      'opencode-zen': { id: 'opencode-zen', defaultContextWindow: 128000 },
    };
    return defaults[id] || null;
  }),
}));

import { resolveContextWindow, _clearResolutionCache } from './modelContextResolver.js';

describe('modelContextResolver — cascade behavior', () => {
  beforeEach(() => {
    _clearResolutionCache();
  });

  // =========================================================================
  // 1. API value (priorité maximale)
  // =========================================================================

  it('1. API value a priorité sur la table exact (cas: Gemini inputTokenLimit)', () => {
    // Gemini /v1beta/models retourne inputTokenLimit=1048576 pour gemini-2.5-flash
    // (qui est aussi dans la table exact à 1000000). L'API doit gagner.
    expect(resolveContextWindow({
      modelId: 'gemini-2.5-flash',
      providerId: 'gemini',
      apiValue: 1048576,
    })).toBe(1048576);
  });

  it('2. API value a priorité sur la table pattern', () => {
    expect(resolveContextWindow({
      modelId: 'gemini-1.5-flash-custom',
      providerId: 'gemini',
      apiValue: 500000,
    })).toBe(500000);
  });

  it('3. API value falsy (null, 0, undefined) NE TUE PAS la cascade', () => {
    expect(resolveContextWindow({
      modelId: 'gemini-2.5-flash',
      providerId: 'gemini',
      apiValue: null,
    })).toBe(1000000); // table exact, pas fallback 4096
  });

  // =========================================================================
  // 2. Table exact (case-insensitive)
  // =========================================================================

  it('4. Match exact Gemini : gemini-2.5-flash → 1000000', () => {
    expect(resolveContextWindow({
      modelId: 'gemini-2.5-flash',
      providerId: 'gemini',
      apiValue: null,
    })).toBe(1000000);
  });

  it('5. Match exact OpenAI : gpt-4o → 128000', () => {
    expect(resolveContextWindow({
      modelId: 'gpt-4o',
      providerId: 'openai',
      apiValue: null,
    })).toBe(128000);
  });

  it('6. Match exact Anthropic : claude-3-5-sonnet → 200000', () => {
    expect(resolveContextWindow({
      modelId: 'claude-3-5-sonnet',
      providerId: 'anthropic',
      apiValue: null,
    })).toBe(200000);
  });

  it('7. Match exact case-insensitive (uppercase)', () => {
    expect(resolveContextWindow({
      modelId: 'GPT-4O',
      providerId: 'openai',
      apiValue: null,
    })).toBe(128000);
  });

  // =========================================================================
  // 3. Normalisation du modelId (préfixes provider)
  // =========================================================================

  it('8. Gemini : préfixe "models/" retiré automatiquement', () => {
    expect(resolveContextWindow({
      modelId: 'models/gemini-2.5-flash',
      providerId: 'gemini',
      apiValue: null,
    })).toBe(1000000);
  });

  it('9. OpenRouter : préfixe "openai/" retiré automatiquement', () => {
    expect(resolveContextWindow({
      modelId: 'openai/gpt-4o',
      providerId: 'openrouter',
      apiValue: null,
    })).toBe(128000);
  });

  it('10. OpenRouter : préfixe "anthropic/" retiré automatiquement', () => {
    expect(resolveContextWindow({
      modelId: 'anthropic/claude-3-5-sonnet',
      providerId: 'openrouter',
      apiValue: null,
    })).toBe(200000);
  });

  it('11. OpenRouter : préfixe "meta-llama/" GARDÉ (c\'est le modelId réel)', () => {
    // La table exact contient "meta-llama/llama-3.1-70b-instruct" → 128000.
    // Le resolver ne doit PAS retirer le préfixe "meta-llama".
    expect(resolveContextWindow({
      modelId: 'meta-llama/llama-3.1-70b-instruct',
      providerId: 'openrouter',
      apiValue: null,
    })).toBe(128000);
  });

  // =========================================================================
  // 4. Pattern matching (case-insensitive includes)
  // =========================================================================

  it('12. Pattern : gpt-4o-mini (pas dans exact) → 128000 via pattern "gpt-4o-mini"', () => {
    expect(resolveContextWindow({
      modelId: 'gpt-4o-mini-2024-07-18',
      providerId: 'openai',
      apiValue: null,
    })).toBe(128000);
  });

  it('13. Pattern Ollama : llama3.2 → 128000', () => {
    expect(resolveContextWindow({
      modelId: 'llama3.2:3b',
      providerId: 'ollama',
      apiValue: null,
    })).toBe(128000);
  });

  it('14. Pattern Mistral : mistral:7b → 32000', () => {
    expect(resolveContextWindow({
      modelId: 'mistral:7b',
      providerId: 'ollama',
      apiValue: null,
    })).toBe(32000);
  });

  it('15. Pattern Codestral : codestral-22b → 32000', () => {
    expect(resolveContextWindow({
      modelId: 'codestral:22b',
      providerId: 'ollama',
      apiValue: null,
    })).toBe(32000);
  });

  it('16. Pattern : patterns spécifiques > patterns généraux', () => {
    // gemini-1.5-pro doit matcher le pattern "gemini-1.5-pro" (2000000),
    // pas le pattern général "gemini-1.5" (1000000).
    expect(resolveContextWindow({
      modelId: 'gemini-1.5-pro',
      providerId: 'gemini',
      apiValue: null,
    })).toBe(2000000);
  });

  // =========================================================================
  // 5. Provider default
  // =========================================================================

  it('17. Provider default : modèle inconnu + provider connu → default du provider', () => {
    // "random-unknown-model-xyz" n'est dans aucune table, provider "gemini"
    // → retombe sur providerDefault.gemini = 1000000
    expect(resolveContextWindow({
      modelId: 'random-unknown-model-xyz',
      providerId: 'gemini',
      apiValue: null,
    })).toBe(1000000);
  });

  it('18. Provider default LM Studio : fallback 4096', () => {
    // LM Studio ne peut pas exposer la CW (limitation API), on a mis 4096 en default
    expect(resolveContextWindow({
      modelId: 'some-lm-studio-model',
      providerId: 'lmstudio',
      apiValue: null,
    })).toBe(4096);
  });

  it('19. Provider default Groq : 131072', () => {
    expect(resolveContextWindow({
      modelId: 'unknown-groq-model',
      providerId: 'groq',
      apiValue: null,
    })).toBe(131072);
  });

  // =========================================================================
  // 6. Fallback dur 4096
  // =========================================================================

  it('20. Pas de providerId, modèle inconnu → 4096', () => {
    expect(resolveContextWindow({
      modelId: 'completely-unknown-model',
      providerId: null,
      apiValue: null,
    })).toBe(4096);
  });

  it('21. ProviderId inconnu, modèle inconnu → 4096', () => {
    expect(resolveContextWindow({
      modelId: 'completely-unknown-model',
      providerId: 'fake-provider',
      apiValue: null,
    })).toBe(4096);
  });

  it('22. modelId null/undefined → fallback direct (pas de crash)', () => {
    expect(resolveContextWindow({
      modelId: null,
      providerId: 'gemini',
      apiValue: null,
    })).toBe(1000000);
    expect(resolveContextWindow({
      modelId: undefined,
      providerId: null,
      apiValue: null,
    })).toBe(4096);
  });

  // =========================================================================
  // 7. Cas réels du problème initial (gemma-4 sur LM Studio)
  // =========================================================================

  it('23. Cas réel : gemma-2-9b-it sur LM Studio → 8192 (plus 4096 !)', () => {
    // Le bug initial : gemma-4 sur LM Studio tombait sur 4096 hardcodé.
    // Avec le resolver : pattern "gemma-2-9b" → 8192.
    expect(resolveContextWindow({
      modelId: 'gemma-2-9b-it',
      providerId: 'lmstudio',
      apiValue: null,
    })).toBe(8192);
  });

  it('24. Cas réel : gemini-2.5-flash → 1000000 (vs null avant)', () => {
    // Le bug initial : Gemini modèles avaient contextWindow: null dans le listing.
    // Avec le resolver : exact match → 1000000.
    expect(resolveContextWindow({
      modelId: 'gemini-2.5-flash',
      providerId: 'gemini',
      apiValue: null,
    })).toBe(1000000);
  });

  // =========================================================================
  // 8. Cache (perf — évite de re-calculer pour le même triplet)
  // =========================================================================

  it('25. Cache : 2 appels avec mêmes args → 1 seule résolution (vérifié par le cache)', () => {
    // Le 1er appel résout et cache, le 2e hit le cache.
    // On vérifie que les 2 appels retournent la même valeur (pas de divergence).
    const args = { modelId: 'gpt-4o', providerId: 'openai', apiValue: null };
    const r1 = resolveContextWindow(args);
    const r2 = resolveContextWindow(args);
    expect(r1).toBe(r2);
    expect(r1).toBe(128000);
  });

  it('26. Cache reset : _clearResolutionCache() force une nouvelle résolution', () => {
    resolveContextWindow({ modelId: 'gpt-4o', providerId: 'openai', apiValue: null });
    _clearResolutionCache();
    // Après reset, doit toujours retourner la bonne valeur (pas de crash)
    expect(resolveContextWindow({
      modelId: 'gpt-4o',
      providerId: 'openai',
      apiValue: null,
    })).toBe(128000);
  });
});
