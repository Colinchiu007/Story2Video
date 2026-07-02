import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Check, Loader2, Sparkles, XCircle, ArrowRight } from 'lucide-react';

// ── Plan constants ───────────────────────────────────────────────────────────

interface PlanDetail {
  name: string;
  price: string;
  features: string[];
  color: string;
  borderColor: string;
}

const PLAN_DETAILS: Record<string, PlanDetail> = {
  free: {
    name: '免费版',
    price: '\xa50',
    features: [
      '每日 3 次视频生成',
      '基础分句',
      '固定模板',
    ],
    color:
      'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    borderColor:
      'border-slate-200 dark:border-slate-700',
  },
  basic: {
    name: '基础版',
    price: '\xa59.99',
    features: [
      '每日 10 次视频生成',
      '基础分句',
      '声音克隆',
      'AI 优化',
    ],
    color:
      'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
    borderColor:
      'border-blue-200 dark:border-blue-800',
  },
  pro: {
    name: '专业版',
    price: '\xa529.99',
    features: [
      '每日 50 次视频生成',
      '批量分句',
      '声音克隆',
      'AI 优化',
      '无水印',
    ],
    color:
      'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-800',
    borderColor:
      'border-violet-200 dark:border-violet-800',
  },
  enterprise: {
    name: '企业版',
    price: '\xa599.99',
    features: [
      '每日 200 次视频生成',
      '全部高级功能',
      '优先支持',
    ],
    color:
      'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
    borderColor:
      'border-amber-200 dark:border-amber-800',
  },
};

type Step = 'list' | 'confirming' | 'processing' | 'success' | 'error';

// ── API helpers ──────────────────────────────────────────────────────────────

function _baseUrl(): string {
  return (
    localStorage.getItem('orchestrator_url') ||
    (typeof import.meta !== 'undefined' &&
      (import.meta as Record<string, unknown>).env &&
      ((import.meta as Record<string, unknown>).env as Record<string, string>)
        .VITE_ORCHESTRATOR_URL) ||
    '/api'
  );
}

function _getToken(): string | null {
  try {
    const raw = localStorage.getItem('orchestrator_membership_token');
    if (!raw) return null;
    const t = JSON.parse(raw);
    return t.access_token || null;
  } catch {
    return null;
  }
}

async function _apiFetch<T>(
  path: string,
  options?: { method?: string; body?: unknown; token?: string },
): Promise<{ ok: boolean; status: number; data?: T; text?: string }> {
  const url = _baseUrl() + path;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
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
    if (!res.ok) return { ok: false, status: res.status, text };
    return {
      ok: true,
      status: res.status,
      data: text ? JSON.parse(text) : undefined,
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      text: err instanceof Error ? err.message : '网络错误',
    };
  }
}

// ── Component ────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPlan: string;
  refresh?: () => void;
}

