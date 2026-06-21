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

async function buildAuthorization(
  ak: string,
  sk: string,
  method: string,
  uri: string,
  query: string,
  headers: Record<string, string>,
  payload: string,
): Promise<string> {
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

  let kDate = await hmacSha256(new TextEncoder().encode(sk), dateShort);
  let kRegion = await hmacSha256(kDate, region);
  let kService = await hmacSha256(kRegion, service);
  let kSigning = await hmacSha256(kService, "request");
  const signature = hexEncode(await hmacSha256(kSigning, stringToSign));

  return `${algorithm} Credential=${ak}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
}

/** Upload remote image to Supabase Storage */
async function uploadImageToStorage(imageUrl: string): Promise<string | null> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      console.error(`Fetch image failed: ${response.status}`);
      return null;
    }
    const contentType = response.headers.get("content-type") ?? "image/png";
    const ext = contentType.includes("jpg") || contentType.includes("jpeg") ? "jpg" : "png";
    const filePath = `uploads/${crypto.randomUUID()}.${ext}`;
    const { data, error } = await supabase.storage
      .from("generated-videos")
      .upload(filePath, response.body!, {
        contentType,
        cacheControl: "no-cache",
        upsert: false,
      });
    if (error) {
      console.error("Upload to storage error:", error);
      return null;
    }
    const { data: urlData } = supabase.storage.from("generated-videos").getPublicUrl(filePath);
    return urlData.publicUrl;
  } catch (err) {
    console.error("uploadImageToStorage error:", err);
    return null;
  }
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
  let taskId = "";

  try {
    const body = await req.json();
    accessKeyId = (body.access_key_id as string) ?? "";
    secretAccessKey = (body.secret_access_key as string) ?? "";
    taskId = (body.task_id as string) ?? "";
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid request body" }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders() } },
    );
  }

  if (!accessKeyId || !secretAccessKey) {
    return new Response(
      JSON.stringify({ error: "缺少 Access Key ID 或 Secret Access Key" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
    );
  }

  if (!taskId) {
    return new Response(
      JSON.stringify({ error: "缺少 task_id 参数" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
    );
  }

  const endpoint = "https://visual.volcengineapi.com";
  const uri = "/";
  const query = "Action=CVTask&Version=2022-08-31";
  const payload = JSON.stringify({
    TaskId: taskId,
  });

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

    // 火山引擎错误码处理
    if (result.code !== 10000 && result.code !== "10000") {
      const code = result?.ResponseMetadata?.Error?.Code ?? result?.code ?? "";
      const msg = result?.ResponseMetadata?.Error?.Message ?? result?.message ?? JSON.stringify(result).slice(0, 200);
      return new Response(
        JSON.stringify({ error: `查询失败（${code}）: ${msg}` }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
      );
    }

    // 火山引擎返回格式: data.status = "done" / "in_queue" / "generating" / "not_found" / "expired"
    const status = result?.data?.status ?? "unknown";
    const imageUrls = result?.data?.image_urls as string[] | undefined;
    const firstImageUrl = imageUrls && imageUrls.length > 0 ? imageUrls[0] : null;

    if (status === "done") {
      if (firstImageUrl) {
        const publicUrl = await uploadImageToStorage(firstImageUrl);
        return new Response(
          JSON.stringify({
            status: "completed",
            progress: 100,
            image_url: publicUrl ?? firstImageUrl,
            publicUrl: publicUrl ?? firstImageUrl,
            error: null,
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
        );
      }
      return new Response(
        JSON.stringify({ status: "completed", progress: 100, error: null }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
      );
    }

    if (status === "expired" || status === "not_found") {
      const errMsg = result?.message ?? "任务已过期或不存在";
      return new Response(
        JSON.stringify({ status: "failed", progress: 0, error: errMsg }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
      );
    }

    // in_queue / generating / pending
    const progress = status === "in_queue" ? 20 : status === "generating" ? 60 : 50;
    return new Response(
      JSON.stringify({ status: "pending", progress, error: null }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `查询失败: ${(err as Error).message}` }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
    );
  }
});
