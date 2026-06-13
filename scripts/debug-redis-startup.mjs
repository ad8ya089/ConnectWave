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
      runId: 'redis-startup',
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
  PORT: '4099',
};
delete env.REDIS_URL;

log('H1', 'debug-redis-startup.mjs:setup', 'Starting server without REDIS_URL', {
  hasRedisUrl: Boolean(env.REDIS_URL),
  nodeEnv: env.NODE_ENV,
});

const child = spawn('node', ['index.js'], {
  cwd: join(process.cwd(), 'server'),
  env,
  stdio: ['ignore', 'pipe', 'pipe'],
});

let stdout = '';
let stderr = '';
child.stdout.on('data', (chunk) => {
  stdout += chunk.toString();
});
child.stderr.on('data', (chunk) => {
  stderr += chunk.toString();
});

const timeout = setTimeout(() => {
  child.kill();
}, 15000);

child.on('close', (code) => {
  clearTimeout(timeout);
  const output = `${stdout}\n${stderr}`;
  log('H1', 'debug-redis-startup.mjs:exit', 'Server process exited', {
    exitCode: code,
    outputTail: output.slice(-1200),
    mentionsLocalhost: /localhost:6379|127\.0\.0\.1:6379/.test(output),
    mentionsRedisUnreachable: /Redis unreachable|Redis pub client error|ECONNREFUSED/i.test(output),
    httpStarted: /Signaling server started/.test(output),
  });
});
