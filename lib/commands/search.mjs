import { npmSearch } from '../doctrine-package.mjs';
import { fail } from '../utils.mjs';

export function runSearch(args) {
  const terms = args.length > 0 ? ['code-doctrine', ...args] : ['code-doctrine'];
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
