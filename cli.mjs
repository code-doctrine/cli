#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { dirname, join, normalize, relative, resolve } from 'node:path';

const AUTHOR_PACKAGE_SUFFIX = '/code-doctrine';
const DEFAULT_SKILL_NAME = 'code-doctrine';

function runCommand(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    stdio: options.stdio ?? ['ignore', 'pipe', 'pipe'],
    env: options.env ?? process.env,
  });
}

function ensureDir(dir) {
  mkdirSync(dir, { recursive: true });
}

function fail(message, exitCode = 1) {
  console.error(`❌ ${message}`);
  process.exit(exitCode);
}

function parseJsonFile(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replaceMarkedBlock(content, startMarker, endMarker, replacement) {
  if (!content.includes(startMarker) || !content.includes(endMarker)) return null;
  const pattern = new RegExp(`${escapeRegExp(startMarker)}[\\s\\S]*?${escapeRegExp(endMarker)}\\n?`, 'm');
  return content.replace(pattern, replacement);
}

function npmViewExists(spec) {
  const result = runCommand('npm', ['view', spec, 'name', '--json']);
  return result.status === 0;
}

function npmView(spec, fields) {
  const result = runCommand('npm', ['view', spec, ...fields, '--json']);
  let json = null;
  if (result.stdout?.trim()) {
    try {
      json = JSON.parse(result.stdout);
    } catch {
      json = null;
    }
  }
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    json,
  };
}

function npmSearch(terms) {
  const result = runCommand('npm', ['search', ...terms, '--json']);
  let json = null;
  if (result.stdout?.trim()) {
    try {
      json = JSON.parse(result.stdout);
    } catch {
      json = null;
    }
  }
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    json,
  };
}

function resolveDoctrine(author) {
  const trimmed = author.trim();
  if (!trimmed) fail('Missing author. Usage: code-doctrine install <author> [opencode|pi|all] [...flags]');

  const npmSpec = `@${trimmed}${AUTHOR_PACKAGE_SUFFIX}`;
  if (npmViewExists(npmSpec)) {
    return {
      author: trimmed,
      source: 'npm',
      packageSpec: npmSpec,
      display: npmSpec,
      repository: `https://www.npmjs.com/package/${npmSpec}`,
    };
  }

  return {
    author: trimmed,
    source: 'github',
    packageSpec: `github:${trimmed}/code-doctrine`,
    display: `github:${trimmed}/code-doctrine`,
    repository: `https://github.com/${trimmed}/code-doctrine`,
  };
}

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

function fetchDoctrinePackage(spec) {
  const tempRoot = mkdtempSync(join(os.tmpdir(), 'code-doctrine-'));
  const pack = runCommand('npm', ['pack', spec, '--silent'], { cwd: tempRoot });
  if (pack.status !== 0) {
    const stderr = pack.stderr?.trim() || pack.stdout?.trim() || `npm pack failed for ${spec}`;
    rmSync(tempRoot, { recursive: true, force: true });
    fail(stderr);
  }

  const tarballName = pack.stdout.trim().split(/\r?\n/).filter(Boolean).pop();
  if (!tarballName) {
    rmSync(tempRoot, { recursive: true, force: true });
    fail(`Could not determine packed tarball for ${spec}`);
  }

  const extractDir = join(tempRoot, 'extract');
  ensureDir(extractDir);
  const tarballPath = join(tempRoot, tarballName);
  const unpack = runCommand('tar', ['-xzf', tarballPath, '-C', extractDir]);
  if (unpack.status !== 0) {
    const stderr = unpack.stderr?.trim() || unpack.stdout?.trim() || `Could not extract ${tarballPath}`;
    rmSync(tempRoot, { recursive: true, force: true });
    fail(stderr);
  }

  const packageRoot = join(extractDir, 'package');
  const doctrineManifestPath = join(packageRoot, 'doctrine.json');
  if (!existsSync(doctrineManifestPath)) {
    rmSync(tempRoot, { recursive: true, force: true });
    fail(`Doctrine package ${spec} is missing doctrine.json`);
  }

  const doctrine = parseJsonFile(doctrineManifestPath);
  const skillPath = doctrine.skillPath ? normalize(doctrine.skillPath) : '.';
  const skillRoot = resolve(packageRoot, skillPath);
  if (!skillRoot.startsWith(packageRoot) || !existsSync(skillRoot) || !statSync(skillRoot).isDirectory()) {
    rmSync(tempRoot, { recursive: true, force: true });
    fail(`Invalid skillPath in doctrine.json for ${spec}`);
  }

  if (!Array.isArray(doctrine.skillFiles) || doctrine.skillFiles.length === 0) {
    rmSync(tempRoot, { recursive: true, force: true });
    fail(`Doctrine package ${spec} must define a non-empty skillFiles array in doctrine.json`);
  }

  return { tempRoot, packageRoot, skillRoot, doctrine };
}

function buildManagedAgentsBlock(section, markers) {
  return `${markers.start}\n${section.trim()}\n${markers.end}\n`;
}

