import React, { useState } from 'react';
import { LayoutTemplate, Check } from 'lucide-react';
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
import { BUILT_IN_TEMPLATES } from '@/lib/template-library';
import type { VideoTemplate } from '@/types/template';

interface VideoTemplatePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedId?: string;
  onSelect: (template: VideoTemplate) => void;
}

const categoryLabels: Record<string, string> = {
  all: '全部',
  popular: '热门',
  business: '商务',
  education: '教育',
  vlog: 'Vlog',
  creative: '创意',
};

const categoryColors: Record<string, string> = {
  popular: 'bg-rose-500',
  business: 'bg-blue-500',
  education: 'bg-emerald-500',
  vlog: 'bg-amber-500',
  creative: 'bg-violet-500',
};

export default function VideoTemplatePicker({
  open,
  onOpenChange,
  selectedId,
  onSelect,
}: VideoTemplatePickerProps) {
  const [filter, setFilter] = useState('all');

  const filtered = filter === 'all'
    ? BUILT_IN_TEMPLATES
    : BUILT_IN_TEMPLATES.filter((t) => t.category === filter);

  const categories = [
    'all',
    ...new Set(BUILT_IN_TEMPLATES.map((t) => t.category)),
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LayoutTemplate className="h-5 w-5 text-primary" />
            选择视频模板
          </DialogTitle>
          <DialogDescription>
            选择一个预设模板快速开始创作，所有参数随后可调整。
          </DialogDescription>
        </DialogHeader>

        {/* Category filter */}
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium transition-colors',
                filter === cat
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-secondary'
              )}
            >
              {cat !== 'all' && (
                <span
                  className={cn(
                    'h-2 w-2 rounded-full',
                    categoryColors[cat] ?? 'bg-muted-foreground'
                  )}
                />
              )}
              {categoryLabels[cat] ?? cat}
            </button>
          ))}
        </div>

        {/* Template grid */}
        <ScrollArea className="h-[400px] pr-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {filtered.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                selected={template.id === selectedId}
                onSelect={() => {
                  onSelect(template);
                  onOpenChange(false);
                }}
              />
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
              该分类暂无模板
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function TemplateCard({
  template,
  selected,
  onSelect,
}: {
  template: VideoTemplate;
  selected: boolean;
  onSelect: () => void;
}) {
  const { name, description, category, size, seconds, perImageDuration, bgm } =
    template;

  const specs = [size, `${seconds}s`, `${perImageDuration}s/张`];
  if (bgm?.name) specs.push(bgm.name);

  return (
    <button
      onClick={onSelect}
      className={cn(
        'group relative flex flex-col rounded-lg border p-4 text-left transition-all',
        selected
          ? 'border-primary ring-1 ring-primary'
          : 'border-border hover:border-primary/50 hover:shadow-sm'
      )}
    >
      {/* Thumbnail placeholder */}
      <div
        className={cn(
          'mb-3 flex aspect-video items-center justify-center rounded-md',
          categoryColors[category] ?? 'bg-muted'
        )}
      >
        <LayoutTemplate className="h-8 w-8 text-white/70" />
      </div>

      {selected && (
        <div className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="h-4 w-4" />
        </div>
      )}

      <h3 className="mb-0.5 font-semibold">{name}</h3>
      <p className="mb-2 text-xs text-muted-foreground line-clamp-2">
        {description}
      </p>

      <div className="mt-auto flex flex-wrap items-center gap-1.5">
        <Badge variant="secondary" className="text-[10px]">
          {categoryLabels[category] ?? category}
        </Badge>
        {specs.map((spec) => (
          <Badge
            key={spec}
            variant="outline"
            className="text-[10px] text-muted-foreground"
          >
            {spec}
          </Badge>
        ))}
      </div>
    </button>
  );
}

/** 触发模板选择的按钮组件 */
export function TemplateSelectButton({
  onClick,
  hasSelection,
}: {
  onClick: () => void;
  hasSelection: boolean;
}) {
  return (
    <Button
      variant={hasSelection ? 'default' : 'outline'}
      size="sm"
      onClick={onClick}
      className="gap-1.5"
    >
      <LayoutTemplate className="h-4 w-4" />
      {hasSelection ? '切换模板' : '选模板'}
    </Button>
  );
}
