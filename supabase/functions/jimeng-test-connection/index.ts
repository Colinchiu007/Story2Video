import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

/** HMAC-SHA256 */
async function hmacSha256(key: ArrayBuffer, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(data));
}

/** Hex encode */
function hexEncode(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Hash with SHA-256 */
async function sha256Hash(data: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data));
  return hexEncode(buf);
}

/**
 * Build Volcengine Authorization header using HMAC-SHA256 signing.
 * 从 headers 中读取 X-Date，确保签名值与发送的 header 完全一致。
 */
async function buildAuthorization(
  ak: string,
  sk: string,
  method: string,
  uri: string,
  query: string,
  headers: Record<string, string>,
  payload: string,
): Promise<string> {
  // 从 headers 中读取 X-Date，确保与请求头完全一致
  const date = (headers["X-Date"] ?? headers["x-date"] ?? "").trim();
  if (!date) throw new Error("Missing X-Date header for signing");
  const dateShort = date.slice(0, 8);
  const region = "cn-north-1";
  const service = "cv";

  const signedHeaders = Object.keys(headers).map((k) => k.toLowerCase()).sort().join(";");

  const canonicalHeaders = Object.entries(headers)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k.toLowerCase()}:${v.trim()}\n`)
    .join("");

  const payloadHash = await sha256Hash(payload);

  const canonicalRequest = [
    method,
    uri,
    query,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const algorithm = "HMAC-SHA256";
  const credentialScope = `${dateShort}/${region}/${service}/request`;
  const canonicalRequestHash = await sha256Hash(canonicalRequest);

  const stringToSign = `${algorithm}\n${date}\n${credentialScope}\n${canonicalRequestHash}`;

  // Derive signing key
  let kDate = await hmacSha256(new TextEncoder().encode(sk), dateShort);
  let kRegion = await hmacSha256(kDate, region);
  let kService = await hmacSha256(kRegion, service);
  let kSigning = await hmacSha256(kService, "request");
  const signature = hexEncode(await hmacSha256(kSigning, stringToSign));

  return `${algorithm} Credential=${ak}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method Not Allowed" }),
      { status: 405, headers: { "Content-Type": "application/json", ...corsHeaders() } },
    );
  }

  let accessKeyId = "";
  let secretAccessKey = "";

  try {
    const body = await req.json();
    accessKeyId = (body.access_key_id as string) ?? "";
    secretAccessKey = (body.secret_access_key as string) ?? "";
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid request body" }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders() } },
    );
  }

  if (!accessKeyId || !secretAccessKey) {
    return new Response(
      JSON.stringify({ success: false, message: "缺少 Access Key ID 或 Secret Access Key" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
    );
  }

  // 使用正确的 Action 和 Version（来自火山引擎官方文档）
  const endpoint = "https://visual.volcengineapi.com";
  const uri = "/";
  const query = "Action=CVSync2AsyncSubmitTask&Version=2022-08-31";
  const payload = JSON.stringify({
    req_key: "jimeng_t2i_v40",
    prompt: "test",
    size: 1048576, // 1024*1024, 1K 分辨率，最小面积
    force_single: true,
  });

  // X-Date 必须使用 ISO 8601 基本格式 YYYYMMDD'T'HHMMSS'Z'，与签名中的 date 完全一致
  const now = new Date();
  const xDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, "").slice(0, 15) + "Z";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Host": "visual.volcengineapi.com",
    "X-Date": xDate,
  };

  try {
    const authorization = await buildAuthorization(
      accessKeyId,
      secretAccessKey,
      "POST",
      uri,
      query,
      headers,
      payload,
    );

    const resp = await fetch(`${endpoint}${uri}?${query}`, {
      method: "POST",
      headers: {
        ...headers,
        "Authorization": authorization,
      },
      body: payload,
      signal: AbortSignal.timeout(30000),
    });

    const result = await resp.json();

    // 火山引擎返回 code=10000 表示成功
    if (result.code === 10000 || result.code === "10000") {
      return new Response(
        JSON.stringify({ success: true, message: "即梦 API 连通性测试通过，AK/SK 有效" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
      );
    }

    const code = result?.ResponseMetadata?.Error?.Code ?? result?.code ?? "";
    const msg = result?.ResponseMetadata?.Error?.Message ?? result?.message ?? JSON.stringify(result).slice(0, 200);

    // Auth-related errors
    if (code.includes("Auth") || code.includes("Signature") || code.includes("Unauthorized") || resp.status === 403) {
      return new Response(
        JSON.stringify({ success: false, message: `鉴权失败，请检查 AK/SK 是否正确（${code}）` }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
      );
    }

    return new Response(
      JSON.stringify({ success: false, message: `即梦 API 测试失败（${code}）: ${msg}` }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, message: `连接失败: ${(err as Error).message}` }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
    );
  }
});
