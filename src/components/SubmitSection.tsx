import React from 'react';
import { Wand2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CreateMode } from '@/types';

interface SubmitSectionProps {
  isGenerating: boolean;
  isUploading: boolean;
  handleGenerate: () => void;
  mode: CreateMode;
  hasContent: boolean;
  audioText: string;
  uploadedAudioUrl: string;
  batchSegments: Array<{ id: string; text: string; audioUrl: string; audioName: string }>;
  batchInputText: string;
  useJimengForVideo: () => boolean;
  useViduForVideo: () => boolean;
}

export default function SubmitSection({
  isGenerating, isUploading, handleGenerate,
  mode, hasContent, audioText, uploadedAudioUrl,
  batchSegments, batchInputText,
  useJimengForVideo, useViduForVideo,
}: SubmitSectionProps) {
  return (
    <div className="pt-4 space-y-2">
      <div className="text-xs text-muted-foreground space-y-1">
        {useJimengForVideo() ? (
          <p className="flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-success" />
            当前使用即梦 API 生成视频
          </p>
        ) : useViduForVideo() ? (
          <p className="flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-success" />
            当前使用 Vidu API 生成视频
          </p>
        ) : (
          <>
            <p className="flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary" />
              当前使用系统内置大模型生成视频
            </p>
            <p className="text-xs text-muted-foreground">
              系统内置额度有限，如遇额度不足请在「设置」中配置自定义 API Key 或即梦 API Key
            </p>
          </>
        )}
      </div>
      <Button
        onClick={handleGenerate}
        disabled={
          isGenerating || isUploading ||
          (mode === 'text' && !hasContent) ||
          (mode === 'gallery' && !audioText.trim()) ||
          (mode === 'audio' && !uploadedAudioUrl) ||
          (mode === 'batch' && batchSegments.length === 0 && !batchInputText.trim())
        }
        className="w-full h-12 text-base font-semibold bg-primary text-primary-foreground hover:bg-primary/90"
      >
        {isGenerating ? (
          <span className="flex items-center gap-2">
            <span className="h-5 w-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
            提交中...
          </span>
        ) : isUploading ? (
          <span className="flex items-center gap-2">
            <span className="h-5 w-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
            上传中...
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <Wand2 className="h-5 w-5" />
            立即创作
            <ArrowRight className="h-5 w-5" />
          </span>
        )}
      </Button>
    </div>
  );
}
