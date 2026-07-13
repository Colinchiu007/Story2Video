import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// 自定义 fetch 适配器：兼容 Miaoda 代理路径和 Supabase 连接
let noticed = false;
const customFetch = async (
  input: string | Request | URL,
  init?: RequestInit
): Promise<Response> => {
  let url = String(input);
  const urlParts = new URL(url);
  const hostname = String(urlParts.hostname);

  // 历史 supabase 域名兼容：非标准域名路径时降级为相对路径
  if (
    !hostname.includes("backend.") &&
    !hostname.includes(".supabase.co") &&
    import.meta.env.VITE_SUPABASE_PROXY !== "false"
  ) {
    url = urlParts.pathname + urlParts.search;
    // 非 Baidu/Miaoda 托管环境时替换路径前缀
    if (
      !/((bce|console).*.baidu.*\.com)$|(\.)?miaoda\.(cn|io)$/.test(
        document.location.hostname
      )
    ) {
      url = url.replace(
        /(\/miaoda([-\w]+)?)\/(backend|supabase)/,
        "$1/runtime$3"
      );
    }
  }

  let response = await fetch(url, init);
  try {
    const arrayBuffer = await response.clone().arrayBuffer();
    const cachedResponse = new Response(arrayBuffer, response);

    if (!response.ok) {
      let errorData: Record<string, unknown>;
      try {
        errorData = await cachedResponse.json();
      } catch {
        errorData = {
          message: "服务端报错",
          status: response.status,
        };
      }
      const tip =
        (errorData.message as string) ||
        (errorData.msg as string) ||
        "服务端报错";
      if (errorData.code === "SupabaseNotReady" && !noticed) {
        noticed = true;
        try {
          const { toast } = await import("sonner");
          toast.error(tip);
        } catch {
          alert(tip);
        }
      }
    }
  } catch {
    // ignore fetch-level errors (handled by caller)
  }
  return response;
};

// btoa the URL to create a stable auth storage key
const storageKeySuffix = btoa(supabaseUrl).replace(/[^a-zA-Z0-9]/g, "");

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: customFetch,
  },
  auth: {
    storageKey: "sb-" + storageKeySuffix + "-auth-token",
  },
});