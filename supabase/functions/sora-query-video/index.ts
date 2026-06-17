import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

async function streamMediaToStorage(
  mediaUrl: string,
  bucketName: string,
): Promise<{ success: true; publicUrl: string } | { success: false; error: string }> {
  try {
    const response = await fetch(mediaUrl);
    if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
    const contentType = response.headers.get("content-type") ?? "video/mp4";
    const ext = contentType.split("/")[1]?.split(";")[0] ?? "mp4";
    const filePath = `uploads/${crypto.randomUUID()}.${ext}`;
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, response.body!, { contentType, cacheControl: "no-cache", upsert: false });
    if (error) throw error;
    const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(filePath);
    return { success: true, publicUrl: urlData.publicUrl };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
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

  let body: Record<string, unknown>;
  let videoId: string;
  try {
    body = await req.json();
    videoId = body.video_id as string;
    if (!videoId) throw new Error("Missing video_id");
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
    upstreamUrl = `${customApi.apiBaseUrl.replace(/\/$/, "")}/openai/v1/videos/${videoId}`;
  } else {
    apiKey = Deno.env.get("INTEGRATIONS_API_KEY") ?? "";
    upstreamUrl = "https://app-bmyoogysfs3l-api-M9v0w87KjxoY-gateway.appmiaoda.com/query";
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

  const upstream = await fetch(upstreamUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({ video_id: videoId }),
  });

  if (upstream.status === 429 || upstream.status === 402) {
    const errText = await upstream.text();
    return new Response(errText, {
      status: upstream.status,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
  if (!upstream.ok) {
    return new Response(
      JSON.stringify({ error: `Upstream error: ${upstream.status}` }),
      { status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } },
    );
  }

  const data = await upstream.json();

  if (data.status === "completed" && data.video_url) {
    const transfer = await streamMediaToStorage(data.video_url, "generated-media");
    if (transfer.success) {
      return new Response(
        JSON.stringify({ ...data, publicUrl: transfer.publicUrl }),
        { status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } },
      );
    }
    console.error("Storage transfer failed:", transfer.error);
  }

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
});
