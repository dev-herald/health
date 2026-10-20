/** Measurements live beside health ingest on the same host. */
export function measurementsUrl(ingestUrl: string): string {
  const url = new URL(ingestUrl);
  if (url.pathname.endsWith('/health/ingest')) {
    url.pathname = url.pathname.replace(/\/health\/ingest$/, '/initiatives/measurements');
  } else {
    url.pathname = '/api/v1/initiatives/measurements';
  }
  url.search = '';
  url.hash = '';
  return url.toString();
}
