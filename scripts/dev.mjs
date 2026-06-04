/**
 * dev.mjs — Démarrage propre du serveur Vite
 *
 * Étapes :
 *   1) Vide le terminal
 *   2) Tue tout processus qui écoute sur VITE_PORT (8081)
 *   3) Lance Vite depuis node_modules/.bin
 *   4) Forward SIGINT/SIGTERM au sous-processus
 *
 * Cross-platform : Windows (netstat + taskkill) et Unix (lsof + kill).
 */

import { spawn, execSync } from 'node:child_process';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const PORT = Number(process.env.VITE_PORT) || 8081;

/* ---------- helpers ---------- */

function clearTerminal() {
  if (process.stdout.isTTY) {
    // ANSI : clear screen + cursor en haut à gauche
    process.stdout.write('\x1B[2J\x1B[H');
  } else {
    console.clear();
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function killOnWindows(port) {
  try {
    // netstat -ano liste toutes les connexions avec le PID en dernière colonne
    const out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
    const pids = new Set();
    for (const line of out.split('\n')) {
      if (!line.includes('LISTENING')) continue;
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && /^\d+$/.test(pid)) pids.add(pid);
    }
    for (const pid of pids) {
      try {
        execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
        console.log(`  🔪 PID ${pid} tué (port ${port})`);
      } catch (_) { /* PID déjà disparu */ }
    }
    return pids.size;
  } catch (_) {
    return 0; // findstr retourne exit code 1 si rien trouvé
  }
}

function killOnUnix(port) {
  try {
    const out = execSync(`lsof -ti:${port}`, { encoding: 'utf8' });
    let count = 0;
    for (const pid of out.trim().split('\n')) {
      if (!pid) continue;
      try {
        process.kill(parseInt(pid, 10), 'SIGKILL');
        console.log(`  🔪 PID ${pid} tué (port ${port})`);
        count++;
      } catch (_) { /* PID déjà disparu */ }
    }
    return count;
  } catch (_) {
    return 0;
  }
}

function freePort(port) {
  const killed = process.platform === 'win32'
    ? killOnWindows(port)
    : killOnUnix(port);
  return killed;
}

function resolveViteBin() {
  const isWin = process.platform === 'win32';
  const bin = resolve(
    projectRoot,
    'node_modules',
    '.bin',
    isWin ? 'vite.cmd' : 'vite',
  );
  return bin;
}

/* ---------- main ---------- */

async function main() {
  clearTerminal();

  console.log('🧹  Démarrage propre');
  console.log('─────────────────────');
  console.log(`📍  Port cible : ${PORT}`);

  const killed = freePort(PORT);
  if (killed === 0) {
    console.log(`✅  Port ${PORT} libre`);
  } else {
    console.log(`✅  ${killed} processus libéré${killed > 1 ? 's' : ''} sur le port ${PORT}`);
    await sleep(400); // laisse l'OS relâcher le socket
  }
  console.log('');

  const viteBin = resolveViteBin();
  console.log(`🚀  Lancement de Vite…`);
  console.log('');

  const child = spawn(viteBin, [], {
    stdio: 'inherit',
    cwd: projectRoot,
    shell: process.platform === 'win32',
    env: { ...process.env, FORCE_COLOR: '1' },
  });

  const shutdown = (signal) => {
    if (!child.killed) child.kill(signal);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  child.on('exit', (code, signal) => {
    if (signal) process.exit(1);
    process.exit(code ?? 0);
  });
}

main().catch((err) => {
  console.error('❌ Échec du démarrage :', err.message);
  process.exit(1);
});
