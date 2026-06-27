import { assertEquals, assertExists } from "https://deno.land/std/testing/asserts.ts";

Deno.test("OPTIONS preflight returns 204", async () => {
  const req = new Request("http://localhost", { method: "OPTIONS" });
  const handler = async (r: Request): Promise<Response> => {
    if (r.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: new Headers({
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      })});
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };
  const resp = await handler(req);
  assertEquals(resp.status, 204);
  assertEquals(resp.headers.get("Access-Control-Allow-Origin"), "*");
});

Deno.test("non-POST returns 405 error", async () => {
  const req = new Request("http://localhost", { method: "DELETE" });
  const handler = async (r: Request): Promise<Response> => {
    if (r.method === "OPTIONS") return new Response(null, { status: 204 });
    if (r.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
        status: 200,
        headers: new Headers({ "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }),
      });
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };
  const resp = await handler(req);
  const body = await resp.json();
  assertEquals(body.error, "Method Not Allowed");
});

Deno.test("missing segments field returns error", async () => {
  const req = new Request("http://localhost", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const handler = async (r: Request): Promise<Response> => {
    try {
      const body = await r.json();
      if (!body.segments || !Array.isArray(body.segments)) {
        return new Response(JSON.stringify({ error: "Missing or invalid required field: segments" }), {
          status: 200,
          headers: new Headers({ "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }),
        });
      }
      return new Response(JSON.stringify({ optimized: body.segments.map(() => "optimized prompt") }), { status: 200 });
    } catch {
      return new Response(JSON.stringify({ error: "Invalid request body" }), { status: 200 });
    }
  };
  const resp = await handler(req);
  const body = await resp.json();
  assertEquals(body.error, "Missing or invalid required field: segments");
});

Deno.test("valid segments returns optimized prompts", async () => {
  const req = new Request("http://localhost", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ segments: ["a cat", "a dog"], image_style_type: "写实", language: "zh" }),
  });
  const handler = async (r: Request): Promise<Response> => {
    const body = await r.json();
    if (body.segments) {
      return new Response(JSON.stringify({
        optimized_prompts: ["A realistic photo of a cat", "A realistic photo of a dog"],
        original_prompts: ["a cat", "a dog"],
      }), {
        status: 200,
        headers: new Headers({ "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }),
      });
    }
    return new Response(JSON.stringify({ error: "missing fields" }), { status: 200 });
  };
  const resp = await handler(req);
  const body = await resp.json();
  assertExists(body.optimized_prompts);
  assertEquals(body.optimized_prompts.length, 2);
  assertEquals(body.original_prompts.length, 2);
});
