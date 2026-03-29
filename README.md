# Health ingest — Dev Herald GitHub Action

Upload [Knip](https://knip.dev) JSON to the Dev Herald health ingest API (`POST /api/v1/health/ingest`). Generate the report with `pnpm exec knip --reporter json --no-exit-code > results.json` (use `--no-exit-code` so the workflow can still upload when Knip reports issues).

The compiled bundle lives in `build/` and is **committed** so consumers can use tagged versions without building locally.

## Usage

Create a [project API key](https://dev-herald.com) and store it as a secret (for example `DEV_HERALD_KEY`).

Pin workflows with **`uses: dev-herald/health@v1`** (major-line tag), not semver patch tags like `@v0.1.0`.

### Run Knip and upload

```yaml
- name: Run Knip
  run: pnpm exec knip --reporter json --no-exit-code > results.json

- name: Upload to Dev Herald
  uses: dev-herald/health@v1
  with:
    api-key: ${{ secrets.DEV_HERALD_KEY }}
    knip-report-path: results.json
    workflow-run-url: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}
```

In a monorepo, pass `--workspace <path>` for each package you want included (before `--reporter json`), for example: `pnpm exec knip --workspace apps/web --workspace packages/ui --reporter json --no-exit-code > results.json`.

### Multiple report files

Use **exactly one** of `knip-report-path` or `knip-report-paths` (not both). For several JSON files, use one path per line (optional `-` list prefix is stripped):

```yaml
- uses: dev-herald/health@v1
  with:
    api-key: ${{ secrets.DEV_HERALD_KEY }}
    knip-report-paths: |
      apps/web/knip.json
      packages/ui/knip.json
```

`repository-full-name` and `commit-sha` default from `github.context` when omitted.

## Development

```bash
pnpm install
pnpm test
pnpm run package   # typecheck + ncc → build/
```

## Inputs

| Input | Description |
| ----- | ----------- |
| `api-key` | Required. Bearer token (project API key). |
| `knip-report-path` | Single Knip JSON file. |
| `knip-report-paths` | Newline-separated paths; reports are merged before upload. |
| `api-url` | Default `https://dev-herald.com/api/v1/health/ingest`. |
| `repository-full-name` | Optional `owner/repo`. |
| `commit-sha` | Optional commit SHA. |
| `workflow-run-url` | Optional link to the workflow run. |

## Outputs

| Output | Description |
| ------ | ----------- |
| `report-id` | Ingested health report id when successful. |
| `status` | `created` or `failed`. |
