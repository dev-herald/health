# Cookbook

## Knip

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

## CVE only (lockfile)

```yaml
      - uses: actions/checkout@v4

      - name: Upload health data to Dev Herald
        uses: dev-herald/health@v1
        with:
          api-key: ${{ secrets.DEV_HERALD_KEY }}
          lockfile-path: ${{ github.workspace }}/package-lock.json
          cve-detail: 'false'
          workflow-run-url: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}
```

## Next.js bundle — Turbopack (`experimental-analyze`)

```yaml
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: corepack enable pnpm && pnpm install --frozen-lockfile
        working-directory: apps/web

      - name: Production build
        run: pnpm exec next build
        working-directory: apps/web

      - name: Write bundle analyze output
        run: pnpm exec next experimental-analyze --output
        working-directory: apps/web

      - name: Upload health data to Dev Herald
        uses: dev-herald/health@v1
        with:
          api-key: ${{ secrets.DEV_HERALD_KEY }}
          turbopack-bundle-stats-path: apps/web/.next/diagnostics/analyze
          workflow-run-url: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}
```

## Next.js bundle — Webpack (`@next/bundle-analyzer`, JSON reports)

```yaml
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: corepack enable pnpm && pnpm install --frozen-lockfile
        working-directory: apps/web

      - name: Production build (Webpack + analyzer JSON)
        run: ANALYZE=true pnpm exec next build --webpack
        working-directory: apps/web

      - name: Upload health data to Dev Herald
        uses: dev-herald/health@v1
        with:
          api-key: ${{ secrets.DEV_HERALD_KEY }}
          turbopack-bundle-stats-path: apps/web/.next/analyze
          workflow-run-url: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}
```

`next.config` must enable `@next/bundle-analyzer` with `analyzerMode: 'json'` (and typically `openAnalyzer: false` in CI) so `.next/analyze/client.json` exists.