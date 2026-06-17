import { serve } from "https://deno.land/std/http/server.ts";

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

interface ChatCompletionChunk {
  id: string;
  choices: Array<{
    index: number;
    delta: { role?: string; content?: string };
    finish_reason: string | null;
    flag: number;
  }>;
}

async function callLLM(
  messages: Array<{ role: string; content: string }>
): Promise<string> {
  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    throw new Error("Server configuration error: missing API key");
  }

  const response = await fetch(
    "https://app-bmyoogysfs3l-api-zYkZz8qovQ1L-gateway.appmiaoda.com/v2/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ messages, enable_thinking: false }),
    }
  );

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
  if (!response.body) throw new Error("No response body");

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf8");
  let fullContent = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const raw = line.slice(6).trim();
      if (raw === "[DONE]") break;
      try {
        const chunk: ChatCompletionChunk = JSON.parse(raw);
        const delta = chunk.choices?.[0]?.delta?.content ?? "";
        fullContent += delta;
      } catch {
        // 跳过无法解析的帧
      }
    }
  }

  return fullContent.trim();
}

const DEFAULT_SYSTEM_PROMPT = `你是一个专业的 AI 绘画提示词优化师。你的任务是将用户提供的简短文案片段，转化为适合 AI 绘画模型使用的高质量、详细的中文提示词。

规则：
1. 保留原片段的核心主题和意境
2. 添加摄影/绘画风格描述（如电影级光照、专业摄影、8K分辨率、杰作、极致细节）
3. 添加构图、光影、色彩、氛围等细节
4. 输出必须是纯中文提示词，不要包含英文或解释
5. 每个片段只输出一条优化后的提示词，不要有多余内容
6. 提示词长度控制在 100-300 个中文字符之间
7. 融入电影感元素：如变形宽银幕镜头、胶片颗粒、纪录片风格、真实摄影感
8. 避免 AI 生成痕迹：强调真实照片、raw photo、自然光影、手持摄影感`;

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

  try {
    const body = await req.json();
    const segments: string[] = body.segments || [];
    const text: string = body.text || '';
    const systemPrompt: string = body.systemPrompt || DEFAULT_SYSTEM_PROMPT;

    // 支持单条 text 或批量 segments
    const inputs: string[] = segments.length > 0 ? segments : (text ? [text] : []);
    if (inputs.length === 0) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid text/segments" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
      );
    }

    const optimizedPrompts: string[] = [];
    for (const seg of inputs) {
      const prompt = await callLLM([
        { role: "system", content: systemPrompt },
        { role: "user", content: `请将以下文案优化为英文生图提示词：\n\n"${seg}"` },
      ]);
      optimizedPrompts.push(prompt);
    }

    return new Response(
      JSON.stringify({ prompts: optimizedPrompts, prompt: optimizedPrompts[0] }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
    );
  }
});
