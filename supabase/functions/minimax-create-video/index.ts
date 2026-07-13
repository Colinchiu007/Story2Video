import { serve } from "https://deno.land/std/http/server.ts";

/**
 * MiniMax 视频生成 - 创建任务
 * 
 * 支持模型:
 * - MiniMax-Hailuo-2.3: 推荐，1080P 6秒
 * - MiniMax-Hailuo-02: 768P 可选 6/10 秒
 * - T2V-01: 720P 6秒
 * - I2V-01: 图生视频模型
 * 
 * API: POST https://api.minimaxi.com/v1/video_generation
 * 文档: https://platform.minimaxi.com/api-reference/video-generation-t2v
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

  // 获取参数
  const prompt = (body.prompt as string) ?? "";
  const model = (body.model as string) || "MiniMax-Hailuo-2.3";
  const operation = (body.operation as string) || "text_to_video";
  const firstFrameImage = body.first_frame_image as string | undefined;
  const duration = Number(body.duration ?? 6);
  const resolution = (body.resolution as string) || "1080P";
  const promptOptimizer = body.prompt_optimizer !== false; // 默认开启
  const aigcWatermark = Boolean(body.aigc_watermark ?? false);

  // 验证必填参数
  if (!prompt && operation === "text_to_video") {
    return new Response(JSON.stringify({ error: "缺少 prompt 参数" }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  console.log("[minimax-create-video] request", {
    model,
    operation,
    promptLength: prompt.length,
    duration,
    resolution,
    hasFirstFrame: !!firstFrameImage,
    apiKeyPrefix: apiKey.slice(0, 8) + "...",
  });

  try {
    const payload: Record<string, unknown> = {
      model,
      prompt,
      duration,
      resolution,
      prompt_optimizer: promptOptimizer,
      aigc_watermark: aigcWatermark,
    };

    // 图生视频：使用 first_frame_image 参数
    if (operation === "image_to_video" || firstFrameImage) {
      if (!firstFrameImage) {
        return new Response(JSON.stringify({ error: "图生视频需要提供 first_frame_image URL" }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      payload.first_frame_image = firstFrameImage;
    }

    const resp = await fetch("https://api.minimaxi.com/v1/video_generation", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    console.log("[minimax-create-video] response status", resp.status);

    const respText = await resp.text();
    console.log("[minimax-create-video] response body", respText.slice(0, 2000));

    let data: {
      task_id?: string;
      base_resp?: { status_code?: number; status_msg?: string };
    };
    try {
      data = JSON.parse(respText);
    } catch {
      return new Response(
        JSON.stringify({ error: `MiniMax 返回非 JSON 响应: ${respText.slice(0, 200)}` }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    // status_code === 0 表示成功
    const baseCode = data.base_resp?.status_code ?? -1;
    if (baseCode !== 0) {
      const errMsg = data.base_resp?.status_msg ?? "MiniMax 视频生成请求失败";
      const errorMap: Record<number, string> = {
        1002: "触发限流，请稍后重试",
        1004: "账号鉴权失败",
        1008: "余额不足",
        1026: "内容涉及敏感",
        2013: "参数异常",
        2049: "无效 API Key",
      };
      return new Response(
        JSON.stringify({ error: errorMap[baseCode] ?? errMsg, code: baseCode, raw: data }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    return new Response(
      JSON.stringify({
        videoId: data.task_id,
        status: "processing",
        model,
        operation,
        duration,
        resolution,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[minimax-create-video] exception", msg);
    return new Response(
      JSON.stringify({ error: `请求 MiniMax 失败: ${msg}` }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }
});
