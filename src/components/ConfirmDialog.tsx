import React from 'react';
import { FileCheck, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MODES } from '@/constants/modes';
import { VOICE_CATEGORIES } from '@/constants/voices';
import type { CreateMode } from '@/types';
import type { BgmConfig } from '@/components/BgmSettings';
import type { SubtitleConfig } from '@/components/SubtitleSettings';

interface ConfirmDialogProps {
  showConfirmDialog: boolean;
  setShowConfirmDialog: (v: boolean) => void;
  executeGenerate: () => Promise<void>;
  isGenerating: boolean;
  mode: CreateMode;
  audioText: string;
  uploadedAudioName: string;
  uploadedAudioUrl: string;
  voiceId: string;
  speed: number;
  bgmConfig: BgmConfig;
  subtitleConfig: SubtitleConfig;
  generateBase: boolean;
  generateMerged: boolean;
  size: string;
  prompt: string;
  seconds: string;
  isAudioDurationMode: boolean;
  batchSegments: Array<{ id: string; text: string; audioUrl: string; audioName: string }>;
  batchInputText: string;
}

export default function ConfirmDialog({
  showConfirmDialog, setShowConfirmDialog, executeGenerate, isGenerating,
  mode, audioText, uploadedAudioName, uploadedAudioUrl, voiceId, speed,
  bgmConfig, subtitleConfig, generateBase, generateMerged, size,
  prompt, seconds, isAudioDurationMode,
  batchSegments, batchInputText,
}: ConfirmDialogProps) {
  return (
    <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5 text-primary" />
            确认创作配置
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2 text-sm">
          <div className="flex justify-between py-1.5 border-b border-border">
            <span className="text-muted-foreground">创作模式</span>
            <span className="font-medium">{MODES.find((m) => m.key === mode)?.label}</span>
          </div>
          {(mode === 'gallery' || mode === 'audio') && (
            <>
              <div className="flex justify-between py-1.5 border-b border-border">
                <span className="text-muted-foreground">{mode === 'audio' ? '音频文件' : '语音文案'}</span>
                <span className="font-medium truncate max-w-[200px]">
                  {mode === 'audio' ? (uploadedAudioName || '已上传') : audioText.trim().slice(0, 20) + (audioText.trim().length > 20 ? '...' : '')}
                </span>
              </div>
              {mode === 'audio' && (
                <div className="flex justify-between py-1.5 border-b border-border">
                  <span className="text-muted-foreground">识别文案</span>
                  <span className="font-medium truncate max-w-[200px]">{audioText.trim().slice(0, 20) || '（未识别）'}{audioText.trim().length > 20 ? '...' : ''}</span>
                </div>
              )}
              <div className="flex justify-between py-1.5 border-b border-border">
                <span className="text-muted-foreground">预估时长</span>
                <span className="font-medium">{Math.max(1, Math.ceil(audioText.trim().length / 220 * 60 / speed))} 秒</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border">
                <span className="text-muted-foreground">图片数量</span>
                <span className="font-medium">{Math.max(1, Math.ceil(Math.max(1, Math.ceil(audioText.trim().length / 220 * 60 / speed)) / 6))} 张</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border">
                <span className="text-muted-foreground">音色</span>
                <span className="font-medium truncate max-w-[200px]">
                  {VOICE_CATEGORIES.flatMap((c) => c.voices).find((v) => v.value === voiceId)?.label || voiceId}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border">
                <span className="text-muted-foreground">背景音乐</span>
                <span className="font-medium">{bgmConfig.enabled ? (bgmConfig.name || '已启用') : '无'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border">
                <span className="text-muted-foreground">字幕</span>
                <span className="font-medium">{subtitleConfig.enabled ? '已启用' : '无'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border">
                <span className="text-muted-foreground">生成版本</span>
                <span className="font-medium">
                  {generateBase && generateMerged ? '基础版 + 整合版' : generateBase ? '仅基础版' : generateMerged ? '仅整合版' : '未选择'}
                </span>
              </div>
            </>
          )}
          {mode === 'batch' && (
            <>
              <div className="flex justify-between py-1.5 border-b border-border">
                <span className="text-muted-foreground">分段数量</span>
                <span className="font-medium">{Math.max(batchSegments.length, batchInputText.split('\n').filter((l) => l.trim()).length)} 段</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border">
                <span className="text-muted-foreground">音色</span>
                <span className="font-medium truncate max-w-[200px]">
                  {VOICE_CATEGORIES.flatMap((c) => c.voices).find((v) => v.value === voiceId)?.label || voiceId}
                </span>
              </div>
            </>
          )}
          {(mode === 'text' || mode === 'image' || mode === 'remix') && (
            <>
              <div className="flex justify-between py-1.5 border-b border-border">
                <span className="text-muted-foreground">视频描述</span>
                <span className="font-medium truncate max-w-[200px]">{prompt.trim().slice(0, 20) || '（未填写）'}{prompt.trim().length > 20 ? '...' : ''}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border">
                <span className="text-muted-foreground">时长</span>
                <span className="font-medium">{isAudioDurationMode ? '按音频时长' : seconds + ' 秒'}</span>
              </div>
              {audioText.trim() && (
                <div className="flex justify-between py-1.5 border-b border-border">
                  <span className="text-muted-foreground">语音合成</span>
                  <span className="font-medium">已启用</span>
                </div>
              )}
            </>
          )}
          <div className="flex justify-between py-1.5 border-b border-border">
            <span className="text-muted-foreground">视频尺寸</span>
            <span className="font-medium">{size}</span>
          </div>
        </div>
        <div className="flex gap-3 pt-4">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => setShowConfirmDialog(false)}
          >
            取消
          </Button>
          <Button
            className="flex-1"
            onClick={executeGenerate}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                生成中...
              </span>
            ) : (
              <>
                <Wand2 className="h-4 w-4" />
                确认生成
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
