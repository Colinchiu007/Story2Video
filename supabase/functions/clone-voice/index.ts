import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface CloneVoiceRequest {
  name: string;
  description?: string;
  audioUrl: string;
  language?: string;
  duration?: number;
  noiseReduce?: boolean;
  volumeNormalize?: boolean;
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function getLanguageCode(lang: string): number {
  const lower = (lang ?? "").toLowerCase();
  if (lower.includes("en")) return 1; // English
  return 0; // Chinese (default)
}

function getSupabaseClient(userJwt: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  return createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${userJwt}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Background task: download audio, call Doubao API, update DB.
 * This runs AFTER the HTTP response has been sent.
 */
async function processCloneInBackground(
  userJwt: string,
  voiceRecordId: string,
  voiceBody: CloneVoiceRequest,
  apiKey: string,
) {
  const supabase = getSupabaseClient(userJwt);

  try {
    // Step 1: Download audio file from Supabase Storage URL
    const audioResp = await fetch(voiceBody.audioUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; VideoCreator/1.0)",
      },
    });
    if (!audioResp.ok) {
      throw new Error(`下载音频失败: ${audioResp.status} ${audioResp.statusText}`);
    }
    const audioBlob = await audioResp.blob();

    // Validate audio size (max 10MB for Doubao voice clone)
    const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
    if (audioBlob.size > MAX_AUDIO_BYTES) {
      throw new Error(`音频文件过大: ${(audioBlob.size / 1024 / 1024).toFixed(1)} MB，上限 10 MB`);
    }

    // Step 2: Convert audio blob to base64 (safe chunked to avoid stack overflow)
    const arrayBuffer = await audioBlob.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);
    const chunkSize = 8192; // 8KB chunks — safe for String.fromCharCode arg limit
    let base64Audio = "";
    for (let i = 0; i < uint8.length; i += chunkSize) {
      const slice = uint8.slice(i, i + chunkSize);
      base64Audio += btoa(String.fromCharCode(...slice));
    }

    // Detect format from blob type or fallback to wav
    let audioFormat = "wav";
    if (audioBlob.type.includes("mp3") || audioBlob.type.includes("mpeg")) audioFormat = "mp3";
    else if (audioBlob.type.includes("m4a") || audioBlob.type.includes("mp4")) audioFormat = "m4a";
    else if (audioBlob.type.includes("ogg")) audioFormat = "ogg";
    else if (audioBlob.type.includes("aac")) audioFormat = "aac";

    // Step 3: Call Doubao voice_clone V3 API
    const speakerId = `S_${voiceRecordId.replace(/-/g, "_")}`;
    const requestId = crypto.randomUUID().replace(/-/g, "");
    const languageCode = getLanguageCode(voiceBody.language ?? "Chinese");

    const extraParams: Record<string, unknown> = {};
    if (voiceBody.noiseReduce !== undefined) {
      extraParams.enable_audio_denoise = voiceBody.noiseReduce;
    }
    if (voiceBody.volumeNormalize !== undefined) {
      extraParams.disable_volume_normalization = !voiceBody.volumeNormalize;
    }

    const clonePayload = {
      speaker_id: speakerId,
      audio: {
        data: base64Audio,
        format: audioFormat,
      },
      language: languageCode,
      extra_params: extraParams,
    };

    const cloneResp = await fetch("https://openspeech.bytedance.com/api/v3/tts/voice_clone", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "X-Api-Request-Id": requestId,
      },
      body: JSON.stringify(clonePayload),
    });

    const cloneResult = await cloneResp.json();
    const code = cloneResult.code ?? 0;

    if (code !== 3000 && code !== 0) {
      const msg = cloneResult.message ?? `错误码 ${code}`;
      const isResourceMismatch = String(msg).includes("resource ID is mismatched") || code === 55000000;
      let errorMsg: string;
      if (isResourceMismatch) {
        errorMsg = `豆包API错误: ${msg}。您的 API Key 不支持音色克隆(voice_clone)端点。解决方式：1) 如果您已在豆包控制台复制了音色，请在「设置」→「已有豆包音色ID」中填入该音色ID，直接使用即可；2) 如需通过本应用克隆新音色，请在豆包控制台单独开通「音色克隆」服务并获取其专属 API Key。`;
      } else {
        errorMsg = `豆包API错误: ${msg} (code=${code})。请确认 API Key 正确且已开通音色克隆权限。`;
      }
      await supabase.from("user_voices").update({ status: "error", error_message: errorMsg }).eq("id", voiceRecordId);
      console.error(`[clone-voice bg] API error: ${msg}`);
      return;
    }

    const returnedSpeakerId = cloneResult.data?.speaker_id ?? speakerId;
    await supabase
      .from("user_voices")
      .update({ status: "ready", voice_id: returnedSpeakerId })
      .eq("id", voiceRecordId);
    console.log(`[clone-voice bg] Voice ready, speaker_id=${returnedSpeakerId}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[clone-voice bg] Error: ${msg}`);
    try {
      await supabase.from("user_voices").update({ status: "error", error_message: msg }).eq("id", voiceRecordId);
    } catch { /* ignore */ }
  }
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method Not Allowed" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
    );
  }

  // Extract user JWT from request headers
  const authHeader = req.headers.get("Authorization") ?? "";
  const userJwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!userJwt) {
    return new Response(
      JSON.stringify({ error: "请先登录后再使用音色克隆功能" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
    );
  }

  const supabase = getSupabaseClient(userJwt);

  let body: Record<string, unknown>;
  let voiceBody: CloneVoiceRequest;

  try {
    body = await req.json();
    voiceBody = {
      name: body.name as string,
      description: body.description as string | undefined,
      audioUrl: body.audioUrl as string,
      language: (body.language as string) ?? "Chinese",
      duration: body.duration as number | undefined,
      noiseReduce: body.noiseReduce as boolean | undefined,
      volumeNormalize: body.volumeNormalize as boolean | undefined,
    };
    if (!voiceBody.name || !voiceBody.audioUrl) {
      throw new Error("Missing required fields: name, audioUrl");
    }
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid request body" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
    );
  }

  try {
    // Insert record with pending status
    const { data: voiceRecord, error: insertError } = await supabase
      .from("user_voices")
      .insert({
        name: voiceBody.name,
        description: voiceBody.description ?? "",
        sample_audio_url: voiceBody.audioUrl,
        status: "pending",
        duration_seconds: voiceBody.duration ?? null,
        language: voiceBody.language ?? "Chinese",
      })
      .select()
      .single();

    if (insertError || !voiceRecord) {
      throw new Error(`数据库错误: ${insertError?.message ?? "unknown"}`);
    }

    // Doubao API key from request body or env fallback
    const userApiKey = (body.doubao_api_key as string) ?? "";
    const envApiKey = Deno.env.get("INTEGRATIONS_API_KEY") ?? "";
    const apiKey = userApiKey || envApiKey;

    if (!apiKey) {
      await supabase.from("user_voices").update({ status: "error" }).eq("id", voiceRecord.id);
      return new Response(
        JSON.stringify({ error: "未配置豆包语音 API Key，请在设置中填写" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
      );
    }

    // Start background processing — do NOT await, return immediately
    const bgPromise = processCloneInBackground(userJwt, voiceRecord.id, voiceBody, apiKey);

    // Use EdgeRuntime.waitUntil to keep the background task alive after response
    // @ts-ignore — EdgeRuntime is provided by Deno Deploy runtime
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(bgPromise);
    }

    // Return immediately — the heavy work continues in background
    return new Response(
      JSON.stringify({
        id: voiceRecord.id,
        status: "pending",
        message: "音色克隆已提交，正在后台处理中，请稍后在我的音色列表中查看状态",
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ status: "error", message: `请求失败: ${msg}` }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
    );
  }
});
