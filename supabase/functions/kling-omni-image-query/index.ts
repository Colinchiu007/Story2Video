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

async function streamMediaToStorage(
  mediaUrl: string,
  bucketName: string,
): Promise<
  | { success: true; path: string; publicUrl: string; contentType: string }
  | { success: false; error: string }
> {
  try {
    new URL(mediaUrl);
    const response = await fetch(mediaUrl);
    if (!response.ok) {
      throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type") ?? "application/octet-stream";
    const isAllowed =
      contentType.startsWith("image/") ||
      contentType.startsWith("video/") ||
      contentType.startsWith("audio/") ||
      contentType === "application/octet-stream";

    if (!isAllowed) {
      throw new Error(`Unsupported content type: ${contentType}`);
    }

    const ext = contentType.split("/")[1]?.split(";")[0] ?? "bin";
    const filePath = `uploads/${crypto.randomUUID()}.${ext}`;

    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, response.body!, { contentType, cacheControl: "no-cache", upsert: false });

    if (error) throw error;

    const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(filePath);
    return { success: true, path: data.path, publicUrl: urlData.publicUrl, contentType };
  } catch (err) {
    return { success: false, error: (err as Error).message };
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

  const taskId = (body.task_id as string) ?? "";
  if (!taskId) {
    return new Response(
      JSON.stringify({ error: "缺少 task_id 参数" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
    );
  }

  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "Server configuration error: missing INTEGRATIONS_API_KEY" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
    );
  }

  try {
    const upstream = await fetch(
      `https://app-bmyoogysfs3l-api-79jK6nw4zxDL-gateway.appmiaoda.com/v1/images/omni-image/${taskId}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-Gateway-Authorization": `Bearer ${apiKey}`,
        },
      },
    );

    if (upstream.status === 429 || upstream.status === 402) {
      const errText = await upstream.text();
      return new Response(errText, {
        status: upstream.status,
        headers: { "Content-Type": "application/json", ...corsHeaders() },
      });
    }

    if (!upstream.ok) {
      const errText = await upstream.text();
      return new Response(
        JSON.stringify({ error: `上游接口错误: ${upstream.status} ${errText.slice(0, 200)}` }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
      );
    }

    const responseData = await upstream.json();
    const taskData = responseData.data;

    // 仅在任务成功时转存图片 URL
    if (taskData?.task_status === "succeed" && taskData?.task_result) {
      const taskResult = taskData.task_result;
      const BUCKET = "generated-media";

      if (taskResult.images && taskResult.images.length > 0) {
        const transferredImages = await Promise.all(
          taskResult.images.map(async (img: { index: number; url: string; watermark_url?: string }) => {
            const transfer = await streamMediaToStorage(img.url, BUCKET);
            return {
              ...img,
              url: transfer.success ? transfer.publicUrl : img.url,
            };
          }),
        );
        taskResult.images = transferredImages;
      }

      if (taskResult.series_images && taskResult.series_images.length > 0) {
        const transferredSeriesImages = await Promise.all(
          taskResult.series_images.map(async (img: { index: number; url: string; watermark_url?: string }) => {
            const transfer = await streamMediaToStorage(img.url, BUCKET);
            return {
              ...img,
              url: transfer.success ? transfer.publicUrl : img.url,
            };
          }),
        );
        taskResult.series_images = transferredSeriesImages;
      }
    }

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders() },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: `请求失败: ${msg}` }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
    );
  }
});
