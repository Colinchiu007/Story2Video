import { serve } from "https://deno.land/std/http/server.ts";

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

/** Convert size string to Kling aspect_ratio */
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
      JSON.stringify({ error: "请求体格式错误" }),
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

  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "服务器配置错误：缺少 INTEGRATIONS_API_KEY" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
    );
  }

  const mode = (body.mode as string) ?? "text-to-video";
  const size = (body.size as string) ?? "720x1280";
  const seconds = (body.seconds as number) ?? 5;
  const inputReferenceUrl = (body.input_reference_url as string) ?? undefined;
  const negativePrompt = (body.negative_prompt as string) ?? undefined;
  const cfgScale = (body.cfg_scale as number) ?? undefined;
  const modelName = (body.model_name as string) ?? undefined;

  const aspectRatio = sizeToAspectRatio(size);
  // Kling only supports 5s or 10s
  const duration = seconds >= 8 ? 10 : 5;

  const klingBody: Record<string, unknown> = {
    prompt,
    aspect_ratio: aspectRatio,
    duration,
  };

  if (negativePrompt) klingBody.negative_prompt = negativePrompt;
  if (cfgScale !== undefined) klingBody.cfg_scale = cfgScale;
  if (modelName) klingBody.model_name = modelName;

  let upstreamUrl: string;
  if (mode === "image-to-video") {
    if (inputReferenceUrl) {
      klingBody.image = inputReferenceUrl;
    }
    upstreamUrl = "https://app-bmyoogysfs3l-api-DLEO4zbkvoea-gateway.appmiaoda.com/v1/videos/image2video";
  } else {
    upstreamUrl = "https://app-bmyoogysfs3l-api-DLEO4zbkvoea-gateway.appmiaoda.com/v1/videos/text2video";
  }

  try {
    const upstream = await fetch(upstreamUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(klingBody),
    });

    if (upstream.status === 429) {
      return new Response(
        JSON.stringify({ error: "操作过于频繁，请稍后再试" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
      );
    }

    if (upstream.status === 402) {
      return new Response(
        JSON.stringify({ error: "可灵 API 余额不足，请联系管理员" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
      );
    }

    if (!upstream.ok) {
      const errText = await upstream.text();
      return new Response(
        JSON.stringify({ error: `可灵视频生成失败 (${upstream.status}): ${errText.slice(0, 200)}` }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
      );
    }

    const result = await upstream.json();

    // Kling API response: { code: 0, data: { task_id: "...", task_status: "..." } }
    if (result.code !== undefined && result.code !== 0) {
      const msg = result.message ?? `错误码 ${result.code}`;
      return new Response(
        JSON.stringify({ error: `可灵视频生成失败: ${msg}` }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
      );
    }

    const taskData = result.data ?? result;
    const taskId = taskData.task_id ?? taskData.id ?? "";
    const taskStatus = taskData.task_status ?? taskData.status ?? "processing";

    if (!taskId) {
      return new Response(
        JSON.stringify({ error: `可灵未返回任务ID: ${JSON.stringify(result).slice(0, 200)}` }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
      );
    }

    return new Response(
      JSON.stringify({ videoId: String(taskId), status: taskStatus }),
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
