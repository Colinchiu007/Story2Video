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

/** Parse size string like "720x1280" into { width, height } */
function parseSize(size: string): { width: number; height: number } {
  const parts = size.split("x").map((s) => parseInt(s.trim(), 10));
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return { width: parts[0], height: parts[1] };
  }
  return { width: 720, height: 1280 };
}

/** Upload remote video URL to Supabase Storage */
async function streamVideoToStorage(videoUrl: string): Promise<string | null> {
  try {
    const response = await fetch(videoUrl);
    if (!response.ok) {
      console.error(`Fetch video failed: ${response.status}`);
      return null;
    }
    const contentType = response.headers.get("content-type") ?? "video/mp4";
    const ext = contentType.includes("mp4") ? "mp4" : "mp4";
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
    console.error("streamVideoToStorage error:", err);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method Not Allowed" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid request body" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
    );
  }

  // Get Jimeng API key from request body (user-provided) or env fallback
  const userApiKey = (body.jimeng_api_key as string) ?? "";
  const envApiKey = Deno.env.get("JIMENG_API_KEY") ?? "";
  const apiKey = userApiKey || envApiKey;

  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "未配置即梦 API Key，请在设置中填写" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
    );
  }

  const prompt = (body.prompt as string) ?? "";
  if (!prompt) {
    return new Response(
      JSON.stringify({ error: "缺少 prompt 参数" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
    );
  }

  const size = (body.size as string) ?? "720x1280";
  const seconds = (body.seconds as number) ?? 8;
  const inputReferenceUrl = (body.input_reference_url as string) ?? undefined;
  const mode = (body.mode as string) ?? "text-to-video";
  // Jimeng model name; user can override via request body
  const modelName = (body.model as string) ?? "jimeng-video-generate-3.0";

  const { width, height } = parseSize(size);

  // Build upstream request for Jimeng / Ark platform
  // Volcengine Ark imaginations API (OpenAI-compatible)
  const upstreamBody: Record<string, unknown> = {
    model: modelName,
    prompt,
    width,
    height,
    duration: seconds,
  };
  if (inputReferenceUrl) {
    upstreamBody.image_url = inputReferenceUrl;
  }
  // Optional: FPS, seed, etc.
  const fps = (body.fps as number) ?? undefined;
  if (fps !== undefined) upstreamBody.fps = fps;

  // Primary endpoint: Ark imaginations API (OpenAI-compatible)
  // Try with user-provided model, then fallback models
  const models = [modelName, "jimeng-video-generate-3.0", "jimeng-video-3.0", "video-generation"];
  const endpoints = [
    "https://ark.cn-beijing.volces.com/api/v3/imaginations/generations",
    "https://ark.cn-beijing.volces.com/api/v3/videos/generations",
  ];

  let lastError = "";
  for (const endpoint of endpoints) {
    for (const m of models) {
      try {
        const reqBody = { ...upstreamBody, model: m };
        const upstream = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
          },
          body: JSON.stringify(reqBody),
        });

        const result = await upstream.json();

        if (!upstream.ok) {
          const msg = result.error?.message ?? result.message ?? JSON.stringify(result);
          lastError = `${endpoint} model=${m} 错误 (${upstream.status}): ${msg}`;
          console.error(lastError);
          // If it's a model-not-found error, try next model; otherwise try next endpoint
          const msgLower = String(msg).toLowerCase();
          if (msgLower.includes("model") || msgLower.includes("not found") || msgLower.includes("不存在")) {
            continue; // try next model
          }
          break; // try next endpoint
        }

        // Success path
        const jobId = result.id ?? result.data?.id ?? result.job_id ?? result.task_id;
        if (jobId) {
          return new Response(
            JSON.stringify({ videoId: String(jobId), status: result.status ?? "processing" }),
            { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
          );
        }

        // If response contains a direct video URL
        const directVideoUrl = result.video_url ?? result.data?.video_url ?? result.url;
        if (directVideoUrl) {
          const publicUrl = await streamVideoToStorage(String(directVideoUrl));
          return new Response(
            JSON.stringify({
              videoId: `direct_${crypto.randomUUID()}`,
              status: "completed",
              video_url: publicUrl ?? directVideoUrl,
              publicUrl: publicUrl ?? directVideoUrl,
            }),
            { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
          );
        }

        lastError = `未知响应格式: ${JSON.stringify(result).slice(0, 200)}`;
      } catch (err) {
        lastError = `请求 ${endpoint} model=${m} 失败: ${err instanceof Error ? err.message : String(err)}`;
        console.error(lastError);
      }
    }
  }

  // All endpoints failed
  return new Response(
    JSON.stringify({ error: `即梦视频生成失败: ${lastError}` }),
    { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
  );
});
