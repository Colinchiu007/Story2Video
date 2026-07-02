import React, { useState } from 'react';
import { Sparkles, Check, ArrowRight, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useOrchestratorMembership } from '@/hooks/useOrchestratorMembership';
import { useAuth } from '@/contexts/AuthContext';
import MembershipUpgradeDialog from '@/components/MembershipUpgradeDialog';


// ── Constants ──────────────────────────────────────────────────────────────

const PLAN_LABELS: Record<string, string> = {
  free: '免费版',
  basic: '基础版',
  pro: '专业版',
  enterprise: '企业版',
};

const PLAN_COLORS: Record<string, string> = {
  free: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  basic: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
  pro: 'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-800',
  enterprise: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
};

const FEATURE_LABELS: Record<string, string> = {
  articles: '文章创作',
  basic_split: '基础分句',
  batch_split: '批量分句',
  voice_clone: '声音克隆',
  video_fixed_template: '视频固定模板',
};

// ── Component ──────────────────────────────────────────────────────────────

/** Compact membership status card shown on ProfilePage. */
export default function MembershipCard() {
  const { user } = useAuth();
  const { membership, usage, loading, error, refresh } = useOrchestratorMembership(
    user?.id ?? null,
  );
  const [dialogOpen, setDialogOpen] = useState(false);


  // Not logged in — render nothing
  if (!user) return null;

  const planType = membership?.plan_type ?? 'free';
  const features = membership?.features ?? [];
  const endDate = membership?.end_date;

  const used = usage?.videos_used ?? 0;
  const quota = usage?.videos_quota ?? getDefaultQuota(planType);
  const quotaPercent = quota > 0 ? Math.min(Math.round((used / quota) * 100), 100) : 0;

  // ── Loading skeleton (first load only) ────────────────────────────────
  if (loading && !membership) {
    return (
      <Card className="border border-border bg-card mb-6">
        <CardContent className="p-4 md:p-5">
          <div className="space-y-3">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3 w-56" />
            <Skeleton className="h-2 w-full max-w-xs" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Error state (no cached data) ─────────────────────────────────────
  if (error && !membership) {
    return (
      <Card className="border border-border bg-card mb-6">
        <CardContent className="p-4 md:p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={PLAN_COLORS.free}>
                <Sparkles className="h-3 w-3 mr-1" />
                {PLAN_LABELS.free}
              </Badge>
              <span className="text-xs text-muted-foreground">
                会员信息暂时不可用
              </span>
            </div>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={refresh}>
              重试
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Normal state (cached or fresh data) ──────────────────────────────
  return (
    <Card className="border border-border bg-card mb-6">
      <CardContent className="p-4 md:p-5">
        <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
          {/* Plan badge */}
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="outline" className={`${PLAN_COLORS[planType] || PLAN_COLORS.free} text-xs px-3 py-1`}>
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              {PLAN_LABELS[planType] || planType}
            </Badge>
          </div>

          {/* Features tags */}
          {features.length > 0 && (
            <div className="flex flex-wrap gap-x-3 gap-y-1 flex-1 min-w-0">
              {features.map((f) => (
                <span
                  key={f}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap"
                >
                  <Check className="h-3 w-3 text-green-500 shrink-0" />
                  {FEATURE_LABELS[f] || f}
                </span>
              ))}
            </div>
          )}

          {/* Quota progress */}
          <div className="w-full md:w-44 shrink-0">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>今日配额</span>
              <span>{used}/{quota}</span>
            </div>
            <Progress value={quotaPercent} className="h-1.5" />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {endDate && (
              <span className="text-xs text-muted-foreground whitespace-nowrap hidden lg:inline">
                <Clock className="h-3 w-3 inline mr-0.5 align-text-top" />
                {new Date(endDate).toLocaleDateString('zh-CN')}到期
              </span>
            )}
            {planType !== 'enterprise' && (
              <Button
                size="sm"
                className="shrink-0 h-8 text-xs px-3"
                onClick={() => setDialogOpen(true)}
              >
                升级
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            )}
          </div>
        </div>

        {/* Subtle stale indicator during background refresh */}
        {loading && (
          <div className="mt-2 h-0.5 w-full overflow-hidden rounded-full bg-primary/10">
            <div className="h-full w-full bg-primary/40 rounded-full animate-pulse" />
          </div>
        )}

        <MembershipUpgradeDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          currentPlan={planType}
          refresh={refresh}
        />
      </CardContent>
    </Card>
  );
}

function getDefaultQuota(plan: string): number {
  switch (plan) {
    case 'basic': return 10;
    case 'pro': return 50;
    case 'enterprise': return 200;
    default: return 3;
  }
}
