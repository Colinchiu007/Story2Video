import React from 'react';
import { Mic } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface TTSTextareaProps {
  audioText: string;
  setAudioText: (v: string) => void;
  speed: number;
  mode: string;
}

export default function TTSTextarea({ audioText, setAudioText, speed, mode }: TTSTextareaProps) {
  return (
    <>
      <div className="flex items-center gap-2">
        <Mic className="h-4 w-4 text-primary" />
        <Label className="font-medium">语音合成文案</Label>
      </div>
      <div className="relative">
        <Textarea
          placeholder="输入需要合成的语音文本，生成的音频将用于视频配音（限5000字符）"
          value={audioText}
          onChange={(e) => {
            const v = e.target.value;
            if (v.length <= 5000) setAudioText(v);
          }}
          rows={3}
          className="bg-background border-border resize-none focus-visible:ring-primary"
        />
        <span className={`absolute bottom-2 right-2 text-xs ${audioText.length > 4800 ? 'text-destructive' : 'text-muted-foreground'}`}>
          {audioText.length}/5000
        </span>
      </div>
      {/* Stats bar */}
      {audioText.trim() && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <span className="text-muted-foreground">
            字数 <span className="font-medium text-foreground tabular-nums">{audioText.trim().length}</span>
          </span>
          <span className="text-muted-foreground">
            预估时长 <span className="font-medium text-foreground tabular-nums">{Math.max(1, Math.ceil(audioText.trim().length / 220 * 60 / speed))} 秒</span>
          </span>
          <span className="text-muted-foreground">
            语速 <span className="font-medium text-foreground tabular-nums">{speed.toFixed(1)}x</span>
          </span>
          {mode === 'gallery' && (
            <span className="text-muted-foreground">
              预计生成 <span className="font-medium text-foreground tabular-nums">{Math.max(1, Math.ceil(Math.max(1, Math.ceil(audioText.trim().length / 220 * 60 / speed)) / 6))} 张</span> 图片
            </span>
          )}
        </div>
      )}
    </>
  );
}
