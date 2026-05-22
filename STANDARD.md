# Code Doctrine Package Standard (v1)

This document defines the first public convention for developer-published code doctrine packages.

## Goal

Make this work:

```bash
code-doctrine install kamilchm opencode --project
```

The unscoped `code-doctrine` CLI resolves the developer doctrine package, fetches it, reads its doctrine manifest, and installs it into the chosen harness.

## Resolution convention

For author id `<author>`, the client resolves in this order:

1. npm package: `@<author>/code-doctrine`
2. GitHub fallback: `github:<author>/code-doctrine`

Examples:

- `kamilchm` -> `@kamilchm/code-doctrine`
- if not published on npm yet -> `github:kamilchm/code-doctrine`

## Core model

A developer doctrine repo should be a **plain doctrine package**.

That means:

- doctrine content
- a doctrine manifest
- package metadata for publishing

It should **not** contain harness-specific installer logic.
The shared `code-doctrine` CLI owns installation into OpenCode, Pi, and other future harnesses.

## Required files

A doctrine package must include:

- `doctrine.json`
- doctrine content files referenced by the manifest
- `package.json`

## Required manifest

The required manifest is `doctrine.json`.

Recommended shape:

```json
{
  "specVersion": 1,
  "name": "code-doctrine",
  "title": "Code Doctrine",
  "author": "kamilchm",
  "description": "Short doctrine description",
  "skillPath": ".",
  "skillFiles": [
    "SKILL.md",
    "AGENTS-section.md",
    "coding-foundations-reference.md",
    "database-reference.md",
    "system-architecture-reference.md",
    "operability-reference.md",
    "documentation-reference.md",
    "user-interface-reference.md",
    "change-safety-reference.md",
    "testing-reference.md",
    "enforcement-reference.md"
  ],
  "agentsSectionFile": "AGENTS-section.md",
  "managedAgentsMarkers": {
    "start": "<!-- code-doctrine:managed:start -->",
    "end": "<!-- code-doctrine:managed:end -->"
  }
}
```

## Meaning of manifest fields

- `specVersion` — manifest schema version
- `name` — doctrine skill name that becomes the installed skill directory name
- `title` — human title
- `author` — developer or publisher id
- `description` — short description
- `skillPath` — relative path from package root to the doctrine files root
- `skillFiles` — exact doctrine files to install into the target harness
- `agentsSectionFile` — file that contains the managed AGENTS block body
- `managedAgentsMarkers` — doctrine-owned markers used when merging AGENTS content

## Recommended package layout

The simplest recommended layout is a repo-root doctrine package:

```text
SKILL.md
AGENTS-section.md
coding-foundations-reference.md
database-reference.md
system-architecture-reference.md
operability-reference.md
documentation-reference.md
user-interface-reference.md
change-safety-reference.md
testing-reference.md
enforcement-reference.md
doctrine.json
package.json
README.md
```

## Stability rules

- `code-doctrine` is the stable shared client executable name
- `install <author>` is the stable shared client entrypoint
- doctrine packages are plain content packages, not installer CLIs
- `doctrine.json` is the public manifest contract in v1
- doctrine-specific AGENTS markers must be owned by the doctrine package itself
- a doctrine package should not depend on private predecessor names or migration history in its public standard surface

## Scope of v1

v1 intentionally avoids:

- a central registry service
- signed metadata
- compatibility scoring
- doctrine discovery APIs beyond npm search and naming conventions
- package verification beyond npm/GitHub resolution plus doctrine manifest validation

Those can be added later if the ecosystem grows.
