#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const AUTHOR_PACKAGE_SUFFIX = '/code-doctrine';
const EXECUTABLE_NAME = 'code-doctrine';

function runCommand(command, args, options = {}) {
  return spawnSync(command, args, {
    encoding: 'utf8',
    stdio: options.stdio ?? ['ignore', 'pipe', 'pipe'],
    env: options.env ?? process.env,
  });
}

function fail(message, exitCode = 1) {
  console.error(`❌ ${message}`);
  process.exit(exitCode);
}

function parseJson(text) {
  if (!text || !text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function npmViewExists(spec) {
  const result = runCommand('npm', ['view', spec, 'name', '--json']);
  return result.status === 0;
}

function npmView(spec, fields) {
  const result = runCommand('npm', ['view', spec, ...fields, '--json']);
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    json: parseJson(result.stdout),
  };
}

function npmSearch(terms) {
  const result = runCommand('npm', ['search', ...terms, '--json']);
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    json: parseJson(result.stdout),
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

function fetchDoctrineInfo(author) {
  const resolved = resolveDoctrine(author);
  if (resolved.source === 'npm') {
    const view = npmView(resolved.packageSpec, ['name', 'version', 'description', 'homepage', 'repository', 'codeDoctrine']);
    return {
      resolved,
      package: view.json,
    };
  }

  return {
    resolved,
    package: {
      name: null,
      version: null,
      description: null,
      homepage: resolved.repository,
      repository: { url: resolved.repository },
      codeDoctrine: null,
    },
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
  const registryCheck = npmView('npm', ['version']);
  const whoami = runCommand('npm', ['whoami']);

  const report = {
    node: process.version,
    npm: npmVersion.status === 0 ? npmVersion.stdout.trim() : null,
    git: gitVersion.status === 0 ? gitVersion.stdout.trim() : null,
    registryReachable: registryCheck.status === 0,
    npmAuth: {
      loggedIn: whoami.status === 0,
      user: whoami.status === 0 ? whoami.stdout.trim() : null,
    },
    cwd: process.cwd(),
  };

  if (author) {
    report.resolution = resolveDoctrine(author);
  }

  console.log(JSON.stringify(report, null, 2));
}

function runDoctrineInstall(author, args) {
  const resolved = resolveDoctrine(author);
  const forwarded = args.length > 0 ? args : ['all'];
  const commandArgs = [
    'exec',
    '--yes',
    `--package=${resolved.packageSpec}`,
    '--',
    EXECUTABLE_NAME,
    'install',
    ...forwarded,
  ];

  console.log(`→ Resolved ${author} to ${resolved.display} (${resolved.source})`);
  const result = runCommand('npm', commandArgs, {
    stdio: 'inherit',
  });

  if (typeof result.status === 'number') process.exit(result.status);
  fail(`Failed to execute installer for ${resolved.display}`);
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
    '- Package must expose a `code-doctrine` executable',
    '- Executable should support: `code-doctrine install opencode|pi|all ...`',
    '- Package should ship the doctrine skill under `skills/code-doctrine/`',
    '- Package should manage its AGENTS block with stable doctrine-owned markers',
    '- Optional metadata can be exposed through package.json under a `codeDoctrine` key',
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
  runDoctrineInstall(author ?? '', args);
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
