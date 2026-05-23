export function runSpec() {
  console.log([
    'code-doctrine package convention (v1)',
    '',
    '- Preferred npm package name: @<author>/code-doctrine',
    '- GitHub fallback: github:<author>/code-doctrine',
    '- Local development install source: ./path-to-your-doctrine or /absolute/path',
    '- Doctrine packages are plain doctrine packages, not installer CLIs',
    '- Required manifest file: doctrine.json',
    '- doctrine.json must define skillFiles and AGENTS marker ownership',
    '- Package should ship doctrine files at the manifest-declared skillPath',
    '- Optional extra npm metadata may exist, but the client should rely on doctrine.json',
    '',
    'See README.md and STANDARD.md for details.',
  ].join('\n'));
}
