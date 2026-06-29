import { Image, Music, ListOrdered, Type, Wand2 } from 'lucide-react';
import type { CreateMode } from '@/types';

export interface ModeOption {
  key: CreateMode;
  label: string;
  icon: React.ElementType;
  desc: string;
}

export const MODES: ModeOption[] = [
  { key: 'gallery', label: '图片轮播视频', icon: Image, desc: '生成口播语音和多张图片，组合为轮播视频' },
  { key: 'audio', label: '音频生成视频', icon: Music, desc: '上传音频文件，识别内容后生成图片并合成视频' },
  { key: 'batch', label: '分段视频', icon: ListOrdered, desc: '输入多段文案或上传多个音频，生成多个视频片段' },
  { key: 'text', label: '文生视频', icon: Type, desc: '输入文本描述，AI 自动生成视频' },
  { key: 'image', label: '图生视频', icon: Image, desc: '上传参考图片，基于图片生成视频' },
  { key: 'remix', label: '视频Remix', icon: Wand2, desc: '上传已有视频，进行局部编辑' },
];
