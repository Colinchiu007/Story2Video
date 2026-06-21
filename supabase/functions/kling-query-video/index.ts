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

/** Stream remote video to Supabase Storage */
async function streamVideoToStorage(videoUrl: string): Promise<string | null> {
  try {
    const response = await fetch(videoUrl);
    if (!response.ok) {
      console.error(`Fetch video failed: ${response.status}`);
      return null;
    }
    const contentType = response.headers.get("content-type") ?? "video/mp4";
    const ext = "mp4";
    const filePath = `uploads/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
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

/** Map Kling task_status to normalized status */
function normalizeStatus(klingStatus: string): string {
  switch (klingStatus) {
    case "succeed":
      return "completed";
    case "failed":
      return "failed";
    case "processing":
    default:
      return "processing";
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
      JSON.stringify({ error: "请求体格式错误" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
    );
  }

  const videoId = (body.video_id as string) ?? "";
  if (!videoId) {
    return new Response(
      JSON.stringify({ error: "缺少 video_id 参数" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
    );
  }

  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "服务器配置错误：缺少 INTEGRATIONS_API_KEY" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
    );
  }

  try {
    const upstream = await fetch(
      `https://app-bmyoogysfs3l-api-79jK6nw4zxDL-gateway.appmiaoda.com/v1/videos/${videoId}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-Gateway-Authorization": `Bearer ${apiKey}`,
        },
      },
    );

    if (upstream.status === 429) {
      return new Response(
        JSON.stringify({ status: "processing", progress: 50, error: null }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
      );
    }

    if (!upstream.ok) {
      const errText = await upstream.text();
      return new Response(
        JSON.stringify({ status: "failed", progress: 0, error: `查询失败 (${upstream.status}): ${errText.slice(0, 200)}` }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
      );
    }

    const result = await upstream.json();

    if (result.code !== undefined && result.code !== 0) {
      const msg = result.message ?? `错误码 ${result.code}`;
      return new Response(
        JSON.stringify({ status: "failed", progress: 0, error: msg }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
      );
    }

    const taskData = result.data ?? result;
    const taskStatus = taskData.task_status ?? taskData.status ?? "processing";
    const normalizedStatus = normalizeStatus(taskStatus);

    // Calculate progress based on status
    let progress = 0;
    if (normalizedStatus === "completed") progress = 100;
    else if (normalizedStatus === "failed") progress = 0;
    else progress = 50; // processing

    const responseBody: Record<string, unknown> = {
      status: normalizedStatus,
      progress,
      error: null,
    };

    // If completed, transfer video to storage
    if (normalizedStatus === "completed") {
      const taskResult = taskData.task_result;
      const videos = taskResult?.videos ?? taskResult?.video_list ?? [];
      if (videos.length > 0 && videos[0].url) {
        const videoUrl = videos[0].url;
        responseBody.video_url = videoUrl;
        const publicUrl = await streamVideoToStorage(videoUrl);
        if (publicUrl) {
          responseBody.publicUrl = publicUrl;
        }
      } else {
        responseBody.error = "任务已完成但未返回视频 URL";
      }
    }

    if (normalizedStatus === "failed") {
      responseBody.error = taskData.task_status_msg ?? taskData.message ?? "视频生成失败";
    }

    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders() },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ status: "failed", progress: 0, error: `请求失败: ${msg}` }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
    );
  }
});
