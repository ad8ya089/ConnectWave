import { execSync } from 'node:child_process';
import { existsSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';

const LOG = join(process.cwd(), 'debug-46631d.log');
const sessionId = '46631d';

function log(hypothesisId, location, message, data = {}) {
  const entry = JSON.stringify({
    sessionId,
    runId: 'railpack-sim',
    hypothesisId,
    location,
    message,
    data,
    timestamp: Date.now(),
  });
  appendFileSync(LOG, entry + '\n');
}

const clientBin = join(process.cwd(), 'client', 'node_modules', '.bin', 'vite');
const clientVitePkg = join(process.cwd(), 'client', 'node_modules', 'vite');
const rootBin = join(process.cwd(), 'node_modules', '.bin', 'vite');

process.env.NODE_ENV = 'production';
process.env.npm_config_production = 'true';

log('H5', 'debug-railpack-build.mjs:setup', 'Starting Railway build simulation', {
  NODE_ENV: process.env.NODE_ENV,
  cwd: process.cwd(),
});

try {
  execSync('npm ci', { stdio: 'pipe', env: process.env });
  log('H5', 'debug-railpack-build.mjs:after-root-ci', 'Root npm ci succeeded', {});
} catch (err) {
  log('H5', 'debug-railpack-build.mjs:root-ci-fail', 'Root npm ci failed', {
    stderr: err.stderr?.toString?.() ?? String(err),
  });
}

log('H1', 'debug-railpack-build.mjs:paths', 'Checking vite binary paths after root npm ci', {
  clientBinExists: existsSync(clientBin),
  clientVitePkgExists: existsSync(clientVitePkg),
  rootBinExists: existsSync(rootBin),
  clientNodeModulesExists: existsSync(join(process.cwd(), 'client', 'node_modules')),
});

let buildExit = 0;
let buildStderr = '';
try {
  execSync('npm run build', { stdio: 'pipe', env: process.env });
  log('H3', 'debug-railpack-build.mjs:build', 'npm run build succeeded', {});
} catch (err) {
  buildExit = err.status ?? 1;
  buildStderr = err.stderr?.toString?.() ?? String(err);
  log('H3', 'debug-railpack-build.mjs:build', 'npm run build failed', {
    exitCode: buildExit,
    stderr: buildStderr.slice(0, 500),
  });
}

log('H2', 'debug-railpack-build.mjs:summary', 'Simulation complete', {
  buildExit,
  viteInClientDeps: true,
});
