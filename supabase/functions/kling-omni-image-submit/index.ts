import { serve } from "https://deno.land/std/http/server.ts";

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
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
      JSON.stringify({ error: "Server configuration error: missing INTEGRATIONS_API_KEY" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
    );
  }

  const requestBody: Record<string, unknown> = { prompt };

  if (body.model_name !== undefined) requestBody.model_name = body.model_name;
  if (body.image_list !== undefined) requestBody.image_list = body.image_list;
  if (body.element_list !== undefined) requestBody.element_list = body.element_list;
  if (body.resolution !== undefined) requestBody.resolution = body.resolution;
  if (body.result_type !== undefined) requestBody.result_type = body.result_type;
  if (body.n !== undefined) requestBody.n = body.n;
  if (body.aspect_ratio !== undefined) requestBody.aspect_ratio = body.aspect_ratio;
  if (body.watermark_info !== undefined) requestBody.watermark_info = body.watermark_info;
  if (body.callback_url !== undefined) requestBody.callback_url = body.callback_url;
  if (body.external_task_id !== undefined) requestBody.external_task_id = body.external_task_id;

  // series_amount 仅在 result_type=series 时传递
  const resultType = body.result_type as string | undefined;
  const seriesAmount = body.series_amount as number | undefined;
  if (resultType === "series" && seriesAmount !== undefined) {
    requestBody.series_amount = seriesAmount;
  }

  try {
    const upstream = await fetch(
      "https://app-bmyoogysfs3l-api-DLEO4zbkvoea-gateway.appmiaoda.com/v1/images/omni-image",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Gateway-Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
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

    const data = await upstream.json();
    return new Response(JSON.stringify(data), {
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
