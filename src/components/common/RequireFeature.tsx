import React, { type ReactNode } from 'react';
import {
  useFeatureGate,
  LockedFeature,
  FEATURE_TIER_MAP,
  FEATURE_LABELS,
} from '@/hooks/useFeatureGate';

// ── Props ──────────────────────────────────────────────────────────────────

interface RequireFeatureProps {
  /** Feature name from orchestrator's FEATURES_MAP */
  feature: string;
  /** Content to render when the feature IS allowed */
  children: ReactNode;
  /**
   * Custom fallback when feature is NOT allowed.
   * Defaults to a centered LockedFeature placeholder.
   */
  fallback?: ReactNode | ((props: { planLabel: string; planRequired: string }) => ReactNode);
  /**
   * When true, children are always rendered (no gating).
   * Useful during development or for features that have graceful degradation.
   */
  noGate?: boolean;
}

// ── Component ──────────────────────────────────────────────────────────────

/**
 * Conditionally renders children based on the user's membership tier.
 *
 * If the user's plan includes the required `feature`, children are rendered.
 * Otherwise, a fallback (locked placeholder) is shown.
 *
 * @example
 * ```tsx
 * <RequireFeature feature="voice_clone">
 *   <VoiceCloneDialog />
 * </RequireFeature>
 *
 * // Custom fallback
 * <RequireFeature
 *   feature="batch_split"
 *   fallback={({ planLabel }) => (
 *     <div className="text-sm text-muted-foreground">
 *       {planLabel} 起可用
 *     </div>
 *   )}
 * >
 *   <BatchModeInput />
 * </RequireFeature>
 * ```
 */
export default function RequireFeature({
  feature,
  children,
  fallback,
  noGate = false,
}: RequireFeatureProps) {
  const { allowed, planLabel, planRequired, loading } = useFeatureGate(feature);

  // During loading, render nothing (or a minimal skeleton)
  if (loading) return null;

  // Always render when noGate or feature is allowed
  if (noGate || allowed) return <>{children}</>;

  // Feature not allowed — render fallback
  if (fallback !== undefined) {
    if (typeof fallback === 'function') {
      const FallbackComponent = fallback as (
        props: { planLabel: string; planRequired: string },
      ) => ReactNode;
      return <>{FallbackComponent({ planLabel, planRequired })}</>;
    }
    return <>{fallback}</>;
  }

  // Default fallback
  const featureLabel = FEATURE_LABELS[feature] ?? feature;
  return <LockedFeature planLabel={planLabel} featureLabel={featureLabel} />;
}
