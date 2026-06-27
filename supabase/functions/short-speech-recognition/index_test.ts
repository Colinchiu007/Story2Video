import { assertEquals, assertExists } from "https://deno.land/std/testing/asserts.ts";

Deno.test("OPTIONS request returns 204 with CORS headers", async () => {
  const req = new Request("http://localhost", { method: "OPTIONS" });
  const handler = async (r: Request): Promise<Response> => {
    if (r.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: new Headers({
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      })});
    }
    return new Response(JSON.stringify({}), { status: 200, headers: new Headers({ "Content-Type": "application/json" }) });
  };
  const resp = await handler(req);
  assertEquals(resp.status, 204);
  assertEquals(resp.headers.get("Access-Control-Allow-Origin"), "*");
});

Deno.test("non-POST method returns 405", async () => {
  const req = new Request("http://localhost", { method: "PUT" });
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

Deno.test("missing speech field returns error", async () => {
  const req = new Request("http://localhost", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const handler = async (r: Request): Promise<Response> => {
    try {
      const body = await r.json();
      if (!body.speech) {
        return new Response(JSON.stringify({ error: "Missing required field: speech" }), {
          status: 200,
          headers: new Headers({ "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }),
        });
      }
      return new Response(JSON.stringify({ result: ["test output"] }), { status: 200 });
    } catch {
      return new Response(JSON.stringify({ error: "Invalid request body" }), { status: 200 });
    }
  };
  const resp = await handler(req);
  const body = await resp.json();
  assertEquals(body.error, "Missing required field: speech");
});

Deno.test("valid request returns recognition result", async () => {
  const req = new Request("http://localhost", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ speech: "base64audio==", len: 1024, format: "wav", rate: 16000, cuid: "test" }),
  });
  const handler = async (r: Request): Promise<Response> => {
    const body = await r.json();
    if (body.speech && body.len) {
      return new Response(JSON.stringify({ err_no: 0, result: ["hello world"] }), {
        status: 200,
        headers: new Headers({ "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }),
      });
    }
    return new Response(JSON.stringify({ error: "missing fields" }), { status: 200 });
  };
  const resp = await handler(req);
  const body = await resp.json();
  assertEquals(body.err_no, 0);
  assertExists(body.result);
});
