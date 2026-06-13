// @vitest-environment jsdom
/**
 * Tests de régression pour l'unification ACTION_ICONS / getChatIcon (juin 2026).
 *
 * Verrouille le contrat : `getActionIcon(key, size)` doit retourner exactement
 * le même SVG que `getChatIcon(key, size)` pour les clés historiquement dans
 * ACTION_ICONS. Si un futur refactor de chatIcons.js casse cette équivalence,
 * le test échoue immédiatement.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { getActionIcon, QUICK_ACTION_CATEGORIES } from './quickActions.js';
import { getChatIcon } from '../chatIcons.js';

// Les 14 clés historiquement dans ACTION_ICONS, plus 'trending-up' ajouté
// pour les stats cumulatives de chatPanel.js.
const migratedKeys = [
  'bar-chart', 'lightbulb', 'file-text', 'search', 'zap', 'settings',
  'refresh', 'alert-triangle', 'trash', 'book-open', 'check', 'history',
  'sparkles', 'x-circle', 'trending-up',
];

// Tailles utilisées dans le codebase. 24 est le fast-path de getChatIcon
// (pas de replace width/height → on verrouille aussi ce comportement).
const sizes = [10, 11, 12, 14, 16, 24];

// Construit la table de test : [[key, size], [key, size], ...]
const matrix = migratedKeys.flatMap(key => sizes.map(size => [key, size]));

describe('quickActions — unification ACTION_ICONS / getChatIcon', () => {
  describe('getActionIcon est un wrapper de getChatIcon', () => {
    it.each(matrix)('getActionIcon(%j) === getChatIcon(%j)', (key, size) => {
      expect(getActionIcon(key, size)).toBe(getChatIcon(key, size));
    });
  });

  describe('taille par défaut', () => {
    it('getActionIcon(key) (sans size) === getChatIcon(key, 14)', () => {
      expect(getActionIcon('bar-chart')).toBe(getChatIcon('bar-chart', 14));
      expect(getActionIcon('alert-triangle')).toBe(getChatIcon('alert-triangle', 14));
    });
  });

  describe('clé inconnue', () => {
    // getChatIcon log un console.warn pour les icônes inconnues — on le
    // silence pour garder une sortie de test propre (sinon pollution CI).
    let warnSpy;
    beforeAll(() => {
      warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });
    afterAll(() => {
      warnSpy.mockRestore();
    });

    it('retourne une string vide (pas de throw, pas de fallback)', () => {
      expect(getActionIcon('does-not-exist')).toBe('');
      expect(getActionIcon('does-not-exist', 12)).toBe('');
    });
  });

  describe('QUICK_ACTION_CATEGORIES utilise des clés valides', () => {
    it('toutes les icônes référencées par les catégories existent dans chatIcons', () => {
      const referencedIcons = new Set();
      for (const cat of QUICK_ACTION_CATEGORIES) {
        referencedIcons.add(cat.icon);
        for (const action of cat.actions) {
          referencedIcons.add(action.icon);
        }
      }
      for (const icon of referencedIcons) {
        expect(getChatIcon(icon), `Icon "${icon}" should exist in chatIcons`).not.toBe('');
      }
    });
  });
});