export default function MembershipUpgradeDialog({
  open,
  onOpenChange,
  currentPlan,
  refresh,
}: Props) {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('list');
  const [errorMessage, setErrorMessage] = useState('');

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedPlan(null);
      setStep('list');
      setErrorMessage('');
    }
  }, [open]);

  const handleSelectPlan = (plan: string) => {
    if (plan === currentPlan) return;
    setSelectedPlan(plan);
    setStep('confirming');
    setErrorMessage('');
  };

  const handleConfirm = async () => {
    if (!selectedPlan) return;
    setStep('processing');
    setErrorMessage('');

    const token = _getToken();
    if (!token) {
      setErrorMessage('请先登录');
      setStep('error');
      return;
    }

    // Step 1: create checkout
    const { ok: checkoutOk, data: checkoutData, text: checkoutText } =
      await _apiFetch<{ checkout_id: string }>('/api/payment/create-checkout', {
        method: 'POST',
        token,
        body: {
          plan_type: selectedPlan,
          success_url: window.location.href,
          cancel_url: window.location.href,
        },
      });

    if (!checkoutOk || !checkoutData?.checkout_id) {
      setErrorMessage(checkoutText || '创建订单失败');
      setStep('error');
      return;
    }

    // Step 2: confirm mock payment
    const { ok: confirmOk, text: confirmText } = await _apiFetch(
      '/api/payment/confirm-mock',
      {
        method: 'POST',
        token,
        body: {
          checkout_id: checkoutData.checkout_id,
          status: 'completed',
        },
      },
    );

    if (!confirmOk) {
      setErrorMessage(confirmText || '支付确认失败');
      setStep('error');
      return;
    }

    setStep('success');

    // Refresh parent data, then close
    setTimeout(() => {
      refresh?.();
      onOpenChange(false);
    }, 1500);
  };

  const handleRetry = () => {
    setStep('confirming');
    setErrorMessage('');
  };

  const handleBack = () => {
    setStep('list');
    setSelectedPlan(null);
    setErrorMessage('');
  };

  // ── List: plan comparison grid ──────────────────────────────────────────

  const renderList = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {Object.entries(PLAN_DETAILS).map(([key, plan]) => {
        const isCurrent = key === currentPlan;
        const isSelected = key === selectedPlan;
        return (
          <Card
            key={key}
            className={
              'relative p-4 cursor-pointer transition-all border-2 ' +
              (isCurrent
                ? 'opacity-75 cursor-default'
                : 'hover:border-primary/40') +
              ' ' +
              (isSelected
                ? 'border-primary ring-2 ring-primary/20'
                : plan.borderColor)
            }
            onClick={() => handleSelectPlan(key)}
          >
            {isCurrent && (
              <Badge
                className="absolute top-2 right-2 text-[10px] px-2 py-0.5"
                variant="secondary"
              >
                {'当前套餐'}
              </Badge>
            )}
            <div className="mb-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm">{plan.name}</span>
                <span
                  className={
                    'text-xs px-2 py-0.5 rounded-full border ' + plan.color
                  }
                >
                  {key === 'free' ? '免费' :
                   key === 'basic' ? '基础' :
                   key === 'pro' ? '专业' : '企业'}
                </span>
              </div>
              <div className="mt-2">
                <span className="text-xl font-bold">{plan.price}</span>
                <span className="text-xs text-muted-foreground">
                  {' /month'}
                </span>
              </div>
            </div>
            <ul className="space-y-1">
              {plan.features.map((f) => (
                <li
                  key={f}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground"
                >
                  <Check className="h-3 w-3 text-green-500 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </Card>
        );
      })}
    </div>
  );

  // ── Confirming: selected plan overview ──────────────────────────────────

  const renderConfirming = () => {
    if (!selectedPlan) return null;
    const plan = PLAN_DETAILS[selectedPlan];
    return (
      <div className="space-y-4">
        <div className="text-center space-y-2">
          <span
            className={
              'inline-flex items-center gap-1.5 text-sm px-3 py-1 rounded-full border ' +
              (plan?.color ?? '')
            }
          >
            <Sparkles className="h-3.5 w-3.5" />
            {plan?.name}
          </span>
          <p className="text-lg font-semibold">
            {plan?.price}
            <span className="text-sm font-normal text-muted-foreground">
              {' /month'}
            </span>
          </p>
        </div>

        {plan?.features && (
          <ul className="space-y-1.5 mx-auto max-w-xs">
            {plan.features.map((f) => (
              <li
                key={f}
                className="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <Check className="h-4 w-4 text-green-500 shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        )}

        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={handleBack}>
            {'返回'}
          </Button>
          <Button className="flex-1" onClick={handleConfirm}>
            {'确认升级'}
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    );
  };

  // ── Processing ──────────────────────────────────────────────────────────

  const renderProcessing = () => (
    <div className="flex flex-col items-center justify-center py-8 space-y-3">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">
        {'正在处理支付...'}
      </p>
    </div>
  );

  // ── Success ─────────────────────────────────────────────────────────────

  const renderSuccess = () => (
    <div className="flex flex-col items-center justify-center py-8 space-y-3">
      <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
        <Check className="h-6 w-6 text-green-600 dark:text-green-400" />
      </div>
      <p className="font-semibold text-base">
        {'升级成功'}
      </p>
      <p className="text-sm text-muted-foreground">
        {'您的套餐已更新'}
      </p>
    </div>
  );

  // ── Error ───────────────────────────────────────────────────────────────

  const renderError = () => (
    <div className="flex flex-col items-center justify-center py-6 space-y-3">
      <XCircle className="h-8 w-8 text-destructive" />
      <p className="text-sm font-medium text-destructive">
        {'升级失败'}
      </p>
      <p className="text-xs text-muted-foreground text-center max-w-xs">
        {errorMessage}
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={handleBack}>
          {'返回'}
        </Button>
        <Button size="sm" onClick={handleRetry}>
          {'重试'}
        </Button>
      </div>
    </div>
  );

  // ── Title mapping ───────────────────────────────────────────────────────

  const stepTitle: Record<Step, string> = {
    list: '选择套餐',
    confirming: '确认升级',
    processing: '处理中',
    success: '升级成功',
    error: '升级失败',
  };

  const stepDesc: Record<Step, string> = {
    list: '选择适合您的套餐，解锁更多功能',
    confirming: '',
    processing: '',
    success: '',
    error: '',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{stepTitle[step]}</DialogTitle>
          {step === 'list' && (
            <DialogDescription>{stepDesc[step]}</DialogDescription>
          )}
        </DialogHeader>

        {step === 'list' && renderList()}
        {step === 'confirming' && renderConfirming()}
        {step === 'processing' && renderProcessing()}
        {step === 'success' && renderSuccess()}
        {step === 'error' && renderError()}
      </DialogContent>
    </Dialog>
  );
}
