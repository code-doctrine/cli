#!/usr/bin/env node
import { runDoctor } from './lib/commands/doctor.mjs';
import { runFork } from './lib/commands/fork.mjs';
import { runInfo } from './lib/commands/info.mjs';
import { runInstall } from './lib/commands/install.mjs';
import { runResolve } from './lib/commands/resolve.mjs';
import { runSearch } from './lib/commands/search.mjs';
import { runSpec } from './lib/commands/spec.mjs';
import { printHelp } from './lib/help.mjs';
import { fail } from './lib/utils.mjs';

const args = process.argv.slice(2);
if (args.length === 0 || args.includes('--help') || args.includes('-h') || args[0] === 'help') {
  printHelp();
  process.exit(0);
}

const command = args.shift();
if (command === 'install') {
  runInstall(args);
  process.exit(0);
}
if (command === 'resolve') {
  runResolve(args);
  process.exit(0);
}
if (command === 'info') {
  runInfo(args);
  process.exit(0);
}
if (command === 'fork') {
  runFork(args);
  process.exit(0);
}
if (command === 'search') {
  runSearch(args);
  process.exit(0);
}
if (command === 'doctor') {
  runDoctor(args);
  process.exit(0);
}
if (command === 'spec') {
  runSpec();
  process.exit(0);
}

fail(`Unknown command: ${command}`);
