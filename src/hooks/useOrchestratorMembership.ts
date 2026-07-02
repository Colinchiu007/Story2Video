import { useState, useCallback, useEffect, useRef } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────

export interface OrchestratorMembership {
  plan_type: 'free' | 'basic' | 'pro' | 'enterprise';
  features: string[];
  status: string;
  start_date: string | null;
  end_date: string | null;
}

export interface OrchestratorUsage {
  videos_used: number;
  videos_quota: number;
  reset_time: string;
  plan_type: string;
  date: string;
}

export interface UseOrchestratorMembershipReturn {
  membership: OrchestratorMembership | null;
  usage: OrchestratorUsage | null;
  loading: boolean;
  error: string | null;
  /** Whether an orchestrator account has been registered for this user */
  isRegistered: boolean;
  /** Manually refresh membership + usage data */
  refresh: () => void;
}

// ── Token & Credential Management ─────────────────────────────────────────

const MEMBERSHIP_PW_PREFIX = 's2v-mem-';

const LS_TOKEN = 'orchestrator_membership_token';
const LS_MEMBERSHIP_CACHE = 'orchestrator_membership_cache';
const LS_USAGE_CACHE = 'orchestrator_usage_cache';

interface TokenStore {
  access_token: string;
  refresh_token: string;
  /** Unix seconds — when the access_token expires */
  expires_at: number;
}

function _baseUrl(): string {
  return (
    localStorage.getItem('orchestrator_url') ||
    import.meta.env.VITE_ORCHESTRATOR_URL ||
    '/api'
  );
}

function _loadToken(): TokenStore | null {
  try {
    const raw = localStorage.getItem(LS_TOKEN);
    if (!raw) return null;
    const t: TokenStore = JSON.parse(raw);
    if (t.expires_at > Math.floor(Date.now() / 1000)) return t;
    // Expired — will try refresh flow later
    return t;
  } catch {
    return null;
  }
}

function _saveToken(t: TokenStore) {
  localStorage.setItem(LS_TOKEN, JSON.stringify(t));
}

function _clearToken() {
  localStorage.removeItem(LS_TOKEN);
}

function _deriveUsername(supabaseUserId: string): string {
  return `s2v_${supabaseUserId.slice(0, 8)}`;
}

function _derivePassword(supabaseUserId: string): string {
  return MEMBERSHIP_PW_PREFIX + supabaseUserId;
}

// ── API helpers ────────────────────────────────────────────────────────────

async function _apiFetch<T>(
  path: string,
  options?: { method?: string; body?: unknown; token?: string },
): Promise<{ ok: boolean; status: number; data?: T; text?: string }> {
  const url = _baseUrl() + path;
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
    return { ok: false, status: 0, text: err instanceof Error ? err.message : '网络错误' };
  }
}

// ── Hook ───────────────────────────────────────────────────────────────────

/**
 * Fetch membership and usage data from the platform-orchestrator.
 *
 * Lazy-registers a shadow account on first use via deterministic credentials
 * derived from the Supabase user ID. Stores the JWT in localStorage.
 * Gracefully degrades to null when orchestrator is unreachable.
 */
