import { execSync } from 'node:child_process';
import { appendFileSync, cpSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const LOG = join(process.cwd(), 'debug-46631d.log');
const sessionId = '46631d';

function log(hypothesisId, location, message, data = {}) {
  appendFileSync(
    LOG,
    JSON.stringify({
      sessionId,
      runId: 'temp-copy',
      hypothesisId,
      location,
      message,
      data,
      timestamp: Date.now(),
    }) + '\n'
  );
}

const source = process.cwd();
const tempRoot = mkdtempSync(join(tmpdir(), 'connectwave-railpack-'));

try {
  cpSync(join(source, 'package.json'), join(tempRoot, 'package.json'));
  cpSync(join(source, 'package-lock.json'), join(tempRoot, 'package-lock.json'));
  cpSync(join(source, 'client'), join(tempRoot, 'client'), {
    recursive: true,
    filter: (src) => !src.includes('node_modules') && !src.includes('dist'),
  });

  log('H5', 'temp-copy:setup', 'Created isolated build tree', { tempRoot });

  const env = { ...process.env, NODE_ENV: 'production', npm_config_production: 'true' };

  execSync('npm ci', { cwd: tempRoot, stdio: 'pipe', env });
  log('H5', 'temp-copy:after-ci', 'Root npm ci succeeded in temp tree', {});

  const clientNodeModules = join(tempRoot, 'client', 'node_modules');
  const clientBin = join(clientNodeModules, '.bin', 'vite');
  log('H1', 'temp-copy:paths', 'Paths after root-only npm ci', {
    clientNodeModulesExists: existsSync(clientNodeModules),
    clientBinExists: existsSync(clientBin),
  });

  let buildExit = 0;
  let buildStderr = '';
  try {
    execSync('npm run build', { cwd: tempRoot, stdio: 'pipe', env });
    log('H3', 'temp-copy:build', 'npm run build succeeded', {});
  } catch (err) {
    buildExit = err.status ?? 1;
    buildStderr = err.stderr?.toString?.() ?? String(err);
    log('H3', 'temp-copy:build', 'npm run build failed', {
      exitCode: buildExit,
      stderr: buildStderr.slice(0, 800),
    });
  }

  log('H1', 'temp-copy:summary', 'Isolated simulation complete', { buildExit });
} finally {
  try {
    rmSync(tempRoot, { recursive: true, force: true });
  } catch {
    log('H1', 'temp-copy:cleanup', 'Temp dir cleanup skipped', { tempRoot });
  }
}
