/**
 * Tests unitaires — promptEngine.js
 *
 * Couvre :
 * - hashContext() : hash déterministe du canvas
 * - PromptEngine.categorizeMessage() : classification par mots-clés
 * - PromptEngine.composePrompt() : génération de prompt à partir des templates
 * - PromptEngine.detectContextWindow() : fenêtre de contexte (via table de correspondance)
 * - Cache + reuse
 * - Gestion des cas limites
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PromptEngine, hashContext, DEFAULT_OPTIMIZATION_THRESHOLD } from './promptEngine.js';

/* --------------------------------------------------------------------------
 * Mocks
 * -------------------------------------------------------------------------- */

// Mock fetch pour detectContextWindow
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

// Mock aiClient pour les tests d'API
vi.mock('./aiClient.js', () => ({
  chatCompletion: vi.fn(),
  toLocalUrl: vi.fn((url) => url),
}));

// Mock traceLogger pour pouvoir spy sur les événements traceOptimizer émis
// dans les tests optimizeResponse (Sprint CT-4 v1.4). Les autres tests
// n'utilisent pas les traces donc le mock est inoffensif.
vi.mock('./traceLogger.js', () => ({
  traceChat: vi.fn(),
  tracePromptEngine: vi.fn(),
  traceOptimizer: vi.fn(),
  traceAiClient: vi.fn(),
  traceSystemPrompt: vi.fn(),
}));

// Mock actions (importé depuis state.js — on mocke au niveau du module)
vi.mock('../state.js', () => ({
  getState: vi.fn(() => ({
    assistant: {
      provider: { id: 'ollama', model: 'llama3.2:3b', preparationModel: null },
      currentPrompt: null,
      promptHistory: [],
      promptCache: {},
      contextWindow: 4096,
    },
  })),
  actions: {
    setCurrentPrompt: vi.fn(),
    clearPromptCache: vi.fn(),
    setContextWindow: vi.fn(),
    setPreparationModel: vi.fn(),
    setOptimizationThreshold: vi.fn(),
    updateOptimizationStats: vi.fn(),
  },
  subscribe: vi.fn(() => vi.fn()),
}));

/* --------------------------------------------------------------------------
 * Fixtures
 * -------------------------------------------------------------------------- */

const sampleNodes = [
  { id: 'n1', type: 'process', label: 'Login', priority: 'high', description: 'Processus de connexion' },
  { id: 'n2', type: 'service-api', label: 'API Auth', priority: 'high', description: 'Service d\'authentification' },
  { id: 'n3', type: 'decision', label: 'Validation', priority: 'medium', description: 'Validation des données' },
  { id: 'n4', type: 'hub', label: '', priority: 'medium', description: '' },
];

const sampleEdges = [
  { id: 'e1', from: 'n1', to: 'n2', label: 'appelle' },
  { id: 'e2', from: 'n2', to: 'n3', label: 'retourne' },
];

const sampleGraph = { nodes: sampleNodes, edges: sampleEdges };

/* --------------------------------------------------------------------------
 * hashContext
 * -------------------------------------------------------------------------- */

describe('hashContext()', () => {
  it('génère un hash déterministe pour le même canvas', () => {
    const h1 = hashContext(sampleNodes, sampleEdges);
    const h2 = hashContext(sampleNodes, sampleEdges);
    expect(h1).toBe(h2);
  });

  it('génère des hash différents pour des canvas différents', () => {
    const h1 = hashContext(sampleNodes, sampleEdges);
    const otherNodes = [{ id: 'n1', type: 'process', label: 'Register', priority: 'high' }];
    const h2 = hashContext(otherNodes, []);
    expect(h1).not.toBe(h2);
  });

  it('ignore les hubs dans le hash', () => {
    const withHub = hashContext(sampleNodes, sampleEdges);
    const withoutHub = hashContext(
      sampleNodes.filter(n => n.type !== 'hub'),
      sampleEdges
    );
    expect(withHub).toBe(withoutHub);
  });

  it('retourne une chaîne non vide même pour un canvas vide', () => {
    const h = hashContext([], []);
    expect(typeof h).toBe('string');
    expect(h.length).toBeGreaterThan(0);
  });

  it('est stable après ré-ordonnancement des nœuds (tri alphabétique)', () => {
    const h1 = hashContext(sampleNodes, sampleEdges);
    const reversed = hashContext([...sampleNodes].reverse(), [...sampleEdges].reverse());
    expect(h1).toBe(reversed);
  });

  it('gère les entrées null/undefined', () => {
    expect(() => hashContext(null, null)).not.toThrow();
    expect(() => hashContext(undefined, undefined)).not.toThrow();
  });
});

