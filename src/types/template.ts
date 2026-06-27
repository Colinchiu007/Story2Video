/** 视频模板定义 */
export interface VideoTemplate {
  id: string;
  name: string;
  description: string;
  thumbnail?: string;
  category: TemplateCategory;
  /** 预设的图片动态效果 */
  imageEffect: string;
  /** 预设的切换特效 */
  transitionEffect: string;
  /** 预设的 BGM 配置 */
  bgm?: {
    url: string;
    name: string;
    volume: number;
  };
  /** 预设字幕样式 */
  subtitleStyle?: {
    enabled: boolean;
    font: string;
    size: string;
    style: string;
  };
  /** 预设每张图片时长 */
  perImageDuration?: number;
  /** 预设分辨率 */
  size?: string;
  /** 预设时长 */
  seconds?: number;
}

export type TemplateCategory =
  | 'popular'    // 热门推荐
  | 'business'   // 商务营销
  | 'education'  // 知识教育
  | 'vlog'       // 生活记录
  | 'creative'   // 创意特效
  | 'custom';    // 自定义
