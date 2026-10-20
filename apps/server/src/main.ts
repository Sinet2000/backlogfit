import { startServer } from './app.ts';
import { readConfig } from './config.ts';

const config = readConfig();
const running = await startServer(config);
const mode = config.dataDir ? 'sqlite' : 'memory';
const scale = config.timeScale === 1 ? '' : `, test time x${config.timeScale}`;
console.log(`backlogfit server listening on port ${running.port} (data: ${mode}${scale})`);

let stopping = false;
async function shutdown(): Promise<void> {
  if (stopping) return;
  stopping = true;
  try {
    await running.close();
    process.exit(0);
  } catch {
    process.exit(1);
  }
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
