import { supabase } from '@/db/supabase';

// ── Platform registry ────────────────────────────────────────────────────────

export type Platform = 'bilibili' | 'douyin' | 'xiaohongshu' | 'tencent_video';

export interface PlatformMeta {
  key: Platform;
  label: string;
  desc: string;
  disabled?: boolean;
  comingSoon?: boolean;
}

export const PLATFORMS: PlatformMeta[] = [
  { key: 'bilibili', label: 'B站', desc: 'bilibili.com' },
  { key: 'douyin', label: '抖音', desc: 'douyin.com' },
  { key: 'xiaohongshu', label: '小红书', desc: 'xiaohongshu.com' },
  { key: 'tencent_video', label: '视频号', desc: 'WeChat Channels' },
];

// ── Types ──────────────────────────────────────────────────────────────────

export interface PublishRequest {
  video_url: string;
  title: string;
  platform: Platform;
  desc?: string;
  tags?: string[];
  cover_url?: string;
  scheduled_at?: string;
}

export interface PublishTask {
  task_id: string;
  status: string;
  platform: string;
  title: string;
  output_data?: Record<string, unknown>;
  error?: string;
  created_at?: string;
}

export interface PublishProgress {
  task_id: string;
  status: 'scheduled' | 'pending' | 'downloading' | 'publishing' | 'success' | 'failed';
  platform: string;
  message: string;
  percent: number;
  error?: string;
  output?: Record<string, unknown>;
}

// ── Token & Credential Management ─────────────────────────────────────────

const LS_TOKEN = 'orchestrator_membership_token';

interface TokenStore {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

function baseUrl(): string {
  return (
    localStorage.getItem('orchestrator_url') ||
    import.meta.env.VITE_ORCHESTRATOR_URL ||
    '/api'
  );
}

function loadToken(): TokenStore | null {
  try {
    const raw = localStorage.getItem(LS_TOKEN);
    if (!raw) return null;
    const t: TokenStore = JSON.parse(raw);
    if (t.expires_at > Math.floor(Date.now() / 1000)) return t;
    return t;
  } catch {
    return null;
  }
}

function deriveUsername(supabaseUserId: string): string {
  return `s2v_${supabaseUserId.slice(0, 8)}`;
}

function derivePassword(supabaseUserId: string): string {
  return 's2v-mem-' + supabaseUserId;
}

// ── API helpers ────────────────────────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  options?: { method?: string; body?: unknown; token?: string },
): Promise<{ ok: boolean; status: number; data?: T; text?: string }> {
  const url = baseUrl() + path;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options?.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }
  try {
    const res = await fetch(url, {
      method: options?.method ?? 'GET',
      headers,
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });
    const text = await res.text();
    if (!res.ok) {
      return { ok: false, status: res.status, text };
    }
    return { ok: true, status: res.status, data: text ? JSON.parse(text) : undefined };
  } catch (err) {
    return { ok: false, status: 0, text: err instanceof Error ? err.message : 'Network error' };
  }
}

// ── Login (SSO, deterministic creds from Supabase user ID) ────────────────

async function ensureLoggedIn(): Promise<string | null> {
  const cached = loadToken();
  if (cached) return cached.access_token;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) return null;

  const username = deriveUsername(user.id);
  const password = derivePassword(user.id);

  // Try login first
  let res = await apiFetch<{ access_token: string; refresh_token: string }>('/api/auth/login', {
    method: 'POST',
    body: { username, password },
  });

  // If login fails, try register
  if (!res.ok && res.status === 401) {
    res = await apiFetch<{ access_token: string; refresh_token: string }>('/api/auth/register', {
      method: 'POST',
      body: { username, password },
    });
  }

  if (!res.ok || !res.data) return null;

  const token: TokenStore = {
    access_token: res.data.access_token,
    refresh_token: res.data.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
  };
  localStorage.setItem(LS_TOKEN, JSON.stringify(token));
  return token.access_token;
}

// ── Publish API ────────────────────────────────────────────────────────────

export async function publishVideo(request: PublishRequest): Promise<{
  success: boolean;
  task_id?: string;
  error?: string;
}> {
  const token = await ensureLoggedIn();
  if (!token) {
    return { success: false, error: '无法登录到 orchestrator，请检查 orchestrator 地址配置' };
  }

  const res = await apiFetch<{ task_id: string; status: string; message: string }>(
    '/api/jobs/publish-video',
    {
      method: 'POST',
      body: {
        video_url: request.video_url,
        title: request.title,
        platform: request.platform,
        desc: request.desc ?? '',
        tags: request.tags ?? [],
        cover_url: request.cover_url ?? undefined,
        scheduled_at: request.scheduled_at ?? undefined,
      },
      token,
    },
  );

  if (!res.ok || !res.data) {
    return { success: false, error: res.text || '发布请求失败' };
  }

  return { success: true, task_id: res.data.task_id };
}

export async function getPublishStatus(task_id: string): Promise<{
  status: string;
  output?: Record<string, unknown>;
  error?: string;
} | null> {
  const token = await ensureLoggedIn();
  if (!token) return null;

  const res = await apiFetch<{
    task_id: string;
    status: string;
    output_data?: Record<string, unknown>;
    error?: string;
  }>(`/api/jobs/publish/${task_id}`, { token });

  if (!res.ok || !res.data) return null;

  return {
    status: res.data.status,
    output: res.data.output_data,
    error: res.data.error,
  };
}

export async function pollPublishStatus(
  task_id: string,
  onProgress?: (progress: PublishProgress) => void,
  intervalMs = 3000,
  maxAttempts = 120,
): Promise<PublishProgress> {
  for (let i = 0; i < maxAttempts; i++) {
    const result = await getPublishStatus(task_id);

    if (!result) {
      const err: PublishProgress = {
        task_id,
        status: 'failed',
        platform: '',
        message: '无法查询发布状态',
        percent: 0,
        error: 'Status query failed',
      };
      onProgress?.(err);
      return err;
    }

    // Map orchestrator status to our progress model
    const output = result.output || {};
    const progress: PublishProgress = {
      task_id,
      status: mapStatus(result.status),
      platform: (output.platform as string) || '',
      message: (output.message as string) || result.status,
      percent: (output.percent as number) || 0,
      error: result.error,
    };

    onProgress?.(progress);

    if (progress.status === 'success' || progress.status === 'failed') {
      return progress;
    }

    await new Promise((r) => setTimeout(r, intervalMs));
  }

  const timeout: PublishProgress = {
    task_id,
    status: 'failed',
    platform: '',
    message: '发布超时',
    percent: 0,
    error: 'Polling timeout',
  };
  onProgress?.(timeout);
  return timeout;
}

function mapStatus(s: string): PublishProgress['status'] {
  switch (s) {
    case 'scheduled':
      return 'scheduled';
    case 'pending':
    case 'queued':
      return 'pending';
    case 'downloading':
      return 'downloading';
    case 'processing':
    case 'publishing':
      return 'publishing';
    case 'success':
    case 'done':
      return 'success';
    case 'failed':
      return 'failed';
    default:
      return 'pending';
  }
}
