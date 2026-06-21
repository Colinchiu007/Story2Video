import { serve } from "https://deno.land/std/http/server.ts";

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

/**
 * 将用户传入的 size 字符串（如 "1280x720"）映射为 MiniMax aspect_ratio 枚举值
 * MiniMax 支持：1:1 | 16:9 | 4:3 | 3:2 | 2:3 | 3:4 | 9:16 | 21:9
 */
function sizeToAspectRatio(size: string): string {
  const map: Record<string, string> = {
    "1024x1024": "1:1",
    "512x512":   "1:1",
    "1280x720":  "16:9",
    "1920x1080": "16:9",
    "720x1280":  "9:16",
    "1080x1920": "9:16",
    "1152x864":  "4:3",
    "864x1152":  "3:4",
    "1248x832":  "3:2",
    "832x1248":  "2:3",
  };
  return map[size] ?? "16:9";
}

serve(async (req: Request): Promise<Response> => {
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

  const userApiKey = (body.minimax_api_key as string) ?? "";
  const envApiKey = Deno.env.get("MINIMAX_API_KEY") ?? "";
  const apiKey = userApiKey || envApiKey;

  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "缺少 MiniMax API Key" }),
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

  const size = (body.size as string) ?? "1280x720";
  const model = (body.model as string) || "image-01";
  const aspectRatio = sizeToAspectRatio(size);

  console.log("[minimax-generate-image] request", {
    model,
    promptLength: prompt.length,
    aspectRatio,
    apiKeyPrefix: apiKey.slice(0, 8) + "...",
  });

  try {
    const resp = await fetch("https://api.minimaxi.com/v1/image_generation", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        prompt: prompt.slice(0, 1500),
        aspect_ratio: aspectRatio,
        response_format: "url",
        n: 1,
        prompt_optimizer: false,
      }),
    });

    console.log("[minimax-generate-image] response status", resp.status);

    const respText = await resp.text();
    console.log("[minimax-generate-image] response body", respText.slice(0, 2000));

    let data: {
      id?: string;
      data?: { image_urls?: string[] };
      base_resp?: { status_code?: number; status_msg?: string };
    };
    try {
      data = JSON.parse(respText);
    } catch {
      return new Response(
        JSON.stringify({ error: `MiniMax 返回非 JSON 响应: ${respText.slice(0, 200)}` }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
      );
    }

    // base_resp.status_code === 0 表示成功
    const baseCode = data.base_resp?.status_code ?? -1;
    if (baseCode !== 0) {
      const errMsg = data.base_resp?.status_msg ?? "MiniMax 图片生成失败";
      return new Response(
        JSON.stringify({ error: errMsg, raw: data }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
      );
    }

    const imageUrls = data.data?.image_urls ?? [];
    if (!imageUrls.length) {
      return new Response(
        JSON.stringify({ error: "MiniMax 未返回图片 URL", raw: data }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
      );
    }

    // MiniMax 图片生成是同步接口，直接返回 completed
    return new Response(
      JSON.stringify({
        imageId: imageUrls[0],
        publicUrl: imageUrls[0],
        status: "completed",
        taskId: data.id ?? "",
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[minimax-generate-image] exception", msg);
    return new Response(
      JSON.stringify({ error: `请求 MiniMax 失败: ${msg}` }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
    );
  }
});
