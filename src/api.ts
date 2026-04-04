import * as https from 'https';
import type { RequestBody } from './types';

export interface HttpResponse {
  statusCode: number;
  data: string;
}

export async function makeHttpRequest(
  url: string,
  method: string,
  headers: Record<string, string>,
  body?: RequestBody
): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);

    if (parsedUrl.protocol !== 'https:') {
      reject(new Error(`Only HTTPS URLs are allowed for security reasons. Got: ${parsedUrl.protocol}`));
      return;
    }

    const hasBody = body !== undefined && method !== 'GET' && method !== 'HEAD';
    const payload = hasBody ? JSON.stringify(body) : '';
    const options: https.RequestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 443,
      path: parsedUrl.pathname + parsedUrl.search,
      method,
      headers: {
        ...headers,
        ...(hasBody ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode || 0,
          data,
        });
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Network error: ${error.message}`));
    });

    if (hasBody) {
      req.write(payload);
    }
    req.end();
  });
}

export function buildHeaders(apiKey: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
    'User-Agent': 'Dev-Herald-Health-Ingest-Action/1.0',
  };
}
