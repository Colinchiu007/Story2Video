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

/** Upload remote image URL to Supabase Storage */
async function streamImageToStorage(imageUrl: string): Promise<string | null> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      console.error(`Fetch image failed: ${response.status}`);
      return null;
    }
    const contentType = response.headers.get("content-type") ?? "image/png";
    const ext = contentType.includes("jpg") || contentType.includes("jpeg") ? "jpg" : "png";
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
    console.error("streamImageToStorage error:", err);
    return null;
  }
}

/** Convert size to Vidu aspect_ratio */
function sizeToAspectRatio(size: string): string {
  const parts = size.split("x").map((s) => parseInt(s.trim(), 10));
  if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) return "9:16";
  const w = parts[0];
  const h = parts[1];
  if (w === 720 && h === 1280) return "9:16";
  if (w === 1280 && h === 720) return "16:9";
  if (w === h) return "1:1";
  if (w / h < 0.8) return "3:4";
  if (w / h > 1.3) return "4:3";
  return "9:16";
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

  const userApiKey = (body.vidu_api_key as string) ?? "";
  const envApiKey = Deno.env.get("VIDU_API_KEY") ?? "";
  const apiKey = userApiKey || envApiKey;

  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "未配置 Vidu API Key，请在设置中填写" }),
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
  const model = (body.model as string) ?? "viduq2";
  const referenceImageUrl = (body.reference_image_url as string) ?? undefined;

  const aspectRatio = sizeToAspectRatio(size);
  const resolution = model.startsWith("viduq2") ? "1080p" : "1080p";

  const viduBody: Record<string, unknown> = {
    model,
    prompt,
    aspect_ratio: aspectRatio,
    resolution,
  };

  if (referenceImageUrl) {
    viduBody.images = [referenceImageUrl];
  }

  try {
    const upstream = await fetch("https://api.vidu.cn/ent/v2/reference2image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Token ${apiKey}`,
      },
      body: JSON.stringify(viduBody),
    });

    const result = await upstream.json();

    if (!upstream.ok) {
      const msg = result.err_code ?? result.message ?? JSON.stringify(result);
      return new Response(
        JSON.stringify({ error: `Vidu 图片生成失败: ${msg}` }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
      );
    }

    const taskId = result.task_id;
    if (taskId) {
      return new Response(
        JSON.stringify({ imageId: String(taskId), status: result.state ?? "created" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
      );
    }

    return new Response(
      JSON.stringify({ error: `未知响应格式: ${JSON.stringify(result).slice(0, 200)}` }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: `请求失败: ${msg}` }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
    );
  }
});