/* --------------------------------------------------------------------------
 * PromptEngine — Constructeur
 * -------------------------------------------------------------------------- */

describe('PromptEngine', () => {
  let engine;

  beforeEach(() => {
    engine = new PromptEngine({ cacheTTL: 60000 }); // 1 min pour les tests
    mockFetch.mockReset();
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('initialise avec les valeurs par défaut', () => {
      const e = new PromptEngine();
      expect(e.getCurrentPrompt()).toBeNull();
      expect(e.getPromptHistory()).toEqual([]);
      expect(e.getContextWindow()).toBe(4096);
    });

    it('accepte un cacheTTL personnalisé', () => {
      const e = new PromptEngine({ cacheTTL: 9999 });
      // Testé indirectement via le cache
      expect(e).toBeDefined();
    });
  });

  /* --------------------------------------------------------------------------
   * detectContextWindow
   * -------------------------------------------------------------------------- */

  describe('detectContextWindow()', () => {
    it('retourne 4096 par défaut pour un modèle inconnu', async () => {
      const ctx = await PromptEngine.detectContextWindow({}, 'unknown-model');
      expect(ctx).toBe(4096);
    });

    it('retourne 8192 pour llama3.2:3b', async () => {
      const ctx = await PromptEngine.detectContextWindow({}, 'llama3.2:3b');
      expect(ctx).toBe(8192);
    });

    it('retourne 128000 pour llama3.1:8b', async () => {
      const ctx = await PromptEngine.detectContextWindow({}, 'llama3.1:8b');
      expect(ctx).toBe(128000);
    });

    it('ignore la casse du modèle', async () => {
      const ctx = await PromptEngine.detectContextWindow({}, 'LLAMA3.2:3B');
      expect(ctx).toBe(8192);
    });

    it('retourne 4096 pour modèle null/undefined', async () => {
      const ctx1 = await PromptEngine.detectContextWindow({}, null);
      const ctx2 = await PromptEngine.detectContextWindow({}, undefined);
      expect(ctx1).toBe(4096);
      expect(ctx2).toBe(4096);
    });

    it('tente Ollama /api/show si fournisseur ollama', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Timeout')); // Simule échec API → fallback
      const ctx = await PromptEngine.detectContextWindow(
        { id: 'ollama', baseUrl: 'http://localhost:11434/v1' },
        'llama3.2:3b'
      );
      expect(ctx).toBe(8192); // Fallback table de correspondance
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  /* --------------------------------------------------------------------------
   * categorizeMessage
   * -------------------------------------------------------------------------- */

  describe('categorizeMessage()', () => {
    it('classe "bonjour" en conversation', () => {
      expect(engine.categorizeMessage('Bonjour')).toBe('conversation');
    });

    it('classe "salut" en conversation', () => {
      expect(engine.categorizeMessage('Salut !')).toBe('conversation');
    });

    it('classe "merci" en conversation', () => {
      expect(engine.categorizeMessage('Merci')).toBe('conversation');
    });

    it('classe "analyse le canvas" en analysis', () => {
      expect(engine.categorizeMessage('Analyse le canvas')).toBe('analysis');
    });

    it('classe "que penses-tu de" en analysis', () => {
      expect(engine.categorizeMessage('Que penses-tu de mon projet ?')).toBe('analysis');
    });

    it('classe "diagnostic" en analysis', () => {
      expect(engine.categorizeMessage('Fais un diagnostic complet')).toBe('analysis');
    });

    it('classe "suggère des nœuds" en suggestion', () => {
      expect(engine.categorizeMessage('Suggère des nœuds à ajouter')).toBe('suggestion');
    });

    it('classe "propose des idées" en suggestion', () => {
      expect(engine.categorizeMessage('Propose des idées pour mon projet')).toBe('suggestion');
    });

    it('classe "documente" en documentation', () => {
      expect(engine.categorizeMessage('Documente mon projet')).toBe('documentation');
    });

    it('classe "génère un readme" en documentation', () => {
      expect(engine.categorizeMessage('Génère un README')).toBe('documentation');
    });

    it('classe "enrichis les propriétés" en enrichment', () => {
      expect(engine.categorizeMessage('Enrichis les propriétés du nœud')).toBe('enrichment');
    });

    it('classe "remplir les champs" en enrichment', () => {
      expect(engine.categorizeMessage('Remplir les champs de mon nœud')).toBe('enrichment');
    });

    it('classe "architecture" en architecture', () => {
      expect(engine.categorizeMessage('Analyse l\'architecture')).toBe('architecture');
    });

    it('classe "microservices" en architecture', () => {
      expect(engine.categorizeMessage('Quel pattern microservices ?')).toBe('architecture');
    });

    it('retourne conversation pour un message vide', () => {
      expect(engine.categorizeMessage('')).toBe('conversation');
    });

    it('retourne conversation pour un message null', () => {
      expect(engine.categorizeMessage(null)).toBe('conversation');
    });

    it('retourne conversation pour du texte sans mot-clé', () => {
      expect(engine.categorizeMessage('Je me demande quel temps il fait')).toBe('conversation');
    });

    it('la règle architecture est prioritaire sur suggestion si les deux matchent', () => {
      // "analyse l'architecture" matche à la fois analysis et architecture
      // architecture est avant dans les règles
      const result = engine.categorizeMessage('Analyse l\'architecture de mon projet');
      expect(result).toBe('architecture'); // architecture vient avant analysis dans CATEGORIZATION_RULES
    });
  });

  /* --------------------------------------------------------------------------
   * composePrompt
   * -------------------------------------------------------------------------- */

  describe('composePrompt()', () => {
    it('génère un prompt analysis avec le contexte', () => {
      const canvasCtx = {
        summary: '## Contexte\n- 3 nœuds',
        nodeCount: 3,
        edgeCount: 2,
        selectedNodes: [],
      };
      const prompt = engine.composePrompt('analysis', canvasCtx);
      expect(prompt).toContain('expert en analyse');
      expect(prompt).toContain('## Contexte');
    });

    it('génère un prompt suggestion', () => {
      const canvasCtx = {
        summary: '## Contexte\n- 3 nœuds',
        nodeCount: 3,
        edgeCount: 0,
        selectedNodes: [],
      };
      const prompt = engine.composePrompt('suggestion', canvasCtx);
      expect(prompt).toContain('suggère des nœuds');
      expect(prompt).not.toContain('{context}'); // Template remplacé
    });

    it('génère un prompt conversation', () => {
      const canvasCtx = {
        summary: '',
        nodeCount: 0,
        edgeCount: 0,
        selectedNodes: [],
      };
      const prompt = engine.composePrompt('conversation', canvasCtx);
      expect(prompt).toContain('Mina');
      expect(prompt).toContain('amical');
    });

    it('retourne conversation pour un type inconnu (fallback)', () => {
      const prompt = engine.composePrompt('unknown', { summary: '', nodeCount: 0, edgeCount: 0, selectedNodes: [] });
      expect(prompt).toContain('Mina');
    });

    it('inclut les infos de nœud sélectionné pour enrichment', () => {
      const canvasCtx = {
        summary: '## Contexte\n- 3 nœuds',
        selectedInfo: '\n### Nœud sélectionné\n- **Login** (process)',
        nodeCount: 3,
        edgeCount: 0,
        selectedNodes: [{ id: 'n1', label: 'Login', type: 'process', properties: {} }],
      };
      const prompt = engine.composePrompt('enrichment', canvasCtx);
      expect(prompt).toContain('Login');
      expect(prompt).toContain('enrichissement');
    });
  });

  /* --------------------------------------------------------------------------
   * Cache
   * -------------------------------------------------------------------------- */

  describe('cache', () => {
    it('preparePrompt met en cache et retourne le même objet pour le même canvas', async () => {
      const p1 = await engine.preparePrompt('Analyse le canvas', sampleGraph);
      const p2 = await engine.preparePrompt('Analyse le canvas', sampleGraph);
      expect(p2.cached).toBe(true);
      expect(p2.prompt).toBe(p1.prompt);
      expect(p2.context.contextHash).toBe(p1.context.contextHash);
    });

    it('ne met PAS en cache si forceRefresh est true', async () => {
      const p1 = await engine.preparePrompt('Analyse le canvas', sampleGraph);
      const p2 = await engine.preparePrompt('Analyse le canvas', sampleGraph, { forceRefresh: true });
      expect(p2.cached).toBe(false);
    });

    it('clearCache vide le cache', async () => {
      await engine.preparePrompt('Analyse le canvas', sampleGraph);
      engine.clearCache();
      const p2 = await engine.preparePrompt('Analyse le canvas', sampleGraph);
      expect(p2.cached).toBe(false);
    });

    it('le cache expire après le TTL', async () => {
      const engine = new PromptEngine({ cacheTTL: 10 }); // 10ms
      await engine.preparePrompt('Analyse le canvas', sampleGraph);
      await new Promise(r => setTimeout(r, 20)); // Attendre expiration
      const p2 = await engine.preparePrompt('Analyse le canvas', sampleGraph);
      expect(p2.cached).toBe(false); // Expiré
    });

    it('le cache est différent pour des canvas différents (même message)', async () => {
      const p1 = await engine.preparePrompt('Analyse le canvas', sampleGraph);
      const otherGraph = { nodes: [{ id: 'n1', type: 'process', label: 'Register', priority: 'high' }], edges: [] };
      const p2 = await engine.preparePrompt('Analyse le canvas', otherGraph);
      expect(p2.cached).toBe(false); // Hash différent → cache miss
      expect(p2.context.contextHash).not.toBe(p1.context.contextHash);
    });

    it('met à jour currentPrompt après préparation', async () => {
      const p = await engine.preparePrompt('Analyse le canvas', sampleGraph);
      expect(engine.getCurrentPrompt()).toBe(p);
    });
  });

  /* --------------------------------------------------------------------------
   * preparePrompt
   * -------------------------------------------------------------------------- */

  describe('preparePrompt()', () => {
    it('retourne un PreparedPrompt valide', async () => {
      const p = await engine.preparePrompt('Analyse le canvas', sampleGraph);
      expect(p).toHaveProperty('id');
      expect(p).toHaveProperty('type', 'analysis');
      expect(p).toHaveProperty('userMessage', 'Analyse le canvas');
      expect(p).toHaveProperty('prompt');
      expect(p).toHaveProperty('context');
      expect(p).toHaveProperty('timestamp');
      expect(p).toHaveProperty('duration');
      expect(p.context.nodeCount).toBe(3); // 3 non-hub nodes
      expect(p.context.edgeCount).toBe(2);
    });

    it('identifie le type à partir du message', async () => {
      const p = await engine.preparePrompt('Suggère des nœuds', sampleGraph);
      expect(p.type).toBe('suggestion');
    });

    it('retourne conversation pour un message sans mot-clé', async () => {
      const p = await engine.preparePrompt('Quel temps fait-il ?', sampleGraph);
      expect(p.type).toBe('conversation');
    });

    it('calcule une durée non-nulle', async () => {
      const p = await engine.preparePrompt('Test', sampleGraph);
      expect(p.duration).toBeGreaterThanOrEqual(0);
      expect(typeof p.duration).toBe('number');
    });

    it('génère un ID basé sur le timestamp', async () => {
      const p = await engine.preparePrompt('Analyse', sampleGraph);
      expect(p.id).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-/);
    });
  });

  /* --------------------------------------------------------------------------
   * _enhancePromptViaApi
   * -------------------------------------------------------------------------- */

  describe('_enhancePromptViaApi()', () => {
    it('retourne null si le prompt est vide', async () => {
      const result = await engine._enhancePromptViaApi('');
      expect(result).toBeNull();
    });

    it('retourne null si le prompt est sous le seuil minimum', async () => {
      // Prompt très court (< 50 tokens)
      const result = await engine._enhancePromptViaApi('Court message');
      expect(result).toBeNull();
    });

    it('retourne null si aucun provider', async () => {
      const stateModule = await import('../state.js');
      stateModule.getState.mockReturnValueOnce({
        assistant: { provider: null },
      });

      const longPrompt = 'A'.repeat(800);
      const result = await engine._enhancePromptViaApi(longPrompt);
      expect(result).toBeNull();
    });

    it('retourne null si chatCompletion échoue', async () => {
      const { chatCompletion } = await import('./aiClient.js');
      chatCompletion.mockRejectedValueOnce(new Error('API Error'));

      const longPrompt = 'A'.repeat(800);
      const result = await engine._enhancePromptViaApi(longPrompt);
      expect(result).toBeNull();
    });

    it('retourne null si le contenu amélioré est identique', async () => {
      const { chatCompletion } = await import('./aiClient.js');
      const longPrompt = 'A'.repeat(800);
      chatCompletion.mockResolvedValueOnce({ content: longPrompt });

      const result = await engine._enhancePromptViaApi(longPrompt);
      expect(result).toBeNull();
    });

    it('retourne le prompt amélioré si chatCompletion réussit', async () => {
      const { chatCompletion } = await import('./aiClient.js');
      const enhanced = 'B'.repeat(800);
      chatCompletion.mockResolvedValueOnce({ content: enhanced });

      const longPrompt = 'A'.repeat(800);
      const result = await engine._enhancePromptViaApi(longPrompt);
      expect(result).toBe(enhanced);
    });

    it('utilise le modèle de préparation s\'il est configuré', async () => {
      const stateModule = await import('../state.js');
      stateModule.getState.mockReturnValueOnce({
        assistant: {
          provider: {
            id: 'ollama',
            model: 'llama3.2:3b',
            preparationModel: 'llama3.1:8b',
            maxTokens: 4096,
          },
        },
      });

      const { chatCompletion } = await import('./aiClient.js');
      const enhanced = 'C'.repeat(800);
      chatCompletion.mockResolvedValueOnce({ content: enhanced });

      const longPrompt = 'A'.repeat(800);
      const result = await engine._enhancePromptViaApi(longPrompt);
      expect(result).toBe(enhanced);
      // Vérifier que l'appel a utilisé le preparationModel
      expect(chatCompletion).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'llama3.1:8b' }),
        expect.any(Array),
        expect.any(Object),
      );
    });
  });

  /* --------------------------------------------------------------------------
   * preparePrompt avec amélioration via API
   * -------------------------------------------------------------------------- */

  describe('preparePrompt() avec enhancement', () => {
    beforeEach(async () => {
      // Restaurer la valeur par défaut de getState (sans preparationModel)
      const stateModule = await import('../state.js');
      stateModule.getState.mockReturnValue({
        assistant: {
          provider: { id: 'ollama', model: 'llama3.2:3b', preparationModel: null },
          currentPrompt: null,
          promptHistory: [],
          promptCache: {},
          contextWindow: 4096,
        },
      });
      // Reset aiClient mocks
      const aiModule = await import('./aiClient.js');
      aiModule.chatCompletion.mockReset();
    });

    it('ne déclenche PAS l\'API si aucun preparationModel configuré', async () => {
      const { chatCompletion } = await import('./aiClient.js');
      const p = await engine.preparePrompt('Analyse le canvas', sampleGraph);
      expect(chatCompletion).not.toHaveBeenCalled();
      expect(p.apiEnhanced).toBe(false);
      expect(p.originalPrompt).toBeNull();
    });

    it('ne déclenche PAS l\'API pour un type conversation', async () => {
      const stateModule = await import('../state.js');
      stateModule.getState.mockReturnValueOnce({
        assistant: {
          provider: { id: 'ollama', model: 'llama3.2:3b', preparationModel: 'llama3.1:8b' },
        },
      });

      const { chatCompletion } = await import('./aiClient.js');
      const p = await engine.preparePrompt('Bonjour', sampleGraph);
      expect(chatCompletion).not.toHaveBeenCalled();
      expect(p.apiEnhanced).toBe(false);
    });

    it('déclenche l\'API et marque le prompt comme amélioré', async () => {
      const stateModule = await import('../state.js');
      stateModule.getState.mockReturnValue({
        assistant: {
          provider: { id: 'ollama', model: 'llama3.2:3b', preparationModel: 'llama3.1:8b' },
        },
      });

      const { chatCompletion } = await import('./aiClient.js');
      const enhancedPrompt = 'Version améliorée du prompt pour analyse du canvas avec recommandations précises.';
      chatCompletion.mockResolvedValueOnce({ content: enhancedPrompt });

      const p = await engine.preparePrompt('Analyse le canvas', sampleGraph);

      expect(chatCompletion).toHaveBeenCalledOnce();
      expect(p.apiEnhanced).toBe(true);
      expect(p.originalPrompt).toBeTruthy();
      expect(p.prompt).toBe(enhancedPrompt);
      expect(p.originalPrompt).not.toBe(enhancedPrompt);
    });

    it('gère l\'échec de l\'API et conserve le prompt original', async () => {
      const stateModule = await import('../state.js');
      stateModule.getState.mockReturnValue({
        assistant: {
          provider: { id: 'ollama', model: 'llama3.2:3b', preparationModel: 'llama3.1:8b' },
        },
      });

      // Simuler un échec de l'API : chatCompletion retourne null
      const { chatCompletion } = await import('./aiClient.js');
      chatCompletion.mockResolvedValueOnce({ content: null });

      const p = await engine.preparePrompt('Analyse le canvas', sampleGraph);

      // L'API a été appelée
      expect(chatCompletion).toHaveBeenCalledOnce();
      // Le prompt n'a PAS été amélioré
      expect(p.apiEnhanced).toBe(false);
      // originalPrompt est défini (on est entré dans le bloc hasPreparationModel)
      expect(p.originalPrompt).toBeTruthy();
      // Le prompt final est le prompt original (fallback)
      expect(p.prompt).toBe(p.originalPrompt);
      // Le prompt contient le template analysis (composé localement)
      expect(p.prompt).toContain('expert en analyse');
      expect(p.prompt).toContain('Login');
    });
  });

  /* --------------------------------------------------------------------------
   * optimizeResponse (skeleton)
   * -------------------------------------------------------------------------- */

  describe('optimizeResponse()', () => {
    it('retourne null si la réponse est vide', async () => {
      const result = await engine.optimizeResponse('', null, { id: 'ollama' });
      expect(result).toBeNull();
    });

    it('retourne null si le provider est invalide', async () => {
      const result = await engine.optimizeResponse('Une réponse', null, null);
      expect(result).toBeNull();
    });

    it('retourne null si la réponse est sous le seuil', async () => {
      // Réponse courte (< 500 tokens) → skip optimization
      const result = await engine.optimizeResponse('Court message', null, { id: 'ollama' });
      expect(result).toBeNull();
    });

    /* ----------------------------------------------------------------------
     * mode 'enrich' (Sprint CT-4 v1.4) — niché dans optimizeResponse() pour
     * refléter la hiérarchie de l'API (mode = sous-fonctionnalité).
     * 5 tests utilisent evenLongerResponse() (> 500 tokens) pour atteindre
     * le guard enrich ; 1 test (précedence) utilise une réponse COURTE pour
     * vérifier que le threshold check fire avant le guard enrich.
     * ---------------------------------------------------------------------- */
    describe("mode 'enrich'", () => {
      /** Helper : construit une réponse > 500 tokens pour dépasser le seuil d'optimisation. */
      function evenLongerResponse() {
        return 'Réponse très détaillée pour test enrich. '.repeat(200); // ~5400 chars → > seuil
      }
      const samplePrepared = {
        id: 'test-prepared-1',
        type: 'analysis',
        userMessage: 'Analyse',
        prompt: 'Contexte du projet: 3 nœuds, 2 arêtes. Objectif: optimiser la structure.',
        context: { nodeCount: 3, edgeCount: 2, selectedNodes: [], canvasSummary: '', contextHash: 'h1' },
        apiEnhanced: false,
        cached: false,
        timestamp: Date.now(),
        filePath: '',
        duration: 0,
      };

      it("sans preparedPrompt émet SKIP reason='no-prepared-prompt' et retourne null", async () => {
        const { traceOptimizer } = await import('./traceLogger.js');
        // bypasses threshold check (> 500 tokens)
        const result = await engine.optimizeResponse(
          evenLongerResponse(), null, { id: 'ollama' }, { mode: 'enrich' }
        );
        expect(result).toBeNull();
        expect(traceOptimizer).toHaveBeenCalledWith(
          'optimizeResponse SKIP',
          expect.objectContaining({ reason: 'no-prepared-prompt' }),
        );
      });

      it("avec preparedPrompt.prompt vide émet SKIP reason='no-prepared-prompt'", async () => {
        const { traceOptimizer } = await import('./traceLogger.js');
        // bypasses threshold check (> 500 tokens)
        const result = await engine.optimizeResponse(
          evenLongerResponse(),
          { id: 'x', type: 'analysis', prompt: '' },
          { id: 'ollama' },
          { mode: 'enrich' }
        );
        expect(result).toBeNull();
        expect(traceOptimizer).toHaveBeenCalledWith(
          'optimizeResponse SKIP',
          expect.objectContaining({ reason: 'no-prepared-prompt' }),
        );
      });

      it("avec preparedPrompt.prompt appelle chatCompletion, retourne le contenu optimisé ET émet [OPTIMIZER] optimizeResponse ENRICH", async () => {
        const { chatCompletion } = await import('./aiClient.js');
        const { traceOptimizer } = await import('./traceLogger.js');
        const optimized = 'Réponse condensée.';
        chatCompletion.mockResolvedValueOnce({ content: optimized });
        // bypasses threshold check
        const result = await engine.optimizeResponse(
          evenLongerResponse(),
          samplePrepared,
          { id: 'ollama', model: 'llama3.2:3b' },
          { mode: 'enrich' }
        );

        expect(chatCompletion).toHaveBeenCalledOnce();
        expect(result).toBe(optimized);

        // Vérifier que l'appel contient bien le contexte préparé concaténé
        const callArgs = chatCompletion.mock.calls[0];
        const messages = callArgs[1];
        const systemMsg = messages.find((m) => m.role === 'system');
        expect(systemMsg.content).toContain(samplePrepared.prompt);
        expect(systemMsg.content).toContain('Contexte du projet (prompt préparé)');

        // Assertion sur l'événement [OPTIMIZER] optimizeResponse ENRICH (lock du contrat d'observabilité)
        expect(traceOptimizer).toHaveBeenCalledWith(
          'optimizeResponse ENRICH',
          expect.objectContaining({
            customPromptLen: samplePrepared.prompt.length,
            systemPromptLen: expect.any(Number),
            enrichedLen: expect.any(Number),
          }),
        );
      });

      it("'replace' (défaut) n'émet PAS l'événement ENRICH et utilise OPTIMIZATION_SYSTEM_PROMPT seul", async () => {
        const { chatCompletion } = await import('./aiClient.js');
        const { traceOptimizer } = await import('./traceLogger.js');
        const optimized = 'Condensé.';
        chatCompletion.mockResolvedValueOnce({ content: optimized });
        // bypasses threshold check
        const result = await engine.optimizeResponse(
          evenLongerResponse(),
          samplePrepared,
          { id: 'ollama', model: 'llama3.2:3b' },
          { mode: 'replace' }
        );

        expect(chatCompletion).toHaveBeenCalledOnce();
        expect(result).toBe(optimized);

        // Vérifier que le system prompt ne contient PAS la concaténation
        const callArgs = chatCompletion.mock.calls[0];
        const messages = callArgs[1];
        const systemMsg = messages.find((m) => m.role === 'system');
        expect(systemMsg.content).not.toContain('Contexte du projet (prompt préparé)');
        expect(systemMsg.content).not.toContain(samplePrepared.prompt);

        // Pas d'événement ENRICH en mode replace
        expect(traceOptimizer).not.toHaveBeenCalledWith(
          'optimizeResponse ENRICH',
          expect.anything(),
        );
      });

      it("mode invalide fallback sur 'replace' (pas d'ENRICH, system prompt sans concaténation)", async () => {
        const { chatCompletion } = await import('./aiClient.js');
        const { traceOptimizer } = await import('./traceLogger.js');
        chatCompletion.mockResolvedValueOnce({ content: 'OK' });
        // bypasses threshold check
        await engine.optimizeResponse(
          evenLongerResponse(),
          samplePrepared,
          { id: 'ollama' },
          { mode: 'invalid-mode' } // ignoré silencieusement, default = 'replace'
        );

        // L'appel a bien été fait (pas de throw)
        expect(chatCompletion).toHaveBeenCalledOnce();

        // Le system prompt NE contient PAS la concaténation (fallback replace)
        const callArgs = chatCompletion.mock.calls[0];
        const messages = callArgs[1];
        const systemMsg = messages.find((m) => m.role === 'system');
        expect(systemMsg.content).not.toContain('Contexte du projet (prompt préparé)');
        expect(systemMsg.content).not.toContain(samplePrepared.prompt);

        // Pas d'événement ENRICH pour mode invalide
        expect(traceOptimizer).not.toHaveBeenCalledWith(
          'optimizeResponse ENRICH',
          expect.anything(),
        );
      });

      /**
       * Précédence des guards : la vérification du seuil de tokens (DEFAULT_OPTIMIZATION_THRESHOLD)
       * fire AVANT le guard enrich-spécifique (no-prepared-prompt). Ce test documente cette
       * précédence : une réponse COURTE avec mode='enrich' et un preparedPrompt valide doit
       * déclencher SKIP reason='below-threshold', pas SKIP reason='no-prepared-prompt'.
       * Ordre dans promptEngine.optimizeResponse() : threshold check → enrich guard.
       */
      it("réponse COURTE : SKIP below-threshold fire avant guard enrich (mode='enrich' valide)", async () => {
        const { chatCompletion } = await import('./aiClient.js');
        const { traceOptimizer } = await import('./traceLogger.js');
        // Réutilise le samplePrepared du scope parent (mode 'enrich').

        const result = await engine.optimizeResponse(
          'Court.', // < 500 tokens → déclenche below-threshold, pas le guard enrich
          samplePrepared,
          { id: 'ollama' },
          { mode: 'enrich' },
        );

        // Résultat : null (SKIP)
        expect(result).toBeNull();

        // Le threshold check fire EN PREMIER → reason='below-threshold'
        expect(traceOptimizer).toHaveBeenCalledWith(
          'optimizeResponse SKIP',
          expect.objectContaining({ reason: 'below-threshold' }),
        );

        // Le guard enrich ne fire PAS (précedence) → no-prepared-prompt absent
        expect(traceOptimizer).not.toHaveBeenCalledWith(
          'optimizeResponse SKIP',
          expect.objectContaining({ reason: 'no-prepared-prompt' }),
        );

        // L'API LLM n'est jamais appelée (court-circuit)
        expect(chatCompletion).not.toHaveBeenCalled();
      });
    });
  });

  /* --------------------------------------------------------------------------
   * getPromptHistory
   * -------------------------------------------------------------------------- */

  describe('prompt history', () => {
    it('ajoute les prompts à l\'historique', async () => {
      await engine.preparePrompt('Analyse', sampleGraph);
      await engine.preparePrompt('Suggère', sampleGraph);
      expect(engine.getPromptHistory().length).toBe(2);
    });

    it('limite l\'historique à 20 entrées', async () => {
      for (let i = 0; i < 25; i++) {
        await engine.preparePrompt(`Message ${i}`, sampleGraph);
      }
      expect(engine.getPromptHistory().length).toBeLessThanOrEqual(20);
    });

    it('retourne une copie de l\'historique (pas de mutation externe)', () => {
      const history = engine.getPromptHistory();
      const initialLength = history.length;
      history.push({ id: 'fake' });
      expect(engine.getPromptHistory().length).toBe(initialLength);
    });
  });
});
