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
    "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
  };
}

/**
 * Estimate audio duration from text length when API does not return duration.
 * Chinese: ~4 chars/sec at normal speed
 * English: ~3.5 words/sec at normal speed
 * Mixed: weighted average
 */
function estimateAudioDuration(text: string, speedFactor = 1.0): number {
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
  const otherChars = text.length - chineseChars - englishWords;
  const baseSeconds = chineseChars / 4.0 + englishWords / 3.5 + otherChars / 6.0;
  return Math.max(1, Math.round(baseSeconds / speedFactor));
}

function parseAppidToken(apiKey: string): { appid: string; token: string } {
  // Try common separators: dot, colon, dash
  for (const sep of [".", ":", "-"]) {
    const idx = apiKey.indexOf(sep);
    if (idx > 0 && idx < apiKey.length - 1) {
      return { appid: apiKey.slice(0, idx), token: apiKey.slice(idx + 1) };
    }
  }
  // Fallback: use the whole key as both appid and token
  return { appid: apiKey, token: apiKey };
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

  let body: Record<string, unknown>;
  let text: string;
  let voiceId: string;
  let speed: number | undefined;
  let vol: number | undefined;
  let pitch: number | undefined;
  let emotion: string | undefined;
  let cluster: string | undefined;

  try {
    body = await req.json();
    text = body.text as string;
    if (!text) throw new Error("Missing text");
    voiceId = (body.voice_id as string) ?? "zh_female_qingxinnvsheng_uranus_bigtts";
    speed = body.speed as number | undefined;
    vol = body.vol as number | undefined;
    pitch = body.pitch as number | undefined;
    emotion = body.emotion as string | undefined;
    cluster = body.cluster as string | undefined;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders() },
    });
  }

  // Doubao API key from request body (user-provided) or env fallback
  const userApiKey = (body.doubao_api_key as string) ?? "";
  const envApiKey = Deno.env.get("INTEGRATIONS_API_KEY") ?? "";
  const apiKey = userApiKey || envApiKey;

  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "未配置豆包语音 API Key，请在设置中填写" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
    );
  }

  const { appid, token } = parseAppidToken(apiKey);
  const reqid = crypto.randomUUID().replace(/-/g, "");

  // Build Doubao V1 HTTP TTS request
  const audioParams: Record<string, unknown> = {
    voice_type: voiceId,
    encoding: "mp3",
  };
  if (speed !== undefined) audioParams.speed_ratio = speed;
  if (vol !== undefined) audioParams.loudness_ratio = vol;
  if (emotion && emotion !== "default") audioParams.emotion = emotion;

  const requestBody = {
    app: {
      appid: appid,
      token: "fake",
      cluster: cluster ?? "volcano_tts",
    },
    user: { uid: "user" },
    audio: audioParams,
    request: {
      reqid: reqid,
      text: text,
      operation: "query",
    },
  };

  const upstream = await fetch("https://openspeech.bytedance.com/api/v1/tts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer;${token}`,
      "X-Api-Key": apiKey,
      "X-Api-Request-Id": reqid,
    },
    body: JSON.stringify(requestBody),
  });

  if (!upstream.ok) {
    const errText = await upstream.text();
    return new Response(
      JSON.stringify({ error: `豆包语音合成失败 (${upstream.status}): ${errText}` }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
    );
  }

  const result = await upstream.json();
  const code = result.code ?? result.base_resp?.status_code ?? 0;

  if (code !== 3000 && code !== 0) {
    const msg = result.message ?? result.base_resp?.status_msg ?? `错误码 ${code}`;
    return new Response(
      JSON.stringify({ error: `豆包语音合成失败: ${msg}` }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
    );
  }

  const audioBase64 = result.data as string | undefined;
  if (!audioBase64) {
    return new Response(
      JSON.stringify({ error: "豆包语音合成未返回音频数据" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
    );
  }

  // Decode base64 and upload to Supabase Storage
  try {
    const binaryData = Uint8Array.from(atob(audioBase64), (c) => c.charCodeAt(0));
    const filePath = `uploads/${crypto.randomUUID()}.mp3`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("generated-audio")
      .upload(filePath, binaryData, {
        contentType: "audio/mpeg",
        cacheControl: "no-cache",
        upsert: false,
      });
    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage.from("generated-audio").getPublicUrl(filePath);
    const durationMs = result.addition?.duration ? parseInt(String(result.addition.duration)) : 0;
    const audioLength = durationMs > 0 ? Math.round(durationMs / 1000) : estimateAudioDuration(text, speed ?? 1.0);

    return new Response(
      JSON.stringify({
        audioUrl: urlData.publicUrl,
        audioLength,
        traceId: reqid,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: `音频存储失败: ${msg}` }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
    );
  }
});
