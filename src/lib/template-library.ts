import type { VideoTemplate } from '@/types/template';

/** 内置视频模板预设 */
export const BUILT_IN_TEMPLATES: VideoTemplate[] = [
  {
    id: 'tpl-quick',
    name: '快速成片',
    description: '标准模式，适合大多数场景',
    category: 'popular',
    imageEffect: 'zoom-in',
    transitionEffect: 'fade',
    perImageDuration: 4,
    size: '1920x1080',
    seconds: 30,
  },
  {
    id: 'tpl-slideshow',
    name: '幻灯片演示',
    description: '平稳切换，适合产品展示',
    category: 'business',
    imageEffect: 'none',
    transitionEffect: 'slide-left',
    perImageDuration: 5,
    size: '1920x1080',
    seconds: 30,
    subtitleStyle: {
      enabled: true,
      font: 'sans-serif',
      size: 'lg',
      style: 'style1',
    },
  },
  {
    id: 'tpl-dynamic',
    name: '动感快剪',
    description: '快速切换，适合精彩集锦',
    category: 'creative',
    imageEffect: 'zoom-out',
    transitionEffect: 'slide-right',
    perImageDuration: 3,
    size: '1920x1080',
    seconds: 20,
    bgm: {
      url: '',
      name: '节奏明快',
      volume: 5,
    },
  },
  {
    id: 'tpl-vlog',
    name: 'Vlog 日常',
    description: '自然温馨风格，适合生活记录',
    category: 'vlog',
    imageEffect: 'pan-left',
    transitionEffect: 'fade',
    perImageDuration: 4,
    size: '1080x1920',
    seconds: 60,
    subtitleStyle: {
      enabled: true,
      font: 'sans-serif',
      size: 'md',
      style: 'style2',
    },
  },
  {
    id: 'tpl-education',
    name: '知识讲解',
    description: '清晰展示，适合教程内容',
    category: 'education',
    imageEffect: 'none',
    transitionEffect: 'fade',
    perImageDuration: 6,
    size: '1920x1080',
    seconds: 60,
    subtitleStyle: {
      enabled: true,
      font: 'serif',
      size: 'lg',
      style: 'style3',
    },
  },
  {
    id: 'tpl-promo',
    name: '营销推广',
    description: '强视觉冲击，适合广告宣传',
    category: 'business',
    imageEffect: 'zoom-in',
    transitionEffect: 'slide-up',
    perImageDuration: 3,
    size: '1920x1080',
    seconds: 15,
    bgm: {
      url: '',
      name: '活力电子',
      volume: 7,
    },
  },
  {
    id: 'tpl-cinematic',
    name: '电影质感',
    description: '沉稳大气，适合品牌宣传',
    category: 'creative',
    imageEffect: 'pan-right',
    transitionEffect: 'fade',
    perImageDuration: 5,
    size: '1920x1080',
    seconds: 30,
    subtitleStyle: {
      enabled: true,
      font: 'serif',
      size: 'lg',
      style: 'style1',
    },
  },
];

const STORAGE_KEY = 'video_templates_custom';

/** 获取所有模板（内建 + 自定义） */
export function getAllTemplates(category?: string): VideoTemplate[] {
  const builtIn = [...BUILT_IN_TEMPLATES];
  const custom = loadCustomTemplates();
  const all = [...builtIn, ...custom];
  if (category && category !== 'all') {
    return all.filter((t) => t.category === category);
  }
  return all;
}

/** 按 ID 获取模板 */
export function getTemplateById(id: string): VideoTemplate | undefined {
  return getAllTemplates().find((t) => t.id === id);
}

/** 从 localStorage 加载自定义模板 */
export function loadCustomTemplates(): VideoTemplate[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored) as VideoTemplate[];
  } catch { /* ignore */ }
  return [];
}

/** 保存自定义模板 */
export function saveCustomTemplate(template: VideoTemplate): void {
  const custom = loadCustomTemplates();
  custom.push(template);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(custom));
}

/** 删除自定义模板 */
export function deleteCustomTemplate(id: string): void {
  const custom = loadCustomTemplates().filter((t) => t.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(custom));
}
