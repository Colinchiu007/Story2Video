import { serve } from "https://deno.land/std/http/server.ts";

interface CustomApiConfig {
  apiBaseUrl: string;
  apiKey: string;
  modelName: string;
}

function getCustomApi(body: Record<string, unknown>): CustomApiConfig | null {
  const custom = body._custom_api as Record<string, string> | undefined;
  if (custom && custom.apiBaseUrl && custom.apiKey && custom.modelName) {
    const url = custom.apiBaseUrl.trim();
    if (url.includes('example.com') || url.includes('placeholder') || url.includes('localhost')) {
      return null;
    }
    return { apiBaseUrl: url, apiKey: custom.apiKey.trim(), modelName: custom.modelName.trim() };
  }
  return null;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  let body: Record<string, unknown>;
  let videoId: string | undefined;
  let videoUrl: string | undefined;
  let prompt: string;
  try {
    body = await req.json();
    videoId = body.video_id as string | undefined;
    videoUrl = body.video_url as string | undefined;
    prompt = body.prompt as string;
    if (!videoId && !videoUrl) throw new Error("Missing video_id or video_url");
    if (!prompt) throw new Error("Missing prompt");
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  const customApi = getCustomApi(body);
  let apiKey: string;
  let upstreamUrl: string;

  if (customApi) {
    apiKey = customApi.apiKey;
    upstreamUrl = `${customApi.apiBaseUrl.replace(/\/$/, "")}/openai/v1/videos/remix`;
  } else {
    apiKey = Deno.env.get("INTEGRATIONS_API_KEY") ?? "";
    upstreamUrl = "https://app-bmyoogysfs3l-api-M9v0wP10kQjY-gateway.appmiaoda.com/openai/v1/videos/remix";
  }

  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (customApi) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  } else {
    headers["X-Gateway-Authorization"] = `Bearer ${apiKey}`;
  }

  const upstreamBody: Record<string, unknown> = { prompt };
  if (videoId) upstreamBody.video_id = videoId;
  if (videoUrl) upstreamBody.video_url = videoUrl;

  const upstream = await fetch(upstreamUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(upstreamBody),
  });

  if (!upstream.ok) {
    const errText = await upstream.text();
    return new Response(
      JSON.stringify({ error: `视频生成服务错误 (${upstream.status}): ${errText}` }),
      { status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } },
    );
  }

  const data = await upstream.json();
  return new Response(JSON.stringify({ videoId: data.id, status: data.status }), {
    status: 200,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
});
