# Cookbook

## Knip integration

Store your Dev Herald API key as a repo secret (for example `DEV_HERALD_KEY`), then in your workflow:

```yaml
      - name: Run Knip (JSON report)
        run: pnpm exec knip --reporter json --no-exit-code > knip-results.json

      - name: Upload health data to Dev Herald
        uses: dev-herald/health@v1
        with:
          api-key: ${{ secrets.DEV_HERALD_KEY }}
          knip-report-path: knip-results.json
          workflow-run-url: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}
```

## CVE / OSV (lockfile)

No extra CLI step is required: checkout your repo (with the lockfile) and run the action. It queries [OSV](https://osv.dev/) in batches over **npm** ecosystem packages resolved in the lockfile.

```yaml
      - uses: actions/checkout@v4

      - name: Upload health data to Dev Herald
        uses: dev-herald/health@v1
        with:
          api-key: ${{ secrets.DEV_HERALD_KEY }}
          cve-detail: 'false'
          workflow-run-url: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}
```

The lockfile must live at the **repository root** (`pnpm-lock.yaml` or `package-lock.json`).

See [README.md](README.md) for all inputs and outputs.
