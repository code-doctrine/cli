import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, normalize, relative, resolve } from 'node:path';
import { ensureDir, fail, replaceMarkedBlock } from './utils.mjs';

const DEFAULT_SKILL_NAME = 'code-doctrine';

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

function collectSkillFiles(skillRoot, skillFiles) {
  if (Array.isArray(skillFiles) && skillFiles.length > 0) {
    return skillFiles.map((relPath) => {
      const normalized = normalize(relPath);
      if (normalized.startsWith('..') || normalized.startsWith('/')) {
        fail(`Invalid skill file path in doctrine manifest: ${relPath}`);
      }
      const sourcePath = resolve(skillRoot, normalized);
      if (!sourcePath.startsWith(skillRoot) || !existsSync(sourcePath) || !statSync(sourcePath).isFile()) {
        fail(`Missing doctrine skill file: ${relPath}`);
      }
      return { normalized, sourcePath };
    });
  }

  const files = [];
  const stack = ['.'];
  while (stack.length > 0) {
    const currentRel = stack.pop();
    const currentPath = resolve(skillRoot, currentRel);
    const entries = readdirSync(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const relPath = currentRel === '.' ? entry.name : join(currentRel, entry.name);
      const sourcePath = resolve(skillRoot, relPath);
      if (!sourcePath.startsWith(skillRoot)) fail(`Invalid skill file path in skill directory: ${relPath}`);
      if (entry.isDirectory()) {
        stack.push(relPath);
        continue;
      }
      if (entry.isFile()) files.push({ normalized: normalize(relPath), sourcePath });
    }
  }

  if (files.length === 0) fail(`No doctrine files found under skillPath: ${skillRoot}`);
  files.sort((a, b) => a.normalized.localeCompare(b.normalized));
  return files;
}

function planDoctrineCopy(skillRoot, skillFiles, targetDir) {
  const results = { install: [], unchanged: [], conflicted: [] };
  for (const entry of collectSkillFiles(skillRoot, skillFiles)) {
    const targetPath = join(targetDir, entry.normalized);
    const nextContent = readFileSync(entry.sourcePath, 'utf8');
    if (!existsSync(targetPath)) {
      results.install.push({ sourcePath: entry.sourcePath, targetPath });
      continue;
    }
    const currentContent = readFileSync(targetPath, 'utf8');
    if (currentContent === nextContent) {
      results.unchanged.push(targetPath);
      continue;
    }
    results.conflicted.push({ sourcePath: entry.sourcePath, targetPath });
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

export function installDoctrineIntoTarget(targetRoot, doctrinePackage, force) {
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
  const normalizedAgentsSection = normalize(agentsSectionFile);
  if (normalizedAgentsSection.startsWith('..') || normalizedAgentsSection.startsWith('/')) {
    fail(`Invalid agentsSectionFile in doctrine manifest: ${agentsSectionFile}`);
  }
  const agentsSectionPath = resolve(doctrinePackage.skillRoot, normalizedAgentsSection);
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
    installedFiles: [...plan.install, ...(force ? plan.conflicted : [])].map((entry) => relative(targetSkillDir, entry.targetPath)),
    agentsStatus,
  };
}
