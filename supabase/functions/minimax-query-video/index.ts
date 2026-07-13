import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

/**
 * 将媒体流传输到 Supabase Storage
 */
async function streamMediaToStorage(
  mediaUrl: string,
  bucketName: string,
): Promise<{ success: true; publicUrl: string } | { success: false; error: string }> {
  try {
    const response = await fetch(mediaUrl);
    if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
    const contentType = response.headers.get("content-type") ?? "video/mp4";
    const ext = contentType.split("/")[1]?.split(";")[0] ?? "mp4";
    const filePath = `videos/${crypto.randomUUID()}.${ext}`;
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, response.body!, { contentType, cacheControl: "no-cache", upsert: false });
    if (error) throw error;
    const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(filePath);
    return { success: true, publicUrl: urlData.publicUrl };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * MiniMax 视频生成 - 查询任务状态
 * 
 * API: GET https://api.minimaxi.com/v1/query/video_generation?task_id=xxx
 * 文档: https://platform.minimaxi.com/api-reference/video-generation-t2v
 * 
 * 工作流程:
 * 1. 调用 create 创建任务，获取 task_id
 * 2. 轮询 query 查询状态，成功后获取 file_id
 * 3. 调用 files/retrieve 下载视频
 */
serve(async (req: Request): Promise<Response> => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  // 获取 API Key
  const userApiKey = (body.minimax_api_key as string) ?? "";
  const envApiKey = Deno.env.get("MINIMAX_API_KEY") ?? "";
  const apiKey = userApiKey || envApiKey;

  if (!apiKey) {
    return new Response(JSON.stringify({ error: "缺少 MiniMax API Key" }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const videoId = body.video_id as string;
  if (!videoId) {
    return new Response(JSON.stringify({ error: "缺少 video_id 参数" }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  console.log("[minimax-query-video] query", { videoId });

  try {
    // 查询状态: GET /v1/query/video_generation?task_id=xxx
    const resp = await fetch(
      `https://api.minimaxi.com/v1/query/video_generation?task_id=${encodeURIComponent(videoId)}`,
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("[minimax-query-video] response status", resp.status);

    if (!resp.ok) {
      const errText = await resp.text();
      return new Response(
        JSON.stringify({ error: `MiniMax API 错误 (${resp.status}): ${errText}` }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const data = await resp.json();
    console.log("[minimax-query-video] response data", JSON.stringify(data).slice(0, 1000));

    // 解析状态
    // status: "processing" | "Success" | "Fail"
    const status = data.status ?? "unknown";
    const fileId = data.file_id as string | undefined;

    const result: Record<string, unknown> = {
      videoId,
      status,
      fileId,
    };

    // 如果成功，获取下载链接
    if (status === "Success" && fileId) {
      result.fileId = fileId;
      
      // 获取下载 URL
      try {
        const fileResp = await fetch(
          `https://api.minimaxi.com/v1/files/retrieve?file_id=${encodeURIComponent(fileId)}`,
          {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
          }
        );
        
        if (fileResp.ok) {
          const fileData = await fileResp.json();
          const downloadUrl = fileData.file?.download_url;
          if (downloadUrl) {
            result.videoUrl = downloadUrl;
            
            // 自动上传到 Storage
            const autoUpload = body.auto_upload !== false;
            if (autoUpload) {
              const transfer = await streamMediaToStorage(downloadUrl, "generated-media");
              if (transfer.success) {
                result.publicUrl = transfer.publicUrl;
              } else {
                console.error("[minimax-query-video] Storage upload failed:", transfer.error);
              }
            }
          }
        }
      } catch (downloadErr) {
        console.error("[minimax-query-video] Get download URL failed:", downloadErr);
      }
    }

    // 如果失败，返回错误信息
    if (status === "Fail") {
      result.error = data.error_message ?? "视频生成失败";
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[minimax-query-video] exception", msg);
    return new Response(
      JSON.stringify({ error: `查询 MiniMax 失败: ${msg}` }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }
});
