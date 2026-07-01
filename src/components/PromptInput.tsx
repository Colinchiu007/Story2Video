import React from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { CreateMode } from '@/types';

interface PromptInputProps {
  mode: CreateMode;
  prompt: string;
  setPrompt: (v: string) => void;
}

export default function PromptInput({ mode, prompt, setPrompt }: PromptInputProps) {
  if (mode === 'gallery') return null;
  return (
    <div className="space-y-2">
      <Label>
        {mode === 'remix' ? '编辑说明' : '视频描述（可选）'}
        {mode === 'remix' && <span className="text-destructive ml-1">*</span>}
      </Label>
      <Textarea
        placeholder={
          mode === 'text'
            ? '此处不填时，以语音文本内容生成对应画面的视频；有语音的同时，如有自定义视频内容要求，可在此填写，但尽量与语音文案相关'
            : mode === 'image'
              ? '描述视频中期望的画面动态效果（可选）'
              : '描述希望做出的修改，如：将场景变为夜晚，增加霓虹灯光'
        }
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={4}
        className="bg-background border-border resize-none focus-visible:ring-primary"
      />
    </div>
  );
}
