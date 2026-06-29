export interface EffectOption {
  value: string;
  label: string;
}

export const IMAGE_EFFECTS: EffectOption[] = [
  { value: 'none', label: '无效果' },
  { value: 'zoom-in', label: '慢慢放大' },
  { value: 'zoom-out', label: '慢慢缩小' },
  { value: 'pan-left', label: '向左平移' },
  { value: 'pan-right', label: '向右平移' },
  { value: 'pan-up', label: '向上平移' },
  { value: 'pan-down', label: '向下平移' },
  { value: 'zoom-pan', label: '放大+平移' },
  { value: 'rotate', label: '缓慢旋转' },
  { value: 'blur-in', label: '模糊渐入' },
];

export const TRANSITION_EFFECTS: EffectOption[] = [
  { value: 'none', label: '直接切换' },
  { value: 'fade', label: '渐隐渐显' },
  { value: 'slide-left', label: '左滑' },
  { value: 'slide-right', label: '右滑' },
  { value: 'slide-up', label: '上滑' },
  { value: 'slide-down', label: '下滑' },
];
