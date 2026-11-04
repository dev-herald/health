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

CVE scanning is off unless you set `lockfile-path` or `cve: true`. `cve: true` auto-detects `pnpm-lock.yaml`, `yarn.lock`, `package-lock.json`, or `bun.lock`. OSV still uses npm and pnpm only.

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

The same scan with auto-detect:

```yaml
      - uses: actions/checkout@v4

      - name: Upload health data to Dev Herald
        uses: dev-herald/health@v1
        with:
          api-key: ${{ secrets.DEV_HERALD_KEY }}
          cve: 'true'
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
          bundle-stats-path: apps/web/.next/diagnostics/analyze
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
          bundle-stats-path: apps/web/.next/analyze
          workflow-run-url: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}
```

`next.config` must enable `@next/bundle-analyzer` with `analyzerMode: 'json'` (and typically `openAnalyzer: false` in CI) so `.next/analyze/client.json` exists.

## Initiatives

Metric keys are whatever you defined on the initiative. These two snippets use different keys on purpose.

Emotion migration (`files` and `usages` are that initiative's keys):

```yaml
      - name: Count Emotion usage
        id: emotion
        run: |
          {
            echo "files=$(rg -l '@emotion' -g '*.tsx' -g '*.ts' | wc -l | tr -d ' ')"
            echo "usages=$(rg -o '@emotion' -g '*.tsx' -g '*.ts' | wc -l | tr -d ' ')"
          } >> "$GITHUB_OUTPUT"

      - name: Upload health data to Dev Herald
        uses: dev-herald/health@v1
        with:
          api-key: ${{ secrets.DEV_HERALD_KEY }}
          initiatives: |
            emotion-to-panda:
              files: ${{ steps.emotion.outputs.files }}
              usages: ${{ steps.emotion.outputs.usages }}
          workflow-run-url: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}
```

`@ts-ignore` cleanup (the only metric key is `directives`):

```yaml
      - name: Count ts-ignore directives
        id: ts-ignore
        run: |
          echo "directives=$(rg -o '@ts-ignore' -g '*.ts' -g '*.tsx' | wc -l | tr -d ' ')" >> "$GITHUB_OUTPUT"

      - name: Upload health data to Dev Herald
        uses: dev-herald/health@v1
        with:
          api-key: ${{ secrets.DEV_HERALD_KEY }}
          initiatives: |
            drop-ts-ignore:
              directives: ${{ steps.ts-ignore.outputs.directives }}
```

Same map from a file a script already wrote:

```yaml
      - name: Write initiative counts
        run: node scripts/initiative-counts.mjs > initiative-counts.json

      - name: Upload health data to Dev Herald
        uses: dev-herald/health@v1
        with:
          api-key: ${{ secrets.DEV_HERALD_KEY }}
          initiatives-path: initiative-counts.json
```

`initiative-counts.json`:

```json
{
  "emotion-to-panda": { "files": 12, "usages": 96 },
  "drop-ts-ignore": { "directives": 40 }
}
```