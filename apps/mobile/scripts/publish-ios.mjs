#!/usr/bin/env node
/**
 * Build the Neara iOS app and submit it to TestFlight in one run.
 *
 *   node scripts/publish-ios.mjs                  build a new version, then submit it
 *   node scripts/publish-ios.mjs --id <build-id>  submit an existing iOS build
 *   node scripts/publish-ios.mjs --help
 *
 * Requires an EAS login (`npx eas-cli login`). The App Store Connect app id
 * (ascAppId) is configured in eas.json under submit.production.ios.
 */
import { spawn } from 'node:child_process';
import { createWriteStream, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const mobileDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const profile = process.env.EAS_PROFILE || 'production';
const logDir = path.join(mobileDir, '.publish-logs');

const buildIdPattern =
  /builds\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/;

function printUsage() {
  console.log(`Usage:
  node scripts/publish-ios.mjs                  build a new iOS build, then submit it
  node scripts/publish-ios.mjs --id <build-id>  submit an existing iOS build
  node scripts/publish-ios.mjs --help

Environment:
  EAS_PROFILE  EAS build/submit profile (default: production)`);
}

function fail(message) {
  console.error(`\n${message}`);
  process.exit(1);
}

let buildId = '';
const args = process.argv.slice(2);

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === '--id') {
    buildId = args[i + 1] || '';
    i += 1;
    if (!buildId) fail('--id needs a build id.');
  } else if (arg === '--help' || arg === '-h') {
    printUsage();
    process.exit(0);
  } else {
    console.error(`Unknown argument: ${arg}\n`);
    printUsage();
    process.exit(1);
  }
}

mkdirSync(logDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const logPath = path.join(logDir, `ios-${stamp}.log`);
const log = createWriteStream(logPath, { flags: 'a' });

const say = (message) => console.log(`\n==> ${message}`);

const easConfig = JSON.parse(readFileSync(path.join(mobileDir, 'eas.json'), 'utf8'));
const productionApiUrl = easConfig?.build?.[profile]?.env?.EXPO_PUBLIC_API_URL?.replace(
  /\/+$/,
  '',
);

/**
 * Fails when the API baked into the build is unreachable, and reports dependency
 * readiness. A red dependency does not block the build because some are optional,
 * but it is printed so the build is not shipped against a half-configured backend.
 */
async function preflightApi() {
  if (!productionApiUrl) {
    console.log(`\n==> No EXPO_PUBLIC_API_URL in the ${profile} profile; skipping API preflight.`);
    return;
  }

  console.log(`\n==> Checking ${productionApiUrl}`);

  let health;
  try {
    const response = await fetch(`${productionApiUrl}/health`, {
      signal: AbortSignal.timeout(10_000),
    });
    health = { status: response.status, body: await response.json().catch(() => null) };
  } catch (error) {
    fail(
      `Cannot reach the production API at ${productionApiUrl}.\n` +
        `Fix the deployment or EXPO_PUBLIC_API_URL in eas.json before shipping.\n${error.message}`,
    );
  }

  if (health.status !== 200 || health.body?.ok !== true) {
    fail(`${productionApiUrl}/health returned ${health.status}. Refusing to build against it.`);
  }
  console.log('    api: ok');

  try {
    const response = await fetch(`${productionApiUrl}/health/dependencies`, {
      signal: AbortSignal.timeout(10_000),
    });
    const body = await response.json();
    const dependencies = ['database', 'redis', 'email', 'storage'];
    const notReady = dependencies.filter((name) => body?.[name]?.ok !== true);

    for (const name of dependencies) {
      const dependency = body?.[name];
      const detail = dependency?.ok === true ? 'ok' : `NOT READY${dependency?.error ? ` (${dependency.error})` : ''}`;
      console.log(`    ${name}: ${detail}`);
    }

    if (notReady.length > 0) {
      console.log(
        `\n    Warning: ${notReady.join(', ')} not ready. Rate limits, emails, or image uploads may fail.`,
      );
    }
  } catch (error) {
    console.log(`    Could not read dependency health: ${error.message}`);
  }
}

/** Runs `npx eas-cli <args>`, streaming (and optionally capturing) its output. */
function eas(args, { quiet = false, capture = false } = {}) {
  const command = ['npx', 'eas-cli', ...args].join(' ');
  const piped = !quiet || capture;

  return new Promise((resolve, reject) => {
    const child = spawn(command, {
      cwd: mobileDir,
      shell: true,
      stdio: ['inherit', piped ? 'pipe' : 'ignore', piped ? 'pipe' : 'ignore'],
    });

    let output = '';
    const read = (stream, target) => {
      stream.on('data', (chunk) => {
        if (!quiet) target.write(chunk);
        if (capture) output += chunk.toString();
        log.write(chunk);
      });
    };

    if (piped) {
      read(child.stdout, process.stdout);
      read(child.stderr, process.stderr);
    }

    child.on('error', reject);
    child.on('close', (code) => resolve({ code, output }));
  });
}

const login = await eas(['whoami'], { quiet: true });
if (login.code !== 0) {
  fail('Not logged in to EAS. Run: npx eas-cli login');
}

if (!buildId) {
  await preflightApi();

  say(`Building iOS (profile: ${profile}). This takes a few minutes.`);
  const build = await eas([
    'build',
    '--platform',
    'ios',
    '--profile',
    profile,
    '--non-interactive',
  ]);

  if (build.code !== 0) {
    fail(`Build failed. Full log: ${logPath}`);
  }

  buildId = build.output.match(buildIdPattern)?.[1] ?? '';

  if (!buildId) {
    const list = await eas(
      ['build:list', '--platform', 'ios', '--limit', '1', '--json'],
      { quiet: true, capture: true },
    );
    try {
      const latest = JSON.parse(list.output);
      buildId = (Array.isArray(latest) ? latest[0] : latest).id;
    } catch {
      // Fall through to the error below.
    }
  }

  if (!buildId) {
    fail(
      'Build finished but its id could not be read.\n' +
        'Find it with: npx eas-cli build:list --platform ios --limit 1',
    );
  }
} else {
  say(`Using existing build ${buildId}`);
}

say(`Submitting build ${buildId} to App Store Connect.`);
console.log("Uploading can take several minutes; the CLI may sit at 'Submitting'.");

const submit = await eas([
  'submit',
  '--platform',
  'ios',
  '--profile',
  profile,
  '--id',
  buildId,
  '--non-interactive',
]);

if (submit.code !== 0) {
  log.end();
  console.error(`\nSubmission failed. Full log: ${logPath}`);
  console.error(`Retry just the upload with: node scripts/publish-ios.mjs --id ${buildId}`);
  process.exit(1);
}

say('Done.');
console.log('Apple usually needs 5-15 minutes to process the build before it shows in TestFlight.');
console.log(`Log: ${logPath}`);
log.end();
