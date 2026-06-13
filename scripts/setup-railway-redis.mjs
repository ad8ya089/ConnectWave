/**
 * One-time Railway setup: add managed Redis and wire REDIS_URL on ConnectWave.
 *
 * Prerequisites:
 *   npx @railway/cli login
 *   npx @railway/cli link   (from repo root, select your project + ConnectWave service)
 *
 * Usage:
 *   node scripts/setup-railway-redis.mjs
 *   node scripts/setup-railway-redis.mjs --service ConnectWave
 */
import { execSync } from 'node:child_process';

const railway = (args) =>
  execSync(`npx --yes @railway/cli ${args}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

const serviceFlag = process.argv.includes('--service')
  ? `--service ${process.argv[process.argv.indexOf('--service') + 1]}`
  : '--service ConnectWave';

try {
  railway('whoami');
} catch {
  console.error('Not logged in. Run: npx @railway/cli login');
  process.exit(1);
}

console.log('Adding managed Redis database…');
try {
  const out = railway('add --database redis --json');
  console.log(out.trim() || 'Redis database added.');
} catch (err) {
  const msg = `${err.stdout ?? ''}${err.stderr ?? ''}`;
  if (/already exists|duplicate/i.test(msg)) {
    console.log('Redis may already exist in this project — continuing.');
  } else {
    console.error(msg || err.message);
    process.exit(1);
  }
}

console.log(`Setting REDIS_URL reference on ${serviceFlag.replace('--service ', '')}…`);
railway("variable set REDIS_URL='${{Redis.REDIS_URL}}' " + serviceFlag.replace('--service', '-s'));

console.log('Done. Redeploy ConnectWave to pick up REDIS_URL.');
console.log('Preferred: managed Redis via reference variable.');
console.log('Fallback: root Dockerfile starts bundled Redis when REDIS_URL is unset.');
