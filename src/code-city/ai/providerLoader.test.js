/**
 * Tests unitaires — providerLoader.js
 *
 * Le providerLoader importe les JSON directement via Vite (pas de fetch).
 * Les imports sont des modules ES normaux — Vitest les handles naturellement.
 */
import { describe, it, expect } from 'vitest';

import {
  getPreset,
  getCategory,
  getAllPresets,
  getPresetsByCategory,
  getGridLayout,
  getGridSections,
  getColumnFromName,
  validateStoredProvider,
} from './providerLoader.js';

describe('providerLoader — getPreset', () => {
  it('retourne le provider pour un ID valide', () => {
    const preset = getPreset('groq');
    expect(preset).not.toBeNull();
    expect(preset.id).toBe('groq');
    expect(preset.baseUrl).toBe('https://api.groq.com/openai/v1');
  });

  it('retourne le provider pour ollama (local)', () => {
    const preset = getPreset('ollama');
    expect(preset).not.toBeNull();
    expect(preset.id).toBe('ollama');
    expect(preset.category).toBe('local');
    expect(preset.envKey).toBeNull();
  });

  it('retourne null pour un ID inconnu', () => {
    expect(getPreset('inexistant')).toBeNull();
  });

  it('retourne null pour une chaîne vide', () => {
    expect(getPreset('')).toBeNull();
  });

  it('retourne le provider avec tous ses champs', () => {
    const kilo = getPreset('kilo');
    expect(kilo.id).toBe('kilo');
    expect(kilo.name).toBe('Kilo Code');
    expect(kilo.category).toBe('online');
    expect(kilo.baseUrl).toBe('https://api.kilo.ai/api/gateway');
    expect(kilo.authRequired).toBe(false);
    expect(kilo.defaultModel).toBe('');
    expect(kilo.envKey).toBeNull();
    expect(kilo.icon).toBe('code');
    expect(kilo.enabled).toBe(true);
    expect(kilo.maxParallel).toBe(1);
  });
});

describe('providerLoader — getCategory', () => {
  it('retourne "online" pour un provider en ligne', () => {
    expect(getCategory('groq')).toBe('online');
    expect(getCategory('openrouter')).toBe('online');
    expect(getCategory('kilo')).toBe('online');
    expect(getCategory('mistral')).toBe('online');
  });

  it('retourne "local" pour un provider local', () => {
    expect(getCategory('ollama')).toBe('local');
    expect(getCategory('lmstudio')).toBe('local');
  });

  it('retourne null pour un ID inconnu', () => {
    expect(getCategory('inconnu')).toBeNull();
  });

  it('retourne null pour une chaîne vide', () => {
    expect(getCategory('')).toBeNull();
  });
});

describe('providerLoader — getAllPresets', () => {
  it('retourne tous les providers (8 total)', () => {
    const all = getAllPresets();
    expect(all).toHaveLength(8);
  });

  it('inclut les providers online et local', () => {
    const all = getAllPresets();
    const ids = all.map((p) => p.id);
    expect(ids).toContain('groq');
    expect(ids).toContain('ollama');
    expect(ids).toContain('lmstudio');
    expect(ids).toContain('openrouter');
    expect(ids).toContain('mistral');
  });

  it('chaque provider a les champs essentiels', () => {
    const all = getAllPresets();
    for (const p of all) {
      expect(p.id).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(p.category).toBeTruthy();
      expect(p.baseUrl).toBeTruthy();
      expect(p.enabled).toBe(true);
    }
  });
});

describe('providerLoader — getPresetsByCategory', () => {
  it('retourne 6 providers online', () => {
    const online = getPresetsByCategory('online');
    expect(online).toHaveLength(6);
    expect(online.every((p) => p.category === 'online')).toBe(true);
  });

  it('retourne 2 providers local', () => {
    const local = getPresetsByCategory('local');
    expect(local).toHaveLength(2);
    expect(local.every((p) => p.category === 'local')).toBe(true);
  });

  it('retourne un tableau vide pour une catégorie inexistante', () => {
    expect(getPresetsByCategory('inexistant')).toHaveLength(0);
  });

  it('les providers online incluent groq, openrouter, mistral, etc.', () => {
    const online = getPresetsByCategory('online');
    const ids = online.map((p) => p.id);
    expect(ids).toContain('groq');
    expect(ids).toContain('openrouter');
    expect(ids).toContain('gemini');
    expect(ids).toContain('kilo');
    expect(ids).toContain('opencode-zen');
    expect(ids).toContain('mistral');
  });

  it('les providers local incluent ollama et lmstudio', () => {
    const local = getPresetsByCategory('local');
    const ids = local.map((p) => p.id);
    expect(ids).toContain('ollama');
    expect(ids).toContain('lmstudio');
  });
});

