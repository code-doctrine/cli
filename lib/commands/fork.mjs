import { cpSync, existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { cleanupDoctrinePackage, materializeDoctrinePackage, resolveDoctrineReference } from '../doctrine-package.mjs';
import { ensureDir, fail } from '../utils.mjs';

function parseForkArgs(args) {
  const remaining = [...args];
  let destination = null;
  let force = false;

  while (remaining.length > 0) {
    const arg = remaining.shift();
    if (arg === '--force') {
      force = true;
      continue;
    }
    if (destination) fail(`Unknown argument: ${arg}`);
    destination = resolve(arg);
  }

  return { destination, force };
}

function defaultForkDestination(resolved) {
  if (resolved.source === 'local') return resolve(`${basename(resolved.packageSpec)}-fork`);
  if (resolved.author) return resolve(`${resolved.author}-code-doctrine`);
  return resolve('code-doctrine-local');
}

export function runFork(args) {
  const source = args.shift();
  if (!source) fail('Missing doctrine reference. Usage: code-doctrine fork <author|path> [dest-dir] [--force]');

  const resolved = resolveDoctrineReference(source);
  const options = parseForkArgs(args);
  const doctrinePackage = materializeDoctrinePackage(resolved);

  try {
    const destination = options.destination ?? defaultForkDestination(resolved);
    if (existsSync(destination)) {
      if (!statSync(destination).isDirectory()) fail(`Fork destination exists and is not a directory: ${destination}`);
      const hasEntries = readdirSync(destination).length > 0;
      if (hasEntries && !options.force) {
        fail(`Fork destination is not empty: ${destination}. Re-run with --force to overwrite.`);
      }
      if (hasEntries && options.force) rmSync(destination, { recursive: true, force: true });
    }

    ensureDir(dirname(destination));
    cpSync(doctrinePackage.packageRoot, destination, { recursive: true, force: true });

    console.log(`✅ Forked doctrine into ${destination}`);
    console.log(`Source: ${resolved.display}${resolved.source === 'local' ? ' (local)' : ` (${resolved.source})`}`);
    console.log('Next steps:');
    console.log(`- edit files in ${destination}`);
    console.log(`- install locally with: code-doctrine install ${destination} opencode --project`);
    console.log(`- or for Pi: code-doctrine install ${destination} pi --project`);
  } finally {
    cleanupDoctrinePackage(doctrinePackage);
  }
}
