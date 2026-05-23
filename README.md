# code-doctrine

CLI package manager for decentralized code doctrine packages.

## What this package is

This unscoped package acts as:

- a generic npm entrypoint for the code-doctrine ecosystem
- the shared installer client for doctrine packages
- the first public convention for resolving and installing developer-published doctrine packages

Developer doctrine repos are expected to be **plain doctrine packages**.
The shared CLI fetches them and performs the actual OpenCode or Pi installation.

## Quick start

Install Kamil Chmielewski's doctrine package into an OpenCode project:

```bash
npx code-doctrine install kamilchm opencode --project
```

Install it globally for OpenCode instead:

```bash
npx code-doctrine install kamilchm opencode --global
```

Install it for Pi:

```bash
npx code-doctrine install kamilchm pi
```

## Resolution strategy

For `code-doctrine install <author> ...`, v1 resolves in this order:

1. npm package `@<author>/code-doctrine`
2. GitHub fallback `github:<author>/code-doctrine`

So for `kamilchm`, the client tries:

- `@kamilchm/code-doctrine`
- then `github:kamilchm/code-doctrine`

## Other commands

```bash
npx code-doctrine resolve kamilchm
npx code-doctrine info kamilchm
npx code-doctrine search
npx code-doctrine doctor kamilchm
npx code-doctrine spec
```

- `resolve` shows the resolved source for a developer id
- `info` prints the resolved package plus available doctrine metadata
- `search` lists npm packages that match the public `code-doctrine` naming convention
- `doctor` checks the local environment and optionally shows author resolution
- `spec` prints the v1 doctrine package convention summary

## Plain doctrine packages

A developer package should contain:

- doctrine content
- `doctrine.json`
- npm package metadata for publish

It should not contain harness-specific installer logic.
That responsibility belongs to this CLI.

## Standard

The package convention for developer-published doctrines is documented in:

- `STANDARD.md`

## Current recommended package

For Kamil Chmielewski's implementation, the doctrine package is:

- `@kamilchm/code-doctrine`

## Website and portal note

The public website and portal are separate from this CLI. This repository is only the package manager and standard client.

## Publishing

This repo includes a GitHub Actions publish workflow in `.github/workflows/publish.yml`.
It is configured for npm trusted publishing via GitHub OIDC, so no `NPM_TOKEN` secret is required.
Publish via GitHub release or manual workflow dispatch.

## License

MIT
