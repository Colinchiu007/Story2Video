import { AlertTriangle, Sparkles, RefreshCw } from 'lucide-react';
import { useOrchestratorMembership } from '@/hooks/useOrchestratorMembership';
import { useAuth } from '@/contexts/AuthContext';

// ── Component ──────────────────────────────────────────────────────────────

/**
 * Inline quota warning banner for CreatePage.
 *
 * - Shows nothing when quota is healthy (>30% remaining)
 * - Yellow warning when near limit (≤30% remaining)
 * - Red warning when exhausted (0 remaining)
 *
 * Plays well with useOrchestratorMembership's stale-while-revalidate:
 * shows cached data immediately, refreshes in background.
 */
export default function QuotaWidget() {
  const { user } = useAuth();
  const { membership, usage, loading, error } = useOrchestratorMembership(
    user?.id ?? null,
  );

  // Not logged in — no quota to show
  if (!user) return null;

  // Still loading initial data — nothing to show yet
  if (loading && !usage) return null;

  // Orchestrator unreachable — silent degrade
  if (error || !usage) return null;

  const used = usage.videos_used ?? 0;
  const quota = usage.videos_quota ?? 3;
  const remaining = Math.max(quota - used, 0);
  const usedPercent = quota > 0 ? Math.round((used / quota) * 100) : 0;

  // Healthy quota — no warning needed
  if (remaining > Math.ceil(quota * 0.3)) return null;

  const planType = usage.plan_type ?? membership?.plan_type ?? 'free';
  const isExhausted = remaining === 0;

  // ── Exhausted state ──────────────────────────────────────────────────
  if (isExhausted) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-sm">
        <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
        <span className="text-red-700 dark:text-red-300 flex-1">
          今日视频生成次数已用完
        </span>
        {planType !== 'enterprise' && (
          <a
            href="/profile"
            className="text-xs text-primary hover:underline shrink-0"
          >
            升级套餐 →
          </a>
        )}
      </div>
    );
  }

  // ── Near-limit warning ───────────────────────────────────────────────
  const isCritical = remaining <= Math.ceil(quota * 0.1);
  return (
    <div
      className={
        'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ' +
        (isCritical
          ? 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300'
          : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300')
      }
    >
      <Sparkles className="h-4 w-4 shrink-0" />
      <span className="flex-1">
        今日剩余 <strong>{remaining}</strong> 次生成
      </span>
      {planType !== 'enterprise' && (
        <a
          href="/profile"
          className="text-xs text-primary hover:underline shrink-0"
        >
          升级 →
        </a>
      )}
    </div>
  );
}
