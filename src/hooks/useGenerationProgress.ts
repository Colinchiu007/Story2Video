import { useState, useCallback } from 'react';

export type StepStatus = 'pending' | 'active' | 'completed' | 'failed';

export interface ProgressStep {
  label: string;
  status: StepStatus;
  detail?: string;
}

interface UseGenerationProgressReturn {
  progressOpen: boolean;
  setProgressOpen: (v: boolean) => void;
  progressSteps: ProgressStep[];
  progressError: string | null;
  updateStep: (index: number, status: StepStatus, detail?: string) => void;
  initProgress: (hasBgm: boolean, isGallery?: boolean) => void;
  setProgressError: (v: string | null) => void;
}

export function useGenerationProgress(): UseGenerationProgressReturn {
  const [progressOpen, setProgressOpen] = useState(false);
  const [progressSteps, setProgressSteps] = useState<ProgressStep[]>([]);
  const [progressError, setProgressError] = useState<string | null>(null);

  const updateStep = useCallback((index: number, status: StepStatus, detail?: string) => {
    setProgressSteps((prev) => {
      const next = [...prev];
      if (next[index]) {
        next[index] = { ...next[index], status, detail: detail ?? next[index].detail };
      }
      return next;
    });
  }, []);

  const initProgress = useCallback((hasBgm: boolean, isGallery = true) => {
    if (isGallery) {
      const steps: ProgressStep[] = [
        { label: '创建任务', status: 'active' },
        { label: '语音合成', status: 'pending' },
      ];
      if (hasBgm) {
        steps.push({ label: '背景音乐混音', status: 'pending' });
      }
      steps.push(
        { label: '文案分断与计算', status: 'pending' },
        { label: '优化生图提示词', status: 'pending' },
        { label: 'AI生成图片', status: 'pending' },
        { label: '合成轮播视频', status: 'pending' },
      );
      setProgressSteps(steps);
    } else {
      const steps: ProgressStep[] = [
        { label: '创建任务', status: 'active' },
        { label: '提交生成请求', status: 'pending' },
        { label: '等待视频生成完成', status: 'pending' },
      ];
      setProgressSteps(steps);
    }
    setProgressError(null);
    setProgressOpen(true);
  }, []);

  return {
    progressOpen, setProgressOpen, progressSteps, progressError,
    updateStep, initProgress, setProgressError,
  };
}
