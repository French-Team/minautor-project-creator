/**
 * dev.mjs — Démarrage propre des deux serveurs
 *
 * Étapes :
 *   1) Vide le terminal
 *   2) Tue tout processus sur ENV_PORT (3001) et VITE_PORT (8081)
 *   3) Lance env-server.mjs et vite en parallèle
 *   4) Forward SIGINT/SIGTERM aux sous-processus
 *
 * Cross-platform : Windows (netstat + taskkill) et Unix (lsof + kill).
 */

import { spawn, execSync } from 'node:child_process';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const ENV_PORT = 3001;
const VITE_PORT = Number(process.env.VITE_PORT) || 8081;

/* ---------- helpers ---------- */

function clearTerminal() {
  if (process.stdout.isTTY) {
    process.stdout.write('\u001B[2J\u001B[H');
  } else {
    console.clear();
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function killOnWindows(port) {
  try {
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
        console.log(`  🔪 PID ${pid} killed (port ${port})`);
      } catch (_) { /* PID already gone */ }
    }
    return pids.size;
  } catch (_) {
    return 0; // findstr returns exit code 1 if nothing found
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
        console.log(`  🔪 PID ${pid} killed (port ${port})`);
        count++;
      } catch (_) { /* PID already gone */ }
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

function resolveBin(binName) {
  const isWin = process.platform === 'win32';
  return resolve(
    projectRoot,
    'node_modules',
    '.bin',
    isWin ? `${binName}.cmd` : binName,
  );
}

/* ---------- main ---------- */

async function main() {
  clearTerminal();

  console.log('🧹  Clean startup');
  console.log('─────────────────────');
  console.log(`📍  Ports: env-server=${ENV_PORT}, vite=${VITE_PORT}`);

  // Free both ports
  const killedEnv = freePort(ENV_PORT);
  const killedVite = freePort(VITE_PORT);

  if (killedEnv === 0) {
    console.log(`✅  Port ${ENV_PORT} (env-server) is free`);
  } else {
    console.log(`✅  ${killedEnv} process(es) freed on port ${ENV_PORT}`);
    await sleep(300);
  }

  if (killedVite === 0) {
    console.log(`✅  Port ${VITE_PORT} (vite) is free`);
  } else {
    console.log(`✅  ${killedVite} process(es) freed on port ${VITE_PORT}`);
    await sleep(300);
  }

  console.log('');
  console.log('🚀  Starting servers...');
  console.log('');

  // Start env-server (node is a system binary, no need to resolve from .bin)
  const envServerPath = resolve(__dirname, 'env-server.mjs');
  const envChild = spawn('node', [envServerPath], {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, FORCE_COLOR: '1' },
  });

  // Start vite after a small delay to let env-server initialize
  await sleep(500);
  const viteBin = resolveBin('vite');
  const viteChild = spawn(viteBin, ['--port', String(VITE_PORT)], {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, FORCE_COLOR: '1' },
  });

  const shutdown = (signal) => {
    console.log('\n🛑 Shutting down...');
    if (!envChild.killed) envChild.kill(signal);
    if (!viteChild.killed) viteChild.kill(signal);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Monitor children exit
  envChild.on('exit', (code, signal) => {
    if (signal || (code !== null && code !== 0)) {
      console.error(`❌ env-server exited with code ${code}, signal ${signal}`);
    }
    if (!viteChild.killed) viteChild.kill('SIGINT');
    process.exit(signal ? 1 : (code ?? 0));
  });

  viteChild.on('exit', (code, signal) => {
    if (!envChild.killed) envChild.kill('SIGINT');
    process.exit(signal ? 1 : (code ?? 0));
  });
}

main().catch((err) => {
  console.error('❌ Startup failed:', err.message);
  process.exit(1);
});