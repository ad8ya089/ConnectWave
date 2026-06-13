import { execSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { join } from 'node:path';

const LOG = join(process.cwd(), 'debug-46631d.log');
const sessionId = '46631d';

function log(hypothesisId, location, message, data = {}) {
  appendFileSync(
    LOG,
    JSON.stringify({
      sessionId,
      runId: 'docker-clean',
      hypothesisId,
      location,
      message,
      data,
      timestamp: Date.now(),
    }) + '\n'
  );
}

const cwd = process.cwd().replace(/\\/g, '/');
const script = `
set -e
cd /app
export NODE_ENV=production
export npm_config_production=true
echo "=== root npm ci ==="
npm ci
echo "=== check client node_modules ==="
ls -la client/node_modules 2>&1 || echo "NO client/node_modules"
test -f client/node_modules/.bin/vite && echo "VITE_BIN=YES" || echo "VITE_BIN=NO"
test -d client/node_modules/vite && echo "VITE_PKG=YES" || echo "VITE_PKG=NO"
echo "=== npm run build ==="
npm run build 2>&1 || echo "BUILD_FAILED=$?"
`.trim();

try {
  const out = execSync(
    `docker run --rm -v "${cwd}:/app" -w /app node:22-alpine sh -c ${JSON.stringify(script)}`,
    { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
  );
  const viteBin = /VITE_BIN=YES/.test(out);
  const vitePkg = /VITE_PKG=YES/.test(out);
  const buildFailed = /BUILD_FAILED=/.test(out) || /vite: not found/.test(out);
  const noClientModules = /NO client\/node_modules/.test(out);

  log('H1', 'docker-clean:result', 'Docker clean-room output parsed', {
    viteBin,
    vitePkg,
    buildFailed,
    noClientModules,
    outputTail: out.slice(-1200),
  });
} catch (err) {
  const out = `${err.stdout ?? ''}${err.stderr ?? ''}`;
  log('H1', 'docker-clean:error', 'Docker simulation error', {
    outputTail: out.slice(-1200),
  });
}
