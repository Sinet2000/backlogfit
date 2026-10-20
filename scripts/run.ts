/**
 * Local runner.
 *
 *   node scripts/run.ts dev    API server on :8080 + Vite with hot reload on :5173
 *   node scripts/run.ts start  production build served by the Node server on :8080
 */
import { type ChildProcess, spawn, spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const mode = process.argv[2] ?? 'dev';
const port = process.env.PORT ?? '8080';
const children: ChildProcess[] = [];

function run(name: string, args: string[], env: Record<string, string>): void {
  const child = spawn('pnpm', args, {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: 'inherit',
  });
  child.on('exit', (code) => {
    if (code && code !== 0) console.error(`${name} exited with ${code}`);
    stop(code ?? 0);
  });
  children.push(child);
}

function stop(code = 0): void {
  for (const c of children) if (c.exitCode === null) c.kill('SIGTERM');
  process.exit(code);
}

process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());

if (mode === 'dev') {
  console.log('\n  Backlogfit dev: open http://localhost:5173  (API only on :%s)\n', port);
  // API only: the server must not serve an old production build next to the live Vite app.
  run('server', ['--filter', '@backlogfit/server', 'dev'], {
    PORT: port,
    PUBLIC_ORIGIN: `http://localhost:${port}`,
    ALLOWED_ORIGINS: 'http://localhost:5173',
    WEB_DIR: join(root, 'apps/server/.no-web'),
  });
  run('web', ['--filter', '@backlogfit/web', 'dev'], {});
} else if (mode === 'start') {
  const build = spawnSync('pnpm', ['--filter', '@backlogfit/web', 'build'], {
    cwd: root,
    stdio: 'inherit',
  });
  if (build.status !== 0) process.exit(build.status ?? 1);
  console.log('\n  Backlogfit: open http://localhost:%s\n', port);
  run('server', ['--filter', '@backlogfit/server', 'start'], {
    NODE_ENV: 'production',
    PORT: port,
    PUBLIC_ORIGIN: process.env.PUBLIC_ORIGIN ?? `http://localhost:${port}`,
  });
} else {
  console.error('usage: node scripts/run.ts dev|start');
  process.exit(2);
}