function upsertManagedAgentsSection(targetPath, section, markers) {
  const managedBlock = buildManagedAgentsBlock(section, markers);
  const current = existsSync(targetPath) ? readFileSync(targetPath, 'utf8') : '';
  const normalizedSection = section.trim();

  let nextContent = replaceMarkedBlock(current, markers.start, markers.end, managedBlock);

  if (nextContent === null && current.includes(normalizedSection)) {
    nextContent = current.replace(normalizedSection, managedBlock.trimEnd());
    if (!nextContent.endsWith('\n')) nextContent += '\n';
  }

  if (nextContent === null) {
    if (current.trim().length === 0) nextContent = managedBlock;
    else nextContent = `${managedBlock}\n${current.trimStart()}`;
  }

  if (nextContent === current) return 'unchanged';
  ensureDir(dirname(targetPath));
  writeFileSync(targetPath, nextContent, 'utf8');
  return current ? 'updated' : 'created';
}

function planDoctrineCopy(skillRoot, skillFiles, targetDir) {
  const results = { install: [], unchanged: [], conflicted: [] };
  for (const relPath of skillFiles) {
    const normalized = normalize(relPath);
    if (normalized.startsWith('..') || normalized.startsWith('/')) {
      fail(`Invalid skill file path in doctrine manifest: ${relPath}`);
    }
    const sourcePath = resolve(skillRoot, normalized);
    if (!sourcePath.startsWith(skillRoot) || !existsSync(sourcePath) || !statSync(sourcePath).isFile()) {
      fail(`Missing doctrine skill file: ${relPath}`);
    }
    const targetPath = join(targetDir, normalized);
    const nextContent = readFileSync(sourcePath, 'utf8');
    if (!existsSync(targetPath)) {
      results.install.push({ sourcePath, targetPath });
      continue;
    }
    const currentContent = readFileSync(targetPath, 'utf8');
    if (currentContent === nextContent) {
      results.unchanged.push(targetPath);
      continue;
    }
    results.conflicted.push({ sourcePath, targetPath });
  }
  return results;
}

function applyCopyPlan(results, force) {
  for (const entry of results.install) {
    ensureDir(dirname(entry.targetPath));
    writeFileSync(entry.targetPath, readFileSync(entry.sourcePath, 'utf8'), 'utf8');
  }
  if (!force) return;
  for (const entry of results.conflicted) {
    ensureDir(dirname(entry.targetPath));
    writeFileSync(entry.targetPath, readFileSync(entry.sourcePath, 'utf8'), 'utf8');
  }
}

function installDoctrineIntoTarget(targetRoot, doctrinePackage, force) {
  const doctrineName = doctrinePackage.doctrine.name || DEFAULT_SKILL_NAME;
  const markers = doctrinePackage.doctrine.managedAgentsMarkers ?? {
    start: `<!-- ${doctrineName}:managed:start -->`,
    end: `<!-- ${doctrineName}:managed:end -->`,
  };
  const targetSkillDir = join(targetRoot, 'skills', doctrineName);
  ensureDir(targetRoot);
  const plan = planDoctrineCopy(doctrinePackage.skillRoot, doctrinePackage.doctrine.skillFiles, targetSkillDir);

  if (plan.conflicted.length > 0 && !force) {
    const message = [
      `Conflicting files (${plan.conflicted.length}):`,
      ...plan.conflicted.map((entry) => `- ${entry.targetPath}`),
      '',
      'Re-run with --force to overwrite the conflicting managed files.',
    ].join('\n');
    fail(message);
  }

  applyCopyPlan(plan, force);
  const agentsSectionFile = doctrinePackage.doctrine.agentsSectionFile ?? 'AGENTS-section.md';
  const agentsSectionPath = resolve(doctrinePackage.skillRoot, normalize(agentsSectionFile));
  if (!agentsSectionPath.startsWith(doctrinePackage.skillRoot) || !existsSync(agentsSectionPath)) {
    fail(`Doctrine package is missing agents section file: ${agentsSectionFile}`);
  }
  const agentsStatus = upsertManagedAgentsSection(join(targetRoot, 'AGENTS.md'), readFileSync(agentsSectionPath, 'utf8'), markers);

  return {
    targetRoot,
    doctrineName,
    skillTargetDir: targetSkillDir,
    installedCount: plan.install.length + (force ? plan.conflicted.length : 0),
    unchangedCount: plan.unchanged.length,
    conflictCount: plan.conflicted.length,
    conflicts: plan.conflicted.map((entry) => entry.targetPath),
    agentsStatus,
  };
}

function installResolvedDoctrine(author, args) {
  const resolved = resolveDoctrine(author);
  const options = parseInstallTargetArgs(args);
  const doctrinePackage = fetchDoctrinePackage(resolved.packageSpec);

  try {
    console.log(`→ Resolved ${author} to ${resolved.display} (${resolved.source})`);
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
    rmSync(doctrinePackage.tempRoot, { recursive: true, force: true });
  }
}

