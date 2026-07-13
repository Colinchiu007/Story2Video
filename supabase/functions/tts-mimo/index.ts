import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseAdmin = createClient(
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

function jsonError(msg: string, status = 200): Response {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

function jsonOk(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function isRetryable(status: number): boolean {
  return status === 429 || (status >= 500 && status <= 599);
}

function estimateAudioDuration(text: string, speedFactor = 1.0): number {
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
  const otherChars = text.length - chineseChars - englishWords;
  const baseSeconds = chineseChars / 4.0 + englishWords / 3.5 + otherChars / 6.0;
  return Math.max(1, Math.round(baseSeconds / speedFactor));
}

function uint8ToBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(bin);
}

interface TtsMimoRequest {
  text: string;
  model?: "mimo-v2.5-tts" | "mimo-v2.5-tts-voiceclone";
  format?: "wav" | "mp3" | "pcm16";
  voice?: string;
  voice_record_id?: string;
  speed?: number;
  mimo_api_key?: string;
}

async function resolveVoiceFromRecord(
  userJwt: string,
  voiceRecordId: string,
): Promise<{ resolvedVoice: string; provider: string }> {
  const user = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    {
      global: { headers: { Authorization: `Bearer ${userJwt}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );

  const { data: rec, error } = await user
    .from("user_voices")
    .select("sample_audio_url")
    .eq("id", voiceRecordId)
    .single();

  if (error || !rec) {
    throw new Error(`未找到音色记录(${voiceRecordId}): ${error?.message ?? "unknown"}`);
  }

  const audioResp = await fetch(rec.sample_audio_url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; VideoCreator/1.0)" },
  });
  if (!audioResp.ok) {
    throw new Error(`下载音频样本失败: ${audioResp.status} ${audioResp.statusText}`);
  }
  const blob = await audioResp.blob();

  if (blob.size > 10 * 1024 * 1024) {
    throw new Error(
      `音频样本超过 MiMo 10MB 限制（实际 ${(blob.size / 1024 / 1024).toFixed(1)} MB）。请使用更短/更低码率的音频`,
    );
  }

  const ct = (blob.type || "").toLowerCase();
  let mime = "audio/mpeg";
  if (ct.includes("wav")) mime = "audio/wav";
  else if (ct.includes("mpeg") || ct.includes("mp3")) mime = "audio/mpeg";
  else {
    throw new Error(
      `MiMo 仅支持 mp3 / wav 格式（收到 ${ct || "unknown"}）。请转换后再上传`,
    );
  }

  const bytes = new Uint8Array(await blob.arrayBuffer());
  const base64 = uint8ToBase64(bytes);
  return { resolvedVoice: `data:${mime};base64,${base64}`, provider: "mimo" as const };
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (req.method !== "POST") {
    return jsonError("Method Not Allowed", 405);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const userJwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  let body: TtsMimoRequest;
  try {
    body = await req.json() as TtsMimoRequest;
  } catch {
    return jsonError("Invalid request body");
  }

  const text = (body.text ?? "").toString().trim();
  if (!text) return jsonError("Missing text");
  const model: TtsMimoRequest["model"] = body.model ?? "mimo-v2.5-tts-voiceclone";
  if (model !== "mimo-v2.5-tts" && model !== "mimo-v2.5-tts-voiceclone") {
    return jsonError(`Unsupported model: ${model}`);
  }
  const format: TtsMimoRequest["format"] = body.format ?? "wav";
  if (!["wav", "mp3", "pcm16"].includes(format)) {
    return jsonError(`Unsupported format: ${format}`);
  }
  const speed = typeof body.speed === "number" && body.speed > 0 ? body.speed : 1.0;

  const apiKey = (body.mimo_api_key ?? "").trim() || (Deno.env.get("MIMO_API_KEY") ?? "").trim();
  if (!apiKey) {
    return jsonError("未配置 MiMo API Key，请在「设置」→「API设置」→「语音模型」中填写，或部署环境变量 MIMO_API_KEY");
  }

  let resolvedVoice = body.voice ?? "";
  let isClonedFromRecord = false;
  if (body.voice_record_id) {
    if (!userJwt) return jsonError("克隆音色需要登录状态");
    try {
      const r = await resolveVoiceFromRecord(userJwt, body.voice_record_id);
      resolvedVoice = r.resolvedVoice;
      isClonedFromRecord = true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return jsonError(`音色解析失败: ${msg}`);
    }
  }
  if (!resolvedVoice) {
    return jsonError("voice 或 voice_record_id 必须提供一个");
  }

  const messages: Array<{ role: string; content: string }> = [
    { role: "user", content: "" },
    { role: "assistant", content: text },
  ];

  const requestBody = {
    model,
    messages,
    audio: {
      format,
      voice: resolvedVoice,
    },
  };

  // Retry MiMo API call with exponential backoff on 429/5xx
  const maxAttempts = 3;
  let upstream: Response | null = null;
  let rawText = "";
  let lastError = "";

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      upstream = await fetch("https://api.xiaomimimo.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": apiKey,
        },
        body: JSON.stringify(requestBody),
      });
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      if (attempt < maxAttempts - 1) {
        await sleep(Math.min(1000 * Math.pow(2, attempt), 15000));
        continue;
      }
      return jsonError(`MiMo API 调用失败: ${lastError}`);
    }

    rawText = await upstream.text();

    if (isRetryable(upstream.status) && attempt < maxAttempts - 1) {
      // Try to parse retry-after or use exponential backoff
      let retryAfter = Math.min(1000 * Math.pow(2, attempt), 15000);
      const retryHeader = upstream.headers.get("retry-after");
      if (retryHeader) {
        const parsed = parseInt(retryHeader, 10);
        if (!isNaN(parsed) && parsed > 0) retryAfter = Math.min(parsed * 1000, 30000);
      }
      console.log(`[tts-mimo] Retryable ${upstream.status} (attempt ${attempt + 1}/${maxAttempts}), waiting ${retryAfter}ms`);
      await sleep(retryAfter);
      continue;
    }

    break; // Success or non-retryable error
  }

  if (!upstream) {
    return jsonError("MiMo API 调用异常：无响应");
  }

  let result: Record<string, unknown>;
  try {
    result = JSON.parse(rawText);
  } catch {
    return jsonError(`MiMo 返回非JSON（HTTP ${upstream.status}）: ${rawText.slice(0, 200)}`);
  }

  if (!upstream.ok) {
    const errMsg = (result.error as { message?: string })?.message
      ?? (result.message as string)
      ?? `HTTP ${upstream.status}`;
    return jsonError(`MiMo 合成失败: ${errMsg}`);
  }

  const audioB64 = (result.choices as Array<{ message?: { audio?: { data?: string } } }>)?.[0]?.message?.audio?.data;
  if (!audioB64) {
    return jsonError(`MiMo 未返回音频数据: ${rawText.slice(0, 300)}`);
  }

  try {
    const bin = Uint8Array.from(atob(audioB64), (c) => c.charCodeAt(0));
    const ext = format === "mp3" ? "mp3" : (format === "pcm16" ? "pcm" : "wav");
    const filePath = `uploads/${crypto.randomUUID()}.${ext}`;
    const contentType = format === "mp3"
      ? "audio/mpeg"
      : format === "pcm16"
        ? "audio/L16"
        : "audio/wav";

    const { error: uploadError } = await supabaseAdmin.storage
      .from("generated-audio")
      .upload(filePath, bin, {
        contentType,
        cacheControl: "no-cache",
        upsert: false,
      });
    if (uploadError) throw uploadError;

    const { data: urlData } = supabaseAdmin.storage.from("generated-audio").getPublicUrl(filePath);
    const audioLength = estimateAudioDuration(text, speed);

    return jsonOk({
      audioUrl: urlData.publicUrl,
      audioLength,
      provider: "mimo",
      model,
      isClonedFromRecord,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonError(`音频存储失败: ${msg}`);
  }
});