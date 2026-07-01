import React from 'react';
import { RotateCcw } from 'lucide-react';

interface HeaderSectionProps {
  mode: string;
  prompt: string;
  audioText: string;
  clearDraft: () => void;
}

export default function HeaderSection({ mode, prompt, audioText, clearDraft }: HeaderSectionProps) {
  return (
    <div className="relative rounded-sm overflow-hidden mb-8 aspect-[16/6] md:aspect-[16/5]">
      <img
        src="https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_84235796-312b-463e-b768-99b46e02e834.jpg"
        alt="AI 视频创作"
        className="w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/60 to-transparent" />
      <div className="absolute inset-0 flex flex-col justify-center p-6 md:p-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-balance mb-2">视频创作</h1>
            <p className="text-muted-foreground text-sm md:text-base max-w-md text-pretty">选择创作模式，输入描述或上传素材，AI 将为您生成视频</p>
          </div>
          {(prompt || audioText) && (
            <button
              type="button"
              onClick={clearDraft}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors shrink-0"
              title="清除当前草稿"
            >
              <RotateCcw className="h-3 w-3" />
              清除草稿
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
