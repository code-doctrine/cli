import { npmView, resolveDoctrineReference } from '../doctrine-package.mjs';
import { runCommand } from '../utils.mjs';

export function runDoctor(args) {
  const reference = args[0];
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

  if (reference) report.resolution = resolveDoctrineReference(reference);
  console.log(JSON.stringify(report, null, 2));
}
