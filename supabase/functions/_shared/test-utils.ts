/**
 * Shared test utilities for Edge Functions
 *
 * Usage: `import { mockRequest, assertCors, assertMethodCheck } from '../_shared/test-utils.ts'`
 */

/** Create a mock Request with JSON body */
export function mockRequest(body: unknown, method = "POST"): Request {
  return new Request("http://localhost", {
    method,
    headers: { "Content-Type": "application/json" },
    body: method === "POST" ? JSON.stringify(body) : undefined,
  });
}

/** Create an OPTIONS preflight request */
export function mockOptionsRequest(): Request {
  return new Request("http://localhost", { method: "OPTIONS" });
}

/** Assert CORS headers present in response */
export function assertCors(resp: Response): void {
  const headers = resp.headers;
  const cors = headers.get("Access-Control-Allow-Origin");
  if (cors !== "*") throw new Error(`Expected CORS origin *, got ${cors}`);
  const methods = headers.get("Access-Control-Allow-Methods");
  if (!methods?.includes("POST")) throw new Error(`Expected POST in allowed methods, got ${methods}`);
}

/** Assert response is 200 and has valid JSON body */
export async function assertJsonResponse(resp: Response): Promise<Record<string, unknown>> {
  if (resp.status !== 200) {
    throw new Error(`Expected status 200, got ${resp.status}`);
  }
  const ct = resp.headers.get("Content-Type");
  if (!ct?.includes("application/json")) {
    throw new Error(`Expected JSON content type, got ${ct}`);
  }
  return await resp.json();
}
