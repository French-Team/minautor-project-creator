/**
 * Tests unitaires — fimHandler.js
 */

import { describe, it, expect } from 'vitest';
import { extractFimParts } from './fimHandler.js';

/* --------------------------------------------------------------------------- */
/*  extractFimParts                                                            */
/* --------------------------------------------------------------------------- */

describe('extractFimParts', () => {
  function makeTextarea(value, selectionStart, selectionEnd) {
    return { value, selectionStart, selectionEnd };
  }

  it('extrait prefix, suffix et selected depuis une sélection', () => {
    const ta = makeTextarea('line1\nline2\nline3', 6, 11);
    const result = extractFimParts(ta);
    expect(result).not.toBeNull();
    expect(result.prefix).toBe('line1\n');
    expect(result.selected).toBe('line2');
    expect(result.suffix).toBe('\nline3');
  });

  it('retourne null si pas de sélection (start === end)', () => {
    const ta = makeTextarea('hello', 3, 3);
    expect(extractFimParts(ta)).toBeNull();
  });

  it('gère la sélection au début du texte', () => {
    const ta = makeTextarea('abcdef', 0, 3);
    const result = extractFimParts(ta);
    expect(result.prefix).toBe('');
    expect(result.selected).toBe('abc');
    expect(result.suffix).toBe('def');
  });

  it('gère la sélection à la fin du texte', () => {
    const ta = makeTextarea('abcdef', 3, 6);
    const result = extractFimParts(ta);
    expect(result.prefix).toBe('abc');
    expect(result.selected).toBe('def');
    expect(result.suffix).toBe('');
  });

  it('gère la sélection inversée (end < start) en normalisant', () => {
    const ta = makeTextarea('abcdef', 4, 2);
    const result = extractFimParts(ta);
    expect(result).not.toBeNull();
    expect(result.prefix).toBe('ab');
    expect(result.selected).toBe('cd');
    expect(result.suffix).toBe('ef');
  });

  it('gère un texte vide', () => {
    const ta = makeTextarea('', 0, 0);
    expect(extractFimParts(ta)).toBeNull();
  });

  it('gère le texte multi-ligne complet sélectionné', () => {
    const ta = makeTextarea('flowchart TD\n  A --> B', 0, 22);
    const result = extractFimParts(ta);
    expect(result.prefix).toBe('');
    expect(result.selected).toBe('flowchart TD\n  A --> B');
    expect(result.suffix).toBe('');
  });
});
