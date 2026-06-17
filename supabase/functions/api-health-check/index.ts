import { serve } from "https://deno.land/std/http/server.ts";

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders() },
    });
  }

  let apiBaseUrl: string;
  let apiKey: string;
  let provider = "";

  try {
    const body = await req.json();
    apiBaseUrl = (body.api_base_url as string)?.replace(/\/$/, "") ?? "";
    apiKey = (body.api_key as string) ?? "";
    provider = (body.provider as string) ?? "";
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders() },
    });
  }

  // Vidu: 没有 /models 端点，使用实际图片生成端点做轻量级连通性测试
  if (provider === "vidu") {
    const viduKey = apiKey || Deno.env.get("VIDU_API_KEY") || "";
    if (!viduKey) {
      return new Response(
        JSON.stringify({ ok: false, message: "未配置 Vidu API Key" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
      );
    }
    try {
      const resp = await fetch("https://api.vidu.cn/ent/v2/reference2image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Token ${viduKey}`,
        },
        body: JSON.stringify({
          model: "viduq2",
          prompt: "test",
          aspect_ratio: "1:1",
          resolution: "1080p",
        }),
        signal: AbortSignal.timeout(15000),
      });
      // 200 或返回 task_id 表示认证通过
      if (resp.status === 200) {
        const result = await resp.json();
        if (result.task_id) {
          return new Response(
            JSON.stringify({ ok: true, message: "Vidu API 连通性测试通过" }),
            { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
          );
        }
      }
      // 401 明确是鉴权失败
      if (resp.status === 401) {
        return new Response(
          JSON.stringify({ ok: false, message: "Vidu API Key 无效（401），请检查密钥是否正确" }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
        );
      }
      const text = await resp.text();
      return new Response(
        JSON.stringify({ ok: false, message: `Vidu API 测试失败（HTTP ${resp.status}）: ${text.slice(0, 200)}` }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
      );
    } catch (err) {
      return new Response(
        JSON.stringify({ ok: false, message: `Vidu 连接失败: ${(err as Error).message}` }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
      );
    }
  }

  // SenseNova: 使用固定地址，通过 /images/generations 端点测试连通性
  if (provider === "sensenova") {
    const baseUrl = "https://token.sensenova.cn/v1";
    const key = apiKey || Deno.env.get("SENSENOVA_API_KEY") || "";
    if (!key) {
      return new Response(
        JSON.stringify({ ok: false, message: "未配置 SenseNova API Key" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
      );
    }
    try {
      const resp = await fetch(`${baseUrl}/images/generations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: "sensenova-u1-fast",
          prompt: "test",
          size: "2048x2048",
          n: 1,
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (resp.status === 200) {
        return new Response(
          JSON.stringify({ ok: true, message: "SenseNova API 连通性测试通过，密钥有效" }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
        );
      }
      if (resp.status === 401) {
        return new Response(
          JSON.stringify({ ok: false, message: "SenseNova API Key 无效（401），请检查密钥是否正确" }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
        );
      }
      const text = await resp.text();
      return new Response(
        JSON.stringify({ ok: false, message: `SenseNova API 测试失败（HTTP ${resp.status}）: ${text.slice(0, 200)}` }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
      );
    } catch (err) {
      return new Response(
        JSON.stringify({ ok: false, message: `SenseNova 连接失败: ${(err as Error).message}` }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
      );
    }
  }

  // Generic OpenAI-compatible test
  if (!apiBaseUrl) {
    return new Response(
      JSON.stringify({ ok: false, message: "请填写 API 基础地址" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
    );
  }

  // Reject placeholder URLs
  if (
    apiBaseUrl.includes("example.com") ||
    apiBaseUrl.includes("placeholder") ||
    apiBaseUrl.includes("localhost")
  ) {
    return new Response(
      JSON.stringify({ ok: false, message: "请填写真实的 API 地址，不能使用示例占位符" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
    );
  }

  const testUrl = `${apiBaseUrl}/models`;
  let responseStatus = 0;
  let responseText = "";

  try {
    const testResp = await fetch(testUrl, {
      method: "GET",
      headers: { "Authorization": `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10000),
    });
    responseStatus = testResp.status;
    responseText = await testResp.text();
  } catch (err) {
    const msg = (err as Error).message;
    return new Response(
      JSON.stringify({ ok: false, message: `连接失败: ${msg}` }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
    );
  }

  if (responseStatus === 200) {
    return new Response(
      JSON.stringify({ ok: true, message: "连通性测试通过，API 地址和密钥有效" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
    );
  }

  if (responseStatus === 401 || responseStatus === 403) {
    return new Response(
      JSON.stringify({ ok: false, message: "API 地址可达，但鉴权密钥无效（401/403），请检查密钥是否正确" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
    );
  }

  if (responseStatus === 404) {
    return new Response(
      JSON.stringify({ ok: true, message: "API 地址可达（404 为该 API 未开放 /models 列表，不影响使用）" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
    );
  }

  return new Response(
    JSON.stringify({ ok: false, message: `连接异常（HTTP ${responseStatus}）: ${responseText.slice(0, 200)}` }),
    { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
  );
});
