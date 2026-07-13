/**
 * 通用 API 客户端
 *
 * 为外部 Python 服务（smart-sentence-splitter、prompt-engine）提供统一的 HTTP 调用层。
 * 所有网络错误、超时、非 2xx 响应统一抛出 ApiUnavailableError，
 * 由上层包装函数捕获并降级到本地 TS 实现。
 */

export class ApiUnavailableError extends Error {
  constructor(
    public readonly service: string,
    public readonly cause: string,
  ) {
    super(`[${service}] ${cause}`);
    this.name = 'ApiUnavailableError';
  }
}

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * 通用 POST 请求
 * @param baseUrl  服务根 URL（如 http://localhost:8013）
 * @param path     端点路径（如 /v1/optimize）
 * @param body     请求体（将被 JSON 序列化）
 * @param timeoutMs 超时时间（毫秒），默认 30s
 * @returns 解析后的 JSON 响应
 */
export async function apiPost<T>(
  baseUrl: string,
  path: string,
  body: unknown,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const url = `${baseUrl.replace(/\/+$/, '')}${path}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new ApiUnavailableError(
        url,
        `HTTP ${response.status}: ${text.slice(0, 200)}`,
      );
    }

    return (await response.json()) as T;
  } catch (err) {
    if (err instanceof ApiUnavailableError) throw err;
    const message = err instanceof DOMException && err.name === 'AbortError'
      ? `Timeout after ${timeoutMs}ms`
      : err instanceof Error
        ? err.message
        : String(err);
    throw new ApiUnavailableError(url, message);
  } finally {
    clearTimeout(timer);
  }
}
