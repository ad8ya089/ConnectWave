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
      runId: 'redis-unreachable',
      hypothesisId,
      location,
      message,
      data,
      timestamp: Date.now(),
    }) + '\n'
  );
}

const env = {
  ...process.env,
  NODE_ENV: 'production',
  PORT: '4098',
  REDIS_URL: 'redis://127.0.0.1:16379',
};

log('H1', 'debug-redis-unreachable.mjs:setup', 'Starting server with unreachable REDIS_URL', {
  redisUrl: env.REDIS_URL,
});

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

setTimeout(() => child.kill(), 12000);

child.on('close', (code) => {
  log('H1', 'debug-redis-unreachable.mjs:exit', 'Server process finished', {
    exitCode: code,
    outputTail: output.slice(-1500),
    mentionsUnreachable: /Redis unreachable|Failed to start server|ECONNREFUSED/i.test(output),
    httpStarted: /Signaling server started/.test(output),
  });
});
