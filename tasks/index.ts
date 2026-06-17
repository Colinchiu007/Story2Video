import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

interface CloneVoiceRequest {
  name: string;
  description?: string;
  audioUrl: string;
  language?: string;
  duration?: number;
}

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
    return new Response(
      JSON.stringify({ error: "Method Not Allowed" }),
      { status: 405, headers: { "Content-Type": "application/json", ...corsHeaders() } },
    );
  }

  let body: CloneVoiceRequest;
  try {
    body = await req.json();
    if (!body.name || !body.audioUrl) {
      throw new Error("Missing required fields: name, audioUrl");
    }
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid request body" }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders() } },
    );
  }

  // Insert record with pending status
  const { data: voiceRecord, error: insertError } = await supabase
    .from("user_voices")
    .insert({
      name: body.name,
      description: body.description ?? "",
      sample_audio_url: body.audioUrl,
      status: "pending",
      duration_seconds: body.duration ?? null,
      language: body.language ?? "Chinese",
    })
    .select()
    .single();

  if (insertError || !voiceRecord) {
    return new Response(
      JSON.stringify({ error: `Database error: ${insertError?.message ?? "unknown"}` }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders() } },
    );
  }

  // Call MiniMax voice clone API
  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    await supabase.from("user_voices").update({ status: "error" }).eq("id", voiceRecord.id);
    return new Response(
      JSON.stringify({ error: "Server configuration error: missing API key" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders() } },
    );
  }

  try {
    const upstream = await fetch(
      "https://app-bmyoogysfs3l-api-DLEO7Bj0lORa-gateway.appmiaoda.com/v1/voice_clone",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Gateway-Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          voice_id: `user_${voiceRecord.id.replace(/-/g, "_")}`,
          audio_url: body.audioUrl,
          name: body.name,
          language: body.language ?? "Chinese",
        }),
      },
    );

    const result = await upstream.json();

    // Handle permission error
    if (result.base_resp?.status_code === 2038) {
      await supabase.from("user_voices").update({ status: "forbidden" }).eq("id", voiceRecord.id);
      return new Response(
        JSON.stringify({
          id: voiceRecord.id,
          status: "forbidden",
          message:
            "当前 MiniMax 账号未开通音色克隆权限。请前往 MiniMax 开放平台 (platform.minimaxi.com) 完成实名认证后使用。",
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
      );
    }

    // Handle other API errors
    if (result.base_resp?.status_code !== 0) {
      await supabase
        .from("user_voices")
        .update({ status: "error" })
        .eq("id", voiceRecord.id);
      return new Response(
        JSON.stringify({
          id: voiceRecord.id,
          status: "error",
          message: `MiniMax API 错误 ${result.base_resp?.status_code}: ${result.base_resp?.status_msg}`,
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
      );
    }

    // Success
    const voiceId = result.voice_id ?? `user_${voiceRecord.id.replace(/-/g, "_")}`;
    await supabase
      .from("user_voices")
      .update({ status: "ready", voice_id: voiceId })
      .eq("id", voiceRecord.id);

    return new Response(
      JSON.stringify({
        id: voiceRecord.id,
        status: "ready",
        voiceId,
        demoAudio: result.demo_audio ?? "",
        message: "音色克隆成功",
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await supabase.from("user_voices").update({ status: "error" }).eq("id", voiceRecord.id);
    return new Response(
      JSON.stringify({ id: voiceRecord.id, status: "error", message: `请求失败: ${msg}` }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
    );
  }
});
