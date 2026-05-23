import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';

export function runCommand(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    stdio: options.stdio ?? ['ignore', 'pipe', 'pipe'],
    env: options.env ?? process.env,
  });
}

export function ensureDir(dir) {
  mkdirSync(dir, { recursive: true });
}

export function fail(message, exitCode = 1) {
  console.error(`❌ ${message}`);
  process.exit(exitCode);
}

export function parseJsonFile(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function replaceMarkedBlock(content, startMarker, endMarker, replacement) {
  if (!content.includes(startMarker) || !content.includes(endMarker)) return null;
  const pattern = new RegExp(`${escapeRegExp(startMarker)}[\\s\\S]*?${escapeRegExp(endMarker)}\\n?`, 'm');
  return content.replace(pattern, replacement);
}
