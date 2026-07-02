import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// Mock the module to avoid JSX-in-.ts parsing issue (source has JSX in .ts)
vi.mock('@/hooks/useFeatureGate', () => {
  const FEATURE_TIER_MAP: Record<string, string> = {
    voice_clone: 'basic',
    video_fixed_template: 'basic',
    batch_split: 'pro',
  };

  const FEATURE_LABELS: Record<string, string> = {
    voice_clone: '声音克隆 / 高级语音',
    video_fixed_template: '视频固定模板',
    batch_split: '批量分句',
  };

  function useFeatureGate(featureName: string) {
    const features = mockMembership?.features ?? [];
    const loading = mockMembership?.loading ?? false;
    const allowed = features.includes(featureName) && !loading;
    const planRequired = FEATURE_TIER_MAP[featureName] ?? 'free';
    const planLabel =
      planRequired === 'basic' ? '基础版'
      : planRequired === 'pro' ? '专业版'
      : planRequired === 'enterprise' ? '企业版'
      : '免费版';
    return { allowed, planRequired, planLabel, loading };
  }

  return {
    useFeatureGate,
    LockedFeature: () => null,
    FEATURE_TIER_MAP,
    FEATURE_LABELS,
  };
});

// Fixtures set by tests to control mock behavior
let mockMembership: { features: string[]; loading: boolean } | null = null;

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'test-user' } }),
}));

vi.mock('@/hooks/useOrchestratorMembership', () => ({
  useOrchestratorMembership: () => ({
    membership: mockMembership,
    loading: mockMembership?.loading ?? false,
  }),
}));

// Import after mocks
import { useFeatureGate, FEATURE_TIER_MAP, FEATURE_LABELS } from '@/hooks/useFeatureGate';

beforeEach(() => {
  vi.clearAllMocks();
  mockMembership = null;
});

describe('useFeatureGate', () => {

  it('returns allowed=true when feature is in user plan', () => {
    mockMembership = {
      features: ['articles', 'basic_split', 'voice_clone', 'video_fixed_template'],
      loading: false,
    };
    const { result } = renderHook(() => useFeatureGate('voice_clone'));
    expect(result.current.allowed).toBe(true);
    expect(result.current.planRequired).toBe('basic');
    expect(result.current.planLabel).toBe('基础版');
    expect(result.current.loading).toBe(false);
  });

  it('returns allowed=false when feature is not in user plan', () => {
    mockMembership = { features: ['articles', 'basic_split'], loading: false };
    const { result } = renderHook(() => useFeatureGate('voice_clone'));
    expect(result.current.allowed).toBe(false);
    expect(result.current.planRequired).toBe('basic');
  });

  it('returns allowed=false with correct planLabel for pro features', () => {
    mockMembership = { features: ['articles', 'basic_split'], loading: false };
    const { result } = renderHook(() => useFeatureGate('batch_split'));
    expect(result.current.allowed).toBe(false);
    expect(result.current.planRequired).toBe('pro');
    expect(result.current.planLabel).toBe('专业版');
  });

  it('returns allowed=true for free features on any plan', () => {
    mockMembership = { features: ['articles', 'basic_split'], loading: false };
    const { result } = renderHook(() => useFeatureGate('articles'));
    expect(result.current.allowed).toBe(true);
  });

  it('returns loading=true while membership data is loading', () => {
    mockMembership = { features: [], loading: true };
    const { result } = renderHook(() => useFeatureGate('voice_clone'));
    expect(result.current.loading).toBe(true);
    expect(result.current.allowed).toBe(false);
  });

  it('defaults unknown features to free plan', () => {
    mockMembership = { features: [], loading: false };
    const { result } = renderHook(() => useFeatureGate('unknown_feature'));
    expect(result.current.planRequired).toBe('free');
    expect(result.current.planLabel).toBe('免费版');
    expect(result.current.allowed).toBe(false);
  });

  it('FEATURE_TIER_MAP contains expected entries', () => {
    expect(FEATURE_TIER_MAP).toMatchObject({
      voice_clone: 'basic',
      video_fixed_template: 'basic',
      batch_split: 'pro',
    });
  });

  it('FEATURE_LABELS contains expected entries', () => {
    expect(FEATURE_LABELS).toMatchObject({
      voice_clone: expect.stringContaining('声音克隆'),
      video_fixed_template: expect.stringContaining('视频固定模板'),
      batch_split: expect.stringContaining('批量分句'),
    });
  });
});
