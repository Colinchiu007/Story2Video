import { useMemo } from 'react';
import { useOrchestratorMembership } from '@/hooks/useOrchestratorMembership';
import { useAuth } from '@/contexts/AuthContext';
import { Lock } from 'lucide-react';

// ── Feature-to-tier mapping ────────────────────────────────────────────────
// Mirrors orchestrator's FEATURES_MAP for frontend display
// Key = feature name from subscription endpoint, value = min tier label

export const FEATURE_TIER_MAP: Record<string, string> = {
  voice_clone: 'basic',
  video_fixed_template: 'basic',
  batch_split: 'pro',
};

export const FEATURE_LABELS: Record<string, string> = {
  voice_clone: '声音克隆 / 高级语音',
  video_fixed_template: '视频固定模板',
  batch_split: '批量分句',
};

// ── Hook ───────────────────────────────────────────────────────────────────

export interface UseFeatureGateReturn {
  /** Whether the feature is included in the user's current plan */
  allowed: boolean;
  /** Minimum tier name required (e.g. 'basic', 'pro') */
  planRequired: string;
  /** Human-readable plan label */
  planLabel: string;
  /** Loading state while membership data is being fetched */
  loading: boolean;
}

/**
 * Check if a feature is available in the user's current plan.
 *
 * Reads from `useOrchestratorMembership` — call it at any level within AuthContext.
 * The membership hook handles lazy registration + token lifecycle automatically.
 *
 * @example
 * ```tsx
 * const { allowed, planLabel } = useFeatureGate('voice_clone');
 * if (!allowed) return <div>升级到 {planLabel} 解锁此功能</div>;
 * ```
 */
export function useFeatureGate(featureName: string): UseFeatureGateReturn {
  const { user } = useAuth();
  const { membership, loading } = useOrchestratorMembership(user?.id ?? null);

  const features = membership?.features ?? [];

  return useMemo(() => {
    const allowed = features.includes(featureName);
    const planRequired = FEATURE_TIER_MAP[featureName] ?? 'free';
    const planLabel =
      planRequired === 'basic'
        ? '基础版'
        : planRequired === 'pro'
          ? '专业版'
          : planRequired === 'enterprise'
            ? '企业版'
            : '免费版';
    return { allowed, planRequired, planLabel, loading };
  }, [features, featureName, loading]);
}

// ── Locked placeholder component ───────────────────────────────────────────

interface LockedFeatureProps {
  planLabel?: string;
  featureLabel?: string;
  className?: string;
  onUpgrade?: () => void;
}

/**
 * Default locked-state placeholder shown when a feature is not available.
 * Can be replaced with custom fallback in `<RequireFeature fallback={...} />`.
 */
export function LockedFeature({
  planLabel = '更高版本',
  featureLabel = '此功能',
  className = '',
  onUpgrade,
}: LockedFeatureProps) {
  return (
    <div
      className={
        'flex flex-col items-center justify-center gap-2 py-8 px-4 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/10 ' +
        className
      }
    >
      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
        <Lock className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground text-center max-w-xs">
        {featureLabel}需要 {planLabel} 或更高套餐
      </p>
      {onUpgrade && (
        <button
          onClick={onUpgrade}
          className="text-xs text-primary hover:underline mt-1"
        >
          查看套餐 →
        </button>
      )}
    </div>
  );
}
