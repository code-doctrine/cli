# Code Doctrine Package Standard (v1)

This document defines the first public convention for developer-published code doctrine packages.

## Goal

Make this work:

```bash
code-doctrine install kamilchm opencode --project
```

The unscoped `code-doctrine` CLI resolves the developer doctrine package and delegates installation to it.

## Resolution convention

For author id `<author>`, the manager resolves in this order:

1. npm package: `@<author>/code-doctrine`
2. GitHub fallback: `github:<author>/code-doctrine`

Examples:

- `kamilchm` -> `@kamilchm/code-doctrine`
- if not published on npm yet -> `github:kamilchm/code-doctrine`

## Required package behavior

A doctrine package should:

- expose a `code-doctrine` executable
- support:
  - `code-doctrine install opencode ...`
  - `code-doctrine install pi ...`
  - `code-doctrine install all ...`
- ship its doctrine skill content in a stable package layout
- manage any AGENTS integration with doctrine-owned markers, not client-owned markers

## Recommended package layout

```text
skills/
  code-doctrine/
    SKILL.md
    AGENTS-section.md
    ...reference docs...
install.mjs
package.json
README.md
```

## Recommended package metadata

Doctrine packages may expose metadata through `package.json` under a `codeDoctrine` key.

Recommended shape:

```json
{
  "codeDoctrine": {
    "specVersion": 1,
    "author": "kamilchm",
    "skillName": "code-doctrine",
    "managedAgentsMarkers": {
      "start": "<!-- code-doctrine:managed:start -->",
      "end": "<!-- code-doctrine:managed:end -->"
    },
    "installTargets": ["opencode", "pi", "all"]
  }
}
```

This metadata is optional in v1, but recommended.

## Stability rules

- `code-doctrine` is the stable executable name
- `install <author>` is the stable manager entrypoint
- doctrine-specific AGENTS markers must be owned by the doctrine package itself
- a package should not depend on private predecessor names or migration history in its public standard surface

## Scope of v1

v1 intentionally avoids:

- a central registry service
- signed metadata
- compatibility scoring
- doctrine discovery APIs
- package verification beyond npm/GitHub resolution conventions

Those can be added later if the ecosystem grows.
