import { existsSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import os from 'node:os';
import { dirname, join, normalize, resolve } from 'node:path';
import { ensureDir, fail, parseJsonFile, runCommand } from './utils.mjs';

const AUTHOR_PACKAGE_SUFFIX = '/code-doctrine';

function isExplicitLocalRef(value) {
  return value.startsWith('./')
    || value.startsWith('../')
    || value.startsWith('/')
    || value.startsWith('~/')
    || value.startsWith('file:');
}

function resolveLocalRef(rawPath) {
  if (rawPath.startsWith('file:')) {
    const url = new URL(rawPath);
    if (url.protocol !== 'file:') fail(`Unsupported local doctrine URL: ${rawPath}`);
    return resolve(url.pathname);
  }

  if (rawPath.startsWith('~/')) return resolve(join(os.homedir(), rawPath.slice(2)));
  return resolve(rawPath);
}

export function npmViewExists(spec) {
  const result = runCommand('npm', ['view', spec, 'name', '--json']);
  return result.status === 0;
}

export function npmView(spec, fields) {
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

export function npmSearch(terms) {
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

function createDoctrinePackage(packageRoot, tempRoot = null) {
  const doctrineManifestPath = join(packageRoot, 'doctrine.json');
  if (!existsSync(doctrineManifestPath)) {
    if (tempRoot) rmSync(tempRoot, { recursive: true, force: true });
    fail(`Doctrine package ${packageRoot} is missing doctrine.json`);
  }

  const doctrine = parseJsonFile(doctrineManifestPath);
  const skillPath = doctrine.skillPath ? normalize(doctrine.skillPath) : '.';
  const skillRoot = resolve(packageRoot, skillPath);
  if (!skillRoot.startsWith(packageRoot) || !existsSync(skillRoot) || !statSync(skillRoot).isDirectory()) {
    if (tempRoot) rmSync(tempRoot, { recursive: true, force: true });
    fail(`Invalid skillPath in doctrine.json for ${packageRoot}`);
  }

  if (doctrine.skillFiles !== undefined) {
    if (!Array.isArray(doctrine.skillFiles) || doctrine.skillFiles.length === 0) {
      if (tempRoot) rmSync(tempRoot, { recursive: true, force: true });
      fail(`If defined, doctrine package ${packageRoot} must use a non-empty skillFiles array in doctrine.json`);
    }
  }

  return { tempRoot, packageRoot, skillRoot, doctrine };
}

export function resolveDoctrineReference(reference) {
  const trimmed = reference.trim();
  if (!trimmed) fail('Missing doctrine reference. Usage: code-doctrine install <author|path> [opencode|pi|all] [...flags]');

  if (isExplicitLocalRef(trimmed)) {
    const localPath = resolveLocalRef(trimmed);
    const packageRoot = localPath.endsWith('.json') ? dirname(localPath) : localPath;
    if (!existsSync(packageRoot) || !statSync(packageRoot).isDirectory()) {
      fail(`Local doctrine path does not exist or is not a directory: ${trimmed}`);
    }

    return {
      author: null,
      source: 'local',
      packageSpec: packageRoot,
      display: packageRoot,
      repository: null,
    };
  }

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

  return createDoctrinePackage(join(extractDir, 'package'), tempRoot);
}

function loadLocalDoctrinePackage(packageRoot) {
  return createDoctrinePackage(resolve(packageRoot));
}

export function materializeDoctrinePackage(resolved) {
  if (resolved.source === 'local') return loadLocalDoctrinePackage(resolved.packageSpec);
  return fetchDoctrinePackage(resolved.packageSpec);
}

export function cleanupDoctrinePackage(doctrinePackage) {
  if (doctrinePackage.tempRoot) rmSync(doctrinePackage.tempRoot, { recursive: true, force: true });
}

export function fetchDoctrineInfo(reference) {
  const resolved = resolveDoctrineReference(reference);
  const base = { resolved };

  if (resolved.source === 'local') {
    const doctrinePackage = materializeDoctrinePackage(resolved);
    try {
      const packageJsonPath = join(doctrinePackage.packageRoot, 'package.json');
      return {
        ...base,
        package: existsSync(packageJsonPath)
          ? parseJsonFile(packageJsonPath)
          : {
              name: null,
              version: null,
              description: null,
              homepage: null,
              repository: null,
            },
        doctrine: doctrinePackage.doctrine,
      };
    } finally {
      cleanupDoctrinePackage(doctrinePackage);
    }
  }

  if (resolved.source === 'npm') {
    const view = npmView(resolved.packageSpec, ['name', 'version', 'description', 'homepage', 'repository']);
    const doctrinePackage = materializeDoctrinePackage(resolved);
    try {
      return {
        ...base,
        package: view.json,
        doctrine: doctrinePackage.doctrine,
      };
    } finally {
      cleanupDoctrinePackage(doctrinePackage);
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
