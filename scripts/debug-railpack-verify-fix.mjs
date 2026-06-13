import { execSync } from 'node:child_process';
import { appendFileSync, cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const LOG = join(process.cwd(), 'debug-46631d.log');
const sessionId = '46631d';

function log(hypothesisId, location, message, data = {}) {
  appendFileSync(
    LOG,
    JSON.stringify({
      sessionId,
      runId: 'post-fix',
      hypothesisId,
      location,
      message,
      data,
      timestamp: Date.now(),
    }) + '\n'
  );
}

const source = process.cwd();
const tempRoot = mkdtempSync(join(tmpdir(), 'connectwave-railpack-fix-'));

try {
  cpSync(join(source, 'package.json'), join(tempRoot, 'package.json'));
  cpSync(join(source, 'package-lock.json'), join(tempRoot, 'package-lock.json'));
  cpSync(join(source, 'client'), join(tempRoot, 'client'), {
    recursive: true,
    filter: (src) => !src.includes('node_modules') && !src.includes('dist'),
  });
  cpSync(join(source, 'server'), join(tempRoot, 'server'), {
    recursive: true,
    filter: (src) => !src.includes('node_modules'),
  });

  const prebuild = JSON.parse(readFileSync(join(tempRoot, 'package.json'), 'utf8')).scripts?.prebuild;
  log('H1', 'verify-fix:setup', 'Testing prebuild hook in isolated tree', { tempRoot, prebuild });

  const env = { ...process.env, NODE_ENV: 'production', npm_config_production: 'true' };

  execSync('npm ci', { cwd: tempRoot, stdio: 'pipe', env });
  log('H5', 'verify-fix:after-root-ci', 'Root npm ci succeeded', {});

  let buildExit = 0;
  let buildStderr = '';
  try {
    execSync('npm run build', { cwd: tempRoot, stdio: 'pipe', env });
    log('H3', 'verify-fix:build', 'npm run build succeeded with prebuild hook', {
      clientBinExists: existsSync(join(tempRoot, 'client', 'node_modules', '.bin', 'vite')),
      clientDistExists: existsSync(join(tempRoot, 'client', 'dist', 'index.html')),
    });
  } catch (err) {
    buildExit = err.status ?? 1;
    buildStderr = err.stderr?.toString?.() ?? String(err);
    log('H3', 'verify-fix:build', 'npm run build failed', {
      exitCode: buildExit,
      stderr: buildStderr.slice(0, 800),
    });
  }

  log('H1', 'verify-fix:summary', 'Post-fix verification complete', { buildExit });
} finally {
  try {
    rmSync(tempRoot, { recursive: true, force: true });
  } catch {
    log('H1', 'verify-fix:cleanup', 'Temp dir cleanup skipped', { tempRoot });
  }
}
