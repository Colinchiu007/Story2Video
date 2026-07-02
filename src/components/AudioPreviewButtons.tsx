import React from 'react';
import { Play, Pause, Volume2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface AudioPreviewButtonsProps {
  audioText: string;
  audioPreview: string;
  isPreviewingAudio: boolean;
  isPlayingPreview: boolean;
  audioDuration: number;
  handlePreviewAudio: () => Promise<void>;
  setIsPlayingPreview: (v: boolean) => void;
  setAudioPreview: (v: string) => void;
}

export default function AudioPreviewButtons({
  audioText, audioPreview, isPreviewingAudio, isPlayingPreview,
  audioDuration, handlePreviewAudio,
  setIsPlayingPreview, setAudioPreview,
}: AudioPreviewButtonsProps) {
  return (
    <>
      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={handlePreviewAudio}
          disabled={isPreviewingAudio || !audioText.trim()}
          className="shrink-0"
        >
          {isPreviewingAudio ? (
            <Volume2 className="h-4 w-4 animate-pulse" />
          ) : isPlayingPreview ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          <span className="ml-2">
            {isPreviewingAudio ? '生成中...' : isPlayingPreview ? '暂停' : '生成&试听'}
          </span>
        </Button>
        {audioPreview && (
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              if (!audioPreview) return;
              try {
                const response = await fetch(audioPreview);
                const blob = await response.blob();
                const objUrl = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = objUrl;
                a.download = 'tts-preview-' + Date.now() + '.mp3';
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(objUrl);
                document.body.removeChild(a);
                toast.success('下载已开始');
              } catch {
                toast.error('下载失败，请直接右键音频保存');
              }
            }}
            className="shrink-0"
          >
            <Download className="h-4 w-4 mr-1" />
            下载音频
          </Button>
        )}
      </div>
      {audioPreview && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Volume2 className="h-4 w-4" />
          <span>音频时长 {audioDuration.toFixed(1)} 秒</span>
          {isPlayingPreview && <span className="text-primary animate-pulse">播放中...</span>}
        </div>
      )}
    </>
  );
}
