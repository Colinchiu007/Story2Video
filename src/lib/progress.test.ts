import { describe, it, expect } from 'vitest';

type StepStatus = 'pending' | 'active' | 'completed' | 'failed';

interface ProgressStep {
  label: string;
  status: StepStatus;
  detail?: string;
}

function buildInitialSteps(hasBgm: boolean): ProgressStep[] {
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
  return steps;
}

function updateStep(steps: ProgressStep[], index: number, status: StepStatus, detail?: string): ProgressStep[] {
  const next = [...steps];
  if (next[index]) {
    next[index] = { ...next[index], status, detail: detail ?? next[index].detail };
  }
  return next;
}

describe('Gallery Progress Steps', () => {
  it('should build 6 steps without BGM', () => {
    const steps = buildInitialSteps(false);
    expect(steps).toHaveLength(6);
    expect(steps[0].label).toBe('创建任务');
    expect(steps[0].status).toBe('active');
    expect(steps[1].label).toBe('语音合成');
    expect(steps[2].label).toBe('文案分断与计算');
    expect(steps[3].label).toBe('优化生图提示词');
    expect(steps[4].label).toBe('AI生成图片');
    expect(steps[5].label).toBe('合成轮播视频');
  });

  it('should build 7 steps with BGM', () => {
    const steps = buildInitialSteps(true);
    expect(steps).toHaveLength(7);
    expect(steps[2].label).toBe('背景音乐混音');
  });

  it('should update step status and detail', () => {
    let steps = buildInitialSteps(false);
    steps = updateStep(steps, 0, 'completed');
    steps = updateStep(steps, 1, 'completed', '时长 12.5 秒');
    steps = updateStep(steps, 4, 'active', '1/3');
    steps = updateStep(steps, 4, 'active', '2/3');
    steps = updateStep(steps, 4, 'completed', '3/3');

    expect(steps[0].status).toBe('completed');
    expect(steps[1].status).toBe('completed');
    expect(steps[1].detail).toBe('时长 12.5 秒');
    expect(steps[4].status).toBe('completed');
    expect(steps[4].detail).toBe('3/3');
  });

  it('should mark step as failed with error detail', () => {
    let steps = buildInitialSteps(false);
    steps = updateStep(steps, 5, 'failed', 'new row violates row-level security policy');
    expect(steps[5].status).toBe('failed');
    expect(steps[5].detail).toBe('new row violates row-level security policy');
  });

  it('should handle image generation progress tracking', () => {
    let steps = buildInitialSteps(false);
    steps = updateStep(steps, 4, 'active', '0/5');
    steps = updateStep(steps, 4, 'active', '1/5');
    steps = updateStep(steps, 4, 'active', '2/5');
    steps = updateStep(steps, 4, 'active', '3/5');
    steps = updateStep(steps, 4, 'active', '4/5');
    steps = updateStep(steps, 4, 'completed', '5/5');

    expect(steps[4].status).toBe('completed');
    expect(steps[4].detail).toBe('5/5');
  });

  it('should simulate full success flow', () => {
    let steps = buildInitialSteps(true);
    steps = updateStep(steps, 0, 'completed');
    steps = updateStep(steps, 1, 'completed');
    steps = updateStep(steps, 2, 'completed');
    steps = updateStep(steps, 3, 'completed', '分断为 4 段');
    steps = updateStep(steps, 4, 'completed', '共 4 条提示词');
    steps = updateStep(steps, 5, 'completed', '4/4');
    steps = updateStep(steps, 6, 'completed');

    expect(steps.every((s) => s.status === 'completed')).toBe(true);
  });

  it('should simulate partial failure flow', () => {
    let steps = buildInitialSteps(false);
    steps = updateStep(steps, 0, 'completed');
    steps = updateStep(steps, 1, 'completed');
    steps = updateStep(steps, 2, 'completed');
    steps = updateStep(steps, 3, 'failed', 'LLM 调用超时');
    steps = updateStep(steps, 4, 'failed', '2/4 失败');
    steps = updateStep(steps, 5, 'failed', 'new row violates row-level security policy');

    expect(steps[0].status).toBe('completed');
    expect(steps[1].status).toBe('completed');
    expect(steps[3].status).toBe('failed');
    expect(steps[4].status).toBe('failed');
    expect(steps[5].status).toBe('failed');
  });
});
