/**
 * Script de test des cles API individuellement avec minimax
 * 
 * Usage: npm run dev (dans un terminal), puis node scripts/test-keys.mjs
 * 
 * Teste chaque cle OPENCODE_ZEN_API_KEY (sans rotation) avec:
 * 1. minimax-m3-free (format OpenAI /responses)
 * 2. Si echec, format Anthropic (/messages)
 * 
 * Rapport detaille par cle: valid/invalid, format supporte, erreur
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

// Lire les cles depuis .env
function readKeysFromEnvFile(providerPrefix) {
  try {
    const envContent = readFileSync(resolve('./.env'), 'utf-8');
    const keys = {};
    
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex > 0) {
        const key = trimmed.substring(0, eqIndex);
        const value = trimmed.substring(eqIndex + 1);
        
        if (key.startsWith(providerPrefix)) {
          keys[key] = value;
        }
      }
    }
    return keys;
  } catch (err) {
    console.error('[test-keys] Impossible de lire .env:', err.message);
    return {};
  }
}

// Test une seule cle avec minimax-m3-free
async function testKey(keyName, apiKey) {
  console.log('\n========================================');
  console.log('Test: ' + keyName);
  console.log('========================================');
  console.log('Cle: ' + apiKey.substring(0, 15) + '...');
  
  const baseUrl = 'http://localhost:8081/local-api/opencode-zen';
  
  // Test 1: minimax-m3-free avec format OpenAI (/responses)
  console.log('\n[1] Test minimax-m3-free (format OpenAI /responses)...');
  let minimaxWorks = false;
  let minimaxFormat = null;
  let minimaxError = null;
  
  try {
    const response = await fetch(baseUrl + '/responses', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'minimax-m3-free',
        messages: [{ role: 'user', content: 'Say hello' }],
        max_tokens: 10
      }),
      signal: AbortSignal.timeout(15000)
    });
    
    const data = await response.json();
    
    if (response.ok) {
      minimaxWorks = true;
      minimaxFormat = 'openai';
      console.log('  OK - minimax-m3-free fonctionne avec format OpenAI!');
    } else {
      minimaxError = data.error?.message || data.message || 'HTTP ' + response.status;
      console.log('  ERR OpenAI: ' + minimaxError);
      
      // Essayer Anthropic
      console.log('\n[2] Test minimax-m3-free (format Anthropic /messages)...');
      try {
        const response2 = await fetch(baseUrl + '/messages', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + apiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'minimax-m3-free',
            messages: [{ role: 'user', content: 'Say hello' }],
            max_tokens: 10
          }),
          signal: AbortSignal.timeout(15000)
        });
        
        const data2 = await response2.json();
        
        if (response2.ok) {
          minimaxWorks = true;
          minimaxFormat = 'anthropic';
          console.log('  OK - minimax-m3-free fonctionne avec format Anthropic!');
        } else {
          minimaxError = data2.error?.message || data2.message || 'HTTP ' + response2.status;
          console.log('  ERR Anthropic: ' + minimaxError);
        }
      } catch (err2) {
        minimaxError = err2.message;
        console.log('  ERR Anthropic: ' + err2.message);
      }
    }
  } catch (err) {
    minimaxError = err.message;
    console.log('  ERR OpenAI: ' + err.message);
    if (err.message.includes('Timeout')) {
      console.log('  -> Timeout - le serveur met trop de temps a repondre');
    } else if (err.message.includes('fetch')) {
      console.log('  -> Verifie que npm run dev est en cours d execution');
    }
  }
  
  // Resume
  console.log('\n========================================');
  console.log('RESUME: ' + keyName);
  console.log('========================================');
  console.log('  minimax-m3-free: ' + (minimaxWorks ? 'OUI (format ' + minimaxFormat + ')' : 'NON'));
  if (minimaxError) {
    console.log('  Erreur: ' + minimaxError);
  }
  
  return { valid: minimaxWorks, minimaxWorks, minimaxFormat, minimaxError };
}

// Main
async function main() {
  console.log('========================================');
  console.log('TEST DES CLES API - OPENCODE ZEN');
  console.log('Modele: minimax-m3-free');
  console.log('========================================');
  console.log('\nVerifie que npm run dev est en cours d execution...');
  
  // Lire les cles
  const REAL_KEYS = readKeysFromEnvFile('OPENCODE_ZEN_API_KEY');
  const keyNames = Object.keys(REAL_KEYS).sort();
  
  console.log('\n' + keyNames.length + ' cles trouvees dans .env:');
  keyNames.forEach((name, i) => {
    console.log('  ' + (i + 1) + '. ' + name + ' = ' + REAL_KEYS[name].substring(0, 15) + '...');
  });
  
  if (keyNames.length === 0) {
    console.error('\nERREUR: Aucune cle OPENCODE_ZEN_API_KEY trouvee dans .env');
    process.exit(1);
  }
  
  console.log('\n');
  
  const results = [];
  
  // Tester chaque cle
  for (const keyName of keyNames) {
    const result = await testKey(keyName, REAL_KEYS[keyName]);
    results.push({ name: keyName, ...result });
  }
  
  // Rapport final
  console.log('\n========================================');
  console.log('RAPPORT FINAL');
  console.log('========================================');
  
  const minimaxWorking = results.filter(r => r.minimaxWorks);
  
  console.log('\nminimax-m3-free fonctionne sur: ' + minimaxWorking.length + '/' + keyNames.length + ' cles');
  
  results.forEach(k => {
    if (k.minimaxWorks) {
      console.log('  OK ' + k.name + ': format ' + k.minimaxFormat);
    } else {
      console.log('  ERR ' + k.name + ': ' + (k.minimaxError || 'erreur inconnue'));
    }
  });
  
  if (minimaxWorking.length === 0) {
    console.log('\nATTENTION: Le modele minimax-m3-free ne fonctionne sur AUCUNE cle!');
    console.log('Cela peut indiquer:');
    console.log('  1. Le quota gratuit du modele est epuise sur OpenCode Zen');
    console.log('  2. Le modele n est plus offert par OpenCode Zen');
    console.log('  3. Une mise a jour du serveur OpenCode Zen a change les modeles disponibles');
  }
  
  console.log('\n========================================\n');
  
  // Exit code
  if (minimaxWorking.length === 0) {
    process.exit(1);
  }
}

// Run
main().catch(err => {
  console.error('\nERREUR fatale:', err.message);
  process.exit(1);
});