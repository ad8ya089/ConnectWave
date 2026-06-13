import { spawn } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { join } from 'node:path';

const LOG = join(process.cwd(), 'debug-46631d.log');
const sessionId = '46631d';

function log(hypothesisId, location, message, data = {}) {
  appendFileSync(
    LOG,
    JSON.stringify({
      sessionId,
      runId: 'redis-missing-prod',
      hypothesisId,
      location,
      message,
      data,
      timestamp: Date.now(),
    }) + '\n'
  );
}

const env = { ...process.env, NODE_ENV: 'production', PORT: '4097' };
delete env.REDIS_URL;

log('H2', 'debug-redis-missing-prod.mjs:setup', 'Starting server in production without REDIS_URL', {});

const child = spawn('node', ['index.js'], {
  cwd: join(process.cwd(), 'server'),
  env,
  stdio: ['ignore', 'pipe', 'pipe'],
});

let output = '';
child.stdout.on('data', (chunk) => {
  output += chunk.toString();
});
child.stderr.on('data', (chunk) => {
  output += chunk.toString();
});

child.on('close', (code) => {
  log('H2', 'debug-redis-missing-prod.mjs:exit', 'Server process finished', {
    exitCode: code,
    outputTail: output.slice(-800),
    mentionsMissingRedisUrl: /Missing required environment variable: REDIS_URL/.test(output),
    httpStarted: /Signaling server started/.test(output),
  });
});
