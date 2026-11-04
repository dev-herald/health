/** CVE runs only when the caller opts in with `cve` or an explicit lockfile path. */
export function shouldScanCve(cve: boolean, lockfilePath: string): boolean {
  return cve || lockfilePath.length > 0;
}
