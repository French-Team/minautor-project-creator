/**
 * Tests unitaires — providerPresets.js
 * Vérifie la structure et la cohérence des presets de providers.
 */
import { describe, it, expect } from 'vitest';
import { PROVIDER_PRESETS } from './providerPresets.js';

describe('PROVIDER_PRESETS', () => {
  it('contient 8 providers', () => {
    expect(PROVIDER_PRESETS.length).toBe(9);
  });

  it('chaque provider a les champs requis', () => {
    const requiredFields = ['id', 'name', 'category', 'baseUrl', 'authRequired', 'defaultModel'];
    for (const preset of PROVIDER_PRESETS) {
      for (const field of requiredFields) {
        expect(preset).toHaveProperty(field);
      }
    }
  });

  it('providers en ligne ont authRequired: true', () => {
    const online = PROVIDER_PRESETS.filter(p => p.category === 'online');
    for (const p of online) {
      expect(p.authRequired).toBe(true);
    }
  });

  it('providers locaux ont authRequired: false', () => {
    const local = PROVIDER_PRESETS.filter(p => p.category === 'local');
    for (const p of local) {
      expect(p.authRequired).toBe(false);
    }
  });

  it('Gemini n\'est pas OpenAI-compat (baseUrlFormat défini)', () => {
    const gemini = PROVIDER_PRESETS.find(p => p.id === 'gemini');
    expect(gemini).toBeDefined();
    expect(gemini.baseUrlFormat).toBe('custom');
  });

  it('les IDs sont uniques', () => {
    const ids = PROVIDER_PRESETS.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