describe('providerLoader — getGridLayout', () => {
  it('retourne la structure complète de la grille', () => {
    const layout = getGridLayout();
    expect(layout).toHaveProperty('sections');
    expect(Array.isArray(layout.sections)).toBe(true);
  });

  it('a 2 sections (En ligne + Local)', () => {
    const layout = getGridLayout();
    expect(layout.sections).toHaveLength(2);
  });

  it('la premiere section est "En ligne"', () => {
    const layout = getGridLayout();
    expect(layout.sections[0].title).toBe('En ligne');
    expect(layout.sections[1].title).toBe('Local');
  });
});

describe('providerLoader — getGridSections', () => {
  it('retourne uniquement les providers visibles', () => {
    const sections = getGridSections();
    // Toutes les entrées dans providers-grid.json ont visible: true
    const allVisible = sections.every((s) =>
      s.providers.every((p) => p.visible !== false),
    );
    expect(allVisible).toBe(true);
  });

  it('les providers sont tries par order ascendant', () => {
    const sections = getGridSections();
    for (const section of sections) {
      const orders = section.providers.map((p) => p.order);
      const sortedOrders = [...orders].sort((a, b) => a - b);
      expect(orders).toEqual(sortedOrders);
    }
  });

  it('retourne 2 sections', () => {
    const sections = getGridSections();
    expect(sections).toHaveLength(2);
  });

  it('la section En ligne a 6 providers', () => {
    const sections = getGridSections();
    const onlineSection = sections.find((s) => s.title === 'En ligne');
    expect(onlineSection.providers).toHaveLength(6);
  });

  it('la section Local a 2 providers', () => {
    const sections = getGridSections();
    const localSection = sections.find((s) => s.title === 'Local');
    expect(localSection.providers).toHaveLength(2);
  });

  it('les providers ont un id (pas de champ column stocke)', () => {
    const sections = getGridSections();
    for (const section of sections) {
      for (const p of section.providers) {
        expect(p.id).toBeTruthy();
        expect(p).not.toHaveProperty('column'); // column est calcule, pas stocke
      }
    }
  });
});

describe('providerLoader — getColumnFromName', () => {
  it('retourne 1 pour un nom mono-mot', () => {
    expect(getColumnFromName('ollama')).toBe(1);
    expect(getColumnFromName('groq')).toBe(1);
    expect(getColumnFromName('mistral')).toBe(1);
  });

  it('retourne 2 pour un nom multi-mots', () => {
    expect(getColumnFromName('Kilo Code')).toBe(2);
    expect(getColumnFromName('Google Gemini')).toBe(2);
    expect(getColumnFromName('LM Studio')).toBe(2);
  });

  it('gère les espaces multiples', () => {
    expect(getColumnFromName('OpenCode   Zen')).toBe(2);
  });

  it('gère les espaces au debut et fin', () => {
    expect(getColumnFromName('  ollama  ')).toBe(1);
    expect(getColumnFromName('  Kilo Code  ')).toBe(2);
  });

  it('fonctionne avec des noms de providers existants', () => {
    const all = getAllPresets();
    for (const p of all) {
      const col = getColumnFromName(p.name);
      expect(col).toBeGreaterThanOrEqual(1);
      expect(col).toBeLessThanOrEqual(2);
    }
  });
});

describe('providerLoader — validateStoredProvider', () => {
  it('retourne true pour un provider enabled (groq)', () => {
    expect(validateStoredProvider('groq')).toBe(true);
  });

  it('retourne true pour ollama (enabled)', () => {
    expect(validateStoredProvider('ollama')).toBe(true);
  });

  it('retourne false pour un ID inconnu', () => {
    expect(validateStoredProvider('faux-provider')).toBe(false);
  });

  it('retourne false pour null', () => {
    expect(validateStoredProvider(null)).toBe(false);
  });

  it('retourne false pour undefined', () => {
    expect(validateStoredProvider(undefined)).toBe(false);
  });

  it('retourne false pour une chaîne vide', () => {
    expect(validateStoredProvider('')).toBe(false);
  });

  it('retourne true pour tous les providers actuellement enabled', () => {
    const all = getAllPresets();
    for (const p of all) {
      expect(validateStoredProvider(p.id)).toBe(true);
    }
  });
});