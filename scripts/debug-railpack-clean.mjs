import { execSync } from 'node:child_process';
import { existsSync, appendFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const LOG = join(process.cwd(), 'debug-46631d.log');
const sessionId = '46631d';
const runId = 'clean-room';

function log(hypothesisId, location, message, data = {}) {
  appendFileSync(
    LOG,
    JSON.stringify({
      sessionId,
      runId,
      hypothesisId,
      location,
      message,
      data,
      timestamp: Date.now(),
    }) + '\n'
  );
}

const clientDir = join(process.cwd(), 'client');
const clientNodeModules = join(clientDir, 'node_modules');
const clientBin = join(clientNodeModules, '.bin', 'vite');

process.env.NODE_ENV = 'production';
process.env.npm_config_production = 'true';

if (existsSync(clientNodeModules)) {
  rmSync(clientNodeModules, { recursive: true, force: true });
  log('H1', 'clean-room:setup', 'Removed client/node_modules for fresh simulation', {});
}

try {
  execSync('npm ci', { stdio: 'pipe', env: process.env });
  log('H5', 'clean-room:after-root-ci', 'Root npm ci succeeded', {});
} catch (err) {
  log('H5', 'clean-room:root-ci-fail', 'Root npm ci failed', {
    stderr: err.stderr?.toString?.() ?? String(err),
  });
}

log('H1', 'clean-room:paths', 'Paths after root-only npm ci', {
  clientNodeModulesExists: existsSync(clientNodeModules),
  clientBinExists: existsSync(clientBin),
});

let buildExit = 0;
let buildStderr = '';
try {
  execSync('npm run build', { stdio: 'pipe', env: process.env });
  log('H3', 'clean-room:build', 'npm run build succeeded', {});
} catch (err) {
  buildExit = err.status ?? 1;
  buildStderr = err.stderr?.toString?.() ?? String(err);
  log('H3', 'clean-room:build', 'npm run build failed', {
    exitCode: buildExit,
    stderr: buildStderr.slice(0, 800),
  });
}

log('H1', 'clean-room:summary', 'Clean-room simulation complete', { buildExit });
