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

  const imageId = (body.image_id as string) ?? "";
  if (!imageId) {
    return new Response(
      JSON.stringify({ error: "缺少 image_id 参数" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
    );
  }

  const userApiKey = (body.vidu_api_key as string) ?? "";
  const envApiKey = Deno.env.get("VIDU_API_KEY") ?? "";
  const apiKey = userApiKey || envApiKey;

  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "未配置 Vidu API Key" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
    );
  }

  try {
    const upstream = await fetch(`https://api.vidu.cn/ent/v2/tasks/${imageId}/creations`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Token ${apiKey}`,
      },
    });

    const result = await upstream.json();

    if (!upstream.ok) {
      const msg = result.err_code ?? result.message ?? JSON.stringify(result);
      return new Response(
        JSON.stringify({ error: `查询失败: ${msg}` }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
      );
    }

    const state = result.state ?? "unknown";

    if (state === "success") {
      const creations = result.creations ?? [];
      const first = creations[0];
      let publicUrl: string | null = null;
      if (first?.url) {
        publicUrl = await streamImageToStorage(String(first.url));
      }
      return new Response(
        JSON.stringify({
          status: "completed",
          progress: 100,
          image_url: publicUrl ?? first?.url ?? null,
          publicUrl: publicUrl ?? first?.url ?? null,
          error: null,
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
      );
    }

    if (state === "failed") {
      return new Response(
        JSON.stringify({
          status: "failed",
          progress: 100,
          image_url: null,
          publicUrl: null,
          error: result.err_code ?? "生成失败",
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
      );
    }

    const progress = state === "queueing" ? 10 : state === "processing" ? 50 : 5;
    return new Response(
      JSON.stringify({
        status: state,
        progress,
        image_url: null,
        publicUrl: null,
        error: null,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: `查询失败: ${msg}` }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
    );
  }
});
