import React, { useState } from 'react';
import { Sparkles, Layout, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  IMAGE_EFFECTS,
  TRANSITION_EFFECTS,
  getRecommendedTransitions,
} from '@/lib/effects-library';
import type { ImageEffect, TransitionEffect, EffectMeta } from '@/types/effects';

interface EffectPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Currently selected image effect */
  imageEffect: string;
  /** Currently selected transition effect */
  transitionEffect: string;
  /** Called when user saves changes */
  onSave: (imageEffect: string, transitionEffect: string) => void;
}

export default function EffectPicker({
  open,
  onOpenChange,
  imageEffect: initialImageEffect,
  transitionEffect: initialTransitionEffect,
  onSave,
}: EffectPickerProps) {
  const [selectedImage, setSelectedImage] = useState(initialImageEffect);
  const [selectedTransition, setSelectedTransition] = useState(initialTransitionEffect);

  // Reset state when dialog opens
  React.useEffect(() => {
    if (open) {
      setSelectedImage(initialImageEffect);
      setSelectedTransition(initialTransitionEffect);
    }
  }, [open, initialImageEffect, initialTransitionEffect]);

  const recommended = getRecommendedTransitions(selectedImage);

  const handleSave = () => {
    onSave(selectedImage, selectedTransition);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            视频特效设置
          </DialogTitle>
          <DialogDescription>
            选择图片动态效果和画面切换方式，打造个性化的视觉风格。
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="py-2 space-y-6">
            {/* Image effects section */}
            <section>
              <h3 className="flex items-center gap-1.5 text-sm font-semibold mb-3">
                <Sparkles className="h-4 w-4 text-primary" />
                图片动效
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {IMAGE_EFFECTS.map((effect) => (
                  <EffectCard
                    key={effect.id}
                    effect={effect}
                    selected={selectedImage === effect.id}
                    onSelect={() => setSelectedImage(effect.id)}
                  />
                ))}
              </div>
            </section>

            {/* Transition effects section */}
            <section>
              <h3 className="flex items-center gap-1.5 text-sm font-semibold mb-3">
                <Layout className="h-4 w-4 text-primary" />
                转场效果
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {TRANSITION_EFFECTS.map((effect) => {
                  const isRecommended = recommended.includes(effect.id);
                  return (
                    <EffectCard
                      key={effect.id}
                      effect={effect}
                      selected={selectedTransition === effect.id}
                      onSelect={() => setSelectedTransition(effect.id)}
                      recommended={isRecommended}
                    />
                  );
                })}
              </div>
            </section>
          </div>
        </ScrollArea>

        <div className="flex items-center justify-between border-t border-border pt-4 shrink-0">
          <p className="text-xs text-muted-foreground">
            当前：{IMAGE_EFFECTS.find((e) => e.id === selectedImage)?.label ?? selectedImage}
            {' → '}
            {TRANSITION_EFFECTS.find((e) => e.id === selectedTransition)?.label ?? selectedTransition}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button onClick={handleSave}>
              应用特效
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EffectCard({
  effect,
  selected,
  onSelect,
  recommended,
}: {
  effect: EffectMeta;
  selected: boolean;
  onSelect: () => void;
  recommended?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'relative flex items-start gap-3 rounded-sm border p-3 text-left transition-all',
        selected
          ? 'border-primary bg-primary/5 ring-1 ring-primary'
          : 'border-border bg-card hover:border-primary/50 hover:shadow-sm'
      )}
    >
      {/* Selection indicator */}
      <div
        className={cn(
          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
          selected
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-muted-foreground/30'
        )}
      >
        {selected && <Check className="h-3 w-3" />}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-sm font-medium">{effect.label}</span>
          <span className="text-xs text-muted-foreground">({effect.id})</span>
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2">
          {effect.description}
        </p>
        <div className="flex flex-wrap gap-1 mt-1.5">
          {effect.suitable.slice(0, 2).map((s) => (
            <Badge key={s} variant="secondary" className="text-[10px]">
              {s}
            </Badge>
          ))}
          {effect.hint && (
            <Badge variant="outline" className="text-[10px] text-muted-foreground">
              {effect.hint}
            </Badge>
          )}
          {recommended && (
            <Badge variant="default" className="text-[10px] bg-primary/80">
              推荐搭配
            </Badge>
          )}
        </div>
      </div>
    </button>
  );
}

/** 触发特效设置按钮 */
export function EffectSettingsButton({
  onClick,
  currentImageEffect,
  currentTransitionEffect,
}: {
  onClick: () => void;
  currentImageEffect: string;
  currentTransitionEffect: string;
}) {
  const imageLabel =
    IMAGE_EFFECTS.find((e) => e.id === currentImageEffect)?.label ??
    currentImageEffect;
  const transitionLabel =
    TRANSITION_EFFECTS.find((e) => e.id === currentTransitionEffect)?.label ??
    currentTransitionEffect;

  return (
    <Button variant="outline" size="sm" onClick={onClick} className="gap-1.5">
      <Sparkles className="h-4 w-4" />
      特效
      <span className="ml-0.5 text-xs text-muted-foreground">
        {imageLabel} / {transitionLabel}
      </span>
    </Button>
  );
}
