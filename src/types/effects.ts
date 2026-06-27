/** 图片动态效果类型 */
export type ImageEffect =
  | 'zoom-in'
  | 'zoom-out'
  | 'pan-left'
  | 'pan-right'
  | 'pan-up'
  | 'pan-down'
  | 'zoom-pan'
  | 'rotate'
  | 'blur-in'
  | 'none';

/** 转场效果类型 */
export type TransitionEffect =
  | 'fade'
  | 'slide-left'
  | 'slide-right'
  | 'slide-up'
  | 'slide-down'
  | 'none';

/** 特效元数据 */
export interface EffectMeta {
  id: string;
  label: string;
  description: string;
  /** 适用于哪种场景 */
  suitable: string[];
  /** CSS 或渲染提示（可选） */
  hint?: string;
}
