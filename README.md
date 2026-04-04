# Health reports - Dev Herald GitHub Action

Turn your CI signals into **weekly health reports** for your codebase.

Dev Herald ingests structured data from your workflows (unused code, dependencies, bundle size changes, etc.) and turns it into **clear, trackable insights** - no dashboards to wire up, no scripts to maintain.

---

## Why this exists

CI already knows a lot about your codebase - it just doesn’t communicate it well.

[Dev Herald](https://dev-herald.com) helps you:

- Track **unused code & dependencies**
- Monitor **bundle size changes over time**
- Surface **dependency risks (CVEs)**
- Build a **history of codebase health**, not just point-in-time logs

All from the workflows you already run.

---

## Usage

Create a project API key from [Dev Herald](https://dev-herald.com) and store it as a secret:

```yaml
DEV_HERALD_KEY=your-api-key
```

Then upload any health data from your CI.

Example - Upload a report

```yaml
- name: Upload health data
  uses: dev-herald/health@v1
  with:
    api-key: ${{ secrets.DEV_HERALD_KEY }}
    knip-report-path: results.json
    workflow-run-url: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}
```

The action **auto-detects a lockfile** at the **repository root** (preferring `pnpm-lock.yaml`, then `package-lock.json`). That matches typical monorepos: one lockfile for the whole workspace. It sends **CVE totals** (production vs development dependencies) to Dev Herald using the public **[OSV](https://osv.dev/)** API (`api.osv.dev`).

Set `cve-detail: 'true'` to request a **severity breakdown** (critical / high / moderate / low / unknown); this fetches each vulnerability record from OSV and is slower.

`knip-report-path` is optional if a supported lockfile is present; you can combine Knip + CVEs or either alone.

Example - Generating data (Knip)

You can use tools like Knip to generate signals:

```yml
- name: Run Knip
  run: pnpm exec knip --reporter json --no-exit-code > results.json
```


Then upload the result using the action above.

This action already combines **Knip** (optional) and **CVE / OSV** (optional, when a lockfile exists).

Which lockfile layouts are parsed for dependency extraction (pnpm 9–10, npm workspaces, etc.) is documented in [LOCKFILE-SUPPORT.md](LOCKFILE-SUPPORT.md).

---

### Inputs

| Input | Description |
| ----- | ----------- |
| `api-key` | Required. Project API key |
| `knip-report-path` | Path to Knip JSON report (optional if `pnpm-lock.yaml` or `package-lock.json` exists at repo root) |
| `cve-detail` | `true` to add OSV severity buckets (default: `false`, totals only) |
| `api-url` | Defaults to Dev Herald ingest API |
| `repository-full-name` | Optional override |
| `commit-sha` | Optional override |
| `workflow-run-url` | Link to CI run |

### Outputs

| Output | Description |
| ------ | ----------- |
| `report-id` | Dev Herald health report id |
| `status` | created or failed |
