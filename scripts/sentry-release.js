const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.join(__dirname, '..');
const sentryCli = path.join(
  projectRoot,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'sentry-cli.cmd' : 'sentry-cli'
);

function loadEnvFile(fileName) {
  const filePath = path.join(projectRoot, fileName);
  if (!fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;

    process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}

function run(args, options = {}) {
  return execFileSync(sentryCli, args, {
    cwd: projectRoot,
    stdio: options.stdio ?? 'inherit',
    encoding: 'utf8',
  });
}

try {
  loadEnvFile('.env.local');
  loadEnvFile('.env');

  if (!process.env.SENTRY_AUTH_TOKEN) {
    throw new Error('Missing SENTRY_AUTH_TOKEN. Set it in your environment before running this script.');
  }

  const version = run(['releases', 'propose-version'], {
    stdio: ['ignore', 'pipe', 'inherit'],
  }).trim();

  console.log(`Creating Sentry release ${version}`);
  run(['releases', 'new', version]);
  run(['releases', 'set-commits', version, '--auto']);
  run(['releases', 'finalize', version]);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
