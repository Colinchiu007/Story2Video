import React from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import EffectPicker, { EffectSettingsButton } from '@/components/EffectPicker';
import { IMAGE_EFFECTS, TRANSITION_EFFECTS } from '@/constants/effects';
import type { CreateMode } from '@/types';

interface SettingsGridProps {
  size: string;
  setSize: (v: string) => void;
  mode: CreateMode;
  imageEffect: string;
  setImageEffect: (v: string) => void;
  transitionEffect: string;
  setTransitionEffect: (v: string) => void;
  perImageDuration: number;
  setPerImageDuration: (v: number) => void;
  seconds: string;
  setSeconds: (v: string) => void;
  isAudioDurationMode: boolean;
  effectOpen: boolean;
  setEffectOpen: (v: boolean) => void;
}

const RESOLUTIONS = [
  { value: '720x1280', label: '720P', desc: '竖屏', ratio: 'aspect-[9/16]' },
  { value: '1080x1920', label: '1080P', desc: '竖屏', ratio: 'aspect-[9/16]' },
  { value: '1280x720', label: '720P', desc: '横屏', ratio: 'aspect-[16/9]' },
  { value: '1920x1080', label: '1080P', desc: '横屏', ratio: 'aspect-[16/9]' },
];

const DURATIONS = [
  { value: '4', label: '4 秒' },
  { value: '8', label: '8 秒' },
  { value: '12', label: '12 秒' },
  { value: '30', label: '30 秒' },
  { value: '60', label: '60 秒' },
  { value: 'audio', label: '根据语音时长' },
];

const PER_IMAGE_DURATIONS = [
  { value: 3, label: '3 秒' },
  { value: 6, label: '6 秒' },
  { value: 8, label: '8 秒' },
  { value: 10, label: '10 秒' },
  { value: 15, label: '15 秒' },
];

export default function SettingsGrid({
  size, setSize, mode, imageEffect, setImageEffect, transitionEffect, setTransitionEffect,
  perImageDuration, setPerImageDuration, seconds, setSeconds, isAudioDurationMode,
  effectOpen, setEffectOpen,
}: SettingsGridProps) {
  return (
    <div className="border-t border-border pt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label>分辨率</Label>
        <div className="grid grid-cols-4 gap-2">
          {RESOLUTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setSize(opt.value)}
              className={`flex flex-col items-center gap-1.5 p-2 rounded-sm border transition-colors ${
                size === opt.value
                  ? 'border-primary bg-primary/10'
                  : 'border-border bg-background hover:border-primary/50'
              }`}
            >
              <div className={`w-8 ${opt.ratio} rounded-[2px] border-2 ${size === opt.value ? 'border-primary' : 'border-muted-foreground/30'}`} />
              <span className={`text-xs font-medium ${size === opt.value ? 'text-primary' : 'text-foreground'}`}>{opt.label}</span>
              <span className="text-[10px] text-muted-foreground">{opt.desc}</span>
            </button>
          ))}
        </div>
      </div>
      {mode === 'gallery' ? (
        <>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-2">
              <Label>图片动态效果</Label>
              <Select value={imageEffect} onValueChange={setImageEffect}>
                <SelectTrigger className="bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {IMAGE_EFFECTS.map((e) => (
                    <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 space-y-2">
              <Label>图片切换特效</Label>
              <Select value={transitionEffect} onValueChange={setTransitionEffect}>
                <SelectTrigger className="bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRANSITION_EFFECTS.map((e) => (
                    <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end pt-1">
              <EffectSettingsButton
                onClick={() => setEffectOpen(true)}
                imageEffect={imageEffect}
                transitionEffect={transitionEffect}
              />
            </div>
            <EffectPicker
              open={effectOpen}
              onOpenChange={setEffectOpen}
              imageEffect={imageEffect}
              transitionEffect={transitionEffect}
              onImageEffectChange={setImageEffect}
              onTransitionEffectChange={setTransitionEffect}
            />
            <div className="space-y-2">
              <Label>每张图片展示时长</Label>
              <Select value={String(perImageDuration)} onValueChange={(v) => setPerImageDuration(Number(v))}>
                <SelectTrigger className="bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PER_IMAGE_DURATIONS.map((e) => (
                    <SelectItem key={e.value} value={String(e.value)}>{e.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">根据语音时长自动计算图片数量</p>
            </div>
          </div>
        </>
      ) : (
        <div className="space-y-2">
          <Label>时长</Label>
          <Select value={seconds} onValueChange={setSeconds}>
            <SelectTrigger className="bg-background border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DURATIONS.map((d) => (
                <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isAudioDurationMode && (
            <p className="text-xs text-primary flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary" />
              先生成语音，再根据语音时长生成对应时长的视频
            </p>
          )}
          {!isAudioDurationMode && Number(seconds) > 12 && (
            <p className="text-xs text-primary flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary" />
              长视频将拆分为 {Math.ceil(Number(seconds) / 12)} 个 12 秒片段并行生成
            </p>
          )}
        </div>
      )}
    </div>
  );
}
