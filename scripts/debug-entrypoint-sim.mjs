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
      runId: 'entrypoint-sim',
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
  PORT: '4096',
};
delete env.REDIS_URL;

// Simulate docker-entrypoint.sh: set REDIS_URL when missing (uses local redis if available)
if (!env.REDIS_URL) {
  log('H3', 'debug-entrypoint-sim.mjs', 'REDIS_URL unset — simulating bundled Redis fallback', {
    bundledRedis: true,
  });
  env.REDIS_URL = 'redis://127.0.0.1:6379';
}

const child = spawn('node', ['index.js'], {
  cwd: join(process.cwd(), 'server'),
  env,
  stdio: ['ignore', 'pipe', 'pipe'],
});

let output = '';
child.stdout.on('data', (c) => {
  output += c.toString();
});
child.stderr.on('data', (c) => {
  output += c.toString();
});

setTimeout(() => child.kill(), 8000);

child.on('close', (code) => {
  log('H3', 'debug-entrypoint-sim.mjs:exit', 'Server startup after REDIS_URL fallback', {
    exitCode: code,
    httpStarted: /Signaling server started/.test(output),
    redisVerified: /Redis connection verified/.test(output),
    outputTail: output.slice(-600),
  });
});
