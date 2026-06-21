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

  const videoId = (body.videoId as string) ?? "";
  if (!videoId) {
    return new Response(
      JSON.stringify({ error: "缺少 videoId 参数" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
    );
  }

  const userApiKey = (body.jimeng_api_key as string) ?? "";
  const envApiKey = Deno.env.get("JIMENG_API_KEY") ?? "";
  const apiKey = userApiKey || envApiKey;

  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "未配置即梦 API Key" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
    );
  }

  // Direct video URL already processed
  if (videoId.startsWith("direct_")) {
    return new Response(
      JSON.stringify({
        id: videoId,
        status: "completed",
        progress: "100",
        state: 1,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
    );
  }

  // Try query endpoints
  const queryEndpoints = [
    `https://ark.cn-beijing.volces.com/api/v3/imaginations/generations/${videoId}`,
    `https://ark.cn-beijing.volces.com/api/v3/videos/generations/${videoId}`,
  ];

  let lastError = "";
  for (const endpoint of queryEndpoints) {
    try {
      const upstream = await fetch(endpoint, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
        },
      });

      const result = await upstream.json();

      if (!upstream.ok) {
        const msg = result.error?.message ?? result.message ?? JSON.stringify(result);
        lastError = `${endpoint} 错误 (${upstream.status}): ${msg}`;
        console.error(lastError);
        continue;
      }

      const status = result.status ?? result.data?.status ?? "unknown";

      // Completed
      if (status === "completed" || status === "success" || status === "done" || status === "finished") {
        const videoUrl = result.video_url ?? result.data?.video_url ?? result.url ?? result.output?.video_url;
        let publicUrl: string | null = null;
        if (videoUrl) {
          publicUrl = await streamVideoToStorage(String(videoUrl));
        }
        return new Response(
          JSON.stringify({
            id: videoId,
            status: "completed",
            progress: "100",
            state: 1,
            video_url: publicUrl ?? videoUrl ?? null,
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
        );
      }

      // Failed
      if (status === "failed" || status === "error" || status === "cancelled") {
        const failMsg = result.reason ?? result.error?.message ?? result.data?.reason ?? "生成失败";
        return new Response(
          JSON.stringify({
            id: videoId,
            status: "failed",
            progress: "100",
            state: 4,
            message: failMsg,
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
        );
      }

      // Still processing
      const progress = result.progress ?? result.data?.progress ?? "50";
      return new Response(
        JSON.stringify({
          id: videoId,
          status: status,
          progress: String(progress),
          state: 0,
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
      );
    } catch (err) {
      lastError = `查询 ${endpoint} 失败: ${err instanceof Error ? err.message : String(err)}`;
      console.error(lastError);
    }
  }

  return new Response(
    JSON.stringify({ error: `查询视频状态失败: ${lastError}` }),
    { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
  );
});
