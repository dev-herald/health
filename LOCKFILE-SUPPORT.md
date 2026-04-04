# Lockfile support (dependency extraction)

This document describes which **pnpm** and **npm** lockfiles we can **parse into `{ name, version, isDev }[]`** for CVE scanning. We do **not** read the CLI version you used (`pnpm --version` / `npm --version`); we match **file shapes**.

## pnpm (`pnpm-lock.yaml`)

| Category | Supported | Notes |
|----------|-----------|--------|
| **pnpm 9.x** | Yes | `lockfileVersion: '9.0'` (or `'6.0'`) with `importers:` + `packages:`. |
| **pnpm 10.x** | Yes | Ships with the **same** `lockfileVersion: '9.0'` YAML layout as pnpm 9 (no new lockfile major in the file). Hashing/metadata may differ; parsing is unchanged. |
| **pnpm 8.x** | Yes (typical) | Same overall `importers` / `packages` structure as above. |
| **Older pnpm** (pre–`importers` layout) | **No** | Not implemented. |
| **Monorepo / multiple importers** (e.g. `.`, `apps/web`) | Yes | All `dependencies:` / `devDependencies:` blocks under `importers:` are scanned. |
| **Workspace / `link:` resolutions** | Parsed | Version strings like `link:../../packages/foo` are still extracted; **OSV** may not treat them as registry versions. |

**We do not** validate `lockfileVersion` in code. Unsupported files usually fail with missing/empty `packages` keys or importer parsing producing no prod/dev map.

## npm (`package-lock.json`)

| Category | Supported | Notes |
|----------|-----------|--------|
| **lockfileVersion 2 / 3** (`packages` map) | Yes | Includes **npm workspaces**: keys such as `packages/my-app/node_modules/dep`. |
| **lockfileVersion 1** (nested `dependencies` tree) | Yes | Legacy tree; `dev` flag respected when present. |
| **Monorepo / workspaces** | Yes (v2/v3) | Any `packages` entry whose key ends with `/node_modules/<name>` contributes `<name>@<version>` with optional `dev: true`. |
| **Workspace-only keys** (`packages/foo` without `node_modules`) | Skipped | Those entries are usually the local package root, not a registry tarball; we only extract **installed dependency** paths. |

**We do not** support `yarn.lock` or `bun.lock` (see git history / product scope).

## Quick reference

| Tool | Lockfile | Supported for extraction |
|------|----------|---------------------------|
| pnpm 8–10 | `pnpm-lock.yaml` at repo root | Yes (when layout matches above) |
| npm 7+ (incl. workspaces) | `package-lock.json` at repo root | Yes (v1 tree or v2/v3 `packages`) |
| Yarn / Bun | — | No |
