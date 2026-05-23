import { fetchDoctrineInfo } from '../doctrine-package.mjs';
import { fail } from '../utils.mjs';

export function runInfo(args) {
  const reference = args.shift();
  if (!reference) fail('Missing doctrine reference. Usage: code-doctrine info <author|path>');
  console.log(JSON.stringify(fetchDoctrineInfo(reference), null, 2));
}
