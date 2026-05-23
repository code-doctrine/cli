import os from 'node:os';
import { join, resolve } from 'node:path';
import { cleanupDoctrinePackage, materializeDoctrinePackage, resolveDoctrineReference } from '../doctrine-package.mjs';
import { installDoctrineIntoTarget } from '../install-target.mjs';
import { fail } from '../utils.mjs';

function parseInstallTargetArgs(args) {
  const remaining = [...args];
  let target = 'all';
  if (remaining[0] && ['opencode', 'pi', 'all'].includes(remaining[0])) target = remaining.shift();

  let mode = 'project';
  let projectDir = process.cwd();
  let force = false;
  let piDir = null;

  while (remaining.length > 0) {
    const arg = remaining.shift();
    if (arg === '--global') {
      mode = 'global';
      continue;
    }
    if (arg === '--project') {
      mode = 'project';
      if (remaining[0] && !remaining[0].startsWith('--')) projectDir = resolve(remaining.shift());
      continue;
    }
    if (arg === '--force') {
      force = true;
      continue;
    }
    if (arg === '--pi-dir') {
      const value = remaining.shift();
      if (!value || value.startsWith('--')) fail('Missing path after --pi-dir');
      piDir = resolve(value);
      continue;
    }
    fail(`Unknown argument: ${arg}`);
  }

  return { target, mode, projectDir, force, piDir };
}

export function runInstall(args) {
  const reference = args.shift();
  if (!reference) fail('Missing doctrine reference. Usage: code-doctrine install <author|path> [opencode|pi|all] [...flags]');

  const resolved = resolveDoctrineReference(reference);
  const options = parseInstallTargetArgs(args);
  const doctrinePackage = materializeDoctrinePackage(resolved);

  try {
    console.log(`→ Resolved ${reference} to ${resolved.display} (${resolved.source})`);
    const results = [];

    if (options.target === 'opencode' || options.target === 'all') {
      const targetRoot = options.mode === 'global'
        ? join(os.homedir(), '.config', 'opencode')
        : join(options.projectDir, '.opencode');
      console.log(`🎯 Installing ${doctrinePackage.doctrine.name} for OpenCode (${options.mode})...`);
      results.push({
        target: 'opencode',
        ...installDoctrineIntoTarget(targetRoot, doctrinePackage, options.force),
      });
    }

    if (options.target === 'pi' || options.target === 'all') {
      const targetRoot = options.piDir ?? join(os.homedir(), '.pi', 'agent');
      console.log(`🎯 Installing ${doctrinePackage.doctrine.name} for Pi...`);
      results.push({
        target: 'pi',
        ...installDoctrineIntoTarget(targetRoot, doctrinePackage, options.force),
      });
    }

    for (const result of results) {
      console.log(`\n✅ ${result.target} setup complete`);
      console.log(`Target root: ${result.targetRoot}`);
      console.log(`Skill path: ${result.skillTargetDir}`);
      console.log(`Installed or updated: ${result.installedCount}`);
      console.log(`Unchanged: ${result.unchangedCount}`);
      console.log(`Conflicts handled: ${result.conflictCount}`);
      console.log(`AGENTS.md: ${result.agentsStatus}`);
      if (result.conflicts.length > 0) {
        console.log('\nOverwritten conflicting files due to --force:');
        for (const path of result.conflicts) console.log(`- ${path}`);
      }
    }
  } finally {
    cleanupDoctrinePackage(doctrinePackage);
  }
}
