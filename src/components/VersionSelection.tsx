import React from 'react';
import { Layers } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

interface VersionSelectionProps {
  generateBase: boolean;
  setGenerateBase: (v: boolean) => void;
  generateMerged: boolean;
  setGenerateMerged: (v: boolean) => void;
  isGenerating: boolean;
}

export default function VersionSelection({
  generateBase, setGenerateBase, generateMerged, setGenerateMerged, isGenerating,
}: VersionSelectionProps) {
  return (
    <div className="space-y-3 border border-border rounded-sm p-4 bg-muted/20">
      <Label className="font-medium flex items-center gap-1">
        <Layers className="h-4 w-4 text-primary" />
        视频版本
      </Label>
      <div className="flex flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <Checkbox
            id="generate-base"
            checked={generateBase}
            onCheckedChange={(v) => setGenerateBase(v === true)}
            disabled={isGenerating}
          />
          <Label htmlFor="generate-base" className="text-sm cursor-pointer">
            基础版（语音+画面）
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="generate-merged"
            checked={generateMerged}
            onCheckedChange={(v) => setGenerateMerged(v === true)}
            disabled={isGenerating}
          />
          <Label htmlFor="generate-merged" className="text-sm cursor-pointer">
            整合版（语音+背景音乐+字幕）
          </Label>
        </div>
      </div>
      {!generateBase && !generateMerged && (
        <p className="text-xs text-destructive">请至少选择一个视频版本</p>
      )}
    </div>
  );
}
