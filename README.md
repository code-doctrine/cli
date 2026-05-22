# code-doctrine

CLI package manager for decentralized code doctrine packages.

## What this package is

This unscoped package acts as:

- a generic npm entrypoint for the code-doctrine ecosystem
- the first public convention for resolving and installing developer-published doctrine packages
- a thin client for decentralized doctrine packages published by individual developers

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

So for `kamilchm`, the manager tries:

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
- `info` prints the resolved package plus available npm metadata
- `search` lists npm packages that match the public `code-doctrine` naming convention
- `doctor` checks the local environment and optionally shows author resolution
- `spec` prints the v1 doctrine package convention summary

## Standard

The package convention for developer-published doctrines is documented in:

- `STANDARD.md`

In short, a developer package should:

- expose a `code-doctrine` executable
- support `install opencode|pi|all`
- ship doctrine skill content in a stable layout
- own its AGENTS markers and installer behavior

## Current recommended package

For Kamil Chmielewski's implementation, the concrete doctrine package is:

- `@kamilchm/code-doctrine`

Direct usage still works too:

```bash
npx @kamilchm/code-doctrine install opencode --project
```

## Website and portal note

The public website and portal are separate from this CLI. This repository is only the package manager and standard client.

## Publishing

This repo includes a GitHub Actions publish workflow in `.github/workflows/publish.yml`.
Provide an `NPM_TOKEN` repository secret, then publish via GitHub release or manual workflow dispatch.

## License

MIT
