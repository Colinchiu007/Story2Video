import { serve } from "https://deno.land/std/http/server.ts";

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

/** Convert user size to SenseNova size string */
function sizeToSenseNovaSize(size: string): string {
  // SenseNova supported sizes:
  // 1664x2496 (2:3) | 2496x1664 (3:2) | 1760x2368 (3:4) | 2368x1760 (4:3)
  // 1824x2272 (4:5) | 2272x1824 (5:4) | 2048x2048 (1:1) | 2752x1536 (16:9)
  // 1536x2752 (9:16) | 3072x1376 (21:9) | 1344x3136 (9:21)
  const map: Record<string, string> = {
    "720x1280": "1536x2752",
    "1280x720": "2752x1536",
    "1080x1920": "1536x2752",
    "1920x1080": "2752x1536",
    "1024x1024": "2048x2048",
    "512x512": "2048x2048",
  };
  if (map[size]) return map[size];
  const validSizes = [
    "1664x2496", "2496x1664", "1760x2368", "2368x1760",
    "1824x2272", "2272x1824", "2048x2048", "2752x1536",
    "1536x2752", "3072x1376", "1344x3136",
  ];
  if (validSizes.includes(size)) return size;
  return "2752x1536"; // default 16:9
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

  const userApiKey = (body.sensenova_api_key as string) ?? "";
  const envApiKey = Deno.env.get("SENSENOVA_API_KEY") ?? "";
  const apiKey = userApiKey || envApiKey;

  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "未配置 SenseNova API Key，请在设置中填写" }),
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

  const size = sizeToSenseNovaSize((body.size as string) ?? "720x1280");
  const model = (body.model as string) ?? "sensenova-u1-fast";
  const n = (body.n as number) ?? 1;

  // SenseNova U1 Fast 使用固定地址
  const baseUrl = "https://token.sensenova.cn/v1";

  try {
    const upstream = await fetch(`${baseUrl}/images/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        prompt,
        size,
        n,
      }),
      signal: AbortSignal.timeout(90000),
    });

    const result = await upstream.json();

    if (!upstream.ok) {
      const msg = result.error?.message ?? result.message ?? JSON.stringify(result);
      return new Response(
        JSON.stringify({ error: `SenseNova 图片生成失败: ${msg}` }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
      );
    }

    // OpenAI-compatible response: { data: [{ url: string }], created: number }
    const dataArr = result.data as Array<{ url?: string }> | undefined;
    const firstImage = dataArr && dataArr.length > 0 ? dataArr[0] : undefined;
    const imageUrl = firstImage?.url;

    if (!imageUrl) {
      return new Response(
        JSON.stringify({ error: `SenseNova 未返回图片 URL: ${JSON.stringify(result).slice(0, 200)}` }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
      );
    }

    // 直接返回原始图片URL，由前端负责下载并上传到Storage
    return new Response(
      JSON.stringify({ imageId: imageUrl, status: "completed", rawUrl: imageUrl }),
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
