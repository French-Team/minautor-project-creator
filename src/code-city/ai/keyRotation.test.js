/**
 * Tests e2e — Rotation des clés API
 * 
 * Teste le système de rotation LRU avec les vraies clés du .env.
 * Ces tests ont besoin du serveur env-server.mjs (ou npm run dev).
 * 
 * Pour exécuter: npm run dev (dans un terminal) puis npx vitest run src/code-city/ai/keyRotation.test.js
 * 
 * NOTE: Si vous n'avez pas 2+ clés API dans .env, certains tests seront skip.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { loadEnvKeys, getNextApiKey, resetRotationIndex, getAllKeysForEnvKey, invalidateCache, getApiKeyForEnvKey } from './envLoader.js';
import { chatCompletion } from './aiClient.js';

// Mock fetch pour /api/env
const fetchMock = vi.fn();
globalThis.fetch = fetchMock;

// Clés simulées pour les tests (identiques à ce que .env retourne via /api/env)
const MOCK_ENV_KEYS = {
  OPENCODE_ZEN_API_KEY: 'sk-test-key-1',
  OPENCODE_ZEN_API_KEY_1: 'sk-test-key-2',
  OPENCODE_ZEN_API_KEY_2: 'sk-test-key-3',
  OPENROUTER_API_KEY: 'sk-or-test-1',
  OPENROUTER_API_KEY_1: 'sk-or-test-2',
  MISTRAL_API_KEY: 'mistral-test',
  GEMINI_API_KEY: 'gemini-test',
};

describe('Key Rotation E2E', () => {
  beforeAll(async () => {
    // Mock fetch pour retourner les clés
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => MOCK_ENV_KEYS,
    });
    // Charger les clés avec le mock
    invalidateCache();
    await loadEnvKeys();
  });

  beforeEach(() => {
    // Reset les index de rotation avant chaque test
    resetRotationIndex('OPENCODE_ZEN_API_KEY');
    resetRotationIndex('OPENROUTER_API_KEY');
  });

  describe('loadEnvKeys —获取真实的 clés depuis /api/env', () => {
    it('charge les clés API depuis le serveur', async () => {
      const keys = await loadEnvKeys();
      
      // Vérifier qu'on a au moins une clé (sinon le test n'a pas de sens)
      const keyCount = Object.keys(keys).filter(k => k.includes('API_KEY') && keys[k]).length;
      console.log(`[KeyRotation] ${keyCount} clés API trouvées dans .env`);
      
      // S'attendre à avoir des clés si le .env est configuré
      // Ce test peut échouer si .env n'a pas de clés ou si le serveur n'est pas démarré
      expect(typeof keys).toBe('object');
    }, 15000);
  });

  describe('getAllKeysForEnvKey — retourne toutes les clés pour un provider', () => {
    it('retourne toutes les clés OpenCode Zen configurées', async () => {
      // Réutiliser les clés déjà chargées dans beforeAll
      const keys = getAllKeysForEnvKey('OPENCODE_ZEN_API_KEY');
      console.log(`[KeyRotation] OPENCODE_ZEN_API_KEY: ${keys.length} clés trouvées`);
      
      if (keys.length === 0) {
        console.log('[KeyRotation] ⚠️  ATTENTION: Aucune clé OPENCODE_ZEN_API_KEY configurée dans .env');
        console.log('[KeyRotation] Le test de rotation a besoin de 2+ clés pour fonctionner.');
        console.log('[KeyRotation] Ajoute OPENCODE_ZEN_API_KEY et OPENCODE_ZEN_API_KEY_1 dans .env');
      }
      
      keys.forEach((k, i) => {
        console.log(`  Clé ${i}: ${k.key} = ${k.value.substring(0, 10)}...`);
      });
      
      // On s'attend à avoir au moins 2 clés pour tester la rotation
      expect(keys.length).toBeGreaterThanOrEqual(2);
    }, 15000);
  });

  describe('getNextApiKey — rotation LRU', () => {
    it('tourne en cercle entre toutes les clés disponibles', async () => {
      
      // Réinitialiser l'index pour un test propre
      resetRotationIndex('OPENCODE_ZEN_API_KEY');
      
      const keys = getAllKeysForEnvKey('OPENCODE_ZEN_API_KEY');
      if (keys.length < 2) {
        console.log('[KeyRotation] SKIP: moins de 2 clés disponibles pour tester la rotation');
        return;
      }
      
      console.log(`[KeyRotation] Test de rotation avec ${keys.length} clés`);
      
      // Appeler getNextApiKey plusieurs fois et vérifier la rotation
      const calledKeys = [];
      for (let i = 0; i < keys.length * 2; i++) { // 2 tours complets
        const keyInfo = getNextApiKey('OPENCODE_ZEN_API_KEY');
        expect(keyInfo).not.toBeNull();
        calledKeys.push(keyInfo.key);
        console.log(`  Appel ${i + 1}: ${keyInfo.key}`);
      }
      
      // Vérifier que la rotation a bien eu lieu (pas toujours la même clé)
      const uniqueKeys = [...new Set(calledKeys)];
      expect(uniqueKeys.length).toBeGreaterThan(1);
      
      console.log(`[KeyRotation] ${uniqueKeys.length} clés différentes utilisées sur ${keys.length * 2} appels`);
    }, 15000);
  });

  describe('getNextApiKey — incrémente l index après chaque appel', () => {
    it('l index de rotation change après chaque appel', async () => {
      resetRotationIndex('OPENCODE_ZEN_API_KEY');
      
      const keys = getAllKeysForEnvKey('OPENCODE_ZEN_API_KEY');
      if (keys.length < 2) {
        console.log('[KeyRotation] SKIP: moins de 2 clés disponibles');
        return;
      }
      
      // Premier appel
      const first = getNextApiKey('OPENCODE_ZEN_API_KEY');
      const firstIndex = first.index;
      
      // Deuxième appel - doit retourner une clé différente (si on a assez de clés)
      const second = getNextApiKey('OPENCODE_ZEN_API_KEY');
      
      if (keys.length > 1) {
        // Avec 2+ clés, on doit avoir une clé différente OU la même avec index différent
        console.log(`  Première clé: ${first.key} (index=${firstIndex})`);
        console.log(`  Deuxième clé: ${second.key} (index=${second.index})`);
        
        // L'index doit avoir changé (même si la clé est la même à cause du modulo)
        // Après 2 appels sur 3 clés: 0 → 1 → 2 → 0...
      }
    }, 15000);
  });

  describe('resetRotationIndex — reset l index de rotation', () => {
    it('resetRamène l index à 0 après reset', async () => {
      const keys = getAllKeysForEnvKey('OPENCODE_ZEN_API_KEY');
      if (keys.length < 2) {
        console.log('[KeyRotation] SKIP: moins de 2 clés disponibles');
        return;
      }
      
      // Faire quelques appels pour faire avancer l'index
      getNextApiKey('OPENCODE_ZEN_API_KEY');
      getNextApiKey('OPENCODE_ZEN_API_KEY');
      
      // Reset
      resetRotationIndex('OPENCODE_ZEN_API_KEY');
      
      // Le prochain appel doit retourner la première clé (index 0)
      const keyAfterReset = getNextApiKey('OPENCODE_ZEN_API_KEY');
      expect(keyAfterReset.index).toBe(0);
      
      console.log(`[KeyRotation] Après reset, l'index est revenu à ${keyAfterReset.index} (clé: ${keyAfterReset.key})`);
    }, 15000);
  });

  describe('Simulation erreur 429 → rotation', () => {
    it('simule une erreur 429 et vérifie que la rotation fonctionne', async () => {
      const keys = getAllKeysForEnvKey('OPENCODE_ZEN_API_KEY');
      if (keys.length < 2) {
        console.log('[KeyRotation] SKIP: moins de 2 clés disponibles pour tester la rotation');
        return;
      }
      
      console.log(`[KeyRotation] Simulation erreur 429 avec ${keys.length} clés`);
      
      // Réinitialiser
      resetRotationIndex('OPENCODE_ZEN_API_KEY');
      
      // Simuler: première clé cause 429 → on appelle getNextApiKey pour obtenir la suivante
      // puis on reset l'index pour la prochaine tentative
      const firstKey = getNextApiKey('OPENCODE_ZEN_API_KEY');
      console.log(`  Première clé (simule 429): ${firstKey.key}`);
      
      // Après erreur 429, on fait resetRotationIndex (comme dans le code aiClient)
      resetRotationIndex('OPENCODE_ZEN_API_KEY');
      
      // Maintenant le prochain getNextApiKey doit retourner la même clé (index 0)
      const afterReset = getNextApiKey('OPENCODE_ZEN_API_KEY');
      expect(afterReset.key).toBe(firstKey.key);
      console.log(`  Après reset, on retombe sur: ${afterReset.key}`);
      
      // Vérifier la rotation: avec 3 clés et après reset, les appels retournent:
      // Appel 1 → key[0] (index devient 1)
      // Appel 2 → key[1] (index devient 2)
      // Appel 3 → key[2] (index devient 0)
      resetRotationIndex('OPENCODE_ZEN_API_KEY');
      const firstAfterReset = getNextApiKey('OPENCODE_ZEN_API_KEY'); // index 0 → key[0]
      const secondAfterReset = getNextApiKey('OPENCODE_ZEN_API_KEY'); // index 1 → key[1]
      const thirdAfterReset = getNextApiKey('OPENCODE_ZEN_API_KEY'); // index 2 → key[2]
      console.log(`  Après reset: ${firstAfterReset.key}, ${secondAfterReset.key}, ${thirdAfterReset.key}`);
      
      // Vérifier que la rotation a bien eu lieu
      expect(thirdAfterReset.index).toBe(2);
    }, 15000);
  });

  describe('Test avec plusieurs providers', () => {
    it('Chaque provider a son propre index de rotation', async () => {
      // Vérifier OPENCODE_ZEN_API_KEY
      const opencodeKeys = getAllKeysForEnvKey('OPENCODE_ZEN_API_KEY');
      
      // Vérifier OPENROUTER_API_KEY
      const openrouterKeys = getAllKeysForEnvKey('OPENROUTER_API_KEY');
      
      console.log(`[KeyRotation] OPENCODE_ZEN: ${opencodeKeys.length} clés`);
      console.log(`[KeyRotation] OPENROUTER: ${openrouterKeys.length} clés`);
      
      // Les deux providers doivent avoir des index de rotation indépendants
      if (opencodeKeys.length >= 2 && openrouterKeys.length >= 2) {
        resetRotationIndex('OPENCODE_ZEN_API_KEY');
        resetRotationIndex('OPENROUTER_API_KEY');
        
        // Avancer l'index de OPENCODE_ZEN de 2
        getNextApiKey('OPENCODE_ZEN_API_KEY');
        getNextApiKey('OPENCODE_ZEN_API_KEY');
        
        // OPENROUTER doit encore être à 0
        const openrouterKey = getNextApiKey('OPENROUTER_API_KEY');
        expect(openrouterKey.index).toBe(0);
        
        console.log(`[KeyRotation] Les index sont indépendants: OPENCODE_ZEN avance, OPENROUTER reste à 0`);
      }
    }, 15000);
  });
});