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
  let prompt: string;
  let size: string;
  let seconds: string;
  let model: string;
  let inputReferenceUrl: string | undefined;

  try {
    body = await req.json();
    prompt = body.prompt as string;
    if (!prompt) throw new Error("Missing prompt");
    size = (body.size as string) ?? "720x1280";
    seconds = String(body.seconds ?? 4);
    model = (body.model as string) ?? "sora-2";
    inputReferenceUrl = body.input_reference_url as string | undefined;
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
    upstreamUrl = `${customApi.apiBaseUrl.replace(/\/$/, "")}/openai/v1/videos`;
    model = customApi.modelName;
  } else {
    apiKey = Deno.env.get("INTEGRATIONS_API_KEY") ?? "";
    upstreamUrl = "https://app-bmyoogysfs3l-api-Xa6Jew6JjAqa-gateway.appmiaoda.com/openai/v1/videos";
  }

  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  const form = new FormData();
  form.append("model", model);
  form.append("prompt", prompt);
  form.append("size", size);
  form.append("seconds", seconds);

  if (inputReferenceUrl) {
    const imgResp = await fetch(inputReferenceUrl);
    if (!imgResp.ok) {
      return new Response(
        JSON.stringify({ error: `Failed to fetch reference image: ${imgResp.status}` }),
        { status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } },
      );
    }
    const imgBlob = await imgResp.blob();
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(imgBlob.type)) {
      return new Response(
        JSON.stringify({ error: `input_reference 格式不支持：${imgBlob.type}，仅允许 JPEG/PNG/WebP` }),
        { status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } },
      );
    }
    const MAX_BYTES = 10 * 1024 * 1024;
    if (imgBlob.size > MAX_BYTES) {
      return new Response(
        JSON.stringify({ error: `input_reference 文件过大：${(imgBlob.size / 1024 / 1024).toFixed(1)} MB，上限 10 MB` }),
        { status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } },
      );
    }
    const filename = inputReferenceUrl.split("/").pop() ?? "reference.jpg";
    form.append("input_reference", imgBlob, filename);
  }

  const headers: Record<string, string> = {};
  if (customApi) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  } else {
    headers["X-Gateway-Authorization"] = `Bearer ${apiKey}`;
  }

  const upstream = await fetch(upstreamUrl, {
    method: "POST",
    headers,
    body: form,
  });

  if (!upstream.ok) {
    const errText = await upstream.text();
    // Return 200 so supabase-js doesn't throw a generic "non-2xx" error;
    // the client checks for the "error" field in the body.
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