export function useOrchestratorMembership(
  supabaseUserId: string | null,
  { enabled = true }: { enabled?: boolean } = {},
): UseOrchestratorMembershipReturn {
  const [membership, setMembership] = useState<OrchestratorMembership | null>(null);
  const [usage, setUsage] = useState<OrchestratorUsage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const fetchingRef = useRef(false);
  const mountedRef = useRef(true);

  // ── Token lifecycle ──────────────────────────────────────────────────

  /** Retrieve or re-establish a valid access token. Returns null when impossible. */
  const ensureToken = useCallback(async (): Promise<string | null> => {
    if (!supabaseUserId) return null;

    // 1. Valid existing token
    const existing = _loadToken();
    if (existing && existing.expires_at > Math.floor(Date.now() / 1000)) {
      return existing.access_token;
    }

    // 2. Refresh expired token
    if (existing?.refresh_token) {
      const resp = await _apiFetch<{ access_token: string; token_type: string }>(
        '/api/auth/refresh',
        { method: 'POST', body: { refresh_token: existing.refresh_token } },
      );
      if (resp.ok && resp.data?.access_token) {
        const updated: TokenStore = {
          access_token: resp.data.access_token,
          refresh_token: existing.refresh_token,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
        };
        _saveToken(updated);
        return updated.access_token;
      }
      _clearToken();
    }

    // 3. Login with deterministic credentials
    const username = _deriveUsername(supabaseUserId);
    const password = _derivePassword(supabaseUserId);

    const loginResp = await _apiFetch<{
      access_token: string;
      refresh_token: string;
      expires_in: number;
    }>('/api/auth/login', { method: 'POST', body: { username, password } });

    if (loginResp.ok && loginResp.data?.access_token) {
      const d = loginResp.data;
      _saveToken({
        access_token: d.access_token,
        refresh_token: d.refresh_token,
        expires_at: Math.floor(Date.now() / 1000) + d.expires_in,
      });
      setIsRegistered(true);
      return d.access_token;
    }

    // 4. Login failed — register then login again
    const email = `${supabaseUserId.slice(0, 16)}@s2v.local`;
    const regResp = await _apiFetch('/api/auth/register', {
      method: 'POST',
      body: { username, email, password },
    });

    if (!regResp.ok) {
      // 409 = already exists but password mismatch (shouldn't happen)
      return null;
    }

    const login2Resp = await _apiFetch<{
      access_token: string;
      refresh_token: string;
      expires_in: number;
    }>('/api/auth/login', { method: 'POST', body: { username, password } });

    if (!login2Resp.ok) return null;

    const d2 = login2Resp.data!;
    _saveToken({
      access_token: d2.access_token,
      refresh_token: d2.refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + d2.expires_in,
    });
    setIsRegistered(true);
    return d2.access_token;
  }, [supabaseUserId]);

  // ── Data fetch ───────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    if (!supabaseUserId || !enabled) return;
    if (fetchingRef.current) return;

    fetchingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const token = await ensureToken();
      if (!token) {
        setMembership(null);
        setUsage(null);
        setLoading(false);
        fetchingRef.current = false;
        return;
      }

      const [subResp, usageResp] = await Promise.all([
        _apiFetch<OrchestratorMembership>('/api/auth/subscription', { token }),
        _apiFetch<OrchestratorUsage>('/api/user/usage', { token }),
      ]);

      if (subResp.ok && subResp.data) {
        setMembership(subResp.data);
        localStorage.setItem(LS_MEMBERSHIP_CACHE, JSON.stringify(subResp.data));
      } else if (subResp.status === 401) {
        _clearToken();
      }

      if (usageResp.ok && usageResp.data) {
        setUsage(usageResp.data);
        localStorage.setItem(LS_USAGE_CACHE, JSON.stringify(usageResp.data));
      } else if (usageResp.status === 401) {
        _clearToken();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '获取会员信息失败';
      setError(msg);
    } finally {
      if (mountedRef.current) setLoading(false);
      fetchingRef.current = false;
    }
  }, [supabaseUserId, enabled, ensureToken]);

  // ── Init / Refresh ───────────────────────────────────────────────────

  useEffect(() => {
    if (!supabaseUserId || !enabled) {
      setMembership(null);
      setUsage(null);
      return;
    }

    // Stale-while-revalidate: show cached data instantly
    const cachedMembership = localStorage.getItem(LS_MEMBERSHIP_CACHE);
    if (cachedMembership) {
      try { setMembership(JSON.parse(cachedMembership)); } catch { /* ignore */ }
    }
    const cachedUsage = localStorage.getItem(LS_USAGE_CACHE);
    if (cachedUsage) {
      try { setUsage(JSON.parse(cachedUsage)); } catch { /* ignore */ }
    }

    fetchData();
    return () => { mountedRef.current = false; };
  }, [supabaseUserId, enabled, fetchData]);

  const refresh = useCallback(() => {
    mountedRef.current = true;
    fetchData();
  }, [fetchData]);

  return { membership, usage, loading, error, isRegistered, refresh };
}
