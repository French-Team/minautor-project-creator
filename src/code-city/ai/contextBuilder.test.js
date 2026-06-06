/**
 * Tests unitaires — contextBuilder.js
 */

import { describe, it, expect } from 'vitest';
import { buildCanvasContext, buildNodePrompt } from './contextBuilder.js';

/* --------------------------------------------------------------------------- */
/*  buildCanvasContext                                                         */
/* --------------------------------------------------------------------------- */

describe('buildCanvasContext', () => {
  const baseGraph = {
    nodes: [
      { id: 'n1', type: 'process', label: 'API', description: 'REST API', priority: 'high', properties: { method: 'GET' } },
      { id: 'n2', type: 'decision', label: 'Auth', description: '', priority: 'medium', properties: {} },
      { id: 'n3', type: 'hub', label: '', priority: 'medium', properties: {} },
    ],
    edges: [
      { from: 'n1', to: 'n2' },
    ],
  };

  it('exclut les hubs du comptage', () => {
    const ctx = buildCanvasContext(baseGraph);
    expect(ctx.totalNodes).toBe(2);
  });

  it('compte les arêtes', () => {
    const ctx = buildCanvasContext(baseGraph);
    expect(ctx.totalEdges).toBe(1);
  });

  it('mappe les nœuds non-hub avec les bonnes propriétés', () => {
    const ctx = buildCanvasContext(baseGraph);
    expect(ctx.nodes).toHaveLength(2);
    const api = ctx.nodes.find(n => n.id === 'n1');
    expect(api).toEqual(expect.objectContaining({
      id: 'n1',
      type: 'process',
      label: 'API',
      description: 'REST API',
      priority: 'high',
      properties: { method: 'GET' },
    }));
  });

  it('marque les nœuds sélectionnés', () => {
    const ctx = buildCanvasContext(baseGraph, ['n1']);
    const api = ctx.nodes.find(n => n.id === 'n1');
    const auth = ctx.nodes.find(n => n.id === 'n2');
    expect(api.isSelected).toBe(true);
    expect(auth.isSelected).toBe(false);
  });

  it('calcule les connexions entrantes/sortantes', () => {
    const ctx = buildCanvasContext(baseGraph);
    const api = ctx.nodes.find(n => n.id === 'n1');
    const auth = ctx.nodes.find(n => n.id === 'n2');
    expect(api.connections.outgoing).toContain('n2');
    expect(api.connections.incoming).toHaveLength(0);
    expect(auth.connections.incoming).toContain('n1');
    expect(auth.connections.outgoing).toHaveLength(0);
  });

  it('gère un graphe vide', () => {
    const ctx = buildCanvasContext({ nodes: [], edges: [] });
    expect(ctx.totalNodes).toBe(0);
    expect(ctx.totalEdges).toBe(0);
    expect(ctx.nodes).toHaveLength(0);
  });
});

/* --------------------------------------------------------------------------- */
/*  buildNodePrompt                                                            */
/* --------------------------------------------------------------------------- */

describe('buildNodePrompt', () => {
  const graph = {
    nodes: [
      { id: 'n1', type: 'process', label: 'Frontend', priority: 'high', description: 'App React' },
      { id: 'n2', type: 'service-api', label: 'Backend', priority: 'medium', description: '', properties: { endpoint: '/api' } },
    ],
    edges: [
      { from: 'n1', to: 'n2' },
    ],
  };

  it('inclut label, type et priorité', () => {
    const prompt = buildNodePrompt(graph.nodes[0], graph);
    expect(prompt).toContain('Nœud : Frontend');
    expect(prompt).toContain('Type : process');
    expect(prompt).toContain('Priorité : high');
  });

  it('inclut la description quand elle existe', () => {
    const prompt = buildNodePrompt(graph.nodes[0], graph);
    expect(prompt).toContain('Description : App React');
  });

  it('inclut les propriétés quand elles existent', () => {
    const prompt = buildNodePrompt(graph.nodes[1], graph);
    expect(prompt).toContain('Propriétés :');
    expect(prompt).toContain('endpoint');
  });

  it('inclut les connexions sortantes', () => {
    const prompt = buildNodePrompt(graph.nodes[0], graph);
    expect(prompt).toContain('Sorties : n2');
  });

  it('inclut les connexions entrantes', () => {
    const prompt = buildNodePrompt(graph.nodes[1], graph);
    expect(prompt).toContain('Entrées : n1');
  });

  it('affiche "Pas d\'entrées" quand aucune arête entrante', () => {
    const prompt = buildNodePrompt(graph.nodes[0], graph);
    expect(prompt).toContain("Pas d'entrées");
  });
});
