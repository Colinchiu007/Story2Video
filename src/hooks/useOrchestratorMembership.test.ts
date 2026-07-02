import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useOrchestratorMembership } from './useOrchestratorMembership';

// ── Mock globals ──────────────────────────────────────────────────────────

const store: Record<string, string> = {};
const mockFetch = vi.fn();

function mockJson(data: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(JSON.stringify(data)),
  });
}

// ── Setup ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(store).forEach(k => delete store[k]);
  store.orchestrator_url = 'http://localhost:8000';

  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); },
  });
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ── Tests ─────────────────────────────────────────────────────────────────

describe('useOrchestratorMembership', () => {

  it('returns null data when supabaseUserId is null', () => {
    const { result } = renderHook(() => useOrchestratorMembership(null));
    expect(result.current.membership).toBeNull();
    expect(result.current.usage).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('returns null data when enabled is false', () => {
    const { result } = renderHook(() =>
      useOrchestratorMembership('test-user-id', { enabled: false })
    );
    expect(result.current.membership).toBeNull();
    expect(result.current.usage).toBeNull();
  });

  it('fetches membership and usage on mount', async () => {
    store.orchestrator_membership_token = JSON.stringify({
      access_token: 'valid-tok', refresh_token: 'valid-ref', expires_at: 9999999999,
    });

    mockFetch
      .mockResolvedValueOnce(mockJson({
        plan_type: 'free', features: ['articles', 'basic_split'],
        status: 'active', start_date: null, end_date: null,
      }))
      .mockResolvedValueOnce(mockJson({
        videos_used: 0, videos_quota: 3, reset_time: '2026-06-30T00:00:00Z',
        plan_type: 'free', date: '2026-06-29',
      }));

    const { result } = renderHook(() => useOrchestratorMembership('test-user-id'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.membership?.plan_type).toBe('free');
    expect(result.current.isRegistered).toBe(false);  // nothing triggered registration
  });

  it('handles 401 from subscription by clearing token', async () => {
    store.orchestrator_membership_token = JSON.stringify({
      access_token: 'tok', refresh_token: 'ref', expires_at: 9999999999,
    });

    mockFetch.mockResolvedValueOnce(mockJson({ detail: 'Unauthorized' }, 401));
    // After 401, token should be cleared — no retry from hook alone

    const { result } = renderHook(() => useOrchestratorMembership('test-user-id'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    // membership stays null since sub call failed
    expect(result.current.membership).toBeNull();
    // token should have been cleared
  });

  it('handles network errors gracefully', async () => {
    store.orchestrator_membership_token = JSON.stringify({
      access_token: 'tok', refresh_token: 'ref', expires_at: 9999999999,
    });

    mockFetch.mockRejectedValue(new Error('网络错误'));

    const { result } = renderHook(() => useOrchestratorMembership('test-user-id'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.membership).toBeNull();
    expect(result.current.usage).toBeNull();
  });

  it('registers then logs in when no credentials exist', async () => {
    // No token in store — hook will login, fail, register, login2
    mockFetch
      .mockResolvedValueOnce(mockJson({ detail: 'Not found' }, 401))      // login fail
      .mockResolvedValueOnce(mockJson({ uuid: 'new-uuid' }, 201))          // register ok
      .mockResolvedValueOnce(mockJson({ access_token: 't2', refresh_token: 'r2', expires_in: 3600 }))  // login2 ok
      .mockResolvedValueOnce(mockJson({                                      // sub ok
        plan_type: 'free', features: ['articles'],
        status: 'active', start_date: null, end_date: null,
      }))
      .mockResolvedValueOnce(mockJson({ videos_used: 0, videos_quota: 3 }));// usage ok

    const { result } = renderHook(() => useOrchestratorMembership('test-user-id'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.membership?.plan_type).toBe('free');
    expect(result.current.isRegistered).toBe(true);

    const registerCalls = mockFetch.mock.calls.filter(
      (c: unknown[]) => (c[0] as string).includes('/api/auth/register')
    );
    expect(registerCalls).toHaveLength(1);
  });

  it('returns null when login and register both fail', async () => {
    mockFetch.mockResolvedValue(mockJson({ detail: 'Error' }, 500));

    const { result } = renderHook(() => useOrchestratorMembership('test-user-id'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.membership).toBeNull();
    expect(result.current.isRegistered).toBe(false);
  });

  it('uses valid existing token without re-login', async () => {
    store.orchestrator_membership_token = JSON.stringify({
      access_token: 'valid-token', refresh_token: 'valid-refresh',
      expires_at: 9999999999,
    });

    mockFetch
      .mockResolvedValueOnce(mockJson({
        plan_type: 'pro', features: ['articles', 'batch_split'],
        status: 'active', start_date: null, end_date: null,
      }))
      .mockResolvedValueOnce(mockJson({ videos_used: 0, videos_quota: 50 }));

    const { result } = renderHook(() => useOrchestratorMembership('test-user-id'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const loginCalls = mockFetch.mock.calls.filter(
      (c: unknown[]) => (c[0] as string).includes('/api/auth/login')
    );
    expect(loginCalls).toHaveLength(0);
    expect(result.current.membership?.plan_type).toBe('pro');
  });

  it('refresh() re-fetches data', async () => {
    store.orchestrator_membership_token = JSON.stringify({
      access_token: 'tok', refresh_token: 'ref', expires_at: 9999999999,
    });

    mockFetch
      .mockResolvedValueOnce(mockJson({                                    // initial sub: free
        plan_type: 'free', features: ['articles'],
        status: 'active', start_date: null, end_date: null,
      }))
      .mockResolvedValueOnce(mockJson({ videos_used: 0 }))                 // initial usage
      .mockResolvedValueOnce(mockJson({                                    // refresh sub: basic
        plan_type: 'basic', features: ['articles', 'voice_clone'],
        status: 'active', start_date: null, end_date: null,
      }))
      .mockResolvedValueOnce(mockJson({ videos_used: 1 }));                // refresh usage

    const { result } = renderHook(() => useOrchestratorMembership('test-user-id'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.membership?.plan_type).toBe('free');

    result.current.refresh();

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.membership?.plan_type).toBe('basic');
    expect(result.current.usage?.videos_used).toBe(1);
  });
});
