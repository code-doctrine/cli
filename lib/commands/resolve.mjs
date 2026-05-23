import { resolveDoctrineReference } from '../doctrine-package.mjs';
import { fail } from '../utils.mjs';

export function runResolve(args) {
  const reference = args.shift();
  if (!reference) fail('Missing doctrine reference. Usage: code-doctrine resolve <author|path>');
  console.log(JSON.stringify(resolveDoctrineReference(reference), null, 2));
}