function fetchDoctrineInfo(author) {
  const resolved = resolveDoctrine(author);
  const base = { resolved };

  if (resolved.source === 'npm') {
    const view = npmView(resolved.packageSpec, ['name', 'version', 'description', 'homepage', 'repository']);
    const doctrinePackage = fetchDoctrinePackage(resolved.packageSpec);
    try {
      return {
        ...base,
        package: view.json,
        doctrine: doctrinePackage.doctrine,
      };
    } finally {
      rmSync(doctrinePackage.tempRoot, { recursive: true, force: true });
    }
  }

  return {
    ...base,
    package: {
      name: null,
      version: null,
      description: null,
      homepage: resolved.repository,
      repository: { url: resolved.repository },
    },
    doctrine: null,
    note: 'Package not found on npm; using GitHub fallback convention.',
  };
}

function searchDoctrines(queryTerms) {
  const terms = queryTerms.length > 0 ? ['code-doctrine', ...queryTerms] : ['code-doctrine'];
  const search = npmSearch(terms);
  if (search.status !== 0 || !Array.isArray(search.json)) {
    fail(`npm search failed${search.stderr ? `: ${search.stderr.trim()}` : ''}`);
  }

  const results = search.json
    .filter((entry) => typeof entry?.name === 'string')
    .filter((entry) => entry.name === 'code-doctrine' || entry.name.endsWith('/code-doctrine'))
    .map((entry) => ({
      name: entry.name,
      version: entry.version,
      description: entry.description,
      date: entry.date,
      links: entry.links,
      maintainers: entry.maintainers,
    }));

  console.log(JSON.stringify(results, null, 2));
}

function doctor(author) {
  const npmVersion = runCommand('npm', ['--version']);
  const gitVersion = runCommand('git', ['--version']);
  const tarVersion = runCommand('tar', ['--version']);
  const registryCheck = npmView('npm', ['version']);
  const whoami = runCommand('npm', ['whoami']);

  const report = {
    node: process.version,
    npm: npmVersion.status === 0 ? npmVersion.stdout.trim() : null,
    git: gitVersion.status === 0 ? gitVersion.stdout.trim() : null,
    tar: tarVersion.status === 0 ? tarVersion.stdout.split(/\r?\n/)[0]?.trim() ?? null : null,
    registryReachable: registryCheck.status === 0,
    npmAuth: {
      loggedIn: whoami.status === 0,
      user: whoami.status === 0 ? whoami.stdout.trim() : null,
    },
    cwd: process.cwd(),
  };

  if (author) report.resolution = resolveDoctrine(author);
  console.log(JSON.stringify(report, null, 2));
}

function printResolution(author) {
  console.log(JSON.stringify(resolveDoctrine(author), null, 2));
}

function printSpec() {
  console.log([
    'code-doctrine package convention (v1)',
    '',
    '- Preferred npm package name: @<author>/code-doctrine',
    '- GitHub fallback: github:<author>/code-doctrine',
    '- Doctrine packages are plain doctrine packages, not installer CLIs',
    '- Required manifest file: doctrine.json',
    '- doctrine.json must define skillFiles and AGENTS marker ownership',
    '- Package should ship doctrine files at the manifest-declared skillPath',
    '- Optional extra npm metadata may exist, but the client should rely on doctrine.json',
    '',
    'See README.md and STANDARD.md for details.',
  ].join('\n'));
}

function printHelp() {
  console.log([
    'code-doctrine',
    '',
    'CLI package manager for decentralized code doctrine packages.',
    '',
    'Usage:',
    '  code-doctrine install <author> [opencode|pi|all] [...flags]',
    '  code-doctrine resolve <author>',
    '  code-doctrine info <author>',
    '  code-doctrine search [query]',
    '  code-doctrine doctor [author]',
    '  code-doctrine spec',
    '  code-doctrine --help',
    '',
    'Examples:',
    '  code-doctrine install kamilchm opencode --project',
    '  code-doctrine install kamilchm all --global',
    '  code-doctrine resolve kamilchm',
    '  code-doctrine info kamilchm',
    '  code-doctrine search',
    '  code-doctrine doctor kamilchm',
    '',
    'Resolution strategy (v1):',
    '  1. Try npm package @<author>/code-doctrine',
    '  2. Fall back to github:<author>/code-doctrine',
  ].join('\n'));
}

const args = process.argv.slice(2);
if (args.length === 0 || args.includes('--help') || args.includes('-h') || args[0] === 'help') {
  printHelp();
  process.exit(0);
}

const command = args.shift();
if (command === 'install') {
  const author = args.shift();
  installResolvedDoctrine(author ?? '', args);
  process.exit(0);
}
if (command === 'resolve') {
  const author = args.shift();
  if (!author) fail('Missing author. Usage: code-doctrine resolve <author>');
  printResolution(author);
  process.exit(0);
}
if (command === 'info') {
  const author = args.shift();
  if (!author) fail('Missing author. Usage: code-doctrine info <author>');
  console.log(JSON.stringify(fetchDoctrineInfo(author), null, 2));
  process.exit(0);
}
if (command === 'search') {
  searchDoctrines(args);
  process.exit(0);
}
if (command === 'doctor') {
  doctor(args[0]);
  process.exit(0);
}
if (command === 'spec') {
  printSpec();
  process.exit(0);
}

fail(`Unknown command: ${command}`);
